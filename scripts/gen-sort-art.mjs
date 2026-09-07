// Bakes the "מיון" (colour-sort) materials — REAL woven baskets + glossy balls +
// a wooden table + a calm playroom backdrop, NOT flat CSS shapes+gradients.
//
// The star is a WOVEN WICKER BASKET (bucket.png): a truncated-cone bin seen
// slightly from ABOVE so its opening ellipse reads ("you can drop a ball in"),
// with an over-under basket weave on the body (horizontal reeds crossing vertical
// stakes, each reed lit like a little cylinder), a rolled reed rim, a dark AO'd
// inner hole, side/base ambient occlusion, seeded grain and a baked contact
// shadow so it rests on the table. It is baked in NEUTRAL grey luminance — the
// game tints each basket to its sort colour with a CSS `mix-blend-mode: color`
// wash (masked to the basket silhouette), so the baked weave/lighting survive and
// ONE sprite serves every colour. Same trick for the sortable BALL (ball.png): a
// baked glossy sphere, tinted to match its basket.
//
// The table (mat.jpg) is a muted WOODEN tabletop — real planks with seams,
// directional grain and soft knots, receding slightly with a lit near lip; the
// room (sorting-room.jpg, a SceneBackdrop image) is a calm low-contrast playroom
// wall so the coloured baskets pop without sensory noise.
//
// Same pipeline as the dice / coin-sort materials: an original @napi-rs/canvas
// bake with seeded value-noise grain and analytic baked lighting/AO. No
// third-party art. One-off build tool:
//   npm i --no-save @napi-rs/canvas && node scripts/gen-sort-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const SPR = new URL('../public/art/sprites/sort/', import.meta.url)
const BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(SPR, { recursive: true })
const sprFile = (name) => new URL(name, SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const bgFile = (name) => new URL(name, BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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
  const lerp = (a, b, t) => a + t * (b - a)
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
    const x1 = lerp(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerp(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerp(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const grain = makeNoise(20260718)

// material grain over every painted pixel (kills the "flat CSS" read)
function grainPass(ctx, S, amt = 0.045) {
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
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
// THE WOVEN BASKET — a truncated-cone wicker bin seen slightly from above, in
// neutral grey luminance (tinted to its sort colour by the CSS wash). The body
// carries a real over-under basket weave (horizontal reeds crossing vertical
// stakes, each reed lit like a little cylinder) baked with the key light from the
// top-left and AO to the right + base — so it reads as a premium tactile basket,
// NOT a smooth plastic pail. The weave contrast is kept gentle so the tinted
// colour still reads as ONE clear colour (the whole point of the game).
// Market survey: premium kids' sorting toys are woven wicker / natural baskets.
// ============================================================================
function bakeBucket() {
  const S = 256
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const base = [178, 174, 168] // neutral warm-grey — the colour wash rides this luminance
  const cx = 0.5 * S
  const rimCy = 0.25 * S
  const rimRx = 0.4 * S
  const rimRy = 0.118 * S
  const botCy = 0.85 * S
  const botRx = 0.285 * S
  const botRy = 0.075 * S

  // half-width of the cone at a given y (rim → base), for mapping x to an angle
  const halfAt = (y) => {
    const t = clamp((y - rimCy) / (botCy - rimCy), 0, 1)
    return lerp(rimRx, botRx, t)
  }

  // baked contact shadow on the table, under the basket
  ctx.save()
  ctx.translate(cx, botCy + botRy * 1.3)
  ctx.scale(1, 0.42)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rimRx * 1.08)
  sh.addColorStop(0, 'rgba(18,20,28,0.36)')
  sh.addColorStop(0.7, 'rgba(18,20,28,0.16)')
  sh.addColorStop(1, 'rgba(18,20,28,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, rimRx * 1.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const bodyPath = () => {
    ctx.beginPath()
    ctx.moveTo(cx - rimRx, rimCy)
    ctx.lineTo(cx - botRx, botCy)
    ctx.quadraticCurveTo(cx, botCy + botRy * 2.0, cx + botRx, botCy)
    ctx.lineTo(cx + rimRx, rimCy)
    ctx.quadraticCurveTo(cx, rimCy - rimRy * 2.2, cx - rimRx, rimCy)
    ctx.closePath()
  }

  // body base — key light from the left, AO on the right (cone form)
  bodyPath()
  let g = ctx.createLinearGradient(cx - rimRx, 0, cx + rimRx, 0)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.22)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, [40, 38, 44], 0.34)))
  ctx.fillStyle = g
  ctx.fill()

  // ── woven texture: paint it into the body via a clipped per-pixel pass ──
  // horizontal reeds (bandN rows) woven over vertical stakes (stakeN columns);
  // alternating cells shift the reed phase → the over-under basket look.
  ctx.save()
  bodyPath()
  ctx.clip()
  const bandN = 9 // horizontal reeds between rim and base
  const stakeN = 13 // vertical stakes around the visible front
  const bandH = (botCy - rimCy) / bandN
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = Math.floor(rimCy); y < Math.ceil(botCy + botRy * 2); y++) {
    const row = (y - rimCy) / bandH
    const rowI = Math.floor(row)
    const half = halfAt(y)
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      // angle across the cone front, -1 (left) … +1 (right)
      const u = clamp((x - cx) / Math.max(half, 1), -1.2, 1.2)
      const colPos = (u * 0.5 + 0.5) * stakeN // 0..stakeN across the front
      const colI = Math.floor(colPos)
      const over = ((rowI + colI) & 1) === 0
      // reed cross-section: bright centre, dark edge (a lain-down cylinder).
      // under-strands get a half-band phase shift so they dip behind the stakes.
      let frac = row - rowI
      if (!over) frac = (frac + 0.5) % 1
      const reed = Math.cos((frac - 0.5) * Math.PI) // 1 centre … 0 edge
      const gap = frac < 0.08 || frac > 0.92 ? -0.5 : 0 // dark groove between reeds
      // vertical stake shadow at each column seam
      const cFrac = colPos - colI
      const stake = Math.cos((cFrac - 0.5) * Math.PI) // 1 centre … 0 seam
      // foreshorten the weave toward the cone edges (stakes bunch up) → rounder
      const round = 0.82 + 0.18 * Math.cos(u * 0.9)
      const f = (0.9 + reed * 0.17 + gap * 0.12 + (stake - 0.5) * 0.1) * round
      d[idx] = clamp(d[idx] * f, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * f, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * f, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  // vertical AO pooling toward the base + a soft broad sheen (clipped to body)
  bodyPath()
  ctx.clip()
  g = ctx.createLinearGradient(0, rimCy, 0, botCy + botRy)
  g.addColorStop(0, 'rgba(255,255,255,0.08)')
  g.addColorStop(0.55, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(16,16,22,0.30)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const hl = ctx.createLinearGradient(cx - rimRx * 0.7, 0, cx - rimRx * 0.05, 0)
  hl.addColorStop(0, 'rgba(255,255,255,0)')
  hl.addColorStop(0.5, 'rgba(255,255,255,0.16)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hl
  ctx.fillRect(rimCy, rimCy, S, botCy - rimCy)
  ctx.restore()

  // woven RIM band (a rolled reed edge) — outer lit ellipse ring
  const rimOuter = () => ctx.ellipse(cx, rimCy, rimRx, rimRy, 0, 0, Math.PI * 2)
  ctx.beginPath()
  rimOuter()
  g = ctx.createLinearGradient(0, rimCy - rimRy, 0, rimCy + rimRy)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.34)))
  g.addColorStop(1, rgb(mix(base, [34, 32, 40], 0.24)))
  ctx.fillStyle = g
  ctx.fill()
  // little reed ticks around the rim so it reads as a wrapped/rolled edge
  ctx.save()
  ctx.beginPath()
  rimOuter()
  ctx.clip()
  const ticks = 30
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2
    const tx = cx + Math.cos(a) * rimRx
    const ty = rimCy + Math.sin(a) * rimRy
    ctx.beginPath()
    ctx.ellipse(tx, ty, rimRx * 0.055, rimRy * 0.9, a, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'
    ctx.fill()
  }
  ctx.restore()

  // inner opening — a dark AO'd hole so the basket reads OPEN
  ctx.beginPath()
  ctx.ellipse(cx, rimCy + rimRy * 0.14, rimRx * 0.79, rimRy * 0.79, 0, 0, Math.PI * 2)
  const hole = ctx.createRadialGradient(cx, rimCy - rimRy * 0.2, rimRy * 0.2, cx, rimCy + rimRy * 0.25, rimRx * 0.8)
  hole.addColorStop(0, 'rgba(44,42,48,1)')
  hole.addColorStop(0.6, 'rgba(30,29,34,1)')
  hole.addColorStop(1, 'rgba(19,18,22,1)')
  ctx.fillStyle = hole
  ctx.fill()
  // the back inner wall catches a little light (woven interior hint)
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, rimCy + rimRy * 0.14, rimRx * 0.79, rimRy * 0.79, 0, 0, Math.PI * 2)
  ctx.clip()
  const cl = ctx.createLinearGradient(0, rimCy - rimRy * 0.7, 0, rimCy + rimRy * 0.1)
  cl.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.14), 0.5))
  cl.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = cl
  ctx.fillRect(0, 0, S, S)
  ctx.restore()

  // bright bevel on the lit (top-left) arc of the rim
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, rimCy, rimRx, rimRy, 0, Math.PI * 0.86, Math.PI * 1.66)
  ctx.lineWidth = S * 0.012
  ctx.strokeStyle = 'rgba(255,255,255,0.42)'
  ctx.stroke()
  ctx.restore()

  grainPass(ctx, S, 0.05)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('bucket.png'), buf)
  console.log('  ✓ bucket.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SORTABLE BALL — a glossy sphere, neutral grey luminance (tinted by CSS)
// ============================================================================
function bakeBall() {
  const S = 192
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const base = [180, 180, 186]
  const cx = 0.5 * S
  const cy = 0.48 * S
  const r = 0.42 * S

  // body — radial shading toward the bottom-right (light comes top-left)
  const g = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.12, cx + r * 0.2, cy + r * 0.28, r * 1.25)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.42)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(0.85, rgb(mix(base, [40, 44, 56], 0.28)))
  g.addColorStop(1, rgb(mix(base, [24, 28, 40], 0.5)))
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()

  // bottom ambient occlusion crescent + top-left specular highlight (clipped)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const ao = ctx.createRadialGradient(cx + r * 0.24, cy + r * 0.5, r * 0.1, cx + r * 0.24, cy + r * 0.5, r * 0.9)
  ao.addColorStop(0, 'rgba(18,20,30,0.26)')
  ao.addColorStop(1, 'rgba(18,20,30,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, 0, S, S)
  const spec = ctx.createRadialGradient(cx - r * 0.36, cy - r * 0.4, 0, cx - r * 0.36, cy - r * 0.4, r * 0.5)
  spec.addColorStop(0, 'rgba(255,255,255,0.62)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spec
  ctx.fillRect(0, 0, S, S)
  ctx.restore()

  grainPass(ctx, S, 0.04)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('ball.png'), buf)
  console.log('  ✓ ball.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE TABLE — a real WOODEN tabletop: muted warm planks with visible seams and
// directional grain (like the coin-sort board / pattern tray), receding slightly
// (shaded far edge, lit near lip). Muted/soft so the coloured baskets pop; NOT a
// flat CSS gradient.
// ============================================================================
function bakeMat() {
  const W = 720
  const H = 420
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // muted, greyed warm wood (soft oak) — calm, lets colour bins pop
  const near = [198, 174, 141]
  const far = [158, 137, 108]
  const seam = [96, 78, 56]

  // receding base wash: far (top) darker, near (bottom) lighter
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb(far))
  g.addColorStop(0.55, rgb(mix(far, near, 0.62)))
  g.addColorStop(1, rgb(near))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // ── vertical planks with directional grain (grain runs along the plank) ──
  const planks = 5
  const plankW = W / planks
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const pi = Math.floor(x / plankW)
      const off = pi * 37.3 // each plank samples the noise field elsewhere
      // grain streaks stretched vertically (fine across x, long along y)
      const streak =
        grain((x + off) * 0.16, y * 0.012) * 0.6 +
        grain((x + off) * 0.5, y * 0.03) * 0.28 +
        grain((x + off) * 1.5, y * 0.09) * 0.16
      let m = 1 + streak * 0.11
      // darken toward each plank seam (a soft chamfer) + a crisp seam line
      const inP = x / plankW - pi // 0..1 within the plank
      const edge = Math.min(inP, 1 - inP)
      if (edge < 0.045) m *= 0.9 - (0.045 - edge) * 2.2
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  // crisp seam lines between planks
  for (let p = 1; p < planks; p++) {
    const sx = p * plankW
    const sg = ctx.createLinearGradient(sx - 2, 0, sx + 2, 0)
    sg.addColorStop(0, 'rgba(0,0,0,0)')
    sg.addColorStop(0.5, rgb(seam, 0.5))
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sg
    ctx.fillRect(sx - 2, 0, 4, H)
    // a hair of highlight on the near-lit side of the seam
    ctx.fillStyle = 'rgba(255,244,220,0.10)'
    ctx.fillRect(sx + 2, 0, 1, H)
  }

  // a couple of soft knots
  const knots = [
    [W * 0.28, H * 0.34, 10],
    [W * 0.63, H * 0.7, 13],
    [W * 0.82, H * 0.22, 8],
  ]
  for (const [kx, ky, kr] of knots) {
    const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr)
    kg.addColorStop(0, rgb(seam, 0.42))
    kg.addColorStop(0.6, rgb(seam, 0.16))
    kg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = kg
    ctx.beginPath()
    ctx.ellipse(kx, ky, kr, kr * 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // soft warm light pool toward the near-centre
  g = ctx.createRadialGradient(W * 0.5, H * 0.84, H * 0.05, W * 0.5, H * 0.84, W * 0.6)
  g.addColorStop(0, 'rgba(255,238,208,0.18)')
  g.addColorStop(1, 'rgba(255,238,208,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // lit near lip + soft vignette on the sides
  g = ctx.createLinearGradient(0, H * 0.9, 0, H)
  g.addColorStop(0, 'rgba(255,238,208,0)')
  g.addColorStop(0.5, 'rgba(255,242,216,0.26)')
  g.addColorStop(1, 'rgba(104,82,54,0.24)')
  ctx.fillStyle = g
  ctx.fillRect(0, H * 0.9, W, H * 0.1)
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.55, H * 0.32, W * 0.5, H * 0.55, W * 0.62)
  vg.addColorStop(0, 'rgba(52,38,22,0)')
  vg.addColorStop(1, 'rgba(52,38,22,0.22)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 84)
  writeFileSync(sprFile('mat.jpg'), buf)
  console.log('  ✓ mat.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE ROOM — a calm, low-contrast playroom wall (SceneBackdrop image)
// ============================================================================
function bakeRoom() {
  const W = 1000
  const H = 720
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  // wall — a gentle warm vertical wash, brighter up top (soft daylight)
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgb([238, 227, 205]))
  g.addColorStop(0.5, rgb([227, 210, 183]))
  g.addColorStop(0.66, rgb([220, 202, 174]))
  g.addColorStop(1, rgb([208, 189, 160]))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // soft window glow, upper area, off-centre — barely there (calm)
  g = ctx.createRadialGradient(W * 0.72, H * 0.2, 0, W * 0.72, H * 0.2, W * 0.55)
  g.addColorStop(0, 'rgba(255,250,232,0.28)')
  g.addColorStop(1, 'rgba(255,250,232,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // a quiet wainscot: a slim molding line with a faintly warmer panel below it
  const wy = H * 0.66
  g = ctx.createLinearGradient(0, wy, 0, H)
  g.addColorStop(0, 'rgba(196,178,150,0.0)')
  g.addColorStop(0.04, 'rgba(150,130,102,0.28)') // the molding shadow line
  g.addColorStop(0.09, 'rgba(236,224,202,0.35)') // molding highlight
  g.addColorStop(0.12, 'rgba(210,192,164,0.0)')
  ctx.fillStyle = g
  ctx.fillRect(0, wy, W, H - wy)

  // fine wall grain
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const n = grain(x * 0.4, y * 0.4) * 0.6 + grain(x * 1.5, y * 1.5) * 0.4
      const m = 1 + n * 0.028
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  // gentle corner vignette to settle the frame
  g = ctx.createRadialGradient(W * 0.5, H * 0.44, H * 0.35, W * 0.5, H * 0.5, W * 0.7)
  g.addColorStop(0, 'rgba(70,52,32,0)')
  g.addColorStop(1, 'rgba(70,52,32,0.18)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('sorting-room.jpg'), buf)
  console.log('  ✓ bg/sorting-room.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking sort art →')
bakeBucket()
bakeBall()
bakeMat()
bakeRoom()
console.log('Done.')
