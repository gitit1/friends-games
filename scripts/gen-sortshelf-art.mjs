// Bakes the "מכולת" (grocery shelf-sort) materials — REAL wooden shelves + baked,
// lit grocery goods + a locked crate + a mystery box + a calm shop backdrop, NOT
// flat CSS shapes/emoji.
//
//   shelf.png      — a wooden LEDGE the goods rest on: a lit receding top face, a
//                    thick front bevel (real depth / camera-above angle), grain and
//                    a baked contact shadow. Stretched per shelf bin.
//   crate.png      — a slatted wooden CRATE for a locked shelf (reads "closed").
//   mystery.png    — a small kraft cardboard box (the hidden / queued good).
//   good-*.png     — 12 grocery goods, each a shaded object with a top-left key
//                    light, bottom-right AO, a specular sheen and its OWN soft
//                    contact shadow so it sits on the shelf. Muted, sensory-calm.
//   bg/sortshelf-shop.jpg — a calm, low-contrast grocery interior (soft blurred
//                    shelves of muted goods, warm light) so the foreground pops.
//
// Same pipeline as the dice / pattern / coin-sort materials: an original
// @napi-rs/canvas bake with seeded value-noise grain and analytic baked
// lighting/AO. No third-party art (CC0). One-off build tool:
//   node scripts/gen-sortshelf-art.mjs   (@napi-rs/canvas is already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const SPR = new URL('../public/art/sprites/sortshelf/', import.meta.url)
const BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(SPR, { recursive: true })
const file = (name) => new URL(name, SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
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
  const lerpN = (a, b, t) => a + t * (b - a)
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
    const x1 = lerpN(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerpN(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerpN(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const grain = makeNoise(20260718)

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
// light material grain over every painted pixel (kills the "flat CSS" read)
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
function grainStreaks(ctx, x, y, w, h, n, light, dark) {
  for (let i = 0; i < n; i++) {
    const gy = y + Math.random() * h
    ctx.strokeStyle = Math.random() < 0.5 ? light : dark
    ctx.globalAlpha = 0.05 + Math.random() * 0.1
    ctx.lineWidth = 0.6 + Math.random() * 1.4
    ctx.beginPath()
    ctx.moveTo(x, gy)
    for (let sx = x; sx <= x + w; sx += 26) ctx.lineTo(sx, gy + (Math.random() - 0.5) * 2.4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ---- shared building blocks -------------------------------------------------
// a soft baked contact shadow ellipse on the surface, under an object
function contactShadow(ctx, cx, cy, rx, ry, a = 0.3) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, `rgba(24,18,10,${a})`)
  g.addColorStop(0.62, `rgba(24,18,10,${a * 0.5})`)
  g.addColorStop(1, 'rgba(24,18,10,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
// a shaded sphere (key light top-left, AO bottom-right, specular gloss)
function sphere(ctx, cx, cy, r, base, { spec = 0.85, squashY = 1 } = {}) {
  const hlx = cx - r * 0.34
  const hly = cy - r * 0.4
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * squashY, 0, 0, Math.PI * 2)
  ctx.clip()
  let g = ctx.createRadialGradient(hlx, hly, r * 0.06, cx, cy, r * 1.18)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.5)))
  g.addColorStop(0.42, rgb(base))
  g.addColorStop(0.82, rgb(mix(base, [30, 22, 24], 0.3)))
  g.addColorStop(1, rgb(mix(base, [22, 16, 20], 0.5)))
  ctx.fillStyle = g
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // bounce / rim light lower-right
  const rim = ctx.createRadialGradient(cx + r * 0.5, cy + r * 0.6, r * 0.02, cx + r * 0.5, cy + r * 0.6, r * 0.7)
  rim.addColorStop(0, rgb(mix(base, [255, 250, 240], 0.3), 0.45))
  rim.addColorStop(1, rgb(base, 0))
  ctx.fillStyle = rim
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // specular gloss
  const sp = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, r * 0.5)
  sp.addColorStop(0, `rgba(255,255,255,${spec})`)
  sp.addColorStop(0.5, `rgba(255,255,255,${spec * 0.3})`)
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sp
  ctx.beginPath()
  ctx.ellipse(hlx, hly, r * 0.4, r * 0.3, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const GS = 150 // grocery good canvas
// helper: new good canvas with a contact shadow already laid down
function goodCanvas() {
  const cv = createCanvas(GS, GS)
  const ctx = cv.getContext('2d')
  return { cv, ctx }
}
function saveGood(cv, name) {
  const ctx = cv.getContext('2d')
  grainPass(ctx, GS, GS, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${GS}×${GS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// GROCERY GOODS (muted, sensory-calm palette)
// ============================================================================
function bakeApple() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const cy = GS * 0.56
  const r = GS * 0.33
  contactShadow(ctx, cx, cy + r * 0.98, r * 0.92, r * 0.28)
  // stem
  ctx.strokeStyle = rgb([96, 66, 40])
  ctx.lineWidth = GS * 0.028
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + 2, cy - r * 0.95)
  ctx.quadraticCurveTo(cx + 5, cy - r * 1.25, cx - 3, cy - r * 1.34)
  ctx.stroke()
  // leaf
  ctx.save()
  ctx.translate(cx + r * 0.36, cy - r * 1.16)
  ctx.rotate(-0.5)
  const lg = ctx.createLinearGradient(-10, 0, 12, 6)
  lg.addColorStop(0, rgb([120, 158, 96]))
  lg.addColorStop(1, rgb([86, 128, 68]))
  ctx.fillStyle = lg
  ctx.beginPath()
  ctx.ellipse(0, 0, 15, 8, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // body (slightly heart-topped apple)
  sphere(ctx, cx, cy, r, [196, 66, 58])
  // top dimple shadow
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2)
  ctx.clip()
  const dip = ctx.createRadialGradient(cx, cy - r * 0.9, 1, cx, cy - r * 0.9, r * 0.5)
  dip.addColorStop(0, 'rgba(60,20,18,0.5)')
  dip.addColorStop(1, 'rgba(60,20,18,0)')
  ctx.fillStyle = dip
  ctx.fillRect(cx - r, cy - r, r * 2, r)
  ctx.restore()
  saveGood(cv, 'good-apple.png')
}

function bakeTomato() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const cy = GS * 0.57
  const r = GS * 0.34
  contactShadow(ctx, cx, cy + r * 0.9, r * 0.95, r * 0.26)
  sphere(ctx, cx, cy, r, [206, 74, 58], { squashY: 0.9 })
  // green star calyx on top
  ctx.save()
  ctx.translate(cx, cy - r * 0.78)
  ctx.fillStyle = rgb([104, 138, 78])
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(4, -6, 0, -15)
    ctx.quadraticCurveTo(-4, -6, 0, 0)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fillStyle = rgb([120, 152, 88])
  ctx.fill()
  ctx.restore()
  saveGood(cv, 'good-tomato.png')
}

function bakeBanana() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const cy = GS * 0.5
  contactShadow(ctx, cx, GS * 0.8, GS * 0.34, GS * 0.08)
  // a SOLID banana crescent (belly down), tapering to two points — no hole
  const leftTip = [cx - GS * 0.37, cy - GS * 0.04]
  const rightTip = [cx + GS * 0.37, cy - GS * 0.04]
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(leftTip[0], leftTip[1])
  // bottom belly edge (the fat underside)
  ctx.quadraticCurveTo(cx - GS * 0.26, cy + GS * 0.32, cx, cy + GS * 0.33)
  ctx.quadraticCurveTo(cx + GS * 0.26, cy + GS * 0.32, rightTip[0], rightTip[1])
  // top edge back to the left tip (shallower → gives real thickness)
  ctx.quadraticCurveTo(cx + GS * 0.22, cy + GS * 0.05, cx, cy + GS * 0.06)
  ctx.quadraticCurveTo(cx - GS * 0.22, cy + GS * 0.05, leftTip[0], leftTip[1])
  ctx.closePath()
  ctx.clip()
  const g = ctx.createLinearGradient(0, cy - GS * 0.06, 0, cy + GS * 0.33)
  g.addColorStop(0, rgb([236, 214, 118]))
  g.addColorStop(0.45, rgb([224, 192, 86]))
  g.addColorStop(1, rgb([170, 132, 54]))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, GS, GS)
  // lengthwise highlight ridge along the top belly
  ctx.strokeStyle = 'rgba(255,250,224,0.55)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - GS * 0.24, cy + GS * 0.14)
  ctx.quadraticCurveTo(cx, cy + GS * 0.26, cx + GS * 0.24, cy + GS * 0.14)
  ctx.stroke()
  // soft facet shade on the lower edge
  ctx.strokeStyle = 'rgba(140,102,40,0.4)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cx - GS * 0.28, cy + GS * 0.2)
  ctx.quadraticCurveTo(cx, cy + GS * 0.34, cx + GS * 0.28, cy + GS * 0.2)
  ctx.stroke()
  ctx.restore()
  // brown tips at both ends
  ctx.fillStyle = rgb([104, 74, 40])
  for (const [tx, ty] of [leftTip, rightTip]) {
    ctx.beginPath()
    ctx.ellipse(tx, ty, 6, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  saveGood(cv, 'good-banana.png')
}

// a simple lit box (carton) — used by milk (gable) & juice (straw)
function bakeCarton(name, body, label, opts = {}) {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const w = GS * 0.42
  const h = GS * 0.56
  const x = cx - w / 2
  const gableH = opts.gable ? GS * 0.14 : 0
  const y = GS * 0.24 + gableH * 0.2
  contactShadow(ctx, cx, y + h + 6, w * 0.62, GS * 0.07)
  // gable roof (milk)
  if (opts.gable) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(cx, y - gableH)
    ctx.lineTo(x + w, y)
    ctx.closePath()
    const rg = ctx.createLinearGradient(x, y - gableH, x + w, y)
    rg.addColorStop(0, rgb(mix(body, [255, 255, 255], 0.34)))
    rg.addColorStop(1, rgb(mix(body, [20, 24, 34], 0.18)))
    ctx.fillStyle = rg
    ctx.fill()
    // fold crease
    ctx.strokeStyle = 'rgba(40,44,54,0.25)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx, y - gableH)
    ctx.lineTo(cx, y)
    ctx.stroke()
  }
  // body
  roundRectPath(ctx, x, y, w, h, 8)
  const g = ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, rgb(mix(body, [255, 255, 255], 0.28)))
  g.addColorStop(0.5, rgb(body))
  g.addColorStop(1, rgb(mix(body, [22, 26, 36], 0.26)))
  ctx.fillStyle = g
  ctx.fill()
  // top light + bottom AO
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 8)
  ctx.clip()
  const sh = ctx.createLinearGradient(0, y, 0, y + h)
  sh.addColorStop(0, 'rgba(255,255,255,0.14)')
  sh.addColorStop(0.5, 'rgba(0,0,0,0)')
  sh.addColorStop(1, 'rgba(18,20,30,0.24)')
  ctx.fillStyle = sh
  ctx.fillRect(x, y, w, h)
  // label band
  const ly = y + h * 0.42
  ctx.fillStyle = rgb(label)
  roundRectPath(ctx, x + 3, ly, w - 6, h * 0.3, 4)
  ctx.fill()
  // a white droplet on the label
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.beginPath()
  ctx.moveTo(cx, ly + h * 0.06)
  ctx.quadraticCurveTo(cx + 7, ly + h * 0.16, cx, ly + h * 0.24)
  ctx.quadraticCurveTo(cx - 7, ly + h * 0.16, cx, ly + h * 0.06)
  ctx.fill()
  ctx.restore()
  // straw (juice)
  if (opts.straw) {
    ctx.strokeStyle = rgb([214, 96, 92])
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx + w * 0.24, y + 6)
    ctx.lineTo(cx + w * 0.44, y - GS * 0.16)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(cx + w * 0.24, y + 6)
    ctx.lineTo(cx + w * 0.44, y - GS * 0.16)
    ctx.stroke()
  }
  saveGood(cv, name)
}

