// Bakes the "צובעים חבר" (colour-a-friend) art-studio materials — REAL baked
// ceramic paint pots, a wooden art table, a wooden frame, a coloring-page sheet,
// a paintbrush and a calm studio backdrop, NOT flat CSS shapes/gradients.
//
//   pot-*.png   — 12 ceramic paint pots. The pot BODY is a muted, sensory-calm
//                 tint of its colour (so each reads as "the red pot" without
//                 shouting); the PAINT MENISCUS on top is the true, vivid,
//                 clearly-distinguishable colour the child will paint with — a
//                 glossy liquid disc with a baked specular highlight + inner AO
//                 ring. Side key-light, bottom AO, lit ceramic rim, contact shadow.
//   tray.png    — the wooden ART TABLE the pots + brush rest in: a lit receding
//                 top face + a thick front bevel (real depth / camera-above angle),
//                 wood grain, soft pot-rest light pools and a grounded shadow.
//   frame.png   — a wooden picture FRAME (transparent centre) used as a CSS
//                 border-image 9-slice, so it wraps the friend's page crisply at
//                 ANY size. Bevelled: lit outer, shadowed inner (the page recedes).
//   paper.png   — a warm cream COLORING-PAGE sheet (paper grain + soft vignette),
//                 featureless so it tiles/stretches behind the friend without
//                 distortion. The friend (FriendArt) is coloured on top of it.
//   brush.png   — a resting PAINTBRUSH: wood handle, crimped metal ferrule with a
//                 specular band, a soft bristle tuft, its own contact shadow.
//   bg/colorme-studio.jpg — a calm, low-contrast art-room: soft sage-cream wall,
//                 a gentle window glow, a couple of blurred framed pictures and a
//                 warm receding floor, so the foreground pots + friend pop.
//
// Same pipeline as the dice / sortshelf / coin-sort materials: an original
// @napi-rs/canvas bake with seeded value-noise grain and analytic baked
// lighting/AO. No third-party art (CC0). One-off build tool:
//   node scripts/gen-colorme-art.mjs   (@napi-rs/canvas is already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const SPR = new URL('../public/art/sprites/colorme/', import.meta.url)
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
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const grain = makeNoise(20260718)

