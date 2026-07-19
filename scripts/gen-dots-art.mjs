// Bakes the "חיבור נקודות" (connect-the-dots) materials — a REAL worksheet:
// paper with fibre grain + baked lighting, hand-drawn crayon dot rings, a small
// connected marker, washi tape to ground the sheet on the desk, and a calm
// art-room desk backdrop. NOT flat CSS — every surface is a seeded-noise bake
// with analytic lighting/AO, the same pipeline as the dice / coin-sort / shelf
// materials. No third-party art.
//
//   node scripts/gen-dots-art.mjs
//
// Runtime keeps the crisp NUMBERS as CSS text over the baked dot ring (razor
// legible), and draws the connecting stroke as an SVG crayon path (roughened +
// waxy) — those are render materials, not flat CSS panels. The dot GEOMETRY
// (measured from the friend's bumps) is untouched.

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/dots/', import.meta.url)
const BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT, { recursive: true })
mkdirSync(BG, { recursive: true })
const winPath = (u) => new URL(u).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const file = (name) => winPath(new URL(name, OUT))
const bgFile = (name) => winPath(new URL(name, BG))

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

const grain = makeNoise(20260718)
const fbm = (nz, x, y) =>
  nz(x, y) * 0.6 + nz(x * 2.1, y * 2.1) * 0.28 + nz(x * 4.3, y * 4.3) * 0.12

// ---- calm, muted palette (sensory rule) -------------------------------------
const PAPER = [245, 240, 229] // warm worksheet cream
const CRAYON = [98, 116, 150] // muted slate-blue guide crayon (calm, legible)
const CRAYON_DK = [70, 86, 118]
const DONE = [126, 170, 132] // muted sage — a calm "connected" marker
const TAPE = [226, 205, 176] // warm translucent washi
const OAK = [176, 150, 118] // muted oak desk

function circlePath(ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
}

