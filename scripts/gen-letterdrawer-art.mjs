// Bakes the "אות במגירה" (letter drawer) materials — a REAL wooden chest of
// drawers in 3/4 view + baked drawer faces, turned knobs, an open-drawer
// interior with baked interior shadow, and a calm muted room backdrop. NOT flat
// CSS shapes/gradients. The Hebrew letters themselves stay crisp CSS text laid
// on top of these surfaces.
//
//   cabinet.png     — the dresser CARCASS in 3/4 view: a lit receding top slab
//                     with a front bevel, a body with left/right frame stiles,
//                     a base plinth + tapered feet, a hint of the right side
//                     panel (depth), a DARK recessed drawer WELL, and a baked
//                     grounded contact shadow. The drawer column overlays the
//                     well (well = 13.5% .. 86.5% x, 18% .. 86% y — kept in sync
//                     with .ld-column in app.css).
//   drawer-face.png — one closed wooden drawer front: horizontal grain, a lit
//                     top bevel, bottom AO, rounded corners and a soft inset
//                     label panel where the letter sits. Stretched per drawer.
//   knob.png        — a turned wooden knob (domed, top-left key light, AO,
//                     cast shadow). Overlaid crisp via CSS, two per drawer.
//   drawer-open.png — an OPEN drawer interior seen from 3/4 above: wooden floor,
//                     four shaded inner walls and a baked interior AO shadow —
//                     the cavity the object drops into when a drawer opens.
//   bg/letterdrawer-room.jpg — a calm, low-contrast nursery/playroom (muted
//                     wall, soft rug, warm receding floor) so the dresser pops.
//
// Same pipeline as the sortshelf / dice / pattern materials: an original
// @napi-rs/canvas bake with seeded value-noise grain + analytic baked
// lighting/AO. No third-party art (CC0). One-off build tool:
//   node scripts/gen-letterdrawer-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const SPR = new URL('../public/art/sprites/letterdrawer/', import.meta.url)
const BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(SPR, { recursive: true })
const file = (name) => new URL(name, SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const bgFile = (name) => new URL(name, BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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
// long directional wood-grain streaks (horizontal by default)
function grainStreaks(ctx, x, y, w, h, n, light, dark, step = 26) {
  for (let i = 0; i < n; i++) {
    const gy = y + Math.random() * h
    ctx.strokeStyle = Math.random() < 0.5 ? light : dark
    ctx.globalAlpha = 0.05 + Math.random() * 0.1
    ctx.lineWidth = 0.6 + Math.random() * 1.4
    ctx.beginPath()
    ctx.moveTo(x, gy)
    for (let sx = x; sx <= x + w; sx += step) ctx.lineTo(sx, gy + (Math.random() - 0.5) * 2.4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
// a soft baked contact shadow ellipse under an object
function contactShadow(ctx, cx, cy, rx, ry, a = 0.32) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, `rgba(22,16,8,${a})`)
  g.addColorStop(0.62, `rgba(22,16,8,${a * 0.5})`)
  g.addColorStop(1, 'rgba(22,16,8,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
// a shaded dome (key light top-left, AO bottom-right, spec gloss) — for knobs
function dome(ctx, cx, cy, r, base, { spec = 0.6 } = {}) {
  const hlx = cx - r * 0.34
  const hly = cy - r * 0.4
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(hlx, hly, r * 0.06, cx, cy, r * 1.15)
  g.addColorStop(0, rgb(mix(base, [255, 250, 235], 0.55)))
  g.addColorStop(0.45, rgb(base))
  g.addColorStop(0.85, rgb(mix(base, [34, 22, 12], 0.4)))
  g.addColorStop(1, rgb(mix(base, [24, 15, 8], 0.6)))
  ctx.fillStyle = g
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  const sp = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, r * 0.5)
  sp.addColorStop(0, `rgba(255,252,244,${spec})`)
  sp.addColorStop(0.5, `rgba(255,252,244,${spec * 0.3})`)
  sp.addColorStop(1, 'rgba(255,252,244,0)')
  ctx.fillStyle = sp
  ctx.beginPath()
  ctx.ellipse(hlx, hly, r * 0.4, r * 0.3, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ---- muted, sensory-calm wood palette --------------------------------------
const WOOD = [178, 140, 96] // warm honey oak (muted)
const WOOD_DK = mix(WOOD, [40, 26, 12], 0.55)
const WOOD_LT = mix(WOOD, [255, 244, 216], 0.34)
const INNER = [58, 40, 24] // recessed cavity / drawer well

// fill a rounded-rect wood panel with grain + a top-light/bottom-AO bevel
function woodPanel(ctx, x, y, w, h, r, base, { topLight = 0.16, botShade = 0.26, streaks = 24 } = {}) {
  ctx.save()
  roundRectPath(ctx, x, y, w, h, r)
  ctx.clip()
  // base left->right shading
  let g = ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, rgb(mix(base, [255, 244, 216], 0.14)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, [30, 20, 10], 0.2)))
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  // horizontal grain
  grainStreaks(ctx, x, y, w, h, streaks, rgb(mix(base, [255, 240, 210], 0.5)), rgb(mix(base, [28, 18, 8], 0.5)))
  // top key light
  g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, `rgba(255,246,222,${topLight})`)
  g.addColorStop(0.32, 'rgba(255,246,222,0)')
  g.addColorStop(0.7, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(24,15,6,${botShade})`)
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

// ============================================================================
// THE CABINET — a wooden chest of drawers in 3/4 view (carcass only; drawers
// overlay the dark well from CSS).
// ============================================================================
function bakeCabinet() {
  const W = 680
  const H = 860
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  const bodyL = 40
  const bodyR = 640
  const bodyW = bodyR - bodyL
  const bodyTop = 118
  const bodyBot = 792

  // grounded contact shadow beneath the whole piece
  contactShadow(ctx, W / 2 + 6, 842, 330, 40, 0.38)

  // ---- a sliver of the RIGHT side panel (3/4 depth) ----
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(bodyR, bodyTop + 6)
  ctx.lineTo(bodyR + 30, bodyTop + 24)
  ctx.lineTo(bodyR + 30, bodyBot - 18)
  ctx.lineTo(bodyR, bodyBot)
  ctx.closePath()
  ctx.clip()
  const sg = ctx.createLinearGradient(bodyR, 0, bodyR + 30, 0)
  sg.addColorStop(0, rgb(mix(WOOD, [30, 20, 10], 0.34)))
  sg.addColorStop(1, rgb(mix(WOOD, [18, 12, 6], 0.56)))
  ctx.fillStyle = sg
  ctx.fillRect(bodyR, bodyTop, 34, bodyBot)
  grainStreaks(ctx, bodyR, bodyTop, 34, bodyBot - bodyTop, 18, rgb(mix(WOOD, [210, 170, 120], 0.4)), rgb(mix(WOOD, [16, 10, 4], 0.6)), 8)
  ctx.restore()

  // ---- body carcass (front frame) ----
  woodPanel(ctx, bodyL, bodyTop, bodyW, bodyBot - bodyTop, 20, WOOD, { topLight: 0.12, botShade: 0.22, streaks: 40 })

  // ---- the DARK recessed drawer WELL (well = x 92..588, y 156..740) ----
  const wellL = 92
  const wellR = 588
  const wellT = 156
  const wellB = 740
  ctx.save()
  roundRectPath(ctx, wellL, wellT, wellR - wellL, wellB - wellT, 12)
  ctx.clip()
  let wg = ctx.createLinearGradient(0, wellT, 0, wellB)
  wg.addColorStop(0, rgb(mix(INNER, [0, 0, 0], 0.25)))
  wg.addColorStop(0.5, rgb(INNER))
  wg.addColorStop(1, rgb(mix(INNER, [0, 0, 0], 0.15)))
  ctx.fillStyle = wg
  ctx.fillRect(wellL, wellT, wellR - wellL, wellB - wellT)
  // inner AO at the frame edges
  wg = ctx.createLinearGradient(wellL, 0, wellL + 26, 0)
  wg.addColorStop(0, 'rgba(0,0,0,0.5)')
  wg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = wg
  ctx.fillRect(wellL, wellT, 26, wellB - wellT)
  wg = ctx.createLinearGradient(wellR - 26, 0, wellR, 0)
  wg.addColorStop(0, 'rgba(0,0,0,0)')
  wg.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = wg
  ctx.fillRect(wellR - 26, wellT, 26, wellB - wellT)
  wg = ctx.createLinearGradient(0, wellT, 0, wellT + 26)
  wg.addColorStop(0, 'rgba(0,0,0,0.55)')
  wg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = wg
  ctx.fillRect(wellL, wellT, wellR - wellL, 26)
  ctx.restore()
  // a crisp inner lip line around the well (frame edge catching light)
  ctx.strokeStyle = rgb(WOOD_LT, 0.5)
  ctx.lineWidth = 1.5
  roundRectPath(ctx, wellL - 1, wellT - 1, wellR - wellL + 2, wellB - wellT + 2, 12)
  ctx.stroke()

  // ---- top slab (receding, lit) sitting above the body ----
  const slabBackL = 74
  const slabBackR = 606
  const slabFrontL = 26
  const slabFrontR = 654
  const slabBackY = 30
  const slabFrontY = 100
  const bevelY = 122
  // top face (trapezoid: narrower far edge → receding)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(slabBackL, slabBackY)
  ctx.lineTo(slabBackR, slabBackY)
  ctx.lineTo(slabFrontR, slabFrontY)
  ctx.lineTo(slabFrontL, slabFrontY)
  ctx.closePath()
  ctx.clip()
  let tg = ctx.createLinearGradient(0, slabBackY, 0, slabFrontY)
  tg.addColorStop(0, rgb(mix(WOOD, [40, 26, 12], 0.28))) // far edge darker (AO)
  tg.addColorStop(0.4, rgb(WOOD_LT))
  tg.addColorStop(1, rgb(mix(WOOD, [255, 246, 220], 0.22)))
  ctx.fillStyle = tg
  ctx.fillRect(0, slabBackY, W, slabFrontY - slabBackY)
  grainStreaks(ctx, slabFrontL, slabBackY, slabFrontR - slabFrontL, slabFrontY - slabBackY, 40, rgb(mix(WOOD, [255, 244, 214], 0.5)), rgb(mix(WOOD, [30, 20, 10], 0.5)))
  ctx.restore()
  // front bevel (thickness of the top)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(slabFrontL, slabFrontY)
  ctx.lineTo(slabFrontR, slabFrontY)
  ctx.lineTo(slabFrontR - 6, bevelY)
  ctx.lineTo(slabFrontL + 6, bevelY)
  ctx.closePath()
  ctx.clip()
  const bg = ctx.createLinearGradient(0, slabFrontY, 0, bevelY)
  bg.addColorStop(0, rgb(mix(WOOD, [30, 20, 10], 0.32)))
  bg.addColorStop(1, rgb(mix(WOOD, [18, 12, 6], 0.5)))
  ctx.fillStyle = bg
  ctx.fillRect(0, slabFrontY, W, bevelY - slabFrontY)
  ctx.restore()
  // lit front lip of the top
  ctx.strokeStyle = rgb(mix(WOOD, [255, 248, 224], 0.6), 0.75)
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(slabFrontL + 6, slabFrontY + 1)
  ctx.lineTo(slabFrontR - 6, slabFrontY + 1)
  ctx.stroke()

  // ---- base plinth + tapered feet ----
  // plinth already part of body; darken a base rail
  ctx.save()
  roundRectPath(ctx, bodyL, bodyBot - 40, bodyW, 40, 8)
  ctx.clip()
  const pg = ctx.createLinearGradient(0, bodyBot - 40, 0, bodyBot)
  pg.addColorStop(0, rgb(mix(WOOD, [30, 20, 10], 0.18)))
  pg.addColorStop(1, rgb(mix(WOOD, [20, 13, 6], 0.44)))
  ctx.fillStyle = pg
  ctx.fillRect(bodyL, bodyBot - 40, bodyW, 40)
  ctx.restore()
  // two front feet (tapered blocks)
  for (const fx of [bodyL + 44, bodyR - 44 - 60]) {
    ctx.beginPath()
    ctx.moveTo(fx, bodyBot - 2)
    ctx.lineTo(fx + 60, bodyBot - 2)
    ctx.lineTo(fx + 50, bodyBot + 46)
    ctx.lineTo(fx + 10, bodyBot + 46)
    ctx.closePath()
    const fg = ctx.createLinearGradient(fx, bodyBot, fx + 60, bodyBot)
    fg.addColorStop(0, rgb(mix(WOOD, [255, 240, 210], 0.1)))
    fg.addColorStop(0.5, rgb(mix(WOOD, [30, 20, 10], 0.22)))
    fg.addColorStop(1, rgb(mix(WOOD, [18, 12, 6], 0.44)))
    ctx.fillStyle = fg
    ctx.fill()
  }

  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('cabinet.png'), buf)
  console.log('  ✓ cabinet.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE DRAWER FACE — one closed wooden drawer front (stretched per drawer).
// ============================================================================
function bakeDrawerFace() {
  const W = 480
  const H = 156
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // the drawer front, inset a touch so the dark well shows as a seam
  woodPanel(ctx, 3, 4, W - 6, H - 10, 14, WOOD, { topLight: 0.2, botShade: 0.3, streaks: 30 })
  // top bevel highlight + bottom shade rims (real thickness)
  ctx.strokeStyle = rgb(mix(WOOD, [255, 248, 224], 0.7), 0.7)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(16, 8)
  ctx.lineTo(W - 16, 8)
  ctx.stroke()
  ctx.strokeStyle = rgb([24, 15, 6], 0.4)
  ctx.beginPath()
  ctx.moveTo(14, H - 8)
  ctx.lineTo(W - 14, H - 8)
  ctx.stroke()
  // soft inset label panel (a lighter recessed field where the letter mounts)
  const lx = W * 0.5 - 74
  const ly = H * 0.5 - 46
  const lw = 148
  const lh = 92
  ctx.save()
  roundRectPath(ctx, lx, ly, lw, lh, 16)
  ctx.clip()
  const lg = ctx.createLinearGradient(0, ly, 0, ly + lh)
  lg.addColorStop(0, rgb(mix(WOOD, [40, 26, 12], 0.28))) // inner top shadow
  lg.addColorStop(0.28, rgb(mix(WOOD, [255, 244, 216], 0.2)))
  lg.addColorStop(1, rgb(mix(WOOD, [255, 246, 220], 0.1)))
  ctx.fillStyle = lg
  ctx.fillRect(lx, ly, lw, lh)
  ctx.restore()
  // inset panel rim: dark on top-left (recess), light on bottom-right
  ctx.strokeStyle = 'rgba(26,16,8,0.34)'
  ctx.lineWidth = 2
  roundRectPath(ctx, lx, ly, lw, lh, 16)
  ctx.stroke()
  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('drawer-face.png'), buf)
  console.log('  ✓ drawer-face.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE KNOB — a turned wooden knob (two per drawer, overlaid crisp via CSS).
// ============================================================================
function bakeKnob() {
  const S = 96
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S * 0.48
  const cy = S * 0.46
  const r = S * 0.32
  // cast shadow on the drawer (lower-right)
  contactShadow(ctx, cx + 5, cy + r * 0.9, r * 1.05, r * 0.4, 0.34)
  // base ring / mounting plate
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2)
  ctx.fillStyle = rgb(mix(WOOD, [30, 20, 10], 0.4))
  ctx.fill()
  // the domed knob
  dome(ctx, cx, cy, r, mix(WOOD, [120, 84, 48], 0.35), { spec: 0.55 })
  grainPass(ctx, S, S, 0.025)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('knob.png'), buf)
  console.log('  ✓ knob.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE OPEN DRAWER — the interior cavity revealed when a drawer slides out.
// ============================================================================
function bakeDrawerOpen() {
  const W = 480
  const H = 230
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // the open box: front lip near, floor receding to a back wall (3/4 above)
  const nearL = 10
  const nearR = W - 10
  const farL = 58
  const farR = W - 58
  const topY = 20
  const floorY = H - 40
  // interior floor (wood, lit near, dark far)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(farL, topY + 44)
  ctx.lineTo(farR, topY + 44)
  ctx.lineTo(nearR, floorY)
  ctx.lineTo(nearL, floorY)
  ctx.closePath()
  ctx.clip()
  let g = ctx.createLinearGradient(0, topY, 0, floorY)
  g.addColorStop(0, rgb(mix(WOOD, [20, 13, 6], 0.5))) // far = dark (interior AO)
  g.addColorStop(1, rgb(mix(WOOD, [255, 240, 210], 0.06)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  grainStreaks(ctx, farL, topY + 44, farR - farL, floorY - topY - 44, 22, rgb(mix(WOOD, [230, 190, 140], 0.4)), rgb(mix(WOOD, [16, 10, 4], 0.6)))
  ctx.restore()
  // back inner wall
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(farL, topY)
  ctx.lineTo(farR, topY)
  ctx.lineTo(farR, topY + 44)
  ctx.lineTo(farL, topY + 44)
  ctx.closePath()
  ctx.clip()
  g = ctx.createLinearGradient(0, topY, 0, topY + 44)
  g.addColorStop(0, rgb(mix(WOOD, [26, 17, 8], 0.5)))
  g.addColorStop(1, rgb(mix(WOOD, [12, 8, 4], 0.66)))
  ctx.fillStyle = g
  ctx.fillRect(0, topY, W, 44)
  ctx.restore()
  // interior AO shadow pooling at the back
  const ao = ctx.createLinearGradient(0, topY + 20, 0, topY + 130)
  ao.addColorStop(0, 'rgba(0,0,0,0.5)')
  ao.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ao
  ctx.fillRect(farL, topY + 44, farR - farL, 100)
  // left & right inner walls (angled)
  ctx.beginPath()
  ctx.moveTo(nearL, floorY)
  ctx.lineTo(farL, topY)
  ctx.lineTo(farL, topY + 44)
  ctx.lineTo(nearL + 4, floorY)
  ctx.closePath()
  ctx.fillStyle = rgb(mix(WOOD, [18, 12, 6], 0.5))
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(nearR, floorY)
  ctx.lineTo(farR, topY)
  ctx.lineTo(farR, topY + 44)
  ctx.lineTo(nearR - 4, floorY)
  ctx.closePath()
  ctx.fillStyle = rgb(mix(WOOD, [12, 8, 4], 0.56))
  ctx.fill()
  // the lit near FRONT rim of the pulled-out drawer (a thick wooden lip)
  woodPanel(ctx, nearL, floorY - 6, nearR - nearL, 40, 12, WOOD, { topLight: 0.32, botShade: 0.34, streaks: 20 })
  ctx.strokeStyle = rgb(mix(WOOD, [255, 248, 224], 0.7), 0.7)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(nearL + 14, floorY - 2)
  ctx.lineTo(nearR - 14, floorY - 2)
  ctx.stroke()
  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('drawer-open.png'), buf)
  console.log('  ✓ drawer-open.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE ROOM BACKDROP — a calm, low-contrast nursery/playroom (SceneBackdrop).
// ============================================================================
function bakeRoom() {
  const W = 1000
  const H = 720
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const WALL = [214, 204, 190]
  const FLOOR = [196, 168, 132]
  const floorY = H * 0.66
  // wall wash, brighter up top (soft daylight)
  let g = ctx.createLinearGradient(0, 0, 0, floorY)
  g.addColorStop(0, rgb(mix(WALL, [255, 250, 240], 0.3)))
  g.addColorStop(1, rgb(mix(WALL, [150, 140, 128], 0.16)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, floorY)
  // soft window glow upper-left (muted)
  g = ctx.createRadialGradient(W * 0.26, H * 0.16, 0, W * 0.26, H * 0.16, W * 0.5)
  g.addColorStop(0, 'rgba(255,250,232,0.28)')
  g.addColorStop(1, 'rgba(255,250,232,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, floorY)
  // two soft FRAMED pictures on the wall (muted, to the sides so they stay clear
  // of the centred object + dresser) — reads as a real room, stays calm
  for (const [cx, cy, fw, fh, top, bot] of [
    [W * 0.13, H * 0.2, 108, 84, [176, 190, 178], [150, 168, 176]], // upper-left, soft landscape
    [W * 0.86, H * 0.18, 84, 104, [196, 176, 182], [176, 158, 172]], // upper-right, soft portrait
  ]) {
    const fx = cx - fw / 2
    const fy = cy - fh / 2
    // frame (muted wood)
    ctx.fillStyle = rgb([150, 128, 100], 0.5)
    roundRectPath(ctx, fx - 5, fy - 5, fw + 10, fh + 10, 6)
    ctx.fill()
    // picture (a soft two-tone wash so it reads as art, not a blank panel)
    const fg = ctx.createLinearGradient(fx, fy, fx, fy + fh)
    fg.addColorStop(0, rgb(mix(top, [255, 255, 255], 0.28), 0.6))
    fg.addColorStop(0.6, rgb(top, 0.55))
    fg.addColorStop(1, rgb(mix(bot, [40, 34, 30], 0.14), 0.55))
    ctx.fillStyle = fg
    roundRectPath(ctx, fx, fy, fw, fh, 3)
    ctx.fill()
    // a soft muted "hill/horizon" hint inside
    ctx.save()
    roundRectPath(ctx, fx, fy, fw, fh, 3)
    ctx.clip()
    ctx.fillStyle = rgb(mix(bot, [90, 80, 70], 0.3), 0.4)
    ctx.beginPath()
    ctx.moveTo(fx, fy + fh * 0.72)
    ctx.quadraticCurveTo(fx + fw * 0.5, fy + fh * 0.52, fx + fw, fy + fh * 0.7)
    ctx.lineTo(fx + fw, fy + fh)
    ctx.lineTo(fx, fy + fh)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // inner frame line
    ctx.strokeStyle = 'rgba(90,72,52,0.28)'
    ctx.lineWidth = 2
    roundRectPath(ctx, fx, fy, fw, fh, 3)
    ctx.stroke()
  }
  // warm receding floor
  g = ctx.createLinearGradient(0, floorY, 0, H)
  g.addColorStop(0, rgb(mix(FLOOR, [255, 240, 214], 0.16)))
  g.addColorStop(1, rgb(mix(FLOOR, [90, 66, 40], 0.22)))
  ctx.fillStyle = g
  ctx.fillRect(0, floorY, W, H - floorY)
  // floor plank seams receding toward a vanishing point (subtle perspective)
  ctx.strokeStyle = 'rgba(90,64,38,0.16)'
  ctx.lineWidth = 2
  const vpx = W * 0.5
  for (let i = -6; i <= 6; i++) {
    const fx = W * 0.5 + i * (W * 0.14)
    ctx.beginPath()
    ctx.moveTo(fx, H)
    ctx.lineTo(lerp(fx, vpx, 0.5), floorY)
    ctx.stroke()
  }
  // wall/floor seam shadow
  const seam = ctx.createLinearGradient(0, floorY, 0, floorY + 26)
  seam.addColorStop(0, 'rgba(50,36,20,0.22)')
  seam.addColorStop(1, 'rgba(50,36,20,0)')
  ctx.fillStyle = seam
  ctx.fillRect(0, floorY, W, 26)
  // a soft round rug on the floor (muted, where the dresser stands)
  ctx.save()
  ctx.translate(W * 0.5, H * 0.84)
  ctx.scale(1, 0.36)
  const rg = ctx.createRadialGradient(0, 0, 10, 0, 0, W * 0.34)
  rg.addColorStop(0, rgb([196, 178, 186], 0.5))
  rg.addColorStop(0.7, rgb([182, 166, 176], 0.42))
  rg.addColorStop(1, rgb([182, 166, 176], 0))
  ctx.fillStyle = rg
  ctx.beginPath()
  ctx.arc(0, 0, W * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // fine wall grain
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const n = grain(x * 0.4, y * 0.4) * 0.6 + grain(x * 1.5, y * 1.5) * 0.4
      const m = 1 + n * 0.022
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  // gentle corner vignette
  g = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.34, W * 0.5, H * 0.5, W * 0.72)
  g.addColorStop(0, 'rgba(60,44,26,0)')
  g.addColorStop(1, 'rgba(60,44,26,0.18)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('letterdrawer-room.jpg'), buf)
  console.log('  ✓ bg/letterdrawer-room.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking אות במגירה (letter drawer) art →')
bakeCabinet()
bakeDrawerFace()
bakeKnob()
bakeDrawerOpen()
bakeRoom()
console.log('Done.')
