// Bakes the "גינה" garden materials — REAL, lit, textured art (not flat CSS
// shapes+gradients). Same pipeline as the dice / coin-sort / sortshelf bakes: an
// original @napi-rs/canvas render with seeded value-noise grain and analytic
// baked lighting/AO. Muted, sensory-calm palette. No third-party art (CC0).
//
// Everything a child sees as a MATERIAL is baked here into
// public/art/sprites/garden/ :
//   bed.png            the raised wooden planter bed — 3/4 perspective, a lit
//                      wood-plank front face + a receding soil top with real
//                      crumbly-dirt texture, pebbles and baked AO + contact shadow
//   seed.png           a just-planted seed on a little soil mound
//   sprout.png         a young two-leaf sprout
//   bud.png            a taller stem with a closed bud
//   flower-*.png       six muted blooms (daisy/tulip/rose/sun/cosmos/viola)
//   can.png            a muted galvanised watering can (baked tin)
//   packet.png         a craft-paper seed packet (the "plant" button icon)
//
// The sky/meadow BACKDROP is the shared CC0 bg (public/art/bg/bg-meadow.jpg) via
// <SceneBackdrop>, so nothing in the scene is a flat CSS gradient.
//
// One-off build tool (canvas is already installed + pinned):
//   node scripts/gen-garden-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/garden/', import.meta.url)
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
  const lp = (a, b, t) => a + t * (b - a)
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
    const x1 = lp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lp(x1, x2, v) // ~[-1,1]
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
// multiply a seeded fibre/dirt grain over every painted pixel — the single most
// important step that kills the "flat CSS" read.
function grainPass(ctx, W, H, amt = 0.05, sx = 0.5, sy = 0.5) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * sx, y * sy) * 0.6 + grain(x * sx * 3.1, y * sy * 3.1) * 0.4
      const m = 1 + n * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

