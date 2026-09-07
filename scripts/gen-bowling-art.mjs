// Bakes the bowling scene's material art — a real varnished-maple LANE (in
// perspective, with gutters, pin deck, a contrasting foul line and the 7 dovetail
// aiming arrows) and a glossy resin BALL with finger holes + a baked highlight.
//
// Same pipeline as the coin-sort materials (public/art/sprites/coins): a
// node-canvas bake with seeded value-noise grain, a few ring knots, analytic
// varnish sheen and baked lighting/AO. No third-party assets — all original.
//
// One-off build tool. Needs @napi-rs/canvas (a prebuilt drop-in for node-canvas):
//   npm i --no-save @napi-rs/canvas && node scripts/gen-bowling-art.mjs
// (the dep is NOT kept permanently — reinstall it to regenerate.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/bowling/', import.meta.url)
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
// hash-based 2D value noise with smooth interpolation
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
    const lerp = (a, b, t) => a + t * (b - a)
    const x1 = lerp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerp(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)

// ============================================================================
// 1) THE LANE  — varnished maple, in perspective, baked lighting + markings
// ============================================================================
function bakeLane() {
  const W = 720
  const H = 960
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const CX = W / 2

  // perspective geometry (y grows downward)
  const WALL_H = 120 // arena back wall
  const FAR_Y = 150 // far end of the lane (behind the rack)
  const FOUL_Y = 848 // foul line — near end of the lane
  const farHalf = 96
  const nearHalf = 300
  const gutW = 46 // gutter width at the near end (shrinks with perspective)
  // frac 0 (near, FOUL_Y) → 1 (far, FAR_Y)
  const laneY = (f) => lerp(FOUL_Y, FAR_Y, f)
  const half = (f) => lerp(nearHalf, farHalf, f)
  const gut = (f) => lerp(gutW, gutW * (farHalf / nearHalf), f)

  // -- back arena wall (muted, one warm overhead glow) --
  let g = ctx.createLinearGradient(0, 0, 0, FAR_Y)
  g.addColorStop(0, '#2a2233')
  g.addColorStop(1, '#3b3048')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, FAR_Y + 2)
  // soft overhead light pool on the wall
  g = ctx.createRadialGradient(CX, FAR_Y, 10, CX, FAR_Y - 40, 260)
  g.addColorStop(0, 'rgba(255,238,205,0.30)')
  g.addColorStop(1, 'rgba(255,238,205,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, FAR_Y)
  // a soft crowd silhouette line on the horizon
  const crowd = mulberry32(77)
  for (let i = 0; i < 26; i++) {
    ctx.beginPath()
    ctx.arc(14 + i * 27, WALL_H - 6 + crowd() * 4, 9 + crowd() * 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(30,24,38,0.55)'
    ctx.fill()
  }

  // helper: fill a lane-space trapezoid (fracA..fracB across xL..xR offsets)
  const trap = (fa, fb, offAL, offAR, offBL, offBR, style) => {
    const ya = laneY(fa)
    const yb = laneY(fb)
    ctx.beginPath()
    ctx.moveTo(CX + offAL, ya)
    ctx.lineTo(CX + offAR, ya)
    ctx.lineTo(CX + offBR, yb)
    ctx.lineTo(CX + offBL, yb)
    ctx.closePath()
    ctx.fillStyle = style
    ctx.fill()
  }

  // -- gutters (recessed channels down each side, converging to the far end) --
  const gutterStyle = () => {
    const gg = ctx.createLinearGradient(0, FOUL_Y, 0, FAR_Y)
    gg.addColorStop(0, '#5f4022')
    gg.addColorStop(1, '#3c2814')
    return gg
  }
  // left gutter: outer edge of lane → outer edge + gutter width
  ctx.beginPath()
  ctx.moveTo(CX - half(0) - gut(0), FOUL_Y)
  ctx.lineTo(CX - half(0), FOUL_Y)
  ctx.lineTo(CX - half(1), FAR_Y)
  ctx.lineTo(CX - half(1) - gut(1), FAR_Y)
  ctx.closePath()
  ctx.fillStyle = gutterStyle()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(CX + half(0), FOUL_Y)
  ctx.lineTo(CX + half(0) + gut(0), FOUL_Y)
  ctx.lineTo(CX + half(1) + gut(1), FAR_Y)
  ctx.lineTo(CX + half(1), FAR_Y)
  ctx.closePath()
  ctx.fillStyle = gutterStyle()
  ctx.fill()

  // -- the lane bed (warm maple, atmospherically darker at the far end) --
  g = ctx.createLinearGradient(0, FOUL_Y, 0, FAR_Y)
  g.addColorStop(0, '#e2b878')
  g.addColorStop(0.55, '#d8ab6a')
  g.addColorStop(1, '#b98f52')
  trap(0, 1, -half(0), half(0), -half(1), half(1), g)

  // -- pin deck behind the rack: a lighter maple shelf on the far platform --
  g = ctx.createLinearGradient(0, FAR_Y + 60, 0, FAR_Y)
  g.addColorStop(0, '#e8cf9c')
  g.addColorStop(1, '#f0dcae')
  trap(0.72, 1, -half(0.72), half(0.72), -half(1), half(1), g)

  // -- the approach (below the foul line, nearest the child) — maple, a touch
  //    cooler so the foul line still reads; flares slightly wider than the lane --
  g = ctx.createLinearGradient(0, FOUL_Y, 0, H)
  g.addColorStop(0, '#d9ac6b')
  g.addColorStop(1, '#c6975590')
  ctx.beginPath()
  ctx.moveTo(CX - nearHalf, FOUL_Y)
  ctx.lineTo(CX + nearHalf, FOUL_Y)
  ctx.lineTo(CX + nearHalf + 34, H)
  ctx.lineTo(CX - nearHalf - 34, H)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()

  // ---- per-pixel material pass: 39 boards, grain fibers, knots, sheen, AO ----
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  const nGrain = makeNoise(1337)
  const nFiber = makeNoise(4242)
  const NBOARDS = 39
  // board tone jitter (per board, subtle)
  const boardJit = Array.from({ length: NBOARDS }, () => (mulberry32((Math.random() * 1e9) | 0)() - 0.5))
  const jr = mulberry32(909)
  for (let i = 0; i < NBOARDS; i++) boardJit[i] = (jr() - 0.5) * 0.14

  // knots (in lane fraction + normalized x across the lane)
  const knots = [
    { f: 0.24, nx: -0.55, r: 26, s: 0.5 },
    { f: 0.4, nx: 0.42, r: 20, s: 0.42 },
    { f: 0.6, nx: -0.18, r: 16, s: 0.36 },
    { f: 0.78, nx: 0.6, r: 13, s: 0.32 },
  ]

  for (let y = FAR_Y - 2; y < H; y++) {
    // lane fraction at this scanline (only meaningful within the bed)
    const f = clamp((FOUL_Y - y) / (FOUL_Y - FAR_Y), 0, 1)
    const hh = half(f)
    const persp = nearHalf / hh // >1 as we go far — compresses grain toward far
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const nx = (x - CX) / hh // -1..1 across the lane bed
      const inBed = y >= FAR_Y && Math.abs(nx) <= 1.0
      const onApproach = y >= FOUL_Y // approach area (below foul line) — still maple
      if (!inBed && !onApproach) continue

      // board index across the lane
      const b = Math.floor(((nx + 1) / 2) * NBOARDS)
      let mul = 1 + (boardJit[clamp(b, 0, NBOARDS - 1)] || 0)

      // grain fibers running LENGTHWISE (down the lane): high freq across x,
      // stretched along y, tightened by perspective toward the far end.
      const gx = nx * 26 * (0.6 + persp * 0.5)
      const gy = (FOUL_Y - y) * 0.010 * persp
      let fib = nFiber(gx * 1.7, gy * 3.0) * 0.6 + nFiber(gx * 3.6, gy * 6.0) * 0.4
      let grain = nGrain(gx * 0.9 + 11, gy * 0.5) * 0.5
      mul *= 1 + fib * 0.11 + grain * 0.05
      // subtle board seam grooves (dark line at each board boundary)
      const bf = ((nx + 1) / 2) * NBOARDS
      const seam = Math.abs(bf - Math.round(bf))
      if (seam < 0.06) mul *= 0.9 - (0.06 - seam) * 0.6

      // knots
      for (const k of knots) {
        const ky = laneY(k.f)
        const kx = CX + k.nx * half(k.f)
        const kr = k.r * lerp(1, farHalf / nearHalf, k.f)
        const dx = (x - kx) * (persp * 0.5 + 0.5)
        const dy = y - ky
        const dist = Math.hypot(dx, dy)
        if (dist < kr * 2.4) {
          const ring = Math.sin(dist * 0.9) * 0.5 + 0.5
          const fall = Math.exp(-dist / (kr * 0.9))
          mul *= 1 - k.s * fall * (0.5 + ring * 0.5)
        }
      }

      // varnish sheen: a soft specular band down the centre from the overhead
      // light (brightest near the mid-lane), plus overall glossy lift.
      const sheen = Math.exp(-(nx * nx) / 0.16) * (0.10 + 0.16 * (1 - Math.abs(f - 0.5) * 1.4))
      // far-end atmospheric darken + near vignette
      const atmo = 1 - (1 - f) * 0.0 - f * 0.05
      let addWhite = clamp(sheen, 0, 0.3) * 255

      // apply
      let r = d[idx] * mul * atmo + addWhite * 0.55
      let gg2 = d[idx + 1] * mul * atmo + addWhite * 0.5
      let bb2 = d[idx + 2] * mul * atmo + addWhite * 0.4
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(gg2, 0, 255)
      d[idx + 2] = clamp(bb2, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  // ---- markings drawn crisply ON TOP (vector) ----
  // gutter inner-wall highlight (lit rim where lane meets gutter)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,236,200,0.5)'
  ctx.beginPath()
  ctx.moveTo(CX - half(0), FOUL_Y)
  ctx.lineTo(CX - half(1), FAR_Y)
  ctx.moveTo(CX + half(0), FOUL_Y)
  ctx.lineTo(CX + half(1), FAR_Y)
  ctx.stroke()

  // the 7 dovetail aiming arrows, in a shallow V (centre arrow deepest/highest),
  // perspective-scaled, dark inlaid maple.
  const arrowBaseF = 0.34 // where the nearest (outer) arrows sit
  const drawArrow = (nxPos, f, sizeScale) => {
    const y = laneY(f)
    const hw = half(f)
    const ax = CX + nxPos * hw
    const s = 15 * lerp(1, farHalf / nearHalf, f) * sizeScale
    ctx.beginPath()
    ctx.moveTo(ax, y - s) // tip toward the pins (up)
    ctx.lineTo(ax + s * 0.7, y + s * 0.5)
    ctx.lineTo(ax - s * 0.7, y + s * 0.5)
    ctx.closePath()
    ctx.fillStyle = 'rgba(120,78,38,0.82)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(70,44,20,0.5)'
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
  // 7 arrows: pairs stepping deeper toward the centre (classic triangular set)
  const arrowCols = [
    { nx: -0.62, f: arrowBaseF },
    { nx: -0.42, f: arrowBaseF + 0.05 },
    { nx: -0.22, f: arrowBaseF + 0.1 },
    { nx: 0.0, f: arrowBaseF + 0.15 },
    { nx: 0.22, f: arrowBaseF + 0.1 },
    { nx: 0.42, f: arrowBaseF + 0.05 },
    { nx: 0.62, f: arrowBaseF },
  ]
  for (const a of arrowCols) drawArrow(a.nx, a.f, 1)

  // approach guide dots (two rows below the foul line)
  const dotRow = (yy, count) => {
    for (let i = 0; i < count; i++) {
      const t = (i - (count - 1) / 2) / ((count - 1) / 2)
      ctx.beginPath()
      ctx.arc(CX + t * nearHalf * 0.82, yy, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(90,58,28,0.6)'
      ctx.fill()
    }
  }
  dotRow(FOUL_Y + 40, 7)
  dotRow(FOUL_Y + 96, 5)

  // the foul line — a crisp contrasting band across the lane (kid navy)
  ctx.beginPath()
  ctx.moveTo(CX - half(0), FOUL_Y)
  ctx.lineTo(CX + half(0), FOUL_Y)
  ctx.lineWidth = 7
  ctx.strokeStyle = '#2f3a56'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(CX - half(0), FOUL_Y - 5)
  ctx.lineTo(CX + half(0), FOUL_Y - 5)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255,240,210,0.4)'
  ctx.stroke()

  // overhead light pool on the lane centre-far + gentle corner vignette
  g = ctx.createRadialGradient(CX, laneY(0.62), 30, CX, laneY(0.62), 320)
  g.addColorStop(0, 'rgba(255,244,215,0.16)')
  g.addColorStop(1, 'rgba(255,244,215,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, FAR_Y, W, H - FAR_Y)
  g = ctx.createRadialGradient(CX, H * 0.62, H * 0.25, CX, H * 0.62, H * 0.72)
  g.addColorStop(0, 'rgba(40,26,12,0)')
  g.addColorStop(1, 'rgba(40,26,12,0.28)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(file('lane.jpg'), buf)
  console.log('  ✓ lane.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 2) THE BALL — a glossy resin sphere, finger holes, baked highlight + AO
// ============================================================================
function bakeBall() {
  const S = 256
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(S, S)
  const d = img.data
  const R = S * 0.47
  const cx = S / 2
  const cy = S / 2
  // calm resin blue, lit from top-left
  const base = [39, 75, 150] // #274b96
  const deep = [18, 34, 74]
  const L = norm([-0.5, -0.62, 0.6]) // light direction
  // 3 finger holes near the top face (in sphere-normal space)
  const holes = [
    { nx: 0.0, ny: -0.5 },
    { nx: -0.2, ny: -0.28 },
    { nx: 0.22, ny: -0.26 },
  ]
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      const dx = (x - cx) / R
      const dy = (y - cy) / R
      const r2 = dx * dx + dy * dy
      if (r2 > 1) {
        d[idx + 3] = 0
        continue
      }
      const nz = Math.sqrt(1 - r2)
      const nrm = [dx, dy, nz]
      // Lambert + a touch of ambient
      let diff = clamp(dot(nrm, L), 0, 1)
      let shade = 0.32 + diff * 0.72
      // terminator/edge darkening (fresnel-ish rim) — but a soft rim light too
      const edge = 1 - nz // 0 centre → 1 rim
      shade *= 1 - edge * edge * 0.35
      let col = [
        lerp(deep[0], base[0], shade) + (base[0] * 0.4) * shade,
        lerp(deep[1], base[1], shade) + (base[1] * 0.2) * shade,
        lerp(deep[2], base[2], shade) + (base[2] * 0.15) * shade,
      ]
      // specular highlight (Blinn-Phong) — the baked gloss
      const Hdir = norm([L[0], L[1], L[2] + 1])
      const spec = Math.pow(clamp(dot(nrm, Hdir), 0, 1), 42)
      col[0] += spec * 220
      col[1] += spec * 225
      col[2] += spec * 235
      // a soft secondary sheen band lower-right (environment reflection)
      const rim = Math.pow(clamp(dot(nrm, norm([0.5, 0.5, 0.5])), 0, 1), 8)
      col[0] += rim * 26
      col[1] += rim * 30
      col[2] += rim * 40

      // finger holes: dark recessed pockets with inner AO
      let holeShade = 1
      for (const h of holes) {
        const hd = Math.hypot(dx - h.nx, dy - h.ny)
        const hr = 0.12
        if (hd < hr) {
          const t = smooth(clamp(1 - hd / hr, 0, 1))
          holeShade = Math.min(holeShade, 1 - t * 0.92)
          // a faint lip highlight on the top edge of the hole
          if (dy - h.ny < -hr * 0.55 && hd > hr * 0.6) col = col.map((c) => c + 30)
        }
      }
      col = col.map((c) => c * holeShade)

      let a = 255
      // anti-aliased alpha at the silhouette
      const rr = Math.sqrt(r2)
      if (rr > 0.97) a = clamp((1 - rr) / 0.03, 0, 1) * 255
      d[idx] = clamp(col[0], 0, 255)
      d[idx + 1] = clamp(col[1], 0, 255)
      d[idx + 2] = clamp(col[2], 0, 255)
      d[idx + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('ball.png'), buf)
  console.log('  ✓ ball.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// ============================================================================
// 3) THE PIN — a classic ten-pin. Ivory necked body (rounded crown, pinched
// neck, full belly, tapered base), TWO muted-red neck bands, baked CYLINDRICAL
// shading (solid-of-rotation normals, key light upper-left), a soft gloss streak,
// rim + neck + base ambient occlusion and a light material grain. The sprite's
// BOTTOM edge is the pin's BASE (feet) so the DOM pivots the topple about
// 50% 100%. NO drop shadow baked in — a flat CSS ellipse grounds each pin (so the
// contact shadow stays on the deck while the pin tips over).
// ============================================================================
function bakePin() {
  const W = 200
  const H = 300
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const CX = W / 2
  const TOP = 5
  const BOT = H - 2
  const BELLY = W * 0.4 // belly half-width in px (belly Ø = 160 of 200 → 20px margin)

  // pin PROFILE — [t (0 crown → 1 base), half-width as a fraction of BELLY].
  // Real ten-pin proportions: crown ~0.47, neck ~0.37, belly 1.0, base ~0.50.
  // DENSE points + LINEAR interp = a smooth silhouette (smoothstep-per-segment
  // would scallop the edge by forcing zero slope at every knot).
  const PROF = [
    [0.0, 0.0], [0.02, 0.22], [0.045, 0.36], [0.075, 0.44], [0.1, 0.47], // domed crown
    [0.125, 0.465], [0.155, 0.43], [0.19, 0.385], [0.225, 0.365], // pinched neck (narrowest)
    [0.26, 0.375], [0.3, 0.42], [0.36, 0.53], [0.44, 0.68], // shoulder
    [0.52, 0.82], [0.6, 0.92], [0.68, 0.99], [0.72, 1.0], // belly (widest)
    [0.78, 0.98], [0.84, 0.88], [0.89, 0.74], [0.93, 0.6], // waist
    [0.96, 0.51], [0.98, 0.49], [1.0, 0.5], // tapered base → flat foot
  ]
  const hwAt = (t) => {
    if (t <= 0) return PROF[0][1]
    if (t >= 1) return PROF[PROF.length - 1][1]
    for (let i = 1; i < PROF.length; i++) {
      if (t <= PROF[i][0]) {
        const a = PROF[i - 1]
        const b = PROF[i]
        return a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0])) // linear
      }
    }
    return PROF[PROF.length - 1][1]
  }

  const IV = [237, 232, 216] // muted ivory body (calm, not stark white)
  const IV_DK = [150, 138, 116] // shaded side of the ivory
  const RED = [190, 66, 60] // muted brick-red neck bands (not neon)
  const RED_DK = [120, 40, 40]
  const L = norm([-0.55, -0.32, 0.77]) // key light: upper-left, toward the viewer
  const grain = makeNoise(70718)

  for (let y = 0; y < H; y++) {
    const t = (y - TOP) / (BOT - TOP)
    const hw = t < 0 || t > 1 ? 0 : hwAt(t) * BELLY
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (hw <= 0.3) {
        d[idx + 3] = 0
        continue
      }
      const ax = Math.abs(x - CX)
      const cov = clamp(hw - ax + 0.5, 0, 1) // anti-aliased silhouette edge
      if (cov <= 0) {
        d[idx + 3] = 0
        continue
      }
      const u = (x - CX) / hw // -1..1 across the round body
      const nz = Math.sqrt(Math.max(0, 1 - u * u))
      const diff = clamp(dot([u, 0, nz], L), 0, 1)
      let shade = 0.3 + diff * 0.82
      shade *= 1 - clamp(t - 0.86, 0, 0.14) * 1.4 // base ambient occlusion
      shade *= 1 - Math.max(0, 0.16 - t) * 0.6 // slight crown-tip AO
      shade *= 1 - (1 - nz) * (1 - nz) * 0.3 // round-edge terminator AO
      shade *= 1 - Math.exp(-((t - 0.215) * (t - 0.215)) / 0.0016) * 0.1 // neck-pinch AO

      let col = [
        lerp(IV_DK[0], IV[0], shade),
        lerp(IV_DK[1], IV[1], shade),
        lerp(IV_DK[2], IV[2], shade),
      ]

      // two red neck bands, feathered, sharing the cylindrical shade
      for (const bc of [0.2775, 0.3375]) {
        const feather = smooth(clamp(1 - Math.abs(t - bc) / 0.024, 0, 1))
        if (feather > 0) {
          const band = [
            lerp(RED_DK[0], RED[0], shade),
            lerp(RED_DK[1], RED[1], shade),
            lerp(RED_DK[2], RED[2], shade),
          ]
          col = [
            lerp(col[0], band[0], feather),
            lerp(col[1], band[1], feather),
            lerp(col[2], band[2], feather),
          ]
        }
      }

      // baked gloss streak, left-of-centre, fading toward crown tip / base
      const gloss = Math.exp(-((u + 0.32) * (u + 0.32)) / 0.05) * (0.5 + 0.5 * Math.sin(t * Math.PI)) * 0.5
      col = col.map((c) => c + gloss * 90)

      // light material grain (kills any flat-vector read)
      const gm = 1 + (grain(x * 0.7, y * 0.7) * 0.5 + grain(x * 2.1, y * 2.1) * 0.5) * 0.03
      d[idx] = clamp(col[0] * gm, 0, 255)
      d[idx + 1] = clamp(col[1] * gm, 0, 255)
      d[idx + 2] = clamp(col[2] * gm, 0, 255)
      d[idx + 3] = cov * 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('pin.png'), buf)
  console.log('  ✓ pin.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking bowling art →')
bakeLane()
bakeBall()
bakePin()
console.log('Done.')
