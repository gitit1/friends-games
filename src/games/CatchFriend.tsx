import { memo, useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendCount, randFriendIndex } from '../level'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playGiggle, playLand, playNudge, playSuccess, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendColor, friendName, friendSay } from '../friends'
import { useSettings } from '../settings'
import { randInt, shuffle, projScale, depthFromY } from './util'
import { screenScale, useViewport } from '../useViewport'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// The catch MECHANIC is frozen (perf-fixed): the crowd churns via CSS on refs,
// the cards are memoized, and nothing runs React per frame. The level only scales
// three dials, all additive on top of that structure:
//   קל     = a small, calm crowd, slow amblers, distinct colours, generous window.
//   בינוני = + a bigger crowd, a touch faster.
//   קשה    = + bigger still, fewer catchable targets, quicker target switch.
//   אלוף   = + the biggest crowd, livelier amble, colours may REPEAT (real "find
//            the friend" clutter), the fastest switch. Always no-fail.
const LEVEL_TIERS = [0, 1, 2, 3]
const CROWD = [6, 8, 10, 12] // friends visible at once
const WANT = [3, 3, 2, 2] // catchable targets salted in at the start / on a switch
const AMBLE_MUL = [1.3, 1.0, 0.84, 0.68] // amble-duration multiplier (higher = slower/calmer)
const SWITCH_MUL = [1.45, 1.0, 0.78, 0.58] // target-switch interval × the parent's catchSeconds
const DISTINCT = [true, true, true, false] // decoy colours kept distinct (confusion is אלוף-only)

const FLOOR_TARGETS = 1 // never let the board run out of catchable friends
const LIFETIME = 6000 // each friend leaves the board 6s after it appears
const FADE = 400 // gentle fade-out before it's actually removed
const CAUGHT_MS = 1700 // caught friend hops, then ambles off-screen waving before it's replaced

// The crowd stands on a receding lawn: a friend's spawn `y` (board-%) is its
// FEET line. Deeper in the scene (smaller y, up near the hedge) = farther = a
// little smaller and layered behind; nearer the child (larger y) = full size and
// in front. Pure render-time projection off a stable spawn y — no per-frame work.
const FEET_NEAR = 92 // board-% of the nearest feet line
const FEET_FAR = 28 // board-% of the farthest feet line (the horizon)
const FAR_SCALE = 0.58 // farthest friends render at 58% — calm, still readable
function depthScale(y: number) {
  return projScale(depthFromY(y, FEET_NEAR, FEET_FAR), FAR_SCALE)
}

// A caught friend's little "amble" as it wanders the board — slow drift, gentle
// bob, a lean into its direction. All CSS (see .catch-amble), so it never touches
// React per frame; each card carries its own randomised parameters.
type Amble = { ax: number; ay: number; dur: number; delay: number; lean: number }
type Card = {
  id: number
  index: number
  x: number
  y: number
  caught: boolean
  leaving: boolean
  born: number
  exitDir: number // -1 = amble off the left edge, +1 = off the right
  amble: Amble
}

// live per-level dials, read by the ref-driven churn loops (never per frame)
type Cfg = { count: number; want: number; speedMul: number; distinct: boolean }
function configFor(level: number): Cfg {
  return {
    count: CROWD[level] ?? 9,
    want: WANT[level] ?? 2,
    speedMul: AMBLE_MUL[level] ?? 1,
    distinct: DISTINCT[level] ?? false,
  }
}

let nextId = 0

// minimum spawn separation between two friends, in board-percentage units, so
// they never appear in one overlapping pile (a touch tighter for the big crowds)
const MIN_DIST = 15

function makeAmble(speedMul = 1): Amble {
  const ax = randInt(10, 16) * (Math.random() < 0.5 ? -1 : 1)
  return {
    ax,
    ay: randInt(-9, 9),
    dur: (6 + Math.random() * 3) * speedMul, // slow: a 6–9s drift each way, scaled by level
    delay: -Math.random() * 9, // desync so the board doesn't sway in unison
    lean: (2 + Math.random() * 1.6) * Math.sign(ax), // lean into the drift direction
  }
}

// `ageMs` lets the starting board be staggered so the friends don't all vanish
// at the same moment. `avoid` = the cards already on the board — the position is
// rejection-sampled to keep MIN_DIST from all of them (gives up gracefully after
// a bounded number of tries so a full board can never loop forever). x = the
// friend's horizontal CENTRE, y = its FEET line on the receding lawn.
function makeCard(index: number, ageMs = 0, avoid: Card[] = [], speedMul = 1): Card {
  let x = 12 + Math.random() * 76
  let y = 30 + Math.random() * 60
  for (let tries = 0; tries < 24; tries++) {
    if (avoid.every((c) => Math.hypot(c.x - x, c.y - y) >= MIN_DIST)) break
    x = 12 + Math.random() * 76
    y = 30 + Math.random() * 60
  }
  return {
    id: nextId++,
    index,
    x,
    y,
    caught: false,
    leaving: false,
    born: Date.now() - ageMs,
    exitDir: x < 50 ? -1 : 1,
    amble: makeAmble(speedMul),
  }
}

