import { useState, useEffect, useRef } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { friendColor } from '../friends'
import { useT } from '../i18n'
import { playTap, playPop, playSuccess, playNudge, unlockAudio } from '../audio'
import { speak } from '../speech'
import { useSettings } from '../settings'
import { useGameLevel } from '../gameLevel'
import type { GameProps } from './registry'

// "מטבעות חברים" — a coin sort + MERGE game in the spirit of Pocket Sort, but the
// coins are the FRIENDS (each already has a colour + a number). You herd matching
// friend-coins together; a tube full of 4 identical MERGES into one coin of the
// NEXT number — climbing 1 → 2 → 3 … → 100. Built so a child on the spectrum can
// NEVER get stuck: generous empty tubes, a free "+ tube", a DRAW button (more
// coins), a SORT button (auto-tidy), unlimited undo, no timer, no fail.

const CAP = 4 // coins per tube; 4 identical -> merge to the next number
const TOP = 100 // highest friend
const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף (chosen via the header)

// A few friends' identity colours are fully-saturated pure reds, which pop too
// hard against the muted wood board (sensory rule). The discs are decorative
// (not the friend's actual artwork), so mute just THOSE for this game's coins —
// every other friend keeps their true identity colour, and friendColor() itself
// stays untouched for every other screen that uses it.
const HOT_RED = new Set(['#ef4444', '#dc2626'])
function discColor(index: number) {
  const c = friendColor(index)
  return HOT_RED.has(c) ? 'var(--muted-red)' : c
}

type Tube = number[] // friend NUMBERS (1..100), bottom .. top

const clone = (tubes: Tube[]): Tube[] => tubes.map((t) => t.slice())
const shuffle = <T,>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// how many identical coins sit on top of a tube
function topRun(t: Tube): { value: number; count: number } | null {
  if (!t.length) return null
  const value = t[t.length - 1]
  let count = 0
  for (let i = t.length - 1; i >= 0 && t[i] === value; i--) count++
  return { value, count }
}
const canDrop = (dst: Tube, value: number) => dst.length < CAP && (dst.length === 0 || dst[dst.length - 1] === value)
const maxVal = (tubes: Tube[]) => tubes.reduce((m, t) => Math.max(m, ...t, 0), 0)

// merge any tube that is full of one number into a single coin of the next number
function settleMerges(tubes: Tube[]): { tubes: Tube[]; merged: number | null } {
  let merged: number | null = null
  const out = tubes.map((t) => {
    if (t.length === CAP && t.every((x) => x === t[0]) && t[0] < TOP) {
      merged = t[0] + 1
      return [t[0] + 1]
    }
    return t
  })
  return { tubes: out, merged }
}

// difficulty -> how many distinct friend-coins start out, and how many spare tubes.
// אלוף packs 6 colours into only 2 spare tubes — a real sort challenge — while קל
// stays a roomy 3-colour board. (Touching this deal logic is sanctioned for levels.)
function config(difficulty: number, maxNumber: number) {
  const kinds = Math.min([3, 4, 5, 6][difficulty] ?? 4, Math.max(2, Math.min(maxNumber, 12)))
  const spares = [4, 4, 3, 2][difficulty] ?? 3
  return { kinds, spares }
}

function deal(kinds: number, spares: number): Tube[] {
  const coins: number[] = []
  for (let v = 1; v <= kinds; v++) for (let i = 0; i < CAP; i++) coins.push(v)
  shuffle(coins)
  const tubes: Tube[] = []
  for (let t = 0; t < kinds; t++) tubes.push(coins.slice(t * CAP, (t + 1) * CAP))
  for (let s = 0; s < spares; s++) tubes.push([])
  return tubes
}

