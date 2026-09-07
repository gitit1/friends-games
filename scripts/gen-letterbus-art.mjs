// Bakes the "אוטובוס האותיות" (letter bus) scene materials — a real soft-toy BUS,
// its rubber WHEEL, the receding STREET ground (asphalt + curbs + sidewalk with
// baked perspective haze) and the BUS-STOP (enamel sign on a pole + a wooden
// bench). Everything the child used to see as flat CSS gradients/boxes is now a
// baked sprite with texture + baked lighting / AO / contact shadow.
//
// Doctrine: MATERIALS are real, not CSS — the bus / street / stop / seats are
// baked here; only the crisp HEBREW LETTERS stay CSS text (the shared LetterGuy)
// on top, so they read razor-sharp. Muted, sensory-calm palette — one warm HERO
// colour (the butter-yellow bus) against warm-grey road + sage town; nothing neon.
//
// Same pipeline as the car-race / coin-sort / dice materials
// (public/art/sprites/*): a @napi-rs/canvas bake with seeded value-noise grain,
// analytic shape SDFs, cylindrical/dome shading and baked light / AO / shadow.
// No third-party art — all original, CC0. Each sprite well under budget.
//
// The bus is baked facing LEFT (Hebrew reads right-to-left → the bus drives toward
// the reading-forward side, LEFT). The passenger window band is CENTRED on the bus
// so the runtime rider overlay + English mirror (scaleX -1 on the IMAGE only) both
// line up without moving the letters. Front windshield + headlight + door sit on
// the LEFT; the two wheel ARCHES are carved out and a separate wheel.png drops in
// (so the wheels can gently spin only while the bus drives off).
//
// One-off build tool. Needs @napi-rs/canvas (already pinned in package.json):
//   node scripts/gen-letterbus-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/letterbus/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise — the material grain generator (shared across bakes) ----
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
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`

// signed distance to a rounded rectangle (negative inside)
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r)
  const dy = Math.abs(py - cy) - (hh - r)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
// full-canvas grain pass (multiplies every opaque pixel by a subtle noise factor)
function grainPass(ctx, W, H, noise, amt = 0.045) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const m = 1 + (noise(x * 0.5, y * 0.5) * 0.6 + noise(x * 1.7, y * 1.7) * 0.4) * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  ctx.putImageData(img, 0, 0)
}

// ---- muted, sensory-calm palette ------------------------------------------------
const BUS = [228, 190, 112] // warm butter yellow — the HERO (warmest, most saturated)
const GLASS = [150, 176, 194] // muted slate glass
const RUBBER = [30, 32, 38]
const ALLOY = [150, 160, 172]
const ASPH = [96, 98, 104] // warm-grey asphalt
const ASPH_D = [76, 78, 84]
const WALK = [178, 172, 160] // sidewalk paving (warm stone)
const WALK_D = [150, 145, 134]
const CURB = [198, 192, 180]
const DASH = [206, 196, 158] // muted cream lane dashes
const SIGN = [96, 150, 148] // muted teal enamel sign
const POLE = [150, 156, 164]
const WOOD = [176, 140, 96]
const WOOD_D = [138, 106, 70]

// ============================================================================
// THE BUS — a friendly rounded side-view bus, facing LEFT. Per-pixel cylindrical
// body shading (top lit) + upper-left key light, baked bottom AO + edge AO, a
// warm paint grain, a soft baked contact shadow, then vector detail passes for
// the glass window band (with driver), the folding door, headlight, roof line and
// the two carved wheel arches. W×H chosen so the window band lands on tidy %s.
// ============================================================================
const BW = 760
const BH = 300
// passenger window band (CENTRED on the bus → symmetric under the English mirror)
const WIN = { x0: 244, x1: 516, y0: 86, y1: 168 } // → app.css --lb-win-* (fractions below)
// front windshield (driver rides behind it, on the leading LEFT side)
const SHIELD = { x0: 70, x1: 152, y0: 90, y1: 168 }
// folding passenger door, just behind the windshield
const DOOR = { x0: 166, x1: 214, y0: 104, y1: 232 }
// rear window (a small one, balances the tail)
const REAR = { x0: 548, x1: 664, y0: 86, y1: 168 }
// wheel arch centres (a separate wheel.png drops over these)
const ARCH_F = { cx: 210, cy: 236, r: 52 }
const ARCH_R = { cx: 550, cy: 236, r: 52 } // symmetric with ARCH_F about BW/2 → one wheel % works in he+en

const nBus = makeNoise(5150)
const nFleck = makeNoise(2277)

function bakeBus() {
  const cv = createCanvas(BW, BH)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(BW, BH)
  const d = img.data

  const DARK = mix3(BUS, [26, 22, 14], 0.5)
  const LIGHT = mix3(BUS, [255, 250, 236], 0.55)
  const HI = mix3(BUS, [255, 255, 244], 0.85)

  const BODY_TOP = 70
  const BODY_BOT = 238
  const bodyCx = BW / 2

  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      const idx = (y * BW + x) << 2

      // ---- body silhouette: a rounded bus box + a soft snub nose at the front ----
      const main = sdRoundRect(x, y, bodyCx, 154, 350, 86, 46)
      const nose = sdRoundRect(x, y, 60, 176, 42, 60, 26) // rounded front-left snout
      let body = Math.min(main, nose)

      // carve the two wheel arches (leave gaps for the wheel sprite)
      const inArchF = Math.hypot(x - ARCH_F.cx, y - ARCH_F.cy) < ARCH_F.r && y > 214
      const inArchR = Math.hypot(x - ARCH_R.cx, y - ARCH_R.cy) < ARCH_R.r && y > 214

      if (body < 0 && !inArchF && !inArchR) {
        // vertical position → fake cylinder normal (roof lit, skirt shaded)
        const t = clamp((y - BODY_TOP) / (BODY_BOT - BODY_TOP), 0, 1)
        const ny = 1 - 2 * t
        const nz = Math.sqrt(Math.max(0, 1 - ny * ny))
        const diff = clamp(0.5 * nz + 0.52 * ny + 0.16 * (1 - x / BW), 0, 1.4)
        let shade = 0.52 + 0.6 * diff
        // paint grain + faint fleck
        shade *= 1 + nBus(x * 0.05, y * 0.05) * 0.05 + nFleck(x * 0.5, y * 0.5) * 0.025
        // baked bottom skirt AO + edge AO
        shade *= 1 - smooth(clamp((y - 196) / 42, 0, 1)) * 0.36
        shade *= 1 - smooth(clamp(1 + body / 7, 0, 1)) * 0.15

        let col = shade < 1 ? mix3(DARK, BUS, clamp(shade, 0, 1)) : mix3(BUS, LIGHT, clamp(shade - 1, 0, 1))
        // a warm belt-line stripe (muted, a touch deeper) across the lower body
        const belt = Math.exp(-(((y - 196) / 12) ** 2))
        col = mix3(col, mix3(BUS, [150, 96, 60], 0.5), belt * 0.28)
        // top rim-light on the roof edge
        if (body > -3 && ny > 0.25) col = mix3(col, HI, smooth(clamp((body + 3) / 3, 0, 1)) * smooth(ny) * 0.5)

        let a = 255
        if (body > -1.2) a = clamp((-body + 1.2) / 1.2, 0, 1) * 255
        d[idx] = clamp(col[0], 0, 255)
        d[idx + 1] = clamp(col[1], 0, 255)
        d[idx + 2] = clamp(col[2], 0, 255)
        d[idx + 3] = a
      } else {
        // soft baked contact shadow on the road, under the bus
        const sh = ((x - bodyCx) / 360) ** 2 + ((y - 268) / 15) ** 2
        if (sh <= 1 && y > 238) {
          const cov = smooth(clamp(1 - sh, 0, 1))
          d[idx] = 24
          d[idx + 1] = 22
          d[idx + 2] = 26
          d[idx + 3] = clamp(cov * cov * 128, 0, 255)
        } else d[idx + 3] = 0
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  grainPass(ctx, BW, BH, nBus, 0.03)

  // ---- baked glass helper: a recessed frame + slate glass with a diagonal sheen ----
  function glass(g, { withDriver = false } = {}) {
    const w = g.x1 - g.x0
    const h = g.y1 - g.y0
    const r = 14
    // dark recess ring (frame shadow)
    roundRectPath(ctx, g.x0 - 3, g.y0 - 3, w + 6, h + 6, r + 3)
    ctx.fillStyle = rgba(mix3(BUS, [20, 16, 10], 0.6), 0.9)
    ctx.fill()
    // glass body — vertical gradient, darker at top (cabin shade), lit lower
    roundRectPath(ctx, g.x0, g.y0, w, h, r)
    let lg = ctx.createLinearGradient(g.x0, g.y0, g.x0, g.y1)
    lg.addColorStop(0, rgba(mix3(GLASS, [30, 40, 54], 0.55)))
    lg.addColorStop(0.6, rgba(GLASS))
    lg.addColorStop(1, rgba(mix3(GLASS, [255, 255, 255], 0.16)))
    ctx.save()
    ctx.fillStyle = lg
    ctx.fill()
    ctx.clip()
    if (withDriver) {
      // a friendly driver behind the windshield (round head + soft body + smile)
      ctx.fillStyle = rgba([120, 92, 70]) // seat/shoulders
      ctx.beginPath()
      ctx.ellipse(g.x0 + w * 0.5, g.y1 + 6, w * 0.6, h * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = rgba([236, 205, 170]) // head
      ctx.beginPath()
      ctx.arc(g.x0 + w * 0.5, g.y0 + h * 0.5, Math.min(w, h) * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = rgba([60, 48, 40])
      ctx.beginPath() // two dot eyes
      ctx.arc(g.x0 + w * 0.42, g.y0 + h * 0.46, 2.6, 0, Math.PI * 2)
      ctx.arc(g.x0 + w * 0.58, g.y0 + h * 0.46, 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = rgba([60, 48, 40], 0.8) // smile
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(g.x0 + w * 0.5, g.y0 + h * 0.5, Math.min(w, h) * 0.15, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
    }
    // diagonal sheen streak across the glass
    const sg = ctx.createLinearGradient(g.x0, g.y0, g.x1, g.y1)
    sg.addColorStop(0.18, 'rgba(255,255,255,0)')
    sg.addColorStop(0.34, 'rgba(255,255,255,0.34)')
    sg.addColorStop(0.46, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg
    ctx.fillRect(g.x0, g.y0, w, h)
    ctx.restore()
    // bright top-left inner bevel
    roundRectPath(ctx, g.x0 + 1, g.y0 + 1, w - 2, h - 2, r - 1)
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  glass(SHIELD, { withDriver: true })
  glass(WIN)
  glass(REAR)

  // ---- folding door: two leaves with a slim glass top + a soft AO seam ----
  const dw = DOOR.x1 - DOOR.x0
  const dh = DOOR.y1 - DOOR.y0
  roundRectPath(ctx, DOOR.x0, DOOR.y0, dw, dh, 10)
  let dg = ctx.createLinearGradient(DOOR.x0, 0, DOOR.x1, 0)
  dg.addColorStop(0, rgba(mix3(BUS, [22, 18, 12], 0.42)))
  dg.addColorStop(0.5, rgba(mix3(BUS, [22, 18, 12], 0.26)))
  dg.addColorStop(1, rgba(mix3(BUS, [22, 18, 12], 0.42)))
  ctx.fillStyle = dg
  ctx.fill()
  // door glass (upper)
  roundRectPath(ctx, DOOR.x0 + 5, DOOR.y0 + 6, dw - 10, dh * 0.42, 7)
  ctx.fillStyle = rgba(mix3(GLASS, [30, 40, 54], 0.3))
  ctx.fill()
  // centre + edge seams
  ctx.strokeStyle = 'rgba(20,16,10,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(DOOR.x0 + dw / 2, DOOR.y0 + 4)
  ctx.lineTo(DOOR.x0 + dw / 2, DOOR.y1 - 4)
  ctx.stroke()

  // ---- warm headlight + a small round mirror on the front snout ----
  const hl = ctx.createRadialGradient(30, 196, 0, 30, 196, 12)
  hl.addColorStop(0, 'rgba(255,246,214,0.98)')
  hl.addColorStop(0.55, 'rgba(250,214,140,0.75)')
  hl.addColorStop(1, 'rgba(250,214,140,0)')
  ctx.fillStyle = hl
  ctx.beginPath()
  ctx.arc(30, 196, 12, 0, Math.PI * 2)
  ctx.fill()

  // ---- roof: a thin lit rim + a small destination placard (no text → mirror-safe) ----
  roundRectPath(ctx, bodyCx - 60, 74, 120, 20, 8)
  ctx.fillStyle = rgba(mix3(BUS, [40, 30, 18], 0.4))
  ctx.fill()
  roundRectPath(ctx, bodyCx - 54, 78, 108, 12, 5)
  ctx.fillStyle = rgba(mix3(GLASS, [255, 240, 200], 0.4), 0.85)
  ctx.fill()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('bus.png'), buf)
  console.log('  ✓ bus.png', `${BW}×${BH}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE WHEEL — rubber tyre + brushed-alloy hub with spokes, baked top-left key