// Pick a decoy (a NON-target friend). At easy tiers we prefer a colour that is
// NOT already on the board, so the crowd stays colour-distinct ("distinct colours
// first" — the confusion is saved for אלוף). When `distinct` is false (אלוף) we
// drop that preference, so decoy colours may repeat and REALLY hide the target.
function pickDecoy(target: number, used: Set<string>, distinct: boolean): number {
  let fallback = randFriendIndex()
  for (let tries = 0; tries < 12; tries++) {
    const i = randFriendIndex()
    if (i === target) continue
    fallback = i
    if (!distinct || !used.has(friendColor(i))) return i
  }
  return fallback === target ? (fallback + 1) % friendCount() : fallback
}

// Make sure at least `min` of the cards are the target (convert random others).
// Identity-preserving: returns the SAME array when nothing needs converting, and
// keeps every unchanged card's object reference so memoized cards don't re-render.
function ensureTargets(cards: Card[], target: number, min: number): Card[] {
  let have = cards.filter((c) => c.index === target).length
  if (have >= min) return cards
  const convert = new Set<number>() // card ids to flip to the target
  for (const c of shuffle(cards.slice())) {
    if (have >= min) break
    if (c.index !== target && !convert.has(c.id)) {
      convert.add(c.id)
      have++
    }
  }
  if (convert.size === 0) return cards
  return cards.map((c) => (convert.has(c.id) ? { ...c, index: target } : c))
}

// One friend on the board. Memoized (with a stable onTap) so the periodic
// maintenance sweep + target switches re-render ONLY the cards that actually
// changed (a friend leaving, being caught, or turning shy) — not the whole crowd
// every tick. The depth scale + stacking are derived from the stable spawn y, so
// they're set once per card and never churn.
const CatchCard = memo(function CatchCard({
  card,
  isShy,
  cardPx,
  onTap,
}: {
  card: Card
  isShy: boolean
  cardPx: number
  onTap: (card: Card) => void
}) {
  const depth = depthScale(card.y)
  return (
    <button
      className={`catch-card ${card.caught ? 'is-caught' : ''} ${card.leaving ? 'is-leaving' : ''} ${
        isShy ? 'is-shy' : ''
      }`}
      style={
        {
          left: `${card.x}%`,
          top: `${card.y}%`,
          '--depth': depth,
          '--z': Math.round(card.y), // nearer feet (bigger y) layer in front
          '--exit-dir': card.exitDir,
          '--ax': `${card.amble.ax}px`,
          '--ay': `${card.amble.ay}px`,
          '--adur': `${card.amble.dur}s`,
          '--adelay': `${card.amble.delay}s`,
          '--lean': `${card.amble.lean}deg`,
        } as React.CSSProperties
      }
      onClick={() => onTap(card)}
      aria-label={friendName(card.index)}
    >
      <span className="catch-amble">
        <span className="catch-face">
          {/* Compact colour-blob token: the board churns a crowd that constantly
              re-spawns, and mounting full anatomy on every refill was the freeze.
              The friend's colour (decoys are colour-distinct until אלוף) is the
              catch cue; the hop / walk-off / fade juice is all CSS on the wrappers. */}
          <Friend index={card.index} scale={cardPx / friendMaxDim(card.index)} showNumber={false} compact />
        </span>
      </span>
    </button>
  )
})

// Build a fresh board of decoys, then salt in the targets.
function makeBoard(target: number, cfg: Cfg): Card[] {
  const arr: Card[] = []
  const used = new Set<string>([friendColor(target)])
  for (let i = 0; i < cfg.count; i++) {
    const idx = pickDecoy(target, used, cfg.distinct)
    used.add(friendColor(idx))
    arr.push(makeCard(idx, randInt(0, LIFETIME - 1000), arr, cfg.speedMul))
  }
  return ensureTargets(arr, target, cfg.want)
}

