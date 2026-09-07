// Bakes the "missing friend in the sequence" (חבר חסר ברצף) materials as raster
// art with baked soft lighting + wood texture/AO. Muted, sensory-calm. Drawn on
// an offscreen <canvas> inside headless Chromium, then written as PNGs.
//
//   podium.png  — a low wooden STAGE a friend stands on (3/4 view: a lit top
//                 ellipse for the feet, a curved front band, and a recessed
//                 engraved NAMEPLATE where the CSS number sits). One sprite
//                 serves every tile in the row AND every answer in the tray.
//   socket.png  — the SAME pedestal with an EMPTY, recessed top (a soft shadow
//                 pit + a dashed "waiting" ring): the gap where a friend is
//                 missing. Reads instantly as "someone belongs here".
//   shelf.png   — the long wooden LEDGE (perspective trapezoid + front bevel
//                 thickness) the whole sequence rests on — the receding playfield.
//   tray.png    — a shallow wooden TRAY with a raised front rail the answer
//                 podiums sit inside — "pick one from here".
//
// One-off build tool. Needs puppeteer: `npm i -D puppeteer && node scripts/gen-sequence-art.mjs`
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
  // horizontal grain (for the receding shelf top)
  function grainH(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const gy = y + Math.random() * h
      ctx.strokeStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.05 + Math.random() * 0.12
      ctx.lineWidth = 0.6 + Math.random() * 1.4
      ctx.beginPath(); ctx.moveTo(x, gy)
      for (let sx = x; sx <= x + w; sx += 26) ctx.lineTo(sx, gy + R(2.4))
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  // export a canvas downscaled to `s`× (softens the big wood surfaces so the PNG
  // stays small; face-fractions are relative so scaling doesn't move them)
  function scaledURL(c, s) {
    const out = cv(Math.round(c.width * s), Math.round(c.height * s))
    const ox = out.getContext('2d')
    ox.imageSmoothingQuality = 'high'
    ox.drawImage(c, 0, 0, out.width, out.height)
    return out.toDataURL('image/png')
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

  /* ───────── PODIUM — a low wooden stage, 3/4 view. A lit warm-honey TOP ELLIPSE
     the friend stands on (feet land at its front edge, ≈ 44% of the sprite height),
     a curved front band with vertical grain + baked key light (upper-left) and a
     recessed engraved NAMEPLATE (≈ 57% height) where the crisp CSS number sits.
     Soft contact shadow at the foot grounds it. ───────── */
  function podium(empty) {
    const W = 200, H = 188
    const c = cv(W, H), x = c.getContext('2d')
    const cx = 100
    const topCy = 56, rx = 84, ry = 27           // stage top ellipse
    const baseCy = 150, brx = 72, bry = 19        // foot ellipse

    // contact shadow on the ground
    const sh = x.createRadialGradient(cx + 3, baseCy + 20, 6, cx + 3, baseCy + 20, 84)
    sh.addColorStop(0, 'rgba(34,26,16,0.34)'); sh.addColorStop(1, 'rgba(34,26,16,0)')
    x.fillStyle = sh
    x.beginPath(); x.ellipse(cx + 4, baseCy + 22, 82, 15, 0, 0, 7); x.fill()

    // ── FRONT BAND (the cylinder side between the top and foot ellipses) ──
    x.save()
    x.beginPath()
    x.moveTo(cx - rx, topCy)
    x.lineTo(cx - brx, baseCy)
    x.ellipse(cx, baseCy, brx, bry, 0, Math.PI, 0, true) // round the foot
    x.lineTo(cx + rx, topCy)
    x.ellipse(cx, topCy, rx, ry, 0, 0, Math.PI, false)   // meet the top ellipse
    x.closePath()
    x.clip()
    const bg = x.createLinearGradient(cx - rx, 0, cx + rx, 0)
    bg.addColorStop(0, '#c79a5c'); bg.addColorStop(0.5, '#b07f3f'); bg.addColorStop(1, '#8f6631')
    x.fillStyle = bg; x.fillRect(0, topCy - 4, W, baseCy - topCy + bry + 4)
    // vertical shading: brighter under the lit lip, darker toward the foot
    const vg = x.createLinearGradient(0, topCy, 0, baseCy + bry)
    vg.addColorStop(0, 'rgba(255,238,206,0.30)'); vg.addColorStop(0.4, 'rgba(255,238,206,0)')
    vg.addColorStop(1, 'rgba(40,26,10,0.34)')
    x.fillStyle = vg; x.fillRect(0, topCy - 4, W, baseCy - topCy + bry + 4)
    grainV(x, cx - rx, topCy, rx * 2, baseCy - topCy + bry, 26, '#e6c288', '#7a5626')
    speckle(x, cx - rx, topCy, rx * 2, baseCy - topCy + bry, 150, '#efd6a8', '#6f4e22')
    // upper-left key-light wash on the band
    const kl = x.createRadialGradient(cx - 40, topCy + 18, 6, cx - 40, topCy + 18, 150)
    kl.addColorStop(0, 'rgba(255,244,214,0.34)'); kl.addColorStop(1, 'rgba(255,244,214,0)')
    x.fillStyle = kl; x.fillRect(0, topCy - 4, W, baseCy - topCy + bry + 4)
    x.restore()

    // ── recessed engraved NAMEPLATE on the front band ──
    const plW = 104, plH = 50, plX = cx - plW / 2, plY = 82
    // inner shadow (recess)
    x.save()
    rr(x, plX, plY, plW, plH, 13); x.clip()
    const pg = x.createLinearGradient(0, plY, 0, plY + plH)
    pg.addColorStop(0, '#efe0c0'); pg.addColorStop(1, '#e3cfa4') // pale parchment plate
    x.fillStyle = pg; x.fillRect(plX, plY, plW, plH)
    speckle(x, plX, plY, plW, plH, 60, '#fbf1d8', '#c7ad78')
    // top inner AO (pressed in), bottom light lip
    const ao = x.createLinearGradient(0, plY, 0, plY + 12)
    ao.addColorStop(0, 'rgba(70,48,18,0.42)'); ao.addColorStop(1, 'rgba(70,48,18,0)')
    x.fillStyle = ao; x.fillRect(plX, plY, plW, 14)
    const lip = x.createLinearGradient(0, plY + plH - 10, 0, plY + plH)
    lip.addColorStop(0, 'rgba(255,250,232,0)'); lip.addColorStop(1, 'rgba(255,250,232,0.6)')
    x.fillStyle = lip; x.fillRect(plX, plY + plH - 10, plW, 10)
    x.restore()
    // engraved border bevel
    x.strokeStyle = 'rgba(70,48,18,0.5)'; x.lineWidth = 2
    rr(x, plX, plY, plW, plH, 13); x.stroke()
    x.strokeStyle = 'rgba(255,248,226,0.5)'; x.lineWidth = 1
    rr(x, plX + 1.5, plY + 1.5, plW - 3, plH - 3, 12); x.stroke()

    // ── TOP ELLIPSE (the stage the friend stands on) ──
    if (empty) {
      // EMPTY socket: a recessed pit where a friend is missing
      x.beginPath(); x.ellipse(cx, topCy, rx, ry, 0, 0, 7); x.closePath()
      x.save(); x.clip()
      const pit = x.createRadialGradient(cx, topCy - 2, 4, cx, topCy + 6, rx)
      pit.addColorStop(0, '#5a4021'); pit.addColorStop(0.6, '#6f5028'); pit.addColorStop(1, '#8a6531')
      x.fillStyle = pit; x.fillRect(cx - rx, topCy - ry, rx * 2, ry * 2)
      // deeper AO at the top rim (a real hole)
      const pAO = x.createLinearGradient(0, topCy - ry, 0, topCy)
      pAO.addColorStop(0, 'rgba(22,14,4,0.55)'); pAO.addColorStop(1, 'rgba(22,14,4,0)')
      x.fillStyle = pAO; x.fillRect(cx - rx, topCy - ry, rx * 2, ry)
      x.restore()
      // rim highlight (the near lip of the pit catches light)
      x.strokeStyle = 'rgba(255,244,214,0.5)'; x.lineWidth = 2
      x.beginPath(); x.ellipse(cx, topCy, rx, ry, 0, 0.15, Math.PI - 0.15, false); x.stroke()
      // a soft dashed "waiting" ring inside the pit
      x.strokeStyle = 'rgba(255,238,200,0.66)'; x.lineWidth = 2.4; x.setLineDash([9, 8])
      x.beginPath(); x.ellipse(cx, topCy + 1, rx - 16, ry - 6, 0, 0, 7); x.stroke(); x.setLineDash([])
    } else {
      x.beginPath(); x.ellipse(cx, topCy, rx, ry, 0, 0, 7); x.closePath()
      x.save(); x.clip()
      const tg = x.createRadialGradient(cx - 24, topCy - 8, 6, cx, topCy, rx)
      tg.addColorStop(0, '#f2d9a6'); tg.addColorStop(0.6, '#e2c184'); tg.addColorStop(1, '#c9a566')
      x.fillStyle = tg; x.fillRect(cx - rx, topCy - ry, rx * 2, ry * 2)
      grainH(x, cx - rx, topCy - ry, rx * 2, ry * 2, 18, '#f6e6c2', '#a9824a')
      speckle(x, cx - rx, topCy - ry, rx * 2, ry * 2, 70, '#fbeecb', '#b08a4e')
      x.restore()
      // near-edge AO so the stage front reads as an edge the feet stand on
      x.strokeStyle = 'rgba(60,40,16,0.30)'; x.lineWidth = 3
      x.beginPath(); x.ellipse(cx, topCy, rx, ry, 0, 0.1, Math.PI - 0.1, false); x.stroke()
    }
    // crisp top rim highlight (back of the ellipse, catching the key light)
    x.strokeStyle = 'rgba(255,248,224,0.7)'; x.lineWidth = 2
    x.beginPath(); x.ellipse(cx, topCy, rx, ry, 0, Math.PI + 0.12, -0.12, false); x.stroke()

    return c.toDataURL('image/png')
  }
  A['podium'] = podium(false)
  A['socket'] = podium(true)

  /* ───────── SHELF — a long receding wooden ledge (perspective trapezoid top +
     a front bevel thickness). Muted wood; far-edge AO, near light pool, front
     highlight + drop shadow so the whole sequence sits on a real surface. ─────── */
  {
    const W = 980, H = 250, cxb = W / 2
    const c = cv(W, H), x = c.getContext('2d')
    const topY = 30, botY = 168, topHalf = 372, botHalf = 476
    // top face
    x.beginPath()
    x.moveTo(cxb - topHalf, topY); x.lineTo(cxb + topHalf, topY)
    x.lineTo(cxb + botHalf, botY); x.lineTo(cxb - botHalf, botY); x.closePath()
    x.save(); x.clip()
    const g = x.createLinearGradient(0, topY, 0, botY)
    g.addColorStop(0, '#9c7942'); g.addColorStop(1, '#b89257')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    grainH(x, cxb - botHalf, topY, botHalf * 2, botY - topY, 90, '#d8b077', '#7a5a2c')
    // per-plank grooves running into the distance (converging)
    x.strokeStyle = 'rgba(60,40,18,0.30)'; x.lineWidth = 1.4
    for (const fr of [0.28, 0.5, 0.72]) {
      const nx = cxb - botHalf + fr * botHalf * 2
      const fx2 = cxb - topHalf + fr * topHalf * 2
      x.beginPath(); x.moveTo(nx, botY); x.lineTo(fx2, topY); x.stroke()
    }
    // far-edge AO (top)
    const ao = x.createLinearGradient(0, topY, 0, topY + 46)
    ao.addColorStop(0, 'rgba(34,22,8,0.36)'); ao.addColorStop(1, 'rgba(34,22,8,0)')
    x.fillStyle = ao; x.fillRect(0, topY, W, 46)
    // near soft light pool
    const lp = x.createRadialGradient(cxb, botY - 16, 24, cxb, botY - 6, 340)
    lp.addColorStop(0, 'rgba(255,238,206,0.24)'); lp.addColorStop(1, 'rgba(255,238,206,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    // side vignette
    const vg = x.createLinearGradient(0, 0, W, 0)
    vg.addColorStop(0, 'rgba(30,20,8,0.22)'); vg.addColorStop(0.15, 'rgba(30,20,8,0)')
    vg.addColorStop(0.85, 'rgba(30,20,8,0)'); vg.addColorStop(1, 'rgba(30,20,8,0.22)')
    x.fillStyle = vg; x.fillRect(0, 0, W, H)
    x.restore()

    // front bevel (thickness)
    x.beginPath()
    x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY)
    x.lineTo(cxb + botHalf, botY + 26); x.lineTo(cxb - botHalf, botY + 26); x.closePath()
    const fbg = x.createLinearGradient(0, botY, 0, botY + 26)
    fbg.addColorStop(0, '#7c5a2c'); fbg.addColorStop(1, '#5f4420')
    x.fillStyle = fbg; x.fill()
    grainH(x, cxb - botHalf, botY, botHalf * 2, 26, 30, '#9a7642', '#4e3818')
    // near-edge highlight
    x.strokeStyle = 'rgba(255,240,210,0.6)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(cxb - botHalf, botY + 1); x.lineTo(cxb + botHalf, botY + 1); x.stroke()
    // drop shadow under the bevel
    const ds = x.createLinearGradient(0, botY + 26, 0, botY + 54)
    ds.addColorStop(0, 'rgba(22,14,4,0.32)'); ds.addColorStop(1, 'rgba(22,14,4,0)')
    x.fillStyle = ds; x.fillRect(cxb - botHalf, botY + 26, botHalf * 2, 30)

    A['shelf'] = scaledURL(c, 0.66)
  }

  /* ───────── TRAY — a shallow wooden tray with a raised front rail the answer
     podiums sit inside. Perspective top face, inner AO where the rail meets the
     floor, a rounded lit rail, contact shadow. ───────── */
  {
    const W = 860, H = 280, cxb = W / 2
    const c = cv(W, H), x = c.getContext('2d')
    const topY = 26, botY = 150, topHalf = 316, botHalf = 402
    const railTop = botY, railBot = botY + 46
    // contact shadow under the whole tray
    const sh = x.createLinearGradient(0, railBot, 0, railBot + 40)
    sh.addColorStop(0, 'rgba(24,16,6,0.30)'); sh.addColorStop(1, 'rgba(24,16,6,0)')
    x.fillStyle = sh; x.fillRect(cxb - botHalf, railBot, botHalf * 2, 40)

    // top (inner floor of the tray)
    x.beginPath()
    x.moveTo(cxb - topHalf, topY); x.lineTo(cxb + topHalf, topY)
    x.lineTo(cxb + botHalf, botY); x.lineTo(cxb - botHalf, botY); x.closePath()
    x.save(); x.clip()
    const g = x.createLinearGradient(0, topY, 0, botY)
    g.addColorStop(0, '#8f6d3b'); g.addColorStop(1, '#a8854f')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    grainH(x, cxb - botHalf, topY, botHalf * 2, botY - topY, 70, '#c8a163', '#6e5028')
    // inner-wall AO all around (it's a tray — the floor sits below a lip)
    const back = x.createLinearGradient(0, topY, 0, topY + 40)
    back.addColorStop(0, 'rgba(30,20,8,0.42)'); back.addColorStop(1, 'rgba(30,20,8,0)')
    x.fillStyle = back; x.fillRect(0, topY, W, 40)
    const lp = x.createRadialGradient(cxb, botY - 14, 20, cxb, botY - 6, 300)
    lp.addColorStop(0, 'rgba(255,238,206,0.20)'); lp.addColorStop(1, 'rgba(255,238,206,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    x.restore()
    // AO right where the front rail rises from the floor
    const rAO = x.createLinearGradient(0, botY - 20, 0, botY)
    rAO.addColorStop(0, 'rgba(28,18,6,0)'); rAO.addColorStop(1, 'rgba(28,18,6,0.4)')
    x.save()
    x.beginPath()
    x.moveTo(cxb - botHalf, botY); x.lineTo(cxb + botHalf, botY)
    x.lineTo(cxb + topHalf, topY); x.lineTo(cxb - topHalf, topY); x.closePath(); x.clip()
    x.fillStyle = rAO; x.fillRect(0, botY - 20, W, 20)
    x.restore()

    // ── raised front RAIL ──
    rr(x, cxb - botHalf, railTop, botHalf * 2, railBot - railTop, 16)
    x.save(); x.clip()
    const rg = x.createLinearGradient(0, railTop, 0, railBot)
    rg.addColorStop(0, '#c49a5a'); rg.addColorStop(0.5, '#a67f45'); rg.addColorStop(1, '#7e5c2c')
    x.fillStyle = rg; x.fillRect(cxb - botHalf, railTop, botHalf * 2, railBot - railTop)
    grainH(x, cxb - botHalf, railTop, botHalf * 2, railBot - railTop, 40, '#dcb679', '#5f451f')
    // top lit lip of the rail
    const lit = x.createLinearGradient(0, railTop, 0, railTop + 12)
    lit.addColorStop(0, 'rgba(255,246,218,0.55)'); lit.addColorStop(1, 'rgba(255,246,218,0)')
    x.fillStyle = lit; x.fillRect(cxb - botHalf, railTop, botHalf * 2, 12)
    // bottom shade of the rail
    const shd = x.createLinearGradient(0, railBot - 14, 0, railBot)
    shd.addColorStop(0, 'rgba(30,20,8,0)'); shd.addColorStop(1, 'rgba(30,20,8,0.4)')
    x.fillStyle = shd; x.fillRect(cxb - botHalf, railBot - 14, botHalf * 2, 14)
    x.restore()
    // rail top highlight stroke
    x.strokeStyle = 'rgba(255,246,220,0.6)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(cxb - botHalf + 16, railTop + 1.5); x.lineTo(cxb + botHalf - 16, railTop + 1.5); x.stroke()

    A['tray'] = scaledURL(c, 0.72)
  }

  return A
}

export async function bake(puppeteer, outSpr) {
  mkdirSync(outSpr, { recursive: true })
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
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

// Run directly (needs puppeteer installed): bakes into public/art/sprites/sequence/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/sequence/', import.meta.url))
  await bake(puppeteer, OUT)
}
