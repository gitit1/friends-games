// Bakes the "המספר החסר" (Missing Number) materials as raster art with baked
// soft lighting + grain/AO: a wooden number TILE (raised, routed inner panel),
// an empty carved SLOT (a routed socket waiting for the missing tile), and a
// perspective wooden SHELF the tiles rest on. Draws on an offscreen <canvas>
// inside a headless Chromium (puppeteer), then writes the PNG files. Muted,
// sensory-calm warm-oak palette — reads as REAL wood, never a CSS box.
//
// One-off build tool — needs puppeteer: run from a dir that has it, e.g.
//   node scripts/gen-missing-art.mjs
// (puppeteer is not a permanent dependency; reinstall it to regenerate.)
import puppeteer from 'puppeteer'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT_SPR = fileURLToPath(new URL('../public/art/sprites/missing/', import.meta.url))
mkdirSync(OUT_SPR, { recursive: true })

// ── the drawing program runs in the browser; returns { name: dataURL } ──
const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  function rrect(x, X, Y, W, H, r) {
    x.beginPath()
    x.moveTo(X + r, Y)
    x.arcTo(X + W, Y, X + W, Y + H, r)
    x.arcTo(X + W, Y + H, X, Y + H, r)
    x.arcTo(X, Y + H, X, Y, r)
    x.arcTo(X, Y, X + W, Y, r)
    x.closePath()
  }
  // vertical wood grain streaks across the current clip region
  function grain(x, W, H, light, dark, n) {
    for (let i = 0; i < n; i++) {
      const gx = Math.random() * W
      x.strokeStyle = Math.random() < 0.5 ? light : dark
      x.globalAlpha = 0.04 + Math.random() * 0.1
      x.lineWidth = 0.8 + Math.random() * 2.2
      x.beginPath(); x.moveTo(gx, -6)
      for (let yy = -6; yy <= H + 6; yy += 24) x.lineTo(gx + R(7), yy)
      x.stroke()
    }
    x.globalAlpha = 1
  }
  function speckle(x, W, H, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = Math.random() * W, py = Math.random() * H, r = 0.5 + Math.random() * 1.4
      x.beginPath(); x.arc(px, py, r, 0, 7)
      x.fillStyle = Math.random() < 0.5 ? light : dark
      x.globalAlpha = 0.04 + Math.random() * 0.1
      x.fill()
    }
    x.globalAlpha = 1
  }
  // the raised outer wooden body, filled + shaded + bevelled, into ctx `x`
  function woodBody(x, S, pad, r) {
    rrect(x, pad, pad, S - 2 * pad, S - 2 * pad, r)
    x.save(); x.clip()
    const g = x.createLinearGradient(0, pad, 0, S - pad)
    g.addColorStop(0, '#c69c64'); g.addColorStop(0.5, '#a97c49'); g.addColorStop(1, '#8a6236')
    x.fillStyle = g; x.fillRect(0, 0, S, S)
    grain(x, S, S, '#e2c290', '#6f4d29', 46)
    speckle(x, S, S, 300, '#f0d9ad', '#5c3f22')
    // baked top-left key light
    const hl = x.createRadialGradient(S * 0.3, S * 0.26, 8, S * 0.3, S * 0.26, S * 0.72)
    hl.addColorStop(0, 'rgba(255,246,226,0.5)'); hl.addColorStop(1, 'rgba(255,246,226,0)')
    x.fillStyle = hl; x.fillRect(0, 0, S, S)
    // baked bottom-right ambient occlusion
    const ao = x.createRadialGradient(S * 0.74, S * 0.8, 8, S * 0.74, S * 0.8, S * 0.85)
    ao.addColorStop(0, 'rgba(58,38,16,0.34)'); ao.addColorStop(1, 'rgba(58,38,16,0)')
    x.fillStyle = ao; x.fillRect(0, 0, S, S)
    x.restore()
    // RAISED bevel: light top-left → dark bottom-right (one gradient stroke)
    const bev = x.createLinearGradient(pad, pad, S - pad, S - pad)
    bev.addColorStop(0, 'rgba(255,247,228,0.72)')
    bev.addColorStop(0.48, 'rgba(255,247,228,0.04)')
    bev.addColorStop(0.52, 'rgba(56,36,14,0.05)')
    bev.addColorStop(1, 'rgba(56,36,14,0.62)')
    x.lineWidth = 5; x.strokeStyle = bev
    rrect(x, pad + 3, pad + 3, S - 2 * pad - 6, S - 2 * pad - 6, r - 3); x.stroke()
  }

  const S = 256, pad = 8, r = 46, ipad = pad + 30, ir = r - 16

  /* ───────── WOODEN NUMBER TILE (raised, routed inner panel) ───────── */
  {
    const c = cv(S, S), x = c.getContext('2d')
    woodBody(x, S, pad, r)
    // routed inner panel (recessed): the friend + number sit here
    rrect(x, ipad, ipad, S - 2 * ipad, S - 2 * ipad, ir)
    x.save(); x.clip()
    const pg = x.createLinearGradient(0, ipad, 0, S - ipad)
    pg.addColorStop(0, '#9a6f3f'); pg.addColorStop(1, '#b98a55') // top darker = recess shadow, bottom lit
    x.fillStyle = pg; x.fillRect(0, 0, S, S)
    grain(x, S, S, '#d8b985', '#6a481f', 26)
    // recess top+left AO
    const iao = x.createLinearGradient(0, ipad, 0, ipad + 44)
    iao.addColorStop(0, 'rgba(50,32,12,0.42)'); iao.addColorStop(1, 'rgba(50,32,12,0)')
    x.fillStyle = iao; x.fillRect(0, 0, S, S)
    const iaol = x.createLinearGradient(ipad, 0, ipad + 40, 0)
    iaol.addColorStop(0, 'rgba(50,32,12,0.3)'); iaol.addColorStop(1, 'rgba(50,32,12,0)')
    x.fillStyle = iaol; x.fillRect(0, 0, S, S)
    x.restore()
    // RECESSED rim: dark top-left → light bottom-right (inverse of the raised bevel)
    const ibev = x.createLinearGradient(ipad, ipad, S - ipad, S - ipad)
    ibev.addColorStop(0, 'rgba(48,30,10,0.55)')
    ibev.addColorStop(0.48, 'rgba(48,30,10,0.04)')
    ibev.addColorStop(0.52, 'rgba(255,244,222,0.05)')
    ibev.addColorStop(1, 'rgba(255,244,222,0.5)')
    x.lineWidth = 4; x.strokeStyle = ibev
    rrect(x, ipad, ipad, S - 2 * ipad, S - 2 * ipad, ir); x.stroke()
    A['tile-wood'] = c.toDataURL('image/png')
  }

  /* ───────── EMPTY CARVED SLOT (a routed socket, waiting) ───────── */
  {
    const c = cv(S, S), x = c.getContext('2d')
    woodBody(x, S, pad, r)
    // deep dark socket where the missing tile belongs
    rrect(x, ipad, ipad, S - 2 * ipad, S - 2 * ipad, ir)
    x.save(); x.clip()
    const hg = x.createRadialGradient(S * 0.5, ipad + 18, 6, S * 0.5, S * 0.52, (S - 2 * ipad) * 0.82)
    hg.addColorStop(0, '#241809'); hg.addColorStop(1, '#43301a')
    x.fillStyle = hg; x.fillRect(0, 0, S, S)
    grain(x, S, S, '#5a4023', '#1c1206', 30)
    // strong inner top + left AO (deep cut)
    const sao = x.createLinearGradient(0, ipad, 0, ipad + 62)
    sao.addColorStop(0, 'rgba(0,0,0,0.62)'); sao.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = sao; x.fillRect(0, 0, S, S)
    const sao2 = x.createLinearGradient(ipad, 0, ipad + 52, 0)
    sao2.addColorStop(0, 'rgba(0,0,0,0.46)'); sao2.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = sao2; x.fillRect(0, 0, S, S)
    // warm bottom lift (the far wall of the socket catches a little light)
    const lift = x.createLinearGradient(0, S - ipad - 44, 0, S - ipad)
    lift.addColorStop(0, 'rgba(150,102,50,0)'); lift.addColorStop(1, 'rgba(150,102,50,0.42)')
    x.fillStyle = lift; x.fillRect(0, 0, S, S)
    x.restore()
    // routed lip: deep dark top-left, lit near lip bottom-right
    const rbev = x.createLinearGradient(ipad, ipad, S - ipad, S - ipad)
    rbev.addColorStop(0, 'rgba(0,0,0,0.5)')
    rbev.addColorStop(0.48, 'rgba(0,0,0,0.05)')
    rbev.addColorStop(0.52, 'rgba(255,240,214,0.28)')
    rbev.addColorStop(1, 'rgba(255,240,214,0.52)')
    x.lineWidth = 5; x.strokeStyle = rbev
    rrect(x, ipad, ipad, S - 2 * ipad, S - 2 * ipad, ir); x.stroke()
    A['tile-slot'] = c.toDataURL('image/png')
  }

  /* ───────── WOODEN SHELF (near feeding surface, in perspective) ───────── */
  {
    const W = 640, H = 152, cxb = W / 2
    const c = cv(W, H), x = c.getContext('2d')
    const topY = 20, botY = 104, topHalf = 250, botHalf = 312
    // top face (trapezoid, receding)
    x.beginPath()
    x.moveTo(cxb - topHalf, topY); x.lineTo(cxb + topHalf, topY)
    x.lineTo(cxb + botHalf, botY); x.lineTo(cxb - botHalf, botY); x.closePath()
    x.save(); x.clip()
    const g = x.createLinearGradient(0, topY, 0, botY)
    g.addColorStop(0, '#8a6236'); g.addColorStop(1, '#bb8d57') // far darker → near lighter
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    // horizontal grain (perspective), bunched toward the far edge
    for (let i = 0; i < 26; i++) {
      const yy = topY + Math.random() * (botY - topY)
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,86,48,0.24)' : 'rgba(214,182,136,0.24)'
      x.lineWidth = 0.8 + Math.random() * 2
      x.beginPath(); x.moveTo(cxb - botHalf, yy)
      for (let sx = -botHalf; sx <= botHalf; sx += 40) x.lineTo(cxb + sx, yy + R(5))
      x.stroke()
    }
    // plank seams converging toward the far edge
    x.strokeStyle = 'rgba(78,52,26,0.42)'; x.lineWidth = 2
    for (const frac of [-0.5, 0, 0.5]) {
      x.beginPath(); x.moveTo(cxb + frac * topHalf, topY); x.lineTo(cxb + frac * botHalf, botY); x.stroke()
    }
    // far-edge AO
    const ao = x.createLinearGradient(0, topY, 0, topY + 38)
    ao.addColorStop(0, 'rgba(58,38,16,0.42)'); ao.addColorStop(1, 'rgba(58,38,16,0)')
    x.fillStyle = ao; x.fillRect(0, topY, W, 38)
    x.restore()
    // front bevel (thickness) — grounds the shelf
    x.fillStyle = '#7a5430'
    x.beginPath(); x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY)
    x.lineTo(cxb + botHalf, botY + 20); x.lineTo(cxb - botHalf, botY + 20); x.closePath(); x.fill()
    // front-face grain + near-edge highlight
    x.strokeStyle = 'rgba(228,198,150,0.85)'; x.lineWidth = 2.5
    x.beginPath(); x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY); x.stroke()
    x.strokeStyle = 'rgba(40,24,8,0.4)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(cxb - botHalf, botY + 20); x.lineTo(cxb + botHalf, botY + 20); x.stroke()
    A['tray-wood'] = c.toDataURL('image/png')
  }

  return A
}

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setContent('<!doctype html><html><body></body></html>')
const assets = await page.evaluate(DRAW)
await browser.close()

for (const [name, dataUrl] of Object.entries(assets)) {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
  writeFileSync(OUT_SPR + name + '.png', buf)
  console.log('  ✓', name + '.png', (buf.length / 1024).toFixed(1) + 'KB')
}
console.log('Done.')
