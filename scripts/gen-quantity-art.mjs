// Bakes the מספר וכמות ("party invitations") scene MATERIALS as raster art with
// baked soft lighting, grain and AO — replacing the flat CSS gradients/triangles
// so every surface reads as a real object, not a CSS shape:
//   garland.png — a cloth bunting strip (rope + draped triangular flags)
//   sign.png    — a warm wooden hanging sign board (the number sits on top in CSS)
//   table.png   — a round party table's draped cream tablecloth top (grounds guests)
//   floor.png   — a receding warm-wood plank floor (perspective + grain)
// Palette matches the existing scene (wood-warm, festive yellow, sky-blue, rose,
// cream), muted and sensory-calm. Key light is baked upper-LEFT (physical, does
// not mirror in RTL/LTR — same as the friends).
//
// One-off build tool. Needs puppeteer (not a permanent dep):
//   node scripts/gen-quantity-art.mjs
// The bake() export lets a runner supply its own puppeteer + output dir.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { name: dataURL } ──
export const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.5 + Math.random() * 1.5
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.05 + Math.random() * 0.12
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  function grainH(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const gy = y + Math.random() * h
      ctx.strokeStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.06 + Math.random() * 0.14
      ctx.lineWidth = 0.6 + Math.random() * 1.6
      ctx.beginPath(); ctx.moveTo(x, gy)
      for (let sx = x; sx <= x + w; sx += 22) ctx.lineTo(sx, gy + R(3))
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  function grainV(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const gx = x + Math.random() * w
      ctx.strokeStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.06 + Math.random() * 0.14
      ctx.lineWidth = 0.6 + Math.random() * 1.6
      ctx.beginPath(); ctx.moveTo(gx, y)
      for (let sy = y; sy <= y + h; sy += 20) ctx.lineTo(gx + R(3), sy)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  /* ───────── GARLAND — a cloth bunting strip: a gently slung rope with draped
     triangular flags in the four scene colours. Each flag is top-lit with a soft
     inner fold shadow so it reads as fabric, not a CSS triangle. Wide + mostly
     transparent so it lays across the back wall. ───────── */
  {
    const W = 780, H = 132
    const c = cv(W, H), x = c.getContext('2d')
    const flags = 11, pad = 28
    const span = (W - pad * 2) / flags
    const cols = ['#d9b45e', '#8fb0c9', '#cf9b6f', '#d69a8a'] // yellow · sky · warm · rose
    const dips = ['#a9863c', '#5f7f99', '#9c6c45', '#a3675c']  // matching fold-shade
    const sag = (t) => 14 + Math.sin(t * Math.PI) * 16          // catenary sag (px)
    const ropeY = 12
    // the rope (drawn first, behind the flags)
    x.strokeStyle = '#7a5024'; x.lineWidth = 3; x.lineCap = 'round'
    x.beginPath()
    for (let s = 0; s <= 1.001; s += 0.02) x.lineTo(pad + s * (W - pad * 2), ropeY + sag(s))
    x.stroke()
    x.strokeStyle = 'rgba(255,240,210,0.4)'; x.lineWidth = 1
    x.beginPath()
    for (let s = 0; s <= 1.001; s += 0.02) x.lineTo(pad + s * (W - pad * 2), ropeY - 1 + sag(s))
    x.stroke()
    // the flags
    for (let i = 0; i < flags; i++) {
      const t = (i + 0.5) / flags
      const cxf = pad + t * (W - pad * 2)
      const topY = ropeY + sag(t) + 1
      const hw = span * 0.42, fh = 62
      const col = cols[i % 4], dip = dips[i % 4]
      // flag body (triangle, point down)
      x.beginPath()
      x.moveTo(cxf - hw, topY); x.lineTo(cxf + hw, topY); x.lineTo(cxf, topY + fh); x.closePath()
      x.save(); x.clip()
      const g = x.createLinearGradient(cxf - hw, topY, cxf + hw, topY + fh)
      g.addColorStop(0, col); g.addColorStop(1, dip)
      x.fillStyle = g; x.fillRect(cxf - hw - 2, topY - 2, hw * 2 + 4, fh + 4)
      // top-left key-light wash
      const kl = x.createRadialGradient(cxf - hw * 0.4, topY + 6, 3, cxf - hw * 0.4, topY + 6, fh)
      kl.addColorStop(0, 'rgba(255,250,235,0.45)'); kl.addColorStop(1, 'rgba(255,250,235,0)')
      x.fillStyle = kl; x.fillRect(cxf - hw - 2, topY - 2, hw * 2 + 4, fh + 4)
      // soft central fold shadow (drape)
      const fold = x.createLinearGradient(cxf - 6, 0, cxf + 6, 0)
      fold.addColorStop(0, 'rgba(40,26,10,0)'); fold.addColorStop(0.5, 'rgba(40,26,10,0.18)')
      fold.addColorStop(1, 'rgba(40,26,10,0)')
      x.fillStyle = fold; x.fillRect(cxf - 7, topY, 14, fh)
      speckle(x, cxf - hw, topY, hw * 2, fh, 24, '#fff4dd', dip)
      x.restore()
      // hemmed top edge + a tiny fold-over highlight
      x.strokeStyle = 'rgba(60,38,14,0.34)'; x.lineWidth = 2
      x.beginPath(); x.moveTo(cxf - hw, topY); x.lineTo(cxf + hw, topY); x.stroke()
      x.strokeStyle = 'rgba(255,248,230,0.5)'; x.lineWidth = 1
      x.beginPath(); x.moveTo(cxf - hw, topY + 2); x.lineTo(cxf + hw, topY + 2); x.stroke()
    }
    A['garland'] = c.toDataURL('image/png')
  }

  /* ───────── SIGN — a warm wooden hanging board. Real plank: vertical grain,
     bevelled lit top-left edge, shaded bottom-right, two rope holes at the top.
     The number/emoji is layered ON TOP in crisp CSS, so this is board only. ─── */
  {
    const W = 208, H = 176
    const c = cv(W, H), x = c.getContext('2d')
    const bx = 12, by = 14, bw = W - 24, bh = H - 30, rad = 18
    // soft drop shadow under the board
    rr(x, bx + 3, by + 8, bw, bh, rad)
    x.fillStyle = 'rgba(40,24,8,0.28)'; x.filter = 'blur(5px)'; x.fill(); x.filter = 'none'
    // board body
    x.save(); rr(x, bx, by, bw, bh, rad); x.clip()
    const g = x.createLinearGradient(bx, by, bx + bw, by + bh)
    g.addColorStop(0, '#cb9a5d'); g.addColorStop(0.55, '#b07f47'); g.addColorStop(1, '#9a6c39')
    x.fillStyle = g; x.fillRect(bx, by, bw, bh)
    // top-left key light
    const kl = x.createRadialGradient(bx + 20, by + 16, 6, bx + 20, by + 16, bw)
    kl.addColorStop(0, 'rgba(255,244,214,0.5)'); kl.addColorStop(1, 'rgba(255,244,214,0)')
    x.fillStyle = kl; x.fillRect(bx, by, bw, bh)
    grainV(x, bx, by, bw, bh, 34, '#e0bd82', '#7d5428')
    speckle(x, bx, by, bw, bh, 180, '#f0d6a5', '#6f4a22')
    x.restore()
    // bevel: lit top+left, shaded bottom+right
    x.save(); rr(x, bx, by, bw, bh, rad); x.clip()
    x.strokeStyle = 'rgba(255,246,222,0.7)'; x.lineWidth = 3
    x.beginPath(); x.moveTo(bx + 2, by + bh - rad); x.lineTo(bx + 2, by + rad)
    x.arcTo(bx + 2, by + 2, bx + rad, by + 2, rad); x.lineTo(bx + bw - rad, by + 2); x.stroke()
    x.strokeStyle = 'rgba(60,36,12,0.5)'; x.lineWidth = 3
    x.beginPath(); x.moveTo(bx + bw - 2, by + rad); x.lineTo(bx + bw - 2, by + bh - rad)
    x.arcTo(bx + bw - 2, by + bh - 2, bx + bw - rad, by + bh - 2, rad); x.lineTo(bx + rad, by + bh - 2); x.stroke()
    x.restore()
    // hard outer rim
    rr(x, bx, by, bw, bh, rad); x.strokeStyle = '#7c5320'; x.lineWidth = 2.5; x.stroke()
    // two rope holes at the top
    for (const hx of [bx + bw * 0.3, bx + bw * 0.7]) {
      x.beginPath(); x.arc(hx, by + 12, 4.5, 0, 7); x.fillStyle = '#3c2810'; x.fill()
      x.beginPath(); x.arc(hx - 1, by + 11, 2, 0, 7); x.fillStyle = 'rgba(255,240,210,0.4)'; x.fill()
    }
    A['sign'] = c.toDataURL('image/png')
  }

  /* ───────── TABLE — the round party table's draped cream tablecloth top, seen
     slightly from the front. An ellipse of soft fabric: top-lit dome, radiating
     drape folds, a scalloped hem with a warm wood edge peeking below, and a soft
     contact shadow. The seated guests sit BEHIND it, their feet hidden by the
     cloth (grounded). ───────── */
  {
    // NOTE: transparent headroom is left ABOVE the ellipse so the seated guests,
    // drawn behind this table in the scene, peek over the cloth's far rim.
    const W = 340, H = 176
    const c = cv(W, H), x = c.getContext('2d')
    const cxb = W / 2, cyb = 104, rxb = 150, ryb = 38
    // contact shadow on the floor beneath the cloth
    const sh = x.createRadialGradient(cxb + 6, cyb + 60, 8, cxb + 6, cyb + 60, 150)
    sh.addColorStop(0, 'rgba(40,24,8,0.3)'); sh.addColorStop(1, 'rgba(40,24,8,0)')
    x.fillStyle = sh; x.beginPath(); x.ellipse(cxb + 6, cyb + 62, 140, 20, 0, 0, 7); x.fill()
    // cloth SKIRT (a soft band hanging below the top ellipse) — wood edge + cloth
    x.save()
    x.beginPath(); x.ellipse(cxb, cyb, rxb, ryb, 0, 0, Math.PI); // lower half only
    x.lineTo(cxb - rxb, cyb + 26); x.ellipse(cxb, cyb + 26, rxb, ryb, 0, Math.PI, 0, true)
    x.closePath(); x.clip()
    const sg = x.createLinearGradient(0, cyb, 0, cyb + 30)
    sg.addColorStop(0, '#e7d3ab'); sg.addColorStop(1, '#cdaa76')
    x.fillStyle = sg; x.fillRect(0, cyb - 4, W, 40)
    // scalloped drape folds along the skirt
    for (let i = 0; i <= 12; i++) {
      const fx = cxb - rxb + (i / 12) * rxb * 2
      x.strokeStyle = 'rgba(120,84,40,0.16)'; x.lineWidth = 2
      x.beginPath(); x.moveTo(fx, cyb - 2); x.lineTo(fx + 4, cyb + 26); x.stroke()
    }
    x.restore()
    // TOP ellipse (the cloth surface)
    x.save(); x.beginPath(); x.ellipse(cxb, cyb, rxb, ryb, 0, 0, 7); x.clip()
    const tg = x.createRadialGradient(cxb - 40, cyb - 16, 8, cxb, cyb, rxb)
    tg.addColorStop(0, '#f6ecd4'); tg.addColorStop(0.6, '#ecd9b4'); tg.addColorStop(1, '#d3b483')
    x.fillStyle = tg; x.fillRect(0, 0, W, H)
    // radiating drape folds (soft)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      x.strokeStyle = 'rgba(120,84,40,0.08)'; x.lineWidth = 3
      x.beginPath(); x.moveTo(cxb, cyb)
      x.lineTo(cxb + Math.cos(a) * rxb, cyb + Math.sin(a) * ryb); x.stroke()
    }
    speckle(x, cxb - rxb, cyb - ryb, rxb * 2, ryb * 2, 120, '#fdf3dd', '#c2a06e')
    x.restore()
    // hem highlight (top-left lit) + rim
    x.beginPath(); x.ellipse(cxb, cyb, rxb, ryb, 0, 0, 7)
    x.strokeStyle = '#b98f5c'; x.lineWidth = 2; x.stroke()
    x.beginPath(); x.ellipse(cxb, cyb, rxb - 2, ryb - 2, 0, Math.PI * 0.6, Math.PI * 1.5)
    x.strokeStyle = 'rgba(255,248,228,0.6)'; x.lineWidth = 2; x.stroke()
    A['table'] = c.toDataURL('image/png')
  }

  /* ───────── FLOOR — a receding warm-wood plank floor. Perspective planks whose
     seams fan toward a horizon, horizontal grain, a far-edge AO where it meets
     the wall, and a soft near light pool. Muted honey wood. ───────── */
  {
    const W = 680, H = 150, cxb = W / 2
    const c = cv(W, H), x = c.getContext('2d')
    const horizon = 5
    // base wood wash (lighter far → warmer near)
    const g = x.createLinearGradient(0, horizon, 0, H)
    g.addColorStop(0, '#d8bd8d'); g.addColorStop(0.55, '#c9a973'); g.addColorStop(1, '#bd9a63')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    // perspective plank seams (fan from a vanishing point above centre)
    const vpX = cxb, vpY = -220
    for (let i = -9; i <= 9; i++) {
      const nearX = cxb + i * (W / 12)
      x.strokeStyle = 'rgba(90,60,28,0.28)'; x.lineWidth = 1.4
      x.beginPath(); x.moveTo(vpX + (nearX - vpX) * ((horizon - vpY) / (H - vpY)), horizon)
      x.lineTo(nearX, H); x.stroke()
      x.strokeStyle = 'rgba(255,240,208,0.22)'; x.lineWidth = 1
      x.beginPath(); x.moveTo(vpX + (nearX - vpX) * ((horizon - vpY) / (H - vpY)) + 1.5, horizon)
      x.lineTo(nearX + 1.5, H); x.stroke()
    }
    // horizontal plank courses (denser far, spread near = perspective)
    for (let s = 0.08; s < 1; s += 0.16) {
      const yy = horizon + Math.pow(s, 1.7) * (H - horizon)
      x.strokeStyle = 'rgba(80,52,24,0.2)'; x.lineWidth = 1.2
      x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke()
    }
    grainH(x, 0, horizon, W, H - horizon, 34, '#e6cd9c', '#8f6a34')
    speckle(x, 0, horizon, W, H - horizon, 140, '#f0dcae', '#7d5a2c')
    // far-edge AO where the floor meets the wall
    const ao = x.createLinearGradient(0, horizon, 0, horizon + 46)
    ao.addColorStop(0, 'rgba(70,46,18,0.4)'); ao.addColorStop(1, 'rgba(70,46,18,0)')
    x.fillStyle = ao; x.fillRect(0, horizon, W, 46)
    // crisp wall line
    x.strokeStyle = 'rgba(150,110,60,0.5)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(0, horizon); x.lineTo(W, horizon); x.stroke()
    // near soft light pool (centre-front, under the table)
    const lp = x.createRadialGradient(cxb, H - 10, 20, cxb, H, 300)
    lp.addColorStop(0, 'rgba(255,248,224,0.22)'); lp.addColorStop(1, 'rgba(255,248,224,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    // side vignette
    const vg = x.createLinearGradient(0, 0, W, 0)
    vg.addColorStop(0, 'rgba(60,40,18,0.22)'); vg.addColorStop(0.16, 'rgba(60,40,18,0)')
    vg.addColorStop(0.84, 'rgba(60,40,18,0)'); vg.addColorStop(1, 'rgba(60,40,18,0.22)')
    x.fillStyle = vg; x.fillRect(0, 0, W, H)
    A['floor'] = c.toDataURL('image/png')
  }

  return A
}

export async function bake(puppeteer, outSpr) {
  mkdirSync(outSpr, { recursive: true })
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  const assets = await page.evaluate(DRAW)
  await browser.close()
  let total = 0
  for (const [name, dataUrl] of Object.entries(assets)) {
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
    writeFileSync(outSpr + name + '.png', buf)
    total += buf.length
    console.log('  ✓', name + '.png', (buf.length / 1024).toFixed(1) + 'KB')
  }
  console.log('Total', (total / 1024).toFixed(1) + 'KB')
  console.log('Done.')
}

// Run directly (needs puppeteer): bakes into public/art/sprites/quantity/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/quantity/', import.meta.url))
  await bake(puppeteer, OUT)
}