// ============================================================================
// PAPER — the worksheet sheet. Warm cream with baked paper fibre, low-freq
// handmade mottle, and a soft top-left key light + edge vignette so it reads as
// a real lit sheet (used as a cover background under the dots).
// ============================================================================
function bakePaper() {
  const W = 900
  const H = 900
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = rgb(PAPER)
  ctx.fillRect(0, 0, W, H)

  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  const cx = W * 0.4
  const cy = H * 0.34
  const maxD = Math.hypot(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      // fine paper fibre (two octaves) + a low-freq handmade mottle
      const fibre = grain(x * 0.9, y * 0.9) * 0.5 + grain(x * 2.7, y * 2.7) * 0.5
      const mottle = fbm(grain, x * 0.012, y * 0.012)
      // soft radial key light (lighter near top-left) → vignette to the edges
      const dist = Math.hypot(x - cx, y - cy) / maxD
      const light = 0.05 - dist * 0.13
      const m = 1 + fibre * 0.028 + mottle * 0.05 + light
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * (m - 0.004), 0, 255) // keep it a touch warm
    }
  }
  ctx.putImageData(img, 0, 0)

  // a few faint darker fibre flecks — the tell of real paper
  const fr = mulberry32(7788)
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 260; i++) {
    const x = fr() * W
    const y = fr() * H
    const len = 2 + fr() * 7
    ctx.strokeStyle = rgb(mix(PAPER, [120, 110, 96], 1), 1)
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (fr() - 0.5) * len, y + (fr() - 0.5) * len)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // gentle corner vignette so the sheet feels lit & grounded
  const vg = ctx.createRadialGradient(W * 0.42, H * 0.36, W * 0.2, W * 0.5, H * 0.5, W * 0.72)
  vg.addColorStop(0, 'rgba(120,100,70,0)')
  vg.addColorStop(1, 'rgba(120,100,70,0.12)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(file('paper.jpg'), buf)
  console.log('  ✓ paper.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// DOT RING — a hand-drawn crayon circle that holds a crisp CSS number. Baked
// with a pressed-into-paper AO, a slightly wobbly waxy ring (many short jittered
// strokes), a soft cream centre for legibility, and a top-left highlight.
// `filled` bakes the small "connected" marker instead (a waxy sage disc).
// ============================================================================
function bakeDot(name, base, filled) {
  const S = 96
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const R = filled ? S * 0.3 : S * 0.34

  // pressed-into-paper AO ring just outside the crayon
  const ao = ctx.createRadialGradient(cx, cy + 1.5, R * 0.7, cx, cy + 1.5, R * 1.5)
  ao.addColorStop(0, 'rgba(60,50,40,0)')
  ao.addColorStop(0.72, 'rgba(60,50,40,0.14)')
  ao.addColorStop(1, 'rgba(60,50,40,0)')
  ctx.fillStyle = ao
  circlePath(ctx, cx, cy + 1.5, R * 1.5)
  ctx.fill()

  if (filled) {
    // waxy disc: radial body, lit top-left, darker rim bottom-right
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
    g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.42)))
    g.addColorStop(0.6, rgb(base))
    g.addColorStop(1, rgb(mix(base, [30, 40, 30], 0.32)))
    ctx.fillStyle = g
    circlePath(ctx, cx, cy, R)
    ctx.fill()
    // soft top-left sheen
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    circlePath(ctx, cx - R * 0.32, cy - R * 0.34, R * 0.26)
    ctx.fill()
  } else {
    // cream fill so the dark number stays razor-legible on any friend colour
    const fill = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.15, cx, cy, R)
    fill.addColorStop(0, 'rgba(255,253,247,0.98)')
    fill.addColorStop(1, 'rgba(246,241,230,0.96)')
    ctx.fillStyle = fill
    circlePath(ctx, cx, cy, R)
    ctx.fill()

    // crayon ring — many short jittered arcs give a waxy, hand-drawn wobble
    const jr = mulberry32(4242)
    const segs = 120
    ctx.lineCap = 'round'
    for (let pass = 0; pass < 2; pass++) {
      const col = pass === 0 ? mix(base, [255, 255, 255], 0.25) : base
      ctx.strokeStyle = rgb(col, pass === 0 ? 0.5 : 0.92)
      ctx.lineWidth = pass === 0 ? 5.4 : 3.6
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2
        const a1 = ((i + 1.4) / segs) * Math.PI * 2
        const wob = (fbm(grain, Math.cos(a0) * 3 + pass * 9, Math.sin(a0) * 3) ) * 1.6
        const rr = R + wob + (jr() - 0.5) * 0.8
        ctx.beginPath()
        ctx.arc(cx, cy, rr, a0, a1)
        ctx.stroke()
      }
    }
    // a lit top-left arc on the ring (key light)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(cx, cy, R, Math.PI * 1.05, Math.PI * 1.5)
    ctx.stroke()
  }

  // waxy grain over the painted pixels
  const img = ctx.getImageData(0, 0, S, S)
  const dd = img.data
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (dd[idx + 3] < 8) continue
      const m = 1 + (grain(x * 1.3, y * 1.3) * 0.6 + grain(x * 3.1, y * 3.1) * 0.4) * 0.05
      dd[idx] = clamp(dd[idx] * m, 0, 255)
      dd[idx + 1] = clamp(dd[idx + 1] * m, 0, 255)
      dd[idx + 2] = clamp(dd[idx + 2] * m, 0, 255)
    }
  ctx.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// WASHI TAPE — a translucent warm strip with slightly torn ends and a soft
