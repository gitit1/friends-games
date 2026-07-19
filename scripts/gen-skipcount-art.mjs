// Bakes the skip-count scene's material art — a real STEPPING STONE the hopper
// friend lands on as it counts along the number-line path across a meadow.
//
// Same pipeline as the coin-sort / bowling materials (public/art/sprites/*): a
// node-canvas bake with seeded value-noise grain, analytic dome shading and baked
// lighting/AO/contact-shadow. No third-party assets — all original, CC0.
//
// One sprite serves EVERY stone (near/far) — it is just scaled by perspective in
// the game; the "visited / current" states are CSS washes over this baked stone,
// so the milled texture always survives. A shallow oblique view (elliptical top
// face + a short cylindrical side + a baked contact shadow) gives real volume.
//
// One-off build tool. Needs @napi-rs/canvas (a prebuilt drop-in for node-canvas):
//   npm i --no-save @napi-rs/canvas && node scripts/gen-skipcount-art.mjs
// (the dep is NOT kept permanently — reinstall it to regenerate.)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/skipcount/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise — the grain generator (shared with the other bakes) ----
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
const smooth = (t) => t * t * (3 - 2 * t)

// ============================================================================
// THE STEPPING STONE — a warm river stone at a shallow oblique view:
// elliptical lit top face, a short darker side (its thickness), value-noise
// grit + a few pits, baked top-left key light, edge AO and a soft contact shadow.
// Neutral warm-gray so the friend's identity colour always pops (sensory rule).
// ============================================================================
function bakeStone() {
  const W = 240
  const H = 208
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data

  const cx = W / 2
  const topCy = 82 // centre of the top face ellipse
  const rx = 104 // top-face radii
  const ry = 52
  const thick = 30 // stone thickness (side height)
  const botCy = topCy + thick // centre of the bottom rim ellipse
  const shCy = botCy + 12 // contact-shadow centre, on the ground below the stone
  const shRx = rx * 1.08
  const shRy = 34

  // warm neutral stone tones (muted — never neon)
  const TOP = [168, 159, 146]
  const TOP_HI = [206, 199, 184]
  const TOP_LO = [120, 112, 100]
  const SIDE = [104, 96, 85]
  const SIDE_LO = [64, 58, 50]

  const nGrit = makeNoise(5150)
  const nFib = makeNoise(9284)
  // a few baked pits/speckles on the top face (nx,ny in face-normalised space)
  const pits = [
    { nx: -0.34, ny: -0.18, r: 0.12, s: 0.5 },
    { nx: 0.28, ny: 0.06, r: 0.1, s: 0.42 },
    { nx: 0.05, ny: 0.34, r: 0.08, s: 0.36 },
    { nx: -0.5, ny: 0.28, r: 0.07, s: 0.32 },
    { nx: 0.46, ny: -0.3, r: 0.06, s: 0.28 },
  ]
  const L = [-0.55, -0.7] // light dir (upper-left), in face space

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
      const nxT = (x - cx) / rx
      const nyT = (y - topCy) / ry
      const rT = nxT * nxT + nyT * nyT
      const nxB = (x - cx) / rx
      const nyB = (y - botCy) / ry
      const rB = nxB * nxB + nyB * nyB

      if (rT <= 1) {
        // ---- TOP FACE: a shallow dome, lit from upper-left ----
        const nz = Math.sqrt(Math.max(0, 1 - rT)) // fake dome normal z
        // gentle diffuse: brighter toward the light, softly domed centre
        const diff = clamp(nxT * L[0] + nyT * L[1], -1, 1)
        let shade = 0.72 + 0.26 * (0.5 + 0.5 * diff) + 0.12 * nz
        // grit speckle + fibre
        const g = nGrit(x * 0.14, y * 0.14) * 0.5 + nGrit(x * 0.4, y * 0.4) * 0.3
        const fib = nFib(x * 0.05, y * 0.09) * 0.4
        shade *= 1 + g * 0.1 + fib * 0.05
        // edge AO — darken toward the rim, but keep a lit upper-left rim
        const edge = rT // 0 centre → 1 rim
        const upperLeft = clamp(-(nxT + nyT) * 0.7, 0, 1)
        shade *= 1 - edge * edge * 0.22
        if (edge > 0.82) shade += upperLeft * 0.18 // rim light catch
        // pits
        for (const p of pits) {
          const pd = Math.hypot(nxT - p.nx, nyT - p.ny)
          if (pd < p.r) {
            const t = smooth(clamp(1 - pd / p.r, 0, 1))
            shade *= 1 - p.s * t * 0.7
          }
        }
        let col = [
          lerp(TOP_LO[0], TOP_HI[0], clamp((shade - 0.5) / 0.9, 0, 1)),
          lerp(TOP_LO[1], TOP_HI[1], clamp((shade - 0.5) / 0.9, 0, 1)),
          lerp(TOP_LO[2], TOP_HI[2], clamp((shade - 0.5) / 0.9, 0, 1)),
        ]
        col = [col[0] * (0.62 + shade * 0.5), col[1] * (0.62 + shade * 0.5), col[2] * (0.62 + shade * 0.5)]
        // touch of TOP hue mixed in so it never goes flat gray
        col = [lerp(col[0], TOP[0], 0.28), lerp(col[1], TOP[1], 0.28), lerp(col[2], TOP[2], 0.28)]
        let a = 255
        if (rT > 0.965) a = clamp((1 - rT) / 0.035, 0, 1) * 255
        d[idx] = clamp(col[0], 0, 255)
        d[idx + 1] = clamp(col[1], 0, 255)
        d[idx + 2] = clamp(col[2], 0, 255)
        d[idx + 3] = a
      } else if (rB <= 1 && y > topCy) {
        // ---- SIDE: the stone's thickness (visible lower crescent) ----
        const down = clamp((y - topCy) / (botCy + ry - topCy), 0, 1) // 0 just under top → 1 bottom
        const vgrain = nFib(x * 0.5, y * 0.12) * 0.5 + nGrit(x * 0.9, y * 0.3) * 0.3
        let shade = lerp(1, 0.62, down) * (1 + vgrain * 0.14)
        // a whisper of bounce light near the very bottom edge (from the ground)
        if (rB > 0.8 && y > botCy) shade += (rB - 0.8) * 0.28
        let col = [lerp(SIDE_LO[0], SIDE[0], shade), lerp(SIDE_LO[1], SIDE[1], shade), lerp(SIDE_LO[2], SIDE[2], shade)]
        let a = 255
        if (rB > 0.965) a = clamp((1 - rB) / 0.035, 0, 1) * 255
        d[idx] = clamp(col[0], 0, 255)
        d[idx + 1] = clamp(col[1], 0, 255)
        d[idx + 2] = clamp(col[2], 0, 255)
        d[idx + 3] = a
      } else {
        // ---- CONTACT SHADOW on the ground (only outside the stone) — a soft,
        // centred pool with a gentle squared falloff so its edge never reads hard.
        const sd = ((x - cx) / shRx) ** 2 + ((y - shCy) / shRy) ** 2
        if (sd <= 1) {
          const cov = smooth(clamp(1 - sd, 0, 1))
          d[idx] = 46
          d[idx + 1] = 40
          d[idx + 2] = 32
          d[idx + 3] = clamp(cov * cov * 104, 0, 255)
        } else {
          d[idx + 3] = 0
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)

  // a crisp lit rim arc on the top-left of the top face (vector, on top) — the
  // single cue that most sells "a rounded stone catching the light"
  ctx.strokeStyle = 'rgba(240,236,224,0.42)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.ellipse(cx, topCy, rx - 3, ry - 3, 0, Math.PI * 0.62, Math.PI * 1.32)
  ctx.stroke()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('stone.png'), buf)
  console.log('  ✓ stone.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking skip-count art →')
bakeStone()
console.log('Done.')
