// Bakes the "גלגל הצלילים" (Sound Wheel) materials — a REAL turnable prize-wheel,
// not flat CSS conic-gradients. The child spins a wheel of Hebrew letters and
// hears the sound; every SURFACE here is a baked material (wood/paint/metal with
// analytic lighting + AO + seeded value-noise grain), while the Hebrew LETTERS
// stay crisp CSS text laid over the baked wood (razor-legible).
//
// Pieces (all transparent PNG, muted sensory-calm palette):
//   disc-outer.png  the big turnable oak turntable — raised lit rim, turned-wood
//                   grooves, a clicker-notch track around the rim, a sunken hub
//                   recess. Rotates as a FACE-ON round disc so letters stay upright
//                   and legible (no spinning-ellipse wobble). Depth comes from the
//                   baked stand + grounded shadow, not from tilting the letters.
//   disc-inner.png  the smaller maple vowel disc that rides on top.
//   peg-a/peg-b.png a domed painted-wood button the letter sits on (two muted
//                   tints → the alternating "painted segment" rhythm, count-free).
//   dot-a…dot-u.png the five enamel vowel wells (the exact muted vowel colours,
//                   glossy, AO'd) — the vowel is a COLOUR, never a niqqud glyph.
//   hub.png         the centre metal-wood knob (recessed face; the current pair
//                   overlays as CSS text/colour).
//   pointer.png     the clicker pointer at the top, with a baked drop shadow.
//   stand.png       the easel/base the wheel is mounted on + a grounded contact
//                   shadow → the game-show depth.
//
// Same pipeline as the dice / coin-sort materials. One-off build tool:
//   node scripts/gen-soundwheel-art.mjs   (@napi-rs/canvas already pinned)

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/soundwheel/', import.meta.url)
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
const grain = makeNoise(20260718)

// wood value-noise grain, applied to every painted pixel (kills the "flat CSS" read)
function grainPass(ctx, S, amt = 0.05, freq = 0.5) {
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * freq, y * freq) * 0.6 + grain(x * freq * 3.2, y * freq * 3.2) * 0.4
      const m = 1 + n * amt
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

