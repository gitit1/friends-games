// Bakes the "ציור חופשי" (free-draw board) materials — REAL, textured art, not
// flat CSS shapes/gradients. The child draws on a physical PAPER surface, picks
// colours from PHYSICAL CRAYONS resting in a WOODEN TRAY, and rubs out with a
// real rubber ERASER. Every surface is a baked @napi-rs/canvas sprite with
// seeded value-noise material grain + analytic baked lighting/AO — the same
// pipeline as the dice / coin-sort / sortshelf materials. No third-party art.
//
//   paper.jpg      the drawing surface — warm off-white paper with a fine tooth
//                  grain + soft vignette, so it reads as a real sheet under the
//                  child's strokes (the hero material).
//   tray.png       a warm muted-oak wooden tray with baked grain, a lit top edge
//                  and a soft inner groove where the crayons rest.
//   crayon-0..7    eight physical crayons (paper wrapper + a printed label band,
//                  an exposed waxy conical tip with a specular, a cylinder
//                  highlight and a baked contact shadow) — one per palette colour.
//                  The wax/wrapper keep the drawing colour CLEAR; only the
//                  materials around them stay sensory-muted.
//   eraser.png     a real pink rubber eraser block — beveled, top-lit, with a
//                  paper sleeve band and a baked contact shadow.
//
// One-off build tool:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-draw-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/draw/', import.meta.url)
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

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// value-noise material grain multiplied over every opaque pixel (kills flat read)
function grainPass(ctx, W, H, noise, amt = 0.05, scaleA = 0.5, scaleB = 1.7) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      const n = noise(x * scaleA, y * scaleA) * 0.6 + noise(x * scaleB, y * scaleB) * 0.4
      const m = 1 + n * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

const grain = makeNoise(20260718)

