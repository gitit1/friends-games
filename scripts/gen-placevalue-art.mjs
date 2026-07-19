// Bakes the PLACE-VALUE (עשרות ואחדות) materials as raster art with baked soft
// lighting + wood texture/AO: a base-ten TENS ROD (ten unit segments, muted
// slate-blue stained wood), a single ONES unit cube (warm honey wood, 3/4 view),
// and a perspective FELT work-mat the tokens rest on. Drawn on an offscreen
// <canvas> inside headless Chromium, then written as PNGs. Muted, sensory-calm.
//
// One-off build tool. Needs puppeteer: `npm i -D puppeteer && node scripts/gen-placevalue-art.mjs`
// (puppeteer is not a permanent dependency; reinstall to regenerate. The bake()
// export lets a runner supply its own puppeteer + output dir.)
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { name: dataURL } ──
export const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  // soft speckle grain inside a rect
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
  // vertical wood-grain streaks inside a clipped region
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

  /* ───────── TENS ROD — a base-ten rod of 10 unit segments, standing up.
     Muted slate-blue stained wood; a thin right side face gives real thickness;
     each segment reads as a joined unit cube (top lip highlight + bottom groove
     AO). Baked top-left key light. Soft contact shadow at the foot. ───────── */
  {
    const W = 96, H = 452
    const c = cv(W, H), x = c.getContext('2d')
    const fx = 14, fw = 56, top = 12, seg = 42, segs = 10          // front face geometry
    const fh = seg * segs
    const sideW = 15                                                // 3/4 side thickness
    const shadowY = top + fh + 16

    // contact shadow first (under the foot)
    const sh = x.createRadialGradient(fx + fw / 2, shadowY, 4, fx + fw / 2, shadowY, 46)
    sh.addColorStop(0, 'rgba(30,26,40,0.34)'); sh.addColorStop(1, 'rgba(30,26,40,0)')
    x.fillStyle = sh
    x.beginPath(); x.ellipse(fx + fw / 2 + 4, shadowY, 42, 11, 0, 0, 7); x.fill()

    // RIGHT side face (parallelogram) — darker, receding
    x.beginPath()
    x.moveTo(fx + fw, top); x.lineTo(fx + fw + sideW, top - 9)
    x.lineTo(fx + fw + sideW, top + fh - 9); x.lineTo(fx + fw, top + fh)
    x.closePath()
    const sg = x.createLinearGradient(fx + fw, 0, fx + fw + sideW, 0)
    sg.addColorStop(0, '#3f4a63'); sg.addColorStop(1, '#2c3548')
    x.fillStyle = sg; x.fill()
    // segment grooves on the side face
    x.strokeStyle = 'rgba(18,22,34,0.5)'; x.lineWidth = 1
    for (let i = 1; i < segs; i++) {
      const yy = top + i * seg
      x.beginPath(); x.moveTo(fx + fw, yy); x.lineTo(fx + fw + sideW, yy - 9); x.stroke()
    }

    // TOP cap face (little parallelogram lid) — lightest
    x.beginPath()
    x.moveTo(fx, top); x.lineTo(fx + sideW, top - 9)
    x.lineTo(fx + fw + sideW, top - 9); x.lineTo(fx + fw, top)
    x.closePath()
    const tg = x.createLinearGradient(fx, top - 9, fx + fw, top)
    tg.addColorStop(0, '#8ea0c4'); tg.addColorStop(1, '#6f82a8')
    x.fillStyle = tg; x.fill()

    // FRONT face
    x.save()
    rr(x, fx, top, fw, fh, 9); x.clip()
    const fg = x.createLinearGradient(fx, top, fx + fw, top + fh)
    fg.addColorStop(0, '#7286ac'); fg.addColorStop(0.5, '#5d6f93'); fg.addColorStop(1, '#4a5a7a')
    x.fillStyle = fg; x.fillRect(fx, top, fw, fh)
    // top-left key light wash
    const kl = x.createRadialGradient(fx + 10, top + 12, 4, fx + 10, top + 12, fh * 0.8)
    kl.addColorStop(0, 'rgba(210,222,244,0.4)'); kl.addColorStop(1, 'rgba(210,222,244,0)')
    x.fillStyle = kl; x.fillRect(fx, top, fw, fh)
    // vertical wood grain
    grainV(x, fx, top, fw, fh, 30, '#a7b6d4', '#39445c')
    // 10 unit segments: a groove AO line + a light lip below each, so it reads as
    // ten joined unit cubes (the "ten made of ten ones" idea, baked in)
    for (let i = 1; i < segs; i++) {
      const yy = top + i * seg
      x.strokeStyle = 'rgba(22,28,42,0.55)'; x.lineWidth = 2
      x.beginPath(); x.moveTo(fx, yy); x.lineTo(fx + fw, yy); x.stroke()
      x.strokeStyle = 'rgba(190,204,230,0.4)'; x.lineWidth = 1
      x.beginPath(); x.moveTo(fx, yy + 1.5); x.lineTo(fx + fw, yy + 1.5); x.stroke()
    }
    // per-segment top sheen so each unit domes slightly
    for (let i = 0; i < segs; i++) {
      const yy = top + i * seg
      const sq = x.createLinearGradient(0, yy, 0, yy + seg)
      sq.addColorStop(0, 'rgba(214,226,248,0.16)'); sq.addColorStop(0.4, 'rgba(214,226,248,0)')
      sq.addColorStop(1, 'rgba(18,24,38,0.14)')
      x.fillStyle = sq; x.fillRect(fx, yy, fw, seg)
    }
    speckle(x, fx, top, fw, fh, 200, '#c3d0ea', '#2f3a50')
    x.restore()
    // crisp front edge highlight (left) + shade (right)
    x.strokeStyle = 'rgba(206,220,244,0.55)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(fx + 2, top + 8); x.lineTo(fx + 2, top + fh - 8); x.stroke()

    A['ten-rod'] = c.toDataURL('image/png')
  }

  /* ───────── ONES CUBE — a single unit cube, warm honey wood, 3/4 view (top +
     two side faces for real depth), grain + bevel + baked contact shadow. ─────── */
  {
    const W = 108, H = 112
    const c = cv(W, H), x = c.getContext('2d')
    const cx = 50, topY = 16, s = 52, dx = 16, dy = 9   // cube metrics + iso offset

    // contact shadow
    const sh = x.createRadialGradient(cx + 4, topY + s + dy + 8, 3, cx + 4, topY + s + dy + 8, 40)
    sh.addColorStop(0, 'rgba(46,30,12,0.32)'); sh.addColorStop(1, 'rgba(46,30,12,0)')
    x.fillStyle = sh
    x.beginPath(); x.ellipse(cx + 6, topY + s + dy + 6, 40, 10, 0, 0, 7); x.fill()

    // TOP face (rhombus) — lightest
    x.beginPath()
    x.moveTo(cx, topY); x.lineTo(cx + s, topY + dy)
    x.lineTo(cx + s - dx, topY + dy + dy); x.lineTo(cx - dx, topY + dy)
    x.closePath()
    const tg = x.createLinearGradient(cx - dx, topY, cx + s, topY + dy * 2)
    tg.addColorStop(0, '#f0cf97'); tg.addColorStop(1, '#dcb578')
    x.fillStyle = tg; x.save(); x.clip(); x.fill()
    speckle(x, cx - dx, topY, s + dx, dy * 2 + 6, 60, '#fbe7c2', '#a97e44')
    x.restore()

    // LEFT / FRONT face — mid honey
    x.beginPath()
    x.moveTo(cx - dx, topY + dy); x.lineTo(cx + s - dx, topY + dy + dy)
    x.lineTo(cx + s - dx, topY + dy + dy + s); x.lineTo(cx - dx, topY + dy + s)
    x.closePath()
    const lg = x.createLinearGradient(cx - dx, topY + dy, cx - dx, topY + dy + s)
    lg.addColorStop(0, '#d3a763'); lg.addColorStop(1, '#b98a47')
    x.fillStyle = lg; x.save(); x.clip(); x.fill()
    grainV(x, cx - dx, topY + dy, s, s + dy, 16, '#e6c288', '#8f6a34')
    x.restore()

    // RIGHT face — darkest (in shade)
    x.beginPath()
    x.moveTo(cx + s - dx, topY + dy + dy); x.lineTo(cx + s, topY + dy)
    x.lineTo(cx + s, topY + dy + s); x.lineTo(cx + s - dx, topY + dy + dy + s)
    x.closePath()
    const rg = x.createLinearGradient(cx + s - dx, 0, cx + s, 0)
    rg.addColorStop(0, '#a67c3c'); rg.addColorStop(1, '#8c672f')
    x.fillStyle = rg; x.save(); x.clip(); x.fill()
    grainV(x, cx + s - dx, topY + dy, dx + 2, s, 8, '#c99a55', '#6f4f22')
    x.restore()

    // bevel highlights on the top edges (key light upper-left)
    x.strokeStyle = 'rgba(255,244,220,0.7)'; x.lineWidth = 1.6
    x.beginPath(); x.moveTo(cx - dx, topY + dy); x.lineTo(cx, topY); x.lineTo(cx + s, topY + dy); x.stroke()
    // inner edge (top-front seam) darker AO
    x.strokeStyle = 'rgba(70,46,18,0.4)'; x.lineWidth = 1
    x.beginPath(); x.moveTo(cx - dx, topY + dy + dy); x.lineTo(cx + s - dx, topY + dy + dy); x.stroke()

    A['unit-cube'] = c.toDataURL('image/png')
  }

  /* ───────── FELT WORK-MAT — a receding trapezoid (perspective floor) the tokens
     rest on. Muted sage felt: woven cross-hatch texture, far-edge AO, soft near
     light pool, a front bevel thickness so it reads as a real object. ───────── */
  {
    const W = 720, H = 340, cxb = W / 2
    const c = cv(W, H), x = c.getContext('2d')
    const topY = 26, botY = 262, topHalf = 214, botHalf = 348
    // top face
    x.beginPath()
    x.moveTo(cxb - topHalf, topY); x.lineTo(cxb + topHalf, topY)
    x.lineTo(cxb + botHalf, botY); x.lineTo(cxb - botHalf, botY); x.closePath()
    x.save(); x.clip()
    const g = x.createLinearGradient(0, topY, 0, botY)
    g.addColorStop(0, '#7d9270'); g.addColorStop(1, '#9cb188')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    // woven felt cross-hatch (perspective: denser toward the far edge)
    for (let i = 0; i < 260; i++) {
      const t = Math.random(), yy = topY + t * (botY - topY)
      const half = topHalf + (botHalf - topHalf) * ((yy - topY) / (botY - topY))
      const gx = cxb + (Math.random() - 0.5) * half * 2
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(180,196,160,0.16)' : 'rgba(70,88,58,0.16)'
      x.lineWidth = 0.7
      const dir = Math.random() < 0.5 ? 1 : -1
      x.beginPath(); x.moveTo(gx, yy); x.lineTo(gx + dir * 7, yy + 4); x.stroke()
    }
    // far-edge AO (top)
    const ao = x.createLinearGradient(0, topY, 0, topY + 54)
    ao.addColorStop(0, 'rgba(38,50,30,0.34)'); ao.addColorStop(1, 'rgba(38,50,30,0)')
    x.fillStyle = ao; x.fillRect(0, topY, W, 54)
    // near soft light pool (front-centre)
    const lp = x.createRadialGradient(cxb, botY - 20, 20, cxb, botY - 10, 300)
    lp.addColorStop(0, 'rgba(230,240,214,0.22)'); lp.addColorStop(1, 'rgba(230,240,214,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    // side vignette so the mat sits in space
    const vg = x.createLinearGradient(0, 0, W, 0)
    vg.addColorStop(0, 'rgba(30,40,24,0.2)'); vg.addColorStop(0.16, 'rgba(30,40,24,0)')
    vg.addColorStop(0.84, 'rgba(30,40,24,0)'); vg.addColorStop(1, 'rgba(30,40,24,0.2)')
    x.fillStyle = vg; x.fillRect(0, 0, W, H)
    x.restore()

    // stitched border just inside the mat edge
    x.strokeStyle = 'rgba(238,244,224,0.34)'; x.lineWidth = 2; x.setLineDash([9, 7])
    x.beginPath()
    x.moveTo(cxb - topHalf + 16, topY + 12); x.lineTo(cxb + topHalf - 16, topY + 12)
    x.lineTo(cxb + botHalf - 22, botY - 12); x.lineTo(cxb - botHalf + 22, botY - 12); x.closePath()
    x.stroke(); x.setLineDash([])

    // front bevel (thickness) — grounds the mat
    x.beginPath()
    x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY)
    x.lineTo(cxb + botHalf, botY + 15); x.lineTo(cxb - botHalf, botY + 15); x.closePath()
    x.fillStyle = '#5f7150'; x.fill()
    // near-edge highlight
    x.strokeStyle = 'rgba(206,222,186,0.7)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY); x.stroke()
    // drop shadow under the front bevel
    const ds = x.createLinearGradient(0, botY + 15, 0, botY + 40)
    ds.addColorStop(0, 'rgba(24,32,18,0.3)'); ds.addColorStop(1, 'rgba(24,32,18,0)')
    x.fillStyle = ds; x.fillRect(cxb - botHalf, botY + 15, botHalf * 2, 26)

    A['mat'] = c.toDataURL('image/png')
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
  for (const [name, dataUrl] of Object.entries(assets)) {
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
    writeFileSync(outSpr + name + '.png', buf)
    console.log('  ✓', name + '.png', (buf.length / 1024).toFixed(1) + 'KB')
  }
  console.log('Done.')
}

// Run directly (needs puppeteer installed): bakes into public/art/sprites/placevalue/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/placevalue/', import.meta.url))
  await bake(puppeteer, OUT)
}
