// Bakes the "איזה חבר?" (Which friend starts with this letter?) materials as REAL
// raster art with baked soft lighting + grain/AO — never flat CSS shapes. A calm
// wooden ALPHABET-BLOCK set:
//
//   • tile.png  — the hero LETTER TILE: a warm wooden alphabet block seen face-on,
//                 a rounded square with a recessed engraved centre panel (a carved
//                 "home" the crisp CSS Hebrew letter sits inside), a raised bevel,
//                 baked grain, top-left key light, bottom-right AO and a soft
//                 contact shadow so the block rests on a surface. The LETTER itself
//                 stays crisp CSS TEXT over the engraved panel (readability is
//                 sacred for a pre-reader) — the block is only the material home.
//   • card.png  — the CHOICE CARD: a rounded warm placard each friend stands on,
//                 with a lit upper stage where the friend sits, a faint recessed
//                 lower label band for the name, a raised bevel, grain, key light
//                 and a baked contact shadow at the foot so it stands on the tray.
//   • tray.png  — the wooden TABLE/TRAY the cards rest on: a receding top surface
//                 (trapezoid, far edge narrower/darker) + a thick front lip for
//                 depth, plank grain, converging seams, a lit near edge and a soft
//                 ground shadow. Grounds the whole choice row (real depth, not a
//                 flat CSS row).
//
// Same pipeline as the who / dice / coin-sort materials: an original
// @napi-rs/canvas bake with seeded value-noise material grain and analytic baked
// lighting/AO. No third-party art — everything here is original CC0. Muted,
// sensory-calm warm-oak + cream palette. One-off build tool:
//   node scripts/gen-letter-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/letter/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same as who) -----
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

// muted, sensory-calm warm palette
const MAPLE = [226, 205, 168] // warm light-maple tile body
const MAPLE_DK = [176, 150, 110]
const MAPLE_LT = [242, 226, 196]
const OAK = [170, 128, 80] // warm oak for the tray/table
const OAK_DK = [120, 86, 48]
const OAK_LT = [204, 162, 110]
const CREAM = [236, 226, 206] // choice card body
const CREAM_DK = [196, 182, 156]
const CREAM_LT = [248, 242, 228]

