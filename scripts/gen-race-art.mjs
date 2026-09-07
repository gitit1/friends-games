// Bakes the car-race scene's material art — a real toy RACE CAR (per paint colour),
// its rubber WHEEL, the perspective ROAD ground (asphalt + grass verge + baked
// converging edge lines) and the streaming lane DASH tile.
//
// Same pipeline as the coin-sort / skip-count / train materials
// (public/art/sprites/*): a node-canvas bake with seeded value-noise grain,
// analytic shape SDFs, cylindrical/dome shading and baked lighting / AO /
// contact-shadow. No third-party assets — all original, CC0. Muted throughout
// (sensory-calm: no neon), each sprite well under budget.
//
// One-off build tool. Needs @napi-rs/canvas (a prebuilt drop-in for node-canvas):
//   npm i --no-save @napi-rs/canvas && node scripts/gen-race-art.mjs
// (the dep is NOT kept permanently — reinstall it to regenerate.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/race/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise — the grain generator (shared with the other bakes) ----
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function makeNoise(seed) {
  const rnd = mulberry32(seed)
  const perm = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const P = new Uint8Array(512)
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255]
  const grad = (h) => (h & 1 ? -1 : 1) * (0.5 + (h & 7) / 14)
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  return (x, y) => {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const u = fade(xf)
    const v = fade(yf)
    const aa = P[P[xi] + yi]
    const ab = P[P[xi] + yi + 1]
    const ba = P[P[xi + 1] + yi]
    const bb = P[P[xi + 1] + yi + 1]
    const lp = (a, b, t) => a + t * (b - a)
    const x1 = lp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lp(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)
const mix3 = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]

// signed distance to a rounded rectangle (negative inside)
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r)
  const dy = Math.abs(py - cy) - (hh - r)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r
}

// ============================================================================
// THE RACE CAR — a cute side-view toy racer (open cockpit "tub" the friend rides
// in), facing RIGHT. Per-pixel cylindrical shading + upper-left key light, baked
// AO under the body and around the cockpit, a specular streak on the hood, a top
// rim-light, a glass windshield, a warm headlamp, and a soft contact shadow.
// The BODY paint colour is passed in, so one function bakes all eight cars.
// Wheels are a SEPARATE sprite (they spin), dropped over the two arch gaps.
// ============================================================================
const CARW = 232
const CARH = 150
const nBodyGrain = makeNoise(4711)
const nFleck = makeNoise(8123)

