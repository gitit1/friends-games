// Bakes REAL soap-bubble sprites for the "בועות" (bubble pop) calm sensory game.
// The old bubble was a flat CSS radial-gradient disc; these read as actual soap
// bubbles because they carry the four things a real bubble photo has:
//
//   1. a nearly TRANSPARENT body (you see the friend/scene through the middle —
//      a bubble is a thin film, not a coloured ball),
//   2. an IRIDESCENT thin-film sheen — the cyan→green→gold→pink→violet→blue
//      interference sequence, muted to soft pastels (never neon), weighted toward
//      the LOWER edge (gravity drains the film thicker at the bottom),
//   3. a bright FRESNEL RIM — the edge of the sphere glows because light grazes
//      the film there (the single strongest "this is a bubble" cue),
//   4. a crisp SPECULAR HIGHLIGHT (the key-light reflection, upper-left) plus a
//      soft secondary highlight lower-right (the environment bounce).
//
//   bubble-1.png  cool film (cyan/blue dominant at the rim)
//   bubble-2.png  warm film (gold/pink dominant)
//   bubble-3.png  mint film (green/teal dominant)
//   bubble-4.png  lilac film (violet/rose dominant)
//
// Muted, translucent, sensory-calm — nothing flashy. Drawn on an offscreen
// <canvas> inside headless Chromium (createConicGradient for the true thin-film
// swirl), then written as transparent PNGs.
//
// One-off build tool. Needs puppeteer: `npm i -D puppeteer && node scripts/gen-bubbles-art.mjs`
// (puppeteer is NOT a permanent dependency — the bake() export lets a runner
// supply its own puppeteer + output dir, e.g. a sibling app that already has it.)
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { name: dataURL } ──
export const DRAW = () => {
  const A = {}
  const TAU = Math.PI * 2
  const cv = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  // muted thin-film interference sequence (soft pastels, NOT neon). Order matches
  // a real soap film catching light: cyan → mint → gold → pink → violet → blue.
  const FILM = ['#bfe9e6', '#c9edc6', '#efe3b6', '#f3ccd8', '#d9cdf0', '#c4d7f2']

  // one soap bubble. `rot` rotates the conic film so each variant leads with a
  // different colour at the rim; `lead` shifts which hue is dominant.
  function bubble(S, rot, lead) {
    const c = cv(S, S)
    const x = c.getContext('2d')
    const cx = S / 2
    const cy = S / 2
    const R = S * 0.46 // sphere radius (margin left for the rim glow)

    // 1 ── BODY: a barely-there glassy film over the whole disc. Transparent in
    // the middle (the friend shows through), gaining a faint cool sheen toward the
    // rim. Low alpha throughout so it never reads as a solid ball.
    {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0.0, 'rgba(255,255,255,0.00)')
      g.addColorStop(0.55, 'rgba(255,255,255,0.035)')
      g.addColorStop(0.82, 'rgba(226,238,255,0.10)')
      g.addColorStop(0.96, 'rgba(255,255,255,0.17)')
      g.addColorStop(1.0, 'rgba(255,255,255,0.00)')
      x.fillStyle = g
      x.beginPath()
      x.arc(cx, cy, R, 0, TAU)
      x.fill()
    }

    // 2 ── IRIDESCENT FILM: a conic sweep of the thin-film hues, baked on an
    // offscreen canvas, then masked into a RIM-weighted annulus (destination-in
    // multiplies alpha) and again weighted toward the BOTTOM (gravity drainage).
    {
      const f = cv(S, S)
      const fx = f.getContext('2d')
      // conic film swirl
      const cg = fx.createConicGradient(rot, cx, cy)
      const seq = FILM.slice(lead).concat(FILM.slice(0, lead))
      for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, seq[i % seq.length])
      fx.fillStyle = cg
      fx.beginPath()
      fx.arc(cx, cy, R, 0, TAU)
      fx.fill()
      // radial mask → keep the film near the RIM, fade it out of the clear centre
      fx.globalCompositeOperation = 'destination-in'
      const rm = fx.createRadialGradient(cx, cy, R * 0.34, cx, cy, R)
      rm.addColorStop(0.0, 'rgba(0,0,0,0)')
      rm.addColorStop(0.62, 'rgba(0,0,0,0.28)')
      rm.addColorStop(0.9, 'rgba(0,0,0,0.95)')
      rm.addColorStop(1.0, 'rgba(0,0,0,0.55)') // slight feather at the very edge
      fx.fillStyle = rm
      fx.fillRect(0, 0, S, S)
      // vertical mask → thicker (more colour) toward the bottom, thinner up top
      const vm = fx.createLinearGradient(0, cy - R, 0, cy + R)
      vm.addColorStop(0.0, 'rgba(0,0,0,0.45)')
      vm.addColorStop(0.5, 'rgba(0,0,0,0.8)')
      vm.addColorStop(1.0, 'rgba(0,0,0,1)')
      fx.fillStyle = vm
      fx.fillRect(0, 0, S, S)
      fx.globalCompositeOperation = 'source-over'
      // lay the masked film onto the bubble, gently (soft-light keeps it airy)
      x.globalAlpha = 0.62
      x.drawImage(f, 0, 0)
      x.globalAlpha = 1
    }

    // 3 ── FRESNEL RIM: a soft bright ring hugging the edge — the sphere's
    // silhouette lighting. This is what turns a flat disc into a round bubble.
    {
      const g = x.createRadialGradient(cx, cy, R * 0.86, cx, cy, R)
      g.addColorStop(0.0, 'rgba(255,255,255,0)')
      g.addColorStop(0.62, 'rgba(255,255,255,0.10)')
      g.addColorStop(0.9, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.985, 'rgba(255,255,255,0.22)')
      g.addColorStop(1.0, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.beginPath()
      x.arc(cx, cy, R, 0, TAU)
      x.fill()
    }

    // 4 ── SPECULAR HIGHLIGHTS: the key-light reflection (upper-left, soft blob +
    // a crisp core), then a soft secondary bounce lower-right.
    {
      // soft main highlight
      const hx = cx - R * 0.40
      const hy = cy - R * 0.44
      const g = x.createRadialGradient(hx, hy, 0, hx, hy, R * 0.30)
      g.addColorStop(0, 'rgba(255,255,255,0.85)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.32)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.beginPath()
      x.ellipse(hx, hy, R * 0.26, R * 0.20, -0.6, 0, TAU)
      x.fill()
      // crisp core of the highlight
      const g2 = x.createRadialGradient(hx + R * 0.02, hy + R * 0.02, 0, hx + R * 0.02, hy + R * 0.02, R * 0.1)
      g2.addColorStop(0, 'rgba(255,255,255,0.95)')
      g2.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g2
      x.beginPath()
      x.arc(hx + R * 0.02, hy + R * 0.02, R * 0.1, 0, TAU)
      x.fill()
      // soft secondary highlight (environment bounce), lower-right
      const sx = cx + R * 0.36
      const sy = cy + R * 0.40
      const g3 = x.createRadialGradient(sx, sy, 0, sx, sy, R * 0.22)
      g3.addColorStop(0, 'rgba(255,255,255,0.34)')
      g3.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g3
      x.beginPath()
      x.ellipse(sx, sy, R * 0.2, R * 0.14, 0.5, 0, TAU)
      x.fill()
    }

    return c.toDataURL('image/png')
  }

  const S = 224 // crisp at the game's max ~134px display, keeps the 4-sprite set light
  A['bubble-1'] = bubble(S, Math.PI * 1.15, 5) // cool — blue/cyan at the rim
  A['bubble-2'] = bubble(S, Math.PI * 0.25, 2) // warm — gold/pink
  A['bubble-3'] = bubble(S, Math.PI * 1.7, 1) // mint — green/teal
  A['bubble-4'] = bubble(S, Math.PI * 0.7, 4) // lilac — violet/rose
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

// Run directly (needs puppeteer installed): bakes into public/art/sprites/bubbles/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT = fileURLToPath(new URL('../public/art/sprites/bubbles/', import.meta.url))
  await bake(puppeteer, OUT)
}
