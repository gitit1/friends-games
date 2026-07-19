// Bakes the FeedAnimals materials (food sprites, ceramic bowl, wooden board,
// meadow backdrop) as raster art with baked soft lighting + texture/AO.
// Draws on an offscreen <canvas> inside a headless Chromium (puppeteer), then
// writes the PNG/JPEG files. Muted, sensory-calm palette.
// One-off build tool — needs puppeteer installed: `npm i -D puppeteer && node scripts/gen-feedanimals-art.mjs`
// (puppeteer is not kept as a permanent dependency; reinstall it to regenerate.)
import puppeteer from 'puppeteer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT_SPR = fileURLToPath(new URL('../public/art/sprites/feedanimals/', import.meta.url))
const OUT_BG = fileURLToPath(new URL('../public/art/bg/', import.meta.url))
mkdirSync(OUT_SPR, { recursive: true })
mkdirSync(OUT_BG, { recursive: true })

// ── the drawing program runs in the browser; returns { name: dataURL } ──
const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  // sprinkle soft speckle texture inside a clipped shape
  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.6 + Math.random() * 1.6
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.05 + Math.random() * 0.12
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /* ───────── BONE (dog treat) ───────── */
  {
    const c = cv(160, 160), x = c.getContext('2d')
    x.translate(80, 80); x.rotate(-0.18)
    const knob = (kx, ky) => { x.beginPath(); x.arc(kx, ky, 22, 0, 7); x.fill() }
    const g = x.createLinearGradient(-60, -40, 60, 40)
    g.addColorStop(0, '#f0e6d0'); g.addColorStop(0.5, '#d8c39a'); g.addColorStop(1, '#b39a70')
    x.fillStyle = g
    // shaft + 4 knobs (union)
    x.save()
    knob(-52, -26); knob(-52, 26); knob(52, -26); knob(52, 26)
    x.beginPath(); x.moveTo(-52, -22); x.lineTo(52, -22); x.lineTo(52, 22); x.lineTo(-52, 22); x.closePath(); x.fill()
    x.beginPath(); x.rect(-58, -14, 116, 28); x.fill()
    x.restore()
    // baked top-left highlight
    const hl = x.createRadialGradient(-40, -34, 4, -40, -34, 80)
    hl.addColorStop(0, 'rgba(255,252,244,0.55)'); hl.addColorStop(1, 'rgba(255,252,244,0)')
    x.fillStyle = hl
    knob(-52, -26); knob(-52, 26); knob(52, -26); knob(52, 26); x.fillRect(-58, -14, 116, 28)
    // bottom AO band
    const ao = x.createLinearGradient(0, 6, 0, 30)
    ao.addColorStop(0, 'rgba(90,66,34,0)'); ao.addColorStop(1, 'rgba(90,66,34,0.28)')
    x.fillStyle = ao
    knob(-52, 26); knob(52, 26); x.fillRect(-58, 2, 116, 12)
    speckle(x, -74, -48, 148, 96, 260, '#fff8ea', '#8a6f42')
    x.setTransform(1, 0, 0, 1, 0, 0)
    A['food-bone'] = c.toDataURL('image/png')
  }

  /* ───────── FISH (cat treat) ───────── */
  {
    const c = cv(170, 130), x = c.getContext('2d')
    x.translate(6, 8)
    // tail
    x.beginPath(); x.moveTo(118, 55); x.lineTo(158, 30); x.lineTo(150, 55); x.lineTo(158, 80); x.closePath()
    x.fillStyle = '#c9836a'; x.fill()
    // body
    const g = x.createLinearGradient(0, 18, 0, 96)
    g.addColorStop(0, '#efb69b'); g.addColorStop(0.5, '#df9074'); g.addColorStop(1, '#c47257')
    x.fillStyle = g
    x.beginPath(); x.moveTo(20, 55); x.bezierCurveTo(40, 8, 110, 12, 128, 55); x.bezierCurveTo(110, 98, 40, 102, 20, 55); x.closePath(); x.fill()
    // belly lighter
    const bl = x.createLinearGradient(0, 60, 0, 96)
    bl.addColorStop(0, 'rgba(255,235,222,0)'); bl.addColorStop(1, 'rgba(255,235,222,0.5)')
    x.fillStyle = bl
    x.beginPath(); x.moveTo(20, 55); x.bezierCurveTo(40, 90, 110, 96, 128, 55); x.bezierCurveTo(110, 98, 40, 102, 20, 55); x.closePath(); x.fill()
    // top fin
    x.beginPath(); x.moveTo(62, 20); x.quadraticCurveTo(80, 2, 96, 22); x.quadraticCurveTo(80, 24, 62, 20); x.closePath()
    x.fillStyle = '#cf876c'; x.fill()
    // top highlight
    const hl = x.createRadialGradient(58, 34, 4, 58, 34, 60)
    hl.addColorStop(0, 'rgba(255,250,242,0.55)'); hl.addColorStop(1, 'rgba(255,250,242,0)')
    x.fillStyle = hl; x.beginPath(); x.ellipse(66, 42, 46, 26, 0, 0, 7); x.fill()
    // gill + scales
    x.strokeStyle = 'rgba(150,86,64,0.5)'; x.lineWidth = 2.4
    x.beginPath(); x.moveTo(46, 26); x.quadraticCurveTo(38, 55, 46, 84); x.stroke()
    x.lineWidth = 1.4; x.strokeStyle = 'rgba(150,86,64,0.3)'
    for (let r = 0; r < 3; r++) for (let cx = 60; cx < 120; cx += 16) {
      x.beginPath(); x.arc(cx, 40 + r * 16, 8, 0.5, 2.64); x.stroke()
    }
    // eye
    x.fillStyle = '#3a2418'; x.beginPath(); x.arc(38, 46, 6.5, 0, 7); x.fill()
    x.fillStyle = '#fff'; x.beginPath(); x.arc(36, 44, 2.2, 0, 7); x.fill()
    x.setTransform(1, 0, 0, 1, 0, 0)
    A['food-fish'] = c.toDataURL('image/png')
  }

  /* ───────── CARROT (rabbit treat) ───────── */
  {
    const c = cv(150, 160), x = c.getContext('2d')
    x.translate(75, 78); x.rotate(0.12)
    // body (point down)
    const g = x.createLinearGradient(-30, 0, 34, 0)
    g.addColorStop(0, '#e8a866'); g.addColorStop(0.5, '#d17f37'); g.addColorStop(1, '#a85f22')
    x.fillStyle = g
    x.beginPath(); x.moveTo(-30, -46); x.quadraticCurveTo(0, -58, 30, -46); x.quadraticCurveTo(16, 20, 2, 66); x.quadraticCurveTo(-2, 72, -6, 66); x.quadraticCurveTo(-20, 12, -30, -46); x.closePath(); x.fill()
    // left highlight
    const hl = x.createLinearGradient(-30, 0, 6, 0)
    hl.addColorStop(0, 'rgba(255,238,210,0.5)'); hl.addColorStop(1, 'rgba(255,238,210,0)')
    x.fillStyle = hl
    x.beginPath(); x.moveTo(-30, -46); x.quadraticCurveTo(0, -58, 30, -46); x.quadraticCurveTo(16, 20, 2, 66); x.quadraticCurveTo(-2, 72, -6, 66); x.quadraticCurveTo(-20, 12, -30, -46); x.closePath(); x.fill()
    // ridge lines
    x.strokeStyle = 'rgba(120,64,20,0.4)'; x.lineWidth = 2
    for (let i = 0; i < 5; i++) { const yy = -34 + i * 20; const wv = 26 - i * 4.4; x.beginPath(); x.moveTo(-wv, yy); x.quadraticCurveTo(0, yy + 6, wv, yy - 2); x.stroke() }
    // leaves
    const leaf = (ang, len) => { x.save(); x.rotate(ang); const lg = x.createLinearGradient(0, -len, 0, 0); lg.addColorStop(0, '#8fb85f'); lg.addColorStop(1, '#5d8c3a'); x.fillStyle = lg; x.beginPath(); x.moveTo(0, -6); x.quadraticCurveTo(-9, -len * 0.6, 0, -len); x.quadraticCurveTo(9, -len * 0.6, 0, -6); x.closePath(); x.fill(); x.restore() }
    x.save(); x.translate(-2, -48); leaf(-0.42, 52); leaf(0, 62); leaf(0.42, 50); x.restore()
    x.setTransform(1, 0, 0, 1, 0, 0)
    A['food-carrot'] = c.toDataURL('image/png')
  }

  /* ───────── SUNFLOWER (parrot treat) ───────── */
  {
    const c = cv(150, 150), x = c.getContext('2d'); x.translate(75, 75)
    // petals
    const n = 15
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; x.save(); x.rotate(a)
      const pg = x.createLinearGradient(0, -62, 0, -26)
      pg.addColorStop(0, '#eec863'); pg.addColorStop(1, '#dcab38')
      x.fillStyle = pg
      x.beginPath(); x.moveTo(0, -26); x.quadraticCurveTo(-11, -50, 0, -64); x.quadraticCurveTo(11, -50, 0, -26); x.closePath(); x.fill()
      x.restore()
    }
    // petal soft highlight (top-left)
    const ph = x.createRadialGradient(-16, -18, 4, -16, -18, 64)
    ph.addColorStop(0, 'rgba(255,247,214,0.4)'); ph.addColorStop(1, 'rgba(255,247,214,0)')
    x.fillStyle = ph; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.fill()
    // seed center
    const cg = x.createRadialGradient(-6, -8, 4, 0, 0, 30)
    cg.addColorStop(0, '#7a5228'); cg.addColorStop(1, '#553714')
    x.fillStyle = cg; x.beginPath(); x.arc(0, 0, 28, 0, 7); x.fill()
    // seed dots (spiral-ish grid)
    for (let i = 0; i < 90; i++) {
      const rr = Math.sqrt(Math.random()) * 25, a = Math.random() * 7
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr
      x.beginPath(); x.arc(px, py, 1.4, 0, 7)
      x.fillStyle = Math.random() < 0.5 ? '#4a3010' : '#8f6432'; x.globalAlpha = 0.8; x.fill()
    }
    x.globalAlpha = 1
    x.setTransform(1, 0, 0, 1, 0, 0)
    A['food-seed'] = c.toDataURL('image/png')
  }

  /* ───────── BOWL (ceramic, 3/4 view) — back + front parts ───────── */
  {
    const W = 260, H = 168
    const cx = W / 2, rimY = 52, rxO = 108, ryO = 30, bodyBot = 150
    // back part: body + interior + back rim
    const cb = cv(W, H), b = cb.getContext('2d')
    // outer body
    const bg = b.createLinearGradient(0, rimY, 0, bodyBot)
    bg.addColorStop(0, '#ecdcc2'); bg.addColorStop(0.55, '#d8c19d'); bg.addColorStop(1, '#bb9e75')
    b.fillStyle = bg
    b.beginPath(); b.moveTo(cx - rxO, rimY); b.bezierCurveTo(cx - rxO, bodyBot - 8, cx - rxO * 0.5, bodyBot, cx, bodyBot); b.bezierCurveTo(cx + rxO * 0.5, bodyBot, cx + rxO, bodyBot - 8, cx + rxO, rimY); b.closePath(); b.fill()
    // left light on the body
    const bl = b.createLinearGradient(cx - rxO, 0, cx + rxO, 0)
    bl.addColorStop(0, 'rgba(255,248,236,0.4)'); bl.addColorStop(0.4, 'rgba(255,248,236,0)'); bl.addColorStop(1, 'rgba(110,84,44,0.28)')
    b.fillStyle = bl
    b.beginPath(); b.moveTo(cx - rxO, rimY); b.bezierCurveTo(cx - rxO, bodyBot - 8, cx - rxO * 0.5, bodyBot, cx, bodyBot); b.bezierCurveTo(cx + rxO * 0.5, bodyBot, cx + rxO, bodyBot - 8, cx + rxO, rimY); b.closePath(); b.fill()
    // interior cavity (the top ellipse), darker at back = AO
    const ig = b.createRadialGradient(cx, rimY + 4, 8, cx, rimY + 10, rxO)
    ig.addColorStop(0, '#a98a5f'); ig.addColorStop(1, '#cbb489')
    b.fillStyle = ig
    b.beginPath(); b.ellipse(cx, rimY, rxO - 6, ryO - 4, 0, 0, 7); b.fill()
    // back inner-rim shadow
    b.strokeStyle = 'rgba(90,66,34,0.35)'; b.lineWidth = 4
    b.beginPath(); b.ellipse(cx, rimY, rxO - 6, ryO - 4, 0, Math.PI, Math.PI * 2); b.stroke()
    // outer rim highlight (top-left)
    b.strokeStyle = 'rgba(255,251,242,0.7)'; b.lineWidth = 3
    b.beginPath(); b.ellipse(cx, rimY, rxO, ryO, 0, Math.PI * 1.05, Math.PI * 1.7); b.stroke()
    A['bowl-back'] = cb.toDataURL('image/png')
    // front part: the near lip crescent (occludes the treats' bottoms)
    const cf = cv(W, H), f = cf.getContext('2d')
    const fg = f.createLinearGradient(0, rimY, 0, rimY + ryO * 2)
    fg.addColorStop(0, '#e2caa4'); fg.addColorStop(1, '#c8ac82')
    f.fillStyle = fg
    // ring between outer front ellipse and inner front ellipse
    f.beginPath(); f.ellipse(cx, rimY, rxO, ryO, 0, 0, Math.PI)
    f.ellipse(cx, rimY, rxO - 6, ryO - 4, 0, Math.PI, 0, true); f.closePath(); f.fill()
    f.strokeStyle = 'rgba(255,251,242,0.55)'; f.lineWidth = 2.5
    f.beginPath(); f.ellipse(cx, rimY, rxO, ryO, 0, 0.15, Math.PI - 0.15); f.stroke()
    A['bowl-front'] = cf.toDataURL('image/png')
  }

  /* ───────── WOODEN BOARD (near feeding surface, in perspective) ───────── */
  {
    const W = 560, H = 200, cxb = W / 2
    const c = cv(W, H), x = c.getContext('2d')
    const topY = 40, botY = 150, topHalf = 178, botHalf = 262
    // top face (trapezoid)
    const g = x.createLinearGradient(0, topY, 0, botY)
    g.addColorStop(0, '#a37b4b'); g.addColorStop(1, '#c49a64')
    x.fillStyle = g
    x.beginPath(); x.moveTo(cxb - topHalf, topY); x.lineTo(cxb + topHalf, topY); x.lineTo(cxb + botHalf, botY); x.lineTo(cxb - botHalf, botY); x.closePath()
    x.save(); x.clip(); x.fill()
    // wood grain streaks (perspective: horizontal bands)
    for (let i = 0; i < 22; i++) {
      const yy = topY + Math.random() * (botY - topY)
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,86,48,0.22)' : 'rgba(210,178,132,0.22)'
      x.lineWidth = 0.8 + Math.random() * 2
      x.beginPath(); x.moveTo(cxb - botHalf, yy)
      for (let sx = -botHalf; sx <= botHalf; sx += 40) x.lineTo(cxb + sx, yy + R(6))
      x.stroke()
    }
    // plank seams (converging toward the far edge)
    x.strokeStyle = 'rgba(84,58,30,0.4)'; x.lineWidth = 2
    for (const frac of [-0.5, 0, 0.5]) {
      x.beginPath(); x.moveTo(cxb + frac * topHalf * 2 * 0.5, topY); x.lineTo(cxb + frac * botHalf * 2 * 0.5, botY); x.stroke()
    }
    // far-edge AO
    const ao = x.createLinearGradient(0, topY, 0, topY + 40)
    ao.addColorStop(0, 'rgba(60,40,18,0.4)'); ao.addColorStop(1, 'rgba(60,40,18,0)')
    x.fillStyle = ao; x.fillRect(0, topY, W, 40)
    x.restore()
    // front bevel (thickness) — grounds the board
    x.fillStyle = '#8a6238'
    x.beginPath(); x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY); x.lineTo(cxb + botHalf, botY + 14); x.lineTo(cxb - botHalf, botY + 14); x.closePath(); x.fill()
    // near-edge highlight
    x.strokeStyle = 'rgba(228,198,150,0.8)'; x.lineWidth = 2.5
    x.beginPath(); x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY); x.stroke()
    A['board'] = c.toDataURL('image/png')
  }

  /* ───────── MEADOW BACKDROP (JPEG) ───────── */
  {
    const W = 800, H = 560
    const c = cv(W, H), x = c.getContext('2d')
    // sky
    const sky = x.createLinearGradient(0, 0, 0, H * 0.62)
    sky.addColorStop(0, '#c7dfe4'); sky.addColorStop(1, '#e9f0e2')
    x.fillStyle = sky; x.fillRect(0, 0, W, H)
    // soft sun glow
    const sun = x.createRadialGradient(W * 0.72, H * 0.2, 10, W * 0.72, H * 0.2, 260)
    sun.addColorStop(0, 'rgba(255,247,224,0.75)'); sun.addColorStop(1, 'rgba(255,247,224,0)')
    x.fillStyle = sun; x.fillRect(0, 0, W, H)
    // far hills (2 muted sage layers)
    const hill = (baseY, amp, col) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, H)
      x.lineTo(0, baseY)
      for (let sx = 0; sx <= W; sx += 40) x.lineTo(sx, baseY + Math.sin(sx / 130) * amp + Math.sin(sx / 47) * (amp * 0.35))
      x.lineTo(W, H); x.closePath(); x.fill()
    }
    hill(H * 0.5, 26, '#b7c9a4')
    hill(H * 0.56, 20, '#a3bd8c')
    // distant soft bushes
    for (const [bx, by, r, col] of [[120, H * 0.55, 46, '#93ac74'], [300, H * 0.57, 34, '#9db884'], [640, H * 0.55, 52, '#8fa96f'], [520, H * 0.58, 30, '#9db884']]) {
      x.fillStyle = col
      x.beginPath(); x.ellipse(bx, by, r, r * 0.72, 0, 0, 7); x.fill()
      const bh = x.createRadialGradient(bx - r * 0.3, by - r * 0.4, 2, bx, by, r)
      bh.addColorStop(0, 'rgba(220,232,196,0.4)'); bh.addColorStop(1, 'rgba(220,232,196,0)')
      x.fillStyle = bh; x.beginPath(); x.ellipse(bx, by, r, r * 0.72, 0, 0, 7); x.fill()
    }
    // grass foreground
    const grass = x.createLinearGradient(0, H * 0.6, 0, H)
    grass.addColorStop(0, '#9cbb78'); grass.addColorStop(1, '#7c9d5c')
    x.fillStyle = grass; x.beginPath(); x.moveTo(0, H * 0.62)
    for (let sx = 0; sx <= W; sx += 40) x.lineTo(sx, H * 0.62 + Math.sin(sx / 90) * 8)
    x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill()
    // grass texture blades
    for (let i = 0; i < 900; i++) {
      const gx = Math.random() * W, gy = H * 0.64 + Math.random() * (H * 0.36)
      const t = (gy - H * 0.64) / (H * 0.36)
      x.strokeStyle = `rgba(${90 + R(20)},${140 + R(24)},${74 + R(20)},${0.12 + t * 0.18})`
      x.lineWidth = 0.8 + t
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + R(4), gy - (3 + t * 7)); x.stroke()
    }
    // gentle vignette
    const vig = x.createRadialGradient(W / 2, H * 0.44, H * 0.3, W / 2, H * 0.5, H * 0.8)
    vig.addColorStop(0, 'rgba(20,30,20,0)'); vig.addColorStop(1, 'rgba(20,30,20,0.16)')
    x.fillStyle = vig; x.fillRect(0, 0, W, H)
    A['bg-meadow'] = c.toDataURL('image/jpeg', 0.82)
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
  const ext = isJpg ? 'jpg' : 'png'
  writeFileSync(dir + name + '.' + ext, buf)
  console.log('  ✓', name + '.' + ext, (buf.length / 1024).toFixed(1) + 'KB')
}
console.log('Done.')
