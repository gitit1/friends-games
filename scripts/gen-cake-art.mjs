// Bakes the "מכינים עוגה" (cake-maker) MATERIALS as raster art with baked soft
// lighting, texture and AO — so the cake reads as a real baked sponge cake on a
// stand, NOT CSS shapes on a gradient:
//   layer-*.png  — a SPONGE tier: a shallow cylinder seen slightly from above (a
//                  camera angle = real depth). A lit CREAM filling lip along the
//                  top (the frosting between layers), a sponge BODY with cross-
//                  section curvature shading + dense crumb texture, a scalloped
//                  cream OOZE at the front bottom seam and bottom AO. One per
//                  flavour (vanilla / choc / straw / lemon), muted crumb palettes.
//   crown.png    — a soft ivory FROSTING dome that caps the top tier, with a
//                  scalloped drip skirt and a matte upper-left catch-light.
//   cherry.png   — a glossy muted cherry sphere + a curved stem.
//   strawberry.png — a berry with baked seed dimples + a green calyx.
//   candle.png   — a spiral-striped candle with a wick + a soft teardrop flame.
//   sprinkles.png — a scattered band of little baked sprinkle capsules (muted).
//   plate.png    — a ceramic CAKE STAND seen at a camera angle (elliptical top,
//                  a stem + base foot) with a baked contact shadow → grounds the
//                  cake (depth doctrine).
//
// Key light is baked upper-LEFT (physical — it does NOT mirror in RTL/LTR, same
// rule as the friends). Muted / appetising-but-calm palette (sensory rule).
//
// Same pipeline as the ice-cream / coin-sort materials: a node-canvas bake with
// seeded value-noise, analytic shading and baked AO. No third-party assets.
//
// One-off build tool. Needs @napi-rs/canvas (already pinned):
//   node scripts/gen-cake-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/cake/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the crumb / grain generator -----------------
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
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const sstep = (e0, e1, x) => smooth((x - e0) / (e1 - e0))
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]

