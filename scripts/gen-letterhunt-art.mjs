// Bakes the "מוצאים את האות" (letter hunt) materials as REAL raster art with baked
// soft lighting + grain/AO — never flat CSS shapes+gradients. A calm toy corner:
//
//   • block-*.png — a warm wooden ALPHABET BLOCK: a rounded cube seen with its lit
//                   TOP + shaded RIGHT faces for depth, a soft key light from the
//                   top-left, a recessed painted PANEL on the front face (a carved
//                   inset with AO + a paint sheen) in a muted tint, edge bevel,
//                   material grain and a baked contact shadow so it rests on the
//                   table. The Hebrew letter is NOT baked — the runtime overlays it
//                   as crisp CSS text centred on the panel (razor-legible, and it
//                   changes every round). Four muted tints (cream/sage/sky/blush)
//                   give a real toy-set variety while staying sensory-calm.
//   • letterhunt-room.jpg (→ public/art/bg) — the full calm SCENE the blocks sit
//                   in: a muted greige WALL at the top so the warm blocks pop, and
//                   a warm wooden PLAY TABLE below in perspective (a receding TOP
//                   face + a thick FRONT LIP for depth). Baked plank grain,
//                   converging seams, far-edge AO, near-edge highlight, soft window
//                   key light, corner vignette. Rendered as one 5:4 JPEG served via
//                   SceneBackdrop — the grounded table gives real depth, the blocks
//                   drop their own baked contact shadows onto it.
//
// Same pipeline as the dice / who-is-missing / coin-sort materials: an original
// @napi-rs/canvas bake with seeded value-noise material grain and analytic baked
// lighting/AO. No third-party art — everything here is original CC0. Muted,
// sensory-calm warm-oak palette. One-off build tool:
//   node scripts/gen-letterhunt-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/letterhunt/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const fileBg = (name) => new URL(name, OUT_BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same as dice) ----
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
// THE ALPHABET BLOCK — a rounded wooden cube. Lit TOP + shaded RIGHT faces for
// depth; a recessed painted PANEL on the FRONT face where the CSS letter sits.
// The front-face rect + panel geometry below are MIRRORED in app.css so the
// letter overlays exactly centred on the carved panel.
// ============================================================================
const S = 224
// front face, as fractions of S (MIRRORED in app.css --lh-* vars)
const FX0 = 0.13
const FY0 = 0.3
const FS = 0.6
const DX = 0.135 // depth: how far the top/right faces recede to the right
const DY = 0.135 // …and upward
const WOOD = [178, 138, 92] // warm muted oak body

