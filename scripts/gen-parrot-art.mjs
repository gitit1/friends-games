// Bakes the Parrot toy's materials — a REAL illustrated parrot (feathered body,
// wing, beak, blinking eye) rigged as separate baked-art layers, a wooden perch,
// and a warm calm scene backdrop. Everything is drawn on an offscreen <canvas>
// inside a headless Chromium (puppeteer), then written as PNG/JPEG with baked soft
// lighting, feather texture and ambient occlusion — NO flat CSS shapes.
//
// The parrot is baked once at 300x420 across four registered layers that share the
// SAME coordinate anchors, so the DOM can flutter the wing / open the beak / blink
// the eye purely via transform+opacity while the pixels stay real illustration.
//
// One-off build tool — needs puppeteer: `npm i -D puppeteer && node scripts/gen-parrot-art.mjs`
// (puppeteer is not a permanent dependency; reinstall to regenerate.)
import puppeteer from 'puppeteer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT_SPR = fileURLToPath(new URL('../public/art/sprites/parrot/', import.meta.url))
const OUT_BG = fileURLToPath(new URL('../public/art/bg/', import.meta.url))
mkdirSync(OUT_SPR, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })

// ── the drawing program runs in the browser; returns { name: dataURL } ──
const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  const W = 300, H = 420

  // shared anchors (canvas coords) — every parrot layer draws against these, so the
  // wing / lower-beak / blink overlays land EXACTLY over the base and can be hinged.
  const AN = {
    hx: 118, hy: 150, hr: 68,      // head centre + radius
    ex: 100, ey: 142, er: 14,      // eye centre + radius (faces inline-start/left)
    bx: 74, by: 170,               // beak base (hinge of the lower mandible)
    cx: 170, cy: 292, brx: 86, bry: 104, // body centre + radii
    wx: 188, wy: 244,              // near-wing shoulder hinge
    tx: 214, ty: 306,              // tail root
    fx: 150, fy: 398,              // feet on the perch
  }

  // muted / warm / sensory-calm palette (no neon)
  const C = {
    gLo: '#5f8a55', gMid: '#7fa877', gHi: '#aecb9e',   // sage body green
    belly: '#e9c79c', bellyLo: '#d3a870',              // warm cream chest
    coral: '#cf7f66', coralLo: '#b0654e', coralHi: '#e0a086', // muted red wing edge
    teal: '#6faaa6', tealLo: '#4d8480', tealHi: '#9cc9c2',    // muted teal tail
    amber: '#edb45e', amberLo: '#c98a34', amberHi: '#f6d79a', // beak
    beakSh: '#8a5a1f',
    eyeRim: '#d7a86a', eye: '#2c2118', throat: '#3a2a24',
    foot: '#b8925a', footLo: '#8f6a3c',
    cheek: 'rgba(224,150,140,0.42)',
  }

  // sprinkle soft speckle inside the current path region
  function speckle(x, cx, cy, rx, ry, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = cx + R(rx * 2), py = cy + R(ry * 2), r = 0.5 + Math.random() * 1.5
      x.beginPath(); x.arc(px, py, r, 0, 7)
      x.fillStyle = Math.random() < 0.5 ? light : dark
      x.globalAlpha = 0.05 + Math.random() * 0.1
      x.fill()
    }
    x.globalAlpha = 1
  }

  // rows of short curved feather strokes flowing along `ang`, clipped to the region
  function feathers(x, cx, cy, rx, ry, ang, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = cx + R(rx * 1.9), py = cy + R(ry * 1.9)
      const len = 5 + Math.random() * 9
      const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len
      x.beginPath(); x.moveTo(px, py)
      x.quadraticCurveTo(px + dx * 0.5 + R(3), py + dy * 0.5, px + dx, py + dy)
      x.strokeStyle = Math.random() < 0.5 ? light : dark
      x.globalAlpha = 0.06 + Math.random() * 0.1
      x.lineWidth = 0.8 + Math.random() * 1.1
      x.lineCap = 'round'
      x.stroke()
    }
    x.globalAlpha = 1
  }

  // a feathered blob: radial base gradient (top-left key light) + texture + AO rim
  function plume(x, cx, cy, rx, ry, hi, mid, lo, ang) {
    const g = x.createRadialGradient(cx - rx * 0.34, cy - ry * 0.4, ry * 0.12, cx, cy, Math.max(rx, ry) * 1.15)
    g.addColorStop(0, hi); g.addColorStop(0.52, mid); g.addColorStop(1, lo)
    x.fillStyle = g
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill()
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.clip()
    feathers(x, cx, cy, rx, ry, ang, Math.round(rx * ry * 0.05), hi, lo)
    speckle(x, cx, cy, rx, ry, Math.round(rx * ry * 0.03), hi, lo)
    // bottom-right ambient occlusion
    const ao = x.createRadialGradient(cx + rx * 0.4, cy + ry * 0.5, ry * 0.2, cx + rx * 0.3, cy + ry * 0.45, Math.max(rx, ry))
    ao.addColorStop(0, 'rgba(40,58,34,0.32)'); ao.addColorStop(1, 'rgba(40,58,34,0)')
    x.fillStyle = ao; x.fillRect(cx - rx * 1.4, cy - ry * 1.4, rx * 2.8, ry * 2.8)
    x.restore()
  }

  // ── the parts (each takes a ctx so we can compose different layers) ──
  const A0 = AN

  function drawTail(x) {
    // three long feathers fanning down-back (teal with amber tips)
    const feath = (ax, len, spread, rot) => {
      x.save(); x.translate(A0.tx, A0.ty); x.rotate(rot)
      const g = x.createLinearGradient(0, 0, 0, len)
      g.addColorStop(0, C.tealHi); g.addColorStop(0.55, C.teal); g.addColorStop(1, C.tealLo)
      x.fillStyle = g
      x.beginPath(); x.moveTo(-spread, 0)
      x.quadraticCurveTo(-spread * 0.6, len * 0.7, 0, len)
      x.quadraticCurveTo(spread * 0.6, len * 0.7, spread, 0)
      x.closePath(); x.fill()
      // amber tip
      const tg = x.createLinearGradient(0, len * 0.7, 0, len)
      tg.addColorStop(0, 'rgba(237,180,94,0)'); tg.addColorStop(1, C.amber)
      x.fillStyle = tg
      x.beginPath(); x.moveTo(-spread * 0.5, len * 0.72); x.quadraticCurveTo(0, len * 1.02, spread * 0.5, len * 0.72)
      x.quadraticCurveTo(0, len * 0.88, -spread * 0.5, len * 0.72); x.closePath(); x.fill()
      // centre shaft
      x.strokeStyle = 'rgba(40,64,60,0.4)'; x.lineWidth = 1.6
      x.beginPath(); x.moveTo(0, 4); x.lineTo(0, len - 4); x.stroke()
      x.restore()
    }
    feath(0, 118, 12, 0.34)
    feath(0, 132, 13, 0.14)
    feath(0, 120, 12, -0.05)
  }

  function drawFarWing(x) {
    // a hint of the far wing peeking behind the body's upper-back
    plume(x, 214, 250, 30, 46, C.gMid, C.gLo, '#4d7344', 1.1)
  }

  function drawBody(x) {
    plume(x, A0.cx, A0.cy, A0.brx, A0.bry, C.gHi, C.gMid, C.gLo, 1.35)
    // warm cream chest patch (front/lower-left of the body)
    x.save()
    x.beginPath(); x.ellipse(A0.cx, A0.cy, A0.brx, A0.bry, 0, 0, 7); x.clip()
    const bg = x.createRadialGradient(A0.cx - 26, A0.cy + 6, 8, A0.cx - 18, A0.cy + 18, 78)
    bg.addColorStop(0, C.belly); bg.addColorStop(0.7, C.bellyLo); bg.addColorStop(1, 'rgba(211,168,112,0)')
    x.fillStyle = bg
    x.beginPath(); x.ellipse(A0.cx - 20, A0.cy + 22, 46, 62, -0.12, 0, 7); x.fill()
    feathers(x, A0.cx - 20, A0.cy + 22, 42, 58, 1.5, 120, '#fbe7cc', C.bellyLo)
    x.restore()
  }

  function drawFeet(x) {
    x.strokeStyle = C.foot; x.lineCap = 'round'
    for (const off of [-14, 12]) {
      x.lineWidth = 9
      x.beginPath(); x.moveTo(A0.fx + off, A0.fy - 18); x.lineTo(A0.fx + off, A0.fy); x.stroke()
      // toes
      x.lineWidth = 5; x.strokeStyle = C.footLo
      for (const t of [-9, 0, 9]) { x.beginPath(); x.moveTo(A0.fx + off, A0.fy); x.lineTo(A0.fx + off + t, A0.fy + 10); x.stroke() }
      x.strokeStyle = C.foot
    }
  }

  function drawHead(x) {
    plume(x, A0.hx, A0.hy, A0.hr, A0.hr * 0.96, C.gHi, C.gMid, C.gLo, 1.2)
    // forehead brighter cap
    const cap = x.createRadialGradient(A0.hx - 18, A0.hy - 30, 6, A0.hx - 10, A0.hy - 20, 60)
    cap.addColorStop(0, 'rgba(214,236,196,0.55)'); cap.addColorStop(1, 'rgba(214,236,196,0)')
    x.fillStyle = cap; x.beginPath(); x.arc(A0.hx, A0.hy, A0.hr, 0, 7); x.fill()
    // cheek blush (toward the beak side)
    x.fillStyle = C.cheek
    x.beginPath(); x.ellipse(A0.ex + 6, A0.ey + 20, 17, 12, 0, 0, 7); x.fill()
    // eye ring
    const er = x.createRadialGradient(A0.ex, A0.ey, 2, A0.ex, A0.ey, A0.er + 5)
    er.addColorStop(0, 'rgba(247,224,180,0)'); er.addColorStop(0.7, C.eyeRim); er.addColorStop(1, 'rgba(160,120,70,0)')
    x.fillStyle = er; x.beginPath(); x.arc(A0.ex, A0.ey, A0.er + 5, 0, 7); x.fill()
    // eye (open) — glossy dark with catchlight
    const eg = x.createRadialGradient(A0.ex - 4, A0.ey - 5, 1, A0.ex, A0.ey, A0.er)
    eg.addColorStop(0, '#5a463a'); eg.addColorStop(0.5, C.eye); eg.addColorStop(1, '#140f0b')
    x.fillStyle = eg; x.beginPath(); x.arc(A0.ex, A0.ey, A0.er, 0, 7); x.fill()
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.arc(A0.ex - 4.5, A0.ey - 5, 3.4, 0, 7); x.fill()
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(A0.ex + 4, A0.ey + 4, 1.6, 0, 7); x.fill()
    // throat shadow (revealed when the beak opens)
    x.fillStyle = C.throat
    x.beginPath(); x.moveTo(A0.bx + 2, A0.by - 2); x.quadraticCurveTo(A0.bx - 6, A0.by + 10, A0.bx + 10, A0.by + 15)
    x.quadraticCurveTo(A0.bx + 22, A0.by + 8, A0.bx + 2, A0.by - 2); x.closePath(); x.fill()
    drawUpperBeak(x)
  }

  function drawUpperBeak(x) {
    // hooked upper mandible pointing inline-start (left), amber, top-lit
    const g = x.createLinearGradient(A0.bx - 30, A0.by - 20, A0.bx + 6, A0.by + 6)
    g.addColorStop(0, C.amberHi); g.addColorStop(0.5, C.amber); g.addColorStop(1, C.amberLo)
    x.fillStyle = g
    x.beginPath()
    x.moveTo(A0.bx + 6, A0.by - 18)
    x.quadraticCurveTo(A0.bx - 34, A0.by - 14, A0.bx - 40, A0.by + 6)   // top ridge to tip
    x.quadraticCurveTo(A0.bx - 40, A0.by + 20, A0.bx - 28, A0.by + 16)  // hook down
    x.quadraticCurveTo(A0.bx - 20, A0.by + 8, A0.bx + 4, A0.by + 4)     // underside back to base
    x.closePath(); x.fill()
    // ridge highlight + tip AO
    x.strokeStyle = 'rgba(255,244,214,0.6)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(A0.bx + 2, A0.by - 15); x.quadraticCurveTo(A0.bx - 28, A0.by - 11, A0.bx - 36, A0.by + 4); x.stroke()
    x.strokeStyle = 'rgba(138,90,31,0.5)'; x.lineWidth = 2.2
    x.beginPath(); x.moveTo(A0.bx - 34, A0.by + 8); x.quadraticCurveTo(A0.bx - 26, A0.by + 16, A0.bx - 16, A0.by + 8); x.stroke()
    // nostril (cere) at the base
    x.fillStyle = 'rgba(90,60,26,0.55)'; x.beginPath(); x.arc(A0.bx - 4, A0.by - 8, 2.2, 0, 7); x.fill()
  }

  function drawLowerBeak(x) {
    // smaller lower mandible, rests flush under the upper beak; hinge = beak base
    const g = x.createLinearGradient(A0.bx - 24, A0.by + 4, A0.bx + 4, A0.by + 20)
    g.addColorStop(0, C.amber); g.addColorStop(1, C.amberLo)
    x.fillStyle = g
    x.beginPath()
    x.moveTo(A0.bx + 4, A0.by + 4)
    x.quadraticCurveTo(A0.bx - 24, A0.by + 8, A0.bx - 26, A0.by + 15)
    x.quadraticCurveTo(A0.bx - 18, A0.by + 24, A0.bx + 2, A0.by + 18)
    x.closePath(); x.fill()
    x.strokeStyle = 'rgba(138,90,31,0.5)'; x.lineWidth = 1.6
    x.beginPath(); x.moveTo(A0.bx - 22, A0.by + 12); x.quadraticCurveTo(A0.bx - 12, A0.by + 20, A0.bx + 2, A0.by + 15); x.stroke()
  }

  function drawBlink(x) {
    // closed eyelid — feather-coloured dome with a soft lash line; fades in to blink
    const g = x.createLinearGradient(A0.ex, A0.ey - A0.er, A0.ex, A0.ey + A0.er)
    g.addColorStop(0, C.gMid); g.addColorStop(1, C.gLo)
    x.fillStyle = g
    x.beginPath(); x.arc(A0.ex, A0.ey, A0.er + 1.5, 0, 7); x.fill()
    // lash / crease
    x.strokeStyle = 'rgba(60,44,30,0.7)'; x.lineWidth = 2; x.lineCap = 'round'
    x.beginPath(); x.moveTo(A0.ex - A0.er, A0.ey + 1); x.quadraticCurveTo(A0.ex, A0.ey + 5, A0.ex + A0.er, A0.ey - 1); x.stroke()
    // top-left sheen on the lid
    const hl = x.createRadialGradient(A0.ex - 5, A0.ey - 5, 1, A0.ex, A0.ey, A0.er)
    hl.addColorStop(0, 'rgba(214,236,196,0.5)'); hl.addColorStop(1, 'rgba(214,236,196,0)')
    x.fillStyle = hl; x.beginPath(); x.arc(A0.ex, A0.ey, A0.er, 0, 7); x.fill()
  }

  function drawNearWing(x) {
    // near wing: green coverts + a muted-coral leading edge + teal-tipped flight
    // feathers. Drawn resting against the flank; hinged at the shoulder for flutter.
    x.save(); x.translate(A0.wx, A0.wy)
    // coverts (upper wing) — green
    const g = x.createLinearGradient(-6, -6, 30, 90)
    g.addColorStop(0, C.gHi); g.addColorStop(0.5, C.gMid); g.addColorStop(1, C.gLo)
    x.fillStyle = g
    x.beginPath(); x.moveTo(0, -6)
    x.quadraticCurveTo(38, 6, 34, 70)
    x.quadraticCurveTo(20, 104, -6, 96)
    x.quadraticCurveTo(-18, 40, 0, -6)
    x.closePath(); x.fill()
    // leading edge band — muted coral
    x.save(); x.clip()
    const lg = x.createLinearGradient(-14, 0, 18, 0)
    lg.addColorStop(0, C.coralHi); lg.addColorStop(0.6, C.coral); lg.addColorStop(1, 'rgba(176,101,78,0)')
    x.fillStyle = lg; x.fillRect(-18, -8, 30, 110)
    x.restore()
    // individual flight feathers (teal tips) along the trailing/lower edge
    x.save(); x.beginPath(); x.moveTo(0, -6); x.quadraticCurveTo(38, 6, 34, 70)
    x.quadraticCurveTo(20, 104, -6, 96); x.quadraticCurveTo(-18, 40, 0, -6); x.closePath(); x.clip()
    for (let i = 0; i < 5; i++) {
      const yy = 30 + i * 14
      x.strokeStyle = i > 2 ? 'rgba(77,132,128,0.7)' : 'rgba(40,64,44,0.5)'
      x.lineWidth = 2
      x.beginPath(); x.moveTo(6, yy); x.quadraticCurveTo(26, yy + 6, 30, yy + 18); x.stroke()
    }
    feathers(x, 12, 44, 26, 52, 1.4, 90, C.gHi, C.gLo)
    x.restore()
    // shoulder highlight + lower AO
    const hl = x.createRadialGradient(4, 8, 2, 6, 14, 40)
    hl.addColorStop(0, 'rgba(220,240,204,0.5)'); hl.addColorStop(1, 'rgba(220,240,204,0)')
    x.fillStyle = hl; x.beginPath(); x.arc(6, 12, 34, 0, 7); x.fill()
    x.strokeStyle = 'rgba(40,58,34,0.4)'; x.lineWidth = 3
    x.beginPath(); x.moveTo(-4, 92); x.quadraticCurveTo(18, 100, 32, 68); x.stroke()
    x.restore()
  }

  // ═══ LAYER 1: BODY (tail + far wing + body + feet + head + upper beak) ═══
  {
    const c = cv(W, H), x = c.getContext('2d')
    // soft contact shadow under the bird (grounds it on the perch)
    const sh = x.createRadialGradient(A0.fx, A0.fy + 6, 6, A0.fx, A0.fy + 6, 78)
    sh.addColorStop(0, 'rgba(30,22,12,0.28)'); sh.addColorStop(1, 'rgba(30,22,12,0)')
    x.fillStyle = sh; x.beginPath(); x.ellipse(A0.fx, A0.fy + 8, 74, 16, 0, 0, 7); x.fill()
    drawTail(x); drawFarWing(x); drawFeet(x); drawBody(x); drawHead(x)
    A['parrot-body'] = c.toDataURL('image/png')
  }
  // ═══ LAYER 2: NEAR WING (flutters) ═══
  { const c = cv(W, H), x = c.getContext('2d'); drawNearWing(x); A['parrot-wing'] = c.toDataURL('image/png') }
  // ═══ LAYER 3: LOWER BEAK (opens) ═══
  { const c = cv(W, H), x = c.getContext('2d'); drawLowerBeak(x); A['parrot-beak'] = c.toDataURL('image/png') }
  // ═══ LAYER 4: BLINK LID (fades in) ═══
  { const c = cv(W, H), x = c.getContext('2d'); drawBlink(x); A['parrot-blink'] = c.toDataURL('image/png') }

  // ═══ PERCH — a baked wooden branch the parrot grips ═══
  {
    const pw = 240, ph = 70, c = cv(pw, ph), x = c.getContext('2d')
    const g = x.createLinearGradient(0, 18, 0, 46)
    g.addColorStop(0, '#c39763'); g.addColorStop(0.5, '#a5763f'); g.addColorStop(1, '#7c5730')
    x.fillStyle = g
    x.beginPath(); x.moveTo(8, 30); x.quadraticCurveTo(pw / 2, 22, pw - 8, 30)
    x.quadraticCurveTo(pw - 4, 46, pw - 12, 48); x.quadraticCurveTo(pw / 2, 42, 12, 48)
    x.quadraticCurveTo(4, 46, 8, 30); x.closePath(); x.fill()
    // bark grain
    x.save(); x.beginPath(); x.moveTo(8, 30); x.quadraticCurveTo(pw / 2, 22, pw - 8, 30)
    x.quadraticCurveTo(pw - 4, 46, pw - 12, 48); x.quadraticCurveTo(pw / 2, 42, 12, 48)
    x.quadraticCurveTo(4, 46, 8, 30); x.closePath(); x.clip()
    for (let i = 0; i < 26; i++) {
      const yy = 26 + Math.random() * 20
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,84,44,0.4)' : 'rgba(214,176,128,0.35)'
      x.lineWidth = 0.7 + Math.random() * 1.4
      x.beginPath(); x.moveTo(6, yy); for (let sx = 6; sx < pw; sx += 30) x.lineTo(sx, yy + R(3)); x.stroke()
    }
    x.restore()
    // top highlight + underside AO
    x.strokeStyle = 'rgba(240,214,170,0.7)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(14, 28); x.quadraticCurveTo(pw / 2, 21, pw - 14, 28); x.stroke()
    const ao = x.createLinearGradient(0, 40, 0, 50)
    ao.addColorStop(0, 'rgba(50,32,14,0)'); ao.addColorStop(1, 'rgba(50,32,14,0.4)')
    x.fillStyle = ao; x.fillRect(0, 40, pw, 10)
    A['perch'] = c.toDataURL('image/png')
  }

  // ═══ BACKDROP — a warm calm room corner: soft wall, blurred tropical leaves,
  //     window light, and a receding wood floor (JPEG) ═══
  {
    const BW = 800, BH = 560, c = cv(BW, BH), x = c.getContext('2d')
    // warm olive back wall, brighter toward the upper-left window
    const wall = x.createRadialGradient(BW * 0.24, BH * 0.06, 30, BW * 0.4, BH * 0.4, BW * 0.9)
    wall.addColorStop(0, '#6a785a'); wall.addColorStop(0.5, '#56643f'); wall.addColorStop(1, '#414d34')
    x.fillStyle = wall; x.fillRect(0, 0, BW, BH)
    // soft window light glow (upper-left)
    const win = x.createRadialGradient(BW * 0.2, BH * 0.02, 20, BW * 0.2, BH * 0.05, 340)
    win.addColorStop(0, 'rgba(255,248,222,0.5)'); win.addColorStop(1, 'rgba(255,248,222,0)')
    x.fillStyle = win; x.fillRect(0, 0, BW, BH)
    // blurred tropical leaves on the wall
    x.filter = 'blur(4px)'
    const leaf = (lx, ly, r, rot, hi, lo) => {
      x.save(); x.translate(lx, ly); x.rotate(rot)
      const lg = x.createLinearGradient(0, -r, 0, r)
      lg.addColorStop(0, hi); lg.addColorStop(1, lo)
      x.fillStyle = lg
      x.beginPath(); x.moveTo(0, -r); x.quadraticCurveTo(r * 0.7, 0, 0, r); x.quadraticCurveTo(-r * 0.7, 0, 0, -r); x.closePath(); x.fill()
      x.strokeStyle = lo; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -r); x.lineTo(0, r); x.stroke()
      x.restore()
    }
    leaf(BW * 0.86, BH * 0.16, 88, 0.5, '#93b782', '#5f8a55')
    leaf(BW * 0.94, BH * 0.34, 70, -0.3, '#88ac7a', '#557d4b')
    leaf(BW * 0.74, BH * 0.08, 60, 0.9, '#9cbf8b', '#638e57')
    leaf(BW * 0.66, BH * 0.3, 44, -0.6, '#8fb47f', '#5a8350')
    x.filter = 'none'
    // receding warm wood floor (lower third, perspective bands)
    const floorTop = BH * 0.66
    const fg = x.createLinearGradient(0, floorTop, 0, BH)
    fg.addColorStop(0, '#8a6440'); fg.addColorStop(0.5, '#734f30'); fg.addColorStop(1, '#5a3e26')
    x.fillStyle = fg; x.fillRect(0, floorTop, BW, BH - floorTop)
    // plank lines converging toward the wall
    x.strokeStyle = 'rgba(40,26,14,0.4)'; x.lineWidth = 2
    for (let i = 0; i <= 8; i++) {
      const fx = (i / 8) * BW
      x.beginPath(); x.moveTo(BW * 0.5 + (fx - BW * 0.5) * 0.4, floorTop); x.lineTo(fx, BH); x.stroke()
    }
    for (let i = 1; i < 5; i++) {
      const yy = floorTop + Math.pow(i / 5, 1.6) * (BH - floorTop)
      x.strokeStyle = 'rgba(240,214,170,0.12)'; x.lineWidth = 1.5
      x.beginPath(); x.moveTo(0, yy); x.lineTo(BW, yy); x.stroke()
    }
    // floor/wall seam light
    x.strokeStyle = 'rgba(255,232,190,0.22)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(0, floorTop); x.lineTo(BW, floorTop); x.stroke()
    // gentle vignette
    const vig = x.createRadialGradient(BW / 2, BH * 0.42, BH * 0.32, BW / 2, BH * 0.5, BH * 0.85)
    vig.addColorStop(0, 'rgba(20,26,16,0)'); vig.addColorStop(1, 'rgba(20,26,16,0.24)')
    x.fillStyle = vig; x.fillRect(0, 0, BW, BH)
    A['bg-parrot-corner'] = c.toDataURL('image/jpeg', 0.82)
  }

  return A
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setContent('<!doctype html><html><body></body></html>')
const assets = await page.evaluate(DRAW)
await browser.close()

for (const [name, dataUrl] of Object.entries(assets)) {
  const isJpg = dataUrl.startsWith('data:image/jpeg')
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
  const dir = name.startsWith('bg-') ? OUT_BG : OUT_SPR
  const file = name.startsWith('bg-') ? name.slice(3) : name // bg-parrot-corner -> parrot-corner
  const ext = isJpg ? 'jpg' : 'png'
  writeFileSync(dir + file + '.' + ext, buf)
  console.log('  ✓', file + '.' + ext, (buf.length / 1024).toFixed(1) + 'KB')
}
console.log('Done.')