function bakeBread() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const cy = GS * 0.6
  const w = GS * 0.38
  contactShadow(ctx, cx, cy + GS * 0.2, GS * 0.36, GS * 0.09)
  // loaf: a rounded dome
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - w, cy + GS * 0.14)
  ctx.quadraticCurveTo(cx - w, cy - GS * 0.24, cx, cy - GS * 0.24)
  ctx.quadraticCurveTo(cx + w, cy - GS * 0.24, cx + w, cy + GS * 0.14)
  ctx.quadraticCurveTo(cx, cy + GS * 0.22, cx - w, cy + GS * 0.14)
  ctx.closePath()
  ctx.clip()
  const g = ctx.createLinearGradient(0, cy - GS * 0.24, 0, cy + GS * 0.2)
  g.addColorStop(0, rgb([214, 168, 108]))
  g.addColorStop(0.55, rgb([190, 140, 82]))
  g.addColorStop(1, rgb([150, 104, 58]))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, GS, GS)
  // top-left key light
  const hl = ctx.createRadialGradient(cx - w * 0.4, cy - GS * 0.16, 4, cx - w * 0.4, cy - GS * 0.16, w)
  hl.addColorStop(0, 'rgba(255,238,206,0.4)')
  hl.addColorStop(1, 'rgba(255,238,206,0)')
  ctx.fillStyle = hl
  ctx.fillRect(0, 0, GS, GS)
  // score slashes on the crust
  ctx.strokeStyle = 'rgba(120,78,40,0.5)'
  ctx.lineWidth = 3
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * w * 0.5 - 8, cy - GS * 0.14)
    ctx.lineTo(cx + i * w * 0.5 + 8, cy + GS * 0.02)
    ctx.stroke()
  }
  ctx.restore()
  saveGood(cv, 'good-bread.png')
}

