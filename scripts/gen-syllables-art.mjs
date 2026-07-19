// Bakes the "תופסים הברות" (syllable drum) materials — REAL baked art, not flat
// CSS shapes+gradients. Same pipeline as the dice / coin-sort / pattern bakers:
// an original @napi-rs/canvas bake with seeded value-noise grain and analytic
// baked lighting/AO. No third-party art.
//
//   drum.png   — the HERO tap-drum (a 3/4-view tom): a warm muted-oak SHELL with
//     vertical staves + grain + baked side light and bottom AO, a taut cream SKIN
//     head lit from the top-left with a soft tap-dimple, a darker tension HOOP with
//     lugs around the rim, and its own soft contact shadow so it rests on a floor.
//     This is the "catcher" the child taps once per syllable.
//   bead-on.png — a glossy lit COUNT-BEAD (one syllable drummed): a shaded amber
//     orb with a key-light gloss + baked contact shadow. (The dots stay TEXTLESS:
//     the game's syl[] strings are a spoken-TTS recipe, not the word's real
//     letters, so showing them would mis-teach spelling — they remain count-beads.)
//   socket.png — an EMPTY recessed dot-cup carved into the rail (a syllable not
//     yet drummed): a concave wood pit with top AO + a lit near lip.
//   rail.png   — the slim wooden RAIL the count-beads rest on (lit top face, grain,
//     a front bevel + drop shadow). Stretched behind the dot row.
//   panel.png  — the framed PICTURE CARD the emoji/friend + word sit on: a wood
//     frame around a bright cream mat (so the crisp CSS Hebrew word stays razor
//     legible), inner bevel + AO, soft outer drop shadow.
//   rug.png    — a soft oval woven MAT the drum + buddy stand on (grounding /
//     depth): muted dusty-sage weave with concentric rings, grain and a soft edge.
//
// One-off build tool (canvas is already installed + pinned):
//   node scripts/gen-syllables-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/art/sprites/syllables/', import.meta.url)
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
  const lerpN = (a, b, t) => a + t * (b - a)
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
    const x1 = lerpN(grad(aa) * xf, grad(ba) * (xf - 1), u)
    const x2 = lerpN(grad(ab) * xf, grad(bb) * (xf - 1), u)
    return lerpN(x1, x2, v) // ~[-1,1]
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const grain = makeNoise(20260718)

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function grainPass(ctx, W, H, amt = 0.05) {
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) << 2
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
function grainStreaks(ctx, x, y, w, h, n, light, dark, horizontal = true) {
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = Math.random() < 0.5 ? light : dark
    ctx.globalAlpha = 0.05 + Math.random() * 0.1
    ctx.lineWidth = 0.6 + Math.random() * 1.4
    ctx.beginPath()
    if (horizontal) {
      const gy = y + Math.random() * h
      ctx.moveTo(x, gy)
      for (let sx = x; sx <= x + w; sx += 26) ctx.lineTo(sx, gy + (Math.random() - 0.5) * 2.4)
    } else {
      const gx = x + Math.random() * w
      ctx.moveTo(gx, y)
      for (let sy = y; sy <= y + h; sy += 26) ctx.lineTo(gx + (Math.random() - 0.5) * 2.4, sy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ---- muted, sensory-calm palette -------------------------------------------
const OAK = [170, 128, 80] // drum shell / rail / frame wood
const OAK_DK = [120, 84, 48]
const SKIN = [236, 224, 198] // drum head parchment
const AMBER = [230, 176, 110] // lit count-bead
const MAT = [244, 235, 214] // picture-card mat (bright, for legible text)
const SAGE = [176, 190, 168] // rug weave

// ============================================================================
// THE DRUM — a 3/4-view tom: cream skin head, oak shell with staves, tension
// hoop + lugs, baked contact shadow. The star material, tapped once per syllable.
// ============================================================================
function bakeDrum() {
  const S = 288
  const cv = createCanvas(S, S)
  const ctx = cv.getContext('2d')
  const cx = S * 0.5
  const cyTop = S * 0.37 // head centre
  const cyBot = S * 0.72 // shell base centre
  const rx = S * 0.4
  const ry = S * 0.19 // perspective foreshortening of the round head

  // --- baked contact shadow on the floor, under the drum ---
  ctx.save()
  ctx.translate(cx, cyBot + ry * 0.82)
  ctx.scale(1, 0.42)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.14)
  sh.addColorStop(0, 'rgba(22,16,8,0.36)')
  sh.addColorStop(0.62, 'rgba(22,16,8,0.2)')
  sh.addColorStop(1, 'rgba(22,16,8,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, rx * 1.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- SHELL silhouette: left wall · bottom front arc · right wall · top front arc
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - rx, cyTop)
  ctx.lineTo(cx - rx, cyBot)
  ctx.ellipse(cx, cyBot, rx, ry, 0, Math.PI, 0, true) // front (lower) arc of the base, L→R
  ctx.lineTo(cx + rx, cyTop)
  ctx.ellipse(cx, cyTop, rx, ry, 0, 0, Math.PI, false) // front (lower) arc of the head, R→L
  ctx.closePath()
  ctx.clip()
  // vertical wood gradient — lit on the left (key light top-left), shaded right
  let g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0)
  g.addColorStop(0, rgb(mix(OAK, [255, 236, 200], 0.26)))
  g.addColorStop(0.4, rgb(OAK))
  g.addColorStop(1, rgb(mix(OAK, [26, 16, 6], 0.4)))
  ctx.fillStyle = g
  ctx.fillRect(cx - rx, cyTop - ry, rx * 2, cyBot - cyTop + ry * 2)
  // vertical stave grain
  grainStreaks(ctx, cx - rx, cyTop, rx * 2, cyBot - cyTop + ry, 46, rgb(mix(OAK, [255, 236, 200], 0.4)), rgb(mix(OAK, [26, 16, 6], 0.5)), false)
  // bottom AO pooling
  const bao = ctx.createLinearGradient(0, cyBot - ry * 0.4, 0, cyBot + ry)
  bao.addColorStop(0, 'rgba(24,15,6,0)')
  bao.addColorStop(1, 'rgba(24,15,6,0.42)')
  ctx.fillStyle = bao
  ctx.fillRect(cx - rx, cyBot - ry, rx * 2, ry * 2)
  // a soft near light band down the middle-front of the shell (cylinder round)
  const cyl = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0)
  cyl.addColorStop(0, 'rgba(255,240,210,0)')
  cyl.addColorStop(0.34, 'rgba(255,240,210,0.16)')
  cyl.addColorStop(0.5, 'rgba(255,240,210,0.05)')
  cyl.addColorStop(1, 'rgba(40,26,10,0.14)')
  ctx.fillStyle = cyl
  ctx.fillRect(cx - rx, cyTop, rx * 2, cyBot - cyTop + ry)
  ctx.restore()

  // --- HEAD skin (top ellipse): parchment, key light top-left, tap dimple ---
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cyTop, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  const hlx = cx - rx * 0.3
  const hly = cyTop - ry * 0.34
  let hg = ctx.createRadialGradient(hlx, hly, ry * 0.1, cx, cyTop, rx * 1.05)
  hg.addColorStop(0, rgb(mix(SKIN, [255, 255, 255], 0.4)))
  hg.addColorStop(0.5, rgb(SKIN))
  hg.addColorStop(0.86, rgb(mix(SKIN, [150, 120, 78], 0.28)))
  hg.addColorStop(1, rgb(mix(SKIN, [110, 84, 52], 0.4))) // rim AO of the skin
  ctx.fillStyle = hg
  ctx.fillRect(cx - rx, cyTop - ry, rx * 2, ry * 2)
  // gentle central tap-dimple (a shallow concavity where the child taps)
  const dg = ctx.createRadialGradient(cx, cyTop, ry * 0.06, cx, cyTop, rx * 0.5)
  dg.addColorStop(0, 'rgba(120,92,58,0.12)')
  dg.addColorStop(0.7, 'rgba(120,92,58,0.03)')
  dg.addColorStop(1, 'rgba(120,92,58,0)')
  ctx.fillStyle = dg
  ctx.fillRect(cx - rx, cyTop - ry, rx * 2, ry * 2)
  ctx.restore()
  // faint concentric skin ring (the tuned membrane) + top-left sheen
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cyTop, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = 'rgba(120,92,58,0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, cyTop, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2)
  ctx.stroke()
  const sheen = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, rx * 0.6)
  sheen.addColorStop(0, 'rgba(255,255,255,0.34)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.beginPath()
  ctx.ellipse(hlx, hly, rx * 0.44, ry * 0.5, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- tension HOOP around the head + lugs ---
  ctx.strokeStyle = rgb(mix(OAK_DK, [255, 232, 196], 0.28))
  ctx.lineWidth = S * 0.032
  ctx.beginPath()
  ctx.ellipse(cx, cyTop, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
  // inner dark seam of the hoop for depth
  ctx.strokeStyle = 'rgba(40,26,12,0.4)'
  ctx.lineWidth = S * 0.01
  ctx.beginPath()
  ctx.ellipse(cx, cyTop, rx - S * 0.014, ry - S * 0.006, 0, 0, Math.PI * 2)
  ctx.stroke()
  // lit top-left of the hoop
  ctx.strokeStyle = 'rgba(255,244,214,0.5)'
  ctx.lineWidth = S * 0.012
  ctx.beginPath()
  ctx.ellipse(cx, cyTop, rx, ry, 0, Math.PI * 0.9, Math.PI * 1.75)
  ctx.stroke()
  // lugs around the hoop
  const LUGS = 8
  for (let i = 0; i < LUGS; i++) {
    const a = (i / LUGS) * Math.PI * 2 + 0.2
    const lx = cx + Math.cos(a) * rx
    const ly = cyTop + Math.sin(a) * ry
    const lr = S * 0.026
    const lit = Math.cos(a - Math.PI * 1.25) // brighter top-left
    const lg = ctx.createRadialGradient(lx - lr * 0.3, ly - lr * 0.3, lr * 0.1, lx, ly, lr)
    lg.addColorStop(0, rgb(mix(OAK_DK, [255, 236, 200], 0.4 + lit * 0.2)))
    lg.addColorStop(1, rgb(mix(OAK_DK, [20, 12, 4], 0.35)))
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.arc(lx, ly, lr, 0, Math.PI * 2)
    ctx.fill()
  }

  grainPass(ctx, S, S, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('drum.png'), buf)
  console.log('  ✓', 'drum.png', `${S}×${S}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE COUNT-BEAD (lit) — a glossy shaded amber orb with its own contact shadow.
// ============================================================================
function bakeBead(base, name) {
  const BS = 168
  const cv = createCanvas(BS, BS)
  const ctx = cv.getContext('2d')
  const cx = BS * 0.5
  const cy = BS * 0.46
  const r = BS * 0.36

  ctx.save()
  ctx.translate(cx, cy + r * 0.98)
  ctx.scale(1, 0.34)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.92)
  sh.addColorStop(0, 'rgba(24,18,10,0.34)')
  sh.addColorStop(0.62, 'rgba(24,18,10,0.18)')
  sh.addColorStop(1, 'rgba(24,18,10,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const hlx = cx - r * 0.34
  const hly = cy - r * 0.4
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  let g = ctx.createRadialGradient(hlx, hly, r * 0.06, cx, cy, r * 1.18)
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.52)))
  g.addColorStop(0.42, rgb(base))
  g.addColorStop(0.82, rgb(mix(base, [40, 26, 12], 0.26)))
  g.addColorStop(1, rgb(mix(base, [30, 20, 10], 0.44)))
  ctx.fillStyle = g
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  const rim = ctx.createRadialGradient(cx + r * 0.5, cy + r * 0.62, r * 0.02, cx + r * 0.5, cy + r * 0.62, r * 0.7)
  rim.addColorStop(0, rgb(mix(base, [255, 250, 240], 0.32), 0.5))
  rim.addColorStop(1, rgb(base, 0))
  ctx.fillStyle = rim
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const sp = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, r * 0.5)
  sp.addColorStop(0, 'rgba(255,255,255,0.9)')
  sp.addColorStop(0.5, 'rgba(255,255,255,0.28)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sp
  ctx.beginPath()
  ctx.ellipse(hlx, hly, r * 0.4, r * 0.3, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  grainPass(ctx, BS, BS, 0.04)
  ctx.beginPath()
  ctx.arc(cx, cy, r - 0.5, -Math.PI * 0.85, Math.PI * 0.15)
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = BS * 0.012
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r - 0.5, Math.PI * 0.15, Math.PI * 1.15)
  ctx.strokeStyle = 'rgba(30,20,10,0.22)'
  ctx.lineWidth = BS * 0.012
  ctx.stroke()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file(name), buf)
  console.log('  ✓', name, `${BS}×${BS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE SOCKET (unlit dot) — an empty recessed cup carved into the rail.
// ============================================================================
function bakeSocket() {
  const BS = 168
  const cv = createCanvas(BS, BS)
  const ctx = cv.getContext('2d')
  const cx = BS * 0.5
  const cy = BS * 0.46
  const r = BS * 0.36

  let ao = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.16)
  ao.addColorStop(0, 'rgba(20,14,6,0)')
  ao.addColorStop(0.7, 'rgba(20,14,6,0.26)')
  ao.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ao
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.16, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const pit = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.1, cx, cy + r * 0.2, r * 1.1)
  pit.addColorStop(0, rgb(mix(OAK, [18, 12, 4], 0.6)))
  pit.addColorStop(0.6, rgb(mix(OAK, [26, 16, 6], 0.42)))
  pit.addColorStop(1, rgb(mix(OAK, [40, 26, 10], 0.24)))
  ctx.fillStyle = pit
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  const top = ctx.createLinearGradient(0, cy - r, 0, cy)
  top.addColorStop(0, 'rgba(14,9,3,0.48)')
  top.addColorStop(1, 'rgba(14,9,3,0)')
  ctx.fillStyle = top
  ctx.fillRect(cx - r, cy - r, r * 2, r)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,244,214,0.46)'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0.16, Math.PI - 0.16)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(20,12,4,0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, Math.PI + 0.16, -0.16)
  ctx.stroke()

  grainPass(ctx, BS, BS, 0.03)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('socket.png'), buf)
  console.log('  ✓', 'socket.png', `${BS}×${BS}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE RAIL — the slim wooden strip the count-beads rest on. Stretched by CSS.
// ============================================================================
function bakeRail() {
  const W = 512
  const H = 108
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const topY = 10
  const faceH = 66
  const bevelH = 18

  const ds = ctx.createLinearGradient(0, topY + faceH + bevelH, 0, H)
  ds.addColorStop(0, 'rgba(20,14,6,0.3)')
  ds.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = ds
  ctx.fillRect(0, topY + faceH + bevelH, W, H - (topY + faceH + bevelH))

  ctx.save()
  roundRectPath(ctx, 0, topY, W, faceH, 16)
  ctx.clip()
  let g = ctx.createLinearGradient(0, topY, 0, topY + faceH)
  g.addColorStop(0, rgb(mix(OAK, [255, 240, 210], 0.28)))
  g.addColorStop(0.5, rgb(OAK))
  g.addColorStop(1, rgb(mix(OAK, [40, 26, 10], 0.24)))
  ctx.fillStyle = g
  ctx.fillRect(0, topY, W, faceH)
  grainStreaks(ctx, 0, topY, W, faceH, 48, rgb(mix(OAK, [255, 240, 210], 0.4)), rgb(mix(OAK, [30, 18, 6], 0.5)))
  const ao = ctx.createLinearGradient(0, topY, 0, topY + 26)
  ao.addColorStop(0, 'rgba(30,20,8,0.3)')
  ao.addColorStop(1, 'rgba(30,20,8,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, topY, W, 26)
  ctx.restore()

  ctx.save()
  roundRectPath(ctx, 0, topY + faceH - 14, W, bevelH + 14, 16)
  ctx.clip()
  const fbg = ctx.createLinearGradient(0, topY + faceH, 0, topY + faceH + bevelH)
  fbg.addColorStop(0, rgb(mix(OAK, [30, 18, 6], 0.3)))
  fbg.addColorStop(1, rgb(mix(OAK, [20, 12, 4], 0.5)))
  ctx.fillStyle = fbg
  ctx.fillRect(0, topY + faceH, W, bevelH)
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,244,214,0.52)'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(14, topY + faceH + 1)
  ctx.lineTo(W - 14, topY + faceH + 1)
  ctx.stroke()

  grainPass(ctx, W, H, 0.035)
  const buf = cv.toBuffer('image/png')
  writeFileSync(file('rail.png'), buf)
  console.log('  ✓', 'rail.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE PICTURE CARD — a wood frame around a bright cream mat (legible text).
// ============================================================================
function bakePanel() {
  const W = 512
  const H = 392
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const pad = 8 // drop-shadow room
  const frame = 26 // frame thickness

  // outer drop shadow
  ctx.save()
  roundRectPath(ctx, pad + 4, pad + 8, W - pad * 2, H - pad * 2, 30)
  const ds = ctx.createLinearGradient(0, pad, 0, H)
  ds.addColorStop(0, 'rgba(20,14,6,0)')
  ds.addColorStop(1, 'rgba(20,14,6,0.34)')
  ctx.fillStyle = ds
  ctx.fill()
  ctx.restore()

  // wood frame
  ctx.save()
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, 28)
  ctx.clip()
  let g = ctx.createLinearGradient(0, pad, W, H)
  g.addColorStop(0, rgb(mix(OAK, [255, 236, 200], 0.3)))
  g.addColorStop(0.5, rgb(OAK))
  g.addColorStop(1, rgb(mix(OAK, [30, 18, 6], 0.34)))
  ctx.fillStyle = g
  ctx.fillRect(pad, pad, W, H)
  grainStreaks(ctx, pad, pad, W - pad * 2, H - pad * 2, 60, rgb(mix(OAK, [255, 240, 210], 0.4)), rgb(mix(OAK, [30, 18, 6], 0.5)))
  ctx.restore()
  // lit top-left frame edge + dark bottom-right
  ctx.save()
  roundRectPath(ctx, pad + 1.5, pad + 1.5, W - pad * 2 - 3, H - pad * 2 - 3, 26)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,244,214,0.45)'
  ctx.stroke()
  ctx.restore()

  // inner cream mat
  const ix = pad + frame
  const iy = pad + frame
  const iw = W - (pad + frame) * 2
  const ih = H - (pad + frame) * 2
  ctx.save()
  roundRectPath(ctx, ix, iy, iw, ih, 16)
  ctx.clip()
  let mg = ctx.createLinearGradient(0, iy, 0, iy + ih)
  mg.addColorStop(0, rgb(mix(MAT, [255, 255, 255], 0.35)))
  mg.addColorStop(0.55, rgb(MAT))
  mg.addColorStop(1, rgb(mix(MAT, [150, 130, 96], 0.16)))
  ctx.fillStyle = mg
  ctx.fillRect(ix, iy, iw, ih)
  // inner-bevel AO around the mat (frame casts a shadow onto the mat)
  const bao = ctx.createLinearGradient(0, iy, 0, iy + 30)
  bao.addColorStop(0, 'rgba(60,42,20,0.3)')
  bao.addColorStop(1, 'rgba(60,42,20,0)')
  ctx.fillStyle = bao
  ctx.fillRect(ix, iy, iw, 30)
  const bao2 = ctx.createLinearGradient(ix, 0, ix + 30, 0)
  bao2.addColorStop(0, 'rgba(60,42,20,0.26)')
  bao2.addColorStop(1, 'rgba(60,42,20,0)')
  ctx.fillStyle = bao2
  ctx.fillRect(ix, iy, 30, ih)
  grainPass(ctx, W, H, 0.02)
  ctx.restore()
  // crisp mat rim
  ctx.save()
  roundRectPath(ctx, ix, iy, iw, ih, 16)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(40,28,14,0.28)'
  ctx.stroke()
  ctx.restore()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('panel.png'), buf)
  console.log('  ✓', 'panel.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

// ============================================================================
// THE RUG — a soft oval woven mat the drum + buddy stand on (grounding).
// ============================================================================
function bakeRug() {
  const W = 480
  const H = 220
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W * 0.5
  const cy = H * 0.54
  const rx = W * 0.46
  const ry = H * 0.42

  // soft outer shadow under the rug
  ctx.save()
  ctx.translate(cx, cy + ry * 0.16)
  ctx.scale(1, 1)
  const os = ctx.createRadialGradient(0, 0, ry * 0.5, 0, 0, rx)
  os.addColorStop(0, 'rgba(20,14,6,0.22)')
  os.addColorStop(0.8, 'rgba(20,14,6,0.08)')
  os.addColorStop(1, 'rgba(20,14,6,0)')
  ctx.fillStyle = os
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // the woven body
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx * 0.94, ry * 0.9, 0, 0, Math.PI * 2)
  ctx.clip()
  let g = ctx.createRadialGradient(cx - rx * 0.16, cy - ry * 0.2, ry * 0.2, cx, cy, rx)
  g.addColorStop(0, rgb(mix(SAGE, [255, 255, 250], 0.24)))
  g.addColorStop(0.6, rgb(SAGE))
  g.addColorStop(1, rgb(mix(SAGE, [60, 66, 54], 0.32)))
  ctx.fillStyle = g
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
  // concentric woven rings
  for (let i = 1; i <= 5; i++) {
    const t = i / 6
    ctx.strokeStyle = i % 2 ? rgb(mix(SAGE, [255, 255, 250], 0.2), 0.5) : rgb(mix(SAGE, [70, 76, 62], 0.4), 0.5)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx * 0.94 * t, ry * 0.9 * t, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  // radial weave hatching
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 22) {
    ctx.strokeStyle = 'rgba(60,66,54,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)
    ctx.stroke()
  }
  grainPass(ctx, W, H, 0.05)
  ctx.restore()
  // a soft light pool centre + rim shade
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx * 0.94, ry * 0.9, 0, 0, Math.PI * 2)
  ctx.clip()
  const lp = ctx.createRadialGradient(cx - rx * 0.14, cy - ry * 0.22, ry * 0.1, cx, cy, rx)
  lp.addColorStop(0, 'rgba(255,255,240,0.18)')
  lp.addColorStop(0.7, 'rgba(255,255,240,0)')
  ctx.fillStyle = lp
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2)
  ctx.restore()
  // lit rim (top-left) + dark rim (bottom-right)
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx * 0.94, ry * 0.9, 0, Math.PI * 0.9, Math.PI * 1.8)
  ctx.strokeStyle = 'rgba(255,255,246,0.4)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx * 0.94, ry * 0.9, 0, Math.PI * 1.85, Math.PI * 0.85)
  ctx.strokeStyle = 'rgba(40,44,34,0.28)'
  ctx.lineWidth = 3
  ctx.stroke()

  const buf = cv.toBuffer('image/png')
  writeFileSync(file('rug.png'), buf)
  console.log('  ✓', 'rug.png', `${W}×${H}`, (buf.length / 1024).toFixed(0) + 'KB')
}

console.log('Baking syllables art →')
bakeDrum()
bakeBead(AMBER, 'bead-on.png')
bakeSocket()
bakeRail()
bakePanel()
bakeRug()
console.log('Done.')
