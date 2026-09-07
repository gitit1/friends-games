// Bakes the "Living Letters" tray-TILE materials — the small letter-character
// buttons shared by four English games (SpellWord, FirstLetter, RhymeMachine,
// BlendSounds) via `.ll-tile` / `.ll-guy` (LetterGuy.tsx). Was flat CSS gradient
// squares + CSS-circle eyes; now a REAL baked painted-wooden tile: a rounded
// cube seen at a gentle 3/4 angle (lit top + shaded right faces), wood grain,
// AO, edge bevel and a baked contact shadow, plus a pair of baked glossy googly
// eyes (the SAME toy family as scripts/gen-lettertalk-art.mjs's hero block, just
// tray-scale and always-awake since a tile changes letter every round — no
// sleep/wake state to preserve here). The Latin GLYPH itself is NOT baked; the
// runtime overlays it as crisp CSS text centred on the block's front face so it
// stays pixel-sharp for every letter.
//
// Ten muted tints — one stable colour per letter index, matching LetterGuy's
// existing colorFor() palette (desaturated for the sensory-calm rule) — so each
// letter keeps a recognisable, consistent little character across games.
//
// Same pipeline as gen-lettertalk-art.mjs / gen-letterhunt-art.mjs: an original
// @napi-rs/canvas bake, seeded value-noise wood grain, analytic lighting/AO.
// One-off build tool (canvas already installed & pinned — do NOT reinstall):
//   node scripts/gen-livingletters-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/livingletters/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const file = (name) => new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (same as siblings) --
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

const grain = makeNoise(20260803)
const woodN = makeNoise(884422)

// ============================================================================
// THE TILE — a chunky painted-wooden cube, tray scale. Front face (axis-aligned,
// where the CSS glyph + baked eyes land) at FX0/FY0/FS; top & right faces recede
// up-right (DX/DY) for real depth. The front-face rect below MUST stay in
// lock-step with app.css .ll-guy vars so the crisp CSS glyph overlays exactly.
// Eyes are baked directly on (always "awake" — a tray tile's letter changes
// every round, so there is no sleep/wake state worth the extra layer).
// ============================================================================
const S = 200
const FX0 = 0.1 // front face left (fraction of S) — mirrored in app.css
const FY0 = 0.26 // front face top
const FS = 0.62 // front face size
const DX = 0.15 // depth: how far the top/right faces recede to the right
const DY = 0.15 // …and upward