function bakeCheese() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const baseY = GS * 0.72
  const topY = GS * 0.34
  const leftX = GS * 0.2
  const rightX = GS * 0.8
  contactShadow(ctx, cx, baseY + 8, GS * 0.34, GS * 0.08)
  const YEL = [230, 196, 96]
  // top face (thin slanted lid)
  ctx.beginPath()
  ctx.moveTo(leftX, topY + 8)
  ctx.lineTo(rightX, topY)
  ctx.lineTo(rightX - 6, topY + 12)
  ctx.lineTo(leftX + 4, topY + 20)
  ctx.closePath()
  ctx.fillStyle = rgb(mix(YEL, [255, 255, 255], 0.28))
  ctx.fill()
  // front wedge face
  ctx.beginPath()
  ctx.moveTo(leftX + 4, topY + 20)
  ctx.lineTo(rightX - 6, topY + 12)
  ctx.lineTo(rightX - 6, baseY)
  ctx.lineTo(leftX + 4, baseY - 6)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, topY, 0, baseY)
  g.addColorStop(0, rgb(YEL))
  g.addColorStop(1, rgb(mix(YEL, [120, 84, 20], 0.32)))
  ctx.fillStyle = g
  ctx.fill()
  // holes on the front face
  ctx.fillStyle = rgb(mix(YEL, [120, 84, 20], 0.42))
  for (const [hx, hy, hr] of [
    [0.4, 0.5, 8],
    [0.6, 0.58, 6],
    [0.5, 0.66, 5],
  ]) {
    ctx.beginPath()
    ctx.ellipse(GS * hx, GS * hy, hr, hr * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  saveGood(cv, 'good-cheese.png')
}

function bakeCarrot() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const topY = GS * 0.34
  const tipY = GS * 0.82
  const halfW = GS * 0.15
  contactShadow(ctx, cx, tipY + 2, GS * 0.26, GS * 0.07)
  // green leafy top
  ctx.strokeStyle = rgb([104, 146, 74])
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  for (const dx of [-10, 0, 10]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * 0.3, topY + 4)
    ctx.quadraticCurveTo(cx + dx, topY - 22, cx + dx * 1.6, topY - 34)
    ctx.stroke()
  }
  // cone body
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - halfW, topY)
  ctx.quadraticCurveTo(cx + halfW * 1.1, topY - 4, cx + halfW, topY + 4)
  ctx.lineTo(cx, tipY)
  ctx.closePath()
  ctx.clip()
  const g = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0)
  g.addColorStop(0, rgb(mix([220, 132, 56], [255, 240, 210], 0.28)))
  g.addColorStop(0.5, rgb([216, 126, 52]))
  g.addColorStop(1, rgb(mix([216, 126, 52], [120, 56, 16], 0.34)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, GS, GS)
  // ridge lines
  ctx.strokeStyle = 'rgba(150,70,20,0.35)'
  ctx.lineWidth = 2
  for (let i = 1; i <= 5; i++) {
    const yy = lerp(topY + 8, tipY - 6, i / 6)
    const ww = lerp(halfW, 2, i / 6)
    ctx.beginPath()
    ctx.moveTo(cx - ww, yy)
    ctx.lineTo(cx + ww, yy - 3)
    ctx.stroke()
  }
  ctx.restore()
  saveGood(cv, 'good-carrot.png')
}