// sheen, laid across the sheet corners to ground it on the desk (depth).
// ============================================================================
function bakeTape() {
  const W = 200
  const H = 72
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const m = 10 // torn margin
  const tr = mulberry32(9111)

  // torn-edge body path (top & bottom edges wobble)
  ctx.beginPath()
  ctx.moveTo(0, m + (tr() - 0.5) * 4)
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, m + (tr() - 0.5) * 6)
  for (let x = W; x >= 0; x -= 12) ctx.lineTo(x, H - m + (tr() - 0.5) * 6)
  ctx.closePath()
  ctx.save()
  ctx.clip()

  // translucent tape body with a lengthwise sheen
  const g = ctx.createLinearGradient(0, m, 0, H - m)
  g.addColorStop(0, rgb(mix(TAPE, [255, 255, 255], 0.3), 0.72))
  g.addColorStop(0.5, rgb(TAPE, 0.6))
  g.addColorStop(1, rgb(mix(TAPE, [120, 100, 76], 0.25), 0.66))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // faint stripes (washi print) + a diagonal sheen
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = rgb(mix(TAPE, [255, 255, 255], 0.6), 1)
  ctx.lineWidth = 3
  for (let x = -H; x < W; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + H, H)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const sh = ctx.createLinearGradient(0, 0, W, 0)
  sh.addColorStop(0, 'rgba(255,255,255,0)')
  sh.addColorStop(0.5, 'rgba(255,255,255,0.14)')
  sh.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sh
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('tape.png'), buf)
  console.log('  ✓ tape.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// DESK BACKDROP — a calm art-room table: warm muted oak with a soft top light,
// gentle plank seams, a couple of blurred crayons resting at the bottom edge
// (low-contrast identity), and a corner vignette. ~14% desaturated, sensory-calm.
// ============================================================================
function bakeDesk() {
  const W = 840
  const H = 1180
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // base wood wash — a gentle vertical warm gradient
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb(mix(OAK, [255, 245, 225], 0.22)))
  g.addColorStop(0.5, rgb(OAK))
  g.addColorStop(1, rgb(mix(OAK, [60, 44, 30], 0.24)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // wood grain — long horizontal fibres via stretched noise
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const g1 = fbm(grain, x * 0.006, y * 0.09)
      const g2 = grain(x * 0.02, y * 0.6) * 0.5
      const m = 1 + g1 * 0.1 + g2 * 0.05
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  ctx.putImageData(img, 0, 0)

  // a few soft plank seams
  ctx.strokeStyle = 'rgba(60,42,28,0.14)'
  ctx.lineWidth = 2
  for (const px of [W * 0.26, W * 0.62, W * 0.9]) {
    ctx.beginPath()
    ctx.moveTo(px, 0)
    ctx.lineTo(px + 8, H)
    ctx.stroke()
  }

  // blurred muted crayons resting near the bottom (art-room identity, low key)
  const crayonCols = [
    [176, 128, 120],
    [150, 168, 132],
    [140, 150, 184],
    [196, 176, 124],
  ]
  ctx.save()
  ctx.filter = 'blur(3px)'
  crayonCols.forEach((c, i) => {
    const x = W * 0.1 + i * W * 0.07
    const y = H * 0.9 + (i % 2) * 10
    const len = 120
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-0.5 + i * 0.12)
    ctx.globalAlpha = 0.5
    // barrel
    const bg = ctx.createLinearGradient(0, -9, 0, 9)
    bg.addColorStop(0, rgb(mix(c, [255, 255, 255], 0.3)))
    bg.addColorStop(1, rgb(mix(c, [20, 20, 30], 0.25)))
    ctx.fillStyle = bg
    ctx.fillRect(0, -9, len, 18)
    // tip
    ctx.fillStyle = rgb(mix(c, [40, 30, 24], 0.3))
    ctx.beginPath()
    ctx.moveTo(len, -9)
    ctx.lineTo(len + 22, 0)
    ctx.lineTo(len, 9)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  })
  ctx.restore()

  // soft top key light + corner vignette
  const light = ctx.createRadialGradient(W * 0.5, H * 0.16, W * 0.1, W * 0.5, H * 0.3, H * 0.7)
  light.addColorStop(0, 'rgba(255,246,226,0.22)')
  light.addColorStop(1, 'rgba(255,246,226,0)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, W, H)
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.3, W * 0.5, H * 0.5, H * 0.72)
  vg.addColorStop(0, 'rgba(30,20,12,0)')
  vg.addColorStop(1, 'rgba(30,20,12,0.28)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  // ~14% desaturation toward luma (sensory-calm muted rule)
  const im2 = ctx.getImageData(0, 0, W, H)
  const d2 = im2.data
  for (let i = 0; i < d2.length; i += 4) {
    const l = d2[i] * 0.299 + d2[i + 1] * 0.587 + d2[i + 2] * 0.114
    d2[i] = lerp(d2[i], l, 0.14)
    d2[i + 1] = lerp(d2[i + 1], l, 0.14)
    d2[i + 2] = lerp(d2[i + 2], l, 0.14)
  }
  ctx.putImageData(im2, 0, 0)

  const buf = cv.toBuffer('image/jpeg', 80)
  writeFileSync(bgFile('art-desk.jpg'), buf)
  console.log('  ✓ bg/art-desk.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking connect-the-dots art →')
bakePaper()
bakeDot('dot.png', CRAYON, false)
bakeDot('dot-done.png', DONE, true)
bakeTape()
bakeDesk()
console.log('Done.')