function bakeCar(base, name) {
  const cv = createCanvas(CARW, CARH)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(CARW, CARH)
  const d = img.data

  // paint tones derived from the (already muted) base colour
  const DARK = mix3(base, [18, 22, 30], 0.55) // deep shade / underside
  const LIGHT = mix3(base, [255, 252, 245], 0.5) // lit top
  const HI = mix3(base, [255, 255, 250], 0.82) // specular

  // body top/bottom in car space (for cylindrical shading)
  const BODY_TOP = 74
  const BODY_BOT = 122
  // cockpit seat well (the friend sits here — overlaid on top in the DOM)
  const seat = { cx: 100, cy: 82, rx: 38, ry: 17 }
  // wheel arch centres (wheels overlay here)
  const archR = { cx: 66, cy: 124, r: 27 } // rear (left)
  const archF = { cx: 172, cy: 124, r: 27 } // front (right)

  for (let y = 0; y < CARH; y++) {
    for (let x = 0; x < CARW; x++) {
      const idx = (y * CARW + x) << 2

      // ---- body silhouette: sleek open racer (low tub + tapered nose + rear
      // headrest bump), facing right ----
      const tub = sdRoundRect(x, y, 116, 102, 104, 20, 18) // lower body x[12..220] y[82..122]
      const nose1 = sdRoundRect(x, y, 184, 98, 40, 15, 14) // hood/nose x[144..224] y[83..113]
      const nose2 = sdRoundRect(x, y, 210, 96, 18, 10, 9) // pointed tip x[192..228]
      const rest = sdRoundRect(x, y, 58, 82, 30, 20, 17) // rear headrest x[28..88] y[62..102]
      let body = Math.min(tub, nose1, nose2, rest)

      // carve the open cockpit out of the top-middle (a seat well)
      const seatD = ((x - seat.cx) / seat.rx) ** 2 + ((y - seat.cy) / seat.ry) ** 2
      const inSeat = seatD <= 1 && y < seat.cy + 2 // upper half is the open well

      // wheel arch cutouts (leave gaps for the wheel sprites)
      const inArchR = Math.hypot(x - archR.cx, y - archR.cy) < archR.r && y > 112
      const inArchF = Math.hypot(x - archF.cx, y - archF.cy) < archF.r && y > 112

      if (body < 0 && !inArchR && !inArchF) {
        // vertical position on the body → fake cylinder normal (top lit)
        const t = clamp((y - BODY_TOP) / (BODY_BOT - BODY_TOP), 0, 1) // 0 top → 1 bottom
        const ny = 1 - 2 * t // +1 top .. -1 bottom
        const nz = Math.sqrt(Math.max(0, 1 - ny * ny))
        // key light from upper-left
        const diff = clamp(0.55 * nz + 0.5 * ny + 0.18 * (1 - (x / CARW)), 0, 1.4)
        let shade = 0.5 + 0.62 * diff

        // paint grain + metallic fleck (very subtle)
        shade *= 1 + nBodyGrain(x * 0.06, y * 0.06) * 0.05 + nFleck(x * 0.5, y * 0.5) * 0.03

        // baked AO along the very bottom skirt + under the cabin
        const bottomAO = smooth(clamp((y - 106) / 16, 0, 1))
        shade *= 1 - bottomAO * 0.34
        // edge AO (darken toward the outline)
        const edge = smooth(clamp(1 + body / 6, 0, 1)) // ~1 just inside edge → 0 deep inside
        shade *= 1 - edge * 0.16

        // build the paint colour along the DARK→base→LIGHT ramp
        let col
        if (shade < 1) col = mix3(DARK, base, clamp(shade / 1, 0, 1))
        else col = mix3(base, LIGHT, clamp(shade - 1, 0, 1))

        // top rim-light: a bright hairline on the uppermost lit edge
        if (body > -3 && ny > 0.2) {
          const rim = smooth(clamp((body + 3) / 3, 0, 1)) * smooth(ny)
          col = mix3(col, HI, rim * 0.5)
        }
        // specular streak across the hood/nose
        const sp = Math.exp(-(((y - 92) / 6) ** 2)) * clamp((x - 118) / 96, 0, 1)
        col = mix3(col, HI, sp * 0.4)

        // door roundel (a lighter disc for a race-car look, baked, no digit)
        const rd = Math.hypot(x - 120, y - 104)
        if (rd < 14) col = mix3(col, LIGHT, smooth(clamp(1 - rd / 14, 0, 1)) * 0.32)
        if (rd > 12 && rd < 15) col = mix3(col, DARK, 0.3)

        // cockpit: a lit rim around the opening, then a dark seat recess. A thin
        // dark-glass windscreen catches the light along the FRONT lip only.
        if (inSeat) {
          const well = smooth(clamp(1 - seatD, 0, 1))
          col = mix3(col, [42, 36, 44], 0.5 + well * 0.34)
        } else if (seatD < 1.5) {
          // lit rim just outside the opening
          const rim = smooth(clamp((1.5 - seatD) / 0.5, 0, 1)) * smooth(clamp((seatD - 1) / 0.5, 0, 1))
          col = mix3(col, HI, rim * 0.5)
          // windscreen glass along the front lip of the cockpit
          if (x > seat.cx + 22 && y < seat.cy) {
            col = mix3(col, [150, 176, 194], 0.4)
          }
        }

        let a = 255
        if (body > -1.2) a = clamp((-body + 1.2) / 1.2, 0, 1) * 255 // AA edge
        d[idx] = clamp(col[0], 0, 255)
        d[idx + 1] = clamp(col[1], 0, 255)
        d[idx + 2] = clamp(col[2], 0, 255)
        d[idx + 3] = a
      } else {
        // ---- soft contact shadow on the ground under the car ----
        const sh = ((x - 118) / 104) ** 2 + ((y - 136) / 11) ** 2
        if (sh <= 1 && y > 122) {
          const cov = smooth(clamp(1 - sh, 0, 1))
          d[idx] = 30
          d[idx + 1] = 26
          d[idx + 2] = 22
          d[idx + 3] = clamp(cov * cov * 120, 0, 255)
        } else {
          d[idx + 3] = 0
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  // warm headlamp at the front tip (vector, on top)
  const g = ctx.createRadialGradient(216, 98, 0, 216, 98, 8)
  g.addColorStop(0, 'rgba(255,246,214,0.95)')
  g.addColorStop(0.6, 'rgba(250,214,140,0.7)')
  g.addColorStop(1, 'rgba(250,214,140,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(216, 98, 8, 0, Math.PI * 2)
  ctx.fill()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log(`  ✓ ${name}`, `${CARW}×${CARH}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE WHEEL — a rubber tyre + brushed-alloy hub with five spokes, baked top-left
// highlight, tyre tread ring + a dark centre. Spins as a whole in the game.
// ============================================================================
function bakeWheel() {
  const S = 76
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(S, S)
  const d = img.data
  const c = S / 2
  const R = 36
  const nGrit = makeNoise(3391)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      if (r > R) {
        d[idx + 3] = 0
        continue
      }
      // top-left key light across the whole wheel
      const key = clamp(0.5 - (dx + dy) / (R * 2.6), 0, 1)
      let col
      if (r > R * 0.66) {
        // rubber tyre — dark, subtle tread
        const tread = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 26)
        let sh = 0.7 + key * 0.6 + nGrit(x * 0.5, y * 0.5) * 0.08 + tread * 0.05
        col = mix3([26, 28, 34], [66, 70, 80], clamp(sh, 0, 1))
      } else if (r > R * 0.5) {
        // alloy rim ring
        col = mix3([120, 128, 140], [214, 222, 232], clamp(0.3 + key, 0, 1))
      } else {
        // hub with spokes
        const ang = Math.atan2(dy, dx)
        const spoke = Math.abs(((ang % (Math.PI / 2.5)) + Math.PI / 2.5) % (Math.PI / 2.5) - Math.PI / 5)
        const isSpoke = spoke < 0.34 || r < R * 0.16
        const baseHub = isSpoke ? [180, 188, 200] : [96, 104, 116]
        col = mix3(baseHub, [235, 240, 246], clamp(key * 0.9, 0, 1))
        if (r < R * 0.1) col = mix3(col, [70, 76, 88], 0.6) // centre cap
      }
      // outer edge AO
      if (r > R - 3) col = mix3(col, [12, 12, 16], smooth((r - (R - 3)) / 3) * 0.7)
      let a = 255
      if (r > R - 1.2) a = clamp((R - r) / 1.2, 0, 1) * 255
      d[idx] = clamp(col[0], 0, 255)
      d[idx + 1] = clamp(col[1], 0, 255)
      d[idx + 2] = clamp(col[2], 0, 255)
      d[idx + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('wheel.png'), buf)
  console.log('  ✓ wheel.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE GROUND TILE — a full-width strip: muted asphalt road band in the centre
// with baked cream edge lines, muted grass verges either side, all textured.
// It is stretched onto the rotateX perspective plane, so its straight edges
// become the CONVERGING lane lines receding to the horizon. Streaming dashes
// are a SEPARATE animated overlay (see dash.png).
// ============================================================================
function bakeGround() {
  const W = 256
  const H = 512
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const nAsp = makeNoise(6021)
  const nAgg = makeNoise(2288)
  const nGrass = makeNoise(9110)
  const roadL = W * 0.28
  const roadR = W * 0.72
  const ASPH = [64, 71, 82]
  const ASPH_D = [48, 54, 64]
  const GRASS = [104, 126, 92]
  const GRASS_D = [78, 98, 70]
  const EDGE = [214, 208, 178]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      let col
      if (x > roadL && x < roadR) {
        // asphalt — fine grain + a few lighter aggregate flecks
        const g = nAsp(x * 0.08, y * 0.08) * 0.5 + nAsp(x * 0.3, y * 0.3) * 0.3
        const agg = Math.max(0, nAgg(x * 0.7, y * 0.7)) * 0.5
        col = mix3(ASPH_D, ASPH, clamp(0.5 + g, 0, 1))
        col = mix3(col, [120, 126, 134], agg * 0.25)
        // centre crown a touch lighter, gutters a touch darker (subtle camber)
        const cx = Math.abs(x - W / 2) / (W * 0.22)
        col = mix3(col, ASPH_D, clamp(cx - 0.6, 0, 1) * 0.4)
      } else {
        // grass verge, darker toward the road edge (AO from the kerb)
        const gg = nGrass(x * 0.12, y * 0.12) * 0.5 + nGrass(x * 0.4, y * 0.4) * 0.3
        col = mix3(GRASS_D, GRASS, clamp(0.5 + gg, 0, 1))
        const toRoad = x <= roadL ? (roadL - x) / 26 : (x - roadR) / 26
        col = mix3([60, 74, 56], col, clamp(toRoad, 0, 1))
      }
      // baked cream edge lines flanking the road
      const dL = Math.abs(x - roadL)
      const dR = Math.abs(x - roadR)
      const line = Math.min(dL, dR)
      if (line < 3.2) col = mix3(col, EDGE, smooth(clamp(1 - line / 3.2, 0, 1)) * 0.85)
      d[idx] = clamp(col[0], 0, 255)
      d[idx + 1] = clamp(col[1], 0, 255)
      d[idx + 2] = clamp(col[2], 0, 255)
      d[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('ground.png'), buf)
  console.log('  ✓ ground.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE DASH TILE — one muted-amber centre lane dash + gap, on transparent. Tiled
// vertically on the road plane and translated to STREAM toward the car (the loved
// "moving road stripes"). Soft edges + a little baked shading so it reads painted.
// ============================================================================
function bakeDash() {
  const W = 40
  const H = 96 // dash 44 + gap 52
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const dashTop = 6
  const dashBot = 50
  const DASH = [216, 196, 120]
  const DASH_D = [180, 158, 92]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const inY = y > dashTop && y < dashBot
      const halfW = 8
      const dx = Math.abs(x - W / 2)
      if (inY && dx < halfW) {
        const t = clamp((y - dashTop) / (dashBot - dashTop), 0, 1)
        let col = mix3(DASH, DASH_D, Math.abs(t - 0.5) * 0.7)
        col = mix3(col, [245, 235, 200], Math.exp(-(((x - W / 2 + 2) / 3) ** 2)) * 0.4)
        let a = 255
        if (dx > halfW - 2) a = clamp((halfW - dx) / 2, 0, 1) * 255
        const eY = Math.min(y - dashTop, dashBot - y)
        if (eY < 3) a *= clamp(eY / 3, 0, 1)
        d[idx] = col[0]
        d[idx + 1] = col[1]
        d[idx + 2] = col[2]
        d[idx + 3] = a
      } else {
        d[idx + 3] = 0
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('dash.png'), buf)
  console.log('  ✓ dash.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// muted paint palette — shared with the garage swatches in CarRace.tsx (RACE_COLORS)
const COLORS = [
  ['car-red', [198, 90, 78]],
  ['car-orange', [208, 138, 76]],
  ['car-yellow', [203, 178, 78]],
  ['car-green', [111, 168, 106]],
  ['car-blue', [91, 134, 176]],
  ['car-indigo', [109, 107, 176]],
  ['car-pink', [192, 121, 160]],
  ['car-graphite', [63, 74, 90]],
]

console.log('Baking car-race art →')
bakeGround()
bakeDash()
bakeWheel()
for (const [name, rgb] of COLORS) bakeCar(rgb, name + '.png')
console.log('Done.')
