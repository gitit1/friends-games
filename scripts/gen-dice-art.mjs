// Bakes the "מגלגלים קובייה" dice materials — REAL 3D-looking dice, not flat CSS.
//
// The star is the classic SPOTTED die (pip-1..6.png): a rounded-corner CUBE seen
// with its lit TOP face and shaded RIGHT face for depth, a soft warm-cream body
// with baked recessed PIPS (each pip an AO'd concave pocket with a paint sheen),
// a key light from the top-left, edge bevel, subtle material grain and a soft
// baked contact shadow so it rests on a surface. The FRONT face is an
// axis-aligned rounded square at a KNOWN sub-rectangle (FX0/FY0/FS below) — the
// runtime overlays a crisp CSS count-glow of dots on that exact rect, over the
// baked pips, so the beloved pip-by-pip counting is preserved pixel-aligned.
//
// The polyhedral number dice (d4 triangle … d20 hexagon) are baked as faceted,
// beveled, contact-shadowed SOLIDS in their muted identity tint (body-*.png), so
// nothing in the game reads as a flat CSS clip-path. The number itself overlays
// in the DOM (it changes every roll).
//
// Same pipeline as the coin-sort / bowling materials: an original @napi-rs/canvas
// bake with seeded value-noise grain and analytic baked lighting/AO. No
// third-party art. One-off build tool:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-dice-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/dice/', import.meta.url)
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
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)
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

// ============================================================================
// THE CUBE — a rounded die body. `pips` (0 for a blank numbered body, else the
// 3x3 "on" cells for that face value). `base` = the body's cream/tint colour.
// The FRONT face rect + pip grid MUST stay in lock-step with app.css so the CSS
// count-glow overlays exactly over the baked pips.
// ============================================================================
const S = 224
// front face, as fractions of S (MIRRORED in app.css .die-face / --die-* vars)
const FX0 = 0.115
const FY0 = 0.3
const FS = 0.585
const DX = 0.145 // depth: how far the top/right faces recede to the right
const DY = 0.145 // …and upward
const PIP_R = 0.052 // pip radius (fraction of S)

// which of the 9 cells are lit for each die value (index = row*3 + col)
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// pip cell centre (fraction of S) for cell index i, within the front face
function pipCentre(i) {
  const col = i % 3
  const row = (i / 3) | 0
  return [FX0 + ((col + 0.5) / 3) * FS, FY0 + ((row + 0.5) / 3) * FS]
}

const grain = makeNoise(20260718)

