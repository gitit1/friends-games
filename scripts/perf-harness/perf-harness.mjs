// Per-game runtime performance harness for assaf-friends-games.
//
// Emulates a weak tablet (6x CPU throttle, 390x844 mobile viewport) and, for
// every game route, measures:
//   - FPS in 1s buckets (rAF frame counting)  -> median FPS, worst 1s bucket
//   - longtask entries (PerformanceObserver)   -> count + total ms
//   - JS heap (performance.memory) sampled 1/s  -> slope KB/s (linear regression)
//   - DOM node count at start + end             -> node growth
//   - console errors
// It also "plays" the game: taps spread across the play area + a couple of drags.
//
// Usage (run with puppeteer resolvable; e.g. from the shooter dir, or
//   NODE_PATH=<shooter>/node_modules node perf-harness.mjs ...):
//   node perf-harness.mjs quick  <out.json>                 # all games, 20s each
//   node perf-harness.mjs soak   <out.json> id1,id2 60000   # soak given ids
//
// Global rule: dev server MUST be on port 6199 (never 5199 — owner's port).
import puppeteer from 'puppeteer'
import fs from 'node:fs'

const BASE = process.env.PERF_BASE || 'http://localhost:6199'
const MODE = process.argv[2] || 'quick'
const OUT = process.argv[3] || 'perf-results.json'

// All game ids from src/games/registry.ts (order = registry order).
const ALL_GAMES = [
  'potty','feelings','schedule','help','coinsort','feedanimals','cake','garden','shop','train',
  'sortshelf','skipcount','placevalue','build','missing','bigsmall','sequence','quantity','calc','race',
  'challenge','memory','who','pattern','sort','hole','catch','pop','piano','pet',
  'dice','dance','laugh','parrot','icecream','bubbles','colorme','dots','draw','paintnum',
  'drawnum','letter','lettertalk','syllables','letterbus','nametower','basket','goal','hockey','bowling',
  'spell','firstletter','rhyme','blend','encount','trace',
]

// Games that need extra time to boot (three.js / heavy first paint).
const SLOW_BOOT = new Set(['hole', 'pet'])

