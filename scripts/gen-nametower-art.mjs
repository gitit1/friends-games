// Bakes the "מגדל השם שלי" (name-tower) materials — REAL wooden TOY ALPHABET
// BLOCKS, not flat CSS rectangles. Each block is a chunky painted-maple CUBE seen
// in a gentle 3/4 view (a lit TOP face + a shaded RIGHT face receding up-right, a
// rounded FRONT face facing the child) with sanded bevelled edges, seeded wood
// grain, a soft knot or two, baked top-left key light + bottom-right AO, and a
// soft baked CONTACT SHADOW so the block grounds on a surface / on the block below
// it. The FRONT face carries a recessed CREAM letter PLATE (engraved groove) — the
// Hebrew letter itself is drawn crisply in CSS on top of that plate, razor-legible,
// so ONE block sprite per colour serves every letter. Muted, sensory-calm palette
// (tints matched to the playroom backdrop). Plus a warm maple SHELF plank in gentle
// perspective the whole tower stands on (grounding lip + AO + light pool).
//
// Same pipeline as the dice / build-a-number materials (public/art/sprites/*): an
// original @napi-rs/canvas bake with seeded value-noise grain + analytic baked
// lighting/AO. No third-party art. One-off build tool:
//   node scripts/gen-nametower-art.mjs
// (@napi-rs/canvas is already pinned in package.json — do NOT reinstall.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/nametower/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the wood-fibre / grain generator --------------
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

// ============================================================================
// THE ALPHABET BLOCK — a painted-maple cube in 3/4 view. `base` = the block's
// muted paint tint. The FRONT face rect (FX0/FY0/FS) is MIRRORED in app.css so the
// crisp CSS letter overlays exactly on the baked cream plate.
// ============================================================================
const S = 256
const FX0 = 0.095 // front face, fractions of S (mirror in app.css .nt-glyph)
const FY0 = 0.335
const FS = 0.605
const DX = 0.155 // depth: how far the top/right faces recede to the right…
const DY = 0.155 // …and upward
const CREAM = [239, 229, 206] // the warm letter plate

const grain = makeNoise(20260718)
const fibre = makeNoise(881452)

