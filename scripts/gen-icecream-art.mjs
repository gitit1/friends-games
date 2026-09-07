// Bakes the "גלידה" (ice-cream parlour) MATERIALS as raster art with baked soft
// lighting, texture and AO — so the scene reads as a real gelateria, not CSS
// shapes on a gradient:
//   scoop.png    — ONE neutral creamy ICE-CREAM dome overlay (soft matte catch-
//                  light, dense creamy lump texture, form shadow, bottom AO, a
//                  gentle melt lip). Transparent body so the friend-flavour tint
//                  (a CSS radial `var(--fl)` fill UNDER it) shows through — one
//                  sprite serves all six flavours (coin-sort / pop precedent).
//   cone.png     — a toasted WAFFLE cone: a baked diamond lattice that converges
//                  toward the tip (real perspective), each waffle cell domed and
//                  the grooves AO-darkened, a rolled scalloped rim lip, cone
//                  cross-section curvature shading + toasted mottling.
//   counter.jpg  — the near marble PARLOUR counter (foreground occluder): a lit
//                  top lip receding a touch, then a tall front face with soft warm
//                  veining + bottom AO. Grounds the friend (feet occluded) and the
//                  cone stands ON it.
//   parlour.jpg  — the far back wall of the gelateria: warm cream wall, a soft
//                  arched daylight window upper-left, a low shelf carrying a row of
//                  muted pastel tubs (blurred = receding), a warm floor with gentle
//                  perspective. Calm, low-contrast (sensory rule) — SceneBackdrop.
//   tub.png      — a stainless display PAN for the flavour stand (angled ellipse
//                  rim, metallic shading, transparent well) — the tinted mound
//                  sits in it, so "counter/tubs" read as real material.
//   cream.png    — a soft ivory WHIPPED-CREAM swirl (matte, stacked tapering rings).
//   sauce.png    — a glossy CHOCOLATE-SAUCE cap with drip tongues + soft specular.
//
// Key light is baked upper-LEFT (physical — it does NOT mirror in RTL/LTR, same
// rule as the friends). Muted / appetising-but-calm palette (sensory rule).
//
// Same pipeline as the coin-sort / build-a-number materials: a node-canvas bake
// with seeded value-noise, analytic shading and baked AO. No third-party assets.
//
// One-off build tool. Needs @napi-rs/canvas (a prebuilt node-canvas drop-in):
//   npm i --no-save @napi-rs/canvas && node scripts/gen-icecream-art.mjs
// (the dep is NOT kept permanently — reinstall it to regenerate.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/icecream/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })
const file = (base, name) => new URL(name, base).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the grain / lump generator ----------------
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
const fract = (v) => v - Math.floor(v)