function save(cv, name) {
  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${cv.width}×${cv.height}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// A wooden turntable disc — raised lit rim, turned-wood face, hub recess, and an
// optional clicker-notch track around the rim. Baked FACE-ON (round) so it can
// spin in flat 2D without any letter wobble.
// ============================================================================
function bakeDisc(S, wood, name, { notches = 0, rimW = 0.11, hubR = 0.185 } = {}) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const R = S * 0.47
  const rim = R * rimW

  // --- soft ambient drop shadow, hugging the disc for grounding ---
  const sh = ctx.createRadialGradient(cx, cy + R * 0.06, R * 0.9, cx, cy + R * 0.06, R * 1.05)
  sh.addColorStop(0, 'rgba(30,26,34,0.28)')
  sh.addColorStop(1, 'rgba(30,26,34,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(cx, cy + R * 0.03, R * 1.05, 0, Math.PI * 2)
  ctx.fill()

  const dark = mix(wood, [40, 30, 26], 0.5)
  const deep = mix(wood, [30, 22, 20], 0.66)
  const litW = mix(wood, [255, 246, 230], 0.34)

  // --- raised rim bezel: a thick ring, lit top-left → dark bottom-right ---
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  let g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
  g.addColorStop(0, rgb(litW))
  g.addColorStop(0.5, rgb(dark))
  g.addColorStop(1, rgb(deep))
  ctx.fillStyle = g
  ctx.fill()

  // --- turned-wood FACE (inside the rim) ---
  const faceR = R - rim
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, faceR, 0, Math.PI * 2)
  ctx.clip()
  // base face radial: key light from top-left, AO to bottom-right
  const fg = ctx.createRadialGradient(cx - faceR * 0.32, cy - faceR * 0.34, faceR * 0.1, cx + faceR * 0.2, cy + faceR * 0.28, faceR * 1.25)
  fg.addColorStop(0, rgb(mix(wood, [255, 248, 232], 0.24)))
  fg.addColorStop(0.55, rgb(wood))
  fg.addColorStop(1, rgb(mix(wood, [40, 30, 26], 0.24)))
  ctx.fillStyle = fg
  ctx.fillRect(0, 0, S, S)
  // concentric turned-wood grooves
  for (let i = 1; i <= 7; i++) {
    const rr = faceR * (i / 7.4)
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, Math.PI * 2)
    ctx.lineWidth = S * 0.004
    ctx.strokeStyle = `rgba(${deep[0] | 0},${deep[1] | 0},${deep[2] | 0},0.10)`
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, rr + S * 0.004, 0, Math.PI * 2)
    ctx.lineWidth = S * 0.003
    ctx.strokeStyle = 'rgba(255,248,232,0.06)'
    ctx.stroke()
  }
  ctx.restore()

  // --- inner rim shadow (where the face sinks below the bezel) ---
  ctx.beginPath()
  ctx.arc(cx, cy, faceR, 0, Math.PI * 2)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(28,20,18,0.34)'
  ctx.stroke()
  // bright top-left catch on the rim's inner lip
  ctx.beginPath()
  ctx.arc(cx, cy, faceR + S * 0.006, Math.PI * 0.9, Math.PI * 1.55)
  ctx.lineWidth = S * 0.01
  ctx.strokeStyle = 'rgba(255,248,232,0.34)'
  ctx.stroke()

  // --- clicker-notch track (decorative, count-independent) ---
  if (notches) {
    const nr = faceR - S * 0.006
    for (let i = 0; i < notches; i++) {
      const a = (i / notches) * Math.PI * 2 - Math.PI / 2
      const x1 = cx + Math.cos(a) * (nr - S * 0.02)
      const y1 = cy + Math.sin(a) * (nr - S * 0.02)
      const x2 = cx + Math.cos(a) * nr
      const y2 = cy + Math.sin(a) * nr
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineWidth = S * 0.008
      ctx.strokeStyle = 'rgba(28,20,18,0.28)'
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x1 + 1, y1 + 1)
      ctx.lineTo(x2 + 1, y2 + 1)
      ctx.lineWidth = S * 0.004
      ctx.strokeStyle = 'rgba(255,248,232,0.14)'
      ctx.stroke()
    }
  }

  // --- sunken HUB recess in the middle ---
  const hr = R * hubR
  const hg = ctx.createRadialGradient(cx - hr * 0.3, cy - hr * 0.3, hr * 0.1, cx + hr * 0.2, cy + hr * 0.2, hr * 1.2)
  hg.addColorStop(0, rgb(mix(wood, [30, 22, 20], 0.42)))
  hg.addColorStop(0.7, rgb(mix(wood, [30, 22, 20], 0.28)))
  hg.addColorStop(1, rgb(mix(wood, [255, 248, 232], 0.12)))
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.arc(cx, cy, hr, 0, Math.PI * 2)
  ctx.fill()
  // AO ring around the recess
  ctx.beginPath()
  ctx.arc(cx, cy, hr, 0, Math.PI * 2)
  ctx.lineWidth = S * 0.012
  ctx.strokeStyle = 'rgba(24,16,14,0.4)'
  ctx.stroke()

  grainPass(ctx, S, 0.04, 0.3)
  save(cv, name)
}

