// Bakes the "האות שלי מדברת" materials — a REAL painted-wooden alphabet BLOCK the
// Hebrew letter sits on, NOT a flat CSS square+gradient.
//
// Market survey (commercial talking-alphabet toys): LeapFrog Letter Factory turns
// each letter into a friendly little CHARACTER; the calmest, most tactile physical
// toys are painted WOODEN alphabet blocks (Bannor "Boho color", Montessori maple)
// — chunky, matte, muted, softened edges. So the hero here is a chunky painted-wood
// block seen at a gentle 3/4 camera angle (lit top face + shaded right face for
// real depth), with baked wood grain, a matte paint finish, an edge bevel, ambient
// occlusion and a soft baked contact shadow so it RESTS on a surface. Eight muted
// boho tints (one per letter, stable by index) keep every letter a consistent
// little character. The HEBREW GLYPH itself is NOT baked — the runtime lays razor
// crisp CSS TEXT over the block's flat FRONT FACE (a known sub-rect, FX0/FY0/FS
// below, mirrored in app.css) so the letter is always pixel-sharp and legible.
//
// Also baked: a pair of glossy googly EYES (the toy's face — plastic dome, catch-
// light, AO; a separate closed "sleeping" lid for the asleep/blink states) and a
// wooden PLINTH the block stands on (extra grounding + a place for its shadow).
//
// Same pipeline as the dice / coin-sort materials: an original @napi-rs/canvas bake
// with seeded value-noise grain and analytic baked lighting/AO. No third-party art.
// One-off build tool (canvas is already installed & pinned — do NOT reinstall):
//   node scripts/gen-lettertalk-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/lettertalk/', import.meta.url)
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
const woodN = makeNoise(773311)

// ============================================================================
// THE BLOCK — a chunky painted-wooden cube seen at a 3/4 angle. Front face (where
// the CSS glyph lands) is an axis-aligned rounded square at FX0/FY0/FS; the top &
// right faces recede up-right (DX/DY) for real depth. `base` = the painted tint.
// The FRONT-FACE rect MUST stay in lock-step with app.css .lt-block vars so the
// crisp CSS letter + eyes overlay exactly.
// ============================================================================
const S = 256
const FX0 = 0.115 // front face left   (fraction of S) — mirrored in app.css
const FY0 = 0.275 // front face top
const FS = 0.605 // front face size
const DX = 0.165 // depth: how far the top/right faces recede to the right
const DY = 0.165 // …and upward

