// Bakes the "בונים מספר" (build-a-number) scene's material art — real WOODEN
// NUMBER TILES (Montessori/SumBlox flavour), carved OPERATOR pucks, and a warm
// varnished WORKBENCH in gentle perspective. The digit / symbol itself is drawn
// crisply in CSS on top of these blank baked blocks, so ONE tile sprite serves
// every number 1–100 and ONE puck serves + − × ÷ = (readability stays vector).
//
// Same pipeline as the coin-sort + bowling materials (public/art/sprites/*): a
// node-canvas bake with seeded value-noise wood grain, per-region tone jitter, a
// few ring knots, analytic bevel/varnish sheen and baked lighting/AO. No
// third-party assets — all original, muted/calm palette (sensory rule).
//
// One-off build tool. Needs @napi-rs/canvas (a prebuilt drop-in for node-canvas):
//   npm i --no-save @napi-rs/canvas && node scripts/gen-build-art.mjs
// (the dep is NOT kept permanently — reinstall it to regenerate.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/build/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the grain/fiber generator ----------------
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
// d<0 inside; |d| is the distance to the border. Used for the tile bevel + mask.
function roundRectSDF(x, y, cx, cy, hx, hy, r) {
  const qx = Math.abs(x - cx) - (hx - r)
  const qy = Math.abs(y - cy) - (hy - r)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

// ============================================================================
// 1) THE NUMBER TILE — a raised, bevelled maple block. Vertical grain, a warm
//    key light from the top-left, baked edge AO, a subtly recessed face panel
//    the CSS numeral sits engraved into. Neutral warm tone so a dark numeral
//    stays crisply readable (readability sacred).
// ============================================================================
function bakeTile() {
  const W = 264
  const H = 296
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const cx = W / 2
  const cy = H / 2
  const hx = W / 2 - 8 // leave a margin for the soft AA silhouette
  const hy = H / 2 - 8
  const R = 40 // corner radius
  const nGrain = makeNoise(2025)
  const nFiber = makeNoise(7031)
  const bevel = 20 // width of the lit bevel band around the rim
  // recessed inner face panel (where the numeral will be engraved)
  const pHx = hx - 30
  const pHy = hy - 34
  const pR = 26
  // warm maple base, lit top → shaded bottom
  const topCol = [228, 197, 150] // #e4c596
  const botCol = [196, 158, 104] // #c49e68
  const L = [-0.6, -0.72] // key-light direction (top-left), 2-D for the bevel

  const sdfAt = (x, y) => roundRectSDF(x, y, cx, cy, hx, hy, R)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const s = sdfAt(x, y) // <0 inside
      if (s > 1.2) {
        d[idx + 3] = 0
        continue
      }
      // vertical base gradient
      const vy = y / H
      let r = lerp(topCol[0], botCol[0], vy)
      let g = lerp(topCol[1], botCol[1], vy)
      let b = lerp(topCol[2], botCol[2], vy)

      // vertical wood grain: tight fibres across x, stretched down y + a slow tone drift
      const gx = (x - cx) / 26
      const gy = y / 150
      const fib = nFiber(gx * 2.4, gy * 5.5) * 0.6 + nFiber(gx * 5.0, gy * 11) * 0.4
      const drift = nGrain(gx * 0.7 + 4, gy * 0.9) * 0.5
      let mul = 1 + fib * 0.1 + drift * 0.06

      // one soft knot for character (upper area, off-centre) — subtle, not a bullseye
      const kdx = (x - (cx + 40)) * 1.15
      const kdy = y - (cy - 66)
      const kd = Math.hypot(kdx, kdy)
      if (kd < 26) {
        const ring = Math.sin(kd * 0.5) * 0.5 + 0.5
        const fall = Math.exp(-kd / 15)
        mul *= 1 - 0.13 * fall * (0.6 + ring * 0.4)
      }

      // bevel: raised rim lit top-left, shaded bottom-right. Numerical SDF normal.
      const inset = -s // >0 inside
      if (inset < bevel) {
        const nx = sdfAt(x + 1, y) - sdfAt(x - 1, y)
        const ny = sdfAt(x, y + 1) - sdfAt(x, y - 1)
        const nl = Math.hypot(nx, ny) || 1
        const ndl = (nx / nl) * L[0] + (ny / nl) * L[1] // -1..1
        const band = 1 - inset / bevel // 1 at rim → 0 inside
        const face = smooth(band)
        mul *= 1 + ndl * 0.4 * face // lit vs shaded rim
        // a crisp bright top-left rim highlight + dark bottom-right contact edge
        if (inset < 3) mul *= 1 + ndl * 0.22
      }

      // recessed face panel: an engraved plate — dark AO on its top-inner lip, a
      // faint lift on the bottom-inner lip = "pressed in", so the numeral reads
      // as carved. Only near the panel border, interior stays clean maple.
      const ps = roundRectSDF(x, y, cx, cy - 2, pHx, pHy, pR)
      if (ps > -6 && ps < 6) {
        const pnx = roundRectSDF(x + 1, y, cx, cy - 2, pHx, pHy, pR) - roundRectSDF(x - 1, y, cx, cy - 2, pHx, pHy, pR)
        const pny = roundRectSDF(x, y + 1, cx, cy - 2, pHx, pHy, pR) - roundRectSDF(x, y - 1, cx, cy - 2, pHx, pHy, pR)
        const pnl = Math.hypot(pnx, pny) || 1
        // groove: darken the outer wall (top-lit side) & lift the inner wall
        const gShade = ((pnx / pnl) * -L[0] + (pny / pnl) * -L[1]) * (1 - Math.abs(ps) / 6)
        mul *= 1 + gShade * 0.16
        mul *= 1 - (1 - Math.abs(ps) / 6) * 0.05 // slight overall recess darken
      }

      r *= mul
      g *= mul
      b *= mul

      // silhouette AA on the outer border
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
  writeFileSync(file('tile-wood.png'), buf)
  console.log('  ✓ tile-wood.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 2) THE OPERATOR PUCK — a small round carved-maple knob for + − × ÷ =. A domed
//    face, radial grain, bevelled rim, baked key light + AO, a shallow recessed
//    centre the CSS symbol engraves into. One puck serves all five symbols.
// ============================================================================
function bakePuck() {
  const S = 176
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(S, S)
  const d = img.data
  const c = S / 2
  const R = S * 0.46
  const nGrain = makeNoise(4820)
  const base = [214, 176, 120] // warm maple #d6b078
  const L = [-0.55, -0.68, 0.48] // key light, top-left-front
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      const dx = (x - c) / R
      const dy = (y - c) / R
      const r2 = dx * dx + dy * dy
      if (r2 > 1.02) {
        d[idx + 3] = 0
        continue
      }
      // dome normal (a gentle spherical cap)
      const nz = Math.sqrt(Math.max(0, 1 - r2 * 0.82))
      const nl = Math.hypot(dx * 0.55, dy * 0.55, nz) || 1
      const diff = clamp((dx * 0.55 * L[0] + dy * 0.55 * L[1] + nz * L[2]) / nl, 0, 1)
      let shade = 0.62 + diff * 0.5

      // radial + swirl grain
      const ang = Math.atan2(dy, dx)
      const rr = Math.sqrt(r2)
      const grain = nGrain(Math.cos(ang) * 3.4 + rr * 5.2, Math.sin(ang) * 3.4) * 0.55 + nGrain(rr * 14, ang * 2.4) * 0.4
      shade *= 1 + grain * 0.14

      // bevelled rim: bright lit arc top-left, dark contact bottom-right
      const edge = rr
      if (edge > 0.82) {
        const band = smooth((edge - 0.82) / 0.18)
        const rimLit = (dx * L[0] + dy * L[1]) / (Math.hypot(dx, dy) || 1)
        shade *= 1 + rimLit * 0.32 * band
        shade *= 1 - band * 0.12
      }

      // shallow recessed centre for the symbol (engraved plate)
      if (rr < 0.5) {
        const t = smooth(1 - rr / 0.5)
        shade *= 1 - t * 0.1
        // dark lip on the top of the recess, light lip on the bottom
        if (rr > 0.4) shade *= 1 - dy * 0.14 * ((rr - 0.4) / 0.1)
      }

      let a = 255
      if (rr > 0.97) a = clamp((1.02 - rr) / 0.05, 0, 1) * 255
      d[idx] = clamp(base[0] * shade, 0, 255)
      d[idx + 1] = clamp(base[1] * shade, 0, 255)
      d[idx + 2] = clamp(base[2] * shade, 0, 255)
      d[idx + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('op-puck.png'), buf)
  console.log('  ✓ op-puck.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 3) THE WORKBENCH — a warm varnished plank in gentle perspective: a receding
//    TOP surface (grain converging to the far end, lit pool near the child) and
//    a thick bevelled FRONT EDGE (grounding lip with AO). The tiles + friends
//    stand on the near top edge — the perspective + lip give real depth.
// ============================================================================
function bakeBench() {
  const W = 760
  const H = 380
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const CX = W / 2
  const FAR_Y = 24
  const NEAR_Y = 264 // where the top surface meets the front edge
  const farHalf = 224
  const nearHalf = 372
  const half = (f) => lerp(nearHalf, farHalf, f) // f: 0 near → 1 far
  const surfY = (f) => lerp(NEAR_Y, FAR_Y, f)

  // -- warm shadow under/behind the bench (fills the far corners) --
  ctx.fillStyle = '#2c1d0e'
  ctx.fillRect(0, 0, W, H)

  // -- the top surface (maple trapezoid, atmospherically darker far) --
  let g = ctx.createLinearGradient(0, NEAR_Y, 0, FAR_Y)
  g.addColorStop(0, '#d8b57e')
  g.addColorStop(0.6, '#c9a36c')
  g.addColorStop(1, '#a9854f')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineTo(CX + farHalf, FAR_Y)
  ctx.lineTo(CX - farHalf, FAR_Y)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // -- the front edge / apron (vertical grain, darker, AO at the bottom) --
  g = ctx.createLinearGradient(0, NEAR_Y, 0, H)
  g.addColorStop(0, '#c49a60')
  g.addColorStop(0.5, '#9c7743')
  g.addColorStop(1, '#6f5330')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf + 12, H)
  ctx.lineTo(CX - nearHalf - 12, H)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // ---- per-pixel material pass: grain on both faces + knots + sheen + AO ----
  const im = ctx.getImageData(0, 0, W, H)
  const dat = im.data
  const nFiber = makeNoise(3110)
  const nGrain = makeNoise(9004)
  const knots = [
    { x: CX - 150, y: 150, r: 24, s: 0.4 },
    { x: CX + 190, y: 120, r: 18, s: 0.34 },
    { x: CX + 40, y: 330, r: 20, s: 0.3 },
  ]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (dat[idx + 3] === 0) continue
      let mul = 1
      if (y < NEAR_Y) {
        // TOP surface: fraction along the recede, grain converging toward far
        const f = clamp((NEAR_Y - y) / (NEAR_Y - FAR_Y), 0, 1)
        const hh = half(f)
        const nx = (x - CX) / hh
        if (Math.abs(nx) > 1.02) continue
        const persp = nearHalf / hh
        const fib = nFiber(nx * 20 * (0.5 + persp * 0.5), (NEAR_Y - y) * 0.012 * persp) * 0.6 + nFiber(nx * 42, (NEAR_Y - y) * 0.03) * 0.4
        const drift = nGrain(nx * 3 + 7, f * 6) * 0.5
        mul *= 1 + fib * 0.1 + drift * 0.05
        // plank seams running toward the far end
        const seam = Math.abs(((nx + 1) * 3) % 1 - 0.5)
        if (seam > 0.46) mul *= 0.93
        // soft centre varnish sheen from the room light
        const sheen = Math.exp(-(nx * nx) / 0.22) * 0.12 * (0.4 + f * 0.6)
        mul *= 1 + sheen
      } else {
        // FRONT edge: vertical grain, darker, strong AO toward the bottom
        const nx = (x - CX) / nearHalf
        const fib = nFiber(nx * 30, (y - NEAR_Y) * 0.02) * 0.6 + nFiber(nx * 60 + 3, (y - NEAR_Y) * 0.05) * 0.4
        mul *= 1 + fib * 0.09
        const down = (y - NEAR_Y) / (H - NEAR_Y)
        mul *= 1 - down * 0.12 // bottom AO
      }
      // knots (screen-space, both faces)
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

  // -- crisp front lip: a lit highlight where the top meets the front edge --
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y)
  ctx.lineTo(CX + nearHalf, NEAR_Y)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 236, 200, 0.5)'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, NEAR_Y + 4)
  ctx.lineTo(CX + nearHalf, NEAR_Y + 4)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(60, 38, 16, 0.3)'
  ctx.stroke()

  // -- overhead warm light pool on the near-centre of the surface + corner vignette --
  g = ctx.createRadialGradient(CX, NEAR_Y - 30, 20, CX, NEAR_Y - 30, 340)
  g.addColorStop(0, 'rgba(255, 244, 214, 0.16)')
  g.addColorStop(1, 'rgba(255, 244, 214, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, NEAR_Y)
  g = ctx.createRadialGradient(CX, H * 0.5, H * 0.32, CX, H * 0.5, H * 0.8)
  g.addColorStop(0, 'rgba(30, 18, 8, 0)')
  g.addColorStop(1, 'rgba(30, 18, 8, 0.3)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(file('bench.jpg'), buf)
  console.log('  ✓ bench.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking build-a-number art →')
bakeTile()
bakePuck()
bakeBench()
console.log('Done.')
