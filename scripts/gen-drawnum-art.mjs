// Bakes the "מציירים מספר" tracing materials — REAL paper/crayon/desk, not flat CSS.
//
// The child fills a big block-font numeral square-by-square with a finger; the
// FROZEN mechanic (any-path fill, no fail) is untouched. What we bake here is the
// MATERIAL every pixel is made of, so nothing reads as a flat CSS box:
//
//   sheet.jpg      — the worksheet SURFACE: warm cream squared exercise-book
//                    paper with a faint printed grid, fiber grain, a soft warm
//                    stain or two, a red margin line and a baked edge vignette.
//   cell-guide.png — one empty fillable SLOT: a softly debossed rounded square
//                    with a dashed graphite "trace me" outline + a warm fill, so
//                    the unfilled cells still read razor-clear as the numeral.
//   crayon.png     — the child's STROKE: a waxy crayon-fill texture (light, so it
//                    MULTIPLY-tints to the friend's colour at runtime) with soft
//                    directional wax streaks, a lit top-left and a defined edge.
//   start.png      — the "start here" MARKER: a muted-green target disc with a
//                    downward chevron (market-survey: begin at a coloured dot,
//                    follow the direction) + a soft glow ring.
//   desk.jpg       — the BACKDROP (→ public/art/bg/drawnum-desk.jpg): a warm
//                    wooden school-desk lit from a window, seen at a shallow
//                    angle (receding planks) with a couple of muted props, so the
//                    worksheet rests ON a real, depth-cued surface.
//
// Same pipeline as gen-dice-art.mjs: an original @napi-rs/canvas bake with seeded
// value-noise grain and analytic baked lighting/AO. No third-party art. One-off:
//   node scripts/gen-drawnum-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const SPR = new URL('../public/art/sprites/drawnum/', import.meta.url)
const BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(SPR, { recursive: true })
mkdirSync(BG, { recursive: true })
const sprFile = (name) => new URL(name, SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
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
// multiply a seeded fbm grain over every opaque pixel (kills the "flat CSS" read)
function grainPass(ctx, W, H, amt = 0.05, s1 = 0.5, s2 = 1.7) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * s1, y * s1) * 0.6 + grain(x * s2, y * s2) * 0.4
      const m = 1 + n * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

// muted, sensory-calm palette
const PAPER = [244, 233, 208] // warm cream exercise-book paper
// WARM taupe grid (not blue): a bluish grid bleeds blue chroma into the yellow
// paper under JPEG subsampling and the whole sheet drifts olive-green.
const GRID = [150, 128, 96] // soft warm pencil-grey printed squares
const MARGIN = [198, 122, 112] // muted red margin line
const WOOD = [156, 120, 80] // warm desk wood
const GUIDE_INK = [92, 96, 108] // graphite dashed outline
const START_GREEN = [122, 176, 122] // muted "go" green

