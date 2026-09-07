// Bakes the "אתגר חשבון" (math-challenge) material art — a framed classroom
// CHALK SLATE for the question card, a cream flashcard ANSWER TILE, and a warm
// receding wooden DESK the friends stand on. The expression / answer digits are
// drawn crisply in CSS on top of these blank baked surfaces, so ONE slate serves
// every question and ONE tile serves every answer number (readability stays vector).
//
// Same node-canvas pipeline as the coin-sort / bowling / build materials
// (public/art/sprites/*): a seeded value-noise bake with grain, analytic
// bevel/AO, baked key-light + contact shadow. No third-party assets — all
// original, muted/calm palette (sensory rule). ≤400KB total.
//
// One-off build tool. Needs @napi-rs/canvas (a prebuilt drop-in for node-canvas):
//   npm i --no-save @napi-rs/canvas && node scripts/gen-challenge-art.mjs
// (the dep is NOT kept permanently — reinstall it to regenerate.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/challenge/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the grain/fibre generator ------------------
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
  const P = new Uint8Array(512)
  const perm = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255]
  const grad = (h) => (h & 1 ? -1 : 1) * (0.5 + (h & 7) / 14)
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10)
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
    const lp = (a, b, t) => a + t * (b - a)
    const x1 = lp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lp(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)