const soakIds = MODE === 'soak' && process.argv[4] ? process.argv[4].split(',') : null
const soakDur = MODE === 'soak' && process.argv[5] ? Number(process.argv[5]) : 60000
const games = soakIds || ALL_GAMES
// Nominal window. Actual elapsed is longer (each tap is a real CDP round-trip
// that also runs handler code under 6x throttle) — ~20s real for a 16s nominal.
// windowActualMs is recorded per game so metrics are read against real time.
const WINDOW_MS = MODE === 'soak' ? soakDur : 16000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Instrumentation injected before any game code runs.
const INSTRUMENT = () => {
  window.__perf = { fps: [], longtasks: [], heap: [], started: false, t0: 0, _count: 0, _last: 0 }
  function tick(now) {
    const p = window.__perf
    if (p.started) {
      if (p._last === 0) p._last = now // clean start: no stale partial bucket
      p._count++
      if (now - p._last >= 1000) {
        p.fps.push(p._count)
        if (performance.memory) p.heap.push({ t: now - p.t0, used: performance.memory.usedJSHeapSize })
        p._count = 0
        p._last = now
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  try {
    const po = new PerformanceObserver((list) => {
      const p = window.__perf
      for (const e of list.getEntries()) {
        // Only tasks that START inside the measurement window (excludes the
        // heavy first-mount longtask that fired during load/settle).
        if (p.started && e.startTime >= p.t0) p.longtasks.push({ start: e.startTime - p.t0, dur: e.duration })
      }
    })
    po.observe({ entryTypes: ['longtask'] })
  } catch (e) { /* longtask API unavailable */ }
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Least-squares slope of used-heap over time, returned in KB/s.
function heapSlopeKBs(samples) {
  if (samples.length < 3) return 0
  const n = samples.length
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (const s of samples) {
    const x = s.t / 1000 // seconds
    const y = s.used / 1024 // KB
    sx += x; sy += y; sxy += x * y; sxx += x * x
  }
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-9) return 0
  return (n * sxy - sx * sy) / denom
}

async function playInteractions(page, durationMs) {
  // Spread taps + drags across the whole window, over the play area (avoid the
  // top bar y<100). Generic input — no per-game knowledge.
  const W = 390, topSafe = 110, H = 844
  const pts = [
    [W * 0.5, H * 0.45], [W * 0.28, H * 0.55], [W * 0.72, H * 0.55],
    [W * 0.5, H * 0.68], [W * 0.35, H * 0.35], [W * 0.65, H * 0.72],
    [W * 0.5, H * 0.82], [W * 0.4, H * 0.5], [W * 0.6, H * 0.4], [W * 0.5, H * 0.6],
  ].map(([x, y]) => [x, Math.max(topSafe, y)])
  const nTaps = durationMs >= 40000 ? 20 : 9
  const step = durationMs / (nTaps + 3)
  let elapsed = 0
  for (let i = 0; i < nTaps; i++) {
    await sleep(step)
    elapsed += step
    const [x, y] = pts[i % pts.length]
    try { await page.touchscreen.tap(x, y) } catch (e) { /* ignore */ }
    // A couple of drags mid-window (drawing / dragging games).
    if (i === Math.floor(nTaps * 0.4) || i === Math.floor(nTaps * 0.75)) {
      try {
        await page.mouse.move(W * 0.3, H * 0.5)
        await page.mouse.down()
        await page.mouse.move(W * 0.7, H * 0.6, { steps: 8 })
        await page.mouse.move(W * 0.5, H * 0.4, { steps: 8 })
        await page.mouse.up()
      } catch (e) { /* ignore */ }
    }
  }
  // Finish out the remaining window time so the full duration is measured.
  if (elapsed < durationMs) await sleep(durationMs - elapsed)
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--lang=he', '--enable-precise-memory-info', '--disable-dev-shm-usage'],
})

const results = []
console.log(`[perf] mode=${MODE} games=${games.length} window=${WINDOW_MS}ms base=${BASE}`)

for (const id of games) {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const rec = { id, ok: false }
  try {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.emulateCPUThrottling(6)
    await page.evaluateOnNewDocument(INSTRUMENT)
    await page.goto(`${BASE}/#/game/${id}`, { waitUntil: 'networkidle2', timeout: 45000 })
    // Fresh mount for a hash route inside an already-loaded SPA.
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 })
    const settle = SLOW_BOOT.has(id) ? 6000 : 2500
    await sleep(settle)

    const domStart = await page.evaluate(() => document.getElementsByTagName('*').length)
    const heapStart = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0))
    // Open the measurement window (resets buckets so load jank is excluded).
    await page.evaluate(() => {
      window.__perf.fps = []; window.__perf.longtasks = []; window.__perf.heap = []
      window.__perf.t0 = performance.now(); window.__perf.started = true
    })

    const wStart = Date.now()
    await playInteractions(page, WINDOW_MS)
    const windowActualMs = Date.now() - wStart

    await page.evaluate(() => { window.__perf.started = false })
    const perf = await page.evaluate(() => window.__perf)
    const domEnd = await page.evaluate(() => document.getElementsByTagName('*').length)
    const heapEnd = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0))

    const fps = perf.fps || []
    const longtasks = perf.longtasks || []
    const ltTotal = longtasks.reduce((a, b) => a + b.dur, 0)
    const heapMid = perf.heap.length ? perf.heap[Math.floor(perf.heap.length / 2)].used : heapStart

    rec.ok = true
    rec.fpsMedian = Math.round(median(fps) * 10) / 10
    rec.fpsWorst = fps.length ? Math.min(...fps) : 0
    rec.fpsBuckets = fps
    rec.longtaskCount = longtasks.length
    rec.longtaskMs = Math.round(ltTotal)
    rec.longtaskMax = longtasks.length ? Math.round(Math.max(...longtasks.map((l) => l.dur))) : 0
    rec.heapStartKB = Math.round(heapStart / 1024)
    rec.heapMidKB = Math.round(heapMid / 1024)
    rec.heapEndKB = Math.round(heapEnd / 1024)
    rec.heapSlopeKBs = Math.round(heapSlopeKBs(perf.heap) * 10) / 10
    rec.domStart = domStart
    rec.domEnd = domEnd
    rec.domGrowth = domEnd - domStart
    rec.errors = errors
    rec.windowMs = WINDOW_MS
    rec.windowActualMs = windowActualMs
    console.log(`ok  ${id.padEnd(12)} fps~${rec.fpsMedian} worst=${rec.fpsWorst} lt=${rec.longtaskCount}/${rec.longtaskMs}ms heapSlope=${rec.heapSlopeKBs}KB/s domΔ=${rec.domGrowth} err=${errors.length}`)
  } catch (e) {
    rec.error = String(e).slice(0, 300)
    rec.errors = errors
    console.log(`FAIL ${id}: ${e}`)
  }
  results.push(rec)
  fs.writeFileSync(OUT, JSON.stringify({ mode: MODE, window: WINDOW_MS, ts: new Date().toISOString(), results }, null, 2))
  await page.close()
}

await browser.close()
console.log(`[perf] done -> ${OUT}`)
