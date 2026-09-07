// Bakes the "גמילה מטיטול" (potty training) bathroom materials as REAL raster art
// with baked lighting/AO/bevels — never flat CSS shapes+gradients. A calm home
// bathroom corner:
//
//   • potty-room.jpg (→ public/art/bg) — the full calm SCENE: a muted greige-blue
//                   WALL with a soft window glow up top, and a bathroom FLOOR TILE
//                   in perspective below (receding grout lines converging toward the
//                   back wall, baked AO where floor meets wall, a near-edge highlight).
//                   Rendered as one 5:4 JPEG served via SceneBackdrop, replacing the
//                   flat `.potty-room::before/::after` wall-tile/floor gradients.
//   • potty-toilet.png — one coherent baked toilet BODY (cistern tank + flush button
//                   + lid + seat ring + pedestal base), porcelain-white with baked
//                   top-left key light, bevels, AO in the crevices and a contact
//                   shadow. Alpha PNG, sized to sit exactly where the old
//                   .pt-tank/.pt-flush/.pt-lid/.pt-base/.pt-seat stack sat. The
//                   bowl opening is left as a soft shaded well so the CSS pee/poop/
//                   kid-seat overlays still read as sitting "inside" it.
//   • potty-sink.png — a small baked basin + faucet (porcelain body, metal spout),
//                   replacing `.potty-sink`/`.ps-basin`.
//
// Same pipeline as the letter-hunt / calculator materials: an original @napi-rs/canvas
// bake with seeded value-noise material grain and analytic baked lighting/AO. No
// third-party art — everything here is original CC0. Muted, sensory-calm palette,
// one consistent top-left key light, no saturated pure colours.
//   node scripts/gen-potty-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/potty/', import.meta.url)
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
// THE ROOM — a calm home bathroom corner: muted greige-blue WALL up top (a soft
// window glow, a quiet wainscot line) + a bathroom FLOOR TILE below in
// perspective (grout lines converging toward the back wall, baked AO at the
// wall/floor seam, a lit near edge). Served via SceneBackdrop.
// ============================================================================
function bakeRoom(name) {
  const W = 640
  const H = 512
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const topY = 208 // wall/floor seam (far edge of the floor)
  const botY = H // near (front) edge of the floor fills to the bottom

  // --- WALL: calm muted blue-greige wash ---
  const WALL = [206, 220, 224]
  const WALL_DK = [176, 194, 198]
  x.fillStyle = rgb(WALL_DK)
  x.fillRect(0, 0, W, H)
  const wg = x.createLinearGradient(0, 0, 0, topY + 10)
  wg.addColorStop(0, rgb(mix(WALL, [255, 255, 255], 0.14)))
  wg.addColorStop(1, rgb(WALL_DK))
  x.fillStyle = wg
  x.fillRect(0, 0, W, topY + 14)
  // soft window glow, upper area
  const win = x.createRadialGradient(cxb + 160, 60, 20, cxb + 160, 60, 340)
  win.addColorStop(0, 'rgba(255,252,240,0.42)')
  win.addColorStop(1, 'rgba(255,252,240,0)')
  x.fillStyle = win
  x.fillRect(0, 0, W, topY + 14)
  // a soft window frame silhouette (very understated, no hard shapes)
  x.save()
  x.strokeStyle = 'rgba(255,255,255,0.4)'
  x.lineWidth = 6
  roundRectPath(x, cxb + 68, 26, 172, 132, 10)
  x.stroke()
  x.strokeStyle = 'rgba(255,255,255,0.28)'
  x.lineWidth = 3
  x.beginPath()
  x.moveTo(cxb + 68 + 86, 26)
  x.lineTo(cxb + 68 + 86, 158)
  x.moveTo(cxb + 68, 26 + 66)
  x.lineTo(cxb + 240, 26 + 66)
  x.stroke()
  x.restore()
  // quiet wainscot molding line just above the wall/floor seam
  x.strokeStyle = 'rgba(140,158,162,0.5)'
  x.lineWidth = 3
  x.beginPath()
  x.moveTo(0, topY - 8)
  x.lineTo(W, topY - 8)
  x.stroke()
  x.strokeStyle = 'rgba(255,255,255,0.32)'
  x.lineWidth = 1.5
  x.beginPath()
  x.moveTo(0, topY - 11)
  x.lineTo(W, topY - 11)
  x.stroke()

  // --- FLOOR: bathroom tile in perspective, receding toward the back wall ---
  const FLOOR = [222, 214, 200]
  const FLOOR_DK = [186, 176, 158]
  const FLOOR_LT = [236, 230, 216]
  x.save()
  x.beginPath()
  x.rect(0, topY, W, botY - topY)
  x.clip()
  const fg = x.createLinearGradient(0, topY, 0, botY)
  fg.addColorStop(0, rgb(FLOOR_DK))
  fg.addColorStop(0.55, rgb(FLOOR))
  fg.addColorStop(1, rgb(FLOOR_LT))
  x.fillStyle = fg
  x.fillRect(0, topY, W, botY - topY)

  // vanishing point above the visible frame — grout lines converge gently
  const vpX = cxb
  const vpY = topY - 260
  // radiating (vertical-ish) grout lines
  x.strokeStyle = 'rgba(120,100,72,0.32)'
  x.lineWidth = 2
  for (let i = -7; i <= 7; i++) {
    const bx0 = cxb + i * 64
    x.beginPath()
    x.moveTo(vpX + (bx0 - vpX) * ((topY - vpY) / (botY - vpY)), topY)
    x.lineTo(bx0, botY)
    x.stroke()
  }
  // horizontal grout lines, spaced tighter near the back (perspective)
  const rows = [topY + 6, topY + 18, topY + 38, topY + 66, topY + 104, topY + 156, topY + 224, topY + 300]
  x.strokeStyle = 'rgba(120,100,72,0.28)'
  x.lineWidth = 1.6
  for (const yy of rows) {
    if (yy > botY) continue
    x.beginPath()
    x.moveTo(0, yy)
    x.lineTo(W, yy)
    x.stroke()
  }
  // subtle per-tile brightness variance for a baked, non-uniform tile feel
  for (let ty = 0; ty < rows.length; ty++) {
    const y0 = rows[ty]
    const y1 = ty + 1 < rows.length ? rows[ty + 1] : botY
    if (y0 > botY) continue
    for (let i = -7; i < 7; i++) {
      const shade = Math.random() * 0.05 - 0.025
      x.fillStyle = `rgba(${shade > 0 ? '255,250,238' : '90,70,44'},${Math.abs(shade)})`
      const xL = vpX + (cxb + i * 64 - vpX) * ((y0 - vpY) / (botY - vpY))
      const xR = vpX + (cxb + (i + 1) * 64 - vpX) * ((y0 - vpY) / (botY - vpY))
      x.beginPath()
      x.moveTo(xL, y0)
      x.lineTo(xR, y0)
      x.lineTo(xR, y1)
      x.lineTo(xL, y1)
      x.closePath()
      x.fill()
    }
  }
  // far-edge AO where floor meets wall
  const ao = x.createLinearGradient(0, topY, 0, topY + 46)
  ao.addColorStop(0, 'rgba(50,40,26,0.4)')
  ao.addColorStop(1, 'rgba(50,40,26,0)')
  x.fillStyle = ao
  x.fillRect(0, topY, W, 46)
  // soft key-light pool lower-left (matches the room's warm accent props)
  const kl = x.createRadialGradient(cxb - 180, botY - 90, 20, cxb - 180, botY - 90, 420)
  kl.addColorStop(0, 'rgba(255,248,230,0.16)')
  kl.addColorStop(1, 'rgba(255,248,230,0)')
  x.fillStyle = kl
  x.fillRect(0, topY, W, botY - topY)
  // gentle vignette for calm focus
  const vg = x.createRadialGradient(cxb, (topY + botY) / 2, W * 0.22, cxb, (topY + botY) / 2, W * 0.66)
  vg.addColorStop(0, 'rgba(30,22,10,0)')
  vg.addColorStop(1, 'rgba(30,22,10,0.2)')
  x.fillStyle = vg
  x.fillRect(0, topY, W, botY - topY)
  x.restore()

  grainPass(x, W, H, 0.035)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(fileBg(name), buf)
  console.log('  ✓ bg/' + name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE TOILET — one coherent baked porcelain object: cistern tank + flush button
// + lid + seat ring + pedestal base, all in soft porcelain-white with a top-left
// key light, crevice AO, bevels and a baked contact shadow. The seat-ring opening
// is left as a soft shaded well (transparent-ish darker basin) so the runtime's
// CSS pee/poop/kid-seat-reducer overlays still read as sitting "inside" it, in
// exactly the geometry the old .pt-* stack used (120×146 box, seat centred ~top:74–120).
// ============================================================================
function bakeToilet(name) {
  const W = 240
  const H = 292 // 2x the old 120×146 box for crispness
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const PORC = [244, 247, 248]
  const PORC_SH = [176, 190, 198]
  const PORC_DK = [128, 144, 154]
  const cx = W / 2

  // baked contact shadow under the base
  ctx.save()
  ctx.translate(cx, H - 6)
  ctx.scale(1, 0.26)
  const csh = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.5)
  csh.addColorStop(0, 'rgba(20,26,30,0.34)')
  csh.addColorStop(1, 'rgba(20,26,30,0)')
  ctx.fillStyle = csh
  ctx.beginPath()
  ctx.arc(0, 0, W * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // helper: porcelain-filled rounded shape with top-left key light + bottom-right AO
  function porcelainFill(pathFn, base = PORC, dark = PORC_DK) {
    pathFn()
    ctx.save()
    ctx.clip()
    const bbox = { x: 0, y: 0, w: W, h: H }
    const g = ctx.createLinearGradient(bbox.x, bbox.y, bbox.x + bbox.w * 0.5, bbox.y + bbox.h)
    g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.55)))
    g.addColorStop(0.45, rgb(base))
    g.addColorStop(1, rgb(dark))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  // --- PEDESTAL BASE (bottom, floor to seat) — slightly shaded (recedes back) ---
  const baseTop = 148
  const baseW = 104
  porcelainFill(() => {
    roundRectPath(ctx, cx - baseW / 2, baseTop, baseW, H - baseTop - 4, 20)
  }, mix(PORC, [200, 210, 214], 0.28), mix(PORC_DK, [90, 104, 112], 0.3))
  // base shading: darker toward the floor (less light reaches down there)
  ctx.save()
  roundRectPath(ctx, cx - baseW / 2, baseTop, baseW, H - baseTop - 4, 20)
  ctx.clip()
  const baseSh = ctx.createLinearGradient(0, baseTop, 0, H)
  baseSh.addColorStop(0, 'rgba(0,0,0,0)')
  baseSh.addColorStop(1, 'rgba(24,32,36,0.32)')
  ctx.fillStyle = baseSh
  ctx.fillRect(0, baseTop, W, H - baseTop)
  // narrow vertical shade toward the sides (cylindrical read)
  const baseCyl = ctx.createLinearGradient(cx - baseW / 2, 0, cx + baseW / 2, 0)
  baseCyl.addColorStop(0, 'rgba(20,28,32,0.28)')
  baseCyl.addColorStop(0.22, 'rgba(20,28,32,0)')
  baseCyl.addColorStop(0.78, 'rgba(255,255,255,0)')
  baseCyl.addColorStop(1, 'rgba(255,255,255,0.22)')
  ctx.fillStyle = baseCyl
  ctx.fillRect(cx - baseW / 2, baseTop, baseW, H - baseTop)
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, cx - baseW / 2, baseTop, baseW, H - baseTop - 4, 20)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = rgb(PORC_DK, 0.85)
  ctx.stroke()
  ctx.restore()

  // --- CISTERN TANK (back-top) ---
  const tankW = 142
  const tankH = 66
  const tankX = cx - tankW / 2
  const tankY = 0
  porcelainFill(() => {
    roundRectPath(ctx, tankX, tankY, tankW, tankH, 16)
  })
  ctx.save()
  roundRectPath(ctx, tankX, tankY, tankW, tankH, 16)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = rgb(PORC_DK, 0.85)
  ctx.stroke()
  ctx.restore()
  // tank bottom AO (where it meets the lid)
  ctx.save()
  roundRectPath(ctx, tankX, tankY, tankW, tankH, 16)
  ctx.clip()
  const tankAo = ctx.createLinearGradient(0, tankY + tankH - 18, 0, tankY + tankH)
  tankAo.addColorStop(0, 'rgba(20,28,32,0)')
  tankAo.addColorStop(1, 'rgba(20,28,32,0.3)')
  ctx.fillStyle = tankAo
  ctx.fillRect(tankX, tankY, tankW, tankH)
  ctx.restore()
  // flush button on the tank — a small recessed disc with inner AO
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, tankY + 22, 15, 8, 0, 0, Math.PI * 2)
  ctx.clip()
  const fb = ctx.createLinearGradient(cx - 15, tankY + 14, cx + 15, tankY + 30)
  fb.addColorStop(0, rgb(PORC_DK))
  fb.addColorStop(1, rgb(mix(PORC_DK, [255, 255, 255], 0.3)))
  ctx.fillStyle = fb
  ctx.fillRect(cx - 20, tankY + 10, 40, 24)
  ctx.restore()
  ctx.strokeStyle = 'rgba(40,50,54,0.3)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.ellipse(cx, tankY + 22, 15, 8, 0, 0, Math.PI * 2)
  ctx.stroke()

  // --- LID (behind the seat, raised) ---
  const lidW = 158
  const lidH = 86
  const lidX = cx - lidW / 2
  const lidY = tankY + tankH - 6
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(lidX, lidY + lidH)
  ctx.quadraticCurveTo(lidX, lidY, cx, lidY)
  ctx.quadraticCurveTo(lidX + lidW, lidY, lidX + lidW, lidY + lidH)
  ctx.closePath()
  ctx.clip()
  const lg = ctx.createLinearGradient(lidX, lidY, lidX + lidW, lidY + lidH)
  lg.addColorStop(0, rgb(mix(PORC, [255, 255, 255], 0.45)))
  lg.addColorStop(0.6, rgb(PORC))
  lg.addColorStop(1, rgb(PORC_SH))
  ctx.fillStyle = lg
  ctx.fillRect(lidX, lidY, lidW, lidH)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(lidX, lidY + lidH)
  ctx.quadraticCurveTo(lidX, lidY, cx, lidY)
  ctx.quadraticCurveTo(lidX + lidW, lidY, lidX + lidW, lidY + lidH)
  ctx.closePath()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = rgb(PORC_DK, 0.7)
  ctx.stroke()
  ctx.restore()

  // --- SEAT RING (the ellipse you sit on) ---
  const seatY = lidY + 44
  const seatRX = 96
  const seatRY = 42
  porcelainFill(() => {
    ctx.beginPath()
    ctx.ellipse(cx, seatY, seatRX, seatRY, 0, 0, Math.PI * 2)
  })
  // seat ring bottom AO (drop shadow onto the base beneath it)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, seatY, seatRX, seatRY, 0, 0, Math.PI * 2)
  ctx.clip()
  const seatAo = ctx.createLinearGradient(0, seatY + seatRY * 0.35, 0, seatY + seatRY)
  seatAo.addColorStop(0, 'rgba(20,28,32,0)')
  seatAo.addColorStop(1, 'rgba(20,28,32,0.24)')
  ctx.fillStyle = seatAo
  ctx.fillRect(cx - seatRX, seatY - seatRY, seatRX * 2, seatRY * 2)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, seatY, seatRX, seatRY, 0, 0, Math.PI * 2)
  ctx.lineWidth = 3
  ctx.strokeStyle = rgb(PORC_DK, 0.9)
  ctx.stroke()
  ctx.restore()

  // --- BOWL WELL (the shaded opening inside the seat — CSS overlays sit "in" it) ---
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, seatY + 6, seatRX * 0.78, seatRY * 0.66, 0, 0, Math.PI * 2)
  ctx.clip()
  const well = ctx.createRadialGradient(cx, seatY + 2, 6, cx, seatY + 6, seatRX * 0.8)
  well.addColorStop(0, 'rgba(120,142,152,0.62)')
  well.addColorStop(0.7, 'rgba(84,104,116,0.52)')
  well.addColorStop(1, 'rgba(56,74,86,0.6)')
  ctx.fillStyle = well
  ctx.fillRect(cx - seatRX, seatY - seatRY, seatRX * 2, seatRY * 2)
  ctx.restore()
  ctx.strokeStyle = 'rgba(40,54,62,0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, seatY + 6, seatRX * 0.78, seatRY * 0.66, 0, 0, Math.PI * 2)
  ctx.stroke()

  // --- top-left key-light bloom over the whole fixture ---
  const bloom = ctx.createRadialGradient(cx - 60, 60, 10, cx - 60, 60, 260)
  bloom.addColorStop(0, 'rgba(255,255,250,0.35)')
  bloom.addColorStop(1, 'rgba(255,255,250,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, W, H)

  grainPass(ctx, W, H, 0.02)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SINK — a small basin + faucet, porcelain body + muted metal spout, baked
// bevels and a contact shadow. Replaces .potty-sink/.ps-basin (52×44 old box).
// ============================================================================
function bakeSink(name) {
  const W = 140
  const H = 128 // 2x-ish the old 52×44 for crispness, extra height for the faucet
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const PORC = [244, 247, 248]
  const PORC_DK = [136, 150, 158]
  const METAL = [172, 184, 190]
  const METAL_DK = [92, 104, 112]
  const cx = W / 2

  // contact shadow
  ctx.save()
  ctx.translate(cx, H - 6)
  ctx.scale(1, 0.3)
  const csh = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.48)
  csh.addColorStop(0, 'rgba(20,26,30,0.3)')
  csh.addColorStop(1, 'rgba(20,26,30,0)')
  ctx.fillStyle = csh
  ctx.beginPath()
  ctx.arc(0, 0, W * 0.48, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // basin body — rounded trapezoid tapering to a narrower base
  const basinTopY = 44
  const basinBotY = H - 8
  const basinTopHalf = 60
  const basinBotHalf = 42
  ctx.save()
  roundRectPath(
    ctx,
    cx - basinTopHalf,
    basinTopY,
    basinTopHalf * 2,
    basinBotY - basinTopY,
    16
  )
  ctx.clip()
  const bg = ctx.createLinearGradient(0, basinTopY, 0, basinBotY)
  bg.addColorStop(0, rgb(mix(PORC, [255, 255, 255], 0.4)))
  bg.addColorStop(0.5, rgb(PORC))
  bg.addColorStop(1, rgb(PORC_DK))
  ctx.fillStyle = bg
  ctx.fillRect(0, basinTopY, W, basinBotY - basinTopY)
  // basin AO taper toward the base (narrower, in shade)
  const taper = ctx.createLinearGradient(0, basinTopY, 0, basinBotY)
  taper.addColorStop(0, 'rgba(30,40,44,0)')
  taper.addColorStop(1, 'rgba(30,40,44,0.36)')
  ctx.fillStyle = taper
  ctx.fillRect(0, basinTopY, W, basinBotY - basinTopY)
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, cx - basinTopHalf, basinTopY, basinTopHalf * 2, basinBotY - basinTopY, 16)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = rgb(PORC_DK, 0.9)
  ctx.stroke()
  ctx.restore()

  // basin rim ellipse (top opening) with a shaded well inside
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, basinTopY, basinTopHalf, 13, 0, 0, Math.PI * 2)
  ctx.clip()
  const well = ctx.createRadialGradient(cx, basinTopY, 4, cx, basinTopY, basinTopHalf)
  well.addColorStop(0, 'rgba(120,142,152,0.6)')
  well.addColorStop(1, 'rgba(80,100,110,0.5)')
  ctx.fillStyle = well
  ctx.fillRect(cx - basinTopHalf, basinTopY - 13, basinTopHalf * 2, 26)
  ctx.restore()
  ctx.strokeStyle = rgb(PORC_DK, 0.95)
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.ellipse(cx, basinTopY, basinTopHalf, 13, 0, 0, Math.PI * 2)
  ctx.stroke()
  // rim highlight (key light top-left)
  ctx.strokeStyle = 'rgba(255,255,250,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, basinTopY, basinTopHalf - 2, 11, 0, Math.PI * 0.95, Math.PI * 1.6)
  ctx.stroke()

  // faucet — a simple muted metal spout rising from the back of the basin
  const fx = cx
  const fTopY = 2
  const fBotY = basinTopY + 4
  ctx.save()
  roundRectPath(ctx, fx - 9, fTopY, 18, fBotY - fTopY, 8)
  ctx.clip()
  const mg = ctx.createLinearGradient(fx - 9, 0, fx + 9, 0)
  mg.addColorStop(0, rgb(mix(METAL, [255, 255, 255], 0.35)))
  mg.addColorStop(0.5, rgb(METAL))
  mg.addColorStop(1, rgb(METAL_DK))
  ctx.fillStyle = mg
  ctx.fillRect(fx - 9, fTopY, 18, fBotY - fTopY)
  ctx.restore()
  ctx.strokeStyle = rgb(METAL_DK, 0.8)
  ctx.lineWidth = 1.6
  roundRectPath(ctx, fx - 9, fTopY, 18, fBotY - fTopY, 8)
  ctx.stroke()
  // faucet cap highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(fx - 3, fTopY + 6, 3, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // top-left key-light bloom over the whole sink
  const bloom = ctx.createRadialGradient(cx - 40, 30, 8, cx - 40, 30, 140)
  bloom.addColorStop(0, 'rgba(255,255,250,0.32)')
  bloom.addColorStop(1, 'rgba(255,255,250,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, W, H)

  grainPass(ctx, W, H, 0.02)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking potty-training art →')
bakeRoom('potty-room.jpg')
bakeToilet('potty-toilet.png')
bakeSink('potty-sink.png')
console.log('Done.')