// light, tread ring + dark centre. Drops over each carved arch; spins as a whole
// ONLY while the bus drives off (a calm reward, not constant motion).
// ============================================================================
function bakeWheel() {
  const S = 116
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(S, S)
  const d = img.data
  const c = S / 2
  const R = 54
  const nGrit = makeNoise(3391)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      if (r > R) {
        d[idx + 3] = 0
        continue
      }
      const key = clamp(0.5 - (dx + dy) / (R * 2.6), 0, 1)
      let col
      if (r > R * 0.64) {
        const tread = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 30)
        const sh = 0.7 + key * 0.6 + nGrit(x * 0.5, y * 0.5) * 0.08 + tread * 0.05
        col = mix3(RUBBER, [70, 74, 84], clamp(sh, 0, 1))
      } else if (r > R * 0.48) {
        col = mix3([116, 124, 136], ALLOY, clamp(0.3 + key, 0, 1))
      } else {
        const ang = Math.atan2(dy, dx)
        const spoke = Math.abs((((ang % (Math.PI / 2.5)) + Math.PI / 2.5) % (Math.PI / 2.5)) - Math.PI / 5)
        const isSpoke = spoke < 0.34 || r < R * 0.16
        col = mix3(isSpoke ? [178, 186, 198] : [96, 104, 116], [236, 240, 246], clamp(key * 0.9, 0, 1))
        if (r < R * 0.1) col = mix3(col, [70, 76, 88], 0.6)
      }
      if (r > R - 3) col = mix3(col, [10, 10, 14], smooth((r - (R - 3)) / 3) * 0.7)
      let a = 255
      if (r > R - 1.2) a = clamp((R - r) / 1.2, 0, 1) * 255
      d[idx] = clamp(col[0], 0, 255)
      d[idx + 1] = clamp(col[1], 0, 255)
      d[idx + 2] = clamp(col[2], 0, 255)
      d[idx + 3] = a
    }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('wheel.png'), buf)
  console.log('  ✓ wheel.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE STREET — the near ground plane: a warm-grey asphalt road with baked cream
// lane dashes + edge lines, a far curb + hazy far sidewalk (perspective depth up
// toward the town backdrop), a lit near curb and a paved near sidewalk where the
// waiting passengers stand. Transparent above the far sidewalk so the backdrop
// shows through. The bus rests on the road; the child taps on the near sidewalk.
// ============================================================================
function bakeStreet() {
  const W = 920
  const H = 360
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const nAsp = makeNoise(6021)
  const nAgg = makeNoise(2288)
  const nWalk = makeNoise(9110)
  // bands (y): [0..farWalkTop] transparent · far sidewalk · road · near curb · near sidewalk
  const farWalkTop = 30
  const roadTop = 74
  const roadBot = 250
  const nearCurb = 264
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      let col = null
      let a = 255
      if (y < farWalkTop) {
        // fade the top edge into the backdrop
        a = clamp((y / farWalkTop) * 255, 0, 255)
        const gg = nWalk(x * 0.1, y * 0.1) * 0.4
        col = mix3(WALK_D, WALK, clamp(0.4 + gg, 0, 1))
        col = mix3(col, [200, 205, 205], 0.35) // atmospheric haze (far)
      } else if (y < roadTop) {
        // far sidewalk + far curb line
        const gg = nWalk(x * 0.12, y * 0.12) * 0.5
        col = mix3(WALK_D, WALK, clamp(0.45 + gg, 0, 1))
        col = mix3(col, [198, 202, 202], 0.22)
        if (y > roadTop - 4) col = mix3(col, [70, 70, 74], 0.4) // curb shadow into road
      } else if (y < roadBot) {
        // asphalt — grain + aggregate flecks, hazier/lighter toward the far top
        const g = nAsp(x * 0.08, y * 0.08) * 0.5 + nAsp(x * 0.3, y * 0.3) * 0.3
        const agg = Math.max(0, nAgg(x * 0.7, y * 0.7)) * 0.5
        col = mix3(ASPH_D, ASPH, clamp(0.5 + g, 0, 1))
        col = mix3(col, [128, 132, 140], agg * 0.22)
        const depth = clamp((y - roadTop) / (roadBot - roadTop), 0, 1) // 0 far → 1 near
        col = mix3(mix3(col, [186, 190, 194], 0.16), col, depth) // far haze
        // baked cream centre dashes (perspective: longer/wider toward the near side)
        const cy = (roadTop + roadBot) / 2
        if (Math.abs(y - cy) < 5 + depth * 3) {
          const period = 90 - depth * 20
          const ph = ((x % period) + period) % period
          if (ph < period * 0.55) col = mix3(col, DASH, smooth(clamp(1 - Math.abs(y - cy) / (5 + depth * 3), 0, 1)) * 0.85)
        }
        // baked cream edge lines top + bottom of the road
        const eT = Math.abs(y - (roadTop + 3))
        const eB = Math.abs(y - (roadBot - 3))
        const e = Math.min(eT, eB)
        if (e < 3) col = mix3(col, DASH, smooth(clamp(1 - e / 3, 0, 1)) * 0.7)
      } else if (y < nearCurb) {
        // near curb — a lit top lip then a dark face
        const f = (y - roadBot) / (nearCurb - roadBot)
        col = mix3(mix3(CURB, [255, 255, 255], 0.2), mix3(CURB, [40, 40, 44], 0.5), smooth(f))
      } else {
        // near sidewalk — warm paving with grain + subtle joint lines
        const gg = nWalk(x * 0.1, y * 0.1) * 0.5 + nWalk(x * 0.34, y * 0.34) * 0.3
        col = mix3(WALK_D, WALK, clamp(0.5 + gg, 0, 1))
        const jointX = ((x + 40) % 150) < 3
        const jointY = ((y - nearCurb) % 70) < 3
        if (jointX || jointY) col = mix3(col, WALK_D, 0.5)
        // a soft top AO just under the curb
        col = mix3(col, WALK_D, smooth(clamp(1 - (y - nearCurb) / 18, 0, 1)) * 0.28)
      }
      d[idx] = clamp(col[0], 0, 255)
      d[idx + 1] = clamp(col[1], 0, 255)
      d[idx + 2] = clamp(col[2], 0, 255)
      d[idx + 3] = a
    }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('street.png'), buf)
  console.log('  ✓ street.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE BUS-STOP — an enamel teal sign (baked 🚌 glyph as a soft silhouette, no
// text → mirror-safe) on a metal pole, plus a little wooden bench. Sits on the
// near sidewalk beside the waiting passengers. Baked light / AO / contact shadow.
// ============================================================================
function bakeStop() {
  const W = 260
  const H = 400
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const nWood = makeNoise(7420)

  // contact shadow under the whole stop
  const sh = ctx.createRadialGradient(W * 0.5, H - 26, 0, W * 0.5, H - 26, 130)
  sh.addColorStop(0, 'rgba(20,20,24,0.3)')
  sh.addColorStop(1, 'rgba(20,20,24,0)')
  ctx.save()
  ctx.translate(0, 0)
  ctx.scale(1, 0.28)
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.ellipse(W * 0.5, (H - 26) / 0.28, 118, 130, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ---- pole ----
  const px = W * 0.5
  let pg = ctx.createLinearGradient(px - 9, 0, px + 9, 0)
  pg.addColorStop(0, rgba(mix3(POLE, [40, 44, 50], 0.4)))
  pg.addColorStop(0.4, rgba(mix3(POLE, [255, 255, 255], 0.3)))
  pg.addColorStop(1, rgba(mix3(POLE, [40, 44, 50], 0.5)))
  ctx.fillStyle = pg
  roundRectPath(ctx, px - 9, 40, 18, H - 66, 6)
  ctx.fill()

  // ---- enamel sign (rounded rect, teal) ----
  const s = { x: W * 0.5 - 96, y: 26, w: 192, h: 132, r: 24 }
  roundRectPath(ctx, s.x, s.y, s.w, s.h, s.r)
  let sg = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h)
  sg.addColorStop(0, rgba(mix3(SIGN, [255, 255, 255], 0.28)))
  sg.addColorStop(0.5, rgba(SIGN))
  sg.addColorStop(1, rgba(mix3(SIGN, [20, 40, 42], 0.32)))
  ctx.fillStyle = sg
  ctx.fill()
  // white inner ring
  roundRectPath(ctx, s.x + 12, s.y + 12, s.w - 24, s.h - 24, s.r - 10)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 5
  ctx.stroke()
  // a soft cream bus silhouette on the sign (no text → mirror-safe)
  ctx.fillStyle = 'rgba(248,246,238,0.94)'
  const bx = W * 0.5 - 52
  const by = s.y + 44
  roundRectPath(ctx, bx, by, 104, 52, 16)
  ctx.fill()
  ctx.fillStyle = rgba(mix3(SIGN, [20, 40, 42], 0.2), 0.9)
  roundRectPath(ctx, bx + 10, by + 10, 84, 20, 6) // windows strip
  ctx.fill()
  ctx.beginPath() // two wheels
  ctx.arc(bx + 28, by + 52, 9, 0, Math.PI * 2)
  ctx.arc(bx + 76, by + 52, 9, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(40,44,50,0.9)'
  ctx.fill()
  // sign top-left sheen
  roundRectPath(ctx, s.x, s.y, s.w, s.h, s.r)
  ctx.save()
  ctx.clip()
  const sn = ctx.createLinearGradient(s.x, s.y, s.x + s.w * 0.6, s.y + s.h * 0.6)
  sn.addColorStop(0, 'rgba(255,255,255,0.28)')
  sn.addColorStop(0.4, 'rgba(255,255,255,0)')
  ctx.fillStyle = sn
  ctx.fillRect(s.x, s.y, s.w, s.h)
  ctx.restore()

  // ---- wooden bench (seat + backrest + two legs) at the base ----
  const bench = { x: W * 0.5 - 108, y: H - 96, w: 216 }
  function plank(x, y, w, h, r) {
    roundRectPath(ctx, x, y, w, h, r)
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, rgba(mix3(WOOD, [255, 245, 220], 0.3)))
    g.addColorStop(1, rgba(WOOD_D))
    ctx.fillStyle = g
    ctx.fill()
  }
  plank(bench.x, bench.y - 34, bench.w, 16, 6) // backrest
  plank(bench.x + 12, bench.y, bench.w - 24, 20, 8) // seat
  plank(bench.x + 20, bench.y + 20, 14, 44, 4) // left leg
  plank(bench.x + bench.w - 34, bench.y + 20, 14, 44, 4) // right leg
  grainPass(ctx, W, H, nWood, 0.05)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('stop.png'), buf)
  console.log('  ✓ stop.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking letter-bus art →')
bakeStreet()
bakeBus()
bakeWheel()
bakeStop()
// window band as fractions of the bus sprite, for app.css --lb-win-* vars:
console.log(
  '  window band (fractions of bus): ',
  `x0=${(WIN.x0 / BW).toFixed(3)} x1=${(WIN.x1 / BW).toFixed(3)} y0=${(WIN.y0 / BH).toFixed(3)} y1=${(WIN.y1 / BH).toFixed(3)}`,
)
console.log(
  '  wheel centres (fractions):     ',
  `F x=${(ARCH_F.cx / BW).toFixed(3)} y=${(ARCH_F.cy / BH).toFixed(3)} · R x=${(ARCH_R.cx / BW).toFixed(3)} y=${(ARCH_R.cy / BH).toFixed(3)} · r=${(ARCH_F.r / BW).toFixed(3)}`,
)
console.log('Done.')
