// Bakes the "מכונת הקצב" (rhythm blocks, #62) materials as REAL raster art with
// baked soft lighting + grain — never flat CSS shapes+gradients:
//
//   bg/rhythm-stage.jpg     Dabi's evening backdrop: a muted indigo wall with a
//                           soft violet stage-light glow up top + a receding
//                           wooden dance floor in true perspective below
//                           (converging plank seams, far-edge AO, a warm centre
//                           spot). Used via <SceneBackdrop> as the stage's back
//                           layer; the CSS lock-flash/bob stay in CSS/JS
//                           (animation, not material).
//   sprites/rhythm/block.png a neutral WOODEN BLOCK cube: rounded, baked
//                           top-left key light + bottom-right AO, a bevelled
//                           raised rim and a soft drop shadow so it sits proud
//                           of the palette — one warm-neutral sprite tinted per
//                           colour via a CSS `mix-blend-mode: color` wash
//                           (matches the calc-key tinting pattern), so the
//                           baked shading survives every hue.
//   sprites/rhythm/slot.png  a carved TRACK SLOT: a shallow recess in dark wood
//                           with inner top/left AO and a bottom-right lift, so
//                           empty slots read as a real carved groove instead of
//                           a flat dark rectangle. Filled slots layer block.png
//                           (tinted) on top via CSS.
//
// Same pipeline as the dance / letter-hunt / calc materials: an original
// @napi-rs/canvas bake with seeded value-noise grain and analytic baked
// lighting/AO. No third-party art — everything here is original CC0. Muted,
// sensory-calm palette; matches the shared --stage-back/--stage-floor evening
// tones already used by the musicians decade (#61-62) in app.css.
//   node scripts/gen-rhythm-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT_SPR = new URL('../public/art/sprites/rhythm/', import.meta.url)
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
const grain = makeNoise(20260802)

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
// 1) THE STAGE BACKDROP — muted indigo wall + receding wooden dance floor
// ============================================================================
function bakeStage() {
  const W = 760
  const H = 420
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  const floorTop = H * 0.42 // Dabi's stage is short — wall is a smaller band

  // --- back wall: muted indigo, soft violet glow up top ---
  const wall = ctx.createRadialGradient(W * 0.5, H * 0.02, 30, W * 0.5, H * 0.3, W * 0.75)
  wall.addColorStop(0, '#332a58')
  wall.addColorStop(0.55, '#241f42')
  wall.addColorStop(1, '#191833')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, floorTop + 4)
  // soft violet glow (mirrors --rb-bg's radial tint, baked instead of CSS)
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.08, 10, W * 0.5, H * 0.08, W * 0.5)
  glow.addColorStop(0, 'rgba(129,140,248,0.32)')
  glow.addColorStop(1, 'rgba(129,140,248,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, floorTop + 4)
  // wall/floor seam AO
  const hem = ctx.createLinearGradient(0, floorTop - 34, 0, floorTop + 4)
  hem.addColorStop(0, 'rgba(8,6,20,0)')
  hem.addColorStop(1, 'rgba(8,6,20,0.4)')
  ctx.fillStyle = hem
  ctx.fillRect(0, floorTop - 34, W, 38)

  // --- receding wooden floor (perspective trapezoid) ---
  const topHalf = W * 0.3
  const botHalf = W * 0.62
  const cxb = W / 2
  ctx.beginPath()
  ctx.moveTo(cxb - topHalf, floorTop)
  ctx.lineTo(cxb + topHalf, floorTop)
  ctx.lineTo(cxb + botHalf, H)
  ctx.lineTo(cxb - botHalf, H)
  ctx.closePath()
  ctx.save()
  ctx.clip()

  const WOOD_HI = [96, 84, 128]
  const WOOD_MID = [66, 56, 96]
  const WOOD_LO = [40, 34, 64]
  const fgrad = ctx.createLinearGradient(0, floorTop, 0, H)
  fgrad.addColorStop(0, rgb(WOOD_LO))
  fgrad.addColorStop(0.5, rgb(WOOD_MID))
  fgrad.addColorStop(1, rgb(WOOD_HI))
  ctx.fillStyle = fgrad
  ctx.fillRect(0, floorTop, W, H - floorTop)

  // plank seams converging
  ctx.strokeStyle = 'rgba(14,10,28,0.4)'
  ctx.lineWidth = 1.4
  for (let i = -4; i <= 4; i++) {
    const topX = cxb + (i / 4) * topHalf
    const botX = cxb + (i / 4) * botHalf
    ctx.beginPath()
    ctx.moveTo(topX, floorTop)
    ctx.lineTo(botX, H)
    ctx.stroke()
  }
  // depth bands
  for (let i = 0; i <= 5; i++) {
    const t = i / 5
    const yy = floorTop + Math.pow(t, 1.7) * (H - floorTop)
    ctx.strokeStyle = 'rgba(12,9,26,0.3)'
    ctx.lineWidth = 1 + t * 1.4
    ctx.beginPath()
    ctx.moveTo(0, yy)
    ctx.lineTo(W, yy)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(180,170,220,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, yy + 1.2)
    ctx.lineTo(W, yy + 1.2)
    ctx.stroke()
  }
  for (let k = 0; k < 150; k++) {
    const t = Math.random()
    const yy = floorTop + Math.pow(t, 1.7) * (H - floorTop)
    const len = 14 + Math.random() * 60 * (0.4 + t)
    const x0 = Math.random() * W
    ctx.strokeStyle = grain(k, 3) > 0 ? 'rgba(24,18,44,0.16)' : 'rgba(150,140,190,0.1)'
    ctx.lineWidth = 0.5 + Math.random() * (0.6 + t)
    ctx.beginPath()
    ctx.moveTo(x0, yy)
    ctx.lineTo(x0 + len, yy + (Math.random() - 0.5) * 2)
    ctx.stroke()
  }
  const ao = ctx.createLinearGradient(0, floorTop, 0, floorTop + 40)
  ao.addColorStop(0, 'rgba(8,6,18,0.5)')
  ao.addColorStop(1, 'rgba(8,6,18,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, floorTop, W, 40)
  const spot = ctx.createRadialGradient(cxb, H * 0.92, 8, cxb, H * 0.92, W * 0.36)
  spot.addColorStop(0, 'rgba(255,224,180,0.22)')
  spot.addColorStop(0.55, 'rgba(255,224,180,0.08)')
  spot.addColorStop(1, 'rgba(255,224,180,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, floorTop, W, H - floorTop)
  ctx.restore()

  ctx.strokeStyle = 'rgba(210,200,240,0.2)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(cxb - topHalf, floorTop)
  ctx.lineTo(cxb + topHalf, floorTop)
  ctx.stroke()

  const vig = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.3, W / 2, H * 0.5, H * 1.0)
  vig.addColorStop(0, 'rgba(8,6,16,0)')
  vig.addColorStop(1, 'rgba(8,6,16,0.34)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  grainPass(ctx, W, H, 0.03, 0.9)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('rhythm-stage.jpg'), buf)
  console.log('  ✓ bg/rhythm-stage.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(1) + 'KB')
}

// ============================================================================
// 2) THE BLOCK — a neutral warm-grey rounded cube, tinted per colour via CSS
// ============================================================================
function bakeBlock() {
  const S = 160
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const m = 14
  const w = S - m * 2
  const r = 30

  // drop shadow (sits proud of the palette tray)
  ctx.save()
  ctx.translate(S / 2, S - m + 8)
  ctx.scale(1, 0.3)
  const ds = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5)
  ds.addColorStop(0, 'rgba(6,4,4,0.38)')
  ds.addColorStop(1, 'rgba(6,4,4,0)')
  ctx.fillStyle = ds
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const NEUTRAL = [214, 208, 198] // warm-neutral luminance base — colour comes from the CSS wash
  roundRectPath(ctx, m, m, w, w, r)
  const bg = ctx.createLinearGradient(m, m, m + w, m + w)
  bg.addColorStop(0, rgb(mix(NEUTRAL, [255, 253, 248], 0.5)))
  bg.addColorStop(0.55, rgb(NEUTRAL))
  bg.addColorStop(1, rgb(mix(NEUTRAL, [60, 56, 50], 0.3)))
  ctx.save()
  ctx.fillStyle = bg
  ctx.fill()
  ctx.clip()
  // domed top-left sheen
  const dome = ctx.createRadialGradient(m + w * 0.34, m + w * 0.3, 6, m + w * 0.34, m + w * 0.3, w * 0.95)
  dome.addColorStop(0, 'rgba(255,255,252,0.62)')
  dome.addColorStop(0.55, 'rgba(255,255,252,0.12)')
  dome.addColorStop(1, 'rgba(255,255,252,0)')
  ctx.fillStyle = dome
  ctx.fillRect(m, m, w, w)
  // bottom-right AO so the dome falls away
  const ao = ctx.createLinearGradient(m + w * 0.5, m + w * 0.5, m + w, m + w)
  ao.addColorStop(0, 'rgba(50,44,38,0)')
  ao.addColorStop(1, 'rgba(50,44,38,0.32)')
  ctx.fillStyle = ao
  ctx.fillRect(m, m, w, w)
  // matte micro-speckle
  for (let i = 0; i < 110; i++) {
    const sx = m + Math.random() * w
    const sy = m + Math.random() * w
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,253,248,0.1)' : 'rgba(70,62,52,0.12)'
    ctx.beginPath()
    ctx.arc(sx, sy, 0.5 + Math.random() * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // raised bevel rim: bright top/left, dark bottom/right
  ctx.save()
  roundRectPath(ctx, m, m, w, w, r)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,252,0.75)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(m + 6, m + w - 18)
  ctx.lineTo(m + 6, m + 18)
  ctx.arcTo(m + 6, m + 6, m + 24, m + 6, 18)
  ctx.lineTo(m + w - 18, m + 6)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(40,34,28,0.4)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(m + w - 6, m + 20)
  ctx.lineTo(m + w - 6, m + w - 18)
  ctx.arcTo(m + w - 6, m + w - 6, m + w - 24, m + w - 6, 18)
  ctx.lineTo(m + 22, m + w - 6)
  ctx.stroke()
  ctx.restore()

  grainPass(ctx, S, S, 0.04, 1)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('block.png'), buf)
  console.log('  ✓ block.png', `${S}×${S}`, (buf.length / 1024).toFixed(1) + 'KB')
}

// ============================================================================
// 3) THE SLOT — a shallow carved recess in dark wood (empty track cell)
// ============================================================================
function bakeSlot() {
  const S = 160
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const m = 6
  const w = S - m * 2
  const r = 18

  const BASE = [24, 22, 44]
  roundRectPath(ctx, m, m, w, w, r)
  const bg = ctx.createLinearGradient(m, m, m + w, m + w)
  bg.addColorStop(0, rgb(mix(BASE, [4, 4, 12], 0.3)))
  bg.addColorStop(1, rgb(mix(BASE, [50, 46, 78], 0.25)))
  ctx.save()
  ctx.fillStyle = bg
  ctx.fill()
  ctx.clip()

  // inner top/left AO (the recess casts its own shade)
  const aoT = ctx.createLinearGradient(0, m, 0, m + w * 0.3)
  aoT.addColorStop(0, 'rgba(2,2,8,0.6)')
  aoT.addColorStop(1, 'rgba(2,2,8,0)')
  ctx.fillStyle = aoT
  ctx.fillRect(m, m, w, w * 0.3)
  const aoL = ctx.createLinearGradient(m, 0, m + w * 0.26, 0)
  aoL.addColorStop(0, 'rgba(2,2,8,0.5)')
  aoL.addColorStop(1, 'rgba(2,2,8,0)')
  ctx.fillStyle = aoL
  ctx.fillRect(m, m, w * 0.26, w)
  // bottom-right lift (the recess catches a little light at its lip)
  const lift = ctx.createLinearGradient(m + w * 0.6, m + w * 0.6, m + w, m + w)
  lift.addColorStop(0, 'rgba(160,150,200,0)')
  lift.addColorStop(1, 'rgba(160,150,200,0.16)')
  ctx.fillStyle = lift
  ctx.fillRect(m, m, w, w)
  // faint grain
  for (let i = 0; i < 60; i++) {
    const sx = m + Math.random() * w
    const sy = m + Math.random() * w
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120,112,160,0.06)' : 'rgba(4,4,10,0.1)'
    ctx.beginPath()
    ctx.arc(sx, sy, 0.5 + Math.random() * 1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // crisp recess edge
  ctx.save()
  roundRectPath(ctx, m, m, w, w, r)
  ctx.lineWidth = 2
  const edge = ctx.createLinearGradient(m, m, m + w, m + w)
  edge.addColorStop(0, 'rgba(2,2,6,0.7)')
  edge.addColorStop(0.5, 'rgba(2,2,6,0.15)')
  edge.addColorStop(1, 'rgba(180,170,220,0.28)')
  ctx.strokeStyle = edge
  ctx.stroke()
  ctx.restore()

  grainPass(ctx, S, S, 0.03, 1)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('slot.png'), buf)
  console.log('  ✓ slot.png', `${S}×${S}`, (buf.length / 1024).toFixed(1) + 'KB')
}

console.log('Baking rhythm art →')
bakeStage()
bakeBlock()
bakeSlot()
console.log('Done.')