// ============================================================================
// THE SPONGE TIER — a shallow cylinder seen slightly from above. A lit CREAM
// filling lip along its top (the frosting between layers), a sponge BODY with
// cross-section curvature shading + crumb, a scalloped cream OOZE at the front
// bottom seam, and bottom AO. Stacks with a negative margin so each tier's cream
// lip reads as the filling and the top tier shows its cut top.
// ============================================================================
const nCrumb = makeNoise(70118)
const nFine = makeNoise(51424)
function bakeLayer(spongeLo, spongeHi, name) {
  const W = 240
  const H = 76
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const imgd = ctx.createImageData(W, H)
  const d = imgd.data
  const cx = W / 2
  const rx = W / 2 - 12 // body half-width
  const lipCy = H * 0.19 // centre of the cream top-lip ellipse
  const lipRy = rx * 0.095 // its (flattened) vertical radius — a THIN filling line
  const bodyBot = H * 0.86 // front-centre of the bottom rim
  const botRy = rx * 0.09
  const cream = [245, 237, 218] // ivory frosting/filling (warm, not glaring)
  const L0 = -0.5

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const u = (x - cx) / rx // -1..1 across the drum
      if (Math.abs(u) > 1.001) {
        d[idx + 3] = 0
        continue
      }
      const curve = Math.sqrt(Math.max(0, 1 - u * u)) // 1 centre → 0 side
      const eh = lipRy * curve // top-lip ellipse half-height at this column
      const bh = botRy * curve // bottom-rim ellipse half-height
      const lipY0 = lipCy - eh
      const bodyY1 = bodyBot + bh
      if (y < lipY0 - 0.5 || y > bodyY1 + 0.6) {
        d[idx + 3] = 0
        continue
      }
      let r, g, b
      const cov = clamp((1.02 - Math.abs(u)) / 0.05, 0, 1) // AA the vertical sides
      if (y <= lipCy + eh) {
        // ── CREAM TOP LIP (the frosting between layers / the cut top) ──
        const ty = (y - lipCy) / (lipRy || 1)
        let mul = 0.9 + (-ty) * 0.14 + (-u) * 0.06 * curve // lit toward front + left
        mul += Math.max(0, curve - 0.2) * 0.12 // domed centre catch-light
        mul *= 1 + nFine(u * 6, y * 0.4) * 0.04
        r = cream[0] * mul
        g = cream[1] * mul
        b = cream[2] * mul
        // a soft contact shade where the lip meets the body (front underside)
        const under = sstep(lipCy + eh * 0.2, lipCy + eh, y)
        r *= 1 - under * 0.14
        g *= 1 - under * 0.14
        b *= 1 - under * 0.14
      } else {
        // ── SPONGE BODY (cylinder side) — the hero of the tier ──
        const t = clamp((y - (lipCy + eh)) / (bodyBot - lipCy), 0, 1) // 0 top → 1 bottom
        let mul = 0.46 + curve * 0.5 // cross-section curvature (real cylinder), calmer centre
        mul *= 1 + (-u) * 0.12 * curve * (1 + L0 * 0 + 1) * 0.5 // upper-left key bias
        // crumb texture — soft pores at two scales, clearly visible = real sponge
        const crumb = nCrumb(u * 5 + 4, y * 0.16) * 0.62 + nFine(u * 11, y * 0.34) * 0.38
        mul *= 1 + crumb * 0.13
        const bc = mix(spongeLo, spongeHi, sstep(0, 1, t) * 0.7 + crumb * 0.12)
        r = bc[0] * mul
        g = bc[1] * mul
        b = bc[2] * mul
        // a THIN scalloped cream ooze right at the front bottom seam (filling)
        const oozeTop = bodyBot - H * 0.12
        if (y > oozeTop) {
          const oz = sstep(oozeTop, bodyBot - H * 0.02, y)
          const scal = 0.5 + 0.5 * Math.sin(u * 9.5 + 0.6)
          const amt = oz * (0.35 + 0.45 * scal)
          const cmul = 0.86 + curve * 0.4 + (-u) * 0.06 * curve
          r = lerp(r, cream[0] * cmul, amt)
          g = lerp(g, cream[1] * cmul, amt)
          b = lerp(b, cream[2] * cmul, amt)
        }
        // bottom AO along the very base
        const ao = sstep(bodyBot - H * 0.05, bodyY1, y)
        r *= 1 - ao * 0.28
        g *= 1 - ao * 0.28
        b *= 1 - ao * 0.28
      }
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(g, 0, 255)
      d[idx + 2] = clamp(b, 0, 255)
      d[idx + 3] = Math.round(255 * cov)
    }
  }
  ctx.putImageData(imgd, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE FROSTING CROWN — a soft ivory dome capping the top tier, with a scalloped
// drip skirt and a matte upper-left catch-light. Transparent body.
// ============================================================================
function bakeCrown() {
  const W = 240
  const H = 108
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const imgd = ctx.createImageData(W, H)
  const d = imgd.data
  const cx = W / 2
  const rx = W / 2 - 12 // ~108 half-width
  const domeCy = H * 0.42 // centre of the SHALLOW top mound
  const ryTop = rx * 0.34 // shallow dome (wide, low = poured frosting, not a ball)
  const nLump = makeNoise(3021)
  const cream = [251, 245, 231]
  const shade = [182, 162, 134]

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const dx = (x - cx) / rx
      if (Math.abs(dx) > 1.0) {
        d[idx + 3] = 0
        continue
      }
      const curve = Math.sqrt(Math.max(0, 1 - dx * dx)) // 1 centre → 0 side
      const capTop = domeCy - ryTop * curve // upper cap outline
      const frontRim = domeCy + ryTop * curve // front rim of the mound
      // hanging DRIP tongues along the front (rounded, varying lengths)
      const tongue = 30 * Math.pow(Math.max(0, Math.sin(dx * 7.3 + 0.6)), 1.6)
      const baseline = frontRim + 5 + tongue
      if (y < capTop - 0.5 || y > baseline + 0.6) {
        d[idx + 3] = 0
        continue
      }
      let net
      if (y <= frontRim) {
        // ── TOP MOUND surface (domed, matte, lit upper-left) ──
        const dyt = (y - domeCy) / ryTop
        const nz = Math.sqrt(Math.max(0.0001, 1 - Math.min(1, dx * dx + dyt * dyt)))
        const bright = dx * -0.5 + dyt * -0.66 + nz * 0.6
        net = 0.54 + bright * 0.36
        const hd = Math.hypot(dx + 0.34, dyt + 0.4)
        net += Math.max(0, 1 - hd / 0.9) * 0.24 // catch-light
        net += nLump(dx * 3 + 2, dyt * 3) * 0.055 // soft lumps
      } else {
        // ── DRIP SKIRT down the front (cylinder side shading + tip AO) ──
        const t = (y - frontRim) / (baseline - frontRim + 0.001) // 0 rim → 1 tip
        net = 0.5 + curve * 0.34 + (-dx) * 0.1 * curve
        net -= t * 0.2 // AO toward the drip tip
        net += nLump(dx * 4, y * 0.06) * 0.05
      }
      const c = mix(shade, cream, clamp(net, 0, 1))
      // anti-alias the outline
      const distTop = y - capTop
      const distBot = baseline - y
      const cov = clamp(Math.min(distTop, distBot, 1.2) / 1.2, 0, 1)
      d[idx] = clamp(c[0], 0, 255)
      d[idx + 1] = clamp(c[1], 0, 255)
      d[idx + 2] = clamp(c[2], 0, 255)
      d[idx + 3] = Math.round(255 * cov)
    }
  }
  ctx.putImageData(imgd, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('crown.png'), buf)
  console.log('  ✓ crown.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- a shaded sphere/berry helper (matte-ish with a small specular) ----------
function shadeSphere(d, W, H, cx, cy, rx, ry, base, opts = {}) {
  const { spec = 0.5, seedN = null, seedAmt = 0.05, wob = 0, wobFreq = 6, matte = 0.42 } = opts
  const nn = seedN != null ? makeNoise(seedN) : null
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      const a0 = Math.atan2(dy, dx)
      const w = 1 + wob * Math.sin(a0 * wobFreq)
      const ex = dx / w
      const ey = dy / w
      const r2 = ex * ex + ey * ey
      if (r2 > 1.0) continue
      if (d[idx + 3] > 0) {
        /* keep existing (e.g. stem drawn first) unless we're clearly inside */
      }
      const nz = Math.sqrt(Math.max(0.0001, 1 - r2))
      const bright = ex * -0.5 + ey * -0.62 + nz * 0.62
      let mul = 0.5 + bright * matte
      // specular highlight upper-left
      const hd = Math.hypot(ex + 0.36, ey + 0.42)
      mul += Math.max(0, 1 - hd / 0.5) * spec
      // bottom AO
      mul -= Math.max(0, ey - 0.2) * 0.22
      if (nn) mul *= 1 + nn(ex * 5, ey * 5) * seedAmt
      const cov = clamp((1.0 - r2) / 0.06, 0, 1)
      const r = base[0] * mul
      const g = base[1] * mul
      const b = base[2] * mul
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(g, 0, 255)
      d[idx + 2] = clamp(b, 0, 255)
      d[idx + 3] = Math.round(255 * cov)
    }
  }
}

