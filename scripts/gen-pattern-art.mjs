// Bakes the "תבניות" (patterns / what-comes-next) materials — REAL beads on a
// REAL wooden bead-board, not flat CSS circles.
//
//   bead-<hue>.png — a glossy threading BEAD: a shaded orb with a top-left key
//     light, a crisp specular gloss, a soft threading-hole dimple, baked bottom
//     AO and its own soft contact shadow so it rests on a surface. Six muted,
//     sensory-calm hues (coral / amber / honey / sage / sky / lilac).
//   plank.png  — the long wooden RAIL the pattern beads rest on (lit top face,
//     grain, a front bevel thickness + drop shadow). Stretched as the track bg.
//   socket.png — an EMPTY recessed cup carved into the rail (dark concave pit,
//     top inner AO, a lit near lip and a soft dashed "waiting" ring): the gap
//     where the missing bead belongs — reads instantly as "a bead goes here".
//   tray.png   — a shallow wooden TRAY with a raised front lip the answer beads
//     sit in ("pick one from here").
//
// Same pipeline as the dice / coin-sort materials: an original @napi-rs/canvas
// bake with seeded value-noise grain and analytic baked lighting/AO. No
// third-party art. One-off build tool:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-pattern-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/pattern/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator ----------------
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
  const lerpN = (a, b, t) => a + t * (b - a)
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
    const x1 = lerpN(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerpN(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerpN(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const grain = makeNoise(20260718)

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
// light material grain over every painted pixel (kills the "flat CSS" read)
function grainPass(ctx, W, H, amt = 0.05) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * 0.5, y * 0.5) * 0.6 + grain(x * 1.7, y * 1.7) * 0.4
      const m = 1 + n * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

// ============================================================================
// THE BEAD — a glossy shaded orb with its own contact shadow.
// ============================================================================
const BS = 168 // bead canvas
function bakeBead(base, name) {
  const cv = createCanvas(BS, BS)
  const ctx = cv.getContext('2d')
  const cx = BS * 0.5
  const cy = BS * 0.46 // a touch high — room for the contact shadow below
  const r = BS * 0.36

  // --- baked contact shadow on the surface, under the bead ---
  ctx.save()
  ctx.translate(cx, cy + r * 0.98)
  ctx.scale(1, 0.34)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.92)
  sh.addColorStop(0, 'rgba(24,18,10,0.34)')
  sh.addColorStop(0.62, 'rgba(24,18,10,0.18)')
  sh.addColorStop(1, 'rgba(24,18,10,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- the orb body: sphere shading, key light from the top-left ---
  const hlx = cx - r * 0.34
  const hly = cy - r * 0.4
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  let g = ctx.createRadialGradient(hlx, hly, r * 0.06, cx, cy, r * 1.18)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.5))) // lit
  g.addColorStop(0.42, rgb(base))
  g.addColorStop(0.82, rgb(mix(base, [30, 26, 34], 0.28)))
  g.addColorStop(1, rgb(mix(base, [22, 20, 28], 0.46))) // AO terminator
  ctx.fillStyle = g
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // bounce / rim light on the lower-right (a subtle lift so the orb feels round)
  const rim = ctx.createRadialGradient(cx + r * 0.5, cy + r * 0.62, r * 0.02, cx + r * 0.5, cy + r * 0.62, r * 0.7)
  rim.addColorStop(0, rgb(mix(base, [255, 250, 240], 0.32), 0.5))
  rim.addColorStop(1, rgb(base, 0))
  ctx.fillStyle = rim
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

  // soft threading-hole dimple near the centre (reads as a real bead hole),
  // lit on its lower lip like a small recess
  const hr = r * 0.17
  const hg = ctx.createRadialGradient(cx - hr * 0.3, cy - hr * 0.3, hr * 0.1, cx + hr * 0.2, cy + hr * 0.25, hr * 1.15)
  hg.addColorStop(0, rgb(mix(base, [18, 16, 22], 0.5), 0.6))
  hg.addColorStop(0.7, rgb(mix(base, [30, 26, 34], 0.28), 0.28))
  hg.addColorStop(1, rgb(base, 0))
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.arc(cx, cy, hr * 1.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- crisp specular gloss (the wet highlight) ---
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const sp = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, r * 0.5)
  sp.addColorStop(0, 'rgba(255,255,255,0.9)')
  sp.addColorStop(0.5, 'rgba(255,255,255,0.28)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sp
  ctx.beginPath()
  ctx.ellipse(hlx, hly, r * 0.4, r * 0.3, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  grainPass(ctx, BS, BS, 0.04)

  // --- definition rim: bright top-left edge, soft dark bottom-right edge ---
  ctx.beginPath()
  ctx.arc(cx, cy, r - 0.5, -Math.PI * 0.85, Math.PI * 0.15)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = BS * 0.012
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r - 0.5, Math.PI * 0.15, Math.PI * 1.15)
  ctx.strokeStyle = 'rgba(20,16,24,0.22)'
  ctx.lineWidth = BS * 0.012
  ctx.stroke()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${BS}×${BS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE PLANK — the long wooden rail the sequence rests on. Stretched by CSS.
// ============================================================================
const WOOD = [176, 138, 84]
function grainStreaks(ctx, x, y, w, h, n, light, dark) {
  for (let i = 0; i < n; i++) {
    const gy = y + Math.random() * h
    ctx.strokeStyle = Math.random() < 0.5 ? light : dark
    ctx.globalAlpha = 0.05 + Math.random() * 0.1
    ctx.lineWidth = 0.6 + Math.random() * 1.4
    ctx.beginPath()
    ctx.moveTo(x, gy)
    for (let sx = x; sx <= x + w; sx += 26) ctx.lineTo(sx, gy + (Math.random() - 0.5) * 2.4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
function bakePlank() {
  const W = 512
  const H = 148
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const topY = 14
  const faceH = 96
  const bevelH = 22

  // drop shadow beneath the whole plank
  const ds = ctx.createLinearGradient(0, topY + faceH + bevelH, 0, H)
  ds.addColorStop(0, 'rgba(20,14,6,0.3)')
  ds.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ds
  ctx.fillRect(0, topY + faceH + bevelH, W, H - (topY + faceH + bevelH))

  // top face
  ctx.save()
  roundRectPath(ctx, 0, topY, W, faceH, 20)
  ctx.clip()
  let g = ctx.createLinearGradient(0, topY, 0, topY + faceH)
  g.addColorStop(0, rgb(mix(WOOD, [255, 240, 210], 0.28)))
  g.addColorStop(0.5, rgb(WOOD))
  g.addColorStop(1, rgb(mix(WOOD, [40, 26, 10], 0.24)))
  ctx.fillStyle = g
  ctx.fillRect(0, topY, W, faceH)
  grainStreaks(ctx, 0, topY, W, faceH, 60, rgb(mix(WOOD, [255, 240, 210], 0.4)), rgb(mix(WOOD, [30, 18, 6], 0.5)))
  // far-edge AO (top) + near light pool
  const ao = ctx.createLinearGradient(0, topY, 0, topY + 34)
  ao.addColorStop(0, 'rgba(30,20,8,0.32)')
  ao.addColorStop(1, 'rgba(30,20,8,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, topY, W, 34)
  const lp = ctx.createRadialGradient(W / 2, topY + faceH - 12, 20, W / 2, topY + faceH - 8, W * 0.5)
  lp.addColorStop(0, 'rgba(255,240,210,0.2)')
  lp.addColorStop(1, 'rgba(255,240,210,0)')
  ctx.fillStyle = lp
  ctx.fillRect(0, topY, W, faceH)
  ctx.restore()

  // front bevel (thickness)
  ctx.save()
  roundRectPath(ctx, 0, topY + faceH - 18, W, bevelH + 18, 20)
  ctx.clip()
  const fbg = ctx.createLinearGradient(0, topY + faceH, 0, topY + faceH + bevelH)
  fbg.addColorStop(0, rgb(mix(WOOD, [30, 18, 6], 0.3)))
  fbg.addColorStop(1, rgb(mix(WOOD, [20, 12, 4], 0.5)))
  ctx.fillStyle = fbg
  ctx.fillRect(0, topY + faceH, W, bevelH)
  grainStreaks(ctx, 0, topY + faceH, W, bevelH, 26, rgb(mix(WOOD, [220, 180, 120], 0.4)), rgb(mix(WOOD, [16, 10, 4], 0.6)))
  ctx.restore()
  // lit near lip where top face meets bevel
  ctx.strokeStyle = 'rgba(255,244,214,0.55)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(16, topY + faceH + 1)
  ctx.lineTo(W - 16, topY + faceH + 1)
  ctx.stroke()

  grainPass(ctx, W, H, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('plank.png'), buf)
  console.log('  ✓', 'plank.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE TRAY — a shallow wooden tray with a raised front lip for the choices.
// ============================================================================
function bakeTray() {
  const W = 512
  const H = 156
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const topY = 12
  const floorH = 104
  const lipH = 30

  // contact shadow under the tray
  const sh = ctx.createLinearGradient(0, topY + floorH + lipH, 0, H)
  sh.addColorStop(0, 'rgba(20,14,6,0.28)')
  sh.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = sh
  ctx.fillRect(0, topY + floorH + lipH, W, H - (topY + floorH + lipH))

  // inner floor
  ctx.save()
  roundRectPath(ctx, 0, topY, W, floorH, 18)
  ctx.clip()
  let g = ctx.createLinearGradient(0, topY, 0, topY + floorH)
  g.addColorStop(0, rgb(mix(WOOD, [20, 12, 4], 0.2)))
  g.addColorStop(0.5, rgb(mix(WOOD, [255, 238, 206], 0.06)))
  g.addColorStop(1, rgb(mix(WOOD, [30, 18, 8], 0.14)))
  ctx.fillStyle = g
  ctx.fillRect(0, topY, W, floorH)
  grainStreaks(ctx, 0, topY, W, floorH, 48, rgb(mix(WOOD, [230, 190, 130], 0.35)), rgb(mix(WOOD, [26, 16, 6], 0.5)))
  // back inner-wall AO (it's a tray — floor sits below a lip)
  const back = ctx.createLinearGradient(0, topY, 0, topY + 40)
  back.addColorStop(0, 'rgba(28,18,8,0.4)')
  back.addColorStop(1, 'rgba(28,18,8,0)')
  ctx.fillStyle = back
  ctx.fillRect(0, topY, W, 40)
  // AO where the front lip rises from the floor
  const fAO = ctx.createLinearGradient(0, topY + floorH - 22, 0, topY + floorH)
  fAO.addColorStop(0, 'rgba(26,16,6,0)')
  fAO.addColorStop(1, 'rgba(26,16,6,0.4)')
  ctx.fillStyle = fAO
  ctx.fillRect(0, topY + floorH - 22, W, 22)
  ctx.restore()

  // raised front lip
  ctx.save()
  roundRectPath(ctx, 0, topY + floorH - 6, W, lipH + 6, 16)
  ctx.clip()
  const rg = ctx.createLinearGradient(0, topY + floorH, 0, topY + floorH + lipH)
  rg.addColorStop(0, rgb(mix(WOOD, [255, 238, 206], 0.24)))
  rg.addColorStop(0.5, rgb(WOOD))
  rg.addColorStop(1, rgb(mix(WOOD, [24, 14, 6], 0.42)))
  ctx.fillStyle = rg
  ctx.fillRect(0, topY + floorH, W, lipH)
  grainStreaks(ctx, 0, topY + floorH, W, lipH, 34, rgb(mix(WOOD, [230, 190, 130], 0.4)), rgb(mix(WOOD, [22, 14, 6], 0.55)))
  ctx.restore()
  // lit top lip of the rail
  ctx.strokeStyle = 'rgba(255,246,220,0.6)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(14, topY + floorH + 1)
  ctx.lineTo(W - 14, topY + floorH + 1)
  ctx.stroke()

  grainPass(ctx, W, H, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('tray.png'), buf)
  console.log('  ✓', 'tray.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SOCKET — an empty recessed cup carved into the rail (the "?" gap).
// Transparent outside the circle so the plank shows around it.
// ============================================================================
function bakeSocket() {
  const cv = createCanvas(BS, BS)
  const ctx = cv.getContext('2d')
  const cx = BS * 0.5
  const cy = BS * 0.46
  const r = BS * 0.36

  // outer AO ring where the pit meets the surface (feathered)
  let ao = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.16)
  ao.addColorStop(0, 'rgba(20,14,6,0)')
  ao.addColorStop(0.7, 'rgba(20,14,6,0.28)')
  ao.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ao
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.16, 0, Math.PI * 2)
  ctx.fill()

  // the concave pit
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const pit = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.1, cx, cy + r * 0.2, r * 1.1)
  pit.addColorStop(0, rgb(mix(WOOD, [18, 12, 4], 0.62)))
  pit.addColorStop(0.6, rgb(mix(WOOD, [26, 16, 6], 0.44)))
  pit.addColorStop(1, rgb(mix(WOOD, [40, 26, 10], 0.26)))
  ctx.fillStyle = pit
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // deeper AO at the top rim (a real hole, lit from above)
  const top = ctx.createLinearGradient(0, cy - r, 0, cy)
  top.addColorStop(0, 'rgba(14,9,3,0.5)')
  top.addColorStop(1, 'rgba(14,9,3,0)')
  ctx.fillStyle = top
  ctx.fillRect(cx - r, cy - r, r * 2, r)
  ctx.restore()

  // near lip highlight (bottom rim of the pit catches light)
  ctx.strokeStyle = 'rgba(255,244,214,0.5)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0.16, Math.PI - 0.16)
  ctx.stroke()
  // top rim thin shade
  ctx.strokeStyle = 'rgba(20,12,4,0.32)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, Math.PI + 0.16, -0.16)
  ctx.stroke()

  // soft dashed "waiting" ring inside the pit
  ctx.strokeStyle = 'rgba(255,240,206,0.7)'
  ctx.lineWidth = 2.6
  ctx.setLineDash([9, 9])
  ctx.beginPath()
  ctx.arc(cx, cy + 1, r * 0.6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  grainPass(ctx, BS, BS, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('socket.png'), buf)
  console.log('  ✓', 'socket.png', `${BS}×${BS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- muted, sensory-calm bead hues (desaturated pastels) --------------------
const HUES = {
  coral: [224, 140, 130],
  amber: [230, 168, 108],
  honey: [230, 198, 118],
  sage: [150, 198, 150],
  sky: [150, 184, 222],
  lilac: [190, 172, 218],
}
console.log('Baking pattern art →')
for (const [name, c] of Object.entries(HUES)) bakeBead(c, `bead-${name}.png`)
bakePlank()
bakeTray()
bakeSocket()
console.log('Done.')