function bakeCube(base, value, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')

  const fx = FX0 * S
  const fy = FY0 * S
  const fs = FS * S
  const dx = DX * S
  const dy = DY * S
  const r = fs * 0.17 // corner radius

  const top = mix(base, [255, 255, 255], 0.16) // lit top face
  const topHi = mix(base, [255, 255, 255], 0.32)
  const right = mix(base, [40, 46, 60], 0.34) // shaded right face
  const rightDk = mix(base, [30, 34, 46], 0.5)

  // --- baked contact shadow on the table, under the cube ---
  ctx.save()
  const shY = (FY0 + FS) * S - fs * 0.02
  ctx.translate(fx + fs * 0.52, shY + fs * 0.09)
  ctx.scale(1, 0.32)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, fs * 0.62)
  sh.addColorStop(0, 'rgba(20,22,30,0.34)')
  sh.addColorStop(0.6, 'rgba(20,22,30,0.18)')
  sh.addColorStop(1, 'rgba(20,22,30,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, fs * 0.62, 0, Math.PI * 2)
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
  // seam highlight where top meets front (a lit top edge)
  ctx.strokeStyle = rgb(mix(base, [255, 255, 255], 0.5), 0.5)
  ctx.lineWidth = S * 0.006
  ctx.beginPath()
  ctx.moveTo(fx + r * 0.4, fy)
  ctx.lineTo(fx + fs - r * 0.4, fy)
  ctx.stroke()

  // --- FRONT face (rounded square) with key-light gradient ---
  roundRectPath(ctx, fx, fy, fs, fs, r)
  g = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.28))) // lit top-left
  g.addColorStop(0.55, rgb(base))
  g.addColorStop(1, rgb(mix(base, [30, 36, 50], 0.16))) // AO bottom-right
  ctx.save()
  ctx.fillStyle = g
  ctx.fill()

  // clip to the front face for the bevel + grain passes
  ctx.clip()
  // soft top-left key-light bloom
  const bloom = ctx.createRadialGradient(fx + fs * 0.28, fy + fs * 0.24, 0, fx + fs * 0.28, fy + fs * 0.24, fs * 0.9)
  bloom.addColorStop(0, 'rgba(255,255,255,0.28)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(fx, fy, fs, fs)
  // bottom-right ambient occlusion pooling
  const ao = ctx.createRadialGradient(fx + fs * 0.82, fy + fs * 0.84, fs * 0.1, fx + fs * 0.82, fy + fs * 0.84, fs * 0.9)
  ao.addColorStop(0, 'rgba(24,28,40,0.22)')
  ao.addColorStop(1, 'rgba(24,28,40,0)')
  ctx.fillStyle = ao
  ctx.fillRect(fx, fy, fs, fs)
  ctx.restore()

  // --- recessed PIPS baked into the front face ---
  if (value && PIPS[value]) {
    const pr = PIP_R * S
    for (const i of PIPS[value]) {
      const [cxf, cyf] = pipCentre(i)
      const cx = cxf * S
      const cy = cyf * S
      // outer AO ring where the pocket meets the face
      let pg = ctx.createRadialGradient(cx, cy, pr * 0.5, cx, cy, pr * 1.28)
      pg.addColorStop(0, 'rgba(20,26,38,0)')
      pg.addColorStop(0.72, 'rgba(20,26,38,0.16)')
      pg.addColorStop(1, 'rgba(20,26,38,0)')
      ctx.fillStyle = pg
      ctx.beginPath()
      ctx.arc(cx, cy, pr * 1.28, 0, Math.PI * 2)
      ctx.fill()
      // the painted recessed pip: dark, concave — lit rim bottom-right, shadow top-left
      pg = ctx.createRadialGradient(cx - pr * 0.32, cy - pr * 0.32, pr * 0.1, cx + pr * 0.2, cy + pr * 0.24, pr)
      pg.addColorStop(0, 'rgba(18,24,36,1)') // shadowed top-left interior wall
      pg.addColorStop(0.55, 'rgba(34,44,60,1)')
      pg.addColorStop(1, 'rgba(58,72,92,1)') // lit bottom-right interior wall
      ctx.fillStyle = pg
      ctx.beginPath()
      ctx.arc(cx, cy, pr, 0, Math.PI * 2)
      ctx.fill()
      // tiny paint sheen near the lit lip (lower-right)
      ctx.fillStyle = 'rgba(150,170,196,0.5)'
      ctx.beginPath()
      ctx.arc(cx + pr * 0.34, cy + pr * 0.36, pr * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // --- crisp bevel rim on the front face (bright top-left, dark bottom-right) ---
  ctx.save()
  roundRectPath(ctx, fx + 1, fy + 1, fs - 2, fs - 2, r - 1)
  ctx.clip()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.018
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.stroke()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.clip()
  ctx.beginPath()
  ctx.arc(fx + fs, fy + fs, fs * 0.9, Math.PI, Math.PI * 1.5)
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(28,32,44,0.18)'
  ctx.stroke()
  ctx.restore()

  // --- material grain pass over every painted pixel (kills the "flat CSS" read) ---
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * 0.5, y * 0.5) * 0.6 + grain(x * 1.7, y * 1.7) * 0.4
      const m = 1 + n * 0.045
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
// THE POLYHEDRAL SOLIDS — d4…d20 as faceted, beveled, shadowed gems (not flat
// CSS clip-paths). Vertices come from the old clip-path polygons, mapped into a
// centred region; facets from the centroid fake the die's cut faces.
// ============================================================================
const POLYS = {
  triangle: [[0.5, 0.05], [0.95, 0.9], [0.05, 0.9]],
  diamond: [[0.5, 0.03], [0.96, 0.5], [0.5, 0.97], [0.04, 0.5]],
  kite: [[0.5, 0.03], [0.94, 0.4], [0.5, 0.97], [0.06, 0.4]],
  pentagon: [[0.5, 0.03], [0.97, 0.4], [0.8, 0.95], [0.2, 0.95], [0.03, 0.4]],
  hexagon: [[0.25, 0.06], [0.75, 0.06], [0.96, 0.5], [0.75, 0.94], [0.25, 0.94], [0.04, 0.5]],
}

function bakePoly(base, shape, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  // map the unit polygon into a centred region, leaving room for shadow/extrude
  const RX = 0.1,
    RY = 0.06,
    RW = 0.8,
    RH = 0.78
  const pts = POLYS[shape].map(([x, y]) => [(RX + x * RW) * S, (RY + y * RH) * S])
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const ext = S * 0.05 // extrude thickness (down-right) for solidity

  // contact shadow
  ctx.save()
  const maxY = Math.max(...pts.map((p) => p[1]))
  ctx.translate(cx + ext * 0.4, maxY + S * 0.02)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.42)
  sh.addColorStop(0, 'rgba(20,22,30,0.32)')
  sh.addColorStop(1, 'rgba(20,22,30,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, S * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // extruded back edge (darker) for thickness
  const dark = mix(base, [26, 30, 42], 0.5)
  ctx.beginPath()
  ctx.moveTo(pts[0][0] + ext, pts[0][1] + ext)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ext, pts[i][1] + ext)
  ctx.closePath()
  ctx.fillStyle = rgb(dark)
  ctx.fill()

  // faceted front — one triangle fan from centroid, each facet shaded by how its
  // outward normal faces the top-left key light
  const L = [-0.6, -0.75]
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const mxp = (a[0] + b[0]) / 2 - cx
    const myp = (a[1] + b[1]) / 2 - cy
    const len = Math.hypot(mxp, myp) || 1
    const facing = clamp((mxp / len) * L[0] + (myp / len) * L[1], -1, 1)
    const shade = 0.5 + facing * 0.5 // 0 (away) .. 1 (toward light)
    const col = mix(mix(base, [40, 46, 60], 0.3), mix(base, [255, 255, 255], 0.34), shade)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.closePath()
    ctx.fillStyle = rgb(col)
    ctx.fill()
    // facet seam
    ctx.strokeStyle = 'rgba(20,24,36,0.14)'
    ctx.lineWidth = S * 0.006
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(a[0], a[1])
    ctx.stroke()
  }

  // centre glow (the front facet catches the key light)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.clip()
  const glow = ctx.createRadialGradient(cx - S * 0.06, cy - S * 0.06, 0, cx, cy, S * 0.42)
  glow.addColorStop(0, 'rgba(255,255,255,0.34)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, S, S)
  // grain
  const img = ctx.getImageData(0, 0, S, S)
  const dd = img.data
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (dd[idx + 3] < 8) continue
      const m = 1 + (grain(x * 0.6, y * 0.6) * 0.6 + grain(x * 1.8, y * 1.8) * 0.4) * 0.045
      dd[idx] = clamp(dd[idx] * m, 0, 255)
      dd[idx + 1] = clamp(dd[idx + 1] * m, 0, 255)
      dd[idx + 2] = clamp(dd[idx + 2] * m, 0, 255)
    }
  ctx.putImageData(img, 0, 0)
  ctx.restore()

  // bright bevel rim (top-left) + dark rim (bottom-right)
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.lineWidth = S * 0.012
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.stroke()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- muted body tints (calm pastels, a touch desaturated for the sensory rule) --
const CREAM = [232, 234, 238] // the classic white/ivory spotted die
console.log('Baking dice art →')
for (let v = 1; v <= 6; v++) bakeCube(CREAM, v, `pip-${v}.png`)
bakeCube([243, 205, 158], null, 'body-square.png') // d6 (muted orange)
bakePoly([238, 168, 168], 'triangle', 'body-triangle.png') // d4  (muted red)
bakePoly([243, 216, 140], 'diamond', 'body-diamond.png') // d8  (muted yellow)
bakePoly([150, 214, 160], 'kite', 'body-kite.png') // d10 (muted green)
bakePoly([158, 194, 240], 'pentagon', 'body-pentagon.png') // d12 (muted blue)
bakePoly([196, 184, 236], 'hexagon', 'body-hexagon.png') // d20 (muted purple)
console.log('Done.')