function bakeCookie() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const cy = GS * 0.56
  const r = GS * 0.33
  contactShadow(ctx, cx, cy + r * 0.86, r * 0.96, r * 0.24)
  // disc with a slight dome
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.34, r * 0.1, cx, cy, r * 1.15)
  g.addColorStop(0, rgb([214, 168, 108]))
  g.addColorStop(0.6, rgb([196, 148, 90]))
  g.addColorStop(1, rgb([158, 112, 62]))
  ctx.fillStyle = g
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  // choc chips
  const chips = [
    [-0.3, -0.2, 7],
    [0.28, -0.28, 6],
    [0.1, 0.14, 8],
    [-0.28, 0.28, 6],
    [0.34, 0.24, 5],
    [0.02, -0.4, 5],
  ]
  for (const [dx, dy, cr] of chips) {
    const x = cx + dx * r
    const y = cy + dy * r
    const cg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, cr)
    cg.addColorStop(0, rgb([104, 68, 44]))
    cg.addColorStop(1, rgb([64, 40, 26]))
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.arc(x, y, cr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // rim definition
  ctx.strokeStyle = 'rgba(120,80,44,0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
  ctx.stroke()
  saveGood(cv, 'good-cookie.png')
}

function bakeChoco() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const cy = GS * 0.54
  const w = GS * 0.46
  const h = GS * 0.5
  const x = cx - w / 2
  const y = cy - h / 2
  contactShadow(ctx, cx, y + h + 6, w * 0.62, GS * 0.07)
  // wrapper base bar
  roundRectPath(ctx, x, y, w, h, 6)
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, rgb([128, 88, 58]))
  g.addColorStop(0.5, rgb([104, 70, 46]))
  g.addColorStop(1, rgb([74, 48, 30]))
  ctx.fillStyle = g
  ctx.fill()
  // embossed squares (3x3)
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 6)
  ctx.clip()
  const cols = 3
  const rows = 3
  const gap = 3
  const cw = (w - gap * (cols + 1)) / cols
  const ch = (h - gap * (rows + 1)) / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = x + gap + c * (cw + gap)
      const sy = y + gap + r * (ch + gap)
      const sg = ctx.createLinearGradient(sx, sy, sx + cw, sy + ch)
      sg.addColorStop(0, rgb([140, 98, 64]))
      sg.addColorStop(1, rgb([88, 58, 36]))
      ctx.fillStyle = sg
      roundRectPath(ctx, sx, sy, cw, ch, 2)
      ctx.fill()
      // top-left bevel light
      ctx.strokeStyle = 'rgba(255,230,200,0.18)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(sx + 1, sy + ch - 1)
      ctx.lineTo(sx + 1, sy + 1)
      ctx.lineTo(sx + cw - 1, sy + 1)
      ctx.stroke()
    }
  }
  ctx.restore()
  saveGood(cv, 'good-choco.png')
}

