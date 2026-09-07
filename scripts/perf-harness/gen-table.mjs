// Generates the Hebrew HTML table rows (worst-first) for perf-audit.html from
// perf-results.json. Prints to stdout; the audit page embeds the output.
import fs from 'node:fs'

const HEB = {
  potty: 'גמילה מטיטול', feelings: 'איך אני מרגיש?', schedule: 'סדר יום', help: 'מבקשים עזרה',
  coinsort: 'מטבעות חברים', feedanimals: 'מאכילים חיות', cake: 'מכינים עוגה', garden: 'גינה',
  shop: 'קופה', train: 'רכבת מספרים', sortshelf: 'מכולת', skipcount: 'קפיצות',
  placevalue: 'עשרות ואחדות', build: 'בונים מספר', missing: 'המספר החסר', bigsmall: 'גדול או קטן?',
  sequence: 'חבר חסר ברצף', quantity: 'מספר וכמות', calc: 'מחשבון', race: 'מרוץ מכוניות',
  challenge: 'אתגר חשבון', memory: 'זיכרון חברים', who: 'מי נעלם?', pattern: 'תבניות',
  sort: 'מיון', hole: 'בולעים הכול', catch: 'תופסים חבר', pop: 'פיצוץ חברים',
  piano: 'פסנתר חברים', pet: 'החבר שלי', dice: 'מגלגלים קובייה', dance: 'ריקוד',
  laugh: 'צחוק', parrot: 'תוכי', icecream: 'גלידה', bubbles: 'בועות',
  colorme: 'צובעים חבר', dots: 'חיבור נקודות', draw: 'ציור חופשי', paintnum: 'צביעה לפי מספר',
  drawnum: 'מציירים מספר', letter: 'איזה חבר?', lettertalk: 'האות שלי מדברת', syllables: 'תופסים הברות',
  letterbus: 'אוטובוס האותיות', nametower: 'מגדל השם שלי', basket: 'זריקה לסל', goal: 'בעיטה לשער',
  hockey: 'הוקי אוויר', bowling: 'באולינג', spell: 'אותיות חיות', firstletter: 'באיזו אות?',
  rhyme: 'מכונת חרוזים', blend: 'להרכיב צליל', encount: 'ספירה באנגלית', trace: 'לצייר אות חיה',
}

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const rows = data.results.filter((r) => r.ok)

function grade(r) {
  const red = r.fpsMedian < 45 || r.fpsWorst < 12 || r.longtaskMs > 3000 || r.heapSlopeKBs > 500 || r.domGrowth > 400 || (r.errors && r.errors.length > 0)
  const orange = r.fpsMedian < 55 || r.fpsWorst < 30 || r.longtaskMs > 800 || r.heapSlopeKBs > 250 || r.domGrowth > 120
  return red ? 'red' : orange ? 'orange' : 'green'
}
function jank(r) {
  return (60 - r.fpsMedian) * 3 + (60 - r.fpsWorst) * 1.5 + r.longtaskMs / 40 + Math.max(0, r.heapSlopeKBs) / 20 + Math.max(0, r.domGrowth) / 4 + (r.errors ? r.errors.length * 20 : 0)
}
const graded = rows.map((r) => ({ ...r, grade: grade(r), jank: jank(r) })).sort((a, b) => b.jank - a.jank)
const em = { red: '🔴', orange: '🟠', green: '🟢' }

let out = ''
graded.forEach((r, i) => {
  out += `<tr>
<td>${i + 1}</td>
<td>${em[r.grade]}</td>
<td>${HEB[r.id] || r.id} <code>${r.id}</code></td>
<td>${r.fpsMedian}</td>
<td>${r.fpsWorst}</td>
<td>${r.longtaskCount} / ${(r.longtaskMs / 1000).toFixed(1)}s</td>
<td>${r.heapSlopeKBs > 0 ? '+' : ''}${r.heapSlopeKBs}</td>
<td>${r.domGrowth > 0 ? '+' : ''}${r.domGrowth}</td>
</tr>\n`
})
console.log(out)
console.error('counts:', graded.reduce((a, r) => { a[r.grade] = (a[r.grade] || 0) + 1; return a }, {}))
console.error('worst10:', graded.slice(0, 10).map((r) => r.id).join(','))
