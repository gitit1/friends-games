// Bakes the "לצייר אות חיה" (trace a live Hebrew letter) materials — REAL paper +
// desk texture with baked lighting/AO, not flat CSS. The FROZEN mechanic (finger
// traces a glowing rainbow trail over a faint guide letter, any path completes it,
// no fail) is untouched. What we bake here is the MATERIAL every surface is made
// of, matching the drawnum sibling's family look:
//
//   tracehe-desk.jpg  (→ public/art/bg) — the BACKDROP: a warm wooden desk seen at
//                     a shallow angle (receding planks, baked perspective), soft
//                     window light, a couple of muted props — same "desk" family as
//                     drawnum-desk.jpg but its own seed/composition so the two read
//                     as siblings, not clones.
//   sheet.jpg         — the writing SURFACE: a warm cream page (unlined — one big
//                     letter, not a grid of digits) with a soft printed corner
//                     rule, fiber grain, faint stains and a baked edge vignette,
//                     resting on the desk like drawnum's worksheet.
//   start.png         — the "start here" MARKER: reuses the muted-green target
//                     disc + chevron language from drawnum's start.png so the two
//                     tracing games share one visual vocabulary.
//
// Same pipeline as gen-drawnum-art.mjs / gen-letterhunt-art.mjs: an original
// @napi-rs/canvas bake with seeded value-noise grain and analytic baked
// lighting/AO. No third-party art. One-off:
//   node scripts/gen-tracehe-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const SPR = new URL('../public/art/sprites/tracehe/', import.meta.url)
const BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(SPR, { recursive: true })
mkdirSync(BG, { recursive: true })
const sprFile = (name) => new URL(name, SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const bgFile = (name) => new URL(name, BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same recipe as
// gen-drawnum-art.mjs / gen-letterhunt-art.mjs) ----------------------------------
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

const grain = makeNoise(20260803)
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

// muted, sensory-calm palette — a family match to drawnum's warm cream/wood, with
// its own accent (a soft dusty-blue rule instead of drawnum's red margin) so the
// page reads as a different, but related, notebook
const PAPER = [246, 236, 214] // warm cream page
const RULE = [140, 152, 168] // soft dusty-blue corner rule (not drawnum's red)
const WOOD = [150, 114, 74] // warm desk wood (own seed, near-sibling of drawnum's)
const START_GREEN = [122, 176, 122] // muted "go" green — shared with drawnum's start.png

// ============================================================================
// sheet.jpg — the writing surface: one big unlined cream page (opaque → JPG)
// ============================================================================
function bakeSheet() {
  const W = 900
  const H = 900
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // base paper wash, lit top-left
  let g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, rgb(mix(PAPER, [255, 255, 255], 0.18)))
  g.addColorStop(0.55, rgb(PAPER))
  g.addColorStop(1, rgb(mix(PAPER, [120, 96, 60], 0.09)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // a soft printed corner rule (top-right, matching Hebrew's RTL start corner) —
  // two faint dusty-blue lines forming an "L", a quiet notebook cue without a
  // full grid (the letter itself is the only guide the child needs)
  ctx.strokeStyle = rgb(RULE, 0.28)
  ctx.lineWidth = 3
  const m = W * 0.09
  ctx.beginPath()
  ctx.moveTo(W - m, m * 0.6)
  ctx.lineTo(W - m, H - m * 0.6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(m * 0.6, m)
  ctx.lineTo(W - m * 0.6, m)
  ctx.stroke()

  // a couple of very soft warm stains so the page isn't sterile
  for (const [sx, sy, sr, sa] of [
    [W * 0.26, H * 0.78, 210, 0.045],
    [W * 0.76, H * 0.22, 180, 0.04],
  ]) {
    const st = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
    st.addColorStop(0, rgb([150, 120, 78], sa))
    st.addColorStop(1, rgb([150, 120, 78], 0))
    ctx.fillStyle = st
    ctx.fillRect(0, 0, W, H)
  }

  // fiber grain, heavy enough to keep JPEG from quantizing the cream toward olive
  grainPass(ctx, W, H, 0.09, 0.9, 2.6)

  // soft baked edge vignette
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.26, W * 0.5, H * 0.5, H * 0.72)
  vg.addColorStop(0, 'rgba(70,52,26,0)')
  vg.addColorStop(1, 'rgba(70,52,26,0.13)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  // NOTE: toBuffer('image/jpeg', q) takes an INTEGER 0-100 quality, not a 0-1
  // fraction — passing a fraction here (as gen-drawnum-art.mjs does) silently
  // collapses flat/near-flat regions to neutral grey (verified: a solid cream
  // fill round-tripped through toBuffer('image/jpeg', 0.95) decodes back as flat
  // rgb(224,224,224) instead of the source colour; toBuffer('image/jpeg', 95)
  // round-trips correctly). Use the correct integer scale here.
  const buf = cv.toBuffer('image/jpeg', 88)
  writeFileSync(sprFile('sheet.jpg'), buf)
  console.log('  ✓ sheet.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// start.png — "start here" marker: green target disc + downward chevron
// (same visual vocabulary as drawnum's start.png so the tracing games match)
// ============================================================================
function bakeStart() {
  const S = 176
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const Rr = S * 0.3

  const glow = ctx.createRadialGradient(cx, cy, Rr * 0.6, cx, cy, Rr * 1.55)
  glow.addColorStop(0, rgb(START_GREEN, 0.32))
  glow.addColorStop(1, rgb(START_GREEN, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, Rr * 1.55, 0, Math.PI * 2)
  ctx.fill()

  const g = ctx.createRadialGradient(cx - Rr * 0.34, cy - Rr * 0.4, Rr * 0.1, cx, cy, Rr)
  g.addColorStop(0, rgb(mix(START_GREEN, [255, 255, 255], 0.4)))
  g.addColorStop(0.6, rgb(START_GREEN))
  g.addColorStop(1, rgb(mix(START_GREEN, [30, 60, 30], 0.4)))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, Rr, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = S * 0.03
  ctx.beginPath()
  ctx.arc(cx, cy, Rr, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = S * 0.055
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const cw = Rr * 0.5
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
// tracehe-desk.jpg → public/art/bg — the wooden desk backdrop, a shallow-angle
// receding-plank scene like drawnum's but its own seed/composition (different
// prop set + plank rhythm) so the two read as siblings, not a re-skin.
// ============================================================================
function bakeDesk() {
  const W = 900
  const H = 1160
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb(mix(WOOD, [246, 224, 186], 0.24)))
  g.addColorStop(0.5, rgb(mix(WOOD, [246, 224, 186], 0.05)))
  g.addColorStop(1, rgb(mix(WOOD, [70, 48, 24], 0.2)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // receding horizontal planks — wider spacing toward the near (bottom) edge
  ctx.strokeStyle = 'rgba(52,34,16,0.4)'
  ctx.lineWidth = 3.2
  let y = H * 0.05
  let step = H * 0.046
  while (y < H) {
    ctx.globalAlpha = clamp(0.42 + (y / H) * 0.42, 0, 0.9)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y - (y / H) * 8 + 4) // slight opposite tilt from drawnum's
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,238,206,0.15)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y + 3)
    ctx.lineTo(W, y + 3 - (y / H) * 8 + 4)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(52,34,16,0.4)'
    ctx.lineWidth = 3.2
    y += step
    step *= 1.078
  }
  ctx.globalAlpha = 1

  // long wood grain fibers
  const fib = makeNoise(9911)
  ctx.save()
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 480; i++) {
    const fy = Math.random() * H
    const fx = Math.random() * W
    const len = 55 + Math.random() * 170
    const tone = fib(fx * 0.02, fy * 0.02)
    ctx.strokeStyle = `rgba(${tone > 0 ? 96 : 52},${tone > 0 ? 68 : 36},${tone > 0 ? 36 : 16},0.13)`
    ctx.lineWidth = 1 + Math.random() * 1.5
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.bezierCurveTo(fx + len * 0.3, fy + 2, fx + len * 0.7, fy - 2, fx + len, fy)
    ctx.stroke()
  }
  ctx.restore()

  // soft window light, from the top-RIGHT this time (Hebrew reading corner) so the
  // two desk siblings differ in more than palette
  const win = ctx.createRadialGradient(W * 0.7, H * 0.24, 0, W * 0.66, H * 0.3, H * 0.7)
  win.addColorStop(0, 'rgba(255,238,204,0.16)')
  win.addColorStop(1, 'rgba(255,238,204,0)')
  ctx.fillStyle = win
  ctx.fillRect(0, 0, W, H)

  // a stack of muted wooden alphabet blocks resting near the bottom-left (a calm
  // prop that nods at letters without illustrating a specific one)
  ctx.save()
  ctx.translate(W * 0.16, H * 0.89)
  const bcols = [
    [214, 176, 130],
    [190, 160, 118],
    [204, 168, 124],
  ]
  for (let i = 0; i < 3; i++) {
    const bs = W * 0.09
    ctx.save()
    ctx.translate(i * bs * 0.72, -i * bs * 0.86)
    ctx.rotate(R(0.06))
    g = ctx.createLinearGradient(0, 0, bs, bs)
    g.addColorStop(0, rgb(mix(bcols[i], [255, 250, 236], 0.22)))
    g.addColorStop(1, rgb(mix(bcols[i], [40, 26, 12], 0.18)))
    ctx.fillStyle = g
    roundRectPath(ctx, -bs / 2, -bs / 2, bs, bs, bs * 0.12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,250,236,0.35)'
    ctx.lineWidth = 1.4
    roundRectPath(ctx, -bs / 2, -bs / 2, bs, bs, bs * 0.12)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  // a muted pencil resting near the bottom-right
  ctx.save()
  ctx.translate(W * 0.84, H * 0.9)
  ctx.rotate(0.42)
  const pl = W * 0.24
  const pw = W * 0.03
  ctx.fillStyle = 'rgba(206,168,204,0.85)' // muted dusty-lilac barrel (own accent)
  roundRectPath(ctx, -pl / 2, -pw / 2, pl * 0.82, pw, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(196,150,110,0.95)'
  ctx.beginPath()
  ctx.moveTo(pl / 2 - pl * 0.18, -pw / 2)
  ctx.lineTo(pl / 2, 0)
  ctx.lineTo(pl / 2 - pl * 0.18, pw / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(40,36,34,0.95)'
  ctx.beginPath()
  ctx.moveTo(pl / 2 - pl * 0.05, -pw * 0.14)
  ctx.lineTo(pl / 2, 0)
  ctx.lineTo(pl / 2 - pl * 0.05, pw * 0.14)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  grainPass(ctx, W, H, 0.09, 0.7, 2.1)

  const vg = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.3, W * 0.5, H * 0.5, H * 0.82)
  vg.addColorStop(0, 'rgba(92,62,30,0)')
  vg.addColorStop(1, 'rgba(92,62,30,0.16)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 86) // integer 0-100 scale, see bakeSheet() note above
  writeFileSync(bgFile('tracehe-desk.jpg'), buf)
  console.log('  ✓ tracehe-desk.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking tracehe art →')
bakeSheet()
bakeStart()
bakeDesk()
console.log('Done.')