// ============================================================================
// PAPER — the drawing surface. Warm off-white sheet with a fine paper tooth,
// gentle large-scale mottling (uneven warmth) and a soft edge vignette so it
// reads as a real, slightly-worn sheet the child draws on.
// ============================================================================
function bakePaper() {
  const W = 760
  const H = 920
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const base = [250, 247, 239] // warm cream
  ctx.fillStyle = rgb(base)
  ctx.fillRect(0, 0, W, H)

  // pixel-level tooth grain + soft mottling, done in one image pass
  const fibre = makeNoise(0x9a71)
  const mottle = makeNoise(0x2f13)
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      // fine paper tooth
      const tooth = fibre(x * 0.9, y * 0.9) * 0.5 + fibre(x * 2.3, y * 2.3) * 0.5
      // broad warmth mottle
      const soft = mottle(x * 0.012, y * 0.012)
      // edge vignette (physical sheet, darker toward the rim)
      const nx = (x / W - 0.5) * 2
      const ny = (y / H - 0.5) * 2
      const vig = Math.max(0, Math.hypot(nx, ny) - 0.72) * 0.16
      const m = 1 + tooth * 0.035 + soft * 0.02 - vig
      d[idx] = clamp(base[0] * m, 0, 255)
      d[idx + 1] = clamp(base[1] * m, 0, 255)
      d[idx + 2] = clamp((base[2] - soft * 6) * m, 0, 255) // mottle leans a touch warm
    }
  }
  ctx.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/jpeg', 88)
  writeFileSync(file('paper.jpg'), buf)
  console.log('  ✓ paper.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// TRAY — a warm muted-oak wooden tray/shelf that holds the crayons. Long
// horizontal grain, a lit top surface, a soft inner groove (AO) near the top
// where the crayons seat, and a lit front lip. Displayed as a background-cover
// behind the palette, so the wood stays readable under any crop.
// ============================================================================
function bakeTray() {
  const W = 900
  const H = 260
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const base = [156, 120, 82] // muted warm oak

  // full-bleed (opaque) — the palette container rounds it via CSS border-radius,
  // so we can ship it as a small JPEG instead of a heavy textured PNG.
  ctx.save()

  // top-lit body gradient
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.16)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, [30, 20, 12], 0.28)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // long horizontal wood grain streaks
  const wood = makeNoise(0x5ac0)
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (d[idx + 3] < 8) continue
      // stretched along x → long grain lines; a few sharper streak bands
      const grainL = wood(x * 0.015, y * 0.5) * 0.6 + wood(x * 0.06, y * 1.3) * 0.4
      const streak = Math.sin(y * 0.14 + wood(x * 0.02, y * 0.1) * 3) * 0.5
      const m = 1 + grainL * 0.1 + streak * 0.035
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  // soft inner groove (AO) near the top — crayons look seated in it
  const groove = ctx.createLinearGradient(0, 0, 0, 70)
  groove.addColorStop(0, 'rgba(30,20,12,0.32)')
  groove.addColorStop(1, 'rgba(30,20,12,0)')
  ctx.fillStyle = groove
  ctx.fillRect(0, 0, W, 70)

  // lit front lip along the bottom
  const lip = ctx.createLinearGradient(0, H - 48, 0, H)
  lip.addColorStop(0, 'rgba(255,244,225,0.16)')
  lip.addColorStop(0.25, 'rgba(255,244,225,0.06)')
  lip.addColorStop(1, 'rgba(20,12,6,0.28)')
  ctx.fillStyle = lip
  ctx.fillRect(0, H - 48, W, 48)

  // lit top edge line (catches the key light)
  const topEdge = ctx.createLinearGradient(0, 0, 0, 10)
  topEdge.addColorStop(0, 'rgba(255,246,230,0.4)')
  topEdge.addColorStop(1, 'rgba(255,246,230,0)')
  ctx.fillStyle = topEdge
  ctx.fillRect(0, 0, W, 10)
  ctx.restore()

  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(file('tray.jpg'), buf)
  console.log('  ✓ tray.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// CRAYON — a physical crayon standing tip-up, tinted to a palette colour.
// Exposed waxy conical tip (with a specular) over a paper-wrapped cylinder
// carrying a printed label band, a cylinder highlight, a flat-cut base and a
// baked contact shadow. The wax/wrapper keep the true drawing colour (clear);
// shading is what makes it feel real.
// ============================================================================
function bakeCrayon(color, name) {
  const W = 140
  const H = 330
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const base = color
  const cx = W / 2
  const bodyW = 84
  const left = cx - bodyW / 2
  const right = cx + bodyW / 2
  const tipApex = 20
  const coneBase = 86
  const bodyTop = 80
  const bodyBot = 296

  // --- baked contact shadow under the crayon ---
  ctx.save()
  ctx.translate(cx, bodyBot + 12)
  ctx.scale(1, 0.26)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, bodyW * 0.72)
  sh.addColorStop(0, 'rgba(24,18,10,0.34)')
  sh.addColorStop(0.6, 'rgba(24,18,10,0.18)')
  sh.addColorStop(1, 'rgba(24,18,10,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, bodyW * 0.72, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // cross-cylinder shading helper (left lit, right shaded)
  const cylGrad = () => {
    const g = ctx.createLinearGradient(left, 0, right, 0)
    g.addColorStop(0, rgb(mix(base, [40, 30, 20], 0.28))) // left rim shade
    g.addColorStop(0.16, rgb(mix(base, [255, 255, 255], 0.34))) // highlight band
    g.addColorStop(0.5, rgb(base))
    g.addColorStop(0.86, rgb(mix(base, [30, 22, 14], 0.22)))
    g.addColorStop(1, rgb(mix(base, [20, 14, 8], 0.42))) // right rim shade
    return g
  }

  // --- exposed wax CONE tip ---
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, tipApex)
  ctx.lineTo(right - 4, coneBase)
  ctx.lineTo(left + 4, coneBase)
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = cylGrad()
  ctx.fillRect(0, 0, W, H)
  // waxy vertical sheen — the tip catches more light than the wrapper
  const wax = ctx.createLinearGradient(0, tipApex, 0, coneBase)
  wax.addColorStop(0, 'rgba(255,255,255,0.5)')
  wax.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  wax.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = wax
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
  // little specular dot near the tip
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath()
  ctx.ellipse(cx - 4, tipApex + 20, 4, 8, -0.2, 0, Math.PI * 2)
  ctx.fill()

  // --- paper-WRAPPED cylinder body ---
  ctx.save()
  roundRectPath(ctx, left, bodyTop, bodyW, bodyBot - bodyTop, 10)
  ctx.clip()
  ctx.fillStyle = cylGrad()
  ctx.fillRect(0, 0, W, H)
  // printed label band (a lighter paper panel with two crimp lines)
  const labelY = 150
  const labelH = 96
  const lab = ctx.createLinearGradient(left, 0, right, 0)
  lab.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.5), 0.55))
  lab.addColorStop(0.5, rgb(mix(base, [255, 255, 255], 0.72), 0.6))
  lab.addColorStop(1, rgb(mix(base, [255, 255, 255], 0.44), 0.5))
  ctx.fillStyle = lab
  ctx.fillRect(left, labelY, bodyW, labelH)
  // crimped folds top & bottom of the wrapper (thin darker rings)
  ctx.strokeStyle = rgb(mix(base, [20, 14, 8], 0.4), 0.5)
  ctx.lineWidth = 2
  for (const yy of [bodyTop + 10, labelY, labelY + labelH, bodyBot - 12]) {
    ctx.beginPath()
    ctx.moveTo(left, yy)
    ctx.lineTo(right, yy)
    ctx.stroke()
  }
  ctx.restore()

  // --- flat-cut wax base (a darker ellipse) ---
  ctx.fillStyle = rgb(mix(base, [20, 14, 8], 0.35))
  ctx.beginPath()
  ctx.ellipse(cx, bodyBot - 4, bodyW / 2 - 3, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = rgb(mix(base, [10, 8, 6], 0.55))
  ctx.beginPath()
  ctx.ellipse(cx, bodyBot - 2, bodyW / 2 - 8, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // grain over the whole crayon (waxy/paper tooth)
  grainPass(ctx, W, H, grain, 0.05)

  // crisp cylinder specular highlight strip (over the grain, stays glossy)
  ctx.save()
  roundRectPath(ctx, left, bodyTop, bodyW, bodyBot - bodyTop, 10)
  ctx.clip()
  const hi = ctx.createLinearGradient(left + bodyW * 0.1, 0, left + bodyW * 0.34, 0)
  hi.addColorStop(0, 'rgba(255,255,255,0)')
  hi.addColorStop(0.5, 'rgba(255,255,255,0.4)')
  hi.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hi
  ctx.fillRect(left, bodyTop, bodyW * 0.4, bodyBot - bodyTop)
  ctx.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// ERASER — a real pink rubber block: rounded, top-lit with a beveled top face,
// a paper sleeve band across the middle, and a baked contact shadow.
// ============================================================================
function bakeEraser() {
  const W = 220
  const H = 150
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const base = [222, 148, 170] // muted dusty rose
  const bx = 22
  const by = 26
  const bw = W - 44
  const bh = H - 58
  const r = 26

  // contact shadow
  ctx.save()
  ctx.translate(W / 2 + 4, by + bh + 6)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, bw * 0.6)
  sh.addColorStop(0, 'rgba(24,18,20,0.34)')
  sh.addColorStop(1, 'rgba(24,18,20,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, bw * 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // body
  roundRectPath(ctx, bx, by, bw, bh, r)
  ctx.save()
  ctx.clip()
  let g = ctx.createLinearGradient(0, by, 0, by + bh)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.3))) // top lit
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, [70, 30, 45], 0.34))) // bottom shade
  ctx.fillStyle = g
  ctx.fillRect(bx, by, bw, bh)
  // top-left key-light bloom
  const bloom = ctx.createRadialGradient(bx + bw * 0.3, by + bh * 0.2, 0, bx + bw * 0.3, by + bh * 0.2, bw * 0.8)
  bloom.addColorStop(0, 'rgba(255,255,255,0.3)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(bx, by, bw, bh)
  // paper sleeve band across the middle (cream, two edge lines)
  const sy = by + bh * 0.34
  const sh2 = bh * 0.32
  g = ctx.createLinearGradient(0, sy, 0, sy + sh2)
  g.addColorStop(0, 'rgba(252,248,240,0.92)')
  g.addColorStop(1, 'rgba(236,228,214,0.92)')
  ctx.fillStyle = g
  ctx.fillRect(bx, sy, bw, sh2)
  ctx.strokeStyle = 'rgba(120,90,70,0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(bx, sy)
  ctx.lineTo(bx + bw, sy)
  ctx.moveTo(bx, sy + sh2)
  ctx.lineTo(bx + bw, sy + sh2)
  ctx.stroke()
  ctx.restore()

  // grain (rubber matte + paper)
  grainPass(ctx, W, H, grain, 0.045)

  // bevel rims
  ctx.save()
  roundRectPath(ctx, bx + 1.5, by + 1.5, bw - 3, bh - 3, r - 1)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.stroke()
  roundRectPath(ctx, bx, by, bw, bh, r)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(70,30,45,0.22)'
  ctx.stroke()
  ctx.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('eraser.png'), buf)
  console.log('  ✓ eraser.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- run -------------------------------------------------------------------
// palette colours MUST match COLORS[] in src/games/DrawBoard.tsx (drawing
// colours stay CLEAR/true — only the surrounding materials are muted).
const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#111827']
console.log('Baking free-draw art →')
bakePaper()
bakeTray()
COLORS.forEach((c, i) => bakeCrayon(hex(c), `crayon-${i}.png`))
bakeEraser()
console.log('Done.')
