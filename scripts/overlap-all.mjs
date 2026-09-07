// Across EVERY game: (1) do hit rects overlap? (2) does the page overflow 360px?
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const PROBE = () => {
  const boxes = []
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    const tag = el.tagName.toLowerCase()
    const inter = tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button'
    if (!inter) continue
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    let w = r.width, h = r.height
    const af = getComputedStyle(el, '::after')
    if (af && af.content && af.content !== 'none') {
      const aw = parseFloat(af.width), ah = parseFloat(af.height)
      if (!Number.isNaN(aw)) w = Math.max(w, aw)
      if (!Number.isNaN(ah)) h = Math.max(h, ah)
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    boxes.push({
      cls: (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/)[0] || tag,
      L: cx - w / 2, R: cx + w / 2, T: cy - h / 2, B: cy + h / 2,
    })
  }
  const clashes = []
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      const ox = Math.min(a.R, b.R) - Math.max(a.L, b.L)
      const oy = Math.min(a.B, b.B) - Math.max(a.T, b.T)
      if (ox > 1 && oy > 1) clashes.push(`${a.cls}/${b.cls} ${Math.round(ox)}x${Math.round(oy)}`)
    }
  const d = document.documentElement
  return { clashes: [...new Set(clashes)].slice(0, 6), overflow: d.scrollWidth - d.clientWidth }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 360, height: 780 } })
const bad = []
await page.goto('http://127.0.0.1:6321/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const nCat = await page.locator('.category-card').count()
for (let c = 0; c < nCat; c++) {
  await page.goto('http://127.0.0.1:6321/', { waitUntil: 'networkidle' }); await page.waitForTimeout(350)
  await page.locator('.category-card').nth(c).click(); await page.waitForTimeout(550)
  const nG = await page.locator('.game-card').count()
  for (let g = 0; g < nG; g++) {
    try {
      await page.locator('.game-card').nth(g).click(); await page.waitForTimeout(1000)
      const t = ((await page.locator('h1,h2').first().textContent().catch(()=>''))||'').trim().slice(0,20)
      const r = await page.evaluate(PROBE)
      if (r.clashes.length || r.overflow > 0) bad.push({ game: t, ...r })
      await page.goBack(); await page.waitForTimeout(450)
    } catch {
      await page.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'}); await page.waitForTimeout(300)
      await page.locator('.category-card').nth(c).click().catch(()=>{}); await page.waitForTimeout(400)
    }
  }
}
writeFileSync('overlap-all.json', JSON.stringify(bad, null, 1))
console.log(bad.length ? JSON.stringify(bad, null, 1) : 'CLEAN: no overlaps, no horizontal overflow in any game')
await browser.close()