// appends a rounded-rect SUBPATH (no beginPath — for compound/even-odd paths)
function roundRectSub(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  roundRectSub(ctx, x, y, w, h, r)
}
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
function contactShadow(ctx, cx, cy, rx, ry, a = 0.3) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, `rgba(22,17,10,${a})`)
  g.addColorStop(0.62, `rgba(22,17,10,${a * 0.5})`)
  g.addColorStop(1, 'rgba(22,17,10,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ============================================================================
// THE PAINT POTS — a ceramic pot with a muted-tint body + a vivid glossy paint
// meniscus (the clearly-distinguishable pickable colour).
// ============================================================================
const CERAMIC = [214, 207, 196] // warm off-white stoneware
const PW = 132
const PH = 158
// draws the ceramic pot body + lit rim (everything but the paint meniscus) and
// returns the mouth geometry so the caller can fill the meniscus (single colour
// or rainbow). `body` = the muted stoneware tint.
function potBase(ctx, body) {
  const cx = PW * 0.5
  const topY = PH * 0.3 // pot mouth
  const botY = PH * 0.9 // pot base
  const rTop = PW * 0.36 // mouth radius
  const rBot = PW * 0.31 // base radius (slight taper)
  const rimRy = rTop * 0.3 // ellipse squash for the mouth
  const bodyLo = mix(body, [40, 34, 30], 0.44)
  const bodyHi = mix(body, [255, 252, 246], 0.4)

  // --- grounded contact shadow under the base ---
  contactShadow(ctx, cx + 3, botY + 6, rBot * 1.16, rBot * 0.34, 0.34)

  // --- pot body (mouth ellipse → tapered walls → base ellipse) ---
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, topY, rTop, rimRy, 0, Math.PI, Math.PI * 2) // back of mouth (top edge)
  ctx.lineTo(cx + rBot, botY)
  ctx.ellipse(cx, botY, rBot, rBot * 0.3, 0, 0, Math.PI) // front of base
  ctx.lineTo(cx - rTop, topY)
  ctx.closePath()
  ctx.clip()
  // left key-light → right ambient occlusion across the cylinder
  let g = ctx.createLinearGradient(cx - rTop, 0, cx + rTop, 0)
  g.addColorStop(0, rgb(mix(body, [30, 26, 22], 0.22))) // left edge turn
  g.addColorStop(0.28, rgb(bodyHi)) // lit belly
  g.addColorStop(0.55, rgb(body))
  g.addColorStop(1, rgb(bodyLo)) // shaded right
  ctx.fillStyle = g
  ctx.fillRect(0, topY - rimRy, PW, PH)
  // vertical form: a touch darker toward the base (AO where it meets the table)
  const vg = ctx.createLinearGradient(0, topY, 0, botY)
  vg.addColorStop(0, 'rgba(255,255,255,0)')
  vg.addColorStop(0.7, 'rgba(30,24,18,0)')
  vg.addColorStop(1, 'rgba(30,24,18,0.28)')
  ctx.fillStyle = vg
  ctx.fillRect(0, topY - rimRy, PW, PH)
  // a soft glaze sheen band (ceramic gloss) on the lit side
  const sheen = ctx.createLinearGradient(cx - rTop * 0.5, 0, cx - rTop * 0.1, 0)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(cx - rTop * 0.6, topY, rTop * 0.5, botY - topY)
  ctx.restore()

  // --- lit ceramic rim (outer lip of the mouth) ---
  ctx.beginPath()
  ctx.ellipse(cx, topY, rTop, rimRy, 0, 0, Math.PI * 2)
  ctx.lineWidth = PW * 0.03
  const rg = ctx.createLinearGradient(cx - rTop, 0, cx + rTop, 0)
  rg.addColorStop(0, rgb(mix(body, [20, 16, 12], 0.2)))
  rg.addColorStop(0.3, rgb(bodyHi))
  rg.addColorStop(1, rgb(bodyLo))
  ctx.strokeStyle = rg
  ctx.stroke()

  // inner wall shadow just inside the rim (behind the paint)
  ctx.beginPath()
  ctx.ellipse(cx, topY, rTop * 0.93, rimRy * 0.9, 0, 0, Math.PI * 2)
  ctx.fillStyle = rgb(mix(body, [18, 14, 10], 0.5))
  ctx.fill()

  return { cx, topY, rTop, rimRy, pr: rTop * 0.86, pry: rimRy * 0.82 }
}

// the shared glossy AO-ring + wet specular over a filled meniscus
function menGloss(ctx, cx, topY, pr, pry) {
  ctx.lineWidth = pr * 0.14
  ctx.strokeStyle = 'rgba(20,14,20,0.22)'
  ctx.beginPath()
  ctx.ellipse(cx, topY, pr * 0.98, pry * 0.98, 0, 0, Math.PI * 2)
  ctx.stroke()
  const sp = ctx.createRadialGradient(
    cx - pr * 0.32, topY - pry * 0.44, 0,
    cx - pr * 0.32, topY - pry * 0.44, pr * 0.5,
  )
  sp.addColorStop(0, 'rgba(255,255,255,0.7)')
  sp.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sp
  ctx.beginPath()
  ctx.ellipse(cx - pr * 0.3, topY - pry * 0.4, pr * 0.4, pry * 0.55, -0.5, 0, Math.PI * 2)
  ctx.fill()
}