export default function CoinSort({ onExit }: GameProps) {
  const { t } = useT()
  const { maxNumber } = useSettings()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('coinsort', LEVEL_TIERS)
  const cfg = config(level, maxNumber)

  const [tubes, setTubes] = useState<Tube[]>(() => deal(cfg.kinds, cfg.spares))
  const [sel, setSel] = useState<number | null>(null) // picked-up tube
  const [best, setBest] = useState(cfg.kinds) // highest number reached (climbs)
  const [style, setStyle] = useState<'stack' | 'tube'>('stack') // coin-pile board vs glass tubes
  const [history, setHistory] = useState<Tube[][]>([])
  const [pop, setPop] = useState<number | null>(null) // tube index that just merged (for the animation)

  // ── PRESENTATION ONLY: watch the board and, when a single tube cleanly GREW
  // (a pour landing), flag its new coins so CSS can hop them in one-by-one. This
  // is purely observational — it never mutates tubes or touches the game rules;
  // merges (a tube shrinks), draws that scatter, undo/sort/restart (shape change)
  // all fall through and simply don't animate. ──
  const prevRef = useRef<Tube[]>(tubes)
  const [land, setLand] = useState<{ tube: number; from: number } | null>(null)
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = tubes
    if (prev.length !== tubes.length) return // add-tube / restart / sort reshape → skip
    let grew = -1
    let from = 0
    let grewCount = 0
    for (let i = 0; i < tubes.length; i++) {
      const a = prev[i]?.length ?? 0
      const b = tubes[i].length
      if (b > a) {
        grewCount++
        grew = i
        from = a
      }
    }
    if (grewCount === 1 && grew >= 0) {
      setLand({ tube: grew, from })
      const id = window.setTimeout(() => setLand(null), 440)
      return () => window.clearTimeout(id)
    }
  }, [tubes])
  const landClass = (i: number, d: number) => (land && land.tube === i && d >= land.from ? 'cs-land' : '')
  const landVar = (i: number, d: number) =>
    land && land.tube === i && d >= land.from ? ({ '--i': d - land.from } as React.CSSProperties) : null

  // switching difficulty from the header deals a fresh board at the new level
  // (skip the first render — the initial board is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setSel(null)
    setHistory([])
    setBest(cfg.kinds)
    setTubes(deal(cfg.kinds, cfg.spares))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const tap = () => {
    unlockAudio()
    playTap()
  }
  const push = () => setHistory((h) => [...h.slice(-30), clone(tubes)])

  // settle merges, update the height, celebrate a new high, and commit to state
  function commit(next: Tube[], announce = true) {
    let cur = next
    for (let pass = 0; pass < 12; pass++) {
      const { tubes: m, merged } = settleMerges(cur)
      cur = m
      if (merged == null) break
    }
    const hi = maxVal(cur)
    if (hi > best) {
      setBest(hi)
      const idx = cur.findIndex((tb) => tb.length && tb[tb.length - 1] === hi)
      if (idx >= 0) {
        setPop(idx)
        window.setTimeout(() => setPop(null), 500)
      }
      if (announce) {
        // sound retimed to the VISUAL: the jingle lands as the fuse-ring blooms
        // (~32% of the 0.52s ring animation). Presentation timing only.
        window.setTimeout(() => {
          playSuccess()
          speak(String(hi))
        }, 160)
      }
    }
    setTubes(cur)
  }

  function tapTube(i: number) {
    unlockAudio()
    if (sel == null) {
      if (!tubes[i].length) return
      playTap()
      setSel(i)
      return
    }
    if (sel === i) {
      playTap()
      setSel(null)
      return
    }
    const run = topRun(tubes[sel])
    if (!run || !canDrop(tubes[i], run.value)) {
      // illegal — gentle nudge, no penalty (errorless)
      playNudge()
      setSel(null)
      return
    }
    push()
    const next = clone(tubes)
    const move = Math.min(run.count, CAP - next[i].length)
    for (let k = 0; k < move; k++) {
      next[sel].pop()
      next[i].push(run.value)
    }
    // sound retimed to the VISUAL: the pop lands with the first coin's impact
    // (hop squash hits at ~50% of the 0.38s landing). Presentation timing only.
    window.setTimeout(playPop, 170)
    setSel(null)
    commit(next)
  }

  // DRAW — deal a few new coins onto the board (at/below the current frontier, so
  // you climb by MERGING, not by being handed higher coins). Never jams.
  function draw() {
    tap()
    push()
    const next = clone(tubes)
    const lo = Math.max(1, best - 2)
    const hi = best
    for (let n = 0; n < 4; n++) {
      const v = lo + Math.floor(Math.random() * (hi - lo + 1))
      let dst = next.findIndex((tb) => tb.length && tb[tb.length - 1] === v && tb.length < CAP)
      if (dst < 0) dst = next.findIndex((tb) => tb.length === 0)
      if (dst < 0) dst = next.findIndex((tb) => tb.length < CAP)
      if (dst < 0) {
        next.push([v]) // out of room — grow rather than jam
      } else next[dst].push(v)
    }
    setSel(null)
    commit(next, false)
  }

  // SORT — auto-tidy: gather every coin by number and merge everything possible
  function autoSort() {
    tap()
    push()
    const counts = new Map<number, number>()
    for (const tb of tubes) for (const v of tb) counts.set(v, (counts.get(v) ?? 0) + 1)
    // cascade merges from low to high (4 of v -> 1 of v+1)
    for (let v = 1; v < TOP; v++) {
      let c = counts.get(v) ?? 0
      while (c >= CAP) {
        c -= CAP
        counts.set(v + 1, (counts.get(v + 1) ?? 0) + 1)
      }
      counts.set(v, c)
    }
    const values = [...counts.keys()].filter((v) => (counts.get(v) ?? 0) > 0).sort((a, b) => a - b)
    const next: Tube[] = values.map((v) => Array(counts.get(v) as number).fill(v))
    const keep = Math.max(tubes.length, next.length + 1)
    while (next.length < keep) next.push([])
    setSel(null)
    commit(next)
  }

  function addTube() {
    tap()
    push()
    setTubes((ts) => [...ts, []])
  }
  function undo() {
    if (!history.length) return
    tap()
    setSel(null)
    setTubes(history[history.length - 1])
    setHistory((h) => h.slice(0, -1))
  }
  function restart() {
    tap()
    setSel(null)
    setHistory([])
    setBest(cfg.kinds)
    setTubes(deal(cfg.kinds, cfg.spares))
  }

  return (
    <GameShell title={t('game.coinsort')} emoji="🪙" onExit={onExit} levels={{ gameId: 'coinsort', tiers: LEVEL_TIERS }}>
      <div className="cs-top">
        <span className="cs-score">
          <span className="cs-best-label">{t('cs.best')}</span>
          <span className="cs-best-coin">
            <Coin v={best} />
          </span>
        </span>
        <span className="cs-style-toggle">
          <button className={style === 'stack' ? 'on' : ''} onClick={() => setStyle('stack')}>
            🪙 {t('cs.styleStack')}
          </button>
          <button className={style === 'tube' ? 'on' : ''} onClick={() => setStyle('tube')}>
            🧪 {t('cs.styleTube')}
          </button>
        </span>
      </div>

      <div className="cs-stage">
        {/* illustrated back plane — a warm wooden playroom (original in-repo art, see art/bg/LICENSES.md) */}
        <SceneBackdrop src="wooden-playroom.jpg" position="center 30%" scrim="soft" />
        <div className={`cs-board style-${style}`}>
        {tubes.map((tube, i) => {
          const run = sel === i ? topRun(tubes[i]) : null
          const isLifted = (d: number) => run != null && d >= tube.length - run.count
          const topV = tube.length ? tube[tube.length - 1] : 0
          return (
            <button
              key={i}
              className={`cs-tube ${sel === i ? 'is-sel' : ''} ${pop === i ? 'is-pop' : ''}`}
              onClick={() => tapTube(i)}
              aria-label={`lane ${i + 1}`}
            >
              {style === 'tube' ? (
                tube.map((v, d) => (
                  <span
                    key={d}
                    className={`cs-slot ${isLifted(d) ? 'lifted' : ''} ${landClass(i, d)}`}
                    style={landVar(i, d) ?? undefined}
                  >
                    <Coin v={v} />
                  </span>
                ))
              ) : (
                <>
                  {tube.length > 0 && (
                    <span className="cs-lane-num" style={{ '--c': discColor(topV - 1) } as React.CSSProperties}>
                      {topV}
                    </span>
                  )}
                  <span className="cs-pile" style={{ height: tube.length * 12 + 22 }}>
                    {tube.map((v, d) => (
                      <span
                        key={d}
                        className={`cs-chip ${d === tube.length - 1 ? 'top' : ''} ${isLifted(d) ? 'lifted' : ''} ${landClass(i, d)}`}
                        style={{ '--c': discColor(v - 1), bottom: d * 12, zIndex: d, ...landVar(i, d) } as React.CSSProperties}
                      >
                        <span className="cs-chip-num">{v}</span>
                      </span>
                    ))}
                  </span>
                </>
              )}
            </button>
          )
        })}
        </div>
      </div>

      <div className="cs-controls">
        <button className="btn-primary" onClick={autoSort}>
          ✨ {t('cs.sort')}
        </button>
        <button className="btn-secondary" onClick={draw}>
          🪙 {t('cs.draw')}
        </button>
        <button className="btn-secondary" onClick={addTube}>
          ➕ {t('cs.addTube')}
        </button>
        <button className="btn-utility" onClick={undo} disabled={!history.length} aria-label={t('cs.undo')}>
          <span aria-hidden="true">↩️</span>
        </button>
        <button className="btn-utility" onClick={restart} aria-label={t('cs.restart')}>
          <span aria-hidden="true">🔄</span>
        </button>
      </div>
    </GameShell>
  )
}

// a friend-coin: a round disc in the friend's colour, the small friend, a big number
function Coin({ v }: { v: number }) {
  return (
    <span className="cs-coin" style={{ '--c': discColor(v - 1) } as React.CSSProperties}>
      <span className="cs-coin-face">
        <Friend index={v - 1} scale={0.34} showNumber={false} />
      </span>
      <span className="cs-coin-num">{v}</span>
    </span>
  )
}
