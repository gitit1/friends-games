// Bakes the CALCULATOR (מחשבון) materials as raster art with baked soft lighting,
// bevel + AO and matte-plastic micro-texture: the chunky DEVICE BODY (a muted
// slate-teal toy calculator with a real front-thickness lip + contact shadow, a
// recessed screen well and a sunken keypad tray), the recessed SCREEN glass, and
// one physical domed KEY (neutral warm luminance, tintable per function). Drawn on
// an offscreen <canvas> inside headless Chromium, then written as PNGs. Muted,
// sensory-calm, one consistent top-left key light.
//
// One-off build tool. Needs puppeteer: `npm i -D puppeteer && node scripts/gen-calc-art.mjs`
// (puppeteer is not a permanent dependency; reinstall to regenerate. The bake()
// export lets a runner supply its own puppeteer + output dir.)
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { name: dataURL } ──
export const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  function rr(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.arcTo(x + w, y, x + w, y + h, rad)
    ctx.arcTo(x + w, y + h, x, y + h, rad)
    ctx.arcTo(x, y + h, x, y, rad)
    ctx.arcTo(x, y, x + w, y, rad)
    ctx.closePath()
  }
  // soft matte speckle inside a rect (calm plastic grain)
  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.5 + Math.random() * 1.4
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.03 + Math.random() * 0.07
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /* ───────── DEVICE BODY — a chunky toy calculator shell, muted slate-teal
     matte plastic. Straight-on so the CSS key grid overlays cleanly, but with a
     real FRONT-THICKNESS lip, side bevels, a baked contact shadow, a recessed
     SCREEN WELL near the top and a sunken KEYPAD TRAY below — so it reads as a
     solid physical device, never a flat rectangle. ───────── */
  {
    const W = 600, H = 858
    const c = cv(W, H), x = c.getContext('2d')
    const bx = 24, by = 19, bw = W - 48           // body rect
    const lip = 40                                 // front-edge thickness
    const faceBottom = H - 82                       // bottom of the top face
    const faceH = faceBottom - by
    const rad = 54

    // baked contact shadow under the whole device
    const sh = x.createRadialGradient(W / 2, faceBottom + 44, 30, W / 2, faceBottom + 44, 360)
    sh.addColorStop(0, 'rgba(16,22,26,0.40)'); sh.addColorStop(1, 'rgba(16,22,26,0)')
    x.fillStyle = sh
    x.beginPath(); x.ellipse(W / 2, faceBottom + 46, 322, 60, 0, 0, 7); x.fill()

    // FRONT lip (thickness) — a darker rounded band peeking below the top face
    rr(x, bx + 3, by + 40, bw - 6, faceH + lip - 40, rad)
    const lg = x.createLinearGradient(0, faceBottom - 20, 0, faceBottom + lip)
    lg.addColorStop(0, '#2b3a41'); lg.addColorStop(1, '#1c272c')
    x.fillStyle = lg; x.fill()

    // TOP FACE — the muted slate-teal plastic slab the keys sit on
    x.save()
    rr(x, bx, by, bw, faceH, rad); x.clip()
    const fg = x.createLinearGradient(0, by, 0, faceBottom)
    fg.addColorStop(0, '#54727e'); fg.addColorStop(0.5, '#496670'); fg.addColorStop(1, '#3d565f')
    x.fillStyle = fg; x.fillRect(bx, by, bw, faceH)
    // top-left key light wash (single consistent source)
    const kl = x.createRadialGradient(bx + 70, by + 70, 20, bx + 70, by + 70, faceH * 0.95)
    kl.addColorStop(0, 'rgba(206,224,232,0.34)'); kl.addColorStop(1, 'rgba(206,224,232,0)')
    x.fillStyle = kl; x.fillRect(bx, by, bw, faceH)
    // matte plastic micro-speckle
    speckle(x, bx, by, bw, faceH, 320, '#8fabb6', '#28383f')
    x.restore()

    // raised rim bevel: light on top/left, shade on bottom/right
    x.save(); rr(x, bx, by, bw, faceH, rad); x.clip()
    x.strokeStyle = 'rgba(214,232,240,0.55)'; x.lineWidth = 4
    x.beginPath(); x.moveTo(bx + 8, faceBottom - 10); x.lineTo(bx + 8, by + 10)
    x.arcTo(bx + 8, by + 8, bx + 28, by + 8, 22); x.lineTo(bw + bx - 24, by + 8); x.stroke()
    x.strokeStyle = 'rgba(12,18,22,0.42)'; x.lineWidth = 5
    x.beginPath(); x.moveTo(bw + bx - 8, by + 24); x.lineTo(bw + bx - 8, faceBottom - 24)
    x.arcTo(bw + bx - 8, faceBottom - 8, bw + bx - 28, faceBottom - 8, 22); x.lineTo(bx + 28, faceBottom - 8); x.stroke()
    x.restore()

    // helper: sink a recessed panel (inner AO on top/left, soft lift on bottom)
    function recess(rx, ry, rw, rh, rr0, base0, base1) {
      x.save()
      rr(x, rx, ry, rw, rh, rr0); x.clip()
      const g = x.createLinearGradient(0, ry, 0, ry + rh)
      g.addColorStop(0, base0); g.addColorStop(1, base1)
      x.fillStyle = g; x.fillRect(rx, ry, rw, rh)
      // inner top/left AO (the recess casts its own shade)
      const ao = x.createLinearGradient(0, ry, 0, ry + 26)
      ao.addColorStop(0, 'rgba(10,16,20,0.42)'); ao.addColorStop(1, 'rgba(10,16,20,0)')
      x.fillStyle = ao; x.fillRect(rx, ry, rw, 26)
      const aoL = x.createLinearGradient(rx, 0, rx + 22, 0)
      aoL.addColorStop(0, 'rgba(10,16,20,0.34)'); aoL.addColorStop(1, 'rgba(10,16,20,0)')
      x.fillStyle = aoL; x.fillRect(rx, ry, 22, rh)
      // bottom lift
      const lf = x.createLinearGradient(0, ry + rh - 20, 0, ry + rh)
      lf.addColorStop(0, 'rgba(190,212,220,0)'); lf.addColorStop(1, 'rgba(190,212,220,0.18)')
      x.fillStyle = lf; x.fillRect(rx, ry + rh - 20, rw, 20)
      x.restore()
      // crisp recess edge
      x.strokeStyle = 'rgba(8,12,16,0.5)'; x.lineWidth = 2
      rr(x, rx, ry, rw, rh, rr0); x.stroke()
    }

    // SCREEN WELL (top) — a shallow dark recess the LCD glass drops into
    recess(bx + 42, by + 42, bw - 84, 196, 30, '#2c3d43', '#243338')
    // KEYPAD TRAY (lower ~2/3) — the sunken area the keys sit in
    recess(bx + 30, by + 268, bw - 60, faceH - 300, 40, '#415c66', '#38525b')

    A['calc-body'] = c.toDataURL('image/png')
  }

  /* ───────── SCREEN — the recessed LCD glass module: dark calm glass with a
     thin inner bezel, baked top sheen streak and corner AO. Digit TEXT is drawn
     crisp by CSS on top; this is only the glass. ───────── */
  {
    const W = 512, H = 170
    const c = cv(W, H), x = c.getContext('2d')
    // outer bezel frame
    rr(x, 2, 2, W - 4, H - 4, 26)
    const bz = x.createLinearGradient(0, 0, 0, H)
    bz.addColorStop(0, '#1a2529'); bz.addColorStop(1, '#0f1619')
    x.fillStyle = bz; x.fill()
    // inner glass
    const gx = 16, gy = 16, gw = W - 32, gh = H - 32
    x.save()
    rr(x, gx, gy, gw, gh, 16); x.clip()
    const gl = x.createLinearGradient(0, gy, 0, gy + gh)
    gl.addColorStop(0, '#31474d'); gl.addColorStop(0.5, '#27393e'); gl.addColorStop(1, '#1f2e32')
    x.fillStyle = gl; x.fillRect(gx, gy, gw, gh)
    // faint LCD greenish cast
    const cast = x.createRadialGradient(W * 0.5, gy + 10, 20, W * 0.5, gy + 10, gw * 0.8)
    cast.addColorStop(0, 'rgba(120,170,150,0.10)'); cast.addColorStop(1, 'rgba(120,170,150,0)')
    x.fillStyle = cast; x.fillRect(gx, gy, gw, gh)
    // top sheen streak (baked glass highlight)
    const sheen = x.createLinearGradient(0, gy, 0, gy + 40)
    sheen.addColorStop(0, 'rgba(200,224,224,0.22)'); sheen.addColorStop(1, 'rgba(200,224,224,0)')
    x.fillStyle = sheen; x.fillRect(gx, gy, gw, 40)
    // corner vignette AO
    const vg = x.createRadialGradient(W / 2, H / 2, gh * 0.3, W / 2, H / 2, gw * 0.62)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)')
    x.fillStyle = vg; x.fillRect(gx, gy, gw, gh)
    x.restore()
    // inner bezel highlight (bottom) + shade (top) for real inset depth
    x.strokeStyle = 'rgba(150,178,182,0.30)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(gx + 8, gy + gh); x.lineTo(gx + gw - 8, gy + gh); x.stroke()
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(gx + 8, gy); x.lineTo(gx + gw - 8, gy); x.stroke()

    A['calc-screen'] = c.toDataURL('image/png')
  }

  /* ───────── KEY — one physical domed button, rounded square, warm NEUTRAL
     luminance so a single sprite serves every function via a CSS colour wash.
     Baked: top-left key light, domed sheen, bevelled raised rim, bottom AO, a
     soft drop shadow so it sits proud of the tray, matte micro-grain. ───────── */
  {
    const W = 168, H = 168
    const c = cv(W, H), x = c.getContext('2d')
    const m = 12, kw = W - m * 2, kh = H - m * 2, kr = 34

    // drop shadow beneath the key (grounds it on the tray)
    x.save()
    rr(x, m + 4, m + 10, kw, kh, kr); x.clip()
    x.restore()
    const ds = x.createRadialGradient(W / 2, H - m + 2, 6, W / 2, H - m + 2, 90)
    ds.addColorStop(0, 'rgba(10,16,20,0.30)'); ds.addColorStop(1, 'rgba(10,16,20,0)')
    x.fillStyle = ds
    x.beginPath(); x.ellipse(W / 2, H - m + 4, kw * 0.46, 16, 0, 0, 7); x.fill()

    // key body
    x.save()
    rr(x, m, m, kw, kh, kr); x.clip()
    const bg = x.createLinearGradient(0, m, 0, m + kh)
    bg.addColorStop(0, '#e7e2d8'); bg.addColorStop(0.55, '#d8d2c6'); bg.addColorStop(1, '#c4bdae')
    x.fillStyle = bg; x.fillRect(m, m, kw, kh)
    // domed top sheen (key light upper-left)
    const dome = x.createRadialGradient(m + kw * 0.36, m + kh * 0.30, 8, m + kw * 0.36, m + kh * 0.30, kw * 0.9)
    dome.addColorStop(0, 'rgba(255,253,247,0.70)'); dome.addColorStop(0.55, 'rgba(255,253,247,0.12)'); dome.addColorStop(1, 'rgba(255,253,247,0)')
    x.fillStyle = dome; x.fillRect(m, m, kw, kh)
    // bottom-right AO so the dome falls away
    const ao = x.createLinearGradient(m + kw * 0.5, m + kh * 0.5, m + kw, m + kh)
    ao.addColorStop(0, 'rgba(70,64,52,0)'); ao.addColorStop(1, 'rgba(70,64,52,0.34)')
    x.fillStyle = ao; x.fillRect(m, m, kw, kh)
    // matte micro-grain
    speckle(x, m, m, kw, kh, 120, '#fbf7ee', '#9a9384')
    x.restore()

    // raised rim: bright top/left bevel, dark bottom/right
    x.save(); rr(x, m, m, kw, kh, kr); x.clip()
    x.strokeStyle = 'rgba(255,255,250,0.85)'; x.lineWidth = 4
    x.beginPath(); x.moveTo(m + 6, m + kh - 20); x.lineTo(m + 6, m + 20)
    x.arcTo(m + 6, m + 6, m + 26, m + 6, 20); x.lineTo(m + kw - 20, m + 6); x.stroke()
    x.strokeStyle = 'rgba(60,54,44,0.42)'; x.lineWidth = 4
    x.beginPath(); x.moveTo(m + kw - 6, m + 22); x.lineTo(m + kw - 6, m + kh - 20)
    x.arcTo(m + kw - 6, m + kh - 6, m + kw - 26, m + kh - 6, 20); x.lineTo(m + 24, m + kh - 6); x.stroke()
    x.restore()

    A['calc-key'] = c.toDataURL('image/png')
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

// Run directly (needs puppeteer installed): bakes into public/art/sprites/calc/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/calc/', import.meta.url))
  await bake(puppeteer, OUT)
}