function save(cv, name) {
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${cv.width}×${cv.height}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- muted, sensory-calm palette --------------------------------------------
const WOOD = [156, 118, 80]
const WOOD_HI = [192, 156, 116]
const WOOD_SEAM = [104, 76, 50]
const WOOD_AO = [82, 58, 38]
const SOIL = [96, 68, 47]
const SOIL_DK = [66, 46, 31]
const SOIL_HI = [126, 96, 68]
const PEBBLE = [150, 140, 124]
const STEM = [98, 150, 86]
const STEM_HI = [146, 190, 124]
const STEM_DK = [64, 108, 62]
const LEAF = [104, 158, 88]
const LEAF_HI = [152, 196, 128]
const LEAF_DK = [66, 112, 66]

// =============================================================================
// THE RAISED PLANTER BED — 3/4 perspective: a receding soil top surface + a lit
// wood-plank front face, baked pebbles / dirt grain / AO and a soft ground shadow.
// =============================================================================
function bakeBed() {
  const W = 1000
  const H = 440
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // soil-top trapezoid (wider at the near/front edge — perspective toward camera)
  const FLx = 66, FRx = 934, FY = 244 // front top edge
  const BLx = 150, BRx = 850, BY = 118 // back top edge (raised + inset)
  const frontBottom = 388 // bottom of the wooden front face

  // --- soft contact shadow on the meadow, under the whole bed ---
  ctx.save()
  ctx.translate(W / 2, frontBottom + 6)
  ctx.scale(1, 0.16)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.5)
  sh.addColorStop(0, 'rgba(30,34,20,0.34)')
  sh.addColorStop(0.7, 'rgba(30,34,20,0.16)')
  sh.addColorStop(1, 'rgba(30,34,20,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, W * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- WOOD FRONT FACE (planks) ---
  const plankN = 7
  const plankW = (FRx - FLx) / plankN
  for (let p = 0; p < plankN; p++) {
    const x0 = FLx + p * plankW
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, FY, plankW + 1, frontBottom - FY)
    ctx.clip()
    // per-plank vertical cylinder shade (lit centre, darker edges) + slight tone shift
    const tone = mix(WOOD, p % 2 ? WOOD_HI : WOOD_AO, 0.12)
    let g = ctx.createLinearGradient(x0, 0, x0 + plankW, 0)
    g.addColorStop(0, rgb(mix(tone, WOOD_AO, 0.45)))
    g.addColorStop(0.5, rgb(mix(tone, WOOD_HI, 0.28)))
    g.addColorStop(1, rgb(mix(tone, WOOD_AO, 0.5)))
    ctx.fillStyle = g
    ctx.fillRect(x0, FY, plankW + 1, frontBottom - FY)
    // vertical wood grain streaks
    for (let s = 0; s < 3; s++) {
      const gx = x0 + (s + 0.5) * (plankW / 3) + (grain(p * 4 + s, 0) * plankW) / 8
      ctx.strokeStyle = rgb(s % 2 ? WOOD_AO : WOOD_HI, 0.14)
      ctx.lineWidth = 2 + (s % 2)
      ctx.beginPath()
      ctx.moveTo(gx, FY)
      ctx.bezierCurveTo(gx + 5, FY + 60, gx - 5, frontBottom - 60, gx + 3, frontBottom)
      ctx.stroke()
    }
    // top lit lip + bottom AO of this plank
    let lip = ctx.createLinearGradient(0, FY, 0, FY + 26)
    lip.addColorStop(0, rgb(WOOD_HI, 0.5))
    lip.addColorStop(1, rgb(WOOD_HI, 0))
    ctx.fillStyle = lip
    ctx.fillRect(x0, FY, plankW + 1, 26)
    let ao = ctx.createLinearGradient(0, frontBottom - 40, 0, frontBottom)
    ao.addColorStop(0, rgb(WOOD_AO, 0))
    ao.addColorStop(1, rgb(WOOD_AO, 0.55))
    ctx.fillStyle = ao
    ctx.fillRect(x0, frontBottom - 40, plankW + 1, 40)
    ctx.restore()
    // seam between planks
    ctx.strokeStyle = rgb(WOOD_SEAM, 0.6)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x0, FY)
    ctx.lineTo(x0, frontBottom)
    ctx.stroke()
  }
  // rounded bottom corners cut of the front face (soft, not a hard CSS rect)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  for (const [cx, cy] of [[FLx, frontBottom], [FRx, frontBottom]]) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + (cx === FLx ? 0 : -18), cy)
    ctx.arc(cx + (cx === FLx ? 18 : -18), cy - 18, 18, cx === FLx ? Math.PI : Math.PI * 1.5, cx === FLx ? Math.PI * 1.5 : Math.PI * 2, false)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // --- SOIL TOP (receding trapezoid) ---
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(FLx, FY)
  ctx.lineTo(FRx, FY)
  ctx.lineTo(BRx, BY)
  ctx.lineTo(BLx, BY)
  ctx.closePath()
  ctx.clip()
  // base dirt fill, gently lit from the top (sky) — darker toward the front lip (AO)
  let sg = ctx.createLinearGradient(0, BY, 0, FY)
  sg.addColorStop(0, rgb(mix(SOIL, SOIL_HI, 0.22)))
  sg.addColorStop(0.6, rgb(SOIL))
  sg.addColorStop(1, rgb(mix(SOIL, SOIL_DK, 0.5)))
  ctx.fillStyle = sg
  ctx.fillRect(0, BY, W, FY - BY)
  // crumbly clods: dense value-noise, thresholded into light/dark specks
  const soilImg = ctx.getImageData(0, 0, W, H)
  const sd = soilImg.data
  for (let y = BY; y < FY; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (sd[idx + 3] < 8) continue
      const n = grain(x * 0.07, y * 0.085) * 0.72 + grain(x * 0.19, y * 0.19) * 0.28
      const shade = mix(SOIL_DK, SOIL_HI, clamp(0.5 + n * 0.9, 0, 1))
      const t = 0.4
      sd[idx] = clamp(sd[idx] * (1 - t) + shade[0] * t, 0, 255)
      sd[idx + 1] = clamp(sd[idx + 1] * (1 - t) + shade[1] * t, 0, 255)
      sd[idx + 2] = clamp(sd[idx + 2] * (1 - t) + shade[2] * t, 0, 255)
    }
  }
  ctx.putImageData(soilImg, 0, 0)
  // a few pebbles with a lit top-left + drop shadow
  const rnd = mulberry32(77)
  for (let i = 0; i < 12; i++) {
    const px = lerp(BLx + 20, BRx - 20, rnd())
    const py = lerp(BY + 14, FY - 12, rnd())
    const pr = 4 + rnd() * 7
    ctx.fillStyle = 'rgba(28,20,12,0.35)'
    ctx.beginPath()
    ctx.ellipse(px + 2, py + 3, pr, pr * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.4, pr * 0.1, px, py, pr)
    pg.addColorStop(0, rgb(mix(PEBBLE, [255, 255, 255], 0.25)))
    pg.addColorStop(1, rgb(mix(PEBBLE, SOIL_DK, 0.4)))
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.ellipse(px, py, pr, pr * 0.72, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // AO where soil meets the back wall
  let bao = ctx.createLinearGradient(0, BY, 0, BY + 46)
  bao.addColorStop(0, rgb(SOIL_DK, 0.5))
  bao.addColorStop(1, rgb(SOIL_DK, 0))
  ctx.fillStyle = bao
  ctx.fillRect(0, BY, W, 46)
  ctx.restore()

  // --- lit front lip where soil top meets the wood front face ---
  let lipg = ctx.createLinearGradient(0, FY - 8, 0, FY + 10)
  lipg.addColorStop(0, rgb(mix(SOIL_HI, [255, 255, 255], 0.2), 0.0))
  lipg.addColorStop(0.5, rgb(mix(WOOD_HI, [255, 255, 255], 0.3), 0.7))
  lipg.addColorStop(1, rgb(WOOD_HI, 0))
  ctx.fillStyle = lipg
  ctx.fillRect(FLx, FY - 8, FRx - FLx, 18)

  // thin dark rim along the back top edge for solidity
  ctx.strokeStyle = rgb(SOIL_DK, 0.5)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(BLx, BY)
  ctx.lineTo(BRx, BY)
  ctx.stroke()

  grainPass(ctx, W, H, 0.02)
  save(cv, 'bed.png')
}

// =============================================================================
// PLANT PARTS — shared stem + leaves, then per-stage tops.
// bottom-centre of every sprite = the planting point (sits on the soil).
// =============================================================================
// soft contact shadow + tiny soil mound so a plant reads as "planted"
function plantBase(ctx, W, H, r = 34) {
  const cx = W / 2
  const by = H - 14
  const g = ctx.createRadialGradient(cx, by, 2, cx, by, r)
  g.addColorStop(0, 'rgba(26,20,12,0.4)')
  g.addColorStop(1, 'rgba(26,20,12,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(cx, by, r, r * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  // little mound of turned soil
  const mg = ctx.createLinearGradient(0, by - 12, 0, by + 6)
  mg.addColorStop(0, rgb(SOIL_HI))
  mg.addColorStop(1, rgb(SOIL_DK))
  ctx.fillStyle = mg
  ctx.beginPath()
  ctx.ellipse(cx, by - 2, r * 0.62, r * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawStem(ctx, W, H, topY, width = 15) {
  const cx = W / 2
  const baseY = H - 18
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - width / 2, baseY)
  ctx.bezierCurveTo(cx - width / 2, lerp(baseY, topY, 0.5), cx - width / 2, topY + 8, cx - width * 0.28, topY)
  ctx.lineTo(cx + width * 0.28, topY)
  ctx.bezierCurveTo(cx + width / 2, topY + 8, cx + width / 2, lerp(baseY, topY, 0.5), cx + width / 2, baseY)
  ctx.closePath()
  const g = ctx.createLinearGradient(cx - width / 2, 0, cx + width / 2, 0)
  g.addColorStop(0, rgb(STEM_DK))
  g.addColorStop(0.4, rgb(STEM_HI))
  g.addColorStop(1, rgb(STEM_DK))
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
}

// one leaf: an oval blade with a lit face, dark underside and a centre vein
function drawLeaf(ctx, x, y, len, ang, flip) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  if (flip) ctx.scale(-1, 1)
  const w = len * 0.5
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.5, -w, len, 0)
  ctx.quadraticCurveTo(len * 0.5, w * 0.5, 0, 0)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -w, len, w)
  g.addColorStop(0, rgb(LEAF_HI))
  g.addColorStop(0.6, rgb(LEAF))
  g.addColorStop(1, rgb(LEAF_DK))
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = rgb(LEAF_DK, 0.55)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(len * 0.06, -1)
  ctx.quadraticCurveTo(len * 0.5, -w * 0.2, len * 0.92, 0)
  ctx.stroke()
  ctx.restore()
}

