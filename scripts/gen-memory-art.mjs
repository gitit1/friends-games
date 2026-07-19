// Bakes the "זיכרון חברים" (friends memory-match) materials — REAL card stock,
// not flat CSS. Same @napi-rs/canvas pipeline as the coin-sort / dice materials:
// seeded value-noise grain + analytic baked lighting/AO. No third-party art.
//
//   card-back.png  — the face-DOWN card: a calm dusty-teal card with a soft
//                    stipple pattern, a thin inset frame line, and a centered
//                    TURQUOISE FRIEND emblem (per the owner's plan: a friendly
//                    turquoise silhouette in place of the old red "❓"). Rounded
//                    die-cut corners, a bright top-left bevel, bottom-right AO,
//                    baked material grain and a soft baked drop shadow so it
//                    rests on the table.
//   card-face.png  — the face-UP card: warm ivory stock with a recessed rounded
//                    MAT WINDOW that hosts the friend (the runtime draws the
//                    friend in the DOM, centered in the window). Inner AO ring +
//                    a laminated sheen streak sell real card stock; matching
//                    corners, bevel, grain and baked drop shadow.
//   table-felt.jpg — the CARD-TABLE surface the grid rests on: a muted sage felt
//                    with baked fiber grain, a warm center light pool and a soft
//                    edge vignette. Calm, sensory-safe.
//
// One-off build tool:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-memory-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/memory/', import.meta.url)
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
const lerpN = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerpN(c1[0], c2[0], t), lerpN(c1[1], c2[1], t), lerpN(c1[2], c2[2], t)]
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

// a friend "bump": a domed top over a body with softly rounded bottom corners —
// the silhouette every friend in this app shares.
function bumpPath(ctx, cx, cy, w, h) {
  const r = w / 2
  const top = cy - h / 2
  const bot = cy + h / 2
  const br = r * 0.42 // bottom corner radius
  ctx.beginPath()
  ctx.moveTo(cx - r, top + r)
  ctx.arc(cx, top + r, r, Math.PI, 0) // dome top (left→right over the top)
  ctx.lineTo(cx + r, bot - br)
  ctx.arcTo(cx + r, bot, cx + r - br, bot, br)
  ctx.lineTo(cx - r + br, bot)
  ctx.arcTo(cx - r, bot, cx - r, bot - br, br)
  ctx.closePath()
}

const grain = makeNoise(20260718)

// grain pass over every painted pixel (kills the "flat CSS" read)
function grainPass(ctx, w, h, amt = 0.045) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) << 2
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
// THE CARD — square sprite; the card body is inset so its baked drop shadow has
// room inside the transparent margin (like the coin sprites). MARGIN/RAD shared
// by both faces so back and face are pixel-identical in size + corner.
// ============================================================================
const CS = 320
const M = 0.055 * CS // margin for the baked shadow
const CW = CS - 2 * M // card width/height
const RAD = CW * 0.12 // die-cut corner radius

function cardBaseLayers(ctx, base, litMix, aoTint) {
  // baked contact/drop shadow under the card (soft, offset down)
  ctx.save()
  roundRectPath(ctx, M + 3, M + 8, CW, CW, RAD)
  const sh = ctx.createLinearGradient(0, M, 0, M + CW + 10)
  sh.addColorStop(0, 'rgba(28,30,26,0.16)')
  sh.addColorStop(1, 'rgba(28,30,26,0.30)')
  ctx.fillStyle = sh
  ctx.filter = 'blur(6px)'
  ctx.fill()
  ctx.restore()

  // card body — a soft top-left→bottom-right light gradient
  roundRectPath(ctx, M, M, CW, CW, RAD)
  const g = ctx.createLinearGradient(M, M, M + CW, M + CW)
  g.addColorStop(0, rgb(mix(base, litMix, 0.5)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, aoTint, 0.22)))
  ctx.save()
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()
  // top-left key-light bloom
  const bloom = ctx.createRadialGradient(M + CW * 0.3, M + CW * 0.26, 0, M + CW * 0.3, M + CW * 0.26, CW * 0.95)
  bloom.addColorStop(0, 'rgba(255,255,255,0.22)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(M, M, CW, CW)
  // bottom-right ambient occlusion pooling
  const ao = ctx.createRadialGradient(M + CW * 0.82, M + CW * 0.84, CW * 0.1, M + CW * 0.82, M + CW * 0.84, CW * 0.95)
  ao.addColorStop(0, rgb(aoTint, 0.2))
  ao.addColorStop(1, rgb(aoTint, 0))
  ctx.fillStyle = ao
  ctx.fillRect(M, M, CW, CW)
  ctx.restore()
}

