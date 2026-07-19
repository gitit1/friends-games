// Bakes the "Catch a Friend" scene materials — a receding play-lawn floor, a soft
// shrub prop, and a near grass fringe — as raster art with baked soft lighting +
// texture/AO. Draws on an offscreen <canvas> inside a headless Chromium
// (puppeteer), then writes the PNG/JPEG files. Muted, sensory-calm palette.
// One-off build tool — needs puppeteer resolvable:
//   NODE_PATH=/path/to/node_modules node scripts/gen-catch-art.mjs
// (puppeteer is not a permanent dependency; point NODE_PATH at a dir that has it.)
import puppeteer from 'puppeteer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT_SPR = fileURLToPath(new URL('../public/art/sprites/catch/', import.meta.url))
mkdirSync(OUT_SPR, { recursive: true })

// ── the drawing program runs in the browser; returns { name: dataURL } ──
const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  // sprinkle soft speckle texture inside a rectangle
  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.5 + Math.random() * 1.5
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.05 + Math.random() * 0.1
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // a soft muted-green shrub blob with baked top-left light + bottom AO
  function drawBush(x, cx, cy, rx, ry, base, light, dark) {
    // body
    const g = x.createRadialGradient(cx - rx * 0.3, cy - ry * 0.5, 4, cx, cy, rx)
    g.addColorStop(0, light); g.addColorStop(0.6, base); g.addColorStop(1, dark)
    x.fillStyle = g
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill()
    // a few clustered lobes for a leafy silhouette
    for (const [ox, oy, rr] of [[-rx * 0.5, -ry * 0.2, rx * 0.5], [rx * 0.45, -ry * 0.1, rx * 0.46], [0, -ry * 0.55, rx * 0.5]]) {
      const lg = x.createRadialGradient(cx + ox - rr * 0.3, cy + oy - rr * 0.4, 2, cx + ox, cy + oy, rr)
      lg.addColorStop(0, light); lg.addColorStop(0.7, base); lg.addColorStop(1, dark)
      x.fillStyle = lg
      x.beginPath(); x.ellipse(cx + ox, cy + oy, rr, rr * 0.82, 0, 0, 7); x.fill()
    }
    // bottom contact AO
    const ao = x.createRadialGradient(cx, cy + ry * 0.7, 2, cx, cy + ry * 0.7, rx)
    ao.addColorStop(0, 'rgba(30,44,20,0.32)'); ao.addColorStop(1, 'rgba(30,44,20,0)')
    x.fillStyle = ao
    x.beginPath(); x.ellipse(cx, cy + ry * 0.82, rx * 0.9, ry * 0.4, 0, 0, 7); x.fill()
    // leaf speckle
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * 7, rr = Math.sqrt(Math.random()) * rx
      const px = cx + Math.cos(a) * rr, py = cy - ry * 0.2 + Math.sin(a) * ry * 0.9
      x.beginPath(); x.arc(px, py, 0.8 + Math.random() * 1.4, 0, 7)
      x.fillStyle = Math.random() < 0.5 ? light : dark
      x.globalAlpha = 0.16 + Math.random() * 0.14; x.fill()
    }
    x.globalAlpha = 1
  }

  /* ───────── LAWN FLOOR (receding play-lawn, JPEG) ───────── */
  {
    const W = 920, H = 580
    const c = cv(W, H), x = c.getContext('2d')
    const HORY = H * 0.14 // far edge (hedge line) — CSS feathers the very top into the backdrop
    // grass base gradient: cooler/darker far → warmer/brighter near
    const g = x.createLinearGradient(0, HORY, 0, H)
    g.addColorStop(0, '#6d885a'); g.addColorStop(0.35, '#7f9d63'); g.addColorStop(1, '#93b06f')
    x.fillStyle = g; x.fillRect(0, HORY, W, H - HORY)
    // sky-ish sliver above the hedge (mostly masked away, keeps the top from being a hard line)
    const sg = x.createLinearGradient(0, 0, 0, HORY)
    sg.addColorStop(0, '#cddbe0'); sg.addColorStop(1, '#b9c9ba')
    x.fillStyle = sg; x.fillRect(0, 0, W, HORY)
    // perspective mow bands: trapezoids converging toward the centre horizon
    const cxb = W / 2
    const nearHalf = W * 0.62, farHalf = W * 0.13
    const rows = 9
    for (let i = 0; i < rows; i++) {
      const f1 = i / rows, f2 = (i + 1) / rows // 0 far → 1 near (eased)
      const e1 = f1 * f1 * 0.5 + f1 * 0.5, e2 = f2 * f2 * 0.5 + f2 * 0.5
      const y1 = HORY + (H - HORY) * e1, y2 = HORY + (H - HORY) * e2
      const h1 = farHalf + (nearHalf - farHalf) * e1, h2 = farHalf + (nearHalf - farHalf) * e2
      x.beginPath()
      x.moveTo(cxb - h1, y1); x.lineTo(cxb + h1, y1); x.lineTo(cxb + h2, y2); x.lineTo(cxb - h2, y2); x.closePath()
      x.fillStyle = i % 2 === 0 ? '#ffffff' : '#2f4020'
      x.globalAlpha = 0.05; x.fill()
    }
    x.globalAlpha = 1
    // far hedge line: a soft row of muted bushes along the horizon
    for (let bx = -10; bx < W + 20; bx += 46) {
      drawBush(x, bx + R(14), HORY + 8 + R(6), 34, 22, '#5f7a4a', '#7b9760', '#4a6238')
    }
    // grass blade speckle (denser + longer near the child)
    for (let i = 0; i < 2600; i++) {
      const gy = HORY + Math.random() * (H - HORY)
      const t = (gy - HORY) / (H - HORY) // 0 far → 1 near
      const gx = Math.random() * W
      x.strokeStyle = `rgba(${86 + R(24)},${132 + R(26)},${74 + R(20)},${0.1 + t * 0.16})`
      x.lineWidth = 0.6 + t * 1.1
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + R(3), gy - (2 + t * 6)); x.stroke()
    }
    // soft centre light pool (one overhead sun) — baked lighting
    const pool = x.createRadialGradient(cxb, H * 0.52, 30, cxb, H * 0.56, W * 0.62)
    pool.addColorStop(0, 'rgba(255,250,224,0.20)'); pool.addColorStop(1, 'rgba(255,250,224,0)')
    x.fillStyle = pool; x.fillRect(0, HORY, W, H - HORY)
    // far-end AO under the hedge = depth
    const fao = x.createLinearGradient(0, HORY, 0, HORY + 80)
    fao.addColorStop(0, 'rgba(28,40,18,0.34)'); fao.addColorStop(1, 'rgba(28,40,18,0)')
    x.fillStyle = fao; x.fillRect(0, HORY, W, 80)
    // gentle edge vignette
    const vig = x.createRadialGradient(cxb, H * 0.6, H * 0.34, cxb, H * 0.62, H * 0.8)
    vig.addColorStop(0, 'rgba(24,34,16,0)'); vig.addColorStop(1, 'rgba(24,34,16,0.2)')
    x.fillStyle = vig; x.fillRect(0, 0, W, H)
    A['lawn'] = c.toDataURL('image/jpeg', 0.82)
  }

  /* ───────── SHRUB PROP (soft topiary, PNG w/ alpha) ───────── */
  {
    const W = 160, H = 140
    const c = cv(W, H), x = c.getContext('2d')
    drawBush(x, W / 2, H * 0.52, 62, 50, '#5f7a4a', '#88a56a', '#48603a')
    // a small trunk-ish base shadow so it plants on the lawn
    const ao = x.createRadialGradient(W / 2, H * 0.92, 4, W / 2, H * 0.92, 60)
    ao.addColorStop(0, 'rgba(24,36,16,0.3)'); ao.addColorStop(1, 'rgba(24,36,16,0)')
    x.fillStyle = ao; x.beginPath(); x.ellipse(W / 2, H * 0.92, 52, 12, 0, 0, 7); x.fill()
    A['bush'] = c.toDataURL('image/png')
  }

  /* ───────── NEAR GRASS FRINGE (foreground, over feet, PNG) ───────── */
  {
    const W = 920, H = 96
    const c = cv(W, H), x = c.getContext('2d')
    // soft dark grounding band, fading upward (alpha), so it wraps the nearest feet
    const g = x.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(58,76,42,0)'); g.addColorStop(0.55, 'rgba(70,90,52,0.7)'); g.addColorStop(1, 'rgba(78,98,58,0.95)')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    // upright foreground blades (bigger, darker — nearest to camera)
    for (let i = 0; i < 620; i++) {
      const bx = Math.random() * W
      const bh = 14 + Math.random() * 30
      const by = H - Math.random() * 10
      x.strokeStyle = `rgba(${52 + R(20)},${86 + R(24)},${48 + R(18)},${0.5 + Math.random() * 0.4})`
      x.lineWidth = 1 + Math.random() * 2
      x.beginPath(); x.moveTo(bx, by)
      x.quadraticCurveTo(bx + R(8), by - bh * 0.6, bx + R(12), by - bh); x.stroke()
    }
    A['fringe'] = c.toDataURL('image/png')
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
  const ext = isJpg ? 'jpg' : 'png'
  writeFileSync(OUT_SPR + name + '.' + ext, buf)
  console.log('  ✓', name + '.' + ext, (buf.length / 1024).toFixed(1) + 'KB')
}
console.log('Done.')