function bakeBlock(panelTint, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')

  const fx = FX0 * S
  const fy = FY0 * S
  const fs = FS * S
  const dx = DX * S
  const dy = DY * S
  const r = fs * 0.16 // corner radius

  const base = WOOD
  const top = mix(base, [255, 250, 236], 0.26) // lit top face
  const topHi = mix(base, [255, 250, 236], 0.42)
  const right = mix(base, [46, 30, 16], 0.32) // shaded right face
  const rightDk = mix(base, [34, 22, 10], 0.48)

  // --- baked contact shadow on the table, under the block ---
  ctx.save()
  const shY = (FY0 + FS) * S - fs * 0.01
  ctx.translate(fx + fs * 0.54, shY + fs * 0.1)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, fs * 0.66)
  sh.addColorStop(0, 'rgba(28,18,8,0.36)')
  sh.addColorStop(0.6, 'rgba(28,18,8,0.18)')
  sh.addColorStop(1, 'rgba(28,18,8,0)')
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
  // seam highlight where top meets front
  ctx.strokeStyle = rgb(mix(base, [255, 250, 236], 0.6), 0.5)
  ctx.lineWidth = S * 0.006
  ctx.beginPath()
  ctx.moveTo(fx + r * 0.4, fy)
  ctx.lineTo(fx + fs - r * 0.4, fy)
  ctx.stroke()

  // --- FRONT face (rounded square) with key-light gradient + wood grain ---
  roundRectPath(ctx, fx, fy, fs, fs, r)
  g = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs)
  g.addColorStop(0, rgb(mix(base, [255, 250, 236], 0.3))) // lit top-left
  g.addColorStop(0.55, rgb(base))
  g.addColorStop(1, rgb(mix(base, [40, 26, 12], 0.2))) // AO bottom-right
  ctx.save()
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()
  // vertical wood grain streaks on the front face
  for (let i = 0; i < 26; i++) {
    const gx = fx + Math.random() * fs
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(232,200,152,0.16)' : 'rgba(96,62,30,0.18)'
    ctx.lineWidth = 0.6 + Math.random() * 1.7
    ctx.beginPath()
    ctx.moveTo(gx, fy)
    ctx.lineTo(gx + R(4), fy + fs)
    ctx.stroke()
  }
  // soft top-left key-light bloom
  const bloom = ctx.createRadialGradient(fx + fs * 0.3, fy + fs * 0.26, 0, fx + fs * 0.3, fy + fs * 0.26, fs * 0.9)
  bloom.addColorStop(0, 'rgba(255,248,232,0.3)')
  bloom.addColorStop(1, 'rgba(255,248,232,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(fx, fy, fs, fs)
  ctx.restore()

  // --- recessed painted PANEL on the front face (where the letter sits) ---
  const pin = fs * 0.16 // panel inset from the face edge
  const px = fx + pin
  const py = fy + pin
  const ps = fs - pin * 2
  const pr = ps * 0.16
  // AO shadow ring where the panel is carved into the wood (top-left deepest)
  roundRectPath(ctx, px - 3, py - 3, ps + 6, ps + 6, pr + 3)
  ctx.save()
  ctx.clip()
  const ao = ctx.createLinearGradient(px, py, px + ps, py + ps)
  ao.addColorStop(0, 'rgba(40,26,12,0.5)')
  ao.addColorStop(0.4, 'rgba(40,26,12,0.12)')
  ao.addColorStop(1, 'rgba(40,26,12,0)')
  ctx.fillStyle = ao
  ctx.fillRect(px - 3, py - 3, ps + 6, ps + 6)
  ctx.restore()
  // the painted panel surface (muted tint), lit lower-right (inside of a recess)
  roundRectPath(ctx, px, py, ps, ps, pr)
  ctx.save()
  ctx.clip()
  const pg = ctx.createLinearGradient(px, py, px + ps, py + ps)
  pg.addColorStop(0, rgb(mix(panelTint, [30, 20, 10], 0.14))) // shaded top-left rim
  pg.addColorStop(0.5, rgb(panelTint))
  pg.addColorStop(1, rgb(mix(panelTint, [255, 255, 255], 0.16))) // lit bottom-right
  ctx.fillStyle = pg
  ctx.fillRect(px, py, ps, ps)
  // gentle paint sheen near the lit lip
  const sheen = ctx.createRadialGradient(px + ps * 0.72, py + ps * 0.74, 0, px + ps * 0.72, py + ps * 0.74, ps * 0.6)
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(px, py, ps, ps)
  ctx.restore()
  // crisp inner rim of the panel: dark top-left (recess wall) + light bottom-right
  ctx.save()
  roundRectPath(ctx, px, py, ps, ps, pr)
  ctx.lineWidth = S * 0.01
  const rim = ctx.createLinearGradient(px, py, px + ps, py + ps)
  rim.addColorStop(0, 'rgba(30,18,8,0.4)')
  rim.addColorStop(0.5, 'rgba(30,18,8,0.05)')
  rim.addColorStop(1, 'rgba(255,250,236,0.5)')
  ctx.strokeStyle = rim
  ctx.stroke()
  ctx.restore()

  // --- crisp bevel rim on the front face (bright top-left, dark bottom-right) ---
  ctx.save()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.016
  const bev = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs)
  bev.addColorStop(0, 'rgba(255,250,236,0.6)')
  bev.addColorStop(0.5, 'rgba(255,250,236,0.05)')
  bev.addColorStop(0.52, 'rgba(40,26,12,0.05)')
  bev.addColorStop(1, 'rgba(40,26,12,0.55)')
  ctx.strokeStyle = bev
  ctx.stroke()
  ctx.restore()

  grainPass(ctx, S, S, 0.045)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE ROOM — the full calm SCENE the blocks sit in, baked as one 5:4 JPEG: a
