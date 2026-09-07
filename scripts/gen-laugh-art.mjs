// Bakes the "צחוק" (laugh) toy's materials — a REAL cozy comedy-stage, not flat CSS.
//
// The scene is a warm, calm little puppet-theatre / comedy corner:
//   • bg/laugh-stage.jpg  — an ILLUSTRATED backdrop: muted rosewood back wall, a
//     scalloped gold valance, two velvet side drapes with soft folds, a warm
//     spotlight pooling on a receding WOOD-PLANK floor (real perspective), vignette.
//   • sprites/laugh/stool.png — a baked round 3-leg wooden stool (top-lit, AO, grain)
//   • sprites/laugh/mic.png   — a baked retro microphone on a stand (muted chrome)
//   • sprites/laugh/glow.png  — a soft warm spotlight pool (overlaid + gently pulsed)
//   • sprites/laugh/shadow.png — a soft contact shadow that grounds the friend
//   • sprites/laugh/burst-{star,heart,note}.png — warm giggle particles that float up
//
// Every pixel is an original @napi-rs/canvas bake with seeded value-noise grain and
// analytic baked lighting / ambient occlusion (same pipeline as the dice / coin-sort
// materials). No third-party art. Muted, sensory-calm palette — no neon. One-off:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-laugh-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT_SPR = new URL('../public/art/sprites/laugh/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT_SPR, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })
const winPath = (u) => u.pathname.replace(/^\/([A-Za-z]:)/, '$1')
const sprFile = (name) => winPath(new URL(name, OUT_SPR))
const bgFile = (name) => winPath(new URL(name, OUT_BG))

// ---- seeded value noise (fbm) — the material grain generator --------------------
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
  const lerp = (a, b, t) => a + t * (b - a)
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
    const x1 = lerp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerp(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const grain = makeNoise(20260718)

// run a fine grain pass over every painted pixel (kills the "flat CSS" read)
function grainPass(ctx, W, H, amt = 0.045, scale = 0.5) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * scale, y * scale) * 0.6 + grain(x * scale * 3.4, y * scale * 3.4) * 0.4
      const m = 1 + n * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
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

// ── muted, warm, sensory-calm palette (no neon) ──────────────────────────────────
const WALL = { hi: [122, 79, 67], mid: [92, 58, 51], lo: [64, 40, 37] }
const VELVET = { hi: [146, 78, 76], mid: [110, 56, 55], lo: [76, 39, 39], deep: [52, 27, 27] }
const GOLD = { hi: [220, 182, 120], mid: [180, 142, 88], lo: [136, 102, 60] }
const WOOD = { hi: [180, 132, 84], mid: [130, 90, 56], lo: [94, 63, 39], seamD: [58, 39, 23], seamL: [230, 202, 158] }
const WARM = [255, 244, 214] // spotlight