// ============================================================================
// THE LETTER TILE — a warm wooden alphabet block, face-on. Rounded square body,
// a recessed engraved centre panel (the carved home the CSS letter sits in),
// raised bevel, grain, key light + AO, contact shadow. 256×256, transparent.
// The engraved panel rect is MIRRORED in app.css (.which-tile) so the crisp CSS
// letter lands exactly inside the carved home.
// ============================================================================
function bakeTile(name) {
  const S = 256
  const cv = createCanvas(S, S)
  const x = cv.getContext('2d')

  const m = S * 0.085 // outer margin (room for the shadow)
  const bw = S - 2 * m
  const bh = bw
  const bx = m
  const by = m * 0.72
  const r = bw * 0.16

  // --- contact shadow on the surface under the block ---
  x.save()
  x.translate(S / 2, by + bh + S * 0.008)
  x.scale(1, 0.24)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, bw * 0.6)
  sh.addColorStop(0, 'rgba(28,18,8,0.36)')
  sh.addColorStop(1, 'rgba(28,18,8,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, bw * 0.6, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // --- block body (rounded square) with a diagonal key-light gradient ---
  roundRectPath(x, bx, by, bw, bh, r)
  x.save()
  x.clip()
  let g = x.createLinearGradient(bx, by, bx + bw, by + bh)
  g.addColorStop(0, rgb(mix(MAPLE, [255, 255, 255], 0.3))) // lit top-left
  g.addColorStop(0.5, rgb(MAPLE))
  g.addColorStop(1, rgb(mix(MAPLE_DK, [40, 30, 16], 0.16))) // AO bottom-right
  x.fillStyle = g
  x.fillRect(bx, by, bw, bh)
  // faint horizontal wood grain across the block face
  for (let i = 0; i < 26; i++) {
    const yy = by + Math.random() * bh
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(150,120,78,0.14)' : 'rgba(248,232,202,0.16)'
    x.lineWidth = 0.7 + Math.random() * 1.8
    x.beginPath()
    x.moveTo(bx, yy)
    for (let sx = bx; sx <= bx + bw; sx += 30) x.lineTo(sx, yy + R(3))
    x.stroke()
  }
  // top-left key-light bloom
  const kl = x.createRadialGradient(bx + bw * 0.3, by + bh * 0.26, 8, bx + bw * 0.3, by + bh * 0.26, bw * 0.82)
  kl.addColorStop(0, 'rgba(255,248,228,0.4)')
  kl.addColorStop(1, 'rgba(255,248,228,0)')
  x.fillStyle = kl
  x.fillRect(bx, by, bw, bh)
  // bottom-right ambient occlusion pooling
  const ao = x.createRadialGradient(bx + bw * 0.8, by + bh * 0.82, bw * 0.08, bx + bw * 0.8, by + bh * 0.82, bw * 0.85)
  ao.addColorStop(0, 'rgba(40,28,12,0.24)')
  ao.addColorStop(1, 'rgba(40,28,12,0)')
  x.fillStyle = ao
  x.fillRect(bx, by, bw, bh)
  x.restore()

  // --- recessed engraved CENTRE panel (the carved home for the letter) ---
  const pm = bw * 0.16 // inset of the panel from the block edge
  const px = bx + pm
  const py = by + pm
  const pw = bw - 2 * pm
  const ph = bh - 2 * pm
  const pr = r * 0.8
  // outer AO ring where the panel is cut into the face (top-left shadow deepest)
  x.save()
  roundRectPath(x, px, py, pw, ph, pr)
  x.clip()
  const cut = x.createLinearGradient(px, py, px + pw, py + ph)
  cut.addColorStop(0, rgb(mix(MAPLE_DK, [30, 20, 10], 0.28))) // shaded top-left wall
  cut.addColorStop(0.5, rgb(mix(MAPLE, MAPLE_DK, 0.4)))
  cut.addColorStop(1, rgb(mix(MAPLE_LT, [255, 255, 255], 0.1))) // lit bottom-right wall
  x.fillStyle = cut
  x.fillRect(px, py, pw, ph)
  // inner soft floor light so the panel isn't muddy under the letter
  const fl = x.createRadialGradient(px + pw * 0.5, py + ph * 0.5, 4, px + pw * 0.5, py + ph * 0.5, pw * 0.62)
  fl.addColorStop(0, 'rgba(250,238,214,0.34)')
  fl.addColorStop(1, 'rgba(250,238,214,0)')
  x.fillStyle = fl
  x.fillRect(px, py, pw, ph)
  x.restore()
  // crisp engraved rim: dark top-left (shadow into the cut), light bottom-right (lit far wall)
  x.save()
  roundRectPath(x, px, py, pw, ph, pr)
  x.lineWidth = S * 0.012
  const eg = x.createLinearGradient(px, py, px + pw, py + ph)
  eg.addColorStop(0, 'rgba(60,42,20,0.5)')
  eg.addColorStop(0.5, 'rgba(60,42,20,0.06)')
  eg.addColorStop(0.52, 'rgba(255,248,228,0.06)')
  eg.addColorStop(1, 'rgba(255,248,228,0.55)')
  x.strokeStyle = eg
  x.stroke()
  x.restore()

  // --- raised outer bevel on the block: bright top-left → dark bottom-right ---
  x.save()
  roundRectPath(x, bx, by, bw, bh, r)
  x.lineWidth = S * 0.02
  const bev = x.createLinearGradient(bx, by, bx + bw, by + bh)
  bev.addColorStop(0, 'rgba(255,250,232,0.8)')
  bev.addColorStop(0.48, 'rgba(255,250,232,0.05)')
  bev.addColorStop(0.52, 'rgba(56,38,16,0.05)')
  bev.addColorStop(1, 'rgba(56,38,16,0.62)')
  x.strokeStyle = bev
  x.stroke()
  x.restore()

  grainPass(x, S, S, 0.045)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE CHOICE CARD — a rounded warm placard the friend stands on. A lit upper
// stage (the friend sits here), a faint recessed lower label band (the name
// goes here), a raised bevel, grain, key light and a baked contact shadow at
// the foot so the card stands on the tray. 240×300, transparent.
// ============================================================================
function bakeCard(name) {
  const W = 240
  const H = 300
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')

  const m = 16
  const cx0 = m
  const cy0 = 10
  const cw = W - 2 * m
  const ch = H - m - 22
  const r = 30

  // --- contact shadow at the foot (the card stands on the tray) ---
  x.save()
  x.translate(W / 2, cy0 + ch + 10)
  x.scale(1, 0.24)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, cw * 0.56)
  sh.addColorStop(0, 'rgba(26,16,8,0.34)')
  sh.addColorStop(1, 'rgba(26,16,8,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, cw * 0.56, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // --- card body (rounded) with a soft vertical key light ---
  roundRectPath(x, cx0, cy0, cw, ch, r)
  x.save()
  x.clip()
  let g = x.createLinearGradient(cx0, cy0, cx0, cy0 + ch)
  g.addColorStop(0, rgb(mix(CREAM_LT, [255, 255, 255], 0.2))) // lit top
  g.addColorStop(0.6, rgb(CREAM))
  g.addColorStop(1, rgb(mix(CREAM_DK, [40, 32, 20], 0.12))) // shaded foot
  x.fillStyle = g
  x.fillRect(cx0, cy0, cw, ch)
  // faint fibre grain
  for (let i = 0; i < 22; i++) {
    const yy = cy0 + Math.random() * ch
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(170,156,128,0.12)' : 'rgba(255,250,236,0.14)'
    x.lineWidth = 0.6 + Math.random() * 1.5
    x.beginPath()
    x.moveTo(cx0, yy)
    for (let sx = cx0; sx <= cx0 + cw; sx += 26) x.lineTo(sx, yy + R(2.4))
    x.stroke()
  }
  // top-left key-light bloom (the upper stage where the friend stands)
  const kl = x.createRadialGradient(cx0 + cw * 0.34, cy0 + ch * 0.26, 8, cx0 + cw * 0.34, cy0 + ch * 0.26, cw * 0.9)
  kl.addColorStop(0, 'rgba(255,250,232,0.42)')
  kl.addColorStop(1, 'rgba(255,250,232,0)')
  x.fillStyle = kl
  x.fillRect(cx0, cy0, cw, ch)
  // --- faint recessed LABEL BAND across the lower card (the name's home) ---
  const lbY = cy0 + ch * 0.7
  const lbH = ch * 0.24
  const lb = x.createLinearGradient(0, lbY, 0, lbY + lbH)
  lb.addColorStop(0, 'rgba(60,46,26,0.16)') // shadow at the band's top lip
  lb.addColorStop(0.18, 'rgba(60,46,26,0.05)')
  lb.addColorStop(0.85, 'rgba(255,250,236,0.05)')
  lb.addColorStop(1, 'rgba(255,250,236,0.2)') // lit lower lip
  x.fillStyle = lb
  x.fillRect(cx0 + 10, lbY, cw - 20, lbH)
  x.restore()

  // --- raised bevel: bright top-left → dark bottom-right ---
  x.save()
  roundRectPath(x, cx0, cy0, cw, ch, r)
  x.lineWidth = 4.5
  const bev = x.createLinearGradient(cx0, cy0, cx0 + cw, cy0 + ch)
  bev.addColorStop(0, 'rgba(255,252,240,0.85)')
  bev.addColorStop(0.5, 'rgba(255,252,240,0.05)')
  bev.addColorStop(0.52, 'rgba(60,44,22,0.05)')
  bev.addColorStop(1, 'rgba(60,44,22,0.5)')
  x.strokeStyle = bev
  x.stroke()
  x.restore()

  grainPass(x, W, H, 0.04)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE TABLE / TRAY — a warm oak surface the cards rest on. A receding TOP face
// (trapezoid: far edge narrower/darker, near edge wider/lit) + a thick FRONT
// LIP for depth, plank grain, converging seams, far-edge AO, a lit near edge
// and a soft ground shadow. 560×250, transparent. Grounds the choice row.
// ============================================================================
function bakeTray(name) {
  const W = 560
  const H = 250
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const topY = 30 // far (back) edge of the table top
  const botY = 176 // near (front) edge of the table top
  const topHalf = 226 // half-width of the far edge (narrower → perspective)
  const botHalf = 274 // half-width of the near edge (wider)
  const lipH = 40 // front lip thickness

  // --- soft ground shadow beneath the whole table ---
  x.save()
  x.translate(cxb, botY + lipH + 6)
  x.scale(1, 0.24)
  const gsh = x.createRadialGradient(0, 0, 0, 0, 0, botHalf + 26)
  gsh.addColorStop(0, 'rgba(28,18,8,0.32)')
  gsh.addColorStop(1, 'rgba(28,18,8,0)')
  x.fillStyle = gsh
  x.beginPath()
  x.arc(0, 0, botHalf + 26, 0, Math.PI * 2)
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
  // horizontal plank grain, in perspective
  for (let i = 0; i < 30; i++) {
    const yy = topY + Math.random() * (botY - topY)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,86,48,0.2)' : 'rgba(214,182,136,0.22)'
    x.lineWidth = 0.8 + Math.random() * 2
    x.beginPath()
    x.moveTo(cxb - botHalf, yy)
    for (let sx = -botHalf; sx <= botHalf; sx += 40) x.lineTo(cxb + sx, yy + R(4))
    x.stroke()
  }
  // plank seams converging toward the far edge (perspective lines)
  x.strokeStyle = 'rgba(74,50,24,0.36)'
  x.lineWidth = 2
  for (const frac of [-0.6, -0.28, 0.04, 0.34, 0.64]) {
    x.beginPath()
    x.moveTo(cxb + frac * topHalf, topY)
    x.lineTo(cxb + frac * botHalf, botY)
    x.stroke()
  }
  // far-edge ambient occlusion (the back of the table sits in shade)
  const ao = x.createLinearGradient(0, topY, 0, topY + 46)
  ao.addColorStop(0, 'rgba(48,30,12,0.46)')
  ao.addColorStop(1, 'rgba(48,30,12,0)')
  x.fillStyle = ao
  x.fillRect(0, topY, W, 46)
  // soft top-left key light pooling on the boards
  const kl = x.createRadialGradient(cxb - 90, botY - 34, 16, cxb - 90, botY - 34, 330)
  kl.addColorStop(0, 'rgba(255,244,220,0.18)')
  kl.addColorStop(1, 'rgba(255,244,220,0)')
  x.fillStyle = kl
  x.fillRect(0, 0, W, H)
  x.restore()

  // --- FRONT LIP (the table's thickness) ---
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
  lg.addColorStop(1, rgb(mix(OAK_DK, [20, 12, 4], 0.32)))
  x.fillStyle = lg
  x.fillRect(0, botY, W, lipH)
  // vertical grain on the front board
  for (let i = 0; i < 40; i++) {
    const gx = cxb - botHalf + Math.random() * (botHalf * 2)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(228,196,148,0.16)' : 'rgba(60,38,16,0.22)'
    x.lineWidth = 0.7 + Math.random() * 1.7
    x.beginPath()
    x.moveTo(gx, botY)
    x.lineTo(gx + R(3), botY + lipH)
    x.stroke()
  }
  x.restore()
  // crisp lit near-edge (top of the lip catches the light)
  x.strokeStyle = 'rgba(255,240,210,0.82)'
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

console.log('Baking which-friend (letter) art →')
bakeTile('tile.png')
bakeCard('card.png')
bakeTray('tray.png')
console.log('Done.')