function bakeGrapes() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const top = GS * 0.34
  const gr = GS * 0.1
  contactShadow(ctx, cx, GS * 0.84, GS * 0.28, GS * 0.07)
  // stem + leaf
  ctx.strokeStyle = rgb([110, 84, 50])
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, top)
  ctx.lineTo(cx + 2, top - 14)
  ctx.stroke()
  ctx.save()
  ctx.translate(cx + 10, top - 12)
  ctx.rotate(-0.4)
  ctx.fillStyle = rgb([110, 150, 88])
  ctx.beginPath()
  ctx.ellipse(0, 0, 12, 7, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // cluster of orbs (triangle)
  const PUR = [138, 108, 170]
  const rows = [
    [-2, -1, 0, 1, 2],
    [-1.5, -0.5, 0.5, 1.5],
    [-1, 0, 1],
    [-0.5, 0.5],
    [0],
  ]
  rows.forEach((row, ri) => {
    const y = top + gr + ri * gr * 1.5
    row.forEach((c) => {
      sphere(ctx, cx + c * gr * 1.7, y, gr, PUR, { spec: 0.7 })
    })
  })
  saveGood(cv, 'good-grapes.png')
}

function bakeCupcake() {
  const { cv, ctx } = goodCanvas()
  const cx = GS * 0.5
  const wrapTop = GS * 0.54
  const wrapBot = GS * 0.8
  const wrapHalf = GS * 0.24
  contactShadow(ctx, cx, wrapBot + 4, GS * 0.3, GS * 0.07)
  // wrapper (trapezoid, ridged)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - wrapHalf, wrapTop)
  ctx.lineTo(cx + wrapHalf, wrapTop)
  ctx.lineTo(cx + wrapHalf * 0.72, wrapBot)
  ctx.lineTo(cx - wrapHalf * 0.72, wrapBot)
  ctx.closePath()
  ctx.clip()
  const g = ctx.createLinearGradient(cx - wrapHalf, 0, cx + wrapHalf, 0)
  g.addColorStop(0, rgb([206, 158, 96]))
  g.addColorStop(0.5, rgb([186, 136, 76]))
  g.addColorStop(1, rgb([150, 104, 56]))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, GS, GS)
  // vertical ridges
  ctx.strokeStyle = 'rgba(120,78,40,0.32)'
  ctx.lineWidth = 2
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * 8, wrapTop)
    ctx.lineTo(cx + i * 6, wrapBot)
    ctx.stroke()
  }
  ctx.restore()
  // frosting swirl (dome) — muted pink
  const PINK = [224, 168, 176]
  const fy = wrapTop
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - wrapHalf - 2, fy + 2)
  ctx.quadraticCurveTo(cx - wrapHalf, fy - GS * 0.24, cx, fy - GS * 0.26)
  ctx.quadraticCurveTo(cx + wrapHalf, fy - GS * 0.24, cx + wrapHalf + 2, fy + 2)
  ctx.closePath()
  ctx.clip()
  const fg = ctx.createLinearGradient(0, fy - GS * 0.26, 0, fy + 4)
  fg.addColorStop(0, rgb(mix(PINK, [255, 255, 255], 0.4)))
  fg.addColorStop(0.5, rgb(PINK))
  fg.addColorStop(1, rgb(mix(PINK, [140, 80, 96], 0.3)))
  ctx.fillStyle = fg
  ctx.fillRect(0, 0, GS, GS)
  // swirl highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 3
  for (let i = 0; i < 3; i++) {
    const yy = fy - 6 - i * 12
    ctx.beginPath()
    ctx.moveTo(cx - wrapHalf * 0.7, yy)
    ctx.quadraticCurveTo(cx, yy - 8, cx + wrapHalf * 0.7, yy)
    ctx.stroke()
  }
  ctx.restore()
  // cherry
  sphere(ctx, cx, fy - GS * 0.26, 8, [188, 62, 66], { spec: 0.8 })
  saveGood(cv, 'good-cupcake.png')
}

