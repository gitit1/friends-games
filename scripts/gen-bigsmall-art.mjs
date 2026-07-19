// Bakes the "גדול או קטן?" (bigger/smaller) materials as raster art with baked
// soft lighting + wood/brass texture + AO. The scene is a real BALANCE SCALE (the
// ⚖️ the game already carries): the bigger number is HEAVIER, so its pan dips —
// a language-free magnitude cue (the balance-scale metaphor is the strongest
// research-backed way to show "which is bigger" to a pre-symbolic child).
//
//   scale-post.png   turned walnut fulcrum stand (3/4, base + column + brass yoke)
//   scale-beam.png   the balance beam — walnut bar, brass pivot boss, end eyelets
//   scale-pan.png    a shallow brass dish on three cords (a friend stands in it)
//   number-tile.png  a carved wooden number plaque, NEUTRAL luminance → tintable
//   stage-rug.png    a receding woven round rug the scale stands on (depth/ground)
//
// Muted, sensory-calm palette (walnut + soft brass + sage). Drawn on an offscreen
// <canvas> inside headless Chromium, then written as PNGs.
//
// One-off build tool. Needs puppeteer: `npm i -D puppeteer && node scripts/gen-bigsmall-art.mjs`
// (puppeteer is not a permanent dependency. The bake() export lets a runner supply
// its own puppeteer + output dir — e.g. run it from a sibling app that has puppeteer.)
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { name: dataURL } ──
export const DRAW = () => {
  const A = {}
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n
  const TAU = Math.PI * 2

  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.5 + Math.random() * 1.5
      ctx.beginPath(); ctx.arc(px, py, r, 0, TAU)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.05 + Math.random() * 0.12
      ctx.fill()
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
  function grainH(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const gy = y + Math.random() * h
      ctx.strokeStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.05 + Math.random() * 0.12
      ctx.lineWidth = 0.5 + Math.random() * 1.4
      ctx.beginPath(); ctx.moveTo(x, gy)
      for (let sx = x; sx <= x + w; sx += 22) ctx.lineTo(sx, gy + R(2.4))
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
  // a brass knob/boss with baked key light (top-left) — muted, not shiny gold
  function brass(ctx, cx, cy, r) {
    const g = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.4, r * 0.15, cx, cy, r)
    g.addColorStop(0, '#e6cf95'); g.addColorStop(0.5, '#bfa062'); g.addColorStop(1, '#7c6636')
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = g; ctx.fill()
    // rim shade
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU)
    ctx.strokeStyle = 'rgba(70,54,22,0.5)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke()
    // top-left spec
    ctx.beginPath(); ctx.arc(cx - r * 0.32, cy - r * 0.36, r * 0.24, 0, TAU)
    ctx.fillStyle = 'rgba(255,248,220,0.55)'; ctx.fill()
  }

  /* ───────── SCALE POST — a turned walnut fulcrum stand, 3/4 view: weighted
     round base, tapered column with two lathe rings, a brass saddle/yoke on top
     the beam pivots in. Baked top-left key light, right-side shade, contact
     shadow on the floor. ───────── */
  {
    const W = 240, H = 320
    const c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2
    const baseY = 286, baseRx = 84, baseRy = 26

    // contact shadow on the floor
    const sh = x.createRadialGradient(cx, baseY + 12, 8, cx, baseY + 12, 104)
    sh.addColorStop(0, 'rgba(28,20,10,0.34)'); sh.addColorStop(1, 'rgba(28,20,10,0)')
    x.fillStyle = sh; x.beginPath(); x.ellipse(cx + 6, baseY + 14, 98, 24, 0, 0, TAU); x.fill()

    // BASE — a rounded walnut disc with thickness (top ellipse + a short side)
    // side wall
    x.beginPath()
    x.moveTo(cx - baseRx, baseY); x.lineTo(cx - baseRx, baseY - 16)
    x.ellipse(cx, baseY - 16, baseRx, baseRy, 0, Math.PI, 0, true)
    x.lineTo(cx + baseRx, baseY)
    x.ellipse(cx, baseY, baseRx, baseRy, 0, 0, Math.PI, false)
    x.closePath()
    const bs = x.createLinearGradient(0, baseY - 16, 0, baseY + baseRy)
    bs.addColorStop(0, '#6f4f2a'); bs.addColorStop(1, '#4b3319')
    x.fillStyle = bs; x.fill()
    // base top
    x.beginPath(); x.ellipse(cx, baseY - 16, baseRx, baseRy, 0, 0, TAU)
    const bt = x.createRadialGradient(cx - 26, baseY - 24, 8, cx, baseY - 16, baseRx)
    bt.addColorStop(0, '#b7935e'); bt.addColorStop(0.6, '#96733f'); bt.addColorStop(1, '#6f5330')
    x.fillStyle = bt; x.save(); x.clip(); x.fill()
    speckle(x, cx - baseRx, baseY - 42, baseRx * 2, 52, 90, '#d4b47f', '#5a3f22')
    // concentric lathe rings on the base top
    for (let rr2 = baseRx - 10; rr2 > 14; rr2 -= 16) {
      x.beginPath(); x.ellipse(cx, baseY - 16, rr2, rr2 * (baseRy / baseRx), 0, 0, TAU)
      x.strokeStyle = 'rgba(60,42,20,0.28)'; x.lineWidth = 1.4; x.stroke()
    }
    x.restore()
    // top rim highlight
    x.beginPath(); x.ellipse(cx, baseY - 16, baseRx, baseRy, 0, Math.PI, TAU)
    x.strokeStyle = 'rgba(226,204,166,0.5)'; x.lineWidth = 1.6; x.stroke()

    // COLUMN — a tapered shaft rising from the base to the yoke
    const colTop = 70, colBot = baseY - 22
    const topHalf = 15, botHalf = 26
    x.save()
    x.beginPath()
    x.moveTo(cx - topHalf, colTop); x.lineTo(cx + topHalf, colTop)
    x.lineTo(cx + botHalf, colBot); x.lineTo(cx - botHalf, colBot); x.closePath()
    x.clip()
    const cg = x.createLinearGradient(cx - botHalf, 0, cx + botHalf, 0)
    cg.addColorStop(0, '#8a6538'); cg.addColorStop(0.34, '#b18a56'); cg.addColorStop(0.6, '#8f6c40'); cg.addColorStop(1, '#5f4526')
    x.fillStyle = cg; x.fillRect(cx - botHalf, colTop, botHalf * 2, colBot - colTop)
    grainV(x, cx - botHalf, colTop, botHalf * 2, colBot - colTop, 26, '#caa877', '#4e3819')
    speckle(x, cx - botHalf, colTop, botHalf * 2, colBot - colTop, 120, '#d4b47f', '#4e3819')
    x.restore()
    // two lathe rings (turned grooves) across the column
    for (const [yy, hw] of [[colTop + 40, 19], [colBot - 40, 24]]) {
      x.beginPath(); x.ellipse(cx, yy, hw, 6, 0, 0, TAU)
      x.fillStyle = 'rgba(50,36,16,0.4)'; x.fill()
      x.beginPath(); x.ellipse(cx, yy - 4, hw, 5, 0, 0, TAU)
      x.strokeStyle = 'rgba(220,196,156,0.42)'; x.lineWidth = 1.4; x.stroke()
    }
    // column left key-light edge
    x.strokeStyle = 'rgba(226,204,166,0.5)'; x.lineWidth = 2
    x.beginPath(); x.moveTo(cx - topHalf + 3, colTop + 6); x.lineTo(cx - botHalf + 5, colBot - 8); x.stroke()

    // YOKE — a brass saddle on top where the beam pivots
    x.beginPath(); rr(x, cx - 22, colTop - 20, 44, 30, 8)
    const yg = x.createLinearGradient(0, colTop - 20, 0, colTop + 10)
    yg.addColorStop(0, '#d7bd82'); yg.addColorStop(1, '#8a7038')
    x.fillStyle = yg; x.fill()
    x.strokeStyle = 'rgba(70,54,22,0.5)'; x.lineWidth = 1.5; x.stroke()
    brass(x, cx, colTop - 6, 11) // the pivot pin

    A['scale-post'] = c.toDataURL('image/png')
  }

  /* ───────── SCALE BEAM — the balance arm: a long walnut bar (rounded, real
     thickness via an underside AO band), a brass pivot boss dead-centre, and a
     brass eyelet at each end where the pan cords hang. Symmetric so it mirrors
     cleanly. transform-origin = its centre (the pivot). ───────── */
  {
    const W = 480, H = 96
    const c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2, midY = 44
    const barH = 30, barR = barH / 2
    const inset = 30 // bar stops short of the canvas edge (room for eyelets)
    const bx = inset, bw = W - inset * 2

    // soft drop shadow under the bar
    const sh = x.createLinearGradient(0, midY + barR, 0, midY + barR + 20)
    sh.addColorStop(0, 'rgba(26,18,8,0.26)'); sh.addColorStop(1, 'rgba(26,18,8,0)')
    x.fillStyle = sh; rr(x, bx + 6, midY + barR - 4, bw, 18, 9); x.fill()

    // the bar
    x.save(); rr(x, bx, midY - barR, bw, barH, barR); x.clip()
    const bg = x.createLinearGradient(0, midY - barR, 0, midY + barR)
    bg.addColorStop(0, '#c19960'); bg.addColorStop(0.5, '#9a733f'); bg.addColorStop(1, '#5f4325')
    x.fillStyle = bg; x.fillRect(bx, midY - barR, bw, barH)
    grainH(x, bx, midY - barR, bw, barH, 30, '#d3b17e', '#4e3819')
    speckle(x, bx, midY - barR, bw, barH, 160, '#d9bb86', '#4a3418')
    // top key-light sheen
    const tl = x.createLinearGradient(0, midY - barR, 0, midY)
    tl.addColorStop(0, 'rgba(238,222,186,0.5)'); tl.addColorStop(1, 'rgba(238,222,186,0)')
    x.fillStyle = tl; x.fillRect(bx, midY - barR, bw, barR)
    // underside AO
    const ao = x.createLinearGradient(0, midY + 2, 0, midY + barR)
    ao.addColorStop(0, 'rgba(30,20,8,0)'); ao.addColorStop(1, 'rgba(30,20,8,0.4)')
    x.fillStyle = ao; x.fillRect(bx, midY, bw, barR)
    x.restore()

    // end eyelets (brass rings the cords pass through)
    for (const ex of [bx + 6, bx + bw - 6]) {
      brass(x, ex, midY, 9)
      x.beginPath(); x.arc(ex, midY, 3.4, 0, TAU); x.fillStyle = '#4a3a1c'; x.fill() // hole
    }
    // central pivot boss (bigger, sits over the yoke pin)
    brass(x, cx, midY, 16)
    x.beginPath(); x.arc(cx, midY, 4, 0, TAU); x.fillStyle = '#403114'; x.fill()

    A['scale-beam'] = c.toDataURL('image/png')
  }

  /* ───────── SCALE PAN — three cords converging on a brass ring, then a shallow
     brass dish seen slightly from above (top ellipse + a short front wall) a
     friend can stand in. NEUTRAL warm-brass luminance; baked key light + inner
     AO + underside shadow. The cord ring sits at the very top so it hangs off a
     beam eyelet. ───────── */
  {
    const W = 190, H = 168
    const c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2
    const ringY = 12, dishTopY = 96, dishRx = 78, dishRy = 20, wall = 20

    // three cords: ring → dish rim (left, centre-ish, right)
    x.strokeStyle = 'rgba(80,64,30,0.7)'; x.lineWidth = 2.4
    for (const tx of [cx - dishRx + 12, cx, cx + dishRx - 12]) {
      x.beginPath(); x.moveTo(cx, ringY + 4); x.lineTo(tx, dishTopY); x.stroke()
    }
    // hanger ring
    brass(x, cx, ringY, 9)
    x.beginPath(); x.arc(cx, ringY, 3.4, 0, TAU); x.fillStyle = '#4a3a1c'; x.fill()

    // dish underside shadow (on whatever is below)
    const sh = x.createRadialGradient(cx, dishTopY + wall, 6, cx, dishTopY + wall, dishRx)
    sh.addColorStop(0, 'rgba(24,16,6,0.28)'); sh.addColorStop(1, 'rgba(24,16,6,0)')
    x.fillStyle = sh; x.beginPath(); x.ellipse(cx + 4, dishTopY + wall + 4, dishRx * 0.9, 14, 0, 0, TAU); x.fill()

    // front WALL of the dish (short band below the rim)
    x.beginPath()
    x.moveTo(cx - dishRx, dishTopY)
    x.ellipse(cx, dishTopY, dishRx, dishRy, 0, Math.PI, 0, true)
    x.lineTo(cx + dishRx - 6, dishTopY + wall)
    x.ellipse(cx, dishTopY + wall, dishRx - 6, dishRy - 4, 0, 0, Math.PI, false)
    x.closePath()
    const wg = x.createLinearGradient(0, dishTopY, 0, dishTopY + wall)
    wg.addColorStop(0, '#a98b4e'); wg.addColorStop(1, '#6f5628')
    x.fillStyle = wg; x.fill()

    // dish TOP (the bowl interior, seen from above)
    x.beginPath(); x.ellipse(cx, dishTopY, dishRx, dishRy, 0, 0, TAU)
    const dg = x.createRadialGradient(cx - 20, dishTopY - 4, 6, cx, dishTopY, dishRx)
    dg.addColorStop(0, '#e2cd94'); dg.addColorStop(0.55, '#c3a566'); dg.addColorStop(1, '#8f7238')
    x.fillStyle = dg; x.save(); x.clip(); x.fill()
    // brushed concentric rings + inner AO
    for (let rr2 = dishRx - 8; rr2 > 8; rr2 -= 12) {
      x.beginPath(); x.ellipse(cx, dishTopY, rr2, rr2 * (dishRy / dishRx), 0, 0, TAU)
      x.strokeStyle = 'rgba(120,96,44,0.22)'; x.lineWidth = 1; x.stroke()
    }
    const iao = x.createRadialGradient(cx, dishTopY, dishRx * 0.4, cx, dishTopY, dishRx)
    iao.addColorStop(0, 'rgba(60,44,18,0)'); iao.addColorStop(1, 'rgba(60,44,18,0.3)')
    x.fillStyle = iao; x.fillRect(cx - dishRx, dishTopY - dishRy, dishRx * 2, dishRy * 2)
    x.restore()
    // rim highlight
    x.beginPath(); x.ellipse(cx, dishTopY, dishRx, dishRy, 0, Math.PI, TAU)
    x.strokeStyle = 'rgba(240,226,190,0.6)'; x.lineWidth = 1.8; x.stroke()

    A['scale-pan'] = c.toDataURL('image/png')
  }

  /* ───────── NUMBER TILE — a carved square wooden plaque with a recessed centre
     panel (the crisp CSS number sits on top). NEUTRAL warm luminance so a CSS
     colour wash tints it to the friend's identity colour; baked bevel + grain +
     groove AO + top-left key light. ───────── */
  {
    const S = 148
    const c = cv(S, S), x = c.getContext('2d')
    const m = 8
    // outer plaque
    x.save(); rr(x, m, m, S - m * 2, S - m * 2, 22); x.clip()
    const pg = x.createLinearGradient(0, m, 0, S - m)
    pg.addColorStop(0, '#c2a06a'); pg.addColorStop(0.5, '#a6824c'); pg.addColorStop(1, '#7d5f34')
    x.fillStyle = pg; x.fillRect(0, 0, S, S)
    grainV(x, m, m, S - m * 2, S - m * 2, 30, '#d8bb86', '#5c4321')
    speckle(x, m, m, S - m * 2, S - m * 2, 160, '#e0c592', '#563e1e')
    // top-left key light wash
    const kl = x.createRadialGradient(m + 20, m + 20, 6, m + 20, m + 20, S)
    kl.addColorStop(0, 'rgba(244,230,196,0.4)'); kl.addColorStop(1, 'rgba(244,230,196,0)')
    x.fillStyle = kl; x.fillRect(0, 0, S, S)
    x.restore()
    // outer bevel: light top/left, dark bottom/right
    x.save(); rr(x, m, m, S - m * 2, S - m * 2, 22); x.clip()
    x.strokeStyle = 'rgba(246,232,198,0.6)'; x.lineWidth = 3
    x.beginPath(); x.moveTo(m + 4, S - m - 6); x.lineTo(m + 4, m + 4); x.lineTo(S - m - 6, m + 4); x.stroke()
    x.strokeStyle = 'rgba(52,36,16,0.5)'; x.lineWidth = 3
    x.beginPath(); x.moveTo(S - m - 4, m + 6); x.lineTo(S - m - 4, S - m - 4); x.lineTo(m + 6, S - m - 4); x.stroke()
    x.restore()
    // recessed centre panel (a routed groove ring) so the number reads "carved in"
    const im = 30
    x.beginPath(); rr(x, im, im, S - im * 2, S - im * 2, 14)
    x.strokeStyle = 'rgba(48,34,15,0.5)'; x.lineWidth = 2.4; x.stroke()
    x.beginPath(); rr(x, im + 2.5, im + 2.5, S - im * 2 - 5, S - im * 2 - 5, 12)
    x.strokeStyle = 'rgba(240,224,188,0.4)'; x.lineWidth = 1.4; x.stroke()
    // faint inner shading of the recess
    const rg = x.createLinearGradient(0, im, 0, S - im)
    rg.addColorStop(0, 'rgba(40,28,12,0.18)'); rg.addColorStop(0.5, 'rgba(40,28,12,0)'); rg.addColorStop(1, 'rgba(255,244,214,0.14)')
    x.save(); rr(x, im + 3, im + 3, S - im * 2 - 6, S - im * 2 - 6, 11); x.clip()
    x.fillStyle = rg; x.fillRect(im, im, S - im * 2, S - im * 2); x.restore()

    A['number-tile'] = c.toDataURL('image/png')
  }

  /* ───────── STAGE RUG — a receding round woven rug the scale stands on: a wide
     ellipse (perspective floor) in muted sage/oatmeal, radial woven texture,
     far-edge AO, a soft near light pool, and a stitched border. Grounds the whole
     scale + gives the diorama depth. ───────── */
  {
    // kept at a modest resolution — this is a soft, out-of-focus floor element
    // (not text), so it can be oversampled by CSS without reading as blurry.
    const W = 560, H = 240, cx = W / 2, cy = 120
    const c = cv(W, H), x = c.getContext('2d')
    const rx = 268, ry = 102
    // soft floor shadow under the rug
    const fs = x.createRadialGradient(cx, cy + 8, 20, cx, cy + 8, rx)
    fs.addColorStop(0, 'rgba(26,20,10,0.22)'); fs.addColorStop(1, 'rgba(26,20,10,0)')
    x.fillStyle = fs; x.beginPath(); x.ellipse(cx + 8, cy + 18, rx, ry, 0, 0, TAU); x.fill()

    // the rug body
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.clip()
    const g = x.createRadialGradient(cx - 40, cy - 30, 30, cx, cy, rx)
    g.addColorStop(0, '#a7b494'); g.addColorStop(0.6, '#8f9d7c'); g.addColorStop(1, '#71805f')
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    // concentric woven bands
    for (let k = 1; k <= 7; k++) {
      const f = k / 7
      x.beginPath(); x.ellipse(cx, cy, rx * f, ry * f, 0, 0, TAU)
      x.strokeStyle = k % 2 ? 'rgba(120,134,100,0.3)' : 'rgba(196,206,178,0.26)'
      x.lineWidth = 5; x.stroke()
    }
    // radial weave stitches (kept sparse — high-frequency noise inflates the PNG)
    for (let i = 0; i < 130; i++) {
      const a = Math.random() * TAU, rad = Math.random()
      const px = cx + Math.cos(a) * rx * rad, py = cy + Math.sin(a) * ry * rad
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(210,220,192,0.16)' : 'rgba(96,110,78,0.18)'
      x.lineWidth = 0.8
      x.beginPath(); x.moveTo(px, py)
      x.lineTo(px + Math.cos(a) * 7, py + Math.sin(a) * 7); x.stroke()
    }
    // far-edge AO (top of ellipse recedes → darker)
    const ao = x.createLinearGradient(0, cy - ry, 0, cy)
    ao.addColorStop(0, 'rgba(40,48,30,0.34)'); ao.addColorStop(1, 'rgba(40,48,30,0)')
    x.fillStyle = ao; x.fillRect(0, cy - ry, W, ry)
    // near soft light pool (front)
    const lp = x.createRadialGradient(cx, cy + ry * 0.4, 20, cx, cy + ry * 0.3, rx * 0.9)
    lp.addColorStop(0, 'rgba(234,240,216,0.22)'); lp.addColorStop(1, 'rgba(234,240,216,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    x.restore()

    // stitched border just inside the edge
    x.beginPath(); x.ellipse(cx, cy, rx - 14, ry - 8, 0, 0, TAU)
    x.strokeStyle = 'rgba(238,244,222,0.34)'; x.lineWidth = 2; x.setLineDash([9, 7]); x.stroke(); x.setLineDash([])
    // near-edge highlight, far-edge kept soft
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0.15 * TAU, 0.35 * TAU)
    x.strokeStyle = 'rgba(214,224,196,0.5)'; x.lineWidth = 2.4; x.stroke()

    A['stage-rug'] = c.toDataURL('image/png')
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

// Run directly (needs puppeteer installed): bakes into public/art/sprites/bigsmall/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/bigsmall/', import.meta.url))
  await bake(puppeteer, OUT)
}