// muted greige WALL at the top (so warm blocks pop) + a warm wooden PLAY TABLE in
// perspective below (receding TOP face the blocks stand grounded on + a thick
// FRONT LIP for depth). Served via SceneBackdrop.
// ============================================================================
function bakeRoom(name) {
  const W = 640
  const H = 512
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const OAK = [170, 128, 80]
  const OAK_DK = [116, 82, 46]
  const OAK_LT = [200, 158, 104]

  const topY = 100 // far (back) edge of the table top (wall fills above this)
  const botY = 474 // near (front) edge of the table top
  const topHalf = 300 // half-width of the far edge (narrower → perspective)
  const botHalf = 320 // half-width of the near edge (full width)
  const lipH = 38 // front lip thickness

  // --- WALL: a calm muted greige wash so the warm blocks pop against it ---
  const WALL = [206, 202, 196]
  const WALL_DK = [182, 178, 172]
  // opaque base fill first (JPEG has no alpha) — the table's slim far-corner side
  // gaps then read as wall continuing down behind it, never black.
  x.fillStyle = rgb(WALL_DK)
  x.fillRect(0, 0, W, H)
  const wg = x.createLinearGradient(0, 0, 0, topY + 20)
  wg.addColorStop(0, rgb(mix(WALL, [255, 255, 255], 0.1)))
  wg.addColorStop(1, rgb(WALL_DK))
  x.fillStyle = wg
  x.fillRect(0, 0, W, topY + 24)
  // soft off-centre window glow high on the wall
  const win = x.createRadialGradient(cxb - 150, 40, 20, cxb - 150, 40, 380)
  win.addColorStop(0, 'rgba(255,250,236,0.4)')
  win.addColorStop(1, 'rgba(255,250,236,0)')
  x.fillStyle = win
  x.fillRect(0, 0, W, topY + 24)
  // a quiet wainscot molding line just above the table's far edge
  x.strokeStyle = 'rgba(150,146,140,0.5)'
  x.lineWidth = 3
  x.beginPath()
  x.moveTo(0, topY - 10)
  x.lineTo(W, topY - 10)
  x.stroke()
  x.strokeStyle = 'rgba(255,255,255,0.3)'
  x.lineWidth = 1.5
  x.beginPath()
  x.moveTo(0, topY - 13)
  x.lineTo(W, topY - 13)
  x.stroke()
  // the wall meets the table in soft contact shade
  const wallAo = x.createLinearGradient(0, topY - 34, 0, topY)
  wallAo.addColorStop(0, 'rgba(60,50,40,0)')
  wallAo.addColorStop(1, 'rgba(60,50,40,0.22)')
  x.fillStyle = wallAo
  x.fillRect(0, topY - 34, W, 34)

  // --- soft ground shadow under the whole table ---
  x.save()
  x.translate(cxb, botY + lipH + 4)
  x.scale(1, 0.24)
  const gsh = x.createRadialGradient(0, 0, 0, 0, 0, botHalf + 30)
  gsh.addColorStop(0, 'rgba(24,15,6,0.3)')
  gsh.addColorStop(1, 'rgba(24,15,6,0)')
  x.fillStyle = gsh
  x.beginPath()
  x.arc(0, 0, botHalf + 30, 0, Math.PI * 2)
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
  g.addColorStop(0.5, rgb(OAK))
  g.addColorStop(1, rgb(OAK_LT)) // near = lit
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  // horizontal plank grain, spread wider toward the near edge (perspective)
  for (let i = 0; i < 46; i++) {
    const yy = topY + Math.random() * (botY - topY)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(116,82,46,0.2)' : 'rgba(214,182,136,0.22)'
    x.lineWidth = 0.8 + Math.random() * 2.4
    x.beginPath()
    x.moveTo(cxb - botHalf, yy)
    for (let sx = -botHalf; sx <= botHalf; sx += 44) x.lineTo(cxb + sx, yy + R(5))
    x.stroke()
  }
  // plank seams converging toward the far edge (perspective lines)
  x.strokeStyle = 'rgba(70,48,22,0.36)'
  x.lineWidth = 2
  for (const frac of [-0.66, -0.34, 0, 0.34, 0.66]) {
    x.beginPath()
    x.moveTo(cxb + frac * topHalf, topY)
    x.lineTo(cxb + frac * botHalf, botY)
    x.stroke()
  }
  // far-edge ambient occlusion (the back of the table sits in shade)
  const ao = x.createLinearGradient(0, topY, 0, topY + 60)
  ao.addColorStop(0, 'rgba(44,28,12,0.5)')
  ao.addColorStop(1, 'rgba(44,28,12,0)')
  x.fillStyle = ao
  x.fillRect(0, topY, W, 60)
  // soft top-left key light pooling on the boards
  const kl = x.createRadialGradient(cxb - 120, botY - 60, 20, cxb - 120, botY - 60, 420)
  kl.addColorStop(0, 'rgba(255,246,220,0.18)')
  kl.addColorStop(1, 'rgba(255,246,220,0)')
  x.fillStyle = kl
  x.fillRect(0, 0, W, H)
  // gentle corner vignette on the surface (calm focus)
  const vg = x.createRadialGradient(cxb, (topY + botY) / 2, W * 0.2, cxb, (topY + botY) / 2, W * 0.62)
  vg.addColorStop(0, 'rgba(30,18,8,0)')
  vg.addColorStop(1, 'rgba(30,18,8,0.22)')
  x.fillStyle = vg
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
  lg.addColorStop(0, rgb(mix(OAK, [255, 255, 255], 0.05)))
  lg.addColorStop(1, rgb(mix(OAK_DK, [18, 10, 4], 0.34)))
  x.fillStyle = lg
  x.fillRect(0, botY, W, lipH)
  for (let i = 0; i < 48; i++) {
    const gx = cxb - botHalf + Math.random() * (botHalf * 2)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(228,196,148,0.16)' : 'rgba(58,36,16,0.22)'
    x.lineWidth = 0.7 + Math.random() * 1.8
    x.beginPath()
    x.moveTo(gx, botY)
    x.lineTo(gx + R(3), botY + lipH)
    x.stroke()
  }
  x.restore()
  // crisp lit near-edge (top of the lip catches the light)
  x.strokeStyle = 'rgba(255,242,214,0.8)'
  x.lineWidth = 2.5
  x.beginPath()
  x.moveTo(cxb - botHalf, botY)
  x.lineTo(cxb + botHalf, botY)
  x.stroke()
  // dark base line under the lip
  x.strokeStyle = 'rgba(28,16,6,0.5)'
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(cxb - botHalf, botY + lipH)
  x.lineTo(cxb + botHalf, botY + lipH)
  x.stroke()

  grainPass(x, W, H, 0.04)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(fileBg(name), buf)
  console.log('  ✓ bg/' + name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- muted panel tints (calm pastels, a touch desaturated for the sensory rule) --
console.log('Baking letter-hunt art →')
bakeBlock([236, 224, 200], 'block-cream.png') // warm cream
bakeBlock([196, 214, 194], 'block-sage.png') // muted sage
bakeBlock([192, 210, 226], 'block-sky.png') // soft dusty sky
bakeBlock([230, 204, 202], 'block-blush.png') // muted blush
bakeRoom('letterhunt-room.jpg')
console.log('Done.')
