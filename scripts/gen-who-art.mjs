// Bakes the "מי נעלם?" (Who's missing?) materials as REAL raster art with baked
// soft lighting + grain/AO — never flat CSS shapes. A little PUPPET THEATRE:
//
//   • stage.png   — a warm wooden stage PLATFORM in perspective (a receding top
//                   face + a thick front lip for depth). The friends stand
//                   grounded on its near edge; the camera looks slightly down at
//                   it, so the lineup reads 3D, not a flat CSS row.
//   • curtain.png — a muted VELVET theatre curtain (baked vertical folds, a top
//                   valance swag, a scalloped hem, key light + AO). It sweeps down
//                   to cover the whole stage for the "hide" beat, then lifts —
//                   the classic peekaboo reveal.
//   • box.png     — a friendly wooden TOY BOX the missing friend ducks behind
//                   (raised bevel, grain, a soft open-lid hint, a baked contact
//                   shadow). Marks the empty spot in the "guess" beat.
//
// Same pipeline as the dice / coin-sort / bowling materials: an original
// @napi-rs/canvas bake with seeded value-noise material grain and analytic baked
// lighting/AO. No third-party art — everything here is original CC0. Muted,
// sensory-calm warm-oak + dusty-rose palette. One-off build tool:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-who-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/who/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same as dice) ---
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
  const lerpn = (a, b, t) => a + t * (b - a)
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
    const x1 = lerpn(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerpn(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerpn(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const R = (n) => (Math.random() - 0.5) * n

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const grain = makeNoise(20260718)
// stamp the fbm material grain over every painted pixel (kills the "flat CSS" read)
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
// THE STAGE — a warm wooden platform in perspective. A receding TOP face
// (trapezoid: far edge narrower/darker, near edge wider/lit) the friends stand
// on, and a thick FRONT LIP so it reads as a solid raised stage, not a flat
// panel. Baked plank grain, converging seams, far-edge AO, near-edge highlight.
// ============================================================================
function bakeStage(name) {
  const W = 560
  const H = 224
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const OAK = [168, 124, 74]
  const OAK_DK = [120, 84, 46]
  const OAK_LT = [196, 150, 96]

  const topY = 26 // far (back) edge of the stage top
  const botY = 158 // near (front) edge of the stage top
  const topHalf = 222 // half-width of the far edge (narrower → perspective)
  const botHalf = 270 // half-width of the near edge (wider)
  const lipH = 34 // front lip thickness

  // --- soft ground shadow beneath the whole stage ---
  x.save()
  x.translate(cxb, botY + lipH + 6)
  x.scale(1, 0.26)
  const gsh = x.createRadialGradient(0, 0, 0, 0, 0, botHalf + 24)
  gsh.addColorStop(0, 'rgba(28,18,8,0.34)')
  gsh.addColorStop(1, 'rgba(28,18,8,0)')
  x.fillStyle = gsh
  x.beginPath()
  x.arc(0, 0, botHalf + 24, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // --- TOP face (receding trapezoid) ---
  x.beginPath()
  x.moveTo(cxb - topHalf, topY)
  x.lineTo(cxb + topHalf, topY)
  x.lineTo(cxb + botHalf, botY)
  x.lineTo(cxb - botHalf, botY)
  x.closePath()
  x.save()
  x.clip()
  const g = x.createLinearGradient(0, topY, 0, botY)
  g.addColorStop(0, rgb(OAK_DK)) // far = darker
  g.addColorStop(1, rgb(OAK_LT)) // near = lit
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  // horizontal plank grain, in perspective (wider spread toward the near edge)
  for (let i = 0; i < 34; i++) {
    const yy = topY + Math.random() * (botY - topY)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,86,48,0.22)' : 'rgba(214,182,136,0.24)'
    x.lineWidth = 0.8 + Math.random() * 2.2
    x.beginPath()
    x.moveTo(cxb - botHalf, yy)
    for (let sx = -botHalf; sx <= botHalf; sx += 40) x.lineTo(cxb + sx, yy + R(5))
    x.stroke()
  }
  // plank seams converging toward the far edge (perspective lines)
  x.strokeStyle = 'rgba(74,50,24,0.4)'
  x.lineWidth = 2
  for (const frac of [-0.62, -0.3, 0, 0.3, 0.62]) {
    x.beginPath()
    x.moveTo(cxb + frac * topHalf, topY)
    x.lineTo(cxb + frac * botHalf, botY)
    x.stroke()
  }
  // far-edge ambient occlusion (the back of the stage sits in shade)
  const ao = x.createLinearGradient(0, topY, 0, topY + 44)
  ao.addColorStop(0, 'rgba(48,30,12,0.5)')
  ao.addColorStop(1, 'rgba(48,30,12,0)')
  x.fillStyle = ao
  x.fillRect(0, topY, W, 44)
  // soft top-left key light pooling on the boards
  const kl = x.createRadialGradient(cxb - 90, botY - 30, 16, cxb - 90, botY - 30, 320)
  kl.addColorStop(0, 'rgba(255,244,220,0.20)')
  kl.addColorStop(1, 'rgba(255,244,220,0)')
  x.fillStyle = kl
  x.fillRect(0, 0, W, H)
  x.restore()

  // --- FRONT LIP (the stage's thickness) ---
  x.beginPath()
  x.moveTo(cxb - botHalf, botY)
  x.lineTo(cxb + botHalf, botY)
  x.lineTo(cxb + botHalf, botY + lipH)
  x.lineTo(cxb - botHalf, botY + lipH)
  x.closePath()
  x.save()
  x.clip()
  const lg = x.createLinearGradient(0, botY, 0, botY + lipH)
  lg.addColorStop(0, rgb(mix(OAK, [255, 255, 255], 0.06)))
  lg.addColorStop(1, rgb(mix(OAK_DK, [20, 12, 4], 0.3)))
  x.fillStyle = lg
  x.fillRect(0, botY, W, lipH)
  // vertical grain on the front board
  for (let i = 0; i < 40; i++) {
    const gx = cxb - botHalf + Math.random() * (botHalf * 2)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(228,196,148,0.18)' : 'rgba(60,38,16,0.24)'
    x.lineWidth = 0.7 + Math.random() * 1.8
    x.beginPath()
    x.moveTo(gx, botY)
    x.lineTo(gx + R(3), botY + lipH)
    x.stroke()
  }
  x.restore()
  // crisp lit near-edge (top of the lip catches the light)
  x.strokeStyle = 'rgba(255,240,210,0.85)'
  x.lineWidth = 2.5
  x.beginPath()
  x.moveTo(cxb - botHalf, botY)
  x.lineTo(cxb + botHalf, botY)
  x.stroke()
  // dark base line under the lip
  x.strokeStyle = 'rgba(30,18,6,0.5)'
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(cxb - botHalf, botY + lipH)
  x.lineTo(cxb + botHalf, botY + lipH)
  x.stroke()

  grainPass(x, W, H, 0.045)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE CURTAIN — a muted velvet theatre drape. A top VALANCE swag, tall vertical
// FOLDS (baked light/shadow bands), and a scalloped hem. Slides down to cover
// the stage, lifts for the reveal. Dusty-rose velvet, sensory-muted.
// ============================================================================
function bakeCurtain(name) {
  const W = 560
  const H = 300
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')

  const VEL = [174, 132, 144] // muted dusty-rose velvet
  const VEL_DK = [120, 84, 96]
  const VEL_LT = [206, 168, 178]
  const folds = 11
  const fw = W / folds
  const valH = 50 // valance height
  const hemDrop = 18 // how deep the scalloped hem dips

  // base flat fill so the transparent PNG has no seams between folds
  x.fillStyle = rgb(mix(VEL, VEL_DK, 0.2))
  x.fillRect(0, valH * 0.5, W, H)

  // --- MAIN DRAPE: vertical folds as light→shadow gradient bands ---
  for (let i = 0; i < folds; i++) {
    const fx = i * fw
    const g = x.createLinearGradient(fx, 0, fx + fw, 0)
    g.addColorStop(0, rgb(VEL_DK)) // fold trough (shadowed)
    g.addColorStop(0.42, rgb(VEL_LT)) // fold crest (lit)
    g.addColorStop(0.5, rgb(mix(VEL, VEL_LT, 0.5)))
    g.addColorStop(0.6, rgb(VEL))
    g.addColorStop(1, rgb(VEL_DK)) // next trough
    x.fillStyle = g
    // the fold column drops to a scalloped bottom (a soft arc dipping at centre)
    x.beginPath()
    x.moveTo(fx, valH * 0.5)
    x.lineTo(fx + fw, valH * 0.5)
    x.lineTo(fx + fw, H - hemDrop)
    x.quadraticCurveTo(fx + fw / 2, H + hemDrop * 0.7, fx, H - hemDrop)
    x.closePath()
    x.fill()
  }

  // top-down key light across the whole drape (top lit, deep hem AO)
  const kl = x.createLinearGradient(0, valH * 0.5, 0, H)
  kl.addColorStop(0, 'rgba(255,246,240,0.20)')
  kl.addColorStop(0.5, 'rgba(255,246,240,0)')
  kl.addColorStop(1, 'rgba(40,22,30,0.30)')
  x.fillStyle = kl
  x.fillRect(0, valH * 0.5, W, H)

  // --- VALANCE (the top swag), scalloped along its lower edge ---
  const swags = 6
  const sw = W / swags
  x.beginPath()
  x.moveTo(0, 0)
  x.lineTo(W, 0)
  x.lineTo(W, valH * 0.5)
  for (let i = swags; i > 0; i--) {
    const x0 = i * sw
    x.quadraticCurveTo(x0 - sw / 2, valH + 10, x0 - sw, valH * 0.5)
  }
  x.closePath()
  x.save()
  x.clip()
  const vg = x.createLinearGradient(0, 0, 0, valH + 10)
  vg.addColorStop(0, rgb(VEL_LT))
  vg.addColorStop(1, rgb(VEL_DK))
  x.fillStyle = vg
  x.fillRect(0, 0, W, valH + 12)
  // swag folds
  for (let i = 0; i < swags; i++) {
    const cx = i * sw + sw * 0.5
    const s = x.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0)
    s.addColorStop(0, 'rgba(60,34,44,0.28)')
    s.addColorStop(0.5, 'rgba(255,246,248,0.14)')
    s.addColorStop(1, 'rgba(60,34,44,0.28)')
    x.fillStyle = s
    x.fillRect(cx - sw / 2, 0, sw, valH + 12)
  }
  x.restore()
  // a soft muted-gold trim line under the valance scallops
  x.strokeStyle = 'rgba(214,188,140,0.5)'
  x.lineWidth = 2.5
  x.beginPath()
  for (let i = swags; i > 0; i--) {
    const x0 = i * sw
    if (i === swags) x.moveTo(x0, valH * 0.5)
    x.quadraticCurveTo(x0 - sw / 2, valH + 10, x0 - sw, valH * 0.5)
  }
  x.stroke()

  grainPass(x, W, H, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE TOY BOX — a friendly wooden chest the missing friend ducks behind. Raised
// bevel, warm grain, a soft open-lid hint at the back, a baked contact shadow.
// ============================================================================
function bakeBox(name) {
  const S = 200
  const cv = createCanvas(S, S)
  const x = cv.getContext('2d')

  const OAK = [176, 130, 78]
  const OAK_DK = [122, 84, 46]
  const OAK_LT = [210, 166, 112]
  const bx = 25
  const by = 66
  const bw = S - 2 * bx
  const bh = 100
  const r = 18
  const depth = 20 // lid depth up-right

  // contact shadow
  x.save()
  x.translate(S / 2, by + bh + 6)
  x.scale(1, 0.28)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, bw * 0.62)
  sh.addColorStop(0, 'rgba(24,16,8,0.34)')
  sh.addColorStop(1, 'rgba(24,16,8,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, bw * 0.62, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // open LID lifted at the back (a peekaboo hint), receding up-right
  x.beginPath()
  x.moveTo(bx + 6, by)
  x.lineTo(bx + bw - 6, by)
  x.lineTo(bx + bw - 6 + depth, by - depth - 10)
  x.lineTo(bx + 6 + depth, by - depth - 10)
  x.closePath()
  let g = x.createLinearGradient(bx, by - depth, bx, by)
  g.addColorStop(0, rgb(OAK_LT))
  g.addColorStop(1, rgb(mix(OAK, OAK_DK, 0.4)))
  x.fillStyle = g
  x.fill()
  // dark inner rim of the open box (below the lid)
  x.fillStyle = rgb(mix(OAK_DK, [18, 10, 4], 0.5))
  x.fillRect(bx + 8, by - 2, bw - 16, 10)

  // FRONT face (rounded chest body)
  roundRectPath(x, bx, by, bw, bh, r)
  x.save()
  x.clip()
  g = x.createLinearGradient(bx, by, bx, by + bh)
  g.addColorStop(0, rgb(mix(OAK, [255, 255, 255], 0.14)))
  g.addColorStop(0.5, rgb(OAK))
  g.addColorStop(1, rgb(mix(OAK_DK, [20, 12, 4], 0.18)))
  x.fillStyle = g
  x.fillRect(bx, by, bw, bh)
  // vertical plank grain
  for (let i = 0; i < 34; i++) {
    const gx = bx + Math.random() * bw
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(232,198,150,0.2)' : 'rgba(58,36,16,0.24)'
    x.lineWidth = 0.7 + Math.random() * 1.9
    x.beginPath()
    x.moveTo(gx, by)
    x.lineTo(gx + R(3), by + bh)
    x.stroke()
  }
  // two plank seams
  x.strokeStyle = 'rgba(58,36,16,0.3)'
  x.lineWidth = 2
  for (const fy of [by + bh * 0.36, by + bh * 0.68]) {
    x.beginPath()
    x.moveTo(bx, fy)
    x.lineTo(bx + bw, fy)
    x.stroke()
  }
  // top-left key light + bottom-right AO
  const hl = x.createRadialGradient(bx + bw * 0.3, by + bh * 0.26, 6, bx + bw * 0.3, by + bh * 0.26, bw * 0.8)
  hl.addColorStop(0, 'rgba(255,246,224,0.4)')
  hl.addColorStop(1, 'rgba(255,246,224,0)')
  x.fillStyle = hl
  x.fillRect(bx, by, bw, bh)
  const bao = x.createRadialGradient(bx + bw * 0.76, by + bh * 0.82, 8, bx + bw * 0.76, by + bh * 0.82, bw * 0.85)
  bao.addColorStop(0, 'rgba(40,24,10,0.3)')
  bao.addColorStop(1, 'rgba(40,24,10,0)')
  x.fillStyle = bao
  x.fillRect(bx, by, bw, bh)
  x.restore()

  // raised bevel: light top-left → dark bottom-right
  const bev = x.createLinearGradient(bx, by, bx + bw, by + bh)
  bev.addColorStop(0, 'rgba(255,247,228,0.7)')
  bev.addColorStop(0.48, 'rgba(255,247,228,0.04)')
  bev.addColorStop(0.52, 'rgba(56,36,14,0.05)')
  bev.addColorStop(1, 'rgba(56,36,14,0.6)')
  x.lineWidth = 4
  x.strokeStyle = bev
  roundRectPath(x, bx + 2, by + 2, bw - 4, bh - 4, r - 2)
  x.stroke()

  grainPass(x, S, S, 0.045)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking who-is-missing art →')
bakeStage('stage.png')
bakeCurtain('curtain.png')
bakeBox('box.png')
console.log('Done.')