// ============================================================================
// BACKDROP — bg/laugh-stage.jpg
// ============================================================================
function bakeBackdrop() {
  const W = 900
  const H = 600
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // --- back wall: warm rosewood, brighter toward the upper spotlight ---
  let g = ctx.createRadialGradient(W * 0.5, H * 0.02, 40, W * 0.5, H * 0.34, W * 0.85)
  g.addColorStop(0, rgb(WALL.hi))
  g.addColorStop(0.5, rgb(WALL.mid))
  g.addColorStop(1, rgb(WALL.lo))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const floorTop = H * 0.62

  // --- spotlight cone/glow from top-centre onto the stage (soft, warm) ---
  g = ctx.createRadialGradient(W * 0.5, H * 0.04, 20, W * 0.5, floorTop * 0.92, W * 0.62)
  g.addColorStop(0, rgb(WARM, 0.30))
  g.addColorStop(0.55, rgb(WARM, 0.10))
  g.addColorStop(1, rgb(WARM, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, floorTop + 30)

  // --- WOOD-PLANK floor (receding, real perspective) -------------------------
  g = ctx.createLinearGradient(0, floorTop, 0, H)
  g.addColorStop(0, rgb(mix(WOOD.mid, WOOD.lo, 0.35)))
  g.addColorStop(0.45, rgb(WOOD.mid))
  g.addColorStop(1, rgb(WOOD.hi))
  ctx.fillStyle = g
  ctx.fillRect(0, floorTop, W, H - floorTop)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, floorTop, W, H - floorTop)
  ctx.clip()
  // plank seams converging toward a vanishing point high on the back wall
  const vpX = W * 0.5
  const vpY = floorTop - (H - floorTop) * 1.35
  ctx.lineWidth = 2
  for (let i = -6; i <= 6; i++) {
    const fx = W * 0.5 + i * (W / 9)
    ctx.strokeStyle = rgb(WOOD.seamD, 0.5)
    ctx.beginPath()
    ctx.moveTo(vpX + (fx - vpX) * 0.001, floorTop)
    ctx.lineTo(fx, H)
    ctx.stroke()
    ctx.strokeStyle = rgb(WOOD.seamL, 0.08)
    ctx.beginPath()
    ctx.moveTo(vpX + (fx - vpX) * 0.001 + 1.5, floorTop)
    ctx.lineTo(fx + 2, H)
    ctx.stroke()
  }
  void vpY
  // horizontal depth bands (closer planks are taller → perspective)
  for (let i = 1; i <= 6; i++) {
    const yy = floorTop + Math.pow(i / 6, 1.7) * (H - floorTop)
    ctx.strokeStyle = rgb(WOOD.seamD, 0.28)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, yy)
    ctx.lineTo(W, yy)
    ctx.stroke()
    ctx.strokeStyle = rgb(WOOD.seamL, 0.06)
    ctx.beginPath()
    ctx.moveTo(0, yy + 1.5)
    ctx.lineTo(W, yy + 1.5)
    ctx.stroke()
  }
  // wood grain streaks
  for (let i = 0; i < 60; i++) {
    const yy = floorTop + Math.random() * (H - floorTop)
    const xx = Math.random() * W
    const len = 30 + Math.random() * 90
    ctx.strokeStyle = Math.random() < 0.5 ? rgb(WOOD.seamD, 0.12) : rgb(WOOD.seamL, 0.07)
    ctx.lineWidth = 0.6 + Math.random() * 1.2
    ctx.beginPath()
    ctx.moveTo(xx, yy)
    ctx.lineTo(xx + len, yy + (Math.random() - 0.5) * 4)
    ctx.stroke()
  }
  // spotlight sheen pooled on the floor (elliptical, centred)
  const pool = ctx.createRadialGradient(W * 0.5, floorTop + (H - floorTop) * 0.42, 20, W * 0.5, floorTop + (H - floorTop) * 0.42, W * 0.42)
  pool.addColorStop(0, rgb(WARM, 0.22))
  pool.addColorStop(0.6, rgb(WARM, 0.06))
  pool.addColorStop(1, rgb(WARM, 0))
  ctx.fillStyle = pool
  ctx.fillRect(0, floorTop, W, H - floorTop)
  ctx.restore()

  // floor / wall seam: a lit lip
  ctx.strokeStyle = rgb(WOOD.seamL, 0.30)
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, floorTop)
  ctx.lineTo(W, floorTop)
  ctx.stroke()
  ctx.strokeStyle = rgb([30, 20, 12], 0.35)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, floorTop + 3)
  ctx.lineTo(W, floorTop + 3)
  ctx.stroke()

  // --- VELVET side drapes (left + right), soft vertical folds ----------------
  function drape(side) {
    // side: -1 left, +1 right. Draped column with a tie-back curve mid-height.
    const edge = side < 0 ? 0 : W
    const inner = side < 0 ? W * 0.24 : W * 0.76
    const belly = side < 0 ? W * 0.30 : W * 0.70 // where the tie-back pulls it in
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(edge, -2)
    ctx.lineTo(inner, -2)
    ctx.lineTo(inner, H * 0.30)
    ctx.quadraticCurveTo(belly, H * 0.40, side < 0 ? W * 0.14 : W * 0.86, H * 0.58)
    ctx.quadraticCurveTo(side < 0 ? W * 0.06 : W * 0.94, H * 0.72, edge, H * 0.74)
    ctx.closePath()
    // base velvet gradient (lit toward inner/top)
    const vg = ctx.createLinearGradient(edge, 0, inner, 0)
    vg.addColorStop(0, rgb(VELVET.deep))
    vg.addColorStop(0.5, rgb(VELVET.lo))
    vg.addColorStop(1, rgb(VELVET.mid))
    ctx.fillStyle = vg
    ctx.fill()
    // soft vertical folds
    ctx.clip()
    const cols = 6
    for (let i = 0; i <= cols; i++) {
      const t = i / cols
      const fxpos = lerp(edge, inner, t)
      const fold = ctx.createLinearGradient(fxpos - 22, 0, fxpos + 22, 0)
      const light = i % 2 === 0
      fold.addColorStop(0, rgb(VELVET.lo, 0))
      fold.addColorStop(0.5, light ? rgb(VELVET.hi, 0.5) : rgb(VELVET.deep, 0.5))
      fold.addColorStop(1, rgb(VELVET.lo, 0))
      ctx.fillStyle = fold
      ctx.fillRect(fxpos - 22, -4, 44, H * 0.8)
    }
    // AO where the drape meets the wall (inner edge, lower)
    const ao = ctx.createLinearGradient(inner - 40, 0, inner, 0)
    ao.addColorStop(0, rgb(VELVET.deep, 0))
    ao.addColorStop(1, rgb(VELVET.deep, 0.45))
    ctx.fillStyle = ao
    ctx.fillRect(inner - 40, -4, 40, H)
    ctx.restore()
    // gold tie-back cord
    ctx.strokeStyle = rgb(GOLD.mid)
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(inner, H * 0.30)
    ctx.quadraticCurveTo(belly, H * 0.40, side < 0 ? W * 0.14 : W * 0.86, H * 0.44)
    ctx.stroke()
    ctx.strokeStyle = rgb(GOLD.hi, 0.7)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(inner, H * 0.30)
    ctx.quadraticCurveTo(belly, H * 0.40, side < 0 ? W * 0.14 : W * 0.86, H * 0.44)
    ctx.stroke()
  }
  drape(-1)
  drape(1)

  // --- scalloped GOLD valance across the top -------------------------------
  const valH = H * 0.16
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, -2)
  ctx.lineTo(W, -2)
  ctx.lineTo(W, valH * 0.6)
  const scallops = 9
  for (let i = scallops; i >= 0; i--) {
    const x0 = (i / scallops) * W
    const xPrev = ((i + 0.5) / scallops) * W
    ctx.quadraticCurveTo(xPrev, valH * 1.15, x0, valH * 0.6)
  }
  ctx.closePath()
  const vg = ctx.createLinearGradient(0, 0, 0, valH * 1.1)
  vg.addColorStop(0, rgb(GOLD.hi))
  vg.addColorStop(0.5, rgb(GOLD.mid))
  vg.addColorStop(1, rgb(GOLD.lo))
  ctx.fillStyle = vg
  ctx.fill()
  ctx.clip()
  // fold shading per scallop
  for (let i = 0; i < scallops; i++) {
    const cx = ((i + 0.5) / scallops) * W
    const fg = ctx.createLinearGradient(cx - W / scallops / 2, 0, cx + W / scallops / 2, 0)
    fg.addColorStop(0, rgb(GOLD.lo, 0.5))
    fg.addColorStop(0.5, rgb(GOLD.hi, 0.4))
    fg.addColorStop(1, rgb(GOLD.lo, 0.5))
    ctx.fillStyle = fg
    ctx.fillRect(cx - W / scallops / 2, 0, W / scallops, valH * 1.2)
  }
  // lower rim AO on the scallops
  const rim = ctx.createLinearGradient(0, valH * 0.4, 0, valH * 1.1)
  rim.addColorStop(0, rgb([50, 34, 18], 0))
  rim.addColorStop(1, rgb([50, 34, 18], 0.4))
  ctx.fillStyle = rim
  ctx.fillRect(0, valH * 0.4, W, valH * 0.8)
  ctx.restore()
  // little tassels hanging from each scallop trough
  for (let i = 0; i <= scallops; i++) {
    const x0 = (i / scallops) * W
    ctx.fillStyle = rgb(GOLD.mid)
    ctx.beginPath()
    ctx.moveTo(x0 - 3, valH * 0.6)
    ctx.lineTo(x0 + 3, valH * 0.6)
    ctx.lineTo(x0, valH * 0.6 + 14)
    ctx.closePath()
    ctx.fill()
  }

  // --- gentle vignette -------------------------------------------------------
  const vig = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.34, W / 2, H * 0.52, H * 0.92)
  vig.addColorStop(0, 'rgba(24,14,12,0)')
  vig.addColorStop(1, 'rgba(24,14,12,0.30)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  grainPass(ctx, W, H, 0.05, 0.6)

  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(bgFile('laugh-stage.jpg'), buf)
  console.log('  ✓ bg/laugh-stage.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// STOOL — sprites/laugh/stool.png (round 3-leg wooden stool)
// ============================================================================
function bakeStool() {
  const W = 240
  const H = 210
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const seatY = H * 0.34
  const seatRx = W * 0.40
  const seatRy = W * 0.12

  // contact shadow
  let sh = ctx.createRadialGradient(cx, H * 0.94, 6, cx, H * 0.94, W * 0.42)
  sh.addColorStop(0, 'rgba(20,14,8,0.34)')
  sh.addColorStop(1, 'rgba(20,14,8,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.ellipse(cx, H * 0.94, W * 0.40, H * 0.07, 0, 0, Math.PI * 2)
  ctx.fill()

  // three splayed legs
  const legTop = seatY + seatRy * 0.4
  const legBottom = H * 0.9
  function leg(dx) {
    const topX = cx + dx * seatRx * 0.7
    const botX = cx + dx * seatRx * 1.05
    ctx.beginPath()
    ctx.moveTo(topX - 9, legTop)
    ctx.lineTo(topX + 9, legTop)
    ctx.lineTo(botX + 6, legBottom)
    ctx.lineTo(botX - 6, legBottom)
    ctx.closePath()
    const lg = ctx.createLinearGradient(topX - 9, 0, topX + 9, 0)
    lg.addColorStop(0, rgb(WOOD.lo))
    lg.addColorStop(0.5, rgb(WOOD.mid))
    lg.addColorStop(1, rgb(mix(WOOD.lo, [20, 14, 8], 0.3)))
    ctx.fillStyle = lg
    ctx.fill()
  }
  leg(-1)
  leg(1)
  leg(0.06) // centre-back leg, mostly hidden

  // seat top (ellipse) — warm wood, top-lit
  ctx.beginPath()
  ctx.ellipse(cx, seatY, seatRx, seatRy, 0, 0, Math.PI * 2)
  const side = ctx.createLinearGradient(0, seatY, 0, seatY + seatRy * 1.8)
  side.addColorStop(0, rgb(WOOD.mid))
  side.addColorStop(1, rgb(WOOD.lo))
  // seat rim/thickness first
  ctx.fillStyle = side
  ctx.beginPath()
  ctx.ellipse(cx, seatY + seatRy * 0.5, seatRx, seatRy, 0, 0, Math.PI * 2)
  ctx.fill()
  // top face
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, seatY, seatRx, seatRy, 0, 0, Math.PI * 2)
  const tg = ctx.createRadialGradient(cx - seatRx * 0.3, seatY - seatRy * 0.5, 4, cx, seatY, seatRx)
  tg.addColorStop(0, rgb(WOOD.hi))
  tg.addColorStop(0.6, rgb(WOOD.mid))
  tg.addColorStop(1, rgb(mix(WOOD.mid, WOOD.lo, 0.6)))
  ctx.fillStyle = tg
  ctx.fill()
  ctx.clip()
  // concentric wood rings + grain
  for (let i = 1; i <= 4; i++) {
    ctx.strokeStyle = rgb(WOOD.seamD, 0.14)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(cx, seatY, seatRx * (i / 5), seatRy * (i / 5), 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  // top rim highlight
  ctx.strokeStyle = rgb(WOOD.seamL, 0.4)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, seatY - 1, seatRx, seatRy, 0, Math.PI * 1.05, Math.PI * 1.95)
  ctx.stroke()

  grainPass(ctx, W, H, 0.05, 0.7)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('stool.png'), buf)
  console.log('  ✓ stool.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// MIC — sprites/laugh/mic.png (retro microphone on a stand)
// ============================================================================
function bakeMic() {
  const W = 170
  const H = 360
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const MET = { hi: [206, 208, 214], mid: [150, 152, 162], lo: [96, 98, 112], dk: [58, 60, 74] }

  // contact shadow
  let sh = ctx.createRadialGradient(cx, H * 0.96, 4, cx, H * 0.96, W * 0.5)
  sh.addColorStop(0, 'rgba(18,14,10,0.34)')
  sh.addColorStop(1, 'rgba(18,14,10,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.ellipse(cx, H * 0.96, W * 0.46, H * 0.03, 0, 0, Math.PI * 2)
  ctx.fill()

  // round base disc
  ctx.beginPath()
  ctx.ellipse(cx, H * 0.9, W * 0.36, H * 0.035, 0, 0, Math.PI * 2)
  let bg = ctx.createLinearGradient(cx - W * 0.36, 0, cx + W * 0.36, 0)
  bg.addColorStop(0, rgb(MET.lo))
  bg.addColorStop(0.5, rgb(MET.mid))
  bg.addColorStop(1, rgb(MET.dk))
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = rgb(MET.hi, 0.5)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(cx, H * 0.9 - 2, W * 0.36, H * 0.035, 0, Math.PI, Math.PI * 2)
  ctx.stroke()

  // vertical pole
  const poleTop = H * 0.30
  const poleBot = H * 0.9
  const pg = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0)
  pg.addColorStop(0, rgb(MET.lo))
  pg.addColorStop(0.4, rgb(MET.hi))
  pg.addColorStop(0.6, rgb(MET.mid))
  pg.addColorStop(1, rgb(MET.dk))
  ctx.fillStyle = pg
  ctx.fillRect(cx - 6, poleTop, 12, poleBot - poleTop)
  // pole highlight
  ctx.strokeStyle = rgb([255, 255, 255], 0.4)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - 3, poleTop)
  ctx.lineTo(cx - 3, poleBot)
  ctx.stroke()

  // mic head — a warm chrome capsule with a grille
  const headCx = cx
  const headCy = H * 0.2
  const headRx = W * 0.24
  const headRy = H * 0.11
  // body of the head
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(headCx, headCy, headRx, headRy, 0, 0, Math.PI * 2)
  const hg = ctx.createRadialGradient(headCx - headRx * 0.35, headCy - headRy * 0.45, 3, headCx, headCy, headRx * 1.2)
  hg.addColorStop(0, rgb(mix(MET.hi, GOLD.hi, 0.25)))
  hg.addColorStop(0.55, rgb(mix(MET.mid, GOLD.mid, 0.2)))
  hg.addColorStop(1, rgb(MET.dk))
  ctx.fillStyle = hg
  ctx.fill()
  ctx.clip()
  // grille lines (cross-hatch)
  ctx.strokeStyle = rgb(MET.dk, 0.5)
  ctx.lineWidth = 1.4
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath()
    ctx.moveTo(headCx + i * 7, headCy - headRy)
    ctx.lineTo(headCx + i * 7, headCy + headRy)
    ctx.stroke()
  }
  for (let j = -3; j <= 3; j++) {
    ctx.beginPath()
    ctx.moveTo(headCx - headRx, headCy + j * 7)
    ctx.lineTo(headCx + headRx, headCy + j * 7)
    ctx.stroke()
  }
  // top-left sheen
  const sheen = ctx.createRadialGradient(headCx - headRx * 0.4, headCy - headRy * 0.5, 2, headCx - headRx * 0.4, headCy - headRy * 0.5, headRx)
  sheen.addColorStop(0, 'rgba(255,255,255,0.5)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(headCx - headRx, headCy - headRy, headRx * 2, headRy * 2)
  ctx.restore()
  // head rim
  ctx.strokeStyle = rgb(MET.hi, 0.55)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(headCx, headCy, headRx, headRy, 0, 0, Math.PI * 2)
  ctx.stroke()
  // collar between head and pole
  ctx.fillStyle = rgb(MET.lo)
  roundRectPath(ctx, cx - 9, headCy + headRy - 4, 18, 22, 4)
  ctx.fill()

  grainPass(ctx, W, H, 0.04, 0.8)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('mic.png'), buf)
  console.log('  ✓ mic.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// SHADOW — sprites/laugh/shadow.png (grounds the friend)
// ============================================================================
function bakeShadow() {
  const W = 320
  const H = 120
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, W * 0.5)
  g.addColorStop(0, 'rgba(18,12,8,0.42)')
  g.addColorStop(0.5, 'rgba(18,12,8,0.22)')
  g.addColorStop(1, 'rgba(18,12,8,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, W * 0.48, H * 0.46, 0, 0, Math.PI * 2)
  ctx.fill()
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('shadow.png'), buf)
  console.log('  ✓ shadow.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// GLOW — sprites/laugh/glow.png (soft warm spotlight pool, gently pulsed)
// ============================================================================
function bakeGlow() {
  const S = 420
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S * 0.5)
  g.addColorStop(0, rgb(WARM, 0.5))
  g.addColorStop(0.4, rgb(WARM, 0.22))
  g.addColorStop(0.75, rgb(WARM, 0.06))
  g.addColorStop(1, rgb(WARM, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(S / 2, S / 2, S * 0.5, 0, Math.PI * 2)
  ctx.fill()
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('glow.png'), buf)
  console.log('  ✓ glow.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// BURST PARTICLES — warm giggle motes that float up (star / heart / note)
// ============================================================================
function withGlow(ctx, cx, cy, r, col, drawShape) {
  // soft outer glow
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.5)
  glow.addColorStop(0, rgb(col.hi, 0.4))
  glow.addColorStop(1, rgb(col.hi, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2)
  ctx.fill()
  drawShape()
}

function bakeStar() {
  const S = 96
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const c = S / 2
  const col = { hi: [246, 222, 150], mid: [226, 186, 96], lo: [180, 140, 60] }
  withGlow(ctx, c, c, S * 0.34, col, () => {
    // 4-point sparkle
    ctx.save()
    ctx.translate(c, c)
    ctx.beginPath()
    const R = S * 0.42
    const r = S * 0.12
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 - Math.PI / 2
      const rad = i % 2 === 0 ? R : r
      const px = Math.cos(ang) * rad
      const py = Math.sin(ang) * rad
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath()
    const g = ctx.createRadialGradient(-R * 0.25, -R * 0.25, 2, 0, 0, R)
    g.addColorStop(0, rgb(mix(col.hi, [255, 255, 255], 0.5)))
    g.addColorStop(0.5, rgb(col.mid))
    g.addColorStop(1, rgb(col.lo))
    ctx.fillStyle = g
    ctx.fill()
    // centre catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(-R * 0.14, -R * 0.14, S * 0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  grainPass(ctx, S, S, 0.05, 1.0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('burst-star.png'), buf)
  console.log('  ✓ burst-star.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

function bakeHeart() {
  const S = 96
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const c = S / 2
  const col = { hi: [234, 172, 154], mid: [206, 126, 108], lo: [162, 88, 74] }
  withGlow(ctx, c, c, S * 0.32, col, () => {
    ctx.save()
    ctx.translate(c, c + S * 0.06)
    const w = S * 0.36
    ctx.beginPath()
    ctx.moveTo(0, w * 0.9)
    ctx.bezierCurveTo(w, 0, w * 0.55, -w * 0.9, 0, -w * 0.28)
    ctx.bezierCurveTo(-w * 0.55, -w * 0.9, -w, 0, 0, w * 0.9)
    ctx.closePath()
    const g = ctx.createRadialGradient(-w * 0.25, -w * 0.35, 2, 0, 0, w * 1.3)
    g.addColorStop(0, rgb(mix(col.hi, [255, 255, 255], 0.45)))
    g.addColorStop(0.5, rgb(col.mid))
    g.addColorStop(1, rgb(col.lo))
    ctx.fillStyle = g
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.ellipse(-w * 0.28, -w * 0.28, w * 0.14, w * 0.2, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  grainPass(ctx, S, S, 0.05, 1.0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('burst-heart.png'), buf)
  console.log('  ✓ burst-heart.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

function bakeNote() {
  const S = 96
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const c = S / 2
  const col = { hi: [172, 198, 226], mid: [120, 152, 196], lo: [80, 108, 156] }
  withGlow(ctx, c, c, S * 0.32, col, () => {
    ctx.save()
    ctx.translate(c, c)
    const g = ctx.createLinearGradient(-S * 0.2, -S * 0.3, S * 0.2, S * 0.3)
    g.addColorStop(0, rgb(mix(col.hi, [255, 255, 255], 0.4)))
    g.addColorStop(0.5, rgb(col.mid))
    g.addColorStop(1, rgb(col.lo))
    ctx.fillStyle = g
    ctx.strokeStyle = rgb(col.lo)
    ctx.lineWidth = S * 0.06
    // stem
    ctx.beginPath()
    ctx.moveTo(S * 0.14, -S * 0.32)
    ctx.lineTo(S * 0.14, S * 0.12)
    ctx.stroke()
    // flag
    ctx.beginPath()
    ctx.moveTo(S * 0.14, -S * 0.32)
    ctx.quadraticCurveTo(S * 0.36, -S * 0.26, S * 0.26, -S * 0.04)
    ctx.stroke()
    // note head
    ctx.beginPath()
    ctx.ellipse(S * 0.02, S * 0.14, S * 0.15, S * 0.11, -0.4, 0, Math.PI * 2)
    ctx.fill()
    // catchlight on the head
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.ellipse(-S * 0.03, S * 0.09, S * 0.045, S * 0.03, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
  grainPass(ctx, S, S, 0.05, 1.0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('burst-note.png'), buf)
  console.log('  ✓ burst-note.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking laugh (comedy-stage) art →')
bakeBackdrop()
bakeStool()
bakeMic()
bakeShadow()
bakeGlow()
bakeStar()
bakeHeart()
bakeNote()
console.log('Done.')
