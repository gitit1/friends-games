# perf-harness — per-game runtime performance audit

Rerunnable harness behind `docs/plan-2026-07/perf-audit.html`. Emulates a weak
tablet (6× CPU throttle, 390×844 mobile viewport) and, for every game route,
measures FPS (1s buckets), longtasks, JS-heap slope, DOM-node growth and console
errors while lightly "playing" the game (taps across the play area + a couple of
drags).

## Prerequisites

- A dev server on **port 6199** (global rule: never 5199 — the owner's port):
  ```
  npx vite --port 6199 --strictPort
  ```
  If your `node_modules` is a junction shared with another running vite, give
  this instance its own cache dir so the dep optimizer doesn't collide:
  ```
  npx vite --config vite.perf.config.ts --port 6199 --strictPort
  ```
- `puppeteer` resolvable. Either run from a dir that has it in `node_modules`,
  or set `NODE_PATH` to one, e.g.:
  ```
  NODE_PATH=/path/to/node_modules node scripts/perf-harness/perf-harness.mjs quick out.json
  ```

## Run

```
# All games, ~20s real play window each -> perf-results.json
node scripts/perf-harness/perf-harness.mjs quick perf-results.json

# 60s soak on the worst offenders (degradation-over-time / "freezes mid-play")
node scripts/perf-harness/perf-harness.mjs soak soak.json quantity,pop,memory,who,sequence 60000

# Ranked table + 🔴/🟠/🟢 grades + the 5 worst ids to soak next
node scripts/perf-harness/summarize-perf.mjs perf-results.json

# Hebrew HTML table rows for docs/plan-2026-07/perf-audit.html
node scripts/perf-harness/gen-table.mjs perf-results.json > rows.html
```

Override the base URL with `PERF_BASE` (default `http://localhost:6199`).

## Performance budget (regression gate)

A game **passes** at 6× CPU throttle when, during light play:

- median FPS ≥ 55 and worst 1s bucket ≥ 30
- total longtask time < 800 ms, and no single longtask > 100 ms while idle
- heap slope not sustained-positive across a 60s soak (transient churn OK)
- DOM node growth < 120 over the window (no unbounded accumulation)
- zero console errors

`< 45` median FPS, a worst bucket `< 12`, `> 3000 ms` longtasks, `> 500 KB/s`
heap slope, or `> 400` DOM growth is a **🔴 regression** — investigate before merge.

## Note on level/difficulty

Element counts in several games scale with the child's unlocked level and the
chosen difficulty (e.g. `quantity` renders up to ~30 friends × 3 groups; `pop`
draws from the whole roster). The harness runs at the app's *default* level, so
games whose weight grows with level (`quantity`, `pop`, `sequence`, number
games) can be **worse in the field** than these numbers show. Re-run after
setting a high level in `localStorage` to reproduce the child's real load.