function bakeBlock(base, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')

  const fx = FX0 * S
  const fy = FY0 * S
  const fs = FS * S
  const dx = DX * S
  const dy = DY * S
  const r = fs * 0.14 // corner radius — softened, toy-block edges

  const top = mix(base, [255, 255, 255], 0.2) // lit top face
  const topHi = mix(base, [255, 255, 255], 0.34)
  const right = mix(base, [46, 42, 58], 0.34) // shaded right face
  const rightDk = mix(base, [34, 30, 44], 0.5)

  // --- baked contact shadow on the surface under the block ---
  ctx.save()
  const shY = (FY0 + FS) * S - fs * 0.01
  ctx.translate(fx + fs * 0.54, shY + fs * 0.1)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, fs * 0.66)
  sh.addColorStop(0, 'rgba(28,22,16,0.34)')
  sh.addColorStop(0.6, 'rgba(28,22,16,0.17)')
  sh.addColorStop(1, 'rgba(28,22,16,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, fs * 0.66, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- RIGHT face (parallelogram receding up-right) ---
  ctx.beginPath()
  ctx.moveTo(fx + fs, fy + r * 0.3)
  ctx.lineTo(fx + fs + dx, fy - dy + r * 0.3)
  ctx.lineTo(fx + fs + dx, fy + fs - dy - r * 0.3)
  ctx.lineTo(fx + fs, fy + fs - r * 0.3)
  ctx.closePath()
  let g = ctx.createLinearGradient(fx + fs, fy, fx + fs + dx, fy + fs - dy)
  g.addColorStop(0, rgb(right))
  g.addColorStop(1, rgb(rightDk))
  ctx.fillStyle = g
  ctx.fill()

  // --- TOP face (parallelogram receding up-right) ---
  ctx.beginPath()
  ctx.moveTo(fx + r * 0.3, fy)
  ctx.lineTo(fx + fs - r * 0.3, fy)
  ctx.lineTo(fx + fs + dx - r * 0.3, fy - dy)
  ctx.lineTo(fx + dx + r * 0.3, fy - dy)
  ctx.closePath()
  g = ctx.createLinearGradient(fx, fy, fx + dx, fy - dy)
  g.addColorStop(0, rgb(top))
  g.addColorStop(1, rgb(topHi))
  ctx.fillStyle = g
  ctx.fill()
  // lit seam where the top face meets the front
  ctx.strokeStyle = rgb(mix(base, [255, 255, 255], 0.55), 0.5)
  ctx.lineWidth = S * 0.006
  ctx.beginPath()
  ctx.moveTo(fx + r * 0.4, fy)
  ctx.lineTo(fx + fs - r * 0.4, fy)
  ctx.stroke()

  // --- FRONT face (rounded square) — even key-light so the glyph stays legible ---
  roundRectPath(ctx, fx, fy, fs, fs, r)
  g = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.22))) // lit top-left
  g.addColorStop(0.55, rgb(base))
  g.addColorStop(1, rgb(mix(base, [34, 30, 44], 0.14))) // gentle AO bottom-right
  ctx.save()
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()
  // soft top-left key-light bloom (kept subtle — legibility first)
  const bloom = ctx.createRadialGradient(fx + fs * 0.3, fy + fs * 0.26, 0, fx + fs * 0.3, fy + fs * 0.26, fs * 0.95)
  bloom.addColorStop(0, 'rgba(255,255,255,0.2)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(fx, fy, fs, fs)
  const ao = ctx.createRadialGradient(fx + fs * 0.84, fy + fs * 0.86, fs * 0.1, fx + fs * 0.84, fy + fs * 0.86, fs * 0.95)
  ao.addColorStop(0, 'rgba(28,24,34,0.16)')
  ao.addColorStop(1, 'rgba(28,24,34,0)')
  ctx.fillStyle = ao
  ctx.fillRect(fx, fy, fs, fs)
  ctx.restore()

  // --- crisp bevel rim on the front face (bright top-left, dark bottom-right) ---
  ctx.save()
  roundRectPath(ctx, fx + 1, fy + 1, fs - 2, fs - 2, r - 1)
  ctx.clip()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.stroke()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.clip()
  roundRectPath(ctx, fx + fs * 0.02, fy + fs * 0.05, fs, fs, r)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(30,26,38,0.16)'
  ctx.stroke()
  ctx.restore()

  // --- wood grain + matte paint texture over every painted pixel (kills "flat CSS") ---
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      // streaky vertical wood grain (anisotropic) + fine matte speckle. Kept
      // low-frequency so the PNG stays small (high-freq noise = big files).
      const wood = woodN(x * 0.06, y * 0.7) * 0.5 + woodN(x * 0.12, y * 1.3) * 0.3
      const fine = grain(x * 0.9, y * 0.9) * 0.35
      const m = 1 + wood * 0.05 + fine * 0.022
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE EYES — a glossy plastic googly eye (open) and a soft closed "sleeping" lid.
// Neutral tones so they read on every block tint. Transparent background.
// ============================================================================
const ES = 128
function bakeEyeOpen() {
  const cv = createCanvas(ES, ES)
  const ctx = cv.getContext('2d')
  const cx = ES * 0.5
  const cy = ES * 0.5
  const R = ES * 0.42

  // soft contact shadow where the dome meets the block (bottom)
  ctx.save()
  ctx.translate(cx, cy + R * 0.72)
  ctx.scale(1, 0.34)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9)
  sh.addColorStop(0, 'rgba(20,16,12,0.28)')
  sh.addColorStop(1, 'rgba(20,16,12,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // the white plastic dome — shaded so it reads as a sphere, not a flat disc
  let g = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.36, R * 0.1, cx, cy, R)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.7, 'rgba(240,240,246,1)')
  g.addColorStop(1, 'rgba(206,206,220,1)') // AO rim
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  // the pupil — calm dark navy, offset a touch down-right (a friendly gaze)
  const px = cx + R * 0.08
  const py = cy + R * 0.12
  const pr = R * 0.46
  g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.34, pr * 0.1, px, py, pr)
  g.addColorStop(0, 'rgba(64,60,86,1)')
  g.addColorStop(0.6, 'rgba(42,38,58,1)')
  g.addColorStop(1, 'rgba(28,25,40,1)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(px, py, pr, 0, Math.PI * 2)
  ctx.fill()

  // bright glass catchlight (top-left) + a tiny secondary sparkle
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.beginPath()
  ctx.arc(px - pr * 0.36, py - pr * 0.4, pr * 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.beginPath()
  ctx.arc(px + pr * 0.34, py + pr * 0.34, pr * 0.12, 0, Math.PI * 2)
  ctx.fill()

  // crisp rim highlight on the dome (top-left)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = ES * 0.02
  ctx.beginPath()
  ctx.arc(cx, cy, R - ES * 0.01, Math.PI * 0.85, Math.PI * 1.5)
  ctx.stroke()

  writeFileSync(file('eye-open.png'), cv.toBuffer('image/png'))
  console.log('  ✓ eye-open.png', `${ES}×${ES}`)
}

function bakeEyeLid() {
  const cv = createCanvas(ES, ES)
  const ctx = cv.getContext('2d')
  const cx = ES * 0.5
  const cy = ES * 0.52
  const w = ES * 0.4
  // a gentle sleepy closed eye: a soft downward lash curve with a thin lid highlight
  ctx.lineCap = 'round'
  // lid shadow (thicker, soft)
  ctx.strokeStyle = 'rgba(30,26,38,0.28)'
  ctx.lineWidth = ES * 0.14
  ctx.beginPath()
  ctx.moveTo(cx - w, cy - ES * 0.02)
  ctx.quadraticCurveTo(cx, cy + ES * 0.14, cx + w, cy - ES * 0.02)
  ctx.stroke()
  // the lash line (crisp, calm dark navy)
  ctx.strokeStyle = 'rgba(44,40,58,0.95)'
  ctx.lineWidth = ES * 0.08
  ctx.beginPath()
  ctx.moveTo(cx - w, cy)
  ctx.quadraticCurveTo(cx, cy + ES * 0.16, cx + w, cy)
  ctx.stroke()
  // a thin catch of light on the lid above the lash
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = ES * 0.03
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.8, cy - ES * 0.06)
  ctx.quadraticCurveTo(cx, cy + ES * 0.04, cx + w * 0.8, cy - ES * 0.06)
  ctx.stroke()

  writeFileSync(file('eye-lid.png'), cv.toBuffer('image/png'))
  console.log('  ✓ eye-lid.png', `${ES}×${ES}`)
}