function bakeSeed() {
  const W = 180, H = 150
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  plantBase(ctx, W, H, 40)
  // a plump seed half-buried, lit top-left, with a first pale green tip
  const cx = W / 2, cy = H - 30
  ctx.save()
  const sg = ctx.createLinearGradient(cx - 14, cy - 18, cx + 14, cy + 8)
  sg.addColorStop(0, rgb([176, 150, 96]))
  sg.addColorStop(1, rgb([120, 96, 58]))
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.ellipse(cx, cy - 6, 15, 20, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(80,60,34,0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx, cy - 24)
  ctx.lineTo(cx, cy + 8)
  ctx.stroke()
  ctx.restore()
  // pale sprout tip just breaking
  drawLeaf(ctx, cx + 2, cy - 22, 26, -1.4, false)
  grainPass(ctx, W, H, 0.05)
  save(cv, 'seed.png')
}

function bakeSprout() {
  const W = 200, H = 230
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  plantBase(ctx, W, H, 42)
  const topY = 92
  drawStem(ctx, W, H, topY, 13)
  const cx = W / 2
  drawLeaf(ctx, cx - 2, topY + 34, 58, -0.5, true)
  drawLeaf(ctx, cx + 2, topY + 20, 66, -0.5, false)
  // a small folded pair of top leaves
  drawLeaf(ctx, cx, topY + 4, 40, -1.9, false)
  drawLeaf(ctx, cx, topY + 4, 40, -1.25, true)
  grainPass(ctx, W, H, 0.05)
  save(cv, 'sprout.png')
}

function bakeBud() {
  const W = 200, H = 280
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  plantBase(ctx, W, H, 42)
  const topY = 78
  drawStem(ctx, W, H, topY, 14)
  const cx = W / 2
  drawLeaf(ctx, cx - 3, 168, 66, -0.35, true)
  drawLeaf(ctx, cx + 3, 138, 74, -0.42, false)
  // green sepals cupping a closed bud, a hint of muted petal at the tip
  ctx.save()
  const bg = ctx.createLinearGradient(cx - 16, topY - 40, cx + 16, topY + 6)
  bg.addColorStop(0, rgb([176, 140, 172]))
  bg.addColorStop(1, rgb([120, 92, 118]))
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.ellipse(cx, topY - 20, 17, 30, 0, 0, Math.PI * 2)
  ctx.fill()
  // sepals
  const cg = ctx.createLinearGradient(cx - 16, topY - 8, cx + 16, topY + 12)
  cg.addColorStop(0, rgb(LEAF_HI))
  cg.addColorStop(1, rgb(LEAF_DK))
  ctx.fillStyle = cg
  for (const dx of [-9, 0, 9]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx, topY + 6)
    ctx.quadraticCurveTo(cx + dx - 8, topY - 14, cx + dx, topY - 26)
    ctx.quadraticCurveTo(cx + dx + 8, topY - 14, cx + dx, topY + 6)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  grainPass(ctx, W, H, 0.05)
  save(cv, 'bud.png')
}

// generic bloom: draw stem + leaves, then a flower head at (cx, topY)
function bakeFlower(name, opts) {
  const W = 200, H = 276
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const topY = opts.headY ?? 92
  plantBase(ctx, W, H, 46)
  drawStem(ctx, W, H, topY + (opts.stemInset ?? 6), 15)
  drawLeaf(ctx, cx - 4, 196, 74, -0.32, true)
  drawLeaf(ctx, cx + 4, 158, 80, -0.4, false)

  const petalUnder = mix(opts.petal, opts.deep, 0.6)
  const drawRadial = (count, pr, pw, R, colBase, colTip, rot = 0) => {
    for (let i = 0; i < count; i++) {
      const a = rot + (i / count) * Math.PI * 2
      const ex = cx + Math.cos(a) * R
      const ey = topY + Math.sin(a) * R
      ctx.save()
      ctx.translate(ex, ey)
      ctx.rotate(a + Math.PI / 2)
      // dark underlap for petal separation
      ctx.fillStyle = rgb(petalUnder)
      ctx.beginPath()
      ctx.ellipse(0, 0, pw * 1.12, pr * 1.08, 0, 0, Math.PI * 2)
      ctx.fill()
      const g = ctx.createLinearGradient(0, pr, 0, -pr)
      g.addColorStop(0, rgb(colBase))
      g.addColorStop(1, rgb(colTip))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(0, 0, pw, pr, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
  const drawCenter = (r, cInner, cOuter, dotted) => {
    const g = ctx.createRadialGradient(cx - r * 0.3, topY - r * 0.3, 1, cx, topY, r)
    g.addColorStop(0, rgb(cInner))
    g.addColorStop(1, rgb(cOuter))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, topY, r, 0, Math.PI * 2)
    ctx.fill()
    if (dotted) {
      const rnd = mulberry32(9)
      for (let i = 0; i < 40; i++) {
        const a = rnd() * Math.PI * 2
        const rr = Math.sqrt(rnd()) * r * 0.85
        ctx.fillStyle = rgb(mix(cOuter, [40, 30, 20], 0.4), 0.6)
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * rr, topY + Math.sin(a) * rr, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  if (opts.style === 'daisy') {
    drawRadial(13, 34, 12, 30, mix(opts.petal, opts.deep, 0.25), opts.petal, 0.24)
    drawCenter(22, mix(opts.center, [255, 255, 255], 0.2), opts.center, true)
  } else if (opts.style === 'sun') {
    drawRadial(18, 40, 13, 34, opts.deep, opts.petal, 0)
    drawRadial(18, 34, 11, 30, mix(opts.petal, opts.deep, 0.3), opts.petal, 0.17)
    drawCenter(30, mix(opts.center, [120, 90, 60], 0.3), opts.center, true)
  } else if (opts.style === 'cosmos') {
    drawRadial(8, 40, 24, 30, mix(opts.petal, opts.deep, 0.2), mix(opts.petal, [255, 255, 255], 0.15), 0.4)
    drawCenter(17, mix(opts.center, [255, 255, 255], 0.25), opts.center, true)
  } else if (opts.style === 'viola') {
    drawRadial(5, 42, 30, 28, mix(opts.petal, opts.deep, 0.3), mix(opts.petal, [255, 255, 255], 0.12), -Math.PI / 2)
    drawCenter(13, opts.center, mix(opts.center, opts.deep, 0.4), false)
    // little dark veins
    ctx.strokeStyle = rgb(opts.deep, 0.5)
    ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, topY)
      ctx.lineTo(cx + Math.cos(a) * 26, topY + Math.sin(a) * 26)
      ctx.stroke()
    }
  } else if (opts.style === 'rose') {
    // concentric rings of short cupped petals, tightest in the middle
    drawRadial(8, 30, 20, 30, opts.deep, opts.petal, 0)
    drawRadial(7, 24, 17, 20, mix(opts.deep, opts.petal, 0.4), opts.petal, 0.3)
    drawRadial(5, 17, 13, 11, mix(opts.deep, opts.petal, 0.5), mix(opts.petal, [255, 255, 255], 0.1), 0.6)
    ctx.fillStyle = rgb(mix(opts.deep, [40, 20, 24], 0.4))
    ctx.beginPath()
    ctx.arc(cx, topY, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (opts.style === 'tulip') {
    // an upright closed cup: three overlapping petals
    const cup = (dx, w, col) => {
      ctx.save()
      const g = ctx.createLinearGradient(cx + dx, topY - 44, cx + dx, topY + 18)
      g.addColorStop(0, rgb(mix(col, [255, 255, 255], 0.15)))
      g.addColorStop(1, rgb(mix(col, opts.deep, 0.55)))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(cx + dx - w, topY + 12)
      ctx.bezierCurveTo(cx + dx - w, topY - 34, cx + dx - w * 0.3, topY - 46, cx + dx, topY - 46)
      ctx.bezierCurveTo(cx + dx + w * 0.3, topY - 46, cx + dx + w, topY - 34, cx + dx + w, topY + 12)
      ctx.quadraticCurveTo(cx + dx, topY + 24, cx + dx - w, topY + 12)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    cup(-13, 16, mix(opts.petal, opts.deep, 0.35))
    cup(13, 16, mix(opts.petal, opts.deep, 0.35))
    cup(0, 19, opts.petal)
  }

  grainPass(ctx, W, H, 0.022)
  save(cv, `flower-${name}.png`)
}

// =============================================================================
// TOOLS — watering can + seed packet (the action-button icons).
// =============================================================================
function bakeCan() {
  const W = 260, H = 220
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const TIN = [150, 174, 172]
  const TIN_HI = [196, 214, 210]
  const TIN_DK = [98, 122, 124]
  // contact shadow
  ctx.save()
  ctx.translate(120, 196)
  ctx.scale(1, 0.2)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 100)
  sh.addColorStop(0, 'rgba(20,30,30,0.34)')
  sh.addColorStop(1, 'rgba(20,30,30,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, 100, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // body (rounded tin drum, curved cylinder shading)
  const bx = 62, by = 74, bw = 116, bh = 108
  ctx.save()
  roundRectPath(ctx, bx, by, bw, bh, 26)
  ctx.clip()
  let g = ctx.createLinearGradient(bx, 0, bx + bw, 0)
  g.addColorStop(0, rgb(TIN_DK))
  g.addColorStop(0.4, rgb(TIN_HI))
  g.addColorStop(0.65, rgb(TIN))
  g.addColorStop(1, rgb(TIN_DK))
  ctx.fillStyle = g
  ctx.fillRect(bx, by, bw, bh)
  // top rim shine + bottom AO
  let rim = ctx.createLinearGradient(0, by, 0, by + 22)
  rim.addColorStop(0, rgb(TIN_HI, 0.8))
  rim.addColorStop(1, rgb(TIN_HI, 0))
  ctx.fillStyle = rim
  ctx.fillRect(bx, by, bw, 22)
  let ao = ctx.createLinearGradient(0, by + bh - 30, 0, by + bh)
  ao.addColorStop(0, rgb(TIN_DK, 0))
  ao.addColorStop(1, rgb(TIN_DK, 0.6))
  ctx.fillStyle = ao
  ctx.fillRect(bx, by + bh - 30, bw, 30)
  ctx.restore()
  // spout (tapers up-left) + rose head
  ctx.fillStyle = rgb(TIN)
  ctx.beginPath()
  ctx.moveTo(bx + 6, by + 30)
  ctx.lineTo(14, by - 8)
  ctx.lineTo(40, by - 20)
  ctx.lineTo(bx + 14, by + 56)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = rgb(TIN_DK, 0.6)
  ctx.lineWidth = 2
  ctx.stroke()
  // rose (sprinkler disc)
  ctx.save()
  ctx.translate(27, by - 14)
  ctx.rotate(-0.5)
  const rg = ctx.createLinearGradient(-16, 0, 16, 0)
  rg.addColorStop(0, rgb(TIN_DK))
  rg.addColorStop(0.5, rgb(TIN_HI))
  rg.addColorStop(1, rgb(TIN_DK))
  ctx.fillStyle = rg
  ctx.beginPath()
  ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = rgb(TIN_DK, 0.7)
  for (let i = -2; i <= 2; i++)
    for (let j = -1; j <= 1; j++) {
      ctx.beginPath()
      ctx.arc(i * 6, j * 4, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  ctx.restore()
  // top arch handle
  ctx.strokeStyle = rgb(TIN)
  ctx.lineWidth = 13
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(bx + bw * 0.52, by + 4, 40, Math.PI * 1.15, Math.PI * 1.95)
  ctx.stroke()
  ctx.strokeStyle = rgb(TIN_HI, 0.6)
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(bx + bw * 0.52, by + 4, 43, Math.PI * 1.2, Math.PI * 1.9)
  ctx.stroke()
  grainPass(ctx, W, H, 0.04)
  save(cv, 'can.png')
}

function bakeSeedPacket() {
  const W = 220, H = 220
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const PAPER = [222, 206, 170]
  const PAPER_HI = [240, 228, 200]
  const PAPER_DK = [186, 168, 130]
  // shadow
  ctx.save()
  ctx.translate(W / 2, 196)
  ctx.scale(1, 0.2)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 90)
  sh.addColorStop(0, 'rgba(30,26,16,0.32)')
  sh.addColorStop(1, 'rgba(30,26,16,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, 90, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // packet body, slightly tilted
  ctx.save()
  ctx.translate(W / 2, 100)
  ctx.rotate(-0.06)
  roundRectPath(ctx, -66, -78, 132, 168, 12)
  ctx.save()
  ctx.clip()
  let g = ctx.createLinearGradient(-66, -78, 66, 90)
  g.addColorStop(0, rgb(PAPER_HI))
  g.addColorStop(0.6, rgb(PAPER))
  g.addColorStop(1, rgb(PAPER_DK))
  ctx.fillStyle = g
  ctx.fillRect(-66, -78, 132, 168)
  // top serrated tear strip
  ctx.fillStyle = rgb(mix(PAPER_DK, [90, 70, 50], 0.3))
  ctx.fillRect(-66, -78, 132, 22)
  // a little illustration window with a muted bloom
  ctx.fillStyle = rgb(mix(PAPER_HI, [255, 255, 255], 0.4))
  roundRectPath(ctx, -46, -44, 92, 84, 8)
  ctx.fill()
  ctx.restore()
  // paper edge
  ctx.strokeStyle = rgb(PAPER_DK, 0.7)
  ctx.lineWidth = 2
  roundRectPath(ctx, -66, -78, 132, 168, 12)
  ctx.stroke()
  // tiny flower in the window
  const fx = 0, fy = -2
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    ctx.fillStyle = rgb([206, 150, 170])
    ctx.beginPath()
    ctx.ellipse(fx + Math.cos(a) * 15, fy + Math.sin(a) * 15, 9, 13, a + Math.PI / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = rgb([214, 178, 96])
  ctx.beginPath()
  ctx.arc(fx, fy, 10, 0, Math.PI * 2)
  ctx.fill()
  // three seeds spilling below the window
  ctx.fillStyle = rgb([150, 116, 70])
  for (const [sx, sy, r] of [[-14, 60, 5], [4, 66, 6], [20, 58, 5]]) {
    ctx.beginPath()
    ctx.ellipse(sx, sy, r, r * 1.4, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  grainPass(ctx, W, H, 0.035)
  save(cv, 'packet.png')
}

// -----------------------------------------------------------------------------
console.log('Baking garden art →')
bakeBed()
bakeSeed()
bakeSprout()
bakeBud()
// six muted blooms, mapped 1:1 to the game's flower slots
bakeFlower('daisy', { style: 'daisy', petal: [238, 234, 224], deep: [198, 190, 172], center: [214, 176, 92] })
bakeFlower('sun', { style: 'sun', petal: [226, 190, 108], deep: [196, 154, 78], center: [120, 88, 58], headY: 96 })
bakeFlower('tulip', { style: 'tulip', petal: [212, 142, 156], deep: [172, 100, 116] })
bakeFlower('rose', { style: 'rose', petal: [198, 122, 122], deep: [156, 82, 88] })
bakeFlower('cosmos', { style: 'cosmos', petal: [214, 166, 190], deep: [184, 128, 158], center: [222, 190, 110] })
bakeFlower('viola', { style: 'viola', petal: [168, 158, 206], deep: [128, 116, 176], center: [226, 200, 110] })
bakeCan()
bakeSeedPacket()
console.log('Done.')
