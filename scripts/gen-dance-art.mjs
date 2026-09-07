// Bakes the "ריקוד" (dance) toy's materials — REAL baked art for every surface the
// eye rests on, NOT flat CSS shapes+gradients:
//
//   bg/dance-stage.jpg   the stage ROOM backdrop: a warm muted evening wall with
//                        soft blurred stage-light glows (no strobe), a hint of side
//                        drapes, and a receding WOODEN dance FLOOR (real plank grain,
//                        perspective seams + depth bands, a warm centre stage-spot,
//                        back AO and a gentle vignette). Used via <SceneBackdrop>.
//   sprites/dance/ball.png     a hanging DISCO BALL — a faceted mirror sphere with
//                              baked tile facets, top-left key light, rim AO, a soft
//                              static glow and a cord/mount (muted silver-lavender,
//                              never neon; STATIC per the sensory rule).
//   sprites/dance/speaker.png  a stage SPEAKER cabinet — baked walnut wood grain,
//                              bevel + top-left key light + bottom-right AO, two
//                              recessed cones (woofer + tweeter) and a baked contact
//                              shadow so it sits on the floor. Mirrored in CSS for
//                              the far side.
//
// Same pipeline as the coin-sort / dice / bowling materials: an original
// @napi-rs/canvas bake with seeded value-noise material grain and analytic baked
// lighting/AO. No third-party art. Muted, sensory-calm palette.
//   npm i --no-save @napi-rs/canvas && node scripts/gen-dance-art.mjs

import { createCanvas } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT_SPR = new URL('../public/art/sprites/dance/', import.meta.url)
const OUT_BG = new URL('../public/art/bg/', import.meta.url)
mkdirSync(OUT_SPR, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })
const sprFile = (name) => new URL(name, OUT_SPR).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const bgFile = (name) => new URL(name, OUT_BG).pathname.replace(/^\/([A-Za-z]:)/, '$1')

// ---- seeded value noise (fbm) — the material grain generator (from gen-dice) ----
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

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// grain pass over every opaque pixel of a canvas region (kills the "flat CSS" read)
function grainPass(ctx, w, h, amp = 0.05, sc = 0.7) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) << 2
      if (d[idx + 3] < 8) continue
      const n = grain(x * sc, y * sc) * 0.6 + grain(x * sc * 3.1, y * sc * 3.1) * 0.4
      const m = 1 + n * amp
      d[idx] = clamp(d[idx] * m, 0, 255)
      d[idx + 1] = clamp(d[idx + 1] * m, 0, 255)
      d[idx + 2] = clamp(d[idx + 2] * m, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
}