// ============================================================================
// THE PLINTH — a low wooden stand the block rests on. A rounded slab seen at the
// same 3/4 angle: lit top surface + shaded front lip + baked contact shadow.
// ============================================================================
function bakePlinth() {
  const W = 420
  const H = 200
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const wood = [150, 112, 76] // muted warm wood, matches the playroom shelf
  const topC = mix(wood, [255, 240, 210], 0.28)
  const frontC = mix(wood, [40, 26, 16], 0.28)
  const frontDk = mix(wood, [30, 18, 10], 0.45)

  const px = W * 0.12
  const pw = W * 0.76
  const topY = H * 0.3
  const topH = H * 0.2 // ellipse thickness of the top surface
  const frontH = H * 0.34
  const rad = H * 0.1

  // contact shadow on the floor beneath
  ctx.save()
  ctx.translate(W * 0.5, topY + topH + frontH + H * 0.02)
  ctx.scale(1, 0.32)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, pw * 0.6)
  sh.addColorStop(0, 'rgba(24,18,12,0.32)')
  sh.addColorStop(1, 'rgba(24,18,12,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, pw * 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // front lip
  roundRectPath(ctx, px, topY + topH * 0.5, pw, frontH, rad)
  let g = ctx.createLinearGradient(0, topY, 0, topY + topH + frontH)
  g.addColorStop(0, rgb(frontC))
  g.addColorStop(1, rgb(frontDk))
  ctx.fillStyle = g
  ctx.fill()

  // top surface (an ellipse cap so it reads as a 3/4 slab)
  g = ctx.createLinearGradient(px, topY, px + pw, topY + topH)
  g.addColorStop(0, rgb(mix(topC, [255, 255, 255], 0.14)))
  g.addColorStop(1, rgb(mix(topC, [40, 26, 16], 0.12)))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(W * 0.5, topY + topH * 0.5, pw * 0.5, topH * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // lit front edge of the top surface
  ctx.strokeStyle = 'rgba(255,246,224,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(W * 0.5, topY + topH * 0.5, pw * 0.5, topH * 0.7, 0, 0, Math.PI)
  ctx.stroke()

  // wood grain over the whole plinth
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const m = 1 + (woodN(x * 0.05, y * 0.6) * 0.5 + grain(x * 1.4, y * 1.4) * 0.35) * 0.05
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  ctx.putImageData(img, 0, 0)

  writeFileSync(file('plinth.png'), cv.toBuffer('image/png'))
  console.log('  ✓ plinth.png', `${W}×${H}`)
}

// ---- muted boho block tints (calm, desaturated — one stable colour per letter) --
const TINTS = [
  [178, 160, 205], // lavender
  [162, 188, 152], // sage
  [208, 170, 178], // dusty rose
  [152, 178, 208], // muted blue
  [214, 186, 136], // soft ochre
  [142, 188, 186], // muted teal
  [206, 160, 140], // clay
  [182, 158, 192], // soft plum
]
console.log('Baking lettertalk art →')
TINTS.forEach((t, i) => bakeBlock(t, `block-${i}.png`))
bakeEyeOpen()
bakeEyeLid()
bakePlinth()
console.log('Done.')
