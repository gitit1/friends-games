// Bakes the פיצוץ חברים ("pop friends") MATERIALS as raster art with baked soft
// lighting, texture and AO — so the board reads as real glossy friend-BUBBLES
// floating on a calm pool, not CSS circles on a dark gradient:
//   bubble.png — ONE neutral glossy-sphere overlay (specular hotspot, form
//                shadow, Fresnel rim light, faint iridescent sheen + micro
//                texture). Transparent centre so the friend's identity colour
//                (a CSS `var(--c)` fill under it) shows through — one sprite
//                serves every friend/tier, exactly like the coin-sort precedent.
//   pool.jpg   — the calm pool seen from a slight angle: aqua water with baked
//                caustic light, a tiled floor whose grout LINES CONVERGE toward a
//                far edge (a real camera angle, not a flat rectangle), a warm
//                stone coping lip along the near/front edge, top-light + vignette.
// Palette is the GDD's pool set (pool-blue, mint, soft-yellow, water-white),
// desaturated for sensory calm. Key light is baked upper-LEFT (physical — it does
// NOT mirror in RTL/LTR, same rule as the friends).
//
// One-off build tool. Needs puppeteer (not a permanent dep):
//   node scripts/gen-pop-art.mjs
// The bake() export lets a runner supply its own puppeteer + output dirs.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { sprites:{}, bg:{} } ──
export const DRAW = () => {
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.5 + Math.random() * 1.4
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.04 + Math.random() * 0.08
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /* ───────── BUBBLE — one neutral glossy sphere, drawn as a mostly-transparent
     OVERLAY (the friend colour is a CSS fill beneath it). Baked: a broad form
     shadow that swells toward the lower-right rim (volume), a crisp top-left
     specular hotspot + a soft upper sheen (gloss), a thin bright Fresnel rim at
     the bottom edge (soap-bubble translucency), a faint cool iridescence sliver
     and micro surface texture. Neutral light/dark only, so the tint underneath
     survives and one sprite serves every friend. ───────── */
  function bubble() {
    const S = 256, c = cv(S, S), x = c.getContext('2d')
    const cx = S / 2, cy = S / 2, R = S / 2 - 6
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip()

    // 1) FORM SHADOW — transparent around the lit upper-left pole → translucent
    //    cool dark at the lower-right rim (gives the flat tint real volume)
    const fs = x.createRadialGradient(cx - R * 0.34, cy - R * 0.4, R * 0.15, cx + R * 0.14, cy + R * 0.2, R * 1.15)
    fs.addColorStop(0, 'rgba(20,34,48,0)')
    fs.addColorStop(0.55, 'rgba(20,34,48,0.05)')
    fs.addColorStop(0.82, 'rgba(18,30,44,0.20)')
    fs.addColorStop(1, 'rgba(14,24,38,0.44)')
    x.fillStyle = fs; x.fillRect(0, 0, S, S)

    // 2) BOTTOM AO — a touch more shade hugging the underside
    const ao = x.createRadialGradient(cx, cy + R * 0.66, R * 0.1, cx, cy + R * 0.66, R * 0.72)
    ao.addColorStop(0, 'rgba(12,22,34,0.26)'); ao.addColorStop(1, 'rgba(12,22,34,0)')
    x.fillStyle = ao; x.fillRect(0, 0, S, S)

    // 3) UPPER SHEEN — a soft broad glossy wash over the top half
    const sh = x.createRadialGradient(cx - R * 0.28, cy - R * 0.44, R * 0.08, cx - R * 0.1, cy - R * 0.1, R * 0.95)
    sh.addColorStop(0, 'rgba(255,255,255,0.30)'); sh.addColorStop(0.6, 'rgba(255,255,255,0.06)')
    sh.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = sh; x.fillRect(0, 0, S, S)

    // 4) faint cool IRIDESCENCE sliver upper-right (soap-film hint, muted)
    const ir = x.createRadialGradient(cx + R * 0.4, cy - R * 0.3, R * 0.05, cx + R * 0.4, cy - R * 0.3, R * 0.6)
    ir.addColorStop(0, 'rgba(176,224,224,0.16)'); ir.addColorStop(1, 'rgba(176,224,224,0)')
    x.fillStyle = ir; x.fillRect(0, 0, S, S)

    // 5) micro surface texture (very faint — stops it looking like flat vector)
    speckle(x, cx - R, cy - R, R * 2, R * 2, 130, '#ffffff', '#20303f')

    // 6) FRESNEL RIM — a thin bright arc along the lower rim (bubble translucency)
    x.lineWidth = 3.5
    const rim = x.createLinearGradient(0, cy, 0, cy + R)
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(240,250,252,0.55)')
    x.strokeStyle = rim
    x.beginPath(); x.arc(cx, cy, R - 2.5, Math.PI * 0.15, Math.PI * 0.85); x.stroke()

    // 7) SPECULAR HOTSPOT — the crisp glossy catch-light, upper-left
    const hx = cx - R * 0.36, hy = cy - R * 0.4
    const sp = x.createRadialGradient(hx, hy, 1, hx, hy, R * 0.34)
    sp.addColorStop(0, 'rgba(255,255,255,0.95)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.5)')
    sp.addColorStop(1, 'rgba(255,255,255,0)')
    x.save(); x.beginPath(); x.ellipse(hx, hy, R * 0.30, R * 0.22, -0.5, 0, 7); x.clip()
    x.fillStyle = sp; x.fillRect(0, 0, S, S); x.restore()
    // a tiny secondary sparkle just below the hotspot
    const sp2 = x.createRadialGradient(cx - R * 0.12, cy - R * 0.06, 0.5, cx - R * 0.12, cy - R * 0.06, R * 0.1)
    sp2.addColorStop(0, 'rgba(255,255,255,0.7)'); sp2.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = sp2; x.fillRect(0, 0, S, S)

    x.restore()
    return c.toDataURL('image/png')
  }

  /* ───────── POOL — the calm back plane: aqua water with baked caustics, a tiled
     floor whose grout converges to a far edge (camera angle / depth), warm stone
     coping lips (far + near), top light and a soft vignette. Muted = calm. ─── */
  function pool() {
    const W = 680, H = 600, c = cv(W, H), x = c.getContext('2d')
    const FAR = 104                       // far waterline (top); coping above it
    const vpX = W / 2, vpY = -W * 0.9     // vanishing point above the frame

    // warm stone base fills everything (coping shows as top + bottom bands)
    x.fillStyle = '#d3c4a4'; x.fillRect(0, 0, W, H)

    // water base — deeper teal far (top), brighter near (bottom, more light)
    const g = x.createLinearGradient(0, FAR, 0, H - 56)
    g.addColorStop(0, '#6fa6bd'); g.addColorStop(0.5, '#82b7cb'); g.addColorStop(1, '#93c4d4')
    x.fillStyle = g; x.fillRect(0, FAR, W, H - FAR - 56)

    // tiled floor — grout lines converging to the vanishing point (perspective)
    x.save(); x.beginPath(); x.rect(0, FAR, W, H - FAR - 56); x.clip()
    for (let i = -7; i <= 7; i++) {
      const nearX = W / 2 + i * (W / 9)
      const f = (FAR - vpY) / (H - vpY)
      x.strokeStyle = 'rgba(70,120,140,0.30)'; x.lineWidth = 1.4
      x.beginPath(); x.moveTo(vpX + (nearX - vpX) * f, FAR); x.lineTo(nearX, H); x.stroke()
    }
    for (let s = 0.06; s < 1; s += 0.135) {
      const yy = FAR + Math.pow(s, 1.7) * (H - FAR - 56)
      x.strokeStyle = 'rgba(70,120,140,0.26)'; x.lineWidth = 1.2
      x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke()
      x.strokeStyle = 'rgba(232,246,248,0.16)'; x.lineWidth = 1
      x.beginPath(); x.moveTo(0, yy + 1.5); x.lineTo(W, yy + 1.5); x.stroke()
    }
    // baked caustics — a few soft, sparse light ripples (sparse = calm)
    x.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 30; i++) {
      const px = Math.random() * W, py = FAR + Math.random() * (H - FAR - 56)
      const rw = 26 + Math.random() * 58, rh = 8 + Math.random() * 15
      const cg = x.createRadialGradient(px, py, 1, px, py, rw)
      cg.addColorStop(0, 'rgba(226,244,246,0.15)'); cg.addColorStop(1, 'rgba(226,244,246,0)')
      x.save(); x.translate(px, py); x.rotate(Math.random() * 0.8 - 0.4)
      x.scale(1, rh / rw); x.fillStyle = cg
      x.beginPath(); x.arc(0, 0, rw, 0, 7); x.fill(); x.restore()
    }
    x.globalCompositeOperation = 'source-over'
    x.restore()

    // far waterline AO (water meeting the far coping)
    const fao = x.createLinearGradient(0, FAR, 0, FAR + 42)
    fao.addColorStop(0, 'rgba(30,64,80,0.34)'); fao.addColorStop(1, 'rgba(30,64,80,0)')
    x.fillStyle = fao; x.fillRect(0, FAR, W, 42)

    // helper: a warm stone coping band with grout, top-light and edge shade
    const copingBand = (y0, h, near) => {
      const cgd = x.createLinearGradient(0, y0, 0, y0 + h)
      if (near) { cgd.addColorStop(0, '#d0c09c'); cgd.addColorStop(0.5, '#dccaa4'); cgd.addColorStop(1, '#c3b088') }
      else { cgd.addColorStop(0, '#dccaa4'); cgd.addColorStop(1, '#cabb95') }
      x.fillStyle = cgd; x.fillRect(0, y0, W, h)
      speckle(x, 0, y0, W, h, near ? 220 : 90, '#efe4c6', '#a9915f')
      // paving joints
      const step = near ? 96 : 120
      x.strokeStyle = 'rgba(120,98,58,0.28)'; x.lineWidth = 1.5
      for (let jx = step / 2; jx < W; jx += step) { x.beginPath(); x.moveTo(jx, y0); x.lineTo(jx, y0 + h); x.stroke() }
      // lit inner lip + shaded outer edge
      x.fillStyle = 'rgba(255,248,228,0.5)'; x.fillRect(0, near ? y0 : y0 + h - 3, W, 3)
      x.fillStyle = 'rgba(70,52,24,0.22)'; x.fillRect(0, near ? y0 + h - 3 : y0, W, 3)
    }
    copingBand(0, FAR, false)            // FAR coping (top)
    copingBand(H - 56, 56, true)         // NEAR coping (bottom, front)
    // contact shade where the near coping meets the water
    const nao = x.createLinearGradient(0, H - 56, 0, H - 56 - 26)
    nao.addColorStop(0, 'rgba(30,64,80,0.30)'); nao.addColorStop(1, 'rgba(30,64,80,0)')
    x.fillStyle = nao; x.fillRect(0, H - 56 - 26, W, 26)

    // soft top light pool + gentle vignette (depth)
    const lp = x.createRadialGradient(W * 0.42, FAR + 40, 20, W * 0.5, H * 0.5, W * 0.75)
    lp.addColorStop(0, 'rgba(255,255,255,0.12)'); lp.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    const vg = x.createRadialGradient(W / 2, H / 2, W * 0.34, W / 2, H / 2, W * 0.72)
    vg.addColorStop(0, 'rgba(20,40,52,0)'); vg.addColorStop(1, 'rgba(20,40,52,0.22)')
    x.fillStyle = vg; x.fillRect(0, 0, W, H)

    // desaturate ~18% for sensory calm (pull each pixel toward its own grey)
    const img = x.getImageData(0, 0, W, H), d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] += (y - d[i]) * 0.18; d[i + 1] += (y - d[i + 1]) * 0.18; d[i + 2] += (y - d[i + 2]) * 0.18
    }
    x.putImageData(img, 0, 0)
    return c.toDataURL('image/jpeg', 0.82)
  }

  return { sprites: { bubble: bubble() }, bg: { pool: pool() } }
}

export async function bake(puppeteer, outSpr, outBg) {
  mkdirSync(outSpr, { recursive: true })
  mkdirSync(outBg, { recursive: true })
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  const assets = await page.evaluate(DRAW)
  await browser.close()
  let total = 0
  const write = (dir, name, dataUrl) => {
    const ext = dataUrl.startsWith('data:image/jpeg') ? '.jpg' : '.png'
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
    writeFileSync(dir + name + ext, buf)
    total += buf.length
    console.log('  ✓', name + ext, (buf.length / 1024).toFixed(1) + 'KB')
  }
  for (const [name, dataUrl] of Object.entries(assets.sprites)) write(outSpr, name, dataUrl)
  for (const [name, dataUrl] of Object.entries(assets.bg)) write(outBg, name, dataUrl)
  console.log('Total', (total / 1024).toFixed(1) + 'KB')
  console.log('Done.')
}

// Run directly (needs puppeteer): bakes into public/art/sprites/pop/ + art/bg/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT_SPR = fileURLToPath(new URL('../public/art/sprites/pop/', import.meta.url))
  const OUT_BG = fileURLToPath(new URL('../public/art/bg/', import.meta.url))
  await bake(puppeteer, OUT_SPR, OUT_BG)
}