// ============================================================================
// THE SHELF LEDGE — a wooden shelf with a receding lit top + front bevel depth
// ============================================================================
const WOOD = [180, 134, 82]
function bakeShelf() {
  const W = 360
  const H = 150
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const topY = 18
  const faceH = 82 // the top surface (where goods sit)
  const bevelH = 30 // the front thickness
  // drop shadow beneath the whole shelf
  const ds = ctx.createLinearGradient(0, topY + faceH + bevelH, 0, H)
  ds.addColorStop(0, 'rgba(20,14,6,0.32)')
  ds.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ds
  ctx.fillRect(0, topY + faceH + bevelH, W, H - (topY + faceH + bevelH))
  // top face (a trapezoid: far edge shorter → receding perspective)
  const inset = 26
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(inset, topY)
  ctx.lineTo(W - inset, topY)
  ctx.lineTo(W - 6, topY + faceH)
  ctx.lineTo(6, topY + faceH)
  ctx.closePath()
  ctx.clip()
  let g = ctx.createLinearGradient(0, topY, 0, topY + faceH)
  g.addColorStop(0, rgb(mix(WOOD, [40, 26, 10], 0.3))) // far edge darker (AO)
  g.addColorStop(0.35, rgb(mix(WOOD, [255, 240, 210], 0.18)))
  g.addColorStop(1, rgb(mix(WOOD, [255, 244, 214], 0.08)))
  ctx.fillStyle = g
  ctx.fillRect(0, topY, W, faceH)
  grainStreaks(ctx, 0, topY, W, faceH, 54, rgb(mix(WOOD, [255, 240, 210], 0.4)), rgb(mix(WOOD, [30, 18, 6], 0.5)))
  // near light pool where goods sit
  const lp = ctx.createRadialGradient(W / 2, topY + faceH - 6, 16, W / 2, topY + faceH - 4, W * 0.5)
  lp.addColorStop(0, 'rgba(255,242,212,0.22)')
  lp.addColorStop(1, 'rgba(255,242,212,0)')
  ctx.fillStyle = lp
  ctx.fillRect(0, topY, W, faceH)
  ctx.restore()
  // front bevel (thickness)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(6, topY + faceH)
  ctx.lineTo(W - 6, topY + faceH)
  ctx.lineTo(W - 6, topY + faceH + bevelH)
  ctx.lineTo(6, topY + faceH + bevelH)
  ctx.closePath()
  ctx.clip()
  const fbg = ctx.createLinearGradient(0, topY + faceH, 0, topY + faceH + bevelH)
  fbg.addColorStop(0, rgb(mix(WOOD, [30, 18, 6], 0.34)))
  fbg.addColorStop(1, rgb(mix(WOOD, [18, 11, 4], 0.54)))
  ctx.fillStyle = fbg
  ctx.fillRect(0, topY + faceH, W, bevelH)
  grainStreaks(ctx, 0, topY + faceH, W, bevelH, 24, rgb(mix(WOOD, [220, 180, 120], 0.4)), rgb(mix(WOOD, [16, 10, 4], 0.6)))
  ctx.restore()
  // lit near lip where top meets bevel
  ctx.strokeStyle = 'rgba(255,244,214,0.6)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(8, topY + faceH + 1)
  ctx.lineTo(W - 8, topY + faceH + 1)
  ctx.stroke()
  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('shelf.png'), buf)
  console.log('  ✓ shelf.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE CRATE — a slatted wooden crate for a LOCKED shelf (reads "closed").
// ============================================================================
function bakeCrate() {
  const W = 360
  const H = 150
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const CW = [150, 120, 86] // greyer, cooler wood → clearly "not available"
  const x = 20
  const y = 12
  const w = W - 40
  const h = 118
  const ds = ctx.createLinearGradient(0, y + h, 0, H)
  ds.addColorStop(0, 'rgba(20,14,6,0.3)')
  ds.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ds
  ctx.fillRect(0, y + h, W, H - (y + h))
  // box
  roundRectPath(ctx, x, y, w, h, 8)
  let g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, rgb(mix(CW, [255, 250, 236], 0.16)))
  g.addColorStop(1, rgb(mix(CW, [26, 20, 12], 0.28)))
  ctx.fillStyle = g
  ctx.fill()
  // horizontal slats
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 8)
  ctx.clip()
  const slats = 4
  for (let i = 0; i < slats; i++) {
    const sy = y + 6 + i * ((h - 12) / slats)
    const sh = (h - 12) / slats - 5
    const sg = ctx.createLinearGradient(0, sy, 0, sy + sh)
    sg.addColorStop(0, rgb(mix(CW, [255, 248, 232], 0.22)))
    sg.addColorStop(1, rgb(mix(CW, [30, 24, 14], 0.24)))
    ctx.fillStyle = sg
    roundRectPath(ctx, x + 6, sy, w - 12, sh, 3)
    ctx.fill()
    grainStreaks(ctx, x + 6, sy, w - 12, sh, 8, rgb(mix(CW, [220, 210, 190], 0.4)), rgb(mix(CW, [20, 16, 10], 0.5)))
  }
  ctx.restore()
  // corner posts
  ctx.fillStyle = rgb(mix(CW, [40, 32, 20], 0.3))
  ctx.fillRect(x, y, 10, h)
  ctx.fillRect(x + w - 10, y, 10, h)
  // metal lock plate in the middle
  const lx = W / 2
  const ly = y + h / 2
  ctx.fillStyle = rgb([92, 96, 104])
  roundRectPath(ctx, lx - 16, ly - 14, 32, 28, 5)
  ctx.fill()
  ctx.fillStyle = rgb([60, 64, 72])
  ctx.beginPath()
  ctx.arc(lx, ly - 1, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(lx - 2, ly - 1, 4, 10)
  // shackle
  ctx.strokeStyle = rgb([120, 124, 132])
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.arc(lx, ly - 14, 8, Math.PI, 0)
  ctx.stroke()
  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('crate.png'), buf)
  console.log('  ✓ crate.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE MYSTERY BOX — a small kraft cardboard box (hidden / queued good).
// ============================================================================
function bakeMystery() {
  const S = 120
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S * 0.5
  const w = S * 0.56
  const h = S * 0.5
  const x = cx - w / 2
  const y = S * 0.32
  const KR = [190, 158, 110]
  contactShadow(ctx, cx, y + h + 4, w * 0.6, S * 0.08)
  // box front
  roundRectPath(ctx, x, y, w, h, 6)
  let g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, rgb(mix(KR, [255, 245, 220], 0.24)))
  g.addColorStop(1, rgb(mix(KR, [80, 56, 28], 0.28)))
  ctx.fillStyle = g
  ctx.fill()
  // top flap (lid seen slightly from above)
  ctx.beginPath()
  ctx.moveTo(x + 4, y)
  ctx.lineTo(x + w - 4, y)
  ctx.lineTo(x + w - 12, y - 12)
  ctx.lineTo(x + 12, y - 12)
  ctx.closePath()
  ctx.fillStyle = rgb(mix(KR, [255, 245, 220], 0.34))
  ctx.fill()
  // packing tape cross
  ctx.fillStyle = 'rgba(210,198,168,0.7)'
  ctx.fillRect(cx - 6, y - 12, 12, h + 12)
  // a soft "?" embossed
  ctx.fillStyle = 'rgba(90,64,34,0.5)'
  ctx.font = `bold ${S * 0.3}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', cx, y + h * 0.56)
  grainPass(ctx, S, S, 0.04)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('mystery.png'), buf)
  console.log('  ✓ mystery.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE BACKDROP — a calm, low-contrast grocery interior (SceneBackdrop image).
// ============================================================================
function bakeBackdrop() {
  const W = 1000
  const H = 720
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // warm wall wash, brighter up top (soft daylight)
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb([236, 224, 200]))
  g.addColorStop(0.5, rgb([226, 210, 182]))
  g.addColorStop(0.72, rgb([214, 196, 166]))
  g.addColorStop(1, rgb([198, 178, 148]))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // soft window glow upper-right
  g = ctx.createRadialGradient(W * 0.74, H * 0.18, 0, W * 0.74, H * 0.18, W * 0.5)
  g.addColorStop(0, 'rgba(255,250,232,0.3)')
  g.addColorStop(1, 'rgba(255,250,232,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // soft, out-of-focus background shelves with rows of muted goods (blurred read)
  const shelfBandY = [H * 0.16, H * 0.34, H * 0.52]
  const goodTints = [
    [196, 120, 108], [206, 176, 110], [150, 176, 150],
    [150, 168, 200], [188, 158, 176], [200, 156, 108],
  ]
  for (const by of shelfBandY) {
    // the wooden shelf band
    const sg = ctx.createLinearGradient(0, by, 0, by + 20)
    sg.addColorStop(0, 'rgba(150,116,74,0.5)')
    sg.addColorStop(1, 'rgba(110,82,50,0.5)')
    ctx.fillStyle = sg
    ctx.fillRect(W * 0.06, by + 44, W * 0.88, 16)
    // rows of soft goods (blobs) resting on the shelf
    let gx = W * 0.1
    let ti = (by * 7) | 0
    while (gx < W * 0.9) {
      const c = goodTints[ti % goodTints.length]
      const bw = 26 + ((ti * 13) % 20)
      const bh = 34 + ((ti * 7) % 22)
      const rg = ctx.createLinearGradient(gx, by, gx, by + bh)
      rg.addColorStop(0, rgb(mix(c, [255, 255, 255], 0.24), 0.5))
      rg.addColorStop(1, rgb(mix(c, [40, 30, 30], 0.2), 0.5))
      ctx.fillStyle = rg
      roundRectPath(ctx, gx, by + 44 - bh, bw, bh, 6)
      ctx.fill()
      gx += bw + 10
      ti++
    }
  }
  // atmospheric haze over the far shelves (softens them → depth)
  g = ctx.createLinearGradient(0, 0, 0, H * 0.62)
  g.addColorStop(0, 'rgba(230,220,200,0.34)')
  g.addColorStop(1, 'rgba(230,220,200,0.05)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H * 0.62)
  // floor near the bottom (a warm receding floor)
  g = ctx.createLinearGradient(0, H * 0.72, 0, H)
  g.addColorStop(0, rgb([206, 184, 152]))
  g.addColorStop(1, rgb([182, 158, 126]))
  ctx.fillStyle = g
  ctx.fillRect(0, H * 0.72, W, H * 0.28)
  // floor/wall seam shadow
  const seam = ctx.createLinearGradient(0, H * 0.72, 0, H * 0.72 + 30)
  seam.addColorStop(0, 'rgba(60,44,26,0.22)')
  seam.addColorStop(1, 'rgba(60,44,26,0)')
  ctx.fillStyle = seam
  ctx.fillRect(0, H * 0.72, W, 30)
  // fine wall grain
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const n = grain(x * 0.4, y * 0.4) * 0.6 + grain(x * 1.5, y * 1.5) * 0.4
      const m = 1 + n * 0.025
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  // gentle corner vignette to settle the frame
  g = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.34, W * 0.5, H * 0.5, W * 0.72)
  g.addColorStop(0, 'rgba(70,52,32,0)')
  g.addColorStop(1, 'rgba(70,52,32,0.2)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('sortshelf-shop.jpg'), buf)
  console.log('  ✓ bg/sortshelf-shop.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking sortshelf (מכולת) art →')
bakeApple()
bakeBanana()
bakeMilk()
bakeBread()
bakeCheese()
bakeCarrot()
bakeTomato()
bakeCookie()
bakeJuice()
bakeChoco()
bakeGrapes()
bakeCupcake()
bakeShelf()
bakeCrate()
bakeMystery()
bakeBackdrop()
console.log('Done.')

function bakeMilk() {
  bakeCarton('good-milk.png', [230, 236, 242], [92, 140, 196], { gable: true })
}
function bakeJuice() {
  bakeCarton('good-juice.png', [226, 158, 84], [206, 120, 60], { straw: true })
}