// ============================================================================
// 1) THE SCOOP — a creamy ice-cream ball baked as a mostly-transparent OVERLAY
//    (the flavour colour is a CSS radial fill beneath it, so ONE sprite tints to
//    every flavour). Baked: a broad soft MATTE catch-light upper-left, a cool
//    form shadow swelling to the lower-right, bottom AO, dense creamy LUMP
//    texture (what makes it read as ice-cream and not a balloon), a faint rolled
//    ridge, and a gentle melt lip along the bottom. Neutral light/dark only.
// ============================================================================
function bakeScoop() {
  const W = 256
  const H = 232
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const cx = W / 2
  const cy = H / 2 - 2
  const rx = W / 2 - 12
  const ry = H / 2 - 14 // a flattened DOME (wider than tall = a scoop, not a ball)
  const nLump = makeNoise(1717) // big soft creamy curds
  const nMid = makeNoise(2604) // mid creamy mottle
  const nFine = makeNoise(9301) // fine surface grain
  const nEdge = makeNoise(3355) // rim wobble (breaks the perfect circle)
  const L = [-0.52, -0.70] // key light, upper-left

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      const a0 = Math.atan2(dy, dx)
      // IRREGULAR creamy silhouette — soft bumps so it never reads as a balloon
      const wob = 1 + 0.05 * Math.sin(a0 * 5 + 0.7) + 0.045 * nEdge(Math.cos(a0) * 1.6, Math.sin(a0) * 1.6)
      const ex = dx / wob
      const ey = dy / wob
      const r2 = ex * ex + ey * ey
      if (r2 > 1.05) {
        d[idx + 3] = 0
        continue
      }
      const nz = Math.sqrt(Math.max(0.0001, 1 - Math.min(1, r2)))
      const bright = ex * L[0] + ey * L[1] + nz * 0.62 // >0 lit (upper-left), <0 shade
      let net = 0

      // matte FORM shading — a gentle lit→shaded roll (creamy, not glossy)
      net += (bright - 0.16) * 0.42

      // broad soft MATTE catch-light around the lit pole (no tight specular)
      const hd = Math.hypot(ex + 0.34, ey + 0.42)
      net += Math.max(0, 1 - hd / 0.86) * 0.30

      // creamy CURD texture — soft lumps at two scales, clearly visible so it
      // reads as dense ice-cream, lit on their upper-left faces
      const lump = nLump(ex * 2.5 + 5, ey * 2.5) * 0.6 + nMid(ex * 5.6, ey * 5.6 + 2) * 0.4
      net += lump * 0.22 * (0.5 + nz * 0.5)
      net += nFine(ex * 16, ey * 16) * 0.055

      // rolled SCOOP curl — soft curved ridges spiralling out from the crown
      const rr = Math.sqrt(r2)
      const curl = Math.sin(a0 * 2.0 - rr * 5.2 + 1.2)
      net += curl * 0.06 * sstep(0.1, 0.9, rr)

      // bottom AO
      net -= Math.max(0, ey - 0.12) * 0.26

      // MELT LIP — the bottom scallops into soft drips (crowns catch light, notches
      // shade) so a scoop reads as sitting ON the one below
      if (ey > 0.34) {
        const near = sstep(0.34, 1.0, ey)
        net += Math.sin(ex * 5.6) * 0.13 * near
      }

      // thin creamy rim light on the lit side (soft translucency)
      net += sstep(0.82, 1.0, rr) * 0.14 * Math.max(0, bright + 0.2)

      let r, g, b, av
      if (net >= 0) {
        r = 255
        g = 253
        b = 248
        av = clamp(net, 0, 1) * 0.72 // matte — capped below glossy
      } else {
        r = 92
        g = 68
        b = 86 // cool mauve shadow (sits in the pink parlour)
        av = clamp(-net, 0, 1) * 0.52
      }
      const cov = clamp((1.03 - rr) / 0.07, 0, 1)
      d[idx] = r
      d[idx + 1] = g
      d[idx + 2] = b
      d[idx + 3] = Math.round(av * 255 * cov)
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(OUT, 'scoop.png'), buf)
  console.log('  ✓ scoop.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 2) THE WAFFLE CONE — a downward triangle. Per-pixel: cone cross-section
//    curvature shading (bright centre, shaded edges = a real cylinder), a toasted
//    vertical gradient, a DIAMOND waffle lattice that converges toward the tip
//    (perspective) with each cell domed + grooves AO-darkened + a facet catch-
//    light on the up-light side, toasted mottling, and a rolled scalloped RIM.
// ============================================================================
function bakeCone() {
  const W = 240
  const H = 320
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data
  const cx = W / 2
  const rimTop = 6
  const rimH = 30
  const coneTop = rimTop + rimH - 6 // cone body begins just under the rim lip
  const apexY = H - 8
  const halfTop = W / 2 - 12
  const nToast = makeNoise(4242)
  const nGrain = makeNoise(8128)
  // warm toasted waffle palette (muted)
  const top = [205, 154, 96] // #cd9a60 lit upper waffle
  const bot = [150, 101, 55] // #966537 toastier tip

  const halfAt = (y) => lerp(halfTop, 2, clamp((y - coneTop) / (apexY - coneTop), 0, 1))

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2

      // ---- rolled RIM lip (an ellipse band across the top) ----
      if (y < coneTop + 2) {
        const rimCy = rimTop + rimH * 0.5
        const rimRx = halfTop + 6
        const rimRy = rimH * 0.62
        const ex = (x - cx) / rimRx
        const ey = (y - rimCy) / rimRy
        const e2 = ex * ex + ey * ey
        if (e2 > 1.04) {
          d[idx + 3] = 0
          continue
        }
        // scalloped lower edge of the rim (the classic rolled waffle bead)
        const scal = Math.sin((x - cx) * 0.16) * 0.10
        const nz = Math.sqrt(Math.max(0.0001, 1 - Math.min(1, e2)))
        let mul = 0.72 + nz * 0.5 // domed lip, lit centre-top
        mul *= 1 + (-ey) * 0.22 // brighter along the top of the bead
        mul += scal * (ey > 0 ? 1 : 0)
        const toast = nToast(ex * 3 + 1, ey * 3) * 0.12
        mul *= 1 + toast
        const t = clamp((y - rimTop) / (H - rimTop), 0, 1)
        const r = lerp(top[0], bot[0], t) * mul
        const g = lerp(top[1], bot[1], t) * mul
        const b = lerp(top[2], bot[2], t) * mul
        const cov = clamp((1.04 - e2) / 0.08, 0, 1)
        d[idx] = clamp(r, 0, 255)
        d[idx + 1] = clamp(g, 0, 255)
        d[idx + 2] = clamp(b, 0, 255)
        d[idx + 3] = Math.round(255 * cov)
        continue
      }

      // ---- cone body ----
      const hw = halfAt(y)
      const u = (x - cx) / hw // -1..1 across the cone at this height
      if (Math.abs(u) > 1.02) {
        d[idx + 3] = 0
        continue
      }
      const t = clamp((y - coneTop) / (apexY - coneTop), 0, 1) // 0 top → 1 tip

      // cross-section curvature: a cylinder/cone facing the camera
      const curve = Math.sqrt(Math.max(0, 1 - u * u)) // 1 centre → 0 edge
      let mul = 0.60 + curve * 0.52
      // key light bias to the upper-left face
      mul *= 1 + (-u) * 0.10 * curve
      // toasty tip darkening
      mul *= 1 - t * 0.14

      // DIAMOND waffle lattice in surface coords; density grows toward the tip so
      // the grid CONVERGES (perspective + real cones)
      const dens = 1 + t * 1.7
      const fa = u * 3.1 + t * 4.2 * dens
      const fb = u * 3.1 - t * 4.2 * dens
      const pa = fract(fa)
      const pb = fract(fb)
      const da = Math.min(pa, 1 - pa) * 2 // 0 at a line → 1 mid-cell
      const db = Math.min(pb, 1 - pb) * 2
      const cell = Math.min(da, db) // 0 on any groove → 1 diamond centre
      const groove = sstep(0.0, 0.30, cell)
      mul *= 0.80 + 0.28 * cell // domed diamonds (centre proud)
      mul *= 0.70 + 0.34 * groove // grooves AO-dark
      // facet catch-light: each bump lit on its upper-left shoulder
      const facet = ((pa < 0.5 ? 1 : -1) + (pb < 0.5 ? 1 : -1)) * 0.5
      mul *= 1 + facet * (1 - groove) * 0.14

      // toasted mottling + grain
      mul *= 1 + nToast(u * 4 + 3, t * 7) * 0.10
      mul *= 1 + nGrain(u * 22, t * 30) * 0.045

      const r = lerp(top[0], bot[0], t) * mul
      const g = lerp(top[1], bot[1], t) * mul
      const b = lerp(top[2], bot[2], t) * mul
      const cov = clamp((1.02 - Math.abs(u)) / 0.05, 0, 1)
      d[idx] = clamp(r, 0, 255)
      d[idx + 1] = clamp(g, 0, 255)
      d[idx + 2] = clamp(b, 0, 255)
      d[idx + 3] = Math.round(255 * cov)
    }
  }
  ctx.putImageData(img, 0, 0)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(OUT, 'cone.png'), buf)
  console.log('  ✓ cone.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 3) THE COUNTER — the near marble foreground plane (occludes the friend's feet).