// ============================================================================
// 1) THE STAGE ROOM BACKDROP — wall + soft stage lights + receding wood floor
// ============================================================================
function bakeBackdrop() {
  const W = 840
  const H = 580
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  const floorTop = H * 0.6 // where the wall meets the dance floor

  // --- back wall: warm muted evening violet, brighter toward the upper-centre ---
  const wall = ctx.createRadialGradient(W * 0.5, H * 0.02, 40, W * 0.5, H * 0.34, W * 0.82)
  wall.addColorStop(0, '#4a4260')
  wall.addColorStop(0.5, '#3a3450')
  wall.addColorStop(1, '#2b2740')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, floorTop + 2)

  // --- soft blurred stage-light glows on the wall (muted, static, no strobe) ---
  const glow = (cx, cy, r, col, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, rgb(col, a))
    g.addColorStop(0.55, rgb(col, a * 0.4))
    g.addColorStop(1, rgb(col, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.82, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  glow(W * 0.2, H * 0.14, 200, [168, 142, 196], 0.5) // muted lavender
  glow(W * 0.82, H * 0.16, 190, [206, 146, 168], 0.44) // muted rose
  glow(W * 0.5, H * 0.05, 210, [136, 186, 190], 0.34) // muted teal
  glow(W * 0.66, H * 0.32, 150, [224, 190, 138], 0.28) // muted amber, lower

  // --- soft cone spotlights coming down from above (very low alpha, calm) ---
  const cone = (topX, col) => {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(topX, -20)
    ctx.lineTo(topX + 150, floorTop)
    ctx.lineTo(topX - 150, floorTop)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, -20, 0, floorTop)
    g.addColorStop(0, rgb(col, 0.22))
    g.addColorStop(1, rgb(col, 0))
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()
  }
  cone(W * 0.32, [222, 210, 236])
  cone(W * 0.68, [236, 214, 220])

  // --- a hint of side drapes (soft darker vertical shading at the wall edges) ---
  const drape = (x0, dir) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * 120, 0)
    g.addColorStop(0, 'rgba(20,17,32,0.5)')
    g.addColorStop(1, 'rgba(20,17,32,0)')
    ctx.fillStyle = g
    ctx.fillRect(Math.min(x0, x0 + dir * 120), 0, 120, floorTop)
    // a few soft fold streaks
    for (let i = 0; i < 4; i++) {
      const fx = x0 + dir * (14 + i * 26)
      const fg = ctx.createLinearGradient(fx - 8, 0, fx + 8, 0)
      fg.addColorStop(0, 'rgba(255,240,250,0)')
      fg.addColorStop(0.5, 'rgba(180,160,200,0.10)')
      fg.addColorStop(1, 'rgba(20,17,32,0)')
      ctx.fillStyle = fg
      ctx.fillRect(fx - 8, 0, 16, floorTop)
    }
  }
  drape(0, 1)
  drape(W, -1)

  // --- the receding WOODEN dance floor (lower ~40%) ---
  // base warm-oak vertical gradient (front lighter/warmer, back darker = depth)
  const OAK_HI = [154, 120, 82]
  const OAK_MID = [116, 88, 58]
  const OAK_LO = [78, 58, 38]
  const fg = ctx.createLinearGradient(0, floorTop, 0, H)
  fg.addColorStop(0, rgb(OAK_LO)) // far (at the wall) = darker
  fg.addColorStop(0.5, rgb(OAK_MID))
  fg.addColorStop(1, rgb(OAK_HI)) // near (front) = lighter/warmer
  ctx.fillStyle = fg
  ctx.fillRect(0, floorTop, W, H - floorTop)

  // per-plank wood grain, drawn in perspective rows that get shorter toward the back
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, floorTop, W, H - floorTop)
  ctx.clip()
  const vpx = W * 0.5 // vanishing point x
  // horizontal depth bands (plank ends) — spacing widens toward the front
  const bandYs = []
  for (let i = 0; i <= 7; i++) {
    const t = i / 7
    const yy = floorTop + Math.pow(t, 1.7) * (H - floorTop)
    bandYs.push(yy)
    ctx.strokeStyle = 'rgba(38,26,16,0.35)'
    ctx.lineWidth = 1 + t * 1.6
    ctx.beginPath()
    ctx.moveTo(0, yy)
    ctx.lineTo(W, yy)
    ctx.stroke()
    // lit lip just under each seam
    ctx.strokeStyle = 'rgba(236,208,164,0.10)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, yy + 1.5)
    ctx.lineTo(W, yy + 1.5)
    ctx.stroke()
  }
  // plank seams converging toward the vanishing point (perspective)
  for (let i = -6; i <= 6; i++) {
    const frontX = vpx + i * (W / 8)
    ctx.strokeStyle = 'rgba(40,27,16,0.34)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(vpx + (frontX - vpx) * 0.34, floorTop)
    ctx.lineTo(frontX, H)
    ctx.stroke()
  }
  // fine grain streaks along each near band (subtle)
  const gnoise = makeNoise(74210)
  for (let k = 0; k < 260; k++) {
    const t = Math.random()
    const yy = floorTop + Math.pow(t, 1.7) * (H - floorTop)
    const len = 20 + Math.random() * 90 * (0.4 + t)
    const x0 = Math.random() * W
    ctx.strokeStyle = gnoise(k, 0) > 0 ? 'rgba(60,42,26,0.20)' : 'rgba(214,182,138,0.14)'
    ctx.lineWidth = 0.6 + Math.random() * (0.8 + t)
    ctx.beginPath()
    ctx.moveTo(x0, yy)
    ctx.lineTo(x0 + len, yy + (Math.random() - 0.5) * 2)
    ctx.stroke()
  }
  ctx.restore()

  // --- warm centre stage-spot: a soft pool of light where the dancer stands ---
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, floorTop, W, H - floorTop)
  ctx.clip()
  const spot = ctx.createRadialGradient(W * 0.5, H * 0.9, 10, W * 0.5, H * 0.9, W * 0.42)
  spot.addColorStop(0, 'rgba(255,242,214,0.34)')
  spot.addColorStop(0.5, 'rgba(255,236,200,0.14)')
  spot.addColorStop(1, 'rgba(255,236,200,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, floorTop, W, H - floorTop)
  ctx.restore()

  // --- floor/wall seam: a lit contact edge + a soft AO band just above it ---
  const ao = ctx.createLinearGradient(0, floorTop - 40, 0, floorTop)
  ao.addColorStop(0, 'rgba(16,12,26,0)')
  ao.addColorStop(1, 'rgba(16,12,26,0.4)')
  ctx.fillStyle = ao
  ctx.fillRect(0, floorTop - 40, W, 40)
  ctx.strokeStyle = 'rgba(255,232,198,0.22)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, floorTop)
  ctx.lineTo(W, floorTop)
  ctx.stroke()

  // --- gentle vignette so the frame reads as a room, edges recede ---
  const vig = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.3, W / 2, H * 0.5, H * 0.9)
  vig.addColorStop(0, 'rgba(14,11,24,0)')
  vig.addColorStop(1, 'rgba(14,11,24,0.34)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  // material grain over the whole frame (very subtle — it's already photographic)
  grainPass(ctx, W, H, 0.03, 0.9)

  const buf = cv.toBuffer('image/jpeg', 82)
  writeFileSync(bgFile('dance-stage.jpg'), buf)
  console.log('  ✓ dance-stage.jpg', `${W}×${H}`, (buf.length / 1024).toFixed(1) + 'KB')
}

