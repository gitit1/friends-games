// Bakes the "החבר שלי" (gentle virtual-pet) MATERIALS as raster art with baked
// soft lighting, texture and AO — so the pet's HOME + its care props read as real
// touchable objects, not CSS shapes. A calm, cozy, MUTED palette (sensory rule).
//
//   room.jpg  — the cozy room CORNER the pet lives in, seen at a slight angle:
//               a warm muted wall with a soft light-spill, a real wood-framed
//               WINDOW (glass sky + sill), a little wall SHELF with a plant + book,
//               and a wood-plank FLOOR whose seams CONVERGE toward a vanishing
//               point (a real camera angle → depth), a wall→floor AO seam, top
//               light + vignette. Baked key light is upper-LEFT (physical; it does
//               NOT mirror in RTL/LTR, same rule as the friends).
//   rug.png   — a soft woven oval rug (foreshortened), the pet's grounding spot:
//               concentric weave, cream stitched border, pile speckle, top sheen.
//   bed.png   — a plush round pet BED (bolster + dished cushion) with tufts,
//               top-left highlight and a soft contact shadow.
//   bowl.png  — a ceramic food BOWL (3/4 view) with a little muted-brown kibble
//               mound, a painted accent band, rim light + interior AO.
//   ball.png  — a soft toy BALL: muted coral + cream panels, a broad specular
//               sheen, form shadow, thin rim + a baked contact shadow.
//
// One-off build tool. Needs puppeteer (NOT a permanent dep):
//   node scripts/gen-pet-art.mjs
// The bake() export lets a runner supply its own puppeteer + output dirs.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── the drawing program runs IN the browser; returns { sprites:{}, bg:{} } ──
export const DRAW = () => {
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const R = (n) => (Math.random() - 0.5) * n

  // faint speckle texture inside a region (kills the flat-vector look)
  function speckle(ctx, x, y, w, h, n, light, dark) {
    for (let i = 0; i < n; i++) {
      const px = x + Math.random() * w, py = y + Math.random() * h, r = 0.5 + Math.random() * 1.5
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7)
      ctx.fillStyle = Math.random() < 0.5 ? light : dark
      ctx.globalAlpha = 0.04 + Math.random() * 0.09
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  // pull an image ~15% toward its own grey — the sensory-calm "muted" rule
  function mute(ctx, W, H, amt) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] += (y - d[i]) * amt; d[i + 1] += (y - d[i + 1]) * amt; d[i + 2] += (y - d[i + 2]) * amt
    }
    ctx.putImageData(img, 0, 0)
  }

  /* ═════════ ROOM — the cozy corner the pet lives in (JPEG back plane) ═════════ */
  function room() {
    const W = 760, H = 620, c = cv(W, H), x = c.getContext('2d')
    const FLOOR = Math.round(H * 0.63) // wall→floor seam

    // WALL — warm muted cream, a touch darker toward the seam
    const wg = x.createLinearGradient(0, 0, 0, FLOOR)
    wg.addColorStop(0, '#e9dfcb'); wg.addColorStop(1, '#dccfb5')
    x.fillStyle = wg; x.fillRect(0, 0, W, FLOOR)
    // soft warm light-spill from the window (upper-left, physical key light)
    const spill = x.createRadialGradient(W * 0.24, H * 0.16, 18, W * 0.24, H * 0.18, W * 0.62)
    spill.addColorStop(0, 'rgba(255,246,216,0.55)'); spill.addColorStop(1, 'rgba(255,246,216,0)')
    x.fillStyle = spill; x.fillRect(0, 0, W, FLOOR)
    speckle(x, 0, 0, W, FLOOR, 340, '#fbf3df', '#c8bc9d')

    // ── WINDOW (upper-left): wood frame · glass sky · muntins · sill ──
    const wx = W * 0.09, wy = H * 0.13, ww = W * 0.30, wh = H * 0.34
    // frame shadow on the wall
    x.fillStyle = 'rgba(70,52,28,0.16)'; x.fillRect(wx + 6, wy + 8, ww, wh)
    // outer wood frame
    const fr = x.createLinearGradient(wx, wy, wx + ww, wy + wh)
    fr.addColorStop(0, '#c69a68'); fr.addColorStop(1, '#a97c4c')
    x.fillStyle = fr; x.fillRect(wx, wy, ww, wh)
    x.fillStyle = 'rgba(255,246,224,0.5)'; x.fillRect(wx, wy, ww, 4) // top-lit frame edge
    // glass
    const gx = wx + 12, gy = wy + 12, gw = ww - 24, gh = wh - 24
    const sky = x.createLinearGradient(0, gy, 0, gy + gh)
    sky.addColorStop(0, '#bcd8e6'); sky.addColorStop(0.62, '#d6e6e2'); sky.addColorStop(1, '#eae4cf')
    x.fillStyle = sky; x.fillRect(gx, gy, gw, gh)
    // soft sun glow high-right in the glass
    const sun = x.createRadialGradient(gx + gw * 0.74, gy + gh * 0.26, 4, gx + gw * 0.74, gy + gh * 0.26, gw * 0.6)
    sun.addColorStop(0, 'rgba(255,250,228,0.85)'); sun.addColorStop(1, 'rgba(255,250,228,0)')
    x.fillStyle = sun; x.fillRect(gx, gy, gw, gh)
    // a distant muted hill along the horizon
    x.save(); x.beginPath(); x.rect(gx, gy, gw, gh); x.clip()
    x.fillStyle = '#b7c7a6'
    x.beginPath(); x.moveTo(gx, gy + gh * 0.72)
    for (let s = 0; s <= gw; s += 20) x.lineTo(gx + s, gy + gh * 0.72 + Math.sin(s / 46) * 6 + Math.sin(s / 17) * 2)
    x.lineTo(gx + gw, gy + gh); x.lineTo(gx, gy + gh); x.closePath(); x.fill()
    x.restore()
    // muntins (cream cross)
    x.fillStyle = '#f3ecdd'
    x.fillRect(gx + gw / 2 - 3, gy, 6, gh)
    x.fillRect(gx, gy + gh / 2 - 3, gw, 6)
    // inner frame AO
    x.strokeStyle = 'rgba(60,44,22,0.28)'; x.lineWidth = 3; x.strokeRect(gx, gy, gw, gh)
    // wooden SILL below the window, with top light + drop shadow
    x.fillStyle = 'rgba(60,44,22,0.16)'; x.fillRect(wx - 8, wy + wh, ww + 22, 12)
    const sillg = x.createLinearGradient(0, wy + wh, 0, wy + wh + 16)
    sillg.addColorStop(0, '#d8b483'); sillg.addColorStop(1, '#b98a58')
    x.fillStyle = sillg; x.fillRect(wx - 10, wy + wh - 4, ww + 20, 16)
    x.fillStyle = 'rgba(255,248,228,0.6)'; x.fillRect(wx - 10, wy + wh - 4, ww + 20, 3)

    // ── SHELF (upper-right): wood plank · potted plant · leaning book ──
    const shx = W * 0.60, shy = H * 0.34, shw = W * 0.32
    x.fillStyle = 'rgba(60,44,22,0.18)'; x.fillRect(shx + 4, shy + 10, shw, 10) // shadow
    const shg = x.createLinearGradient(0, shy, 0, shy + 12)
    shg.addColorStop(0, '#c99a66'); shg.addColorStop(1, '#a2764a')
    x.fillStyle = shg; x.fillRect(shx, shy, shw, 12)
    x.fillStyle = 'rgba(255,248,228,0.55)'; x.fillRect(shx, shy, shw, 3)
    // little book leaning at the left of the shelf
    x.save(); x.translate(shx + shw * 0.18, shy); x.rotate(-0.12)
    x.fillStyle = '#9bb0ab'; x.fillRect(-10, -46, 20, 46)
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(-10, -46, 4, 46)
    x.restore()
    // terracotta pot + soft plant on the right of the shelf
    const potx = shx + shw * 0.66, poty = shy
    const pg = x.createLinearGradient(potx - 18, 0, potx + 18, 0)
    pg.addColorStop(0, '#cf8f66'); pg.addColorStop(1, '#a86842')
    x.fillStyle = pg
    x.beginPath(); x.moveTo(potx - 17, poty - 26); x.lineTo(potx + 17, poty - 26); x.lineTo(potx + 12, poty); x.lineTo(potx - 12, poty); x.closePath(); x.fill()
    x.fillStyle = 'rgba(255,240,222,0.4)'; x.fillRect(potx - 17, poty - 26, 34, 3)
    for (const [dx, dy, r] of [[-12, -44, 15], [10, -46, 14], [-2, -56, 16], [0, -40, 13]]) {
      const lg = x.createRadialGradient(potx + dx - 4, poty + dy - 4, 2, potx + dx, poty + dy, r)
      lg.addColorStop(0, '#a9c489'); lg.addColorStop(1, '#7fa163')
      x.fillStyle = lg; x.beginPath(); x.ellipse(potx + dx, poty + dy, r, r * 1.25, R(0.5), 0, 7); x.fill()
    }

    // ── FLOOR — wood planks whose seams converge to a vanishing point (depth) ──
    const vpX = W / 2, vpY = -H * 0.5
    const fg = x.createLinearGradient(0, FLOOR, 0, H)
    fg.addColorStop(0, '#b58c5e'); fg.addColorStop(1, '#cfa87a')
    x.fillStyle = fg; x.fillRect(0, FLOOR, W, H - FLOOR)
    x.save(); x.beginPath(); x.rect(0, FLOOR, W, H - FLOOR); x.clip()
    // converging plank seams
    for (let i = -6; i <= 6; i++) {
      const nearX = W / 2 + i * (W / 7)
      const f = (FLOOR - vpY) / (H - vpY)
      const farX = vpX + (nearX - vpX) * f
      x.strokeStyle = 'rgba(84,58,30,0.34)'; x.lineWidth = 1.6
      x.beginPath(); x.moveTo(farX, FLOOR); x.lineTo(nearX, H); x.stroke()
      x.strokeStyle = 'rgba(255,238,206,0.16)'; x.lineWidth = 1
      x.beginPath(); x.moveTo(farX + 1.5, FLOOR); x.lineTo(nearX + 2, H); x.stroke()
    }
    // long grain streaks (denser + shorter far away)
    for (let i = 0; i < 60; i++) {
      const t = Math.pow(Math.random(), 1.6) // bias to the far edge
      const yy = FLOOR + t * (H - FLOOR)
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(120,86,48,0.16)' : 'rgba(214,180,132,0.16)'
      x.lineWidth = 0.7 + t * 1.8
      x.beginPath(); x.moveTo(0, yy)
      for (let sx = 0; sx <= W; sx += 44) x.lineTo(sx, yy + R(4))
      x.stroke()
    }
    x.restore()
    // wall→floor AO seam (contact shadow of the wall onto the floor) + skirting
    const ao = x.createLinearGradient(0, FLOOR, 0, FLOOR + 34)
    ao.addColorStop(0, 'rgba(52,34,16,0.4)'); ao.addColorStop(1, 'rgba(52,34,16,0)')
    x.fillStyle = ao; x.fillRect(0, FLOOR, W, 34)
    x.fillStyle = '#e4d6bd'; x.fillRect(0, FLOOR - 8, W, 8) // pale skirting board
    x.fillStyle = 'rgba(255,250,236,0.5)'; x.fillRect(0, FLOOR - 8, W, 2)

    // soft top-light pool + gentle vignette (depth) then mute for calm
    const lp = x.createRadialGradient(W * 0.42, H * 0.12, 20, W * 0.5, H * 0.5, W * 0.8)
    lp.addColorStop(0, 'rgba(255,252,240,0.14)'); lp.addColorStop(1, 'rgba(255,252,240,0)')
    x.fillStyle = lp; x.fillRect(0, 0, W, H)
    const vg = x.createRadialGradient(W / 2, H * 0.46, W * 0.34, W / 2, H * 0.52, W * 0.78)
    vg.addColorStop(0, 'rgba(40,28,14,0)'); vg.addColorStop(1, 'rgba(40,28,14,0.2)')
    x.fillStyle = vg; x.fillRect(0, 0, W, H)
    mute(x, W, H, 0.15)
    return c.toDataURL('image/jpeg', 0.82)
  }

  /* ═════════ RUG — the pet's grounding spot (foreshortened oval) ═════════ */
  function rug() {
    const W = 420, H = 182, c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2, cy = H * 0.56, rx = W * 0.47, ry = H * 0.4
    x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.clip()
    // base dusty-rose weave
    const bg = x.createRadialGradient(cx - rx * 0.22, cy - ry * 0.3, 6, cx, cy, rx)
    bg.addColorStop(0, '#d9b4c0'); bg.addColorStop(1, '#c191a1')
    x.fillStyle = bg; x.fillRect(0, 0, W, H)
    // concentric woven rings
    for (let r = 0.9; r > 0.15; r -= 0.16) {
      x.strokeStyle = r % 0.32 < 0.16 ? 'rgba(238,220,224,0.5)' : 'rgba(150,104,120,0.32)'
      x.lineWidth = 5; x.beginPath(); x.ellipse(cx, cy, rx * r, ry * r, 0, 0, 7); x.stroke()
    }
    // radial pile texture
    speckle(x, cx - rx, cy - ry, rx * 2, ry * 2, 260, '#efdfe2', '#a97a8b')
    // top sheen (light from upper-left) + far-edge AO
    const sh = x.createLinearGradient(0, cy - ry, 0, cy + ry)
    sh.addColorStop(0, 'rgba(255,246,248,0.28)'); sh.addColorStop(0.4, 'rgba(255,246,248,0)'); sh.addColorStop(1, 'rgba(120,80,92,0.14)')
    x.fillStyle = sh; x.fillRect(0, 0, W, H)
    x.restore()
    // cream stitched border
    x.strokeStyle = '#ecdfe0'; x.lineWidth = 7; x.beginPath(); x.ellipse(cx, cy, rx - 3, ry - 3, 0, 0, 7); x.stroke()
    x.strokeStyle = 'rgba(150,104,120,0.4)'; x.lineWidth = 1.4; x.setLineDash([7, 6])
    x.beginPath(); x.ellipse(cx, cy, rx - 3, ry - 3, 0, 0, 7); x.stroke(); x.setLineDash([])
    return c.toDataURL('image/png')
  }

  /* ═════════ BED — a plush round pet bed (bolster + dished cushion) ═════════ */
  function bed() {
    const W = 340, H = 244, c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2, cy = H * 0.56, rx = W * 0.46, ry = H * 0.34
    // soft contact shadow under the bed
    const cs = x.createRadialGradient(cx, cy + ry * 0.82, 8, cx, cy + ry * 0.82, rx)
    cs.addColorStop(0, 'rgba(30,24,16,0.28)'); cs.addColorStop(1, 'rgba(30,24,16,0)')
    x.fillStyle = cs; x.beginPath(); x.ellipse(cx, cy + ry * 0.82, rx * 0.96, ry * 0.5, 0, 0, 7); x.fill()
    // outer bolster (plush ring) — muted slate blue
    const bl = x.createLinearGradient(0, cy - ry, 0, cy + ry)
    bl.addColorStop(0, '#b3bfcb'); bl.addColorStop(1, '#8b9aad')
    x.fillStyle = bl; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill()
    // tuft segments around the bolster
    const tn = 22
    for (let i = 0; i < tn; i++) {
      const a = (i / tn) * Math.PI * 2
      const ex = cx + Math.cos(a) * rx * 0.82, ey = cy + Math.sin(a) * ry * 0.82
      x.strokeStyle = 'rgba(70,86,104,0.28)'; x.lineWidth = 2
      x.beginPath(); x.moveTo(cx + Math.cos(a) * rx * 0.66, cy + Math.sin(a) * ry * 0.66); x.lineTo(ex, ey); x.stroke()
    }
    // dished cushion (inner well) — warm cream, darker in the middle (AO where the pet sits)
    const iw = x.createRadialGradient(cx - rx * 0.12, cy - ry * 0.18, 6, cx, cy + ry * 0.1, rx * 0.62)
    iw.addColorStop(0, '#efe6d3'); iw.addColorStop(0.7, '#e2d4bb'); iw.addColorStop(1, '#c9b393')
    x.fillStyle = iw; x.beginPath(); x.ellipse(cx, cy + ry * 0.06, rx * 0.62, ry * 0.6, 0, 0, 7); x.fill()
    speckle(x, cx - rx * 0.62, cy - ry * 0.5, rx * 1.24, ry * 1.2, 160, '#fbf4e6', '#b39e7e')
    // inner-rim AO where cushion meets bolster
    x.strokeStyle = 'rgba(80,64,42,0.2)'; x.lineWidth = 6; x.beginPath(); x.ellipse(cx, cy + ry * 0.06, rx * 0.62, ry * 0.6, 0, 0, 7); x.stroke()
    // top-left highlight arc on the bolster (form)
    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 5
    x.beginPath(); x.ellipse(cx, cy, rx - 4, ry - 4, 0, Math.PI * 1.05, Math.PI * 1.62); x.stroke()
    return c.toDataURL('image/png')
  }

  /* ═════════ BOWL — a ceramic food bowl, 3/4 view, with kibble ═════════ */
  function bowl() {
    const W = 264, H = 178, c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2, rimY = H * 0.34, rxO = W * 0.42, ryO = H * 0.16, bodyBot = H * 0.9
    // contact shadow
    const cs = x.createRadialGradient(cx, bodyBot, 6, cx, bodyBot, rxO * 1.1)
    cs.addColorStop(0, 'rgba(30,22,12,0.26)'); cs.addColorStop(1, 'rgba(30,22,12,0)')
    x.fillStyle = cs; x.beginPath(); x.ellipse(cx, bodyBot, rxO, ryO * 0.7, 0, 0, 7); x.fill()
    // outer body
    const bg = x.createLinearGradient(0, rimY, 0, bodyBot)
    bg.addColorStop(0, '#efdfc6'); bg.addColorStop(0.55, '#dcc6a2'); bg.addColorStop(1, '#bd9f77')
    x.fillStyle = bg
    x.beginPath(); x.moveTo(cx - rxO, rimY); x.bezierCurveTo(cx - rxO, bodyBot - 6, cx - rxO * 0.5, bodyBot, cx, bodyBot); x.bezierCurveTo(cx + rxO * 0.5, bodyBot, cx + rxO, bodyBot - 6, cx + rxO, rimY); x.closePath(); x.fill()
    // left light / right shade on the body
    const bl = x.createLinearGradient(cx - rxO, 0, cx + rxO, 0)
    bl.addColorStop(0, 'rgba(255,250,238,0.42)'); bl.addColorStop(0.4, 'rgba(255,250,238,0)'); bl.addColorStop(1, 'rgba(110,84,44,0.3)')
    x.fillStyle = bl
    x.beginPath(); x.moveTo(cx - rxO, rimY); x.bezierCurveTo(cx - rxO, bodyBot - 6, cx - rxO * 0.5, bodyBot, cx, bodyBot); x.bezierCurveTo(cx + rxO * 0.5, bodyBot, cx + rxO, bodyBot - 6, cx + rxO, rimY); x.closePath(); x.fill()
    // painted accent band (muted teal)
    x.save(); x.beginPath(); x.moveTo(cx - rxO, rimY); x.bezierCurveTo(cx - rxO, bodyBot - 6, cx - rxO * 0.5, bodyBot, cx, bodyBot); x.bezierCurveTo(cx + rxO * 0.5, bodyBot, cx + rxO, bodyBot - 6, cx + rxO, rimY); x.closePath(); x.clip()
    x.fillStyle = 'rgba(120,160,158,0.55)'; x.fillRect(0, rimY + ryO * 1.3, W, 12)
    x.restore()
    // interior cavity (AO)
    const ig = x.createRadialGradient(cx, rimY + 2, 6, cx, rimY + 8, rxO)
    ig.addColorStop(0, '#a98a5f'); ig.addColorStop(1, '#c9b085')
    x.fillStyle = ig; x.beginPath(); x.ellipse(cx, rimY, rxO - 6, ryO - 3, 0, 0, 7); x.fill()
    // kibble mound (muted brown rounded blobs) sitting in the bowl
    x.save(); x.beginPath(); x.ellipse(cx, rimY + 1, rxO - 9, ryO - 3, 0, 0, 7); x.clip()
    for (let i = 0; i < 26; i++) {
      const kx = cx + R(rxO * 1.3), ky = rimY - 6 + Math.random() * (ryO + 4), r = 6 + Math.random() * 5
      const kg = x.createRadialGradient(kx - r * 0.3, ky - r * 0.4, 1, kx, ky, r)
      kg.addColorStop(0, '#b98a53'); kg.addColorStop(1, '#8a5f34')
      x.fillStyle = kg; x.beginPath(); x.ellipse(kx, ky, r, r * 0.82, R(1), 0, 7); x.fill()
    }
    x.restore()
    // back inner-rim shadow + outer rim highlight (top-left)
    x.strokeStyle = 'rgba(90,66,34,0.34)'; x.lineWidth = 4; x.beginPath(); x.ellipse(cx, rimY, rxO - 6, ryO - 3, 0, Math.PI, Math.PI * 2); x.stroke()
    x.strokeStyle = 'rgba(255,251,242,0.72)'; x.lineWidth = 3; x.beginPath(); x.ellipse(cx, rimY, rxO, ryO, 0, Math.PI * 1.05, Math.PI * 1.7); x.stroke()
    return c.toDataURL('image/png')
  }

  /* ═════════ BALL — a soft toy ball (muted coral + cream panels) ═════════ */
  function ball() {
    const W = 210, H = 222, c = cv(W, H), x = c.getContext('2d')
    const cx = W / 2, cy = W / 2 + 6, Rr = W / 2 - 8
    // contact shadow
    const cs = x.createRadialGradient(cx, H - 22, 4, cx, H - 22, Rr * 1.05)
    cs.addColorStop(0, 'rgba(30,22,12,0.24)'); cs.addColorStop(1, 'rgba(30,22,12,0)')
    x.fillStyle = cs; x.beginPath(); x.ellipse(cx, H - 22, Rr * 0.92, 15, 0, 0, 7); x.fill()
    x.save(); x.beginPath(); x.arc(cx, cy, Rr, 0, 7); x.clip()
    // base coral with form shadow to lower-right
    const bg = x.createRadialGradient(cx - Rr * 0.34, cy - Rr * 0.4, Rr * 0.2, cx + Rr * 0.2, cy + Rr * 0.28, Rr * 1.2)
    bg.addColorStop(0, '#e2a894'); bg.addColorStop(0.7, '#cf8b78'); bg.addColorStop(1, '#a5674f')
    x.fillStyle = bg; x.fillRect(0, 0, W, H)
    // two cream curved panels (beach-ball style, calm)
    x.fillStyle = '#ece0cf'
    x.beginPath(); x.moveTo(cx, cy - Rr); x.bezierCurveTo(cx - Rr * 0.5, cy - Rr * 0.4, cx - Rr * 0.5, cy + Rr * 0.4, cx, cy + Rr)
    x.bezierCurveTo(cx - Rr * 0.16, cy + Rr * 0.4, cx - Rr * 0.16, cy - Rr * 0.4, cx, cy - Rr); x.closePath(); x.fill()
    x.beginPath(); x.moveTo(cx, cy - Rr); x.bezierCurveTo(cx + Rr * 0.5, cy - Rr * 0.4, cx + Rr * 0.5, cy + Rr * 0.4, cx, cy + Rr)
    x.bezierCurveTo(cx + Rr * 0.16, cy + Rr * 0.4, cx + Rr * 0.16, cy - Rr * 0.4, cx, cy - Rr); x.closePath(); x.fill()
    // panel shading so the cream still reads as a sphere
    const ps = x.createRadialGradient(cx - Rr * 0.34, cy - Rr * 0.4, Rr * 0.2, cx + Rr * 0.2, cy + Rr * 0.28, Rr * 1.2)
    ps.addColorStop(0, 'rgba(255,250,240,0.25)'); ps.addColorStop(0.6, 'rgba(120,90,70,0)'); ps.addColorStop(1, 'rgba(120,90,70,0.34)')
    x.fillStyle = ps; x.fillRect(0, 0, W, H)
    speckle(x, cx - Rr, cy - Rr, Rr * 2, Rr * 2, 90, '#fff6ec', '#8a5f4a')
    // thin bright fresnel rim along the lower edge
    x.lineWidth = 3
    const rim = x.createLinearGradient(0, cy, 0, cy + Rr)
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(250,244,236,0.5)')
    x.strokeStyle = rim; x.beginPath(); x.arc(cx, cy, Rr - 2, Math.PI * 0.15, Math.PI * 0.85); x.stroke()
    // broad specular sheen, upper-left
    const hx = cx - Rr * 0.34, hy = cy - Rr * 0.4
    const sp = x.createRadialGradient(hx, hy, 1, hx, hy, Rr * 0.5)
    sp.addColorStop(0, 'rgba(255,255,255,0.8)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.32)'); sp.addColorStop(1, 'rgba(255,255,255,0)')
    x.save(); x.beginPath(); x.ellipse(hx, hy, Rr * 0.4, Rr * 0.3, -0.5, 0, 7); x.clip()
    x.fillStyle = sp; x.fillRect(0, 0, W, H); x.restore()
    x.restore()
    return c.toDataURL('image/png')
  }

  // everything is a pet-specific material → all live together in
  // public/art/sprites/pet/ (room.jpg is a JPEG; the writer picks the extension
  // from the data-URL, so it lands as room.jpg alongside the PNG props).
  return {
    sprites: { room: room(), rug: rug(), bed: bed(), bowl: bowl(), ball: ball() },
    bg: {},
  }
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

// Run directly (needs puppeteer): bakes into public/art/sprites/pet/ + art/bg/
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const puppeteer = (await import('puppeteer')).default
  const OUT_SPR = fileURLToPath(new URL('../public/art/sprites/pet/', import.meta.url))
  const OUT_BG = fileURLToPath(new URL('../public/art/bg/', import.meta.url))
  await bake(puppeteer, OUT_SPR, OUT_BG)
}