// ============================================================================
// CHERRY — a glossy muted-red sphere + a curved brown stem.
// ============================================================================
function bakeCherry() {
  const W = 92
  const H = 108
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  // stem first (behind the fruit top)
  ctx.strokeStyle = '#6f5030'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(W * 0.52, H * 0.62)
  ctx.quadraticCurveTo(W * 0.72, H * 0.28, W * 0.6, H * 0.08)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,240,210,0.4)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(W * 0.52, H * 0.62)
  ctx.quadraticCurveTo(W * 0.72, H * 0.28, W * 0.6, H * 0.08)
  ctx.stroke()
  const imgd = ctx.getImageData(0, 0, W, H)
  shadeSphere(imgd.data, W, H, W * 0.46, H * 0.64, W * 0.4, H * 0.34, [176, 58, 74], {
    spec: 0.6,
    seedN: 771,
    seedAmt: 0.04,
  })
  ctx.putImageData(imgd, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('cherry.png'), buf)
  console.log('  ✓ cherry.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// STRAWBERRY — a rounded-cone berry with baked seed dimples + a green calyx.
// ============================================================================
function bakeStrawberry() {
  const W = 96
  const H = 116
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const imgd = ctx.createImageData(W, H)
  const d = imgd.data
  const cx = W / 2
  const cyTop = H * 0.34
  const bodyH = H * 0.56
  const halfTop = W * 0.42
  const base = [206, 74, 84]
  const baseDk = [150, 44, 58]
  const nSeed = makeNoise(9090)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const t = (y - cyTop) / bodyH // 0 shoulder → 1 tip
      if (t < 0 || t > 1.04) continue
      // width tapers to a rounded tip
      const hw = halfTop * (1 - t * t * 0.82)
      const u = (x - cx) / (hw || 1)
      if (Math.abs(u) > 1.02) continue
      const curve = Math.sqrt(Math.max(0, 1 - u * u))
      let mul = 0.52 + curve * 0.56
      mul *= 1 + (-u) * 0.12 * curve
      mul *= 1 - t * 0.12
      // spec
      const hd = Math.hypot(u + 0.4, (t - 0.25) * 1.6)
      mul += Math.max(0, 1 - hd / 0.7) * 0.4
      // SEED dimples — a staggered grid, each a lit pip in a shaded pit
      const sv = Math.sin((u * 3.4 + t * 9) * Math.PI) * Math.sin((u * 3.4 - t * 9) * Math.PI)
      const seed = Math.max(0, sv)
      mul *= 1 - seed * 0.22 * curve
      const col = mix(base, baseDk, t * 0.5)
      let r = col[0] * mul
      let g = col[1] * mul
      let b = col[2] * mul
      // seed speck (pale) at the pip centres
      if (seed > 0.72) {
        r = lerp(r, 235, 0.5)
        g = lerp(g, 214, 0.5)
        b = lerp(b, 150, 0.5)
      }
      r *= 1 + nSeed(u * 4, t * 6) * 0.03
      const cov = clamp((1.02 - Math.abs(u)) / 0.05, 0, 1)
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(g, 0, 255)
      d[idx + 2] = clamp(b, 0, 255)
      d[idx + 3] = Math.round(255 * cov)
    }
  }
  ctx.putImageData(imgd, 0, 0)
  // green calyx (leaves) on the shoulder
  ctx.save()
  ctx.translate(cx, cyTop + 2)
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5
    ctx.save()
    ctx.rotate(a)
    const g = ctx.createLinearGradient(0, 0, 0, -H * 0.16)
    g.addColorStop(0, '#5f8f4c')
    g.addColorStop(1, '#84b46a')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-4, 0)
    ctx.quadraticCurveTo(-3, -H * 0.14, 0, -H * 0.18)
    ctx.quadraticCurveTo(3, -H * 0.14, 4, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('strawberry.png'), buf)
  console.log('  ✓ strawberry.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// CANDLE — a spiral-striped waxy cylinder + a wick + a soft teardrop flame.
// ============================================================================
function bakeCandle() {
  const W = 64
  const H = 150
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const imgd = ctx.createImageData(W, H)
  const d = imgd.data
  const cx = W / 2
  const bodyTop = H * 0.32
  const bodyBot = H * 0.96
  const halfW = W * 0.24
  const wax = [244, 233, 244]
  const stripe = [222, 150, 178]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      if (y < bodyTop || y > bodyBot) continue
      const u = (x - cx) / halfW
      if (Math.abs(u) > 1.02) continue
      const curve = Math.sqrt(Math.max(0, 1 - u * u))
      let mul = 0.56 + curve * 0.5
      mul *= 1 + (-u) * 0.14 * curve
      // diagonal spiral stripe
      const s = Math.sin((u * 1.6 + y * 0.14) * Math.PI)
      const c = mix(wax, stripe, s > 0.2 ? 0.85 : 0)
      const cov = clamp((1.02 - Math.abs(u)) / 0.06, 0, 1)
      d[idx] = clamp(c[0] * mul, 0, 255)
      d[idx + 1] = clamp(c[1] * mul, 0, 255)
      d[idx + 2] = clamp(c[2] * mul, 0, 255)
      d[idx + 3] = Math.round(255 * cov)
    }
  }
  ctx.putImageData(imgd, 0, 0)
  // wick
  ctx.strokeStyle = '#4a3a30'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, bodyTop)
  ctx.lineTo(cx, bodyTop - H * 0.05)
  ctx.stroke()
  // flame — a soft teardrop glow (muted amber, calm)
  const fy = bodyTop - H * 0.11
  const glow = ctx.createRadialGradient(cx, fy, 1, cx, fy, H * 0.14)
  glow.addColorStop(0, 'rgba(255,236,190,0.9)')
  glow.addColorStop(0.5, 'rgba(240,184,102,0.5)')
  glow.addColorStop(1, 'rgba(240,184,102,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(cx, fy, H * 0.05, H * 0.09, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff3d6'
  ctx.beginPath()
  ctx.ellipse(cx, fy + 2, H * 0.02, H * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('candle.png'), buf)
  console.log('  ✓ candle.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// SPRINKLES — a scattered band of little baked capsules (muted rainbow). Laid as
// an overlay across the top of the cake.
// ============================================================================
function bakeSprinkles() {
  const W = 220
  const H = 76
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const rnd = mulberry32(4242)
  const cols = [
    [214, 122, 138],
    [230, 200, 118],
    [150, 194, 156],
    [148, 176, 216],
    [190, 158, 214],
    [236, 172, 140],
  ]
  const cx = W / 2
  const cy = H * 0.52
  for (let i = 0; i < 30; i++) {
    // scatter within an ellipse (matches the cake top)
    let px, py
    do {
      px = (rnd() * 2 - 1)
      py = (rnd() * 2 - 1)
    } while (px * px + py * py > 1)
    const x = cx + px * (W * 0.44)
    const y = cy + py * (H * 0.4)
    const ang = rnd() * Math.PI
    const len = 9 + rnd() * 4
    const col = cols[(rnd() * cols.length) | 0]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(ang)
    // capsule body
    const g = ctx.createLinearGradient(0, -3, 0, 3)
    g.addColorStop(0, `rgb(${Math.min(255, col[0] + 40)},${Math.min(255, col[1] + 40)},${Math.min(255, col[2] + 40)})`)
    g.addColorStop(1, `rgb(${col[0]},${col[1]},${col[2]})`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(-len / 2, -2.6, len, 5.2, 2.6)
    ctx.fill()
    // tiny top catch-light
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.roundRect(-len / 2 + 1.5, -2.0, len - 3, 1.4, 0.7)
    ctx.fill()
    ctx.restore()
  }
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('sprinkles.png'), buf)
  console.log('  ✓ sprinkles.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// PLATE — a ceramic CAKE STAND at a camera angle: an elliptical lit top, a rim,
// a stem + base foot, and a baked contact shadow → grounds the cake (depth).
// ============================================================================
function bakePlate() {
  const W = 300
  const H = 132
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const topCy = H * 0.3
  const rx = W / 2 - 10
  const ry = rx * 0.22
  // baked contact shadow on the table
  const sh = ctx.createRadialGradient(cx, H * 0.86, 4, cx, H * 0.86, rx * 0.9)
  sh.addColorStop(0, 'rgba(40,28,20,0.3)')
  sh.addColorStop(0.6, 'rgba(40,28,20,0.16)')
  sh.addColorStop(1, 'rgba(40,28,20,0)')
  ctx.save()
  ctx.translate(0, 0)
  ctx.scale(1, 0.34)
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.ellipse(cx, H * 0.86 / 0.34, rx * 0.86, rx * 0.86, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ---- base foot (ellipse) ----
  const footCy = H * 0.86
  const footRx = rx * 0.42
  const footRy = footRx * 0.28
  let g = ctx.createLinearGradient(0, footCy - footRy, 0, footCy + footRy)
  g.addColorStop(0, '#eae4da')
  g.addColorStop(1, '#c3bab0')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(cx, footCy, footRx, footRy, 0, 0, Math.PI * 2)
  ctx.fill()

  // ---- stem (trapezoid) ----
  g = ctx.createLinearGradient(cx - 20, 0, cx + 20, 0)
  g.addColorStop(0, '#e7e1d7')
  g.addColorStop(0.5, '#f2ede4')
  g.addColorStop(1, '#cfc7bc')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx - rx * 0.1, topCy + ry * 0.6)
  ctx.lineTo(cx + rx * 0.1, topCy + ry * 0.6)
  ctx.lineTo(cx + footRx * 0.6, footCy - footRy * 0.5)
  ctx.lineTo(cx - footRx * 0.6, footCy - footRy * 0.5)
  ctx.closePath()
  ctx.fill()

  // ---- the top plate: underside rim then lit top face ----
  // underside (darker) slightly below to give thickness
  g = ctx.createLinearGradient(0, topCy, 0, topCy + ry + 8)
  g.addColorStop(0, '#c8bfb4')
  g.addColorStop(1, '#a99f93')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(cx, topCy + 6, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  // top face (lit ceramic)
  g = ctx.createRadialGradient(cx - rx * 0.3, topCy - ry * 0.5, 4, cx, topCy, rx)
  g.addColorStop(0, '#fbf7f0')
  g.addColorStop(0.6, '#efe9df')
  g.addColorStop(1, '#dcd4c8')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(cx, topCy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  // glossy rim highlight (upper-left arc) + soft inner well
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.ellipse(cx, topCy, rx - 2, ry - 2, 0, Math.PI * 1.02, Math.PI * 1.6)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(120,108,92,0.28)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, topCy, rx - 2, ry - 2, 0, Math.PI * 0.05, Math.PI * 0.5)
  ctx.stroke()
  // a faint concentric well ring (ceramic detail)
  ctx.strokeStyle = 'rgba(150,138,120,0.18)'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.ellipse(cx, topCy, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2)
  ctx.stroke()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('plate.png'), buf)
  console.log('  ✓ plate.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking cake-maker art →')
// muted, sensory-calm crumb palettes (lo = lit crumb, hi = shaded crumb)
bakeLayer([236, 214, 164], [200, 172, 116], 'layer-vanilla.png')
bakeLayer([132, 92, 62], [86, 56, 36], 'layer-choc.png')
bakeLayer([232, 176, 190], [198, 132, 150], 'layer-straw.png')
bakeLayer([233, 214, 128], [200, 176, 84], 'layer-lemon.png')
bakeCrown()
bakeCherry()
bakeStrawberry()
bakeCandle()
bakeSprinkles()
bakePlate()
console.log('Done.')