// crisp die-cut bevel: bright top-left rim, dark bottom-right rim
function cardBevel(ctx) {
  ctx.save()
  roundRectPath(ctx, M + 1.5, M + 1.5, CW - 3, CW - 3, RAD - 1.5)
  ctx.clip()
  roundRectPath(ctx, M, M, CW, CW, RAD)
  ctx.lineWidth = CS * 0.014
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.stroke()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, M, M, CW, CW, RAD)
  ctx.clip()
  ctx.beginPath()
  ctx.arc(M + CW, M + CW, CW * 0.9, Math.PI, Math.PI * 1.5)
  roundRectPath(ctx, M, M, CW, CW, RAD)
  ctx.lineWidth = CS * 0.02
  ctx.strokeStyle = 'rgba(24,30,28,0.16)'
  ctx.stroke()
  ctx.restore()
}

function bakeCardBack() {
  const cv = createCanvas(CS, CS)
  const ctx = cv.getContext('2d')

  const base = [118, 164, 162] // calm dusty teal
  cardBaseLayers(ctx, base, [236, 248, 246], [26, 54, 58])

  ctx.save()
  roundRectPath(ctx, M, M, CW, CW, RAD)
  ctx.clip()

  // subtle stipple pattern — a diagonal lattice of very low-contrast dots
  const step = CW / 9
  for (let gy = 0; gy <= 9; gy++) {
    for (let gx = 0; gx <= 9; gx++) {
      const px = M + gx * step + (gy % 2 ? step / 2 : 0)
      const py = M + gy * step
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath()
      ctx.arc(px, py - 0.6, CW * 0.011, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(18,48,50,0.05)'
      ctx.beginPath()
      ctx.arc(px, py + 0.6, CW * 0.011, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // thin inset double frame line (classic card border)
  ctx.strokeStyle = 'rgba(246,252,250,0.4)'
  ctx.lineWidth = CS * 0.006
  roundRectPath(ctx, M + CW * 0.08, M + CW * 0.08, CW * 0.84, CW * 0.84, RAD * 0.66)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(20,52,54,0.18)'
  ctx.lineWidth = CS * 0.004
  roundRectPath(ctx, M + CW * 0.11, M + CW * 0.11, CW * 0.78, CW * 0.78, RAD * 0.52)
  ctx.stroke()

  // ---- the centered TURQUOISE FRIEND emblem ----
  const cx = M + CW / 2
  const cy = M + CW / 2 + CW * 0.02
  const bw = CW * 0.34
  const bh = CW * 0.42
  const turq = [86, 190, 190]

  // soft halo behind the emblem
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, CW * 0.34)
  halo.addColorStop(0, 'rgba(210,246,244,0.4)')
  halo.addColorStop(1, 'rgba(210,246,244,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, CW * 0.34, 0, Math.PI * 2)
  ctx.fill()

  // drop shadow of the friend (down-right) for a gentle raised read
  bumpPath(ctx, cx + CW * 0.012, cy + CW * 0.02, bw, bh)
  ctx.fillStyle = 'rgba(18,60,62,0.22)'
  ctx.fill()

  // the friend body — turquoise with a soft top-left highlight
  bumpPath(ctx, cx, cy, bw, bh)
  const bg = ctx.createLinearGradient(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
  bg.addColorStop(0, rgb(mix(turq, [255, 255, 255], 0.34)))
  bg.addColorStop(0.6, rgb(turq))
  bg.addColorStop(1, rgb(mix(turq, [20, 70, 74], 0.28)))
  ctx.fillStyle = bg
  ctx.fill()
  // lit rim on the dome
  ctx.save()
  bumpPath(ctx, cx, cy, bw, bh)
  ctx.clip()
  const rim = ctx.createRadialGradient(cx - bw * 0.22, cy - bh * 0.3, 0, cx - bw * 0.22, cy - bh * 0.3, bw * 0.9)
  rim.addColorStop(0, 'rgba(255,255,255,0.34)')
  rim.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = rim
  ctx.fillRect(cx - bw, cy - bh, bw * 2, bh * 2)
  ctx.restore()

  // a friendly little face (two eyes + a soft smile) — warm, not a scary "?"
  const eyeR = bw * 0.1
  const eyeY = cy - bh * 0.12
  for (const sx of [-1, 1]) {
    ctx.fillStyle = 'rgba(250,254,252,0.92)'
    ctx.beginPath()
    ctx.arc(cx + sx * bw * 0.22, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(24,66,68,0.9)'
    ctx.beginPath()
    ctx.arc(cx + sx * bw * 0.22, eyeY + eyeR * 0.12, eyeR * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(22,64,66,0.8)'
  ctx.lineWidth = CS * 0.011
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy + bh * 0.06, bw * 0.24, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()

  ctx.restore() // card clip

  cardBevel(ctx)
  grainPass(ctx, CS, CS, 0.04)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('card-back.png'), buf)
  console.log('  ✓ card-back.png', `${CS}×${CS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

function bakeCardFace() {
  const cv = createCanvas(CS, CS)
  const ctx = cv.getContext('2d')

  const base = [237, 231, 219] // warm ivory card stock
  cardBaseLayers(ctx, base, [252, 249, 242], [120, 104, 78])

  ctx.save()
  roundRectPath(ctx, M, M, CW, CW, RAD)
  ctx.clip()

  // recessed MAT WINDOW that hosts the friend (centered, ~66% of the card)
  const win = CW * 0.66
  const wx = M + (CW - win) / 2
  const wy = M + (CW - win) / 2
  const wr = win * 0.12
  // inner window fill — a touch brighter than the stock so the friend pops
  roundRectPath(ctx, wx, wy, win, win, wr)
  const wg = ctx.createLinearGradient(wx, wy, wx, wy + win)
  wg.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.55)))
  wg.addColorStop(1, rgb(mix(base, [255, 255, 255], 0.32)))
  ctx.fillStyle = wg
  ctx.fill()
  // inner AO ring around the window → reads as pressed IN (a real mat frame)
  ctx.save()
  roundRectPath(ctx, wx, wy, win, win, wr)
  ctx.clip()
  const inAO = ctx.createLinearGradient(wx, wy, wx, wy + win * 0.34)
  inAO.addColorStop(0, 'rgba(120,104,78,0.22)')
  inAO.addColorStop(1, 'rgba(120,104,78,0)')
  ctx.fillStyle = inAO
  ctx.fillRect(wx, wy, win, win * 0.34)
  ctx.restore()
  // crisp inner-window edge: dark top-left, light bottom-right (recess)
  ctx.strokeStyle = 'rgba(110,96,72,0.3)'
  ctx.lineWidth = CS * 0.007
  roundRectPath(ctx, wx, wy, win, win, wr)
  ctx.stroke()

  // laminated sheen — a soft diagonal highlight streak across the whole card
  ctx.globalCompositeOperation = 'screen'
  const sheen = ctx.createLinearGradient(M, M, M + CW * 0.7, M + CW)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.46, 'rgba(255,255,255,0.16)')
  sheen.addColorStop(0.54, 'rgba(255,255,255,0.16)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(M, M, CW, CW)
  ctx.globalCompositeOperation = 'source-over'

  ctx.restore() // card clip

  cardBevel(ctx)
  grainPass(ctx, CS, CS, 0.035)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('card-face.png'), buf)
  console.log('  ✓ card-face.png', `${CS}×${CS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

function bakeTable() {
  const W = 760
  const H = 430
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  const felt = [124, 146, 128] // muted sage card-table felt
  ctx.fillStyle = rgb(felt)
  ctx.fillRect(0, 0, W, H)

  // warm center light pool
  const pool = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, W * 0.6)
  pool.addColorStop(0, 'rgba(236,244,214,0.16)')
  pool.addColorStop(0.6, 'rgba(236,244,214,0.05)')
  pool.addColorStop(1, 'rgba(236,244,214,0)')
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, W, H)

  // edge vignette (soft, all four sides)
  const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.3, W * 0.5, H * 0.5, W * 0.62)
  vig.addColorStop(0, 'rgba(28,40,30,0)')
  vig.addColorStop(1, 'rgba(28,40,30,0.34)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  // felt FIBER grain — two octaves, low amplitude, faintly directional
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const n = grain(x * 0.9, y * 0.9) * 0.5 + grain(x * 2.6 + 40, y * 2.6) * 0.35 + grain(x * 0.18, y * 0.18) * 0.3
      const m = 1 + n * 0.05
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/jpeg', { quality: 0.82 })
  writeFileSync(file('table-felt.jpg'), buf)
  console.log('  ✓ table-felt.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking memory art →')
bakeCardBack()
bakeCardFace()
bakeTable()
console.log('Done.')