function bakePot(colorHex, slug) {
  const color = hex(colorHex)
  const cv = createCanvas(PW, PH)
  const ctx = cv.getContext('2d')
  const body = mix(CERAMIC, color, 0.32) // muted stoneware identity tint
  const { cx, topY, pr, pry } = potBase(ctx, body)
  // the PAINT: a glossy liquid meniscus in the true vivid colour
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, topY, pr, pry, 0, 0, Math.PI * 2)
  ctx.clip()
  const pg = ctx.createRadialGradient(cx - pr * 0.3, topY - pry * 0.5, pr * 0.05, cx, topY, pr * 1.15)
  pg.addColorStop(0, rgb(mix(color, [255, 255, 255], 0.34))) // lit near highlight
  pg.addColorStop(0.5, rgb(color)) // true colour
  pg.addColorStop(1, rgb(mix(color, [20, 16, 24], 0.34))) // pooled edge (depth)
  ctx.fillStyle = pg
  ctx.fillRect(cx - pr, topY - pry, pr * 2, pry * 2)
  ctx.restore()
  menGloss(ctx, cx, topY, pr, pry)
  grainPass(ctx, PW, PH, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(`pot-${slug}.png`), buf)
  console.log('  ✓', `pot-${slug}.png`, `${PW}×${PH}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// the "more colours" pot — a soft-rainbow meniscus (the palette opener)
function bakePotMore() {
  const cv = createCanvas(PW, PH)
  const ctx = cv.getContext('2d')
  const body = mix(CERAMIC, [150, 150, 158], 0.3) // neutral cool stoneware
  const { cx, topY, pr, pry } = potBase(ctx, body)
  // muted rainbow pie meniscus
  const wedges = [
    [214, 96, 96], [226, 158, 92], [224, 200, 108], [130, 196, 140],
    [110, 180, 196], [120, 150, 214], [162, 128, 206], [214, 130, 176],
  ]
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, topY, pr, pry, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(cx, topY)
  ctx.scale(1, pry / pr)
  const step = (Math.PI * 2) / wedges.length
  for (let i = 0; i < wedges.length; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, pr * 1.06, i * step - Math.PI / 2, (i + 1) * step - Math.PI / 2)
    ctx.closePath()
    ctx.fillStyle = rgb(wedges[i])
    ctx.fill()
  }
  // soft radial lightening toward the centre (glossy dome)
  const dome = ctx.createRadialGradient(-pr * 0.3, -pr * 0.4, pr * 0.05, 0, 0, pr * 1.1)
  dome.addColorStop(0, 'rgba(255,255,255,0.42)')
  dome.addColorStop(0.55, 'rgba(255,255,255,0)')
  dome.addColorStop(1, 'rgba(20,16,24,0.28)')
  ctx.fillStyle = dome
  ctx.beginPath()
  ctx.arc(0, 0, pr * 1.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  menGloss(ctx, cx, topY, pr, pry)
  grainPass(ctx, PW, PH, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('pot-more.png'), buf)
  console.log('  ✓ pot-more.png', `${PW}×${PH}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE ART TABLE / TRAY — wooden ledge the pots + brush rest in (real depth).
// ============================================================================
const WOOD = [176, 138, 92] // warm, calm matte wood
function bakeTray() {
  const W = 660
  const H = 188
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const topY = 22
  const faceH = 104 // the top surface (where pots sit)
  const bevelH = 40 // the front thickness
  // drop shadow beneath the whole table
  const ds = ctx.createLinearGradient(0, topY + faceH + bevelH, 0, H)
  ds.addColorStop(0, 'rgba(20,14,6,0.3)')
  ds.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ds
  ctx.fillRect(0, topY + faceH + bevelH, W, H - (topY + faceH + bevelH))
  // top face (trapezoid: far edge shorter → receding perspective / camera-above)
  const inset = 40
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(inset, topY)
  ctx.lineTo(W - inset, topY)
  ctx.lineTo(W - 8, topY + faceH)
  ctx.lineTo(8, topY + faceH)
  ctx.closePath()
  ctx.clip()
  let g = ctx.createLinearGradient(0, topY, 0, topY + faceH)
  g.addColorStop(0, rgb(mix(WOOD, [42, 28, 12], 0.32))) // far edge darker (AO)
  g.addColorStop(0.4, rgb(mix(WOOD, [255, 240, 210], 0.16)))
  g.addColorStop(1, rgb(mix(WOOD, [255, 244, 214], 0.06)))
  ctx.fillStyle = g
  ctx.fillRect(0, topY, W, faceH)
  grainStreaks(ctx, 0, topY, W, faceH, 46, rgb(mix(WOOD, [255, 240, 210], 0.4)), rgb(mix(WOOD, [30, 18, 6], 0.5)))
  // near light pool where pots rest
  const lp = ctx.createRadialGradient(W / 2, topY + faceH - 8, 20, W / 2, topY + faceH - 6, W * 0.5)
  lp.addColorStop(0, 'rgba(255,242,212,0.2)')
  lp.addColorStop(1, 'rgba(255,242,212,0)')
  ctx.fillStyle = lp
  ctx.fillRect(0, topY, W, faceH)
  ctx.restore()
  // front bevel (thickness)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(8, topY + faceH)
  ctx.lineTo(W - 8, topY + faceH)
  ctx.lineTo(W - 8, topY + faceH + bevelH)
  ctx.lineTo(8, topY + faceH + bevelH)
  ctx.closePath()
  ctx.clip()
  const fbg = ctx.createLinearGradient(0, topY + faceH, 0, topY + faceH + bevelH)
  fbg.addColorStop(0, rgb(mix(WOOD, [30, 18, 6], 0.34)))
  fbg.addColorStop(1, rgb(mix(WOOD, [18, 11, 4], 0.52)))
  ctx.fillStyle = fbg
  ctx.fillRect(0, topY + faceH, W, bevelH)
  grainStreaks(ctx, 0, topY + faceH, W, bevelH, 34, rgb(mix(WOOD, [220, 180, 120], 0.4)), rgb(mix(WOOD, [16, 10, 4], 0.6)))
  ctx.restore()
  // lit near lip where top meets bevel
  ctx.strokeStyle = 'rgba(255,244,214,0.55)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(10, topY + faceH + 1)
  ctx.lineTo(W - 10, topY + faceH + 1)
  ctx.stroke()
  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('tray.png'), buf)
  console.log('  ✓ tray.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE FRAME — a wooden picture frame (transparent centre) for a CSS border-image
// 9-slice, so it wraps the friend's page crisply at any size.
// ============================================================================
const FRAME_WOOD = [186, 150, 104]
function bakeFrame() {
  const S = 360
  const B = 46 // border thickness → border-image-slice
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  // the wood ring: outer rounded rect minus inner rounded rect (even-odd hole),
  // built as ONE compound path so the CENTRE stays transparent
  ctx.save()
  ctx.beginPath()
  roundRectSub(ctx, 4, 4, S - 8, S - 8, 26)
  roundRectSub(ctx, B, B, S - 2 * B, S - 2 * B, 12)
  ctx.clip('evenodd')
  // base wood fill with a diagonal light
  let g = ctx.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, rgb(mix(FRAME_WOOD, [255, 240, 210], 0.32)))
  g.addColorStop(0.5, rgb(FRAME_WOOD))
  g.addColorStop(1, rgb(mix(FRAME_WOOD, [40, 26, 12], 0.34)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // wood grain following the frame
  grainStreaks(ctx, 0, 0, S, B, 18, rgb(mix(FRAME_WOOD, [255, 244, 216], 0.5)), rgb(mix(FRAME_WOOD, [40, 26, 12], 0.5)))
  grainStreaks(ctx, 0, S - B, S, B, 18, rgb(mix(FRAME_WOOD, [255, 244, 216], 0.5)), rgb(mix(FRAME_WOOD, [40, 26, 12], 0.5)))
  ctx.restore()
  // outer bevel highlight (top-left) + shadow (bottom-right)
  ctx.lineWidth = 3
  roundRectPath(ctx, 5, 5, S - 10, S - 10, 25)
  ctx.strokeStyle = 'rgba(255,246,222,0.5)'
  ctx.stroke()
  roundRectPath(ctx, 6, 6, S - 12, S - 12, 24)
  ctx.strokeStyle = 'rgba(40,26,12,0.16)'
  ctx.stroke()
  // inner rabbet: dark shadow so the page reads as RECESSED inside the frame
  ctx.save()
  roundRectPath(ctx, B, B, S - 2 * B, S - 2 * B, 12)
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(28,18,8,0.42)'
  ctx.stroke()
  ctx.lineWidth = 3
  roundRectPath(ctx, B + 3, B + 3, S - 2 * B - 6, S - 2 * B - 6, 10)
  ctx.strokeStyle = 'rgba(255,244,216,0.28)'
  ctx.stroke()
  ctx.restore()
  // mitre lines at the 4 corners
  ctx.strokeStyle = 'rgba(40,26,12,0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(B, B)
  ctx.moveTo(S, 0); ctx.lineTo(S - B, B)
  ctx.moveTo(0, S); ctx.lineTo(B, S - B)
  ctx.moveTo(S, S); ctx.lineTo(S - B, S - B)
  ctx.stroke()
  grainPass(ctx, S, S, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('frame.png'), buf)
  console.log('  ✓ frame.png', `${S}×${S}`, `slice=${B}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE PAPER — a warm cream coloring-page sheet (featureless, so it stretches
// behind any friend without distortion). The friend is coloured on top.
// ============================================================================
function bakePaper() {
  const S = 300
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  // warm cream base
  const CREAM = [248, 244, 234]
  ctx.fillStyle = rgb(CREAM)
  ctx.fillRect(0, 0, S, S)
  // very soft vignette — lighter centre, gently shaded edges (page sits in frame)
  const g = ctx.createRadialGradient(S * 0.46, S * 0.42, S * 0.1, S * 0.5, S * 0.5, S * 0.72)
  g.addColorStop(0, 'rgba(255,253,246,0.6)')
  g.addColorStop(0.7, 'rgba(255,253,246,0)')
  g.addColorStop(1, 'rgba(196,182,156,0.22)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  // fine paper fibre grain (two scales, isotropic so stretching stays invisible)
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      const n = grain(x * 0.9, y * 0.9) * 0.5 + grain(x * 2.6, y * 2.6) * 0.5
      const m = 1 + n * 0.03
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  // opaque page interior (no alpha needed) → JPEG keeps the grain cheap
  const buf = cv.toBuffer('image/jpeg', 88)
  writeFileSync(file('paper.jpg'), buf)
  console.log('  ✓ paper.jpg', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE BRUSH — a resting paintbrush (wood handle, metal ferrule, bristle tuft).
// ============================================================================
function bakeBrush() {
  const W = 240
  const H = 104
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // lay it diagonally, bristles at lower-left, handle to upper-right
  ctx.translate(W * 0.5, H * 0.5)
  ctx.rotate(-0.28)
  ctx.translate(-W * 0.5, -H * 0.5)
  const midY = H * 0.5
  const th = H * 0.2 // handle half-thickness at ferrule
  // contact shadow
  ctx.save()
  ctx.rotate(0) // shadow in local space
  contactShadow(ctx, W * 0.52, midY + th + 14, W * 0.4, th * 0.7, 0.24)
  ctx.restore()
  // wood handle (tapering to a rounded tip on the right)
  const hx0 = W * 0.42 // handle starts after ferrule
  const hx1 = W * 0.96 // handle tip
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(hx0, midY - th)
  ctx.lineTo(hx1 - 8, midY - th * 0.5)
  ctx.quadraticCurveTo(hx1, midY, hx1 - 8, midY + th * 0.5)
  ctx.lineTo(hx0, midY + th)
  ctx.closePath()
  ctx.clip()
  let hg = ctx.createLinearGradient(0, midY - th, 0, midY + th)
  const HWOOD = [196, 120, 74]
  hg.addColorStop(0, rgb(mix(HWOOD, [255, 236, 208], 0.44)))
  hg.addColorStop(0.5, rgb(HWOOD))
  hg.addColorStop(1, rgb(mix(HWOOD, [40, 20, 10], 0.4)))
  ctx.fillStyle = hg
  ctx.fillRect(hx0, midY - th, hx1 - hx0, th * 2)
  // handle specular streak
  ctx.strokeStyle = 'rgba(255,245,224,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(hx0 + 4, midY - th * 0.45)
  ctx.lineTo(hx1 - 12, midY - th * 0.2)
  ctx.stroke()
  ctx.restore()
  // metal ferrule (crimped band with a bright specular)
  const fx0 = W * 0.3
  const fx1 = W * 0.44
  ctx.save()
  roundRectPath(ctx, fx0, midY - th * 1.16, fx1 - fx0, th * 2.32, 5)
  ctx.clip()
  let fg = ctx.createLinearGradient(0, midY - th * 1.16, 0, midY + th * 1.16)
  fg.addColorStop(0, rgb([150, 156, 164]))
  fg.addColorStop(0.4, rgb([214, 220, 228]))
  fg.addColorStop(0.55, rgb([238, 242, 248]))
  fg.addColorStop(0.7, rgb([176, 182, 190]))
  fg.addColorStop(1, rgb([120, 126, 134]))
  ctx.fillStyle = fg
  ctx.fillRect(fx0, midY - th * 1.2, fx1 - fx0, th * 2.4)
  // crimp lines
  ctx.strokeStyle = 'rgba(60,64,70,0.4)'
  ctx.lineWidth = 1.4
  for (const fx of [fx0 + (fx1 - fx0) * 0.36, fx0 + (fx1 - fx0) * 0.64]) {
    ctx.beginPath()
    ctx.moveTo(fx, midY - th * 1.16)
    ctx.lineTo(fx, midY + th * 1.16)
    ctx.stroke()
  }
  ctx.restore()
  // bristle tuft (soft natural hair, tapering to a point at the left)
  const bx0 = W * 0.04 // tip
  const bx1 = W * 0.32 // meets ferrule
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(bx1, midY - th * 0.96)
  ctx.quadraticCurveTo(bx0 + 10, midY - th * 0.4, bx0, midY)
  ctx.quadraticCurveTo(bx0 + 10, midY + th * 0.4, bx1, midY + th * 0.96)
  ctx.closePath()
  ctx.clip()
  const BR = [206, 176, 128]
  let bg = ctx.createLinearGradient(bx0, 0, bx1, 0)
  bg.addColorStop(0, rgb(mix(BR, [90, 66, 38], 0.4)))
  bg.addColorStop(0.4, rgb(BR))
  bg.addColorStop(1, rgb(mix(BR, [255, 240, 210], 0.3)))
  ctx.fillStyle = bg
  ctx.fillRect(bx0, midY - th, bx1 - bx0, th * 2)
  // fine hair strands
  ctx.strokeStyle = 'rgba(120,92,54,0.34)'
  ctx.lineWidth = 1
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath()
    ctx.moveTo(bx1, midY + i * th * 0.24)
    ctx.quadraticCurveTo((bx0 + bx1) / 2, midY + i * th * 0.16, bx0 + 2, midY + i * th * 0.05)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,246,224,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(bx1, midY - th * 0.5)
  ctx.quadraticCurveTo((bx0 + bx1) / 2, midY - th * 0.4, bx0 + 4, midY - th * 0.1)
  ctx.stroke()
  ctx.restore()
  grainPass(ctx, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('brush.png'), buf)
  console.log('  ✓ brush.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE BACKDROP — a calm, low-contrast art-room (SceneBackdrop image).
// ============================================================================
function bakeBackdrop() {
  const W = 1000
  const H = 720
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // soft sage-cream wall wash, brighter up top (gentle daylight)
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb([228, 226, 210]))
  g.addColorStop(0.5, rgb([216, 216, 198]))
  g.addColorStop(0.72, rgb([204, 206, 186]))
  g.addColorStop(1, rgb([190, 194, 172]))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // soft window glow upper-left (calm, off-centre light)
  g = ctx.createRadialGradient(W * 0.26, H * 0.16, 0, W * 0.26, H * 0.16, W * 0.52)
  g.addColorStop(0, 'rgba(255,251,232,0.32)')
  g.addColorStop(1, 'rgba(255,251,232,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // a couple of soft, out-of-focus framed pictures on the wall (blurred read)
  const pics = [
    { x: W * 0.16, y: H * 0.2, w: 150, h: 120, tint: [176, 156, 188] },
    { x: W * 0.68, y: H * 0.16, w: 130, h: 160, tint: [166, 186, 176] },
    { x: W * 0.84, y: H * 0.42, w: 110, h: 90, tint: [196, 176, 150] },
  ]
  for (const p of pics) {
    // frame
    ctx.fillStyle = 'rgba(150,120,80,0.5)'
    roundRectPath(ctx, p.x - 6, p.y - 6, p.w + 12, p.h + 12, 8)
    ctx.fill()
    // muted picture
    const pgg = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
    pgg.addColorStop(0, rgb(mix(p.tint, [255, 255, 255], 0.4), 0.55))
    pgg.addColorStop(1, rgb(mix(p.tint, [60, 50, 60], 0.2), 0.55))
    ctx.fillStyle = pgg
    roundRectPath(ctx, p.x, p.y, p.w, p.h, 4)
    ctx.fill()
  }
  // atmospheric haze up top (softens the wall → depth)
  g = ctx.createLinearGradient(0, 0, 0, H * 0.6)
  g.addColorStop(0, 'rgba(226,224,208,0.3)')
  g.addColorStop(1, 'rgba(226,224,208,0.04)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H * 0.6)
  // warm receding floor near the bottom
  g = ctx.createLinearGradient(0, H * 0.7, 0, H)
  g.addColorStop(0, rgb([200, 180, 150]))
  g.addColorStop(1, rgb([176, 154, 124]))
  ctx.fillStyle = g
  ctx.fillRect(0, H * 0.7, W, H * 0.3)
  // floor/wall seam shadow
  const seam = ctx.createLinearGradient(0, H * 0.7, 0, H * 0.7 + 34)
  seam.addColorStop(0, 'rgba(56,42,24,0.22)')
  seam.addColorStop(1, 'rgba(56,42,24,0)')
  ctx.fillStyle = seam
  ctx.fillRect(0, H * 0.7, W, 34)
  // fine wall grain
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const n = grain(x * 0.4, y * 0.4) * 0.6 + grain(x * 1.5, y * 1.5) * 0.4
      const m = 1 + n * 0.022
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  // gentle corner vignette to settle the frame
  g = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.34, W * 0.5, H * 0.5, W * 0.72)
  g.addColorStop(0, 'rgba(64,52,34,0)')
  g.addColorStop(1, 'rgba(64,52,34,0.18)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('colorme-studio.jpg'), buf)
  console.log('  ✓ bg/colorme-studio.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// the 12 main palette colours (MUST match PALETTE in src/games/ColorFriends.tsx)
const POTS = [
  ['#ef4444', 'red'],
  ['#f97316', 'orange'],
  ['#facc15', 'yellow'],
  ['#22c55e', 'green'],
  ['#14b8a6', 'teal'],
  ['#3b82f6', 'blue'],
  ['#8b5cf6', 'purple'],
  ['#ec4899', 'pink'],
  ['#a16207', 'brown'],
  ['#f8fafc', 'white'],
  ['#111827', 'black'],
  ['#9ca3af', 'gray'],
]

console.log('Baking colorme (צובעים חבר) art →')
for (const [c, slug] of POTS) bakePot(c, slug)
bakePotMore()
bakeTray()
bakeFrame()
bakePaper()
bakeBrush()
bakeBackdrop()
console.log('Done.')