// signed distance to a rounded rectangle (centre cx,cy, half-extents hx,hy, r).
// d<0 inside; |d| is distance to the border. Used for bevels + masks.
function roundRectSDF(x, y, cx, cy, hx, hy, r) {
  const qx = Math.abs(x - cx) - (hx - r)
  const qy = Math.abs(y - cy) - (hy - r)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

// ============================================================================
// 1) THE QUESTION SLATE — a carved warm-wood FRAME (raised bevel, grain, baked
//    light + AO) around a recessed muted chalk-slate panel (soft chalk-dust
//    noise, a faint top sheen, edge vignette). The equation is drawn in crisp
//    CSS chalk text on the slate, so one sprite serves every question.
// ============================================================================
function bakeSlate() {
  const W = 704
  const H = 392
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const cx = W / 2
  const cy = H / 2
  const hx = W / 2 - 7
  const hy = H / 2 - 7
  const R = 40
  // recessed slate opening
  const fw = 34 // frame width
  const pHx = hx - fw
  const pHy = hy - fw
  const pR = 22
  const nGrain = makeNoise(5127)
  const nFiber = makeNoise(8801)
  const nChalk = makeNoise(3390)
  const frameTop = [206, 170, 116] // warm maple #cea a74
  const frameBot = [176, 138, 84]
  const slate = [60, 74, 71] // muted teal-slate #3c4a47
  const L = [-0.62, -0.7]
  const bevel = 16

  const outAt = (x, y) => roundRectSDF(x, y, cx, cy, hx, hy, R)
  const inAt = (x, y) => roundRectSDF(x, y, cx, cy, pHx, pHy, pR)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const so = outAt(x, y)
      if (so > 1.2) {
        d[idx + 3] = 0
        continue
      }
      const si = inAt(x, y) // <0 inside the slate opening
      let r, g, b
      if (si > 0) {
        // ---- WOOD FRAME ----
        const vy = y / H
        r = lerp(frameTop[0], frameBot[0], vy)
        g = lerp(frameTop[1], frameBot[1], vy)
        b = lerp(frameTop[2], frameBot[2], vy)
        // grain runs the long way around the frame
        const gx = (x - cx) / 30
        const gy = y / 90
        const fib = nFiber(gx * 2.2, gy * 5) * 0.6 + nFiber(gx * 5, gy * 10) * 0.4
        let mul = 1 + fib * 0.09 + nGrain(gx * 0.7, gy) * 0.05
        // outer rim bevel — raised, lit top-left
        const inset = -so
        if (inset < bevel) {
          const nx = outAt(x + 1, y) - outAt(x - 1, y)
          const ny = outAt(x, y + 1) - outAt(x, y - 1)
          const nl = Math.hypot(nx, ny) || 1
          const ndl = (nx / nl) * L[0] + (ny / nl) * L[1]
          const face = smooth(1 - inset / bevel)
          mul *= 1 + ndl * 0.36 * face
          if (inset < 3) mul *= 1 + ndl * 0.2
        }
        // inner lip where the frame meets the slate — a shaded groove (AO)
        if (si < 12) {
          const nx = inAt(x + 1, y) - inAt(x - 1, y)
          const ny = inAt(x, y + 1) - inAt(x, y - 1)
          const nl = Math.hypot(nx, ny) || 1
          // dark on the top-lit side of the groove = the slate is pressed in
          const gShade = ((nx / nl) * -L[0] + (ny / nl) * -L[1]) * (1 - si / 12)
          mul *= 1 + gShade * 0.14
          mul *= 1 - (1 - si / 12) * 0.1
        }
        r *= mul
        g *= mul
        b *= mul
      } else {
        // ---- SLATE PANEL (recessed) ----
        r = slate[0]
        g = slate[1]
        b = slate[2]
        // soft chalk-dust cloudiness + fine tooth
        const cl = nChalk(x / 60, y / 46) * 0.5 + nChalk(x / 16, y / 13) * 0.3
        let mul = 1 + cl * 0.1
        // a faint diagonal chalk sheen top-left
        const sx = (x - W * 0.32) / (W * 0.5)
        const sy = (y - H * 0.3) / (H * 0.5)
        const sheen = Math.exp(-(sx * sx + sy * sy) * 1.1) * 0.14
        mul += sheen
        // edge vignette (darker toward the frame) + recess AO lip near the border
        const dist = -si // >0 inside
        const vig = 1 - Math.exp(-dist / 46)
        mul *= 0.9 + vig * 0.16
        if (dist < 10) mul *= 0.82 + (dist / 10) * 0.18 // dark inner AO lip
        // a couple of ghost chalk smudges (very subtle, off to the sides)
        const smA = Math.exp(-((x - W * 0.2) ** 2 / 5200 + (y - H * 0.7) ** 2 / 1400)) * 0.06
        const smB = Math.exp(-((x - W * 0.82) ** 2 / 4200 + (y - H * 0.32) ** 2 / 1500)) * 0.05
        mul += smA + smB
        r = clamp(r * mul, 0, 255)
        g = clamp(g * mul, 0, 255)
        b = clamp(b * mul, 0, 255)
      }
      // outer silhouette AA
      let a = 255
      if (so > -1.2) a = clamp((1.2 - so) / 2.4, 0, 1) * 255
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(g, 0, 255)
      d[idx + 2] = clamp(b, 0, 255)
      d[idx + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('slate.png'), buf)
  console.log('  ✓ slate.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 2) THE ANSWER TILE — a raised, bevelled CREAM flashcard block: soft paper
//    fibre, a warm key light top-left, baked edge AO, and a subtly recessed
//    face panel the CSS numeral sits engraved into. Cream so a dark numeral
//    stays crisp; one tile serves every answer.
// ============================================================================
function bakeTile() {
  const W = 288
  const H = 288
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const cx = W / 2
  const cy = H / 2
  const hx = W / 2 - 8
  const hy = H / 2 - 8
  const R = 48
  const nFiber = makeNoise(6112)
  const nGrain = makeNoise(1904)
  const bevel = 18
  const pHx = hx - 26
  const pHy = hy - 26
  const pR = 30
  const topCol = [240, 231, 210] // warm cream #f0e7d2
  const botCol = [219, 205, 176] // #dbcdb0
  const L = [-0.6, -0.72]
  const sdfAt = (x, y) => roundRectSDF(x, y, cx, cy, hx, hy, R)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const s = sdfAt(x, y)
      if (s > 1.2) {
        d[idx + 3] = 0
        continue
      }
      const vy = y / H
      let r = lerp(topCol[0], botCol[0], vy)
      let g = lerp(topCol[1], botCol[1], vy)
      let b = lerp(topCol[2], botCol[2], vy)
      // fine paper tooth — soft speckle, no directional grain
      const fib = nFiber(x / 6, y / 6) * 0.5 + nFiber(x / 2.3, y / 2.3) * 0.3
      const drift = nGrain(x / 70, y / 62) * 0.5
      let mul = 1 + fib * 0.045 + drift * 0.05
      // raised rim bevel, lit top-left
      const inset = -s
      if (inset < bevel) {
        const nx = sdfAt(x + 1, y) - sdfAt(x - 1, y)
        const ny = sdfAt(x, y + 1) - sdfAt(x, y - 1)
        const nl = Math.hypot(nx, ny) || 1
        const ndl = (nx / nl) * L[0] + (ny / nl) * L[1]
        const face = smooth(1 - inset / bevel)
        mul *= 1 + ndl * 0.34 * face
        if (inset < 3) mul *= 1 + ndl * 0.2
      }
      // recessed face panel — a shallow engraved plate for the numeral
      const ps = roundRectSDF(x, y, cx, cy, pHx, pHy, pR)
      if (ps > -6 && ps < 6) {
        const pnx = roundRectSDF(x + 1, y, cx, cy, pHx, pHy, pR) - roundRectSDF(x - 1, y, cx, cy, pHx, pHy, pR)
        const pny = roundRectSDF(x, y + 1, cx, cy, pHx, pHy, pR) - roundRectSDF(x, y - 1, cx, cy, pHx, pHy, pR)
        const pnl = Math.hypot(pnx, pny) || 1
        const gShade = ((pnx / pnl) * -L[0] + (pny / pnl) * -L[1]) * (1 - Math.abs(ps) / 6)
        mul *= 1 + gShade * 0.13
        mul *= 1 - (1 - Math.abs(ps) / 6) * 0.04
      }
      r *= mul
      g *= mul
      b *= mul
      let a = 255
      if (s > -1.2) a = clamp((1.2 - s) / 2.4, 0, 1) * 255
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(g, 0, 255)
      d[idx + 2] = clamp(b, 0, 255)
      d[idx + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('tile.png'), buf)
  console.log('  ✓ tile.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 3) THE DESK — a warm receding WALNUT top (grain converging to the far end, a
//    soft light pool near the child) with a thick bevelled FRONT EDGE (grounding
//    lip + AO). The friends stand on the near edge and the slate props against
//    it — the perspective + lip give the scene real depth.
// ============================================================================
function bakeDesk() {
  const W = 720
  const H = 300
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const CX = W / 2
  const FAR_Y = 20
  const NEAR_Y = 206
  const farHalf = 214
  const nearHalf = 356
  const half = (f) => lerp(nearHalf, farHalf, f)

  // warm dark surround behind/under the desk
  ctx.fillStyle = '#241608'
  ctx.fillRect(0, 0, W, H)

  // top surface (walnut trapezoid, darker far)
  let g = ctx.createLinearGradient(0, NEAR_Y, 0, FAR_Y)
  g.addColorStop(0, '#b98d57')
  g.addColorStop(0.6, '#a67c49')
  g.addColorStop(1, '#7f5d34')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineTo(CX + farHalf, FAR_Y)
  ctx.lineTo(CX - farHalf, FAR_Y)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // front edge / apron (vertical grain, darker, AO at the bottom)
  g = ctx.createLinearGradient(0, NEAR_Y, 0, H)
  g.addColorStop(0, '#9c7442')
  g.addColorStop(0.5, '#7a5931')
  g.addColorStop(1, '#523a20')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf + 12, H)
  ctx.lineTo(CX - nearHalf - 12, H)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // per-pixel material pass
  const im = ctx.getImageData(0, 0, W, H)
  const dat = im.data
  const nFiber = makeNoise(2277)
  const nGrain = makeNoise(7740)
  const knots = [
    { x: CX - 170, y: 120, r: 22, s: 0.34 },
    { x: CX + 200, y: 95, r: 17, s: 0.3 },
    { x: CX + 30, y: 262, r: 19, s: 0.28 },
  ]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (dat[idx + 3] === 0) continue
      let mul = 1
      if (y < NEAR_Y) {
        const f = clamp((NEAR_Y - y) / (NEAR_Y - FAR_Y), 0, 1)
        const hh = half(f)
        const nx = (x - CX) / hh
        if (Math.abs(nx) > 1.02) continue
        const persp = nearHalf / hh
        const fib = nFiber(nx * 20 * (0.5 + persp * 0.5), (NEAR_Y - y) * 0.012 * persp) * 0.6 + nFiber(nx * 40, (NEAR_Y - y) * 0.03) * 0.4
        const drift = nGrain(nx * 3 + 5, f * 6) * 0.5
        mul *= 1 + fib * 0.1 + drift * 0.05
        const seam = Math.abs((((nx + 1) * 2.5) % 1) - 0.5)
        if (seam > 0.46) mul *= 0.93
        const sheen = Math.exp(-(nx * nx) / 0.24) * 0.11 * (0.4 + f * 0.6)
        mul *= 1 + sheen
      } else {
        const nx = (x - CX) / nearHalf
        const fib = nFiber(nx * 30, (y - NEAR_Y) * 0.02) * 0.6 + nFiber(nx * 60 + 3, (y - NEAR_Y) * 0.05) * 0.4
        mul *= 1 + fib * 0.09
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

  // crisp front lip highlight where the top meets the front edge
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 232, 194, 0.46)'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y + 4)
  ctx.lineTo(CX + nearHalf, NEAR_Y + 4)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(50, 32, 14, 0.32)'
  ctx.stroke()

  // overhead warm light pool + corner vignette
  g = ctx.createRadialGradient(CX, NEAR_Y - 26, 20, CX, NEAR_Y - 26, 320)
  g.addColorStop(0, 'rgba(255, 240, 206, 0.15)')
  g.addColorStop(1, 'rgba(255, 240, 206, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, NEAR_Y)
  g = ctx.createRadialGradient(CX, H * 0.5, H * 0.3, CX, H * 0.5, H * 0.82)
  g.addColorStop(0, 'rgba(26, 15, 6, 0)')
  g.addColorStop(1, 'rgba(26, 15, 6, 0.32)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(file('desk.jpg'), buf)
  console.log('  ✓ desk.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking math-challenge art →')
bakeSlate()
bakeTile()
bakeDesk()
console.log('Done.')
