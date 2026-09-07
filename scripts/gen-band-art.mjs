// Bakes the "להקת החברים" (band, #61) materials as REAL raster art with baked
// soft lighting + grain — never flat CSS shapes+gradients:
//
//   bg/band-stage.jpg     the evening SHOW backdrop: a deep indigo curtain wall
//                         (soft vertical fold shading, no flat repeat) up top +
//                         a receding WOODEN stage floor in true perspective below
//                         (converging plank seams, far-edge AO, a warm centre
//                         spotlight pool, near-edge lit lip). Used via
//                         <SceneBackdrop> as the stage's back layer; the CSS
//                         beat-reactive spotlight/wave sit ON TOP (animation,
//                         not material, stays in CSS per the doctrine).
//   sprites/band/chip.png a small INSTRUMENT-DRAWER tile: a rounded wooden
//                         coaster with a felt inset well, baked top-left key
//                         light, edge bevel and a soft contact shadow — the
//                         drawer chip a friend+emoji sits on, replacing the flat
//                         CSS panel. One neutral warm-oak tile; the "is-on"
//                         highlight ring stays a CSS glow (state, not material).
//
// Same pipeline as the dance / letter-hunt / calc materials: an original
// @napi-rs/canvas bake with seeded value-noise grain and analytic baked
// lighting/AO. No third-party art — everything here is original CC0. Muted,
// sensory-calm palette; matches the shared --stage-back/--stage-floor evening
// tones already used by the musicians decade (#61-62) in app.css.
//   node scripts/gen-band-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT_SPR = new URL('../public/art/sprites/band/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT_SPR, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })
const sprFile = (name) => new URL(name, OUT_SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const bgFile = (name) => new URL(name, OUT_BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same as dance) ----
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
  const lp = (a, b, t) => a + t * (b - a)
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
    const x1 = lp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lp(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const grain = makeNoise(20260801)

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function grainPass(ctx, w, h, amp = 0.05, sc = 0.7) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * sc, y * sc) * 0.6 + grain(x * sc * 3.1, y * sc * 3.1) * 0.4
      const m = 1 + n * amp
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

// ============================================================================
// 1) THE STAGE BACKDROP — indigo curtain wall + receding wooden stage floor
// ============================================================================
function bakeStage() {
  const W = 840
  const H = 620
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  const floorTop = H * 0.5 // where the curtain meets the stage floor

  // --- back curtain: deep indigo/violet with soft vertical fold shading ---
  const wallBase = ctx.createLinearGradient(0, 0, 0, floorTop + 4)
  wallBase.addColorStop(0, '#241a3e')
  wallBase.addColorStop(0.6, '#1c1636')
  wallBase.addColorStop(1, '#17203a')
  ctx.fillStyle = wallBase
  ctx.fillRect(0, 0, W, floorTop + 4)
  // soft vertical folds (repeating but organic width + alpha, not a flat repeat)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, floorTop + 4)
  ctx.clip()
  const foldN = makeNoise(9911)
  let fx = -20
  while (fx < W + 20) {
    const w = 26 + (foldN(fx * 0.02, 0) * 0.5 + 0.5) * 20
    const lit = foldN(fx * 0.05, 5) > 0
    const g = ctx.createLinearGradient(fx, 0, fx + w, 0)
    if (lit) {
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, 'rgba(160,140,200,0.10)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
    } else {
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.5, 'rgba(10,6,20,0.22)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
    }
    ctx.fillStyle = g
    ctx.fillRect(fx, 0, w, floorTop + 4)
    fx += w
  }
  ctx.restore()
  // warm top spotlight glows on the curtain (muted, static)
  const glow = (cx, cy, r, col, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, rgb(col, a))
    g.addColorStop(0.55, rgb(col, a * 0.4))
    g.addColorStop(1, rgb(col, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  glow(W * 0.5, H * 0.04, 300, [255, 209, 150], 0.3) // warm amber, top-centre
  glow(W * 0.22, H * 0.16, 170, [150, 130, 200], 0.26) // muted violet
  glow(W * 0.8, H * 0.18, 160, [140, 170, 200], 0.2) // muted teal-blue
  // curtain hem shadow just above the floor line
  const hem = ctx.createLinearGradient(0, floorTop - 46, 0, floorTop + 4)
  hem.addColorStop(0, 'rgba(10,7,20,0)')
  hem.addColorStop(1, 'rgba(10,7,20,0.42)')
  ctx.fillStyle = hem
  ctx.fillRect(0, floorTop - 46, W, 50)

  // --- receding wooden STAGE FLOOR (perspective trapezoid, lower half) ---
  const topHalf = W * 0.24 // far (back) edge half-width — narrower = perspective
  const botHalf = W * 0.62 // near (front) edge half-width
  const cxb = W / 2
  ctx.beginPath()
  ctx.moveTo(cxb - topHalf, floorTop)
  ctx.lineTo(cxb + topHalf, floorTop)
  ctx.lineTo(cxb + botHalf, H)
  ctx.lineTo(cxb - botHalf, H)
  ctx.closePath()
  ctx.save()
  ctx.clip()

  const WOOD_HI = [140, 104, 70]
  const WOOD_MID = [98, 72, 48]
  const WOOD_LO = [58, 42, 28]
  const fgrad = ctx.createLinearGradient(0, floorTop, 0, H)
  fgrad.addColorStop(0, rgb(WOOD_LO)) // far = darker
  fgrad.addColorStop(0.5, rgb(WOOD_MID))
  fgrad.addColorStop(1, rgb(WOOD_HI)) // near = lighter/warmer
  ctx.fillStyle = fgrad
  ctx.fillRect(0, floorTop, W, H - floorTop)

  // plank seams converging toward the vanishing point (perspective lines)
  ctx.strokeStyle = 'rgba(30,20,12,0.4)'
  ctx.lineWidth = 1.6
  for (let i = -5; i <= 5; i++) {
    const topX = cxb + (i / 5) * topHalf
    const botX = cxb + (i / 5) * botHalf
    ctx.beginPath()
    ctx.moveTo(topX, floorTop)
    ctx.lineTo(botX, H)
    ctx.stroke()
  }
  // horizontal depth bands (plank ends), spacing widens toward the front
  for (let i = 0; i <= 6; i++) {
    const t = i / 6
    const yy = floorTop + Math.pow(t, 1.7) * (H - floorTop)
    ctx.strokeStyle = 'rgba(28,18,10,0.32)'
    ctx.lineWidth = 1 + t * 1.6
    ctx.beginPath()
    ctx.moveTo(0, yy)
    ctx.lineTo(W, yy)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(220,190,150,0.10)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, yy + 1.4)
    ctx.lineTo(W, yy + 1.4)
    ctx.stroke()
  }
  // fine grain streaks (subtle, denser toward the front)
  for (let k = 0; k < 220; k++) {
    const t = Math.random()
    const yy = floorTop + Math.pow(t, 1.7) * (H - floorTop)
    const len = 18 + Math.random() * 80 * (0.4 + t)
    const x0 = Math.random() * W
    ctx.strokeStyle = grain(k, 3) > 0 ? 'rgba(50,34,20,0.18)' : 'rgba(196,164,120,0.12)'
    ctx.lineWidth = 0.6 + Math.random() * (0.7 + t)
    ctx.beginPath()
    ctx.moveTo(x0, yy)
    ctx.lineTo(x0 + len, yy + (Math.random() - 0.5) * 2)
    ctx.stroke()
  }
  // far-edge ambient occlusion (back of the stage sits in shade)
  const ao = ctx.createLinearGradient(0, floorTop, 0, floorTop + 50)
  ao.addColorStop(0, 'rgba(14,10,22,0.5)')
  ao.addColorStop(1, 'rgba(14,10,22,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, floorTop, W, 50)
  // warm centre spotlight pool where the band gathers
  const spot = ctx.createRadialGradient(cxb, H * 0.86, 10, cxb, H * 0.86, W * 0.4)
  spot.addColorStop(0, 'rgba(255,224,170,0.3)')
  spot.addColorStop(0.55, 'rgba(255,220,160,0.12)')
  spot.addColorStop(1, 'rgba(255,220,160,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, floorTop, W, H - floorTop)
  ctx.restore()

  // floor/curtain seam: lit contact edge
  ctx.strokeStyle = 'rgba(255,220,170,0.24)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cxb - topHalf, floorTop)
  ctx.lineTo(cxb + topHalf, floorTop)
  ctx.stroke()

  // gentle corner vignette so the frame reads as a real room
  const vig = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.5, H * 0.86)
  vig.addColorStop(0, 'rgba(10,7,18,0)')
  vig.addColorStop(1, 'rgba(10,7,18,0.36)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  grainPass(ctx, W, H, 0.032, 0.9)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('band-stage.jpg'), buf)
  console.log('  ✓ bg/band-stage.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(1) + 'KB')
}

// ============================================================================
// 2) THE DRAWER CHIP — a small wooden coaster with a felt inset well, the tile
//    an instrument (friend + emoji) sits on in the drawer strip
// ============================================================================
function bakeChip() {
  const S = 160
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const m = 8
  const w = S - m * 2
  const r = 26

  // baked contact shadow
  ctx.save()
  ctx.translate(S / 2, S - m + 6)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.56)
  sh.addColorStop(0, 'rgba(10,6,4,0.4)')
  sh.addColorStop(1, 'rgba(10,6,4,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.56, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const WOOD = [176, 134, 88]
  // outer wooden coaster body
  roundRectPath(ctx, m, m, w, w, r)
  const bg = ctx.createLinearGradient(m, m, m + w, m + w)
  bg.addColorStop(0, rgb(mix(WOOD, [255, 244, 220], 0.3)))
  bg.addColorStop(0.55, rgb(WOOD))
  bg.addColorStop(1, rgb(mix(WOOD, [40, 26, 14], 0.24)))
  ctx.save()
  ctx.fillStyle = bg
  ctx.fill()
  ctx.clip()
  // vertical grain streaks
  for (let i = 0; i < 16; i++) {
    const gx = m + Math.random() * w
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(232,200,152,0.14)' : 'rgba(96,62,30,0.16)'
    ctx.lineWidth = 0.6 + Math.random() * 1.5
    ctx.beginPath()
    ctx.moveTo(gx, m)
    ctx.lineTo(gx + (Math.random() - 0.5) * 4, m + w)
    ctx.stroke()
  }
  const bloom = ctx.createRadialGradient(m + w * 0.28, m + w * 0.24, 0, m + w * 0.28, m + w * 0.24, w * 0.9)
  bloom.addColorStop(0, 'rgba(255,248,232,0.26)')
  bloom.addColorStop(1, 'rgba(255,248,232,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(m, m, w, w)
  ctx.restore()

  // bevel rim: bright top-left, dark bottom-right
  ctx.save()
  roundRectPath(ctx, m, m, w, w, r)
  ctx.lineWidth = 3
  const bev = ctx.createLinearGradient(m, m, m + w, m + w)
  bev.addColorStop(0, 'rgba(255,250,236,0.55)')
  bev.addColorStop(0.5, 'rgba(255,250,236,0.05)')
  bev.addColorStop(0.52, 'rgba(40,26,12,0.05)')
  bev.addColorStop(1, 'rgba(40,26,12,0.5)')
  ctx.strokeStyle = bev
  ctx.stroke()
  ctx.restore()

  // recessed felt inset well (a friend+emoji sit on this in the runtime)
  const pin = w * 0.1
  const px = m + pin
  const py = m + pin
  const ps = w - pin * 2
  const pr = ps * 0.22
  roundRectPath(ctx, px - 2, py - 2, ps + 4, ps + 4, pr + 2)
  ctx.save()
  ctx.clip()
  const felt_ao = ctx.createLinearGradient(px, py, px + ps, py + ps)
  felt_ao.addColorStop(0, 'rgba(30,20,10,0.42)')
  felt_ao.addColorStop(0.4, 'rgba(30,20,10,0.1)')
  felt_ao.addColorStop(1, 'rgba(30,20,10,0)')
  ctx.fillStyle = felt_ao
  ctx.fillRect(px - 2, py - 2, ps + 4, ps + 4)
  ctx.restore()
  roundRectPath(ctx, px, py, ps, ps, pr)
  ctx.save()
  ctx.clip()
  const FELT = [92, 76, 108] // muted plum felt, neutral enough for any instrument tint
  const felt = ctx.createLinearGradient(px, py, px + ps, py + ps)
  felt.addColorStop(0, rgb(mix(FELT, [10, 6, 16], 0.18)))
  felt.addColorStop(0.5, rgb(FELT))
  felt.addColorStop(1, rgb(mix(FELT, [150, 134, 168], 0.22)))
  ctx.fillStyle = felt
  ctx.fillRect(px, py, ps, ps)
  // felt micro-speckle
  for (let i = 0; i < 90; i++) {
    const sx = px + Math.random() * ps
    const sy = py + Math.random() * ps
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(150,134,168,0.10)' : 'rgba(30,20,40,0.12)'
    ctx.beginPath()
    ctx.arc(sx, sy, 0.5 + Math.random() * 1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // inner recess rim
  ctx.save()
  roundRectPath(ctx, px, py, ps, ps, pr)
  ctx.lineWidth = 2
  const rim = ctx.createLinearGradient(px, py, px + ps, py + ps)
  rim.addColorStop(0, 'rgba(20,12,6,0.45)')
  rim.addColorStop(0.5, 'rgba(20,12,6,0.05)')
  rim.addColorStop(1, 'rgba(255,250,236,0.4)')
  ctx.strokeStyle = rim
  ctx.stroke()
  ctx.restore()

  grainPass(ctx, S, S, 0.045, 1)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('chip.png'), buf)
  console.log('  ✓ chip.png', `${S}×${S}`, (buf.length / 1024).toFixed(1) + 'KB')
}

console.log('Baking band art →')
bakeStage()
bakeChip()
console.log('Done.')
