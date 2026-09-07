// Bakes the "איך אני מרגיש?" (feelings / Zones of Regulation) materials as REAL
// raster art with baked soft lighting + grain/AO — never flat CSS shapes or
// gradients standing in for materials. This tool is used while the child is
// DYSREGULATED, so the art must SOOTHE, never excite: everything here is a
// warm, muted, low-contrast "regulation corner" — no neon, no busy detail, no
// looping motion baked into the art itself.
//
//   • feelings-nook.jpg (→ public/art/bg) — a cozy cushioned ALCOVE the child's
//                   face sits in: a soft rounded nook cut into a muted warm
//                   wall (gentle AO in the recess, soft key light from the
//                   upper-left), a low knitted RUG on the floor below in
//                   shallow perspective for depth. One neutral warm bake —
//                   deliberately NOT tinted per emotion, so it reads calm
//                   under any Zones color; the per-zone color still comes
//                   through as a translucent CSS scrim laid on top (kept from
//                   the old zone.soft background-swap) plus the existing
//                   .fe-ring halo. Rendered as one 5:4 JPEG, served via
//                   SceneBackdrop like the other room scenes.
//   • tool-flower.png / tool-balloon.png / tool-bubbles.png — three small
//                   baked calming-tool props (soft plush flower, matte
//                   balloon, glassy bubble cluster) that replace the plain
//                   emoji in the toolbox picker + the breathing figure. Muted
//                   pastel bodies, one consistent top-left key light, soft
//                   baked contact/drop shadow. Alpha PNGs so they sit on any
//                   background.
//
// Same pipeline as the letter-hunt / letter-drawer materials: an original
// @napi-rs/canvas bake with seeded value-noise material grain and analytic
// baked lighting/AO. No third-party art — everything here is original CC0.
// One-off build tool:
//   node scripts/gen-feelings-art.mjs   (@napi-rs/canvas already installed)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/feelings/', import.meta.url)
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
function grainPass(ctx, W, H, amt = 0.045) {
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
// THE REGULATION NOOK — a cozy cushioned alcove: a soft rounded recess in a
// muted warm wall, with a low knitted rug on the floor below in shallow
// perspective. Deliberately calm/simple — this is looked at by a dysregulated
// child. Neutral warm palette (no zone color baked in) so the per-emotion
// scrim + the existing .fe-ring halo carry the color cue instead.
// ============================================================================
function bakeNook(name) {
  const W = 640
  const H = 512
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const WALL = [232, 222, 208] // warm muted greige-cream
  const WALL_DK = [206, 194, 176]
  const NOOK = [214, 200, 180] // the recess, a touch deeper/warmer
  const NOOK_DK = [182, 164, 140]
  const RUG = [222, 196, 176] // low knitted rug, dusty terracotta-cream
  const RUG_DK = [196, 168, 146]

  const floorY = 356 // where wall meets floor

  // --- opaque base fill first (JPEG has no alpha) ---
  x.fillStyle = rgb(WALL_DK)
  x.fillRect(0, 0, W, H)

  // --- WALL wash, soft key light upper-left ---
  const wg = x.createLinearGradient(0, 0, 0, floorY)
  wg.addColorStop(0, rgb(mix(WALL, [255, 252, 242], 0.14)))
  wg.addColorStop(1, rgb(WALL_DK))
  x.fillStyle = wg
  x.fillRect(0, 0, W, floorY + 4)
  const wallGlow = x.createRadialGradient(cxb - 170, 30, 20, cxb - 170, 30, 420)
  wallGlow.addColorStop(0, 'rgba(255,250,236,0.30)')
  wallGlow.addColorStop(1, 'rgba(255,250,236,0)')
  x.fillStyle = wallGlow
  x.fillRect(0, 0, W, floorY + 4)

  // --- the rounded NOOK: a soft alcove recess centred where the face sits ---
  const nkCx = cxb
  const nkCy = 176
  const nkRx = 216
  const nkRy = 190
  x.save()
  x.beginPath()
  x.ellipse(nkCx, nkCy, nkRx, nkRy, 0, Math.PI, 0, false) // top half + sides (arch)
  x.lineTo(nkCx + nkRx, floorY)
  x.lineTo(nkCx - nkRx, floorY)
  x.closePath()
  x.clip()
  const ng = x.createRadialGradient(nkCx - 60, nkCy - 40, 20, nkCx, nkCy, nkRx * 1.3)
  ng.addColorStop(0, rgb(mix(NOOK, [255, 250, 238], 0.22)))
  ng.addColorStop(0.7, rgb(NOOK))
  ng.addColorStop(1, rgb(NOOK_DK))
  x.fillStyle = ng
  x.fillRect(0, 0, W, H)
  // inner AO ring where the recess meets the wall (top + sides read as carved-in)
  x.save()
  x.lineWidth = 46
  x.strokeStyle = 'rgba(70,54,34,0.16)'
  x.beginPath()
  x.ellipse(nkCx, nkCy, nkRx - 20, nkRy - 20, 0, Math.PI, 0, false)
  x.stroke()
  x.restore()
  // soft key light bloom inside the nook, upper-left
  const bloom = x.createRadialGradient(nkCx - 90, nkCy - 60, 10, nkCx - 90, nkCy - 60, 300)
  bloom.addColorStop(0, 'rgba(255,250,238,0.34)')
  bloom.addColorStop(1, 'rgba(255,250,238,0)')
  x.fillStyle = bloom
  x.fillRect(0, 0, W, H)
  x.restore()

  // crisp soft rim around the nook opening (bright upper-left catch light, soft shade lower-right)
  x.save()
  x.lineWidth = 6
  const rim = x.createLinearGradient(nkCx - nkRx, nkCy - nkRy, nkCx + nkRx, nkCy + nkRy)
  rim.addColorStop(0, 'rgba(255,250,238,0.55)')
  rim.addColorStop(0.5, 'rgba(255,250,238,0.1)')
  rim.addColorStop(1, 'rgba(70,54,34,0.22)')
  x.strokeStyle = rim
  x.beginPath()
  x.ellipse(nkCx, nkCy, nkRx, nkRy, 0, Math.PI, 0, false)
  x.stroke()
  x.restore()

  // wall meets floor: soft contact shade
  const wallAo = x.createLinearGradient(0, floorY - 30, 0, floorY)
  wallAo.addColorStop(0, 'rgba(60,46,30,0)')
  wallAo.addColorStop(1, 'rgba(60,46,30,0.18)')
  x.fillStyle = wallAo
  x.fillRect(0, floorY - 30, W, 30)

  // --- FLOOR: shallow perspective trapezoid below the nook ---
  const topHalf = 300
  const botHalf = 340
  x.beginPath()
  x.moveTo(cxb - topHalf, floorY)
  x.lineTo(cxb + topHalf, floorY)
  x.lineTo(cxb + botHalf, H)
  x.lineTo(cxb - botHalf, H)
  x.closePath()
  x.save()
  x.clip()
  const fg = x.createLinearGradient(0, floorY, 0, H)
  fg.addColorStop(0, rgb(mix(WALL_DK, [40, 30, 18], 0.12)))
  fg.addColorStop(1, rgb(mix(WALL_DK, [40, 30, 18], 0.28)))
  x.fillStyle = fg
  x.fillRect(0, floorY, W, H - floorY)
  x.restore()

  // --- low knitted RUG centred on the floor, in shallow perspective ---
  const rugCx = cxb
  const rugCy = floorY + 78
  const rugRx = 224
  const rugRy = 62
  x.save()
  x.translate(rugCx, rugCy)
  x.scale(1, rugRy / rugRx)
  const rg = x.createRadialGradient(-40, -40, 10, 0, 0, rugRx)
  rg.addColorStop(0, rgb(mix(RUG, [255, 250, 238], 0.18)))
  rg.addColorStop(0.75, rgb(RUG))
  rg.addColorStop(1, rgb(RUG_DK))
  x.fillStyle = rg
  x.beginPath()
  x.arc(0, 0, rugRx, 0, Math.PI * 2)
  x.fill()
  x.restore()
  // a couple of concentric knit rings (subtle, calm — not busy)
  x.save()
  x.translate(rugCx, rugCy)
  x.scale(1, rugRy / rugRx)
  x.strokeStyle = 'rgba(120,90,62,0.16)'
  x.lineWidth = 5
  for (const rr of [rugRx * 0.42, rugRx * 0.7, rugRx * 0.94]) {
    x.beginPath()
    x.arc(0, 0, rr, 0, Math.PI * 2)
    x.stroke()
  }
  x.restore()
  // rug contact shadow (grounds it on the floor)
  x.save()
  x.translate(rugCx, rugCy + rugRy * 0.86)
  x.scale(1, 0.22)
  const rsh = x.createRadialGradient(0, 0, 0, 0, 0, rugRx * 1.02)
  rsh.addColorStop(0, 'rgba(30,20,10,0.22)')
  rsh.addColorStop(1, 'rgba(30,20,10,0)')
  x.fillStyle = rsh
  x.beginPath()
  x.arc(0, 0, rugRx * 1.02, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // gentle corner vignette (calm focus, keeps the eye centred)
  const vg = x.createRadialGradient(cxb, H * 0.42, W * 0.22, cxb, H * 0.42, W * 0.66)
  vg.addColorStop(0, 'rgba(30,22,12,0)')
  vg.addColorStop(1, 'rgba(30,22,12,0.2)')
  x.fillStyle = vg
  x.fillRect(0, 0, W, H)

  grainPass(x, W, H, 0.035)
  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(fileBg(name), buf)
  console.log('  ✓ bg/' + name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// CALMING-TOOL PROPS — small baked sprites replacing the plain emoji in the
// toolbox picker + breathing figure. Muted pastel, one top-left key light,
// soft baked drop shadow. Square alpha PNGs.
// ============================================================================
const T = 200

function bakeFlower(name) {
  const cv = createCanvas(T, T)
  const x = cv.getContext('2d')
  const cx = T / 2
  const cy = T / 2 + 6
  const petalR = 40
  const petalCount = 6
  const PETAL = [232, 196, 200] // soft dusty pink
  const PETAL_DK = [206, 160, 168]
  const CENTER = [238, 214, 152] // muted cream-gold

  // soft drop shadow
  x.save()
  x.translate(cx, cy + petalR * 0.72)
  x.scale(1, 0.32)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, petalR * 1.5)
  sh.addColorStop(0, 'rgba(30,20,14,0.20)')
  sh.addColorStop(1, 'rgba(30,20,14,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, petalR * 1.5, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // stem
  x.strokeStyle = rgb(mix([150, 178, 132], [40, 30, 18], 0.12))
  x.lineWidth = 7
  x.lineCap = 'round'
  x.beginPath()
  x.moveTo(cx, cy + petalR * 0.5)
  x.quadraticCurveTo(cx + 6, cy + petalR * 0.9, cx, cy + petalR * 1.28)
  x.stroke()
  // a small leaf
  x.save()
  x.translate(cx + 4, cy + petalR * 1.0)
  x.rotate(-0.5)
  const leaf = rgb(mix([150, 178, 132], [255, 250, 238], 0.14))
  x.fillStyle = leaf
  x.beginPath()
  x.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // petals — soft rounded, baked lighting per petal (upper-left lit)
  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 - Math.PI / 2
    x.save()
    x.translate(cx, cy)
    x.rotate(a)
    x.translate(0, -petalR * 0.62)
    const pg = x.createLinearGradient(-petalR * 0.4, -petalR * 0.4, petalR * 0.4, petalR * 0.4)
    pg.addColorStop(0, rgb(mix(PETAL, [255, 250, 240], 0.35)))
    pg.addColorStop(1, rgb(PETAL_DK))
    x.fillStyle = pg
    x.beginPath()
    x.ellipse(0, 0, petalR * 0.42, petalR * 0.62, 0, 0, Math.PI * 2)
    x.fill()
    x.restore()
  }
  // flower center, domed with sheen
  const cg = x.createRadialGradient(cx - 8, cy - 10, 2, cx, cy, 24)
  cg.addColorStop(0, rgb(mix(CENTER, [255, 250, 238], 0.4)))
  cg.addColorStop(1, rgb(mix(CENTER, [130, 96, 40], 0.18)))
  x.fillStyle = cg
  x.beginPath()
  x.arc(cx, cy, 22, 0, Math.PI * 2)
  x.fill()
  x.strokeStyle = 'rgba(120,90,40,0.22)'
  x.lineWidth = 1.5
  x.stroke()

  grainPass(x, T, T, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${T}×${T}`, (buf.length / 1024).toFixed(0) + 'KB')
}

function bakeBalloon(name) {
  const cv = createCanvas(T, T)
  const x = cv.getContext('2d')
  const cx = T / 2
  const cy = T / 2 - 6
  const rx = 44
  const ry = 54
  const BODY = [176, 196, 214] // muted dusty sky-blue

  // soft drop shadow
  x.save()
  x.translate(cx, T - 20)
  x.scale(1, 0.28)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, rx * 1.1)
  sh.addColorStop(0, 'rgba(30,20,14,0.18)')
  sh.addColorStop(1, 'rgba(30,20,14,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, rx * 1.1, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // string
  x.strokeStyle = 'rgba(120,110,96,0.5)'
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(cx, cy + ry - 2)
  x.quadraticCurveTo(cx - 8, T - 40, cx, T - 18)
  x.stroke()

  // balloon body, domed sheen upper-left, AO lower-right
  x.save()
  x.beginPath()
  x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  x.clip()
  const bg = x.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry)
  bg.addColorStop(0, rgb(mix(BODY, [255, 252, 244], 0.4)))
  bg.addColorStop(0.55, rgb(BODY))
  bg.addColorStop(1, rgb(mix(BODY, [40, 46, 54], 0.22)))
  x.fillStyle = bg
  x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
  const sheen = x.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, 4, cx - rx * 0.35, cy - ry * 0.4, rx * 0.9)
  sheen.addColorStop(0, 'rgba(255,255,252,0.55)')
  sheen.addColorStop(1, 'rgba(255,255,252,0)')
  x.fillStyle = sheen
  x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
  x.restore()
  x.strokeStyle = 'rgba(70,80,92,0.22)'
  x.lineWidth = 1.5
  x.beginPath()
  x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  x.stroke()
  // knot
  x.fillStyle = rgb(mix(BODY, [40, 46, 54], 0.3))
  x.beginPath()
  x.moveTo(cx - 5, cy + ry - 2)
  x.lineTo(cx + 5, cy + ry - 2)
  x.lineTo(cx, cy + ry + 8)
  x.closePath()
  x.fill()

  grainPass(x, T, T, 0.025)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${T}×${T}`, (buf.length / 1024).toFixed(0) + 'KB')
}

function bakeBubbles(name) {
  const cv = createCanvas(T, T)
  const x = cv.getContext('2d')
  const cx = T / 2
  const cy = T / 2
  const BUB = [206, 224, 220] // soft muted seafoam-glass

  const circles = [
    { dx: 0, dy: 6, r: 38 },
    { dx: -38, dy: 24, r: 22 },
    { dx: 34, dy: 30, r: 18 },
    { dx: 8, dy: -34, r: 15 },
  ]

  // soft drop shadow (combined, under the cluster)
  x.save()
  x.translate(cx, cy + 58)
  x.scale(1, 0.26)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, 60)
  sh.addColorStop(0, 'rgba(30,30,26,0.16)')
  sh.addColorStop(1, 'rgba(30,30,26,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, 60, 0, Math.PI * 2)
  x.fill()
  x.restore()

  for (const b of circles) {
    const bx = cx + b.dx
    const by = cy + b.dy
    x.save()
    x.beginPath()
    x.arc(bx, by, b.r, 0, Math.PI * 2)
    x.clip()
    const bg = x.createRadialGradient(bx - b.r * 0.3, by - b.r * 0.3, 2, bx, by, b.r * 1.3)
    bg.addColorStop(0, 'rgba(255,255,252,0.5)')
    bg.addColorStop(0.4, rgb(mix(BUB, [255, 255, 252], 0.3), 0.55))
    bg.addColorStop(1, rgb(BUB, 0.38))
    x.fillStyle = bg
    x.fillRect(bx - b.r, by - b.r, b.r * 2, b.r * 2)
    // glassy highlight
    const hi = x.createRadialGradient(bx - b.r * 0.36, by - b.r * 0.4, 1, bx - b.r * 0.36, by - b.r * 0.4, b.r * 0.5)
    hi.addColorStop(0, 'rgba(255,255,255,0.7)')
    hi.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = hi
    x.fillRect(bx - b.r, by - b.r, b.r * 2, b.r * 2)
    x.restore()
    x.strokeStyle = 'rgba(255,255,255,0.5)'
    x.lineWidth = 1.4
    x.beginPath()
    x.arc(bx, by, b.r, 0, Math.PI * 2)
    x.stroke()
    x.strokeStyle = rgb(mix(BUB, [60, 74, 70], 0.3), 0.28)
    x.lineWidth = 1
    x.beginPath()
    x.arc(bx, by, b.r, 0, Math.PI * 2)
    x.stroke()
  }

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${T}×${T}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking feelings art →')
bakeNook('feelings-nook.jpg')
bakeFlower('tool-flower.png')
bakeBalloon('tool-balloon.png')
bakeBubbles('tool-bubbles.png')
console.log('Done.')