// ============================================================================
// 2) THE DISCO BALL — a hanging faceted mirror sphere (muted, static)
// ============================================================================
function bakeBall() {
  const W = 240
  const H = 300
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const cx = W / 2
  const R = 88
  const cy = H - R - 18 // sphere centre (leaves room for the cord above)

  // --- hanging cord + ceiling mount ---
  ctx.strokeStyle = 'rgba(120,112,140,0.9)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, cy - R + 4)
  ctx.stroke()
  // small mount cap at the top of the ball
  const capg = ctx.createLinearGradient(cx - 10, cy - R - 8, cx + 10, cy - R + 8)
  capg.addColorStop(0, '#b9b0cc')
  capg.addColorStop(1, '#726a86')
  ctx.fillStyle = capg
  roundRectPath(ctx, cx - 11, cy - R - 10, 22, 16, 5)
  ctx.fill()

  // --- soft static ambient glow behind the ball ---
  const gl = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.5)
  gl.addColorStop(0, 'rgba(206,196,228,0.34)')
  gl.addColorStop(0.6, 'rgba(198,188,222,0.12)')
  gl.addColorStop(1, 'rgba(198,188,222,0)')
  ctx.fillStyle = gl
  ctx.beginPath()
  ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2)
  ctx.fill()

  // --- the sphere body (base radial gradient, top-left key light) ---
  const body = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.4, R * 0.1, cx, cy, R * 1.06)
  body.addColorStop(0, '#e7e1f1')
  body.addColorStop(0.5, '#c2b9d8')
  body.addColorStop(1, '#8b83a6')
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = body
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

  // --- mirror tile facets — a spherical grid; each tile a tiny lit/shaded quad ---
  const L = [-0.6, -0.7] // key-light direction (top-left)
  const rows = 11
  for (let r = 0; r < rows; r++) {
    // latitude from -1 (top) .. +1 (bottom)
    const lat0 = -1 + (2 * r) / rows
    const lat1 = -1 + (2 * (r + 1)) / rows
    const yA = cy + lat0 * R
    const yB = cy + lat1 * R
    const wA = Math.sqrt(Math.max(0, 1 - lat0 * lat0)) * R
    const wB = Math.sqrt(Math.max(0, 1 - lat1 * lat1)) * R
    const cols = Math.max(4, Math.round(rows * Math.max(wA, wB) / R))
    for (let cI = 0; cI < cols; cI++) {
      const u0 = cI / cols
      const u1 = (cI + 1) / cols
      const xA0 = cx + (u0 * 2 - 1) * wA
      const xA1 = cx + (u1 * 2 - 1) * wA
      const xB0 = cx + (u0 * 2 - 1) * wB
      const xB1 = cx + (u1 * 2 - 1) * wB
      // facet centre in normalized sphere coords → surface normal (approx)
      const um = (u0 + u1) / 2
      const latm = (lat0 + lat1) / 2
      const nx = (um * 2 - 1) * Math.sqrt(Math.max(0, 1 - latm * latm))
      const ny = latm
      const nlen = Math.hypot(nx, ny) || 1
      const facing = clamp((nx / nlen) * L[0] + (ny / nlen) * L[1], -1, 1)
      const shade = 0.5 + facing * 0.5
      // muted silver-lavender tile, occasional cooler/warmer tint (no neon)
      let tile
      const tintPick = (r * 7 + cI * 3) % 11
      if (tintPick === 0) tile = mix([150, 168, 176], [210, 224, 228], shade) // faint teal
      else if (tintPick === 4) tile = mix([176, 150, 172], [226, 206, 224], shade) // faint mauve
      else tile = mix([120, 112, 140], [232, 226, 244], shade) // silver-lavender
      ctx.beginPath()
      ctx.moveTo(xA0, yA)
      ctx.lineTo(xA1, yA)
      ctx.lineTo(xB1, yB)
      ctx.lineTo(xB0, yB)
      ctx.closePath()
      ctx.fillStyle = rgb(tile)
      ctx.fill()
      // thin grout between tiles
      ctx.strokeStyle = 'rgba(40,36,54,0.28)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }

  // --- a couple of soft static glints on the lit side (small, never flashing) ---
  const glint = (gx, gy, gr) => {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    g.addColorStop(0, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(gx, gy, gr, 0, Math.PI * 2)
    ctx.fill()
  }
  glint(cx - R * 0.36, cy - R * 0.42, 16)
  glint(cx + R * 0.12, cy - R * 0.1, 9)

  // --- bottom-right ambient occlusion so the sphere reads round ---
  const sao = ctx.createRadialGradient(cx + R * 0.42, cy + R * 0.44, R * 0.2, cx + R * 0.3, cy + R * 0.34, R * 1.05)
  sao.addColorStop(0, 'rgba(28,22,44,0.4)')
  sao.addColorStop(1, 'rgba(28,22,44,0)')
  ctx.fillStyle = sao
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
  ctx.restore()

  // crisp rim: bright top-left arc, dark bottom-right arc
  ctx.lineWidth = 2.4
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.arc(cx, cy, R - 1, Math.PI * 0.7, Math.PI * 1.6)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(30,24,46,0.34)'
  ctx.beginPath()
  ctx.arc(cx, cy, R - 1, Math.PI * 1.6, Math.PI * 2.7)
  ctx.stroke()

  grainPass(ctx, W, H, 0.04, 0.8)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('ball.png'), buf)
  console.log('  ✓ ball.png', `${W}×${H}`, (buf.length / 1024).toFixed(1) + 'KB')
}

// ============================================================================
// 3) THE STAGE SPEAKER — a baked walnut cabinet with two recessed cones
// ============================================================================
function bakeSpeaker() {
  const W = 200
  const H = 300
  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')
  const bx = 26
  const by = 14
  const bw = W - 52
  const bh = H - 52
  const r = 16

  // --- baked contact shadow under the cabinet ---
  ctx.save()
  ctx.translate(W / 2, by + bh + 10)
  ctx.scale(1, 0.28)
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, bw * 0.62)
  sh.addColorStop(0, 'rgba(18,14,10,0.4)')
  sh.addColorStop(1, 'rgba(18,14,10,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.arc(0, 0, bw * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // --- cabinet body (walnut, key light top-left → AO bottom-right) ---
  const WAL_HI = [124, 92, 60]
  const WAL_MID = [92, 66, 42]
  const WAL_LO = [58, 40, 26]
  roundRectPath(ctx, bx, by, bw, bh, r)
  const body = ctx.createLinearGradient(bx, by, bx + bw, by + bh)
  body.addColorStop(0, rgb(mix(WAL_HI, [255, 244, 220], 0.14)))
  body.addColorStop(0.5, rgb(WAL_MID))
  body.addColorStop(1, rgb(WAL_LO))
  ctx.save()
  ctx.fillStyle = body
  ctx.fill()
  ctx.clip()
  // vertical wood grain streaks
  const wn = makeNoise(5150)
  for (let k = 0; k < 90; k++) {
    const gx = bx + Math.random() * bw
    ctx.strokeStyle = wn(k, 1) > 0 ? 'rgba(40,26,14,0.22)' : 'rgba(196,158,112,0.16)'
    ctx.lineWidth = 0.6 + Math.random() * 1.4
    ctx.beginPath()
    ctx.moveTo(gx, by + 2)
    let yy = by + 2
    let xx = gx
    while (yy < by + bh - 2) {
      yy += 14
      xx += (Math.random() - 0.5) * 4
      ctx.lineTo(xx, yy)
    }
    ctx.stroke()
  }
  // top-left key bloom + bottom-right AO
  const bloom = ctx.createRadialGradient(bx + bw * 0.28, by + bh * 0.16, 6, bx + bw * 0.28, by + bh * 0.16, bw)
  bloom.addColorStop(0, 'rgba(255,244,222,0.22)')
  bloom.addColorStop(1, 'rgba(255,244,222,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(bx, by, bw, bh)
  const cao = ctx.createRadialGradient(bx + bw * 0.86, by + bh * 0.9, bw * 0.1, bx + bw * 0.8, by + bh * 0.85, bw)
  cao.addColorStop(0, 'rgba(20,14,8,0.34)')
  cao.addColorStop(1, 'rgba(20,14,8,0)')
  ctx.fillStyle = cao
  ctx.fillRect(bx, by, bw, bh)
  ctx.restore()

  // --- a recessed cone (concave AO'd circle with a dust cap) ---
  const cone = (ccx, ccy, cr) => {
    // outer bevel ring (mounting bezel)
    const ring = ctx.createRadialGradient(ccx - cr * 0.3, ccy - cr * 0.3, cr * 0.6, ccx, ccy, cr * 1.16)
    ring.addColorStop(0, 'rgba(30,22,14,0.9)')
    ring.addColorStop(0.7, 'rgba(20,15,10,1)')
    ring.addColorStop(1, 'rgba(46,34,22,1)')
    ctx.fillStyle = ring
    ctx.beginPath()
    ctx.arc(ccx, ccy, cr * 1.16, 0, Math.PI * 2)
    ctx.fill()
    // the cone: dark, concave (light rim bottom-right, shadow top-left interior)
    const cg = ctx.createRadialGradient(ccx - cr * 0.34, ccy - cr * 0.34, cr * 0.1, ccx + cr * 0.2, ccy + cr * 0.24, cr)
    cg.addColorStop(0, 'rgba(20,17,15,1)')
    cg.addColorStop(0.6, 'rgba(38,32,28,1)')
    cg.addColorStop(1, 'rgba(70,60,52,1)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2)
    ctx.fill()
    // dust cap (raised centre) with a top-left sheen
    const capg = ctx.createRadialGradient(ccx - cr * 0.18, ccy - cr * 0.2, 1, ccx, ccy, cr * 0.36)
    capg.addColorStop(0, 'rgba(120,108,98,1)')
    capg.addColorStop(0.6, 'rgba(64,55,48,1)')
    capg.addColorStop(1, 'rgba(34,28,24,1)')
    ctx.fillStyle = capg
    ctx.beginPath()
    ctx.arc(ccx, ccy, cr * 0.34, 0, Math.PI * 2)
    ctx.fill()
    // rim highlight (bottom-right catch)
    ctx.strokeStyle = 'rgba(150,138,128,0.4)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(ccx, ccy, cr * 0.98, Math.PI * 0.1, Math.PI * 0.9)
    ctx.stroke()
  }
  const midX = bx + bw / 2
  cone(midX, by + bh * 0.66, bw * 0.3) // woofer (big, lower)
  cone(midX, by + bh * 0.24, bw * 0.15) // tweeter (small, upper)

  // cabinet bevel rim (bright top-left, dark bottom-right)
  ctx.save()
  roundRectPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, r - 1)
  ctx.clip()
  roundRectPath(ctx, bx, by, bw, bh, r)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,240,216,0.28)'
  ctx.stroke()
  ctx.restore()
  roundRectPath(ctx, bx, by, bw, bh, r)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(18,12,8,0.5)'
  ctx.stroke()

  grainPass(ctx, W, H, 0.045, 0.8)
  const buf = cv.toBuffer('image/png')
  writeFileSync(sprFile('speaker.png'), buf)
  console.log('  ✓ speaker.png', `${W}×${H}`, (buf.length / 1024).toFixed(1) + 'KB')
}

console.log('Baking dance art →')
bakeBackdrop()
bakeBall()
bakeSpeaker()
console.log('Done.')
