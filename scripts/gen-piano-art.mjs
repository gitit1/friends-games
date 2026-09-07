// Bakes the PIANO (פסנתר חברים) materials as raster art with baked soft lighting,
// gloss, bevels + AO: real glossy WHITE (ivory) keys and raised EBONY BLACK keys
// — each seen slightly from above so a lit top playing-surface AND a front lip
// read as a solid physical key, never a flat CSS box — a pressed variant of each
// (dimmed, sunk, front-lip collapsed), and a warm muted-wood INSTRUMENT FASCIA
// rail (nameboard + felt strip) the keys emerge from. Drawn on an offscreen
// <canvas> in headless Chromium, written as PNGs. Muted, sensory-calm, ONE
// consistent top-left key light (matches the stage spotlight + friends' baked light).
//
// One-off build tool. Needs puppeteer: `npm i -D puppeteer && node scripts/gen-piano-art.mjs`
// (puppeteer is not a permanent dependency; reinstall to regenerate. The bake()
// export lets a runner supply its own puppeteer + output dir.)
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { name: dataURL } ──
export const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

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
  // a rounded rect with independent top/bottom radii (keys: soft top, rounder front)
  function rr2(ctx, x, y, w, h, rt, rb) {
    ctx.beginPath()
    ctx.moveTo(x + rt, y)
    ctx.arcTo(x + w, y, x + w, y + h, rt)
    ctx.arcTo(x + w, y + h, x, y + h, rb)
    ctx.arcTo(x, y + h, x, y, rb)
    ctx.arcTo(x, y, x + w, y, rt)
    ctx.closePath()
  }
  // soft matte speckle inside a rect (calm micro-grain so a surface isn't dead-flat)
  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.4 + Math.random() * 1.2
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.02 + Math.random() * 0.05
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /* ───────── WHITE (IVORY) KEY — a glossy playing surface seen slightly from
     above (top face + a lit front lip), a soft top-left key light, a gentle
     center gloss, a thin right-edge seam shadow (the dark line between keys) and
     a bevelled front lip with AO underneath. `pressed` dims the surface, casts a
     top AO (the key tilted down) and collapses the front lip so it reads SUNK. ── */
  function whiteKey(pressed) {
    const W = 204, H = 272
    const c = cv(W, H), x = c.getContext('2d')
    const m = 8
    const kx = m, ky = m, kw = W - m * 2, kh = H - m * 2
    const lipH = pressed ? 30 : 46          // front-face thickness (collapses when pressed)
    const topBottom = ky + kh - lipH        // where the top face meets the front lip

    x.save()
    rr2(x, kx, ky, kw, kh, 12, 22); x.clip()

    // TOP PLAYING SURFACE — warm ivory, brighter at the back, easing to the lip
    const fg = x.createLinearGradient(0, ky, 0, topBottom)
    if (pressed) { fg.addColorStop(0, '#e9dfc6'); fg.addColorStop(0.6, '#e0d4b8'); fg.addColorStop(1, '#d3c5a4') }
    else { fg.addColorStop(0, '#fdfbf4'); fg.addColorStop(0.55, '#f4ecd8'); fg.addColorStop(1, '#e8dcc2') }
    x.fillStyle = fg; x.fillRect(kx, ky, kw, topBottom - ky)

    // baked top-left key light (single consistent source)
    const kl = x.createRadialGradient(kx + kw * 0.30, ky + kh * 0.16, 10, kx + kw * 0.30, ky + kh * 0.16, kh * 0.9)
    kl.addColorStop(0, `rgba(255,255,255,${pressed ? 0.22 : 0.5})`); kl.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = kl; x.fillRect(kx, ky, kw, kh)

    // gentle center gloss — a soft vertical sheen down the middle (glossy read)
    const gl = x.createLinearGradient(kx, 0, kx + kw, 0)
    gl.addColorStop(0, 'rgba(255,255,255,0)')
    gl.addColorStop(0.5, `rgba(255,255,255,${pressed ? 0.05 : 0.16})`)
    gl.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = gl; x.fillRect(kx, ky, kw, topBottom - ky)

    // right-edge seam shadow — the thin dark gap between neighbouring keys
    const seam = x.createLinearGradient(kx + kw - 22, 0, kx + kw, 0)
    seam.addColorStop(0, 'rgba(60,48,28,0)'); seam.addColorStop(1, 'rgba(48,38,22,0.28)')
    x.fillStyle = seam; x.fillRect(kx + kw - 22, ky, 22, kh)
    // faint left-edge lift
    const le = x.createLinearGradient(kx, 0, kx + 14, 0)
    le.addColorStop(0, 'rgba(255,255,255,0.22)'); le.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = le; x.fillRect(kx, ky, 14, kh)

    // pressed: an AO wash across the TOP (the key has tilted down, back in shadow)
    if (pressed) {
      const pao = x.createLinearGradient(0, ky, 0, ky + kh * 0.5)
      pao.addColorStop(0, 'rgba(40,30,14,0.30)'); pao.addColorStop(1, 'rgba(40,30,14,0)')
      x.fillStyle = pao; x.fillRect(kx, ky, kw, kh * 0.5)
    }

    // FRONT LIP — the vertical front face you see looking slightly down
    const lip = x.createLinearGradient(0, topBottom, 0, ky + kh)
    if (pressed) { lip.addColorStop(0, '#c3b088'); lip.addColorStop(1, '#a9946c') }
    else { lip.addColorStop(0, '#e4d5b4'); lip.addColorStop(1, '#c9b587') }
    x.fillStyle = lip; x.fillRect(kx, topBottom, kw, ky + kh - topBottom)
    // bright edge line where top face meets the front lip (catches the key light)
    x.strokeStyle = `rgba(255,252,242,${pressed ? 0.3 : 0.7})`; x.lineWidth = 2
    x.beginPath(); x.moveTo(kx + 6, topBottom + 1); x.lineTo(kx + kw - 8, topBottom + 1); x.stroke()
    // AO tucked under the front lip (grounds the key)
    const uao = x.createLinearGradient(0, ky + kh - 16, 0, ky + kh)
    uao.addColorStop(0, 'rgba(40,28,12,0)'); uao.addColorStop(1, 'rgba(40,28,12,0.34)')
    x.fillStyle = uao; x.fillRect(kx, ky + kh - 16, kw, 16)

    speckle(x, kx, ky, kw, topBottom - ky, 34, '#fffdf6', '#b6a988')
    x.restore()

    // raised top/left rim bevel (subtle)
    x.save(); rr2(x, kx, ky, kw, kh, 12, 22); x.clip()
    x.strokeStyle = `rgba(255,255,255,${pressed ? 0.3 : 0.75})`; x.lineWidth = 3
    x.beginPath(); x.moveTo(kx + 4, ky + 26); x.arcTo(kx + 4, ky + 4, kx + 26, ky + 4, 18); x.lineTo(kx + kw - 20, ky + 4); x.stroke()
    x.restore()

    return c.toDataURL('image/png')
  }

  /* ───────── BLACK (EBONY) KEY — a raised glossy black key seen slightly from
     above: a dark body, a glossy top-left highlight streak, a lit front cap (the
     tip that catches the light) and a strong AO down its right/bottom so it sits
     PROUD of the white keys. `pressed` dims it, kills the streak and darkens the
     cap so it reads sunk. ───────── */
  function blackKey(pressed) {
    const W = 150, H = 236
    const c = cv(W, H), x = c.getContext('2d')
    const m = 8
    const kx = m, ky = m, kw = W - m * 2, kh = H - m * 2
    const capH = 40                          // lit front tip
    const capTop = ky + kh - capH

    // baked drop shadow so the black key sits above the whites
    const ds = x.createRadialGradient(W / 2, ky + kh - 4, 8, W / 2, ky + kh - 4, kw * 0.9)
    ds.addColorStop(0, 'rgba(6,6,10,0.34)'); ds.addColorStop(1, 'rgba(6,6,10,0)')
    x.fillStyle = ds; x.beginPath(); x.ellipse(W / 2, ky + kh + 2, kw * 0.6, 14, 0, 0, 7); x.fill()

    x.save()
    rr2(x, kx, ky, kw, kh, 8, 16); x.clip()

    // EBONY body
    const bg = x.createLinearGradient(0, ky, 0, ky + kh)
    if (pressed) { bg.addColorStop(0, '#2a2a30'); bg.addColorStop(0.6, '#1a1a1f'); bg.addColorStop(1, '#101014') }
    else { bg.addColorStop(0, '#43434c'); bg.addColorStop(0.5, '#26262d'); bg.addColorStop(1, '#141418') }
    x.fillStyle = bg; x.fillRect(kx, ky, kw, kh)

    // glossy top-left highlight streak (the black key's signature sheen)
    const st = x.createLinearGradient(kx, ky, kx + kw, ky + kh * 0.7)
    st.addColorStop(0, `rgba(200,206,224,${pressed ? 0.06 : 0.26})`)
    st.addColorStop(0.4, 'rgba(200,206,224,0)')
    x.fillStyle = st; x.fillRect(kx, ky, kw * 0.62, kh * 0.72)
    // a soft vertical gloss column just left of center
    const col = x.createLinearGradient(kx + kw * 0.26, 0, kx + kw * 0.5, 0)
    col.addColorStop(0, 'rgba(230,234,246,0)')
    col.addColorStop(0.5, `rgba(230,234,246,${pressed ? 0.05 : 0.14})`)
    col.addColorStop(1, 'rgba(230,234,246,0)')
    x.fillStyle = col; x.fillRect(kx, ky, kw * 0.55, kh * 0.6)

    // right/bottom AO — the body falls away from the light
    const ao = x.createLinearGradient(kx + kw * 0.5, 0, kx + kw, 0)
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.4)')
    x.fillStyle = ao; x.fillRect(kx, ky, kw, kh)

    // LIT FRONT CAP — the tip the finger meets, slightly raised luminance
    const cap = x.createLinearGradient(0, capTop, 0, ky + kh)
    if (pressed) { cap.addColorStop(0, '#2b2b31'); cap.addColorStop(1, '#161619') }
    else { cap.addColorStop(0, '#4a4a53'); cap.addColorStop(0.5, '#33333b'); cap.addColorStop(1, '#202026') }
    x.fillStyle = cap; x.fillRect(kx, capTop, kw, ky + kh - capTop)
    // bright top line on the cap (where light grazes the front edge)
    x.strokeStyle = `rgba(206,210,226,${pressed ? 0.22 : 0.6})`; x.lineWidth = 2
    x.beginPath(); x.moveTo(kx + 8, capTop + 1); x.lineTo(kx + kw - 8, capTop + 1); x.stroke()
    x.restore()

    // crisp left rim highlight + dark right rim
    x.save(); rr2(x, kx, ky, kw, kh, 8, 16); x.clip()
    x.strokeStyle = `rgba(150,154,170,${pressed ? 0.14 : 0.4})`; x.lineWidth = 2
    x.beginPath(); x.moveTo(kx + 3, ky + kh - 20); x.lineTo(kx + 3, ky + 18); x.arcTo(kx + 3, ky + 3, kx + 22, ky + 3, 14); x.stroke()
    x.restore()

    return c.toDataURL('image/png')
  }

  A['piano-white'] = whiteKey(false)
  A['piano-white-press'] = whiteKey(true)
  A['piano-black'] = blackKey(false)
  A['piano-black-press'] = blackKey(true)

  /* ───────── INSTRUMENT FASCIA — the piano's nameboard/key-slip rail the keys
     emerge from: warm muted wood with a baked top-left light wash, soft grain, a
     front bevel highlight, a muted-maroon FELT strip along the bottom and AO
     under it. Wide sprite, stretched across the keyboard by CSS. ───────── */
  {
    const W = 900, H = 150
    const c = cv(W, H), x = c.getContext('2d')

    // wood plank
    const wood = x.createLinearGradient(0, 0, 0, H)
    wood.addColorStop(0, '#8f6039'); wood.addColorStop(0.55, '#734829'); wood.addColorStop(1, '#5c391f')
    x.fillStyle = wood; x.fillRect(0, 0, W, H)

    // top-left light wash
    const lw = x.createRadialGradient(W * 0.22, -20, 40, W * 0.22, -20, W * 0.7)
    lw.addColorStop(0, 'rgba(255,226,180,0.26)'); lw.addColorStop(1, 'rgba(255,226,180,0)')
    x.fillStyle = lw; x.fillRect(0, 0, W, H)

    // soft horizontal woodgrain streaks
    for (let i = 0; i < 16; i++) {
      const gy = Math.random() * H
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,224,180,0.05)' : 'rgba(40,22,10,0.07)'
      x.lineWidth = 0.6 + Math.random() * 1.6
      x.beginPath(); x.moveTo(0, gy)
      x.bezierCurveTo(W * 0.33, gy + (Math.random() - 0.5) * 10, W * 0.66, gy + (Math.random() - 0.5) * 10, W, gy + (Math.random() - 0.5) * 6)
      x.stroke()
    }

    // front bevel highlight near the top edge
    const bev = x.createLinearGradient(0, 0, 0, 14)
    bev.addColorStop(0, 'rgba(255,232,196,0.4)'); bev.addColorStop(1, 'rgba(255,232,196,0)')
    x.fillStyle = bev; x.fillRect(0, 0, W, 14)

    // muted-maroon FELT strip along the bottom (the nameboard felt the keys rest on)
    const feltTop = H - 44
    const felt = x.createLinearGradient(0, feltTop, 0, H)
    felt.addColorStop(0, '#7a3a44'); felt.addColorStop(0.5, '#672f39'); felt.addColorStop(1, '#4f2530')
    x.fillStyle = felt; x.fillRect(0, feltTop, W, H - feltTop)
    // soft top sheen on the felt
    const fsh = x.createLinearGradient(0, feltTop, 0, feltTop + 12)
    fsh.addColorStop(0, 'rgba(190,120,130,0.28)'); fsh.addColorStop(1, 'rgba(190,120,130,0)')
    x.fillStyle = fsh; x.fillRect(0, feltTop, W, 12)
    // fine felt fuzz
    speckle(x, 0, feltTop, W, H - feltTop, 320, '#8a4a54', '#3d1c25')
    // AO where the wood meets the felt (a seam)
    x.strokeStyle = 'rgba(20,8,10,0.45)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(0, feltTop); x.lineTo(W, feltTop); x.stroke()
    // deep AO at the very bottom (keys tuck under here)
    const bao = x.createLinearGradient(0, H - 14, 0, H)
    bao.addColorStop(0, 'rgba(10,4,6,0)'); bao.addColorStop(1, 'rgba(10,4,6,0.5)')
    x.fillStyle = bao; x.fillRect(0, H - 14, W, 14)

    A['piano-fascia'] = c.toDataURL('image/png')
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
  console.log('Total', (total / 1024).toFixed(1) + 'KB. Done.')
}

// Run directly (needs puppeteer installed): bakes into public/art/sprites/piano/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/piano/', import.meta.url))
  await bake(puppeteer, OUT)
}