// ============================================================================
// A domed painted-wood BUTTON the letter sits on (two muted tints alternate).
// ============================================================================
function bakeButton(S, base, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const R = S * 0.44

  // contact shadow
  const sh = ctx.createRadialGradient(cx, cy + R * 0.28, R * 0.4, cx, cy + R * 0.28, R * 1.08)
  sh.addColorStop(0, 'rgba(26,20,26,0.32)')
  sh.addColorStop(1, 'rgba(26,20,26,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(cx, cy + R * 0.16, R * 1.08, 0, Math.PI * 2)
  ctx.fill()

  // domed body: lit top-left, AO bottom-right
  const g = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.36, R * 0.08, cx + R * 0.24, cy + R * 0.3, R * 1.25)
  g.addColorStop(0, rgb(mix(base, [255, 252, 244], 0.42)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, [26, 20, 30], 0.4)))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  // glossy top-left highlight bloom
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  const bl = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.34, 0, cx - R * 0.3, cy - R * 0.34, R * 0.95)
  bl.addColorStop(0, 'rgba(255,252,246,0.34)')
  bl.addColorStop(1, 'rgba(255,252,246,0)')
  ctx.fillStyle = bl
  ctx.fillRect(0, 0, S, S)
  ctx.restore()

  // bevel rim: bright top-left, dark bottom-right
  ctx.beginPath()
  ctx.arc(cx, cy, R - S * 0.01, Math.PI * 0.85, Math.PI * 1.6)
  ctx.lineWidth = S * 0.03
  ctx.strokeStyle = 'rgba(255,252,246,0.5)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, R - S * 0.01, Math.PI * 1.6, Math.PI * 2.85)
  ctx.lineWidth = S * 0.03
  ctx.strokeStyle = 'rgba(24,16,26,0.34)'
  ctx.stroke()

  grainPass(ctx, S, 0.04, 0.5)
  save(cv, name)
}

// ============================================================================
// An enamel VOWEL WELL — a glossy painted disc in the exact muted vowel colour.
// ============================================================================
function bakeDot(S, hex, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const R = S * 0.42
  const base = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

  // AO ring / socket the well sits in
  const ao = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.12)
  ao.addColorStop(0, 'rgba(24,18,20,0)')
  ao.addColorStop(0.72, 'rgba(24,18,20,0.26)')
  ao.addColorStop(1, 'rgba(24,18,20,0)')
  ctx.fillStyle = ao
  ctx.beginPath()
  ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2)
  ctx.fill()

  // enamel body: domed, lit top-left
  const g = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.36, R * 0.05, cx + R * 0.22, cy + R * 0.28, R * 1.2)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.5)))
  g.addColorStop(0.5, rgb(base))
  g.addColorStop(1, rgb(mix(base, [22, 18, 26], 0.36)))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  // glossy specular highlight
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  const sp = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.32, 0, cx - R * 0.28, cy - R * 0.32, R * 0.7)
  sp.addColorStop(0, 'rgba(255,255,255,0.6)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sp
  ctx.fillRect(0, 0, S, S)
  ctx.restore()

  // crisp bright rim (top-left)
  ctx.beginPath()
  ctx.arc(cx, cy, R - S * 0.008, Math.PI * 0.85, Math.PI * 1.55)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.stroke()

  grainPass(ctx, S, 0.03, 0.8)
  save(cv, name)
}