function bakeBlock(base, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')

  const fx = FX0 * S
  const fy = FY0 * S
  const fs = FS * S
  const dx = DX * S
  const dy = DY * S
  const r = fs * 0.16 // corner radius (sanded)

  const top = mix(base, [255, 250, 240], 0.2) // lit top face
  const topHi = mix(base, [255, 252, 244], 0.34)
  const right = mix(base, [56, 40, 26], 0.34) // shaded right face (warm brown shadow)
  const rightDk = mix(base, [44, 30, 18], 0.5)

  // --- baked contact shadow on the surface, under the cube (grounds it) ---
  ctx.save()
  const shY = (FY0 + FS) * S - fs * 0.01
  ctx.translate(fx + fs * 0.5, shY + fs * 0.085)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, fs * 0.66)
  sh.addColorStop(0, 'rgba(52,36,22,0.36)')
  sh.addColorStop(0.6, 'rgba(52,36,22,0.18)')
  sh.addColorStop(1, 'rgba(52,36,22,0)')
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
  // lit seam where the top meets the front
  ctx.strokeStyle = rgb(mix(base, [255, 255, 255], 0.6), 0.5)
  ctx.lineWidth = S * 0.006
  ctx.beginPath()
  ctx.moveTo(fx + r * 0.4, fy)
  ctx.lineTo(fx + fs - r * 0.4, fy)
  ctx.stroke()

  // --- FRONT face (rounded square) with key-light gradient ---
  roundRectPath(ctx, fx, fy, fs, fs, r)
  g = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs)
  g.addColorStop(0, rgb(mix(base, [255, 250, 238], 0.3))) // lit top-left
  g.addColorStop(0.55, rgb(base))
  g.addColorStop(1, rgb(mix(base, [46, 32, 20], 0.18))) // AO bottom-right
  ctx.save()
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip() // clip to the front face for the plate + bloom + grain passes

  // soft top-left key-light bloom
  const bloom = ctx.createRadialGradient(fx + fs * 0.3, fy + fs * 0.26, 0, fx + fs * 0.3, fy + fs * 0.26, fs * 0.9)
  bloom.addColorStop(0, 'rgba(255,250,236,0.26)')
  bloom.addColorStop(1, 'rgba(255,250,236,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(fx, fy, fs, fs)
  // bottom-right ambient occlusion pooling
  const ao = ctx.createRadialGradient(fx + fs * 0.82, fy + fs * 0.84, fs * 0.1, fx + fs * 0.82, fy + fs * 0.84, fs * 0.9)
  ao.addColorStop(0, 'rgba(40,26,14,0.2)')
  ao.addColorStop(1, 'rgba(40,26,14,0)')
  ctx.fillStyle = ao
  ctx.fillRect(fx, fy, fs, fs)

  // --- recessed CREAM letter PLATE (engraved into the front face) ---
  const m = fs * 0.135 // plate inset margin
  const px = fx + m
  const py = fy + m
  const ps = fs - m * 2
  const pr = ps * 0.16
  // groove shadow (outer, top-left) — the pressed-in wall
  roundRectPath(ctx, px - 3, py - 3, ps + 6, ps + 6, pr + 3)
  ctx.fillStyle = 'rgba(40,26,14,0.28)'
  ctx.fill()
  // the plate itself, lit top-left → cool AO bottom-right
  roundRectPath(ctx, px, py, ps, ps, pr)
  g = ctx.createLinearGradient(px, py, px + ps, py + ps)
  g.addColorStop(0, rgb(mix(CREAM, [255, 255, 255], 0.28)))
  g.addColorStop(0.6, rgb(CREAM))
  g.addColorStop(1, rgb(mix(CREAM, [120, 96, 66], 0.16)))
  ctx.fillStyle = g
  ctx.fill()
  // bright lower-right lip of the groove (light catches the far wall = "carved in")
  ctx.save()
  roundRectPath(ctx, px, py, ps, ps, pr)
  ctx.clip()
  roundRectPath(ctx, px - 2, py - 2, ps + 4, ps + 4, pr + 2)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(255,250,240,0.5)'
  ctx.stroke()
  ctx.restore()
  ctx.restore() // release front-face clip

  // --- crisp bevel rim on the front face (bright top-left, dark bottom-right) ---
  ctx.save()
  roundRectPath(ctx, fx + 1, fy + 1, fs - 2, fs - 2, r - 1)
  ctx.clip()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(255,250,240,0.55)'
  ctx.stroke()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.clip()
  ctx.beginPath()
  ctx.arc(fx + fs, fy + fs, fs * 0.94, Math.PI * 0.5, Math.PI)
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.024
  ctx.strokeStyle = 'rgba(40,26,14,0.2)'
  ctx.stroke()
  ctx.restore()

  // --- wood-grain + soft knots pass over every painted pixel of the block ---
  // (skips the cream plate interior so the letter area stays clean + legible)
  const plateInX0 = px + ps * 0.06
  const plateInY0 = py + ps * 0.06
  const plateInX1 = px + ps * 0.94
  const plateInY1 = py + ps * 0.94
  const knots = [
    { x: fx + fs * 0.22, y: fy - dy * 0.4, r: 15, s: 0.16 }, // on the top face
    { x: fx + fs + dx * 0.5, y: fy + fs * 0.5, r: 13, s: 0.14 }, // on the right face
  ]
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      const inPlate = x > plateInX0 && x < plateInX1 && y > plateInY0 && y < plateInY1
      // vertical-ish wood fibre (tight across x, stretched down y) + slow drift
      const fib = fibre(x * 0.16, y * 0.028) * 0.6 + fibre(x * 0.34, y * 0.06) * 0.4
      const drift = grain(x * 0.02 + 4, y * 0.03) * 0.5
      let mul = 1 + (fib * 0.075 + drift * 0.04) * (inPlate ? 0.4 : 1)
      if (!inPlate) {
        for (const k of knots) {
          const kd = Math.hypot(x - k.x, y - k.y)
          if (kd < k.r * 2.2) {
            const ring = Math.sin(kd * 0.7) * 0.5 + 0.5
            const fall = Math.exp(-kd / (k.r * 0.85))
            mul *= 1 - k.s * fall * (0.5 + ring * 0.5)
          }
        }
      }
      d[idx] = clamp(d[idx] * mul, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * mul, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * mul, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SHELF — a warm maple plank in gentle perspective the tower stands on: a
// receding TOP surface (grain converging far, lit pool near the child) + a thick
// bevelled FRONT LIP (grounding edge with AO). The tower's base sits on the near
// top edge, so the stack reads as resting on a real surface.
// ============================================================================
function bakeShelf() {
  const W = 720
  const H = 200
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const CX = W / 2
  const FAR_Y = 14
  const NEAR_Y = 120 // top surface meets the front lip
  const farHalf = 300
  const nearHalf = 356
  const nFiber = makeNoise(51207)
  const nGrain = makeNoise(33110)

  // transparent everywhere by default; draw only the plank
  // -- top surface (maple trapezoid, atmospherically darker far) --
  let g = ctx.createLinearGradient(0, NEAR_Y, 0, FAR_Y)
  g.addColorStop(0, '#d7b57e')
  g.addColorStop(0.62, '#c8a26a')
  g.addColorStop(1, '#b58d55')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineTo(CX + farHalf, FAR_Y)
  ctx.lineTo(CX - farHalf, FAR_Y)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // -- front lip / apron (vertical grain, darker, AO at the bottom) --
  g = ctx.createLinearGradient(0, NEAR_Y, 0, H)
  g.addColorStop(0, '#c39a60')
  g.addColorStop(0.5, '#9d7844')
  g.addColorStop(1, '#77592f')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, H)
  ctx.lineTo(CX - nearHalf, H)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // ---- per-pixel material pass: grain on both faces + sheen + AO ----
  const im = ctx.getImageData(0, 0, W, H)
  const dat = im.data
  const knots = [
    { x: CX - 190, y: 70, r: 20, s: 0.28 },
    { x: CX + 150, y: 160, r: 17, s: 0.24 },
  ]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (dat[idx + 3] === 0) continue
      let mul = 1
      if (y < NEAR_Y) {
        const f = clamp((NEAR_Y - y) / (NEAR_Y - FAR_Y), 0, 1)
        const hh = lerp(nearHalf, farHalf, f)
        const nx = (x - CX) / hh
        if (Math.abs(nx) > 1.02) continue
        const persp = nearHalf / hh
        const fib = nFiber(nx * 20 * (0.5 + persp * 0.5), (NEAR_Y - y) * 0.014 * persp) * 0.6 + nFiber(nx * 42, (NEAR_Y - y) * 0.03) * 0.4
        const drift = nGrain(nx * 3 + 7, f * 6) * 0.5
        mul *= 1 + fib * 0.085 + drift * 0.045
        const seam = Math.abs((((nx + 1) * 3) % 1) - 0.5)
        if (seam > 0.46) mul *= 0.94
        const sheen = Math.exp(-(nx * nx) / 0.24) * 0.11 * (0.4 + f * 0.6)
        mul *= 1 + sheen
      } else {
        const nx = (x - CX) / nearHalf
        const fib = nFiber(nx * 30, (y - NEAR_Y) * 0.02) * 0.6 + nFiber(nx * 60 + 3, (y - NEAR_Y) * 0.05) * 0.4
        mul *= 1 + fib * 0.08
        const down = (y - NEAR_Y) / (H - NEAR_Y)
        mul *= 1 - down * 0.14
      }
      for (const k of knots) {
        const kd = Math.hypot(x - k.x, y - k.y)
        if (kd < k.r * 2.2) {
          const ring = Math.sin(kd * 0.8) * 0.5 + 0.5
          const fall = Math.exp(-kd / (k.r * 0.85))
          mul *= 1 - k.s * fall * (0.5 + ring * 0.5)
        }
      }
      dat[idx] = clamp(dat[idx] * mul, 0, 255)
      dat[idx + 1] = clamp(dat[idx + 1] * mul, 0, 255)
      dat[idx + 2] = clamp(dat[idx + 2] * mul, 0, 255)
    }
  }
  ctx.putImageData(im, 0, 0)

  // -- crisp lit front edge where the top meets the lip --
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,238,204,0.55)'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y + 4)
  ctx.lineTo(CX + nearHalf, NEAR_Y + 4)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(64,42,18,0.3)'
  ctx.stroke()

  // -- soft overhead warm light pool on the near-centre of the surface --
  g = ctx.createRadialGradient(CX, NEAR_Y - 18, 20, CX, NEAR_Y - 18, 300)
  g.addColorStop(0, 'rgba(255,244,214,0.16)')
  g.addColorStop(1, 'rgba(255,244,214,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, NEAR_Y)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('shelf.png'), buf)
  console.log('  ✓ shelf.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- muted, sensory-calm tints (matched to wooden-playroom.jpg) --------------
const TINTS = {
  maple: [208, 173, 120], // warm natural maple
  sage: [154, 180, 146], // muted green
  blue: [152, 178, 200], // dusty blue
  clay: [201, 150, 121], // soft terracotta
  mustard: [214, 186, 122], // warm mustard
  rose: [201, 158, 158], // dusty rose
}
console.log('Baking name-tower art →')
for (const [k, c] of Object.entries(TINTS)) bakeBlock(c, `block-${k}.png`)
bakeShelf()
console.log('Done.')