// ============================================================================
// sheet.jpg — the worksheet paper surface (opaque → JPG, small)
// ============================================================================
function bakeSheet() {
  const W = 840
  const H = 1080
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // base paper wash, a hair warmer at the top-left where the light falls
  let g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, rgb(mix(PAPER, [255, 255, 255], 0.16)))
  g.addColorStop(0.55, rgb(PAPER))
  g.addColorStop(1, rgb(mix(PAPER, [120, 96, 60], 0.1)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // printed grid squares (the exercise-book look) — minor lines + darker majors
  // every 4 cells, drawn strong enough to survive JPEG on a subtle paper wash
  const cell = 60
  ctx.lineWidth = 1.8
  ctx.strokeStyle = rgb(GRID, 0.22)
  ctx.beginPath()
  for (let x = 0; x <= W; x += cell) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
  }
  for (let y = 0; y <= H; y += cell) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
  }
  ctx.stroke()
  ctx.lineWidth = 2.4
  ctx.strokeStyle = rgb(GRID, 0.36)
  ctx.beginPath()
  for (let x = 0; x <= W; x += cell * 4) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
  }
  for (let y = 0; y <= H; y += cell * 4) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(W, y + 0.5)
  }
  ctx.stroke()

  // red margin line down the left (a real workbook cue)
  ctx.strokeStyle = rgb(MARGIN, 0.5)
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(cell * 1.5, 0)
  ctx.lineTo(cell * 1.5, H)
  ctx.stroke()

  // a couple of very soft warm stains so the paper isn't sterile
  for (const [sx, sy, sr, sa] of [
    [W * 0.72, H * 0.2, 190, 0.05],
    [W * 0.24, H * 0.82, 240, 0.045],
  ]) {
    const st = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
    st.addColorStop(0, rgb([150, 120, 78], sa))
    st.addColorStop(1, rgb([150, 120, 78], 0))
    ctx.fillStyle = st
    ctx.fillRect(0, 0, W, H)
  }

  // fiber grain — a touch heavier, to dither the flat cream so JPEG chroma can't
  // quantize it toward olive-green
  grainPass(ctx, W, H, 0.09, 0.9, 2.6)

  // soft baked edge vignette (page catches light in the centre, edges recede)
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.44, H * 0.25, W * 0.5, H * 0.5, H * 0.72)
  vg.addColorStop(0, 'rgba(70,52,26,0)')
  vg.addColorStop(1, 'rgba(70,52,26,0.12)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 0.95)
  writeFileSync(sprFile('sheet.jpg'), buf)
  console.log('  ✓ sheet.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// cell-guide.png — one empty fillable slot (transparent PNG tile)
// ============================================================================
function bakeCellGuide() {
  const S = 128
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const pad = 6
  const r = 16

  // soft warm fill so the slot reads as part of the numeral silhouette
  roundRectPath(ctx, pad, pad, S - 2 * pad, S - 2 * pad, r)
  let g = ctx.createLinearGradient(pad, pad, S - pad, S - pad)
  g.addColorStop(0, 'rgba(120,104,74,0.10)')
  g.addColorStop(1, 'rgba(84,70,44,0.16)')
  ctx.fillStyle = g
  ctx.fill()

  // debossed inner shadow (top) + lit lip (bottom) so the slot sits IN the paper
  ctx.save()
  roundRectPath(ctx, pad, pad, S - 2 * pad, S - 2 * pad, r)
  ctx.clip()
  const sh = ctx.createLinearGradient(0, pad, 0, pad + 22)
  sh.addColorStop(0, 'rgba(40,30,14,0.18)')
  sh.addColorStop(1, 'rgba(40,30,14,0)')
  ctx.fillStyle = sh
  ctx.fillRect(0, 0, S, S)
  const li = ctx.createLinearGradient(0, S - pad - 20, 0, S - pad)
  li.addColorStop(0, 'rgba(255,250,238,0)')
  li.addColorStop(1, 'rgba(255,250,238,0.28)')
  ctx.fillStyle = li
  ctx.fillRect(0, 0, S, S)
  ctx.restore()

  // dashed graphite "trace me" outline
  ctx.strokeStyle = rgb(GUIDE_INK, 0.6)
  ctx.lineWidth = 3
  ctx.setLineDash([12, 9])
  ctx.lineCap = 'round'
  roundRectPath(ctx, pad + 3, pad + 3, S - 2 * pad - 6, S - 2 * pad - 6, r - 3)
  ctx.stroke()
  ctx.setLineDash([])

  grainPass(ctx, S, S, 0.05)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('cell-guide.png'), buf)
  console.log('  ✓ cell-guide.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// crayon.png — the waxy fill stroke (LIGHT, tinted via CSS multiply at runtime)
// ============================================================================
function bakeCrayon() {
  const S = 128
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const r = 12

  // light waxy base so a multiply keeps the friend's colour vivid but softened
  roundRectPath(ctx, 0, 0, S, S, r)
  ctx.fillStyle = 'rgb(236,233,227)'
  ctx.fill()

  ctx.save()
  roundRectPath(ctx, 0, 0, S, S, r)
  ctx.clip()

  // soft waxy crayon fill: gentle organic grain + a faint diagonal wax bias + a lit
  // top-left and a slightly darker defined edge. Kept subtle so a runtime MULTIPLY
  // gives a calm, legible crayon tint — not glossy candy stripes.
  const streak = makeNoise(7788)
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      // low-freq wax passes along a diagonal (organic, not a hard sine)
      const wax = streak(x * 0.045 + y * 0.02, y * 0.05) * 0.55 + streak(x * 0.12, y * 0.12) * 0.45
      const fine = streak(x * 1.1, y * 1.1) * 0.5 + streak(x * 2.7, y * 2.7) * 0.5
      let m = 1 + wax * 0.05 + fine * 0.04
      // lit top-left bloom
      const dx = x / S - 0.38
      const dy = y / S - 0.34
      m += 0.05 - (dx * dx + dy * dy) * 0.1
      // slightly darker defined edge so the filled block has a clean boundary
      const edge = Math.min(x, y, S - 1 - x, S - 1 - y) / (S * 0.5)
      m -= (1 - clamp(edge, 0, 1)) * 0.07
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  ctx.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('crayon.png'), buf)
  console.log('  ✓ crayon.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// start.png — "start here" marker: green target disc + downward chevron
// ============================================================================
function bakeStart() {
  const S = 176
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const R = S * 0.3

  // soft outer glow ring
  const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.55)
  glow.addColorStop(0, rgb(START_GREEN, 0.32))
  glow.addColorStop(1, rgb(START_GREEN, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2)
  ctx.fill()

  // the disc, lit top-left
  const g = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.4, R * 0.1, cx, cy, R)
  g.addColorStop(0, rgb(mix(START_GREEN, [255, 255, 255], 0.4)))
  g.addColorStop(0.6, rgb(START_GREEN))
  g.addColorStop(1, rgb(mix(START_GREEN, [30, 60, 30], 0.4)))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  // white rim
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = S * 0.03
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()

  // downward chevron (begin at the top, move down)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = S * 0.055
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const cw = R * 0.5
  ctx.beginPath()
  ctx.moveTo(cx - cw, cy - cw * 0.5)
  ctx.lineTo(cx, cy + cw * 0.5)
  ctx.lineTo(cx + cw, cy - cw * 0.5)
  ctx.stroke()

  grainPass(ctx, S, S, 0.04)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('start.png'), buf)
  console.log('  ✓ start.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// desk.jpg → public/art/bg/drawnum-desk.jpg — the wooden school desk backdrop
// with a shallow camera angle (receding planks) + soft window light + calm props
// ============================================================================
function bakeDesk() {
  const W = 900
  const H = 1160
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // base wood wash, brighter at the far (top) edge → a receding table plane. Kept
  // warm + fairly light end-to-end so JPEG never lets the dark corners drift olive.
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb(mix(WOOD, [246, 224, 186], 0.22)))
  g.addColorStop(0.5, rgb(mix(WOOD, [246, 224, 186], 0.04)))
  g.addColorStop(1, rgb(mix(WOOD, [70, 48, 24], 0.22)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // receding horizontal planks — seams spaced wider toward the near (bottom) edge
  // so the surface reads as a table seen at a shallow angle (baked perspective)
  ctx.strokeStyle = 'rgba(52,34,16,0.42)'
  ctx.lineWidth = 3.4
  let y = H * 0.06
  let step = H * 0.05
  while (y < H) {
    ctx.globalAlpha = clamp(0.45 + (y / H) * 0.4, 0, 0.9)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y + (y / H) * 10 - 5) // very slight tilt
    ctx.stroke()
    // a lit lip just under each seam
    ctx.strokeStyle = 'rgba(255,238,206,0.16)'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(0, y + 3)
    ctx.lineTo(W, y + 3 + (y / H) * 10 - 5)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(52,34,16,0.42)'
    ctx.lineWidth = 3.4
    y += step
    step *= 1.085 // planks nearer the viewer look taller → perspective
  }
  ctx.globalAlpha = 1

  // long wood grain fibers — dense, so no large flat area survives to drift olive
  const fib = makeNoise(4242)
  ctx.save()
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 520; i++) {
    const fy = Math.random() * H
    const fx = Math.random() * W
    const len = 60 + Math.random() * 180
    const tone = fib(fx * 0.02, fy * 0.02)
    ctx.strokeStyle = `rgba(${tone > 0 ? 96 : 54},${tone > 0 ? 70 : 38},${tone > 0 ? 38 : 18},0.13)`
    ctx.lineWidth = 1 + Math.random() * 1.6
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.bezierCurveTo(fx + len * 0.3, fy + 2, fx + len * 0.7, fy - 2, fx + len, fy)
    ctx.stroke()
  }
  ctx.restore()

  // soft window light from the top-left (kept warm + modest so it never washes a
  // flat pale patch that JPEG can drift olive)
  const win = ctx.createRadialGradient(W * 0.3, H * 0.24, 0, W * 0.34, H * 0.3, H * 0.7)
  win.addColorStop(0, 'rgba(255,238,204,0.16)')
  win.addColorStop(1, 'rgba(255,238,204,0)')
  ctx.fillStyle = win
  ctx.fillRect(0, 0, W, H)

  // a muted wooden ruler along the far-left edge (a calm prop, kept to the margin)
  ctx.save()
  ctx.translate(W * 0.045, H * 0.5)
  ctx.rotate(-0.02)
  const rw = W * 0.05
  const rh = H * 0.86
  g = ctx.createLinearGradient(0, 0, rw, 0)
  g.addColorStop(0, 'rgba(206,170,110,0.9)')
  g.addColorStop(1, 'rgba(170,132,78,0.9)')
  ctx.fillStyle = g
  roundRectPath(ctx, -rw / 2, -rh / 2, rw, rh, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(60,40,18,0.4)'
  ctx.lineWidth = 1.5
  for (let t = -rh / 2 + 20; t < rh / 2; t += 26) {
    ctx.beginPath()
    ctx.moveTo(-rw / 2, t)
    ctx.lineTo(-rw / 2 + rw * 0.4, t)
    ctx.stroke()
  }
  ctx.restore()

  // a stubby muted pencil resting near the bottom-right
  ctx.save()
  ctx.translate(W * 0.82, H * 0.88)
  ctx.rotate(-0.5)
  const pl = W * 0.26
  const pw = W * 0.032
  ctx.fillStyle = 'rgba(212,176,96,0.92)' // muted yellow barrel
  roundRectPath(ctx, -pl / 2, -pw / 2, pl * 0.82, pw, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(196,150,110,0.95)' // wood tip
  ctx.beginPath()
  ctx.moveTo(pl / 2 - pl * 0.18, -pw / 2)
  ctx.lineTo(pl / 2, 0)
  ctx.lineTo(pl / 2 - pl * 0.18, pw / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(40,36,34,0.95)' // graphite
  ctx.beginPath()
  ctx.moveTo(pl / 2 - pl * 0.05, -pw * 0.14)
  ctx.lineTo(pl / 2, 0)
  ctx.lineTo(pl / 2 - pl * 0.05, pw * 0.14)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  grainPass(ctx, W, H, 0.09, 0.7, 2.1)

  // gentle vignette to seat the eye on the centre where the sheet lands (warm +
  // light, so the corners stay wood-brown and never drift olive under JPEG)
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.3, W * 0.5, H * 0.5, H * 0.82)
  vg.addColorStop(0, 'rgba(92,62,30,0)')
  vg.addColorStop(1, 'rgba(92,62,30,0.16)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 0.94)
  writeFileSync(bgFile('drawnum-desk.jpg'), buf)
  console.log('  ✓ drawnum-desk.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking drawnum art →')
bakeSheet()
bakeCellGuide()
bakeCrayon()
bakeStart()
bakeDesk()
console.log('Done.')
