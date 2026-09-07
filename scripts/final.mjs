// Count ONLY real <button>/role=button elements, ignoring decorative descendants.
import { chromium } from 'playwright'
const PROBE = () => {
  const out=[]
  for(const el of document.querySelectorAll('button,[role=button]')){
    const cs=getComputedStyle(el)
    if(cs.display==='none'||cs.visibility==='hidden'||cs.pointerEvents==='none')continue
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2)continue
    let w=r.width,h=r.height
    const af=getComputedStyle(el,'::after')
    if(af&&af.content&&af.content!=='none'){
      const aw=parseFloat(af.width),ah=parseFloat(af.height)
      if(!Number.isNaN(aw))w=Math.max(w,aw); if(!Number.isNaN(ah))h=Math.max(h,ah)
    }
    out.push({cls:(typeof el.className==='string'?el.className:'').trim().split(/\s+/)[0]||'button',
      w:Math.round(w),h:Math.round(h),pass:w>=71.5&&h>=71.5})
  }
  return out
}
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:360,height:780}})
await p.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'}); await p.waitForTimeout(500)
let pass=0,fail=0; const worst=new Map()
const nC=await p.locator('.category-card').count()
for(let c=0;c<nC;c++){
  await p.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'}); await p.waitForTimeout(300)
  await p.locator('.category-card').nth(c).click(); await p.waitForTimeout(500)
  const n=await p.locator('.game-card').count()
  for(let g=0;g<n;g++){
    try{
      await p.locator('.game-card').nth(g).click(); await p.waitForTimeout(900)
      const t=((await p.locator('h1,h2').first().textContent().catch(()=>''))||'').trim().slice(0,18)
      for(const r of await p.evaluate(PROBE)){
        if(r.pass)pass++; else {fail++
          const k=r.cls; const cur=worst.get(k)
          if(!cur||r.w*r.h<cur.w*cur.h) worst.set(k,{...r,game:t})}
      }
      await p.goBack(); await p.waitForTimeout(400)
    }catch{await p.goto('http://127.0.0.1:6321/',{waitUntil:'networkidle'});await p.waitForTimeout(300)
      await p.locator('.category-card').nth(c).click().catch(()=>{});await p.waitForTimeout(400)}
  }
}
console.log(`REAL BUTTONS — pass ${pass} / fail ${fail} / total ${pass+fail}  (${(pass/(pass+fail)*100).toFixed(0)}% at bar)`)
console.log('\ndistinct failing button classes:',worst.size)
for(const r of [...worst.values()].sort((a,b)=>a.w*a.h-b.w*b.h)) console.log(`  ${r.cls} ${r.w}x${r.h} — ${r.game}`)
await b.close()
