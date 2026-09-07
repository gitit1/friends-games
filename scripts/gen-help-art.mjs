// Bakes the "מבקשים עזרה" (help / FCT) materials as REAL raster art with baked soft
// lighting + grain/AO — never flat CSS gradients standing in for a scene or a card.
// This game is used when the child may already be frustrated (a friend hits a snag
// and asks for help or a break) — the art must SOOTHE, never excite: no neon, no
// saturated red, no extra motion beyond what already exists in the CSS. Muted,
// sensory-calm palette, one consistent soft top-left key light throughout.
//
//   • help-room.jpg (→ public/art/bg, 640x512): a calm play-corner scene behind
//     `.help-scene` — a muted sage/greige WALL above a warm wooden FLOOR receding in
//     gentle perspective (a soft baked window key-light pool, converging floorboard
//     seams, far-edge AO, a lit near edge). Replaces the flat mint-gradient card
//     background so the scene reads as a real grounded room, not a colour swatch.
//   • help-card-ask.png / help-card-break.png (168x160 each): the two big pictogram
//     choice cards (עזרה / הפסקה) baked as a chunky rounded tile — bevelled raised
//     rim (light top-left / shade bottom-right), soft matte speckle grain, a baked
//     contact shadow so it sits proud of the page, and a gentle muted tint wash (sage
//     for עזרה, warm sand for הפסקה) baked right into the material — NOT a saturated
//     CSS gradient. The emoji + Hebrew label overlay on top as crisp CSS, unchanged.
//   • help-cushion.png (192x140): a cosy baked cushion — soft rounded bolster with
//     seam piping, fabric speckle grain, AO in the seam crease and a baked contact
//     shadow — replacing the plain 🛋️ emoji on the calming-break beat.
//
// Same pipeline as the letter-hunt / calc materials: an original @napi-rs/canvas
// bake with seeded value-noise material grain and analytic baked lighting/AO. No
// third-party art — everything here is original CC0. One-off build tool:
//   node scripts/gen-help-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/help/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })
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
// THE ROOM — a calm play-corner scene behind the help stage: a muted sage/greige
// wall + a warm wooden floor receding in gentle perspective. Soothing, no props
// (the friend/snag/cards already carry the story), served via SceneBackdrop.
// ============================================================================
function bakeRoom(name) {
  const W = 640
  const H = 512
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const WALL = [214, 222, 214] // muted sage-greige
  const WALL_DK = [190, 200, 190]
  const FLOOR = [186, 152, 112] // warm honey wood
  const FLOOR_DK = [140, 110, 76]
  const FLOOR_LT = [212, 182, 140]

  const horizonY = 224 // wall/floor line (also the far edge of the floor)
  const nearY = H // floor runs to the bottom edge

  // opaque base first (JPEG has no alpha)
  x.fillStyle = rgb(WALL_DK)
  x.fillRect(0, 0, W, H)

  // --- WALL ---
  const wg = x.createLinearGradient(0, 0, 0, horizonY + 16)
  wg.addColorStop(0, rgb(mix(WALL, [255, 255, 255], 0.14)))
  wg.addColorStop(1, rgb(WALL_DK))
  x.fillStyle = wg
  x.fillRect(0, 0, W, horizonY + 20)
  // soft off-centre warm light pool high on the wall (soothing, not a hot spot)
  const win = x.createRadialGradient(cxb - 130, 30, 20, cxb - 130, 30, 360)
  win.addColorStop(0, 'rgba(255,248,232,0.30)')
  win.addColorStop(1, 'rgba(255,248,232,0)')
  x.fillStyle = win
  x.fillRect(0, 0, W, horizonY + 20)
  // a second gentle glow, lower-right, so the room feels evenly calm
  const win2 = x.createRadialGradient(cxb + 190, 120, 10, cxb + 190, 120, 240)
  win2.addColorStop(0, 'rgba(255,248,232,0.14)')
  win2.addColorStop(1, 'rgba(255,248,232,0)')
  x.fillStyle = win2
  x.fillRect(0, 0, W, horizonY + 20)
  // quiet wainscot line just above the floor
  x.strokeStyle = 'rgba(150,156,148,0.5)'
  x.lineWidth = 3
  x.beginPath()
  x.moveTo(0, horizonY - 8)
  x.lineTo(W, horizonY - 8)
  x.stroke()
  x.strokeStyle = 'rgba(255,255,255,0.28)'
  x.lineWidth = 1.5
  x.beginPath()
  x.moveTo(0, horizonY - 11)
  x.lineTo(W, horizonY - 11)
  x.stroke()
  // wall meets floor in soft contact shade
  const wallAo = x.createLinearGradient(0, horizonY - 30, 0, horizonY)
  wallAo.addColorStop(0, 'rgba(60,58,50,0)')
  wallAo.addColorStop(1, 'rgba(60,58,50,0.2)')
  x.fillStyle = wallAo
  x.fillRect(0, horizonY - 30, W, 30)

  // --- FLOOR (perspective: converging seams from the horizon line down) ---
  x.save()
  x.beginPath()
  x.rect(0, horizonY, W, nearY - horizonY)
  x.clip()
  const fg = x.createLinearGradient(0, horizonY, 0, nearY)
  fg.addColorStop(0, rgb(FLOOR_DK)) // far = darker
  fg.addColorStop(0.55, rgb(FLOOR))
  fg.addColorStop(1, rgb(FLOOR_LT)) // near = lit
  x.fillStyle = fg
  x.fillRect(0, horizonY, W, nearY - horizonY)
  // horizontal plank grain, wider spacing toward the near edge
  for (let i = 0; i < 40; i++) {
    const t = Math.random()
    const yy = horizonY + t * (nearY - horizonY)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,90,58,0.2)' : 'rgba(224,196,154,0.2)'
    x.lineWidth = 0.8 + t * 2.2
    x.beginPath()
    x.moveTo(0, yy)
    for (let sx = 0; sx <= W; sx += 46) x.lineTo(sx, yy + R(4))
    x.stroke()
  }
  // plank seams converging toward a vanishing point above the horizon (perspective)
  const vpX = cxb
  const vpY = horizonY - 260
  x.strokeStyle = 'rgba(80,58,30,0.28)'
  x.lineWidth = 2
  for (const nx of [-260, -140, -40, 60, 160, 280]) {
    x.beginPath()
    x.moveTo(cxb + nx, nearY)
    x.lineTo(vpX + nx * 0.14, horizonY)
    x.stroke()
  }
  // far-edge AO (floor tucks into shade near the wall)
  const ao = x.createLinearGradient(0, horizonY, 0, horizonY + 50)
  ao.addColorStop(0, 'rgba(50,36,18,0.42)')
  ao.addColorStop(1, 'rgba(50,36,18,0)')
  x.fillStyle = ao
  x.fillRect(0, horizonY, W, 50)
  // soft warm key-light pool on the near floor (calming, not glaring)
  const kl = x.createRadialGradient(cxb - 90, nearY - 90, 20, cxb - 90, nearY - 90, 380)
  kl.addColorStop(0, 'rgba(255,244,214,0.16)')
  kl.addColorStop(1, 'rgba(255,244,214,0)')
  x.fillStyle = kl
  x.fillRect(0, horizonY, W, nearY - horizonY)
  // gentle vignette for a calm, focused centre
  const vg = x.createRadialGradient(cxb, (horizonY + nearY) / 2, W * 0.22, cxb, (horizonY + nearY) / 2, W * 0.62)
  vg.addColorStop(0, 'rgba(30,22,10,0)')
  vg.addColorStop(1, 'rgba(30,22,10,0.18)')
  x.fillStyle = vg
  x.fillRect(0, horizonY, W, nearY - horizonY)
  x.restore()

  grainPass(x, W, H, 0.035)
  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(fileBg(name), buf)
  console.log('  ✓ bg/' + name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// PICTOGRAM CARD — a chunky rounded card baked with a raised bevel rim, soft
// matte speckle grain, a gentle muted tint wash and a baked contact shadow. The
// emoji + Hebrew label overlay on top as crisp CSS (unchanged in Help.tsx).
// ============================================================================
const CW = 168
const CH = 160
function bakeCard(tint, name) {
  const cv = createCanvas(CW, CH)
  const x = cv.getContext('2d')
  const m = 8
  const w = CW - m * 2
  const h = CH - m * 2
  const r = 30

  // baked contact shadow beneath the card
  const ds = x.createRadialGradient(CW / 2, CH - m + 6, 8, CW / 2, CH - m + 6, w * 0.62)
  ds.addColorStop(0, 'rgba(20,16,10,0.28)')
  ds.addColorStop(1, 'rgba(20,16,10,0)')
  x.fillStyle = ds
  x.beginPath()
  x.ellipse(CW / 2, CH - m + 8, w * 0.48, 14, 0, 0, Math.PI * 2)
  x.fill()

  // card body
  x.save()
  roundRectPath(x, m, m, w, h, r)
  x.clip()
  const bg = x.createLinearGradient(0, m, 0, m + h)
  bg.addColorStop(0, rgb(mix(tint, [255, 252, 244], 0.28)))
  bg.addColorStop(0.55, rgb(tint))
  bg.addColorStop(1, rgb(mix(tint, [30, 24, 16], 0.16)))
  x.fillStyle = bg
  x.fillRect(m, m, w, h)
  // soft top-left key-light bloom (soothing, not glossy)
  const bloom = x.createRadialGradient(m + w * 0.32, m + h * 0.28, 8, m + w * 0.32, m + h * 0.28, w * 0.95)
  bloom.addColorStop(0, 'rgba(255,252,244,0.34)')
  bloom.addColorStop(0.55, 'rgba(255,252,244,0.08)')
  bloom.addColorStop(1, 'rgba(255,252,244,0)')
  x.fillStyle = bloom
  x.fillRect(m, m, w, h)
  // bottom-right soft AO so the card reads as a solid rounded volume
  const ao = x.createLinearGradient(m + w * 0.5, m + h * 0.5, m + w, m + h)
  ao.addColorStop(0, 'rgba(30,22,14,0)')
  ao.addColorStop(1, 'rgba(30,22,14,0.24)')
  x.fillStyle = ao
  x.fillRect(m, m, w, h)
  // matte speckle micro-grain (calm paper/fabric feel, not shiny plastic)
  for (let i = 0; i < 200; i++) {
    const px = m + Math.random() * w
    const py = m + Math.random() * h
    const rr0 = 0.5 + Math.random() * 1.3
    x.beginPath()
    x.arc(px, py, rr0, 0, Math.PI * 2)
    x.fillStyle = Math.random() < 0.5 ? 'rgba(255,252,244,0.5)' : 'rgba(30,24,16,0.4)'
    x.globalAlpha = 0.03 + Math.random() * 0.06
    x.fill()
  }
  x.globalAlpha = 1
  x.restore()

  // raised rim bevel: light top/left, shade bottom/right
  x.save()
  roundRectPath(x, m, m, w, h, r)
  x.clip()
  x.strokeStyle = 'rgba(255,252,244,0.55)'
  x.lineWidth = 4
  x.beginPath()
  x.moveTo(m + 6, m + h - 16)
  x.lineTo(m + 6, m + 14)
  x.arcTo(m + 6, m + 6, m + 24, m + 6, 18)
  x.lineTo(m + w - 18, m + 6)
  x.stroke()
  x.strokeStyle = 'rgba(24,18,10,0.32)'
  x.lineWidth = 4
  x.beginPath()
  x.moveTo(m + w - 6, m + 18)
  x.lineTo(m + w - 6, m + h - 16)
  x.arcTo(m + w - 6, m + h - 6, m + w - 24, m + h - 6, 18)
  x.lineTo(m + 20, m + h - 6)
  x.stroke()
  x.restore()

  grainPass(x, CW, CH, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${CW}×${CH}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// CUSHION — a cosy baked bolster cushion for the calming-break beat, replacing
// the plain 🛋️ emoji. Soft rounded form, seam piping, fabric grain, baked AO in
// the seam crease and a baked contact shadow so it sits grounded.
// ============================================================================
function bakeCushion(name) {
  const W = 192
  const H = 140
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const TINT = [214, 176, 150] // muted dusty terracotta — cosy, calm, not saturated

  // baked contact shadow
  const ds = x.createRadialGradient(W / 2, H - 14, 8, W / 2, H - 14, W * 0.55)
  ds.addColorStop(0, 'rgba(20,14,10,0.3)')
  ds.addColorStop(1, 'rgba(20,14,10,0)')
  x.fillStyle = ds
  x.beginPath()
  x.ellipse(W / 2, H - 12, W * 0.42, 14, 0, 0, Math.PI * 2)
  x.fill()

  // cushion body: a soft rounded bolster (squashed ellipse) with a seam crease
  const cx0 = W / 2
  const cy0 = H * 0.5
  const rx = W * 0.44
  const ry = H * 0.4

  x.save()
  x.beginPath()
  x.ellipse(cx0, cy0, rx, ry, 0, 0, Math.PI * 2)
  x.clip()
  const bg = x.createLinearGradient(cx0 - rx, cy0 - ry, cx0 + rx, cy0 + ry)
  bg.addColorStop(0, rgb(mix(TINT, [255, 250, 244], 0.32)))
  bg.addColorStop(0.5, rgb(TINT))
  bg.addColorStop(1, rgb(mix(TINT, [40, 26, 18], 0.18)))
  x.fillStyle = bg
  x.fillRect(0, 0, W, H)
  // top-left soft key-light bloom
  const bloom = x.createRadialGradient(cx0 - rx * 0.35, cy0 - ry * 0.4, 6, cx0 - rx * 0.35, cy0 - ry * 0.4, rx * 1.1)
  bloom.addColorStop(0, 'rgba(255,250,244,0.38)')
  bloom.addColorStop(1, 'rgba(255,250,244,0)')
  x.fillStyle = bloom
  x.fillRect(0, 0, W, H)
  // centre seam crease (two soft lobes like a tied bolster) — AO groove
  const groove = x.createLinearGradient(cx0 - 14, 0, cx0 + 14, 0)
  groove.addColorStop(0, 'rgba(40,26,18,0)')
  groove.addColorStop(0.5, 'rgba(40,26,18,0.28)')
  groove.addColorStop(1, 'rgba(40,26,18,0)')
  x.fillStyle = groove
  x.fillRect(cx0 - 14, cy0 - ry, 28, ry * 2)
  // fabric speckle grain
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2
    const rr0 = Math.random()
    const px = cx0 + Math.cos(a) * rx * rr0 * 0.94
    const py = cy0 + Math.sin(a) * ry * rr0 * 0.94
    x.beginPath()
    x.arc(px, py, 0.5 + Math.random() * 1.2, 0, Math.PI * 2)
    x.fillStyle = Math.random() < 0.5 ? 'rgba(255,250,244,0.4)' : 'rgba(40,26,18,0.32)'
    x.globalAlpha = 0.04 + Math.random() * 0.06
    x.fill()
  }
  x.globalAlpha = 1
  x.restore()

  // end-cap piping seams (baked stitched trim near each rounded end)
  x.strokeStyle = 'rgba(255,250,244,0.4)'
  x.lineWidth = 2
  x.setLineDash([3, 3])
  x.beginPath()
  x.ellipse(cx0, cy0, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2)
  x.stroke()
  x.setLineDash([])

  // crisp rim: bright top-left, dark bottom-right
  x.save()
  x.beginPath()
  x.ellipse(cx0, cy0, rx, ry, 0, 0, Math.PI * 2)
  x.clip()
  x.lineWidth = 3
  const rim = x.createLinearGradient(cx0 - rx, cy0 - ry, cx0 + rx, cy0 + ry)
  rim.addColorStop(0, 'rgba(255,250,244,0.55)')
  rim.addColorStop(0.5, 'rgba(255,250,244,0.05)')
  rim.addColorStop(1, 'rgba(30,20,12,0.4)')
  x.strokeStyle = rim
  x.beginPath()
  x.ellipse(cx0, cy0, rx - 2, ry - 2, 0, 0, Math.PI * 2)
  x.stroke()
  x.restore()

  grainPass(x, W, H, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking help art →')
bakeRoom('help-room.jpg')
bakeCard([169, 198, 180], 'help-card-ask.png') // muted sage — עזרה
bakeCard([223, 190, 148], 'help-card-break.png') // muted warm sand — הפסקה
bakeCushion('help-cushion.png')
console.log('Done.')