// Show a target friend; tap matching friends on the board to catch them. A mix of
// friends always ambles across the receding lawn (with at least a couple of
// catchable ones), and the target switches on an interval set in settings and
// scaled by the header difficulty.
export default function CatchFriend({ onExit }: GameProps) {
  const { catchSeconds } = useSettings()
  const { t } = useT()
  const [level] = useGameLevel('catch', LEVEL_TIERS)
  const cfgRef = useRef<Cfg>(configFor(level))
  cfgRef.current = configFor(level)

  const [party, setParty] = useState(false)
  const [target, setTarget] = useState(() => randFriendIndex())
  const [cards, setCards] = useState<Card[]>(() => makeBoard(target, cfgRef.current))
  const [score, setScore] = useState(0)
  const [shyId, setShyId] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  const targetRef = useRef(target)
  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    const all = timers.current
    return () => all.forEach((t) => window.clearTimeout(t))
  }, [])

  // A header level switch re-deals a fresh crowd at the new size/speed/clutter
  // (skip the very first render — the initial board is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setCards(makeBoard(targetRef.current, cfgRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Switch the target friend every `catchSeconds`, scaled by the level (קל gives
  // more time to find, אלוף switches quickest). Respects the parent's setting.
  useEffect(() => {
    const ms = Math.max(6000, catchSeconds * 1000 * (SWITCH_MUL[level] ?? 1))
    const id = window.setInterval(() => {
      setTarget((prev) => {
        let next = randFriendIndex()
        if (next === prev) next = (next + 1) % friendCount()
        return next
      })
    }, ms)
    return () => window.clearInterval(id)
  }, [catchSeconds, level])

  // Announce the new target and make sure enough catchable ones are present.
  useEffect(() => {
    speak(`תפסו את ${friendSay(target)}`)
    setCards((cs) => ensureTargets(cs, target, cfgRef.current.want))
  }, [target])

  // Each friend leaves the board ~6s after it appears: it gently fades, then is
  // removed and a fresh friend takes its place so the board stays lively. Caught
  // friends are exempt — they run their own hop-and-walk-off sequence.
  useEffect(() => {
    const id = window.setInterval(() => {
      setCards((cs) => {
        const now = Date.now()
        let changed = false
        let next = cs.map((c) => {
          if (!c.leaving && !c.caught && now - c.born >= LIFETIME) {
            changed = true
            return { ...c, leaving: true }
          }
          return c
        })
        const survivors = next.filter((c) => !(c.leaving && now - c.born >= LIFETIME + FADE))
        const gone = next.length - survivors.length
        if (gone > 0) {
          changed = true
          const cfg = cfgRef.current
          const fresh: Card[] = []
          const used = new Set<string>(survivors.map((c) => friendColor(c.index)))
          for (let i = 0; i < gone; i++) {
            const idx = pickDecoy(targetRef.current, used, cfg.distinct)
            used.add(friendColor(idx))
            fresh.push(makeCard(idx, 0, [...survivors, ...fresh], cfg.speedMul))
          }
          next = ensureTargets([...survivors, ...fresh], targetRef.current, FLOOR_TARGETS)
        }
        return changed ? next : cs
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  // Stable identity so memoized cards never re-render just because the handler was
  // re-created. Reads the live target through the ref instead of closing over it.
  const tap = useCallback((card: Card) => {
    unlockAudio()
    if (card.caught || card.leaving) return
    const target = targetRef.current
    if (card.index === target) {
      // "תפסת אותי!" — hop with follow-through, a soft giggle, then walk off waving
      setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, caught: true } : c)))
      playGiggle()
      const land = window.setTimeout(() => playLand(), 260) // land-of-hop thud
      timers.current.push(land)
      setScore((s) => {
        const ns = s + 1
        if (ns % 5 === 0) {
          playWin()
          setParty(true)
          window.setTimeout(() => setParty(false), 2500)
        } else playSuccess()
        return ns
      })
      const t = window.setTimeout(() => {
        setCards((cs) => {
          const cfg = cfgRef.current
          const remaining = cs.filter((c) => c.id !== card.id)
          const used = new Set<string>(remaining.map((c) => friendColor(c.index)))
          const withNew = [...remaining, makeCard(pickDecoy(targetRef.current, used, cfg.distinct), 0, remaining, cfg.speedMul)]
          return ensureTargets(withNew, targetRef.current, FLOOR_TARGETS)
        })
      }, CAUGHT_MS)
      timers.current.push(t)
    } else {
      // gentle, not silent: a shy turn-away + a soft nudge + a spoken reminder
      setShyId(card.id)
      playNudge()
      speak(`חפשו את ${friendSay(target)}`)
      const t = window.setTimeout(() => setShyId(null), 620)
      timers.current.push(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vp = useViewport()
  const cardPx = 52 * screenScale(vp.w) // uniform base card size (depth scales each card)
  return (
    <GameShell title={t('game.catch')} emoji="🎯" onExit={onExit} levels={{ gameId: 'catch', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="catch-target">
        <span className="catch-target-label">{t('catch.tap')}</span>
        <Friend index={target} scale={Math.min(74 * screenScale(vp.w), vp.w * 0.34) / friendMaxDim(target)} />
        <span className="catch-target-name">{friendName(target)}</span>
        <span className="score-pill" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>
      </div>

      <div className="catch-board">
        {/* far park back plane (illustrated CC0 library, see art/bg/LICENSES.md) */}
        <SceneBackdrop src="party-garden.jpg" position="center 30%" scrim="soft" />
        {/* baked receding play-lawn the crowd stands on (real material, not CSS —
            grain/mow-bands/baked light + AO; see art/sprites/catch/LICENSES.md) */}
        <div className="catch-floor" aria-hidden="true" />
        {/* mid-depth shrubs on the horizon, behind the crowd (depth layering) */}
        <span className="catch-bush l" aria-hidden="true" />
        <span className="catch-bush r" aria-hidden="true" />

        {cards.map((card) => (
          <CatchCard key={card.id} card={card} isShy={shyId === card.id} cardPx={cardPx} onTap={tap} />
        ))}

        {/* near grass fringe wrapping the closest feet — foreground grounding */}
        <div className="catch-fringe" aria-hidden="true" />
      </div>
      <p className="catch-hint">{t('catch.hint')}</p>
    </GameShell>
  )
}