// ============================================================================
// The centre HUB knob — a domed metal-wood cap with a recessed face (the current
// pair overlays in the DOM as CSS text + colour).
// ============================================================================
function bakeHub(S, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S / 2
  const cy = S / 2
  const R = S * 0.46
  const metal = [162, 150, 132]

  // outer contact shadow
  const sh = ctx.createRadialGradient(cx, cy + R * 0.14, R * 0.7, cx, cy + R * 0.14, R * 1.06)
  sh.addColorStop(0, 'rgba(22,18,22,0.4)')
  sh.addColorStop(1, 'rgba(22,18,22,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(cx, cy + R * 0.08, R * 1.06, 0, Math.PI * 2)
  ctx.fill()

  // domed metal ring
  const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
  g.addColorStop(0, rgb(mix(metal, [255, 250, 238], 0.5)))
  g.addColorStop(0.5, rgb(metal))
  g.addColorStop(1, rgb(mix(metal, [30, 24, 22], 0.5)))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  // recessed face
  const fr = R * 0.66
  const fg = ctx.createRadialGradient(cx - fr * 0.3, cy - fr * 0.3, fr * 0.1, cx + fr * 0.2, cy + fr * 0.25, fr * 1.15)
  fg.addColorStop(0, rgb(mix(metal, [255, 250, 240], 0.2)))
  fg.addColorStop(0.7, rgb(mix(metal, [235, 228, 214], 0.35)))
  fg.addColorStop(1, rgb(mix(metal, [30, 24, 22], 0.22)))
  ctx.fillStyle = fg
  ctx.beginPath()
  ctx.arc(cx, cy, fr, 0, Math.PI * 2)
  ctx.fill()
  // recess AO ring
  ctx.beginPath()
  ctx.arc(cx, cy, fr, 0, Math.PI * 2)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(26,20,18,0.34)'
  ctx.stroke()
  // bright rim on the knob
  ctx.beginPath()
  ctx.arc(cx, cy, R - S * 0.012, Math.PI * 0.85, Math.PI * 1.55)
  ctx.lineWidth = S * 0.02
  ctx.strokeStyle = 'rgba(255,250,240,0.5)'
  ctx.stroke()

  grainPass(ctx, S, 0.03, 0.45)
  save(cv, name)
}

// ============================================================================
// The clicker POINTER at the top — a rounded wooden marker pointing DOWN, with a
// baked drop shadow. Canvas taller than wide.
// ============================================================================
function bakePointer(W, H, name) {
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const brass = [206, 176, 116]
  const cx = W / 2

  // teardrop/chevron pointing down: rounded top, pointed bottom
  const topY = H * 0.14
  const tipY = H * 0.9
  const halfW = W * 0.3

  function shape(ox, oy) {
    ctx.beginPath()
    ctx.moveTo(cx + ox, tipY + oy)
    ctx.quadraticCurveTo(cx + halfW + ox, H * 0.5 + oy, cx + halfW * 0.78 + ox, topY + H * 0.18 + oy)
    ctx.arc(cx + ox, topY + H * 0.18 + oy, halfW * 0.78, 0, Math.PI, true)
    ctx.quadraticCurveTo(cx - halfW + ox, H * 0.5 + oy, cx + ox, tipY + oy)
    ctx.closePath()
  }

  // drop shadow
  shape(W * 0.03, H * 0.04)
  ctx.fillStyle = 'rgba(22,18,22,0.34)'
  ctx.fill()

  // body, lit top-left
  shape(0, 0)
  const g = ctx.createLinearGradient(cx - halfW, topY, cx + halfW, tipY)
  g.addColorStop(0, rgb(mix(brass, [255, 248, 226], 0.5)))
  g.addColorStop(0.5, rgb(brass))
  g.addColorStop(1, rgb(mix(brass, [40, 30, 22], 0.5)))
  ctx.fillStyle = g
  ctx.fill()

  // specular highlight near the top-left
  ctx.save()
  shape(0, 0)
  ctx.clip()
  const sp = ctx.createRadialGradient(cx - halfW * 0.4, topY + H * 0.12, 0, cx - halfW * 0.4, topY + H * 0.12, H * 0.4)
  sp.addColorStop(0, 'rgba(255,250,236,0.5)')
  sp.addColorStop(1, 'rgba(255,250,236,0)')
  ctx.fillStyle = sp
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // bright rim
  shape(0, 0)
  ctx.lineWidth = W * 0.03
  ctx.strokeStyle = 'rgba(255,250,236,0.4)'
  ctx.stroke()

  grainPass(ctx, Math.max(W, H) === W ? W : W, 0.04, 0.7) // grain (square-ish region)
  save(cv, name)
}

// ============================================================================
// The STAND / easel the wheel is mounted on + a grounded contact shadow → depth.
// The disc overlaps the post top; the splayed base grounds the whole assembly.
// ============================================================================
function bakeStand(W, H, name) {
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const wood = [150, 122, 92]
  const cx = W / 2

  // grounded contact shadow (soft ellipse on the floor)
  ctx.save()
  ctx.translate(cx, H * 0.9)
  ctx.scale(1, 0.26)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.4)
  sh.addColorStop(0, 'rgba(24,18,22,0.4)')
  sh.addColorStop(0.7, 'rgba(24,18,22,0.18)')
  sh.addColorStop(1, 'rgba(24,18,22,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, W * 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const dark = mix(wood, [36, 26, 22], 0.5)
  const lit = mix(wood, [255, 244, 224], 0.32)

  // splayed base foot (a low trapezoid, seen at a slight angle)
  ctx.beginPath()
  ctx.moveTo(cx - W * 0.26, H * 0.9)
  ctx.lineTo(cx + W * 0.26, H * 0.9)
  ctx.lineTo(cx + W * 0.17, H * 0.78)
  ctx.lineTo(cx - W * 0.17, H * 0.78)
  ctx.closePath()
  let g = ctx.createLinearGradient(0, H * 0.78, 0, H * 0.9)
  g.addColorStop(0, rgb(lit))
  g.addColorStop(1, rgb(dark))
  ctx.fillStyle = g
  ctx.fill()

  // the post rising to the wheel centre
  const postW = W * 0.1
  ctx.beginPath()
  ctx.moveTo(cx - postW / 2, H * 0.8)
  ctx.lineTo(cx + postW / 2, H * 0.8)
  ctx.lineTo(cx + postW * 0.62, H * 0.24)
  ctx.lineTo(cx - postW * 0.62, H * 0.24)
  ctx.closePath()
  g = ctx.createLinearGradient(cx - postW, 0, cx + postW, 0)
  g.addColorStop(0, rgb(lit))
  g.addColorStop(0.5, rgb(wood))
  g.addColorStop(1, rgb(dark))
  ctx.fillStyle = g
  ctx.fill()
  // post left-edge highlight
  ctx.beginPath()
  ctx.moveTo(cx - postW / 2, H * 0.8)
  ctx.lineTo(cx - postW * 0.62, H * 0.24)
  ctx.lineWidth = W * 0.012
  ctx.strokeStyle = 'rgba(255,244,224,0.3)'
  ctx.stroke()

  // a round mount cap at the post top (where the wheel pivots)
  const capR = W * 0.13
  const capY = H * 0.24
  const cg = ctx.createRadialGradient(cx - capR * 0.3, capY - capR * 0.3, capR * 0.1, cx, capY, capR * 1.2)
  cg.addColorStop(0, rgb(mix(wood, [255, 244, 224], 0.4)))
  cg.addColorStop(0.6, rgb(wood))
  cg.addColorStop(1, rgb(dark))
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(cx, capY, capR, 0, Math.PI * 2)
  ctx.fill()

  grainPass(ctx, Math.min(W, H), 0.035, 0.32)
  save(cv, name)
}

// ---------------------------------------------------------------------------
console.log('Baking Sound Wheel art →')
bakeDisc(408, [178, 148, 114], 'disc-outer.png', { notches: 44, rimW: 0.1, hubR: 0.2 }) // muted oak turntable
bakeDisc(256, [202, 178, 142], 'disc-inner.png', { notches: 0, rimW: 0.13, hubR: 0.28 }) // maple vowel disc
bakeButton(128, [96, 130, 140], 'peg-a.png') // muted teal painted button
bakeButton(128, [182, 122, 100], 'peg-b.png') // muted terracotta painted button
// the five enamel vowel wells — the EXACT muted vowel colours from SoundWheel.tsx
bakeDot(96, '#d98a8a', 'dot-a.png')
bakeDot(96, '#86c7a1', 'dot-e.png')
bakeDot(96, '#7fb2e0', 'dot-i.png')
bakeDot(96, '#e6b877', 'dot-o.png')
bakeDot(96, '#b79ce0', 'dot-u.png')
bakeHub(168, 'hub.png')
bakePointer(128, 164, 'pointer.png')
bakeStand(468, 360, 'stand.png')
console.log('Done.')
