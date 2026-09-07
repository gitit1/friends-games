// Injects the 60s-soak results into docs/plan-2026-07/perf-audit.html
// (replaces <!--SOAK-ROWS-->, <!--SOAK-NOTE-->, <!--SOAK-SEQ-->).
import fs from 'node:fs'

const HEB = {
  quantity: 'מספר וכמות', bubbles: 'בועות', catch: 'תופסים חבר', pop: 'פיצוץ חברים',
  who: 'מי נעלם?', sequence: 'חבר חסר ברצף', memory: 'זיכרון חברים',
}
const soak = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const page = process.argv[3]

const verdict = (r) => {
  const frozenPct = Math.round((r.longtaskMs / r.windowActualMs) * 100)
  if (r.heapSlopeKBs > 300) return `נזילה אמיתית (+${r.heapSlopeKBs}KB/s)`
  if (frozenPct >= 20) return `קפוא ${frozenPct}% מהזמן — עומס רינדור, לא נזילה`
  if (r.fpsWorst < 15) return 'קפיאות רגעיות בזמן אינטראקציה'
  return 'יציב לאורך זמן'
}

let rows = ''
for (const r of soak.results.filter((x) => x.ok)) {
  rows += `<tr>
<td>${HEB[r.id] || r.id} <code>${r.id}</code></td>
<td class="num">${r.fpsMedian}</td>
<td class="num">${r.fpsWorst}</td>
<td class="num">${r.longtaskCount} / ${(r.longtaskMs / 1000).toFixed(1)}s</td>
<td class="num">${r.heapSlopeKBs > 0 ? '+' : ''}${r.heapSlopeKBs}</td>
<td class="num">${r.domGrowth > 0 ? '+' : ''}${r.domGrowth}</td>
<td>${verdict(r)}</td>
</tr>\n`
}

const seq = soak.results.find((r) => r.id === 'sequence' && r.ok)
const seqVerdict = seq
  ? (seq.heapSlopeKBs > 300
      ? `הדין: בהשריית 60s השיפוע נשאר +${seq.heapSlopeKBs}KB/s — נזילה אמיתית, לתקן.`
      : `הדין: בהשריית 60s השיפוע ירד ל‑${seq.heapSlopeKBs >= 0 ? '+' : ''}${seq.heapSlopeKBs}KB/s — סערת הקצאות (GC מדביק), לא נזילה; עדיין שווה להרגיע כי GC על טאבלט חלש = מיקרו־תקיעות.`)
  : ''

const note = 'ההשרייה מאשרת את חתימת "נתקע ככל שמשחקים": בארבעת האדומים 26-39 שניות מתוך חלון של ~70 שניות עוברות במשימות ארוכות — המשחק קפוא רוב זמן האינטראקציה. שיפועי הזיכרון מתיישרים לאורך זמן (חוץ מסערת ההקצאות עצמה) — כלומר עומס רינדור, לא נזילת זיכרון.'

let html = fs.readFileSync(page, 'utf8')
html = html.replace('<!--SOAK-ROWS-->', rows.trim())
html = html.replace('<!--SOAK-NOTE-->', note)
html = html.replace('<!--SOAK-SEQ-->', seqVerdict)
fs.writeFileSync(page, html)
console.log('soak injected:', soak.results.filter((x) => x.ok).length, 'rows')
