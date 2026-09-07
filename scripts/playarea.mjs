// Compare the PLAY AREA (largest canvas/scene box) of every game against baseline.
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PROBE = () => {
  let best = 0, name = ''
  for (const el of document.querySelectorAll('canvas,.scene-backdrop,[class*="board"],[class*="stage"],[class*="scene"]')) {
    const r = el.getBoundingClientRect()
    const a = r.width * r.height
    if (a > best) { best = a; name = (typeof el.className==='string'?el.className:'').split(/\s+/)[0]||el.tagName }
  }
  return { area: Math.round(best), name }
}
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:360,height:780}})
const out={}
await p.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'}); await p.waitForTimeout(500)
const nC=await p.locator('.category-card').count()
for(let c=0;c<nC;c++){
  await p.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'}); await p.waitForTimeout(300)
  await p.locator('.category-card').nth(c).click(); await p.waitForTimeout(500)
  const n=await p.locator('.game-card').count()
  for(let g=0;g<n;g++){
    try{
      await p.locator('.game-card').nth(g).click(); await p.waitForTimeout(950)
      const t=((await p.locator('h1,h2').first().textContent().catch(()=>''))||'').trim().slice(0,16)
      out[t]=await p.evaluate(PROBE)
      await p.goBack(); await p.waitForTimeout(400)
    }catch{await p.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'});await p.waitForTimeout(300)
      await p.locator('.category-card').nth(c).click().catch(()=>{});await p.waitForTimeout(400)}
  }
}
writeFileSync(process.env.OUT||'playarea.json', JSON.stringify(out,null,1))
console.log('measured',Object.keys(out).length,'games')
await b.close()