//    A shallow receding TOP lip (lit) then a tall FRONT face with warm mauve
//    veining + bottom AO. JPEG.
// ============================================================================
function bakeCounter() {
  const W = 800
  const H = 300
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const CX = W / 2
  const topH = 34 // the lit top surface band
  // warm cream marble base
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#f4e7ee')
  g.addColorStop(topH / H, '#eddbe6')
  g.addColorStop(topH / H + 0.001, '#e3ccdd')
  g.addColorStop(0.5, '#d3b3ca')
  g.addColorStop(1, '#b78fac')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // soft warm veining on the front face (mauve marble)
  const nVein = makeNoise(555)
  const im = ctx.getImageData(0, 0, W, H)
  const dat = im.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) << 2
      let mul = 1
      if (y < topH) {
        // top lip: a receding lit surface, brighter toward the near (front) edge
        mul *= 1 + (y / topH) * 0.05
      } else {
        const fy = (y - topH) / (H - topH)
        // marble veins — broad, soft, sparse filaments (calm, not drippy)
        const v = nVein(x * 0.006 + fy * 0.25, fy * 0.7) * 0.6 + nVein(x * 0.018 + 3, fy * 1.5 + 4) * 0.4
        const vein = Math.abs(v)
        if (vein < 0.035) mul *= 1 + (0.035 - vein) * 0.9 // subtle bright vein
        mul *= 1 + v * 0.025
        mul *= 1 - fy * 0.14 // front face AO toward the floor
      }
      dat[i] = clamp(dat[i] * mul, 0, 255)
      dat[i + 1] = clamp(dat[i + 1] * mul, 0, 255)
      dat[i + 2] = clamp(dat[i + 2] * mul, 0, 255)
    }
  }
  ctx.putImageData(im, 0, 0)

  // crisp lit front lip where the top meets the face + a soft contact shade under it
  ctx.fillStyle = 'rgba(255,250,252,0.72)'
  ctx.fillRect(0, topH - 3, W, 3)
  g = ctx.createLinearGradient(0, topH, 0, topH + 22)
  g.addColorStop(0, 'rgba(90,50,74,0.22)')
  g.addColorStop(1, 'rgba(90,50,74,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, topH, W, 22)
  // gentle overhead light pool on the top + corner vignette
  g = ctx.createRadialGradient(CX, topH, 20, CX, topH, W * 0.6)
  g.addColorStop(0, 'rgba(255,252,248,0.18)')
  g.addColorStop(1, 'rgba(255,252,248,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, topH)

  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(file(OUT, 'counter.jpg'), buf)
  console.log('  ✓ counter.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 4) THE PARLOUR BACKDROP — the far back wall of the gelateria (SceneBackdrop):
//    a warm cream wall, a soft arched daylight window upper-left, a low shelf
//    carrying muted pastel tubs (blurred = receding), and a warm floor with a
//    gentle perspective. Calm, low-contrast. JPEG.
// ============================================================================
function bakeParlour() {
  const W = 720
  const H = 460
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const floorY = H * 0.62

  // warm cream wall, brighter toward the upper-left window
  let g = ctx.createRadialGradient(W * 0.22, H * 0.16, 40, W * 0.5, H * 0.4, W * 0.9)
  g.addColorStop(0, '#fdf1ec')
  g.addColorStop(0.5, '#f7e6e0')
  g.addColorStop(1, '#eed4cf')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, floorY)

  // soft arched daylight window (upper-left) — very gentle glow
  ctx.save()
  const wx = W * 0.2
  const wy = H * 0.24
  const ww = W * 0.2
  const wh = H * 0.3
  ctx.beginPath()
  ctx.moveTo(wx - ww / 2, wy + wh / 2)
  ctx.lineTo(wx - ww / 2, wy - wh / 4)
  ctx.quadraticCurveTo(wx, wy - wh / 2 - 10, wx + ww / 2, wy - wh / 4)
  ctx.lineTo(wx + ww / 2, wy + wh / 2)
  ctx.closePath()
  ctx.clip()
  g = ctx.createLinearGradient(0, wy - wh / 2, 0, wy + wh / 2)
  g.addColorStop(0, 'rgba(255,251,232,0.85)')
  g.addColorStop(1, 'rgba(255,247,224,0.30)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, floorY)
  ctx.restore()
  // window frame + soft outer glow
  ctx.strokeStyle = 'rgba(200,150,150,0.35)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(wx - ww / 2, wy + wh / 2)
  ctx.lineTo(wx - ww / 2, wy - wh / 4)
  ctx.quadraticCurveTo(wx, wy - wh / 2 - 10, wx + ww / 2, wy - wh / 4)
  ctx.lineTo(wx + ww / 2, wy + wh / 2)
  ctx.stroke()
  g = ctx.createRadialGradient(wx, wy, 20, wx, wy, W * 0.45)
  g.addColorStop(0, 'rgba(255,250,228,0.28)')
  g.addColorStop(1, 'rgba(255,250,228,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, floorY)

  // a low display SHELF on the right, carrying muted pastel tubs (receding)
  const shelfY = floorY - 84
  const tubCols = ['#e7c7b6', '#cfe0d0', '#e6d3b3', '#d8c4e0', '#c9d8e6', '#eccdd2']
  ctx.save()
  ctx.filter = 'blur(2.5px)' // recede — soft, calm
  const shelfX0 = W * 0.4
  const tubW = (W - shelfX0 - 26) / tubCols.length
  for (let i = 0; i < tubCols.length; i++) {
    const tx = shelfX0 + 14 + i * tubW
    // tub body
    const tg = ctx.createLinearGradient(0, shelfY - 46, 0, shelfY)
    tg.addColorStop(0, '#f2ece6')
    tg.addColorStop(1, '#d8cec6')
    ctx.fillStyle = tg
    ctx.fillRect(tx, shelfY - 46, tubW - 8, 46)
    // the flavour mound
    ctx.fillStyle = tubCols[i]
    ctx.beginPath()
    ctx.ellipse(tx + (tubW - 8) / 2, shelfY - 46, (tubW - 8) / 2, 12, 0, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(tx, shelfY - 46, tubW - 8, 6)
  }
  ctx.restore()
  // the shelf plank (in focus, grounds the tubs)
  g = ctx.createLinearGradient(0, shelfY, 0, shelfY + 16)
  g.addColorStop(0, '#c69f86')
  g.addColorStop(1, '#a17a5f')
  ctx.fillStyle = g
  ctx.fillRect(W * 0.38, shelfY, W - W * 0.38, 16)
  ctx.fillStyle = 'rgba(255,240,220,0.4)'
  ctx.fillRect(W * 0.38, shelfY, W - W * 0.38, 2)

  // warm floor with a gentle perspective (a couple of receding seams)
  g = ctx.createLinearGradient(0, floorY, 0, H)
  g.addColorStop(0, '#d9b58f')
  g.addColorStop(1, '#c29a6f')
  ctx.fillStyle = g
  ctx.fillRect(0, floorY, W, H - floorY)
  // wall/floor contact shade
  g = ctx.createLinearGradient(0, floorY, 0, floorY + 26)
  g.addColorStop(0, 'rgba(80,50,30,0.28)')
  g.addColorStop(1, 'rgba(80,50,30,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, floorY, W, 26)
  ctx.strokeStyle = 'rgba(120,88,58,0.28)'
  ctx.lineWidth = 2
  const vpX = W / 2
  for (let i = -3; i <= 3; i++) {
    const nearX = W / 2 + i * (W / 5)
    ctx.beginPath()
    ctx.moveTo(lerp(vpX, nearX, 0.35), floorY)
    ctx.lineTo(nearX, H)
    ctx.stroke()
  }

  // desaturate ~14% for sensory calm + a soft vignette
  const im = ctx.getImageData(0, 0, W, H)
  const dd = im.data
  for (let i = 0; i < dd.length; i += 4) {
    const yl = 0.299 * dd[i] + 0.587 * dd[i + 1] + 0.114 * dd[i + 2]
    dd[i] += (yl - dd[i]) * 0.14
    dd[i + 1] += (yl - dd[i + 1]) * 0.14
    dd[i + 2] += (yl - dd[i + 2]) * 0.14
  }
  ctx.putImageData(im, 0, 0)
  g = ctx.createRadialGradient(W / 2, H * 0.44, W * 0.3, W / 2, H * 0.5, W * 0.72)
  g.addColorStop(0, 'rgba(40,20,30,0)')
  g.addColorStop(1, 'rgba(40,20,30,0.18)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(file(OUT_BG, 'icecream-parlour.jpg'), buf)
  console.log('  ✓ icecream-parlour.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 5) THE TUB PAN — a stainless display pan for the flavour stand. An angled
//    ellipse rim with metallic shading and a shallow well; TRANSPARENT centre so
//    the tinted flavour mound (CSS) shows sitting in it. PNG.
// ============================================================================
function bakeTub() {
  const W = 220
  const H = 150
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const rimCy = H * 0.5
  const rx = W / 2 - 8
  const ry = H * 0.34
  // outer stainless rim ring
  const grd = ctx.createLinearGradient(0, rimCy - ry, 0, rimCy + ry)
  grd.addColorStop(0, '#e9edf0')
  grd.addColorStop(0.5, '#b9c2c8')
  grd.addColorStop(1, '#8f9aa1')
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.ellipse(cx, rimCy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  // metallic band highlights (a couple of soft arcs)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(cx, rimCy, rx - 3, ry - 3, 0, Math.PI * 1.05, Math.PI * 1.55)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(70,80,88,0.4)'
  ctx.beginPath()
  ctx.ellipse(cx, rimCy, rx - 3, ry - 3, 0, Math.PI * 0.1, Math.PI * 0.5)
  ctx.stroke()
  // inner well — cut a transparent hole for the flavour mound to sit in
  const wrx = rx - 16
  const wry = ry - 12
  ctx.save()
  // dark well ring first (so the mound reads seated), then punch transparent
  const wg = ctx.createRadialGradient(cx, rimCy, 4, cx, rimCy, wrx)
  wg.addColorStop(0, '#6f7a80')
  wg.addColorStop(1, '#9aa4aa')
  ctx.fillStyle = wg
  ctx.beginPath()
  ctx.ellipse(cx, rimCy, wrx, wry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.ellipse(cx, rimCy - 3, wrx - 6, wry - 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(OUT, 'tub.png'), buf)
  console.log('  ✓ tub.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 6) WHIPPED CREAM — a soft ivory swirl, stacked tapering rings to a peak, matte
//    baked light upper-left. PNG (alpha).
// ============================================================================
function bakeCream() {
  const W = 170
  const H = 190
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const rings = [
    { y: H - 34, rx: 62, ry: 26 },
    { y: H - 70, rx: 50, ry: 22 },
    { y: H - 102, rx: 38, ry: 18 },
    { y: H - 130, rx: 26, ry: 14 },
    { y: H - 152, rx: 15, ry: 10 },
  ]
  for (let r = 0; r < rings.length; r++) {
    const s = rings[r]
    const off = (r % 2 === 0 ? -1 : 1) * s.rx * 0.14 // gentle swirl offset
    const g = ctx.createRadialGradient(cx + off - s.rx * 0.3, s.y - s.ry * 0.6, 2, cx + off, s.y, s.rx)
    g.addColorStop(0, '#fffdf6')
    g.addColorStop(0.55, '#fbf3e2')
    g.addColorStop(1, '#e9d9c2')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx + off, s.y, s.rx, s.ry, 0, 0, Math.PI * 2)
    ctx.fill()
    // soft contact shade under each ring for stacked volume
    ctx.fillStyle = 'rgba(120,95,70,0.12)'
    ctx.beginPath()
    ctx.ellipse(cx + off, s.y + s.ry * 0.5, s.rx * 0.9, s.ry * 0.5, 0, 0, Math.PI)
    ctx.fill()
  }
  // little peak tip
  ctx.fillStyle = '#fffdf6'
  ctx.beginPath()
  ctx.ellipse(cx, H - 162, 8, 12, 0, 0, Math.PI * 2)
  ctx.fill()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(OUT, 'cream.png'), buf)
  console.log('  ✓ cream.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// 7) CHOCOLATE SAUCE — a glossy dark cap with drip tongues + a soft specular. PNG.
// ============================================================================
function bakeSauce() {
  const W = 190
  const H = 120
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const capY = 34
  // the cap (a rounded blob over the top of the scoop) + drip tongues
  ctx.beginPath()
  ctx.moveTo(18, capY)
  ctx.quadraticCurveTo(cx, 8, W - 18, capY)
  // drips down the right, middle, left with rounded ends
  const drips = [
    { x: W - 30, len: 46, w: 13 },
    { x: cx + 4, len: 70, w: 15 },
    { x: 40, len: 40, w: 12 },
    { x: W - 62, len: 58, w: 12 },
    { x: 66, len: 30, w: 10 },
  ]
  ctx.lineTo(W - 18, capY)
  // bottom edge with drips
  let path = [[W - 18, capY]]
  for (let x = W - 18; x >= 18; x -= 6) {
    let yy = capY + 6
    for (const dr of drips) {
      const dd = Math.abs(x - dr.x)
      if (dd < dr.w) yy = Math.max(yy, capY + dr.len * (1 - (dd / dr.w) ** 2))
    }
    path.push([x, yy])
  }
  for (const p of path) ctx.lineTo(p[0], p[1])
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#6b4326')
  g.addColorStop(0.5, '#502f18')
  g.addColorStop(1, '#3c2210')
  ctx.fillStyle = g
  ctx.fill()
  // glossy specular sweep upper-left
  const sp = ctx.createRadialGradient(cx - 34, 20, 2, cx - 34, 20, 60)
  sp.addColorStop(0, 'rgba(255,240,220,0.5)')
  sp.addColorStop(1, 'rgba(255,240,220,0)')
  ctx.fillStyle = sp
  ctx.beginPath()
  ctx.ellipse(cx - 30, 22, 44, 18, -0.3, 0, Math.PI * 2)
  ctx.fill()
  // a couple of small drip-tip catch-lights
  ctx.fillStyle = 'rgba(255,235,210,0.35)'
  for (const dr of drips) {
    ctx.beginPath()
    ctx.ellipse(dr.x - dr.w * 0.3, capY + dr.len - 6, 3, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(OUT, 'sauce.png'), buf)
  console.log('  ✓ sauce.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking ice-cream parlour art →')
bakeScoop()
bakeCone()
bakeCounter()
bakeParlour()
bakeTub()
bakeCream()
bakeSauce()
console.log('Done.')
