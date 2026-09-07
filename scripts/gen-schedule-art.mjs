// Bakes the "סדר יום" (visual schedule / TEACCH-Choiceworks) materials as REAL
// raster art with baked soft lighting + grain/AO — never flat CSS shapes or
// gradients standing in for a material. A calm laminated routine card sitting
// on a warm wooden shelf rail:
//
//   • card-base.png — a chunky rounded CARD/TILE: warm cream cardstock with a
//                   baked paper-fibre grain, a soft bevelled edge (lit
//                   top-left, shaded bottom-right), a faint corner-punch hole
//                   (a laminated routine-card detail) and a baked contact
//                   shadow so it sits proud of the shelf. ONE neutral bake —
//                   the runtime overlays the emoji + Hebrew name as crisp CSS
//                   text, and washes state (current/done/upcoming) on top via
//                   a CSS colour-mix tint + filter, same "one baked sprite,
//                   many washes" pattern as calc-key.png.
//   • shelf-rail.jpg (→ public/art/bg) — the strip's own grounded surface: a
//                   warm oak shelf rail in shallow perspective (a receding
//                   top face + a thick front lip, baked plank grain,
//                   converging seams, far AO, a lit near edge) so the card
//                   strip visually sits IN a shelf, not on a flat CSS bar.
//                   Rendered narrow + wide (a horizontal strip, not a room).
//
// Same pipeline as the letter-hunt / calc materials: an original @napi-rs/
// canvas bake with seeded value-noise material grain and analytic baked
// lighting/AO. No third-party art — everything here is original CC0. Muted,
// sensory-calm warm palette, one consistent top-left key light.
//   node scripts/gen-schedule-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/schedule/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const fileBg = (name) => new URL(name, OUT_BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same as letterhunt) ----
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
// THE CARD — a chunky laminated routine-card tile. ONE neutral cream bake; the
// runtime overlays the emoji + Hebrew name as crisp CSS text and washes the
// current/done/upcoming state on top via CSS filter/tint (no re-bake per state).
// ============================================================================
function bakeCard(name) {
  const S = 220
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const pad = S * 0.045
  const w = S - pad * 2
  const h = S - pad * 2
  const r = w * 0.15
  const CARD = [250, 244, 230] // warm cream cardstock

  // baked contact shadow so the card sits proud of the shelf under it
  ctx.save()
  ctx.translate(S / 2, S - pad * 0.7)
  ctx.scale(1, 0.22)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.62)
  sh.addColorStop(0, 'rgba(60,42,20,0.34)')
  sh.addColorStop(0.65, 'rgba(60,42,20,0.16)')
  sh.addColorStop(1, 'rgba(60,42,20,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // card body with a soft key-light gradient (lit top-left, gentle AO bottom-right)
  roundRectPath(ctx, pad, pad, w, h, r)
  ctx.save()
  let g = ctx.createLinearGradient(pad, pad, pad + w, pad + h)
  g.addColorStop(0, rgb(mix(CARD, [255, 255, 250], 0.55)))
  g.addColorStop(0.5, rgb(CARD))
  g.addColorStop(1, rgb(mix(CARD, [180, 160, 128], 0.28)))
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()

  // paper-fibre streaks (very subtle — cardstock, not wood)
  for (let i = 0; i < 30; i++) {
    const gx = pad + Math.random() * w
    const gy = pad + Math.random() * h
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,252,244,0.35)' : 'rgba(150,132,100,0.14)'
    ctx.lineWidth = 0.5 + Math.random() * 1.1
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + R(10), gy + R(10))
    ctx.stroke()
  }
  // soft top-left key-light bloom (laminate sheen)
  const bloom = ctx.createRadialGradient(pad + w * 0.28, pad + h * 0.24, 0, pad + w * 0.28, pad + h * 0.24, w * 0.85)
  bloom.addColorStop(0, 'rgba(255,255,250,0.42)')
  bloom.addColorStop(1, 'rgba(255,255,250,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(pad, pad, w, h)
  // gentle bottom-right AO pool
  const ao = ctx.createRadialGradient(pad + w * 0.82, pad + h * 0.86, 0, pad + w * 0.82, pad + h * 0.86, w * 0.7)
  ao.addColorStop(0, 'rgba(90,68,36,0.16)')
  ao.addColorStop(1, 'rgba(90,68,36,0)')
  ctx.fillStyle = ao
  ctx.fillRect(pad, pad, w, h)
  ctx.restore()

  // a shallow "content window" recess (upper 62%) where the emoji sits — a
  // laminated card's printed picture panel, gently sunken with its own AO ring
  const winPad = w * 0.1
  const winX = pad + winPad
  const winY = pad + h * 0.08
  const winW = w - winPad * 2
  const winH = h * 0.56
  const winR = winW * 0.12
  roundRectPath(ctx, winX - 2, winY - 2, winW + 4, winH + 4, winR + 2)
  ctx.save()
  ctx.clip()
  const winAo = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH)
  winAo.addColorStop(0, 'rgba(120,96,56,0.28)')
  winAo.addColorStop(0.4, 'rgba(120,96,56,0.08)')
  winAo.addColorStop(1, 'rgba(120,96,56,0)')
  ctx.fillStyle = winAo
  ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4)
  ctx.restore()
  roundRectPath(ctx, winX, winY, winW, winH, winR)
  ctx.save()
  ctx.clip()
  const winG = ctx.createLinearGradient(winX, winY, winX, winY + winH)
  winG.addColorStop(0, rgb(mix(CARD, [130, 108, 70], 0.14)))
  winG.addColorStop(1, rgb(mix(CARD, [255, 255, 250], 0.5)))
  ctx.fillStyle = winG
  ctx.fillRect(winX, winY, winW, winH)
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, winX, winY, winW, winH, winR)
  ctx.lineWidth = S * 0.008
  const winRim = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH)
  winRim.addColorStop(0, 'rgba(90,68,36,0.32)')
  winRim.addColorStop(0.5, 'rgba(90,68,36,0.05)')
  winRim.addColorStop(1, 'rgba(255,255,250,0.4)')
  ctx.strokeStyle = winRim
  ctx.stroke()
  ctx.restore()

  // a small punched corner hole (top-inline-start) — a laminated routine-card
  // detail; baked so it never needs re-rendering per state
  const holeR = S * 0.028
  const holeX = pad + w * 0.135
  const holeY = pad + h * 0.11
  ctx.save()
  ctx.beginPath()
  ctx.arc(holeX, holeY, holeR, 0, Math.PI * 2)
  const holeSh = ctx.createRadialGradient(holeX, holeY, 0, holeX, holeY, holeR * 1.4)
  holeSh.addColorStop(0, 'rgba(70,52,26,0.4)')
  holeSh.addColorStop(1, 'rgba(70,52,26,0)')
  ctx.fillStyle = holeSh
  ctx.fill()
  ctx.beginPath()
  ctx.arc(holeX, holeY, holeR * 0.72, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(196,178,148,0.9)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(120,96,56,0.4)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // crisp bevel rim on the card edge (bright top-left, dark bottom-right)
  ctx.save()
  roundRectPath(ctx, pad, pad, w, h, r)
  ctx.lineWidth = S * 0.02
  const bev = ctx.createLinearGradient(pad, pad, pad + w, pad + h)
  bev.addColorStop(0, 'rgba(255,255,250,0.7)')
  bev.addColorStop(0.5, 'rgba(255,255,250,0.06)')
  bev.addColorStop(0.52, 'rgba(90,68,36,0.05)')
  bev.addColorStop(1, 'rgba(90,68,36,0.4)')
  ctx.strokeStyle = bev
  ctx.stroke()
  ctx.restore()
  // a hairline outer edge so the card reads crisp against any backdrop
  ctx.save()
  roundRectPath(ctx, pad, pad, w, h, r)
  ctx.lineWidth = 1.4
  ctx.strokeStyle = 'rgba(120,96,56,0.28)'
  ctx.stroke()
  ctx.restore()

  grainPass(ctx, S, S, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SHELF RAIL — the strip's own grounded surface: a warm oak rail in
// shallow perspective the cards visually sit in/on. A short horizontal band
// (not a full room) tiled behind `.sch-strip-wrap`. Baked plank grain,
// converging seams, far AO, lit near edge + a thick front lip for depth.
// ============================================================================
function bakeShelf(name) {
  const W = 900
  const H = 220
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')

  const OAK = [180, 140, 92]
  const OAK_DK = [128, 92, 54]
  const OAK_LT = [206, 168, 114]

  const topY = 14 // far (back) edge of the rail's top face
  const botY = 150 // near (front) edge of the top face
  const lipH = 46 // front lip thickness (the rail's visible thickness)

  // opaque base fill first (JPEG has no alpha)
  x.fillStyle = rgb(mix(OAK_DK, [40, 28, 16], 0.3))
  x.fillRect(0, 0, W, H)

  // soft ambient wash behind the rail (a calm neutral backing, not a full wall)
  const back = x.createLinearGradient(0, 0, 0, topY + 10)
  back.addColorStop(0, 'rgba(214,206,192,0.9)')
  back.addColorStop(1, 'rgba(190,182,168,0.9)')
  x.fillStyle = back
  x.fillRect(0, 0, W, topY + 10)

  // --- TOP face (shallow receding trapezoid — subtle, it's a shelf not a table) ---
  const inset = 10 // how much the far edge narrows in from the sides (perspective)
  x.beginPath()
  x.moveTo(inset, topY)
  x.lineTo(W - inset, topY)
  x.lineTo(W, botY)
  x.lineTo(0, botY)
  x.closePath()
  x.save()
  x.clip()
  const g = x.createLinearGradient(0, topY, 0, botY)
  g.addColorStop(0, rgb(OAK_DK))
  g.addColorStop(0.55, rgb(OAK))
  g.addColorStop(1, rgb(OAK_LT))
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  // horizontal plank grain
  for (let i = 0; i < 28; i++) {
    const yy = topY + Math.random() * (botY - topY)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,86,50,0.22)' : 'rgba(220,188,140,0.22)'
    x.lineWidth = 0.8 + Math.random() * 2
    x.beginPath()
    x.moveTo(0, yy)
    for (let sx = 0; sx <= W; sx += 50) x.lineTo(sx, yy + R(4))
    x.stroke()
  }
  // plank seams converging gently toward the far edge (perspective lines)
  x.strokeStyle = 'rgba(74,50,24,0.32)'
  x.lineWidth = 2
  const seamCount = 10
  for (let i = 1; i < seamCount; i++) {
    const fx = i / seamCount
    const farX = inset + fx * (W - inset * 2)
    const nearX = fx * W
    x.beginPath()
    x.moveTo(farX, topY)
    x.lineTo(nearX, botY)
    x.stroke()
  }
  // far-edge ambient occlusion (the back of the shelf sits in shade)
  const ao = x.createLinearGradient(0, topY, 0, topY + 30)
  ao.addColorStop(0, 'rgba(44,28,12,0.42)')
  ao.addColorStop(1, 'rgba(44,28,12,0)')
  x.fillStyle = ao
  x.fillRect(0, topY, W, 30)
  // soft key light pooling toward the near-left
  const kl = x.createRadialGradient(W * 0.24, botY - 30, 20, W * 0.24, botY - 30, W * 0.5)
  kl.addColorStop(0, 'rgba(255,246,220,0.16)')
  kl.addColorStop(1, 'rgba(255,246,220,0)')
  x.fillStyle = kl
  x.fillRect(0, 0, W, H)
  x.restore()

  // --- FRONT LIP (the rail's thickness) ---
  x.beginPath()
  x.moveTo(0, botY)
  x.lineTo(W, botY)
  x.lineTo(W, botY + lipH)
  x.lineTo(0, botY + lipH)
  x.closePath()
  x.save()
  x.clip()
  const lg = x.createLinearGradient(0, botY, 0, botY + lipH)
  lg.addColorStop(0, rgb(mix(OAK, [255, 255, 255], 0.05)))
  lg.addColorStop(1, rgb(mix(OAK_DK, [20, 12, 6], 0.34)))
  x.fillStyle = lg
  x.fillRect(0, botY, W, lipH)
  for (let i = 0; i < 42; i++) {
    const gx = Math.random() * W
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(228,196,148,0.16)' : 'rgba(58,36,16,0.2)'
    x.lineWidth = 0.7 + Math.random() * 1.6
    x.beginPath()
    x.moveTo(gx, botY)
    x.lineTo(gx + R(3), botY + lipH)
    x.stroke()
  }
  x.restore()
  // crisp lit near-edge (top of the lip catches the light)
  x.strokeStyle = 'rgba(255,242,214,0.75)'
  x.lineWidth = 2.4
  x.beginPath()
  x.moveTo(0, botY)
  x.lineTo(W, botY)
  x.stroke()
  // dark base line under the lip (grounds the rail against the page below)
  x.strokeStyle = 'rgba(28,16,6,0.5)'
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(0, botY + lipH)
  x.lineTo(W, botY + lipH)
  x.stroke()
  // soft cast shadow just under the lip
  const cast = x.createLinearGradient(0, botY + lipH, 0, botY + lipH + 16)
  cast.addColorStop(0, 'rgba(20,12,4,0.28)')
  cast.addColorStop(1, 'rgba(20,12,4,0)')
  x.fillStyle = cast
  x.fillRect(0, botY + lipH, W, 16)

  grainPass(x, W, H, 0.038)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(fileBg(name), buf)
  console.log('  ✓ bg/' + name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking schedule art →')
bakeCard('card-base.png')
bakeShelf('shelf-rail.jpg')
console.log('Done.')