function bakeTile(base, name) {
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')

  const fx = FX0 * S
  const fy = FY0 * S
  const fs = FS * S
  const dx = DX * S
  const dy = DY * S
  const r = fs * 0.18 // corner radius — soft, toy-block edges

  const top = mix(base, [255, 255, 255], 0.22)
  const topHi = mix(base, [255, 255, 255], 0.36)
  const right = mix(base, [40, 34, 54], 0.36)
  const rightDk = mix(base, [30, 24, 42], 0.52)

  // --- baked contact shadow on the surface under the tile ---
  ctx.save()
  const shY = (FY0 + FS) * S - fs * 0.01
  ctx.translate(fx + fs * 0.54, shY + fs * 0.1)
  ctx.scale(1, 0.3)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, fs * 0.62)
  sh.addColorStop(0, 'rgba(24,18,14,0.32)')
  sh.addColorStop(0.6, 'rgba(24,18,14,0.15)')
  sh.addColorStop(1, 'rgba(24,18,14,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, fs * 0.62, 0, Math.PI * 2)
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
  ctx.strokeStyle = rgb(mix(base, [255, 255, 255], 0.55), 0.5)
  ctx.lineWidth = S * 0.007
  ctx.beginPath()
  ctx.moveTo(fx + r * 0.4, fy)
  ctx.lineTo(fx + fs - r * 0.4, fy)
  ctx.stroke()

  // --- FRONT face (rounded square) ---
  roundRectPath(ctx, fx, fy, fs, fs, r)
  g = ctx.createLinearGradient(fx, fy, fx + fs, fy + fs)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.24)))
  g.addColorStop(0.55, rgb(base))
  g.addColorStop(1, rgb(mix(base, [34, 28, 46], 0.16)))
  ctx.save()
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()
  const bloom = ctx.createRadialGradient(fx + fs * 0.3, fy + fs * 0.24, 0, fx + fs * 0.3, fy + fs * 0.24, fs * 0.95)
  bloom.addColorStop(0, 'rgba(255,255,255,0.22)')
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(fx, fy, fs, fs)
  const ao = ctx.createRadialGradient(fx + fs * 0.86, fy + fs * 0.88, fs * 0.1, fx + fs * 0.86, fy + fs * 0.88, fs)
  ao.addColorStop(0, 'rgba(26,22,34,0.16)')
  ao.addColorStop(1, 'rgba(26,22,34,0)')
  ctx.fillStyle = ao
  ctx.fillRect(fx, fy, fs, fs)
  ctx.restore()

  // --- crisp bevel rim ---
  ctx.save()
  roundRectPath(ctx, fx + 1, fy + 1, fs - 2, fs - 2, r - 1)
  ctx.clip()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.lineWidth = S * 0.022
  ctx.strokeStyle = 'rgba(255,255,255,0.46)'
  ctx.stroke()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, fx, fy, fs, fs, r)
  ctx.clip()
  roundRectPath(ctx, fx + fs * 0.02, fy + fs * 0.05, fs, fs, r)
  ctx.lineWidth = S * 0.022
  ctx.strokeStyle = 'rgba(28,24,36,0.18)'
  ctx.stroke()
  ctx.restore()

  // --- baked googly EYES on the upper front face (always "awake") ---
  const eyeCy = fy + fs * 0.32
  const eyeR = fs * 0.1
  for (const sx of [-0.19, 0.19]) {
    const ex = fx + fs * 0.5 + fs * sx
    // dome
    let eg = ctx.createRadialGradient(ex - eyeR * 0.34, eyeCy - eyeR * 0.36, eyeR * 0.1, ex, eyeCy, eyeR)
    eg.addColorStop(0, 'rgba(255,255,255,1)')
    eg.addColorStop(0.7, 'rgba(240,240,246,1)')
    eg.addColorStop(1, 'rgba(206,206,220,1)')
    ctx.fillStyle = eg
    ctx.beginPath()
    ctx.arc(ex, eyeCy, eyeR, 0, Math.PI * 2)
    ctx.fill()
    // pupil
    const px = ex + eyeR * 0.1
    const py = eyeCy + eyeR * 0.14
    const pr = eyeR * 0.48
    eg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.34, pr * 0.1, px, py, pr)
    eg.addColorStop(0, 'rgba(64,58,86,1)')
    eg.addColorStop(0.6, 'rgba(42,38,58,1)')
    eg.addColorStop(1, 'rgba(28,25,40,1)')
    ctx.fillStyle = eg
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
    // catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.arc(px - pr * 0.36, py - pr * 0.4, pr * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // --- wood grain + matte paint texture over every painted pixel ---
  const img = ctx.getImageData(0, 0, S, S)
  const d = img.data
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) << 2
      if (d[idx + 3] < 8) continue
      const wood = woodN(x * 0.07, y * 0.75) * 0.5 + woodN(x * 0.14, y * 1.4) * 0.3
      const fine = grain(x * 0.95, y * 0.95) * 0.35
      const m = 1 + wood * 0.045 + fine * 0.02
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SHELF — a low wooden shelf surface in perspective (receding top face +
// thick front lip + baked contact shadow) that the picture/emoji "rests" on in
// .spell-scene, over the illustrated wooden-playroom.jpg backdrop. Same wood
// tone + bake approach as gen-letterhunt-art.mjs's play-table, just a shallow
// strip sized for the picture-frame area instead of a full scene.
// ============================================================================
function bakeShelf(name) {
  const W = 640
  const H = 260
  const cv = createCanvas(W, H)
  const x = cv.getContext('2d')
  const cxb = W / 2

  const OAK = [172, 130, 82]
  const OAK_DK = [118, 84, 48]
  const OAK_LT = [202, 160, 106]

  const topY = 26
  const botY = 210
  const topHalf = 296
  const botHalf = 330
  const lipH = 34

  // soft ground shadow under the whole shelf
  x.save()
  x.translate(cxb, botY + lipH + 2)
  x.scale(1, 0.22)
  const gsh = x.createRadialGradient(0, 0, 0, 0, 0, botHalf + 20)
  gsh.addColorStop(0, 'rgba(22,14,6,0.28)')
  gsh.addColorStop(1, 'rgba(22,14,6,0)')
  x.fillStyle = gsh
  x.beginPath()
  x.arc(0, 0, botHalf + 20, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // TOP face (receding trapezoid)
  x.beginPath()
  x.moveTo(cxb - topHalf, topY)
  x.lineTo(cxb + topHalf, topY)
  x.lineTo(cxb + botHalf, botY)
  x.lineTo(cxb - botHalf, botY)
  x.closePath()
  x.save()
  x.clip()
  let g = x.createLinearGradient(0, topY, 0, botY)
  g.addColorStop(0, rgb(OAK_DK))
  g.addColorStop(0.5, rgb(OAK))
  g.addColorStop(1, rgb(OAK_LT))
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  for (let i = 0; i < 26; i++) {
    const yy = topY + Math.random() * (botY - topY)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(118,84,48,0.2)' : 'rgba(216,184,138,0.22)'
    x.lineWidth = 0.8 + Math.random() * 2.2
    x.beginPath()
    x.moveTo(cxb - botHalf, yy)
    for (let sx = -botHalf; sx <= botHalf; sx += 46) x.lineTo(cxb + sx, yy + (Math.random() - 0.5) * 5)
    x.stroke()
  }
  x.strokeStyle = 'rgba(72,50,24,0.34)'
  x.lineWidth = 2
  for (const frac of [-0.6, -0.2, 0.2, 0.6]) {
    x.beginPath()
    x.moveTo(cxb + frac * topHalf, topY)
    x.lineTo(cxb + frac * botHalf, botY)
    x.stroke()
  }
  const ao = x.createLinearGradient(0, topY, 0, topY + 44)
  ao.addColorStop(0, 'rgba(44,28,12,0.46)')
  ao.addColorStop(1, 'rgba(44,28,12,0)')
  x.fillStyle = ao
  x.fillRect(0, topY, W, 44)
  const kl = x.createRadialGradient(cxb - 110, botY - 40, 20, cxb - 110, botY - 40, 380)
  kl.addColorStop(0, 'rgba(255,246,220,0.16)')
  kl.addColorStop(1, 'rgba(255,246,220,0)')
  x.fillStyle = kl
  x.fillRect(0, 0, W, H)
  x.restore()

  // FRONT LIP
  x.beginPath()
  x.moveTo(cxb - botHalf, botY)
  x.lineTo(cxb + botHalf, botY)
  x.lineTo(cxb + botHalf, botY + lipH)
  x.lineTo(cxb - botHalf, botY + lipH)
  x.closePath()
  x.save()
  x.clip()
  const lg = x.createLinearGradient(0, botY, 0, botY + lipH)
  lg.addColorStop(0, rgb(mix(OAK, [255, 255, 255], 0.05)))
  lg.addColorStop(1, rgb(mix(OAK_DK, [18, 10, 4], 0.34)))
  x.fillStyle = lg
  x.fillRect(0, botY, W, lipH)
  for (let i = 0; i < 40; i++) {
    const gx = cxb - botHalf + Math.random() * (botHalf * 2)
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(228,196,148,0.16)' : 'rgba(58,36,16,0.22)'
    x.lineWidth = 0.7 + Math.random() * 1.6
    x.beginPath()
    x.moveTo(gx, botY)
    x.lineTo(gx + (Math.random() - 0.5) * 3, botY + lipH)
    x.stroke()
  }
  x.restore()
  x.strokeStyle = 'rgba(255,242,214,0.75)'
  x.lineWidth = 2.4
  x.beginPath()
  x.moveTo(cxb - botHalf, botY)
  x.lineTo(cxb + botHalf, botY)
  x.stroke()
  x.strokeStyle = 'rgba(28,16,6,0.45)'
  x.lineWidth = 2
  x.beginPath()
  x.moveTo(cxb - botHalf, botY + lipH)
  x.lineTo(cxb + botHalf, botY + lipH)
  x.stroke()

  // wood grain + matte texture pass over the whole strip
  const img = x.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let px = 0; px < W; px++) {
      const idx = (y * W + px) << 2
      if (d[idx + 3] < 8) continue
      const m = 1 + (woodN(px * 0.05, y * 0.6) * 0.5 + grain(px * 1.3, y * 1.3) * 0.35) * 0.045
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  x.putImageData(img, 0, 0)

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ---- muted tile tints — desaturated siblings of LetterGuy's colorFor() palette,
// so the baked tile keeps each letter's existing colour identity (index i maps to
// the same LL_COLORS slot) while meeting the sensory-calm "no neon" rule ----------
const TINTS = [
  [214, 122, 132], // was #fb7185/#e11d48 -> muted rose
  [210, 168, 96], // was #fbbf24/#d97706 -> muted amber
  [130, 188, 158], // was #34d399/#059669 -> muted green
  [124, 176, 206], // was #38bdf8/#0284c7 -> muted sky
  [166, 146, 208], // was #a78bfa/#7c3aed -> muted violet
  [214, 140, 176], // was #f472b6/#db2777 -> muted pink
  [206, 180, 104], // was #facc15/#ca8a04 -> muted yellow
  [104, 190, 178], // was #2dd4bf/#0d9488 -> muted teal
  [140, 164, 214], // was #60a5fa/#4338ca -> muted blue
  [206, 128, 118], // was #f87171/#b91c1c -> muted red-clay
]
// ============================================================================
// THE TRACE TRAY — a shallow baked wooden frame/tray the tracing canvas sits
// inside (TraceLetter): a dark slate-like well (keeps the rainbow trail + faint
// letter guide legible) with a real wooden RIM — bevel, AO where the slate
// drops into the frame, wood grain on the rim, contact shadow — instead of a
// flat translucent-white panel. The centre stays a calm flat-dark well on
// purpose (a legible writing surface, not a decorative object).
// ============================================================================
function bakeTraceTray(name) {
  const S = 640
  const cv = createCanvas(S, S)
  const x = cv.getContext('2d')
  const rimW = S * 0.052
  const rad = S * 0.1

  // contact shadow under the whole tray
  x.save()
  x.translate(S / 2, S * 0.985)
  x.scale(1, 0.14)
  const sh = x.createRadialGradient(0, 0, 0, 0, 0, S * 0.52)
  sh.addColorStop(0, 'rgba(10,7,4,0.4)')
  sh.addColorStop(1, 'rgba(10,7,4,0)')
  x.fillStyle = sh
  x.beginPath()
  x.arc(0, 0, S * 0.52, 0, Math.PI * 2)
  x.fill()
  x.restore()

  // outer wooden rim
  roundRectPath(x, 2, 2, S - 4, S - 4, rad)
  const OAK = [150, 110, 70]
  let g = x.createLinearGradient(0, 0, S, S)
  g.addColorStop(0, rgb(mix(OAK, [255, 255, 255], 0.22)))
  g.addColorStop(0.55, rgb(OAK))
  g.addColorStop(1, rgb(mix(OAK, [30, 20, 10], 0.28)))
  x.fillStyle = g
  x.fill()

  // inner dark well (the slate the canvas draws over) — AO ring where it drops
  // into the wooden frame
  const iw = S - rimW * 2
  roundRectPath(x, rimW, rimW, iw, iw, rad * 0.6)
  x.save()
  x.clip()
  g = x.createLinearGradient(0, rimW, 0, rimW + iw)
  g.addColorStop(0, 'rgba(18,26,34,1)')
  g.addColorStop(1, 'rgba(12,18,24,1)')
  x.fillStyle = g
  x.fillRect(rimW, rimW, iw, iw)
  const ao = x.createLinearGradient(0, rimW, 0, rimW + S * 0.05)
  ao.addColorStop(0, 'rgba(6,10,14,0.55)')
  ao.addColorStop(1, 'rgba(6,10,14,0)')
  x.fillStyle = ao
  x.fillRect(rimW, rimW, iw, S * 0.05)
  const aoL = x.createLinearGradient(rimW, 0, rimW + S * 0.05, 0)
  aoL.addColorStop(0, 'rgba(6,10,14,0.4)')
  aoL.addColorStop(1, 'rgba(6,10,14,0)')
  x.fillStyle = aoL
  x.fillRect(rimW, rimW, S * 0.05, iw)
  x.restore()
  x.strokeStyle = 'rgba(4,6,8,0.55)'
  x.lineWidth = 2
  roundRectPath(x, rimW, rimW, iw, iw, rad * 0.6)
  x.stroke()

  // bevel + wood grain on the rim only
  x.save()
  roundRectPath(x, 2, 2, S - 4, S - 4, rad)
  x.clip()
  roundRectPath(x, rimW, rimW, iw, iw, rad * 0.6)
  x.rect(0, 0, S, S)
  // punch the inner well out of the grain pass by clipping the complement via
  // even-odd style redraw: simplest is drawing grain strokes then re-filling well
  for (let i = 0; i < 90; i++) {
    const gx = Math.random() * S
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(228,196,148,0.14)' : 'rgba(58,36,16,0.18)'
    x.lineWidth = 0.7 + Math.random() * 1.6
    x.beginPath()
    x.moveTo(gx, 0)
    x.lineTo(gx + (Math.random() - 0.5) * 4, S)
    x.stroke()
  }
  x.restore()
  // re-paint the well solid (undo any grain strokes that crept over it)
  roundRectPath(x, rimW, rimW, iw, iw, rad * 0.6)
  x.save()
  x.clip()
  g = x.createLinearGradient(0, rimW, 0, rimW + iw)
  g.addColorStop(0, 'rgba(18,26,34,1)')
  g.addColorStop(1, 'rgba(12,18,24,1)')
  x.fillStyle = g
  x.fillRect(rimW, rimW, iw, iw)
  const ao2 = x.createLinearGradient(0, rimW, 0, rimW + S * 0.05)
  ao2.addColorStop(0, 'rgba(6,10,14,0.55)')
  ao2.addColorStop(1, 'rgba(6,10,14,0)')
  x.fillStyle = ao2
  x.fillRect(rimW, rimW, iw, S * 0.05)
  x.restore()
  x.strokeStyle = 'rgba(4,6,8,0.55)'
  x.lineWidth = 2
  roundRectPath(x, rimW, rimW, iw, iw, rad * 0.6)
  x.stroke()

  // crisp rim bevel: bright top-left, dark bottom-right
  x.save()
  roundRectPath(x, 3, 3, S - 6, S - 6, rad - 1)
  x.clip()
  roundRectPath(x, 2, 2, S - 4, S - 4, rad)
  x.lineWidth = S * 0.012
  x.strokeStyle = 'rgba(255,255,255,0.42)'
  x.stroke()
  x.restore()
  x.save()
  roundRectPath(x, 2, 2, S - 4, S - 4, rad)
  x.clip()
  roundRectPath(x, 2 + S * 0.012, 2 + S * 0.02, S - 4, S - 4, rad)
  x.lineWidth = S * 0.012
  x.strokeStyle = 'rgba(20,14,8,0.3)'
  x.stroke()
  x.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking living-letters tile art →')
TINTS.forEach((t, i) => bakeTile(t, `tile-${i}.png`))
bakeShelf('shelf.png')
bakeTraceTray('trace-tray.png')
console.log('Done.')
