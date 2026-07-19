// Reads a perf-results.json (from perf-harness.mjs) and prints a worst-first
// ranked table with 🔴/🟠/🟢 grades + a jank score. Also emits the 5 worst ids
// (for the soak pass). Pure reporting — no browser.
//
//   node summarize-perf.mjs <perf-results.json>
import fs from 'node:fs'

const file = process.argv[2]
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const rows = data.results.filter((r) => r.ok)

// Grading. FPS + longtasks are the primary "freeze" signals; a positive heap
// slope in a short window is often un-GC'd allocation, so it only downgrades
// when large (the soak pass confirms true leaks). DOM growth flags accumulation.
function grade(r) {
  const red =
    r.fpsMedian < 45 || r.fpsWorst < 12 || r.longtaskMs > 3000 || r.heapSlopeKBs > 500 ||
    r.domGrowth > 400 || (r.errors && r.errors.length > 0)
  const orange =
    r.fpsMedian < 55 || r.fpsWorst < 30 || r.longtaskMs > 800 || r.heapSlopeKBs > 250 || r.domGrowth > 120
  return red ? 'red' : orange ? 'orange' : 'green'
}

// A single "jank score" to rank worst-first (higher = worse).
function jank(r) {
  return (
    (60 - r.fpsMedian) * 3 +
    (60 - r.fpsWorst) * 1.5 +
    r.longtaskMs / 40 +
    Math.max(0, r.heapSlopeKBs) / 20 +
    Math.max(0, r.domGrowth) / 4 +
    (r.errors ? r.errors.length * 20 : 0)
  )
}

const graded = rows.map((r) => ({ ...r, grade: grade(r), jank: Math.round(jank(r) * 10) / 10 }))
graded.sort((a, b) => b.jank - a.jank)

const emoji = { red: '🔴', orange: '🟠', green: '🟢' }
console.log('rank  grade id            fpsMed worst  lt(n/ms)     heapKB/s  domΔ  jank')
graded.forEach((r, i) => {
  console.log(
    `${String(i + 1).padStart(2)}    ${emoji[r.grade]}   ${r.id.padEnd(12)} ${String(r.fpsMedian).padStart(5)} ${String(r.fpsWorst).padStart(5)}  ${String(r.longtaskCount + '/' + r.longtaskMs).padStart(10)}  ${String(r.heapSlopeKBs).padStart(7)}  ${String(r.domGrowth).padStart(4)}  ${r.jank}`,
  )
})

const counts = { red: 0, orange: 0, green: 0 }
graded.forEach((r) => counts[r.grade]++)
console.log(`\nTOTAL ${graded.length}: 🔴 ${counts.red}  🟠 ${counts.orange}  🟢 ${counts.green}`)
console.log('WORST5:', graded.slice(0, 5).map((r) => r.id).join(','))
