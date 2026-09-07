import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import { friendName } from '../friends'
import type { GameProps } from './registry'
import { playNudge, playSuccess, playTap, playWin, unlockAudio } from '../audio'
import { randInt, shuffle } from './util'
import { speakNumber } from '../voice'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'

// "מיון" — drag each item into its matching bin. Four modes: by colour (smiley
// balls), by number, by letter (A–Z), or by friend. No timer, no losing: a wrong
// bin sends it gently back. Every bin keeps a running counter and each drop says
// the new count in (niqqud) Hebrew.
//
// MATERIALS (art doctrine): the bins are a BAKED woven wicker basket
// (bucket.png), the balls a BAKED glossy sphere (ball.png) — both neutral-grey
// sprites tinted to their sort colour via a `mix-blend-mode: color` wash, so the
// baked weave / rim-light / AO / grain survive and ONE sprite serves every
// colour. They rest on a baked WOODEN table (mat.jpg — real planks + grain)
// inside a calm SceneBackdrop playroom — no flat CSS shapes.
//
// DIFFICULTY (shared header control): the level sets HOW MANY colours and, at
// אלוף, packs in CLOSE hues (two greens + two blues) so telling bins apart is a
// real task. Wired exactly like CoinSort — no-fail, cumulative, קל as easy as
// before.

// Muted, sensory-calm hues. The colour wash rides the bucket's grey luminance, so
// these stay soft (never neon) while their HUES read clearly apart — except the
// deliberate close pairs at אלוף.
const RED = { c: '#d16b6b', name: 'אדום' }
const YELLOW = { c: '#e3b64a', name: 'צהוב' }
const BLUE = { c: '#5b8ac9', name: 'כחול' }
const GREEN = { c: '#5aa66a', name: 'ירוק' }
const ORANGE = { c: '#dd9455', name: 'כתום' }
const PURPLE = { c: '#9a7ec8', name: 'סגול' }
const LIME = { c: '#9bb84e', name: 'ליים' } // close to GREEN — the אלוף challenge
const SKY = { c: '#6bb3d6', name: 'תכלת' } // close to BLUE — the אלוף challenge

// difficulty tiers (chosen via the header star). The tier still sets the
// STARTING number of baskets — TIER_COLORS[level].length, unchanged from
// before — but the child can now grow past it with the "עוד סל" stepper
// below, all the way to FULL_PALETTE's length (30). אלוף also mixes in close
// hues so its starting set is a REAL discrimination task.
const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף
const TIER_COLORS = [
  [RED, YELLOW, BLUE], //                          0 · קל — 3 far-apart hues (as easy as today)
  [RED, YELLOW, BLUE, GREEN], //                   1 · בינוני — 4 distinct
  [RED, YELLOW, BLUE, GREEN, ORANGE, PURPLE], //   2 · קשה — 6 distinct
  [RED, YELLOW, BLUE, GREEN, ORANGE, PURPLE, LIME, SKY], // 3 · אלוף — 8 incl. close pairs
]
// The full ~30-colour muted palette (resurrected from the historic peak,
// commit ec1d7a9 / 6c94c1c). The FIRST 8 are exactly TIER_COLORS' four tiers
// concatenated, so the default look at every tier is 100% unchanged; colours
// 9–30 only ever appear once the child grows the basket count past 8 with
// the stepper — an opt-in density increase, never the default.
const FULL_PALETTE = [
  RED, YELLOW, BLUE, GREEN, ORANGE, PURPLE, LIME, SKY,
  { c: '#c97fa8', name: 'ורוד' },
  { c: '#4f9e94', name: 'טורקיז' },
  { c: '#8a6a4a', name: 'חום' },
  { c: '#e79bab', name: 'ורוד בהיר' },
  { c: '#3f7a4d', name: 'ירוק כהה' },
  { c: '#3c5a8a', name: 'כחול כהה' },
  { c: '#6f4fa0', name: 'סגול כהה' },
  { c: '#cf9f3d', name: 'זהב' },
  { c: '#b5623a', name: 'חמרה' },
  { c: '#3f7f8f', name: 'כחול ים' },
  { c: '#5c6672', name: 'אפור כהה' },
  { c: '#a3adba', name: 'אפור' },
  { c: '#c15f92', name: "מג׳נטה" },
  { c: '#3f9bab', name: 'ציאן' },
  { c: '#c9ac86', name: "בז׳" },
  { c: '#8a3f3f', name: 'בורדו' },
  { c: '#8fcf9e', name: 'ירוק בהיר' },
  { c: '#a8d8ea', name: 'תכלת בהיר' },
  { c: '#5a3f8a', name: 'סגול כהה' },
  { c: '#d1a23f', name: 'ענבר' },
  { c: '#cf8fd1', name: 'לילך' },
  { c: '#c3ccd6', name: 'אפור בהיר' },
]

const NEUTRAL = '#cbb994' // bin tint in friend mode, so the friend reads clearly
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MIN_CATS = 3

type Mode = 'smiley' | 'number' | 'letter' | 'friend'
const MODES: { id: Mode; label: string; max: number }[] = [
  { id: 'smiley', label: '🙂 סמיילים', max: 30 },
  { id: 'number', label: '🔢 מספרים', max: 30 },
  { id: 'letter', label: '🔤 אותיות', max: 26 },
  { id: 'friend', label: '⭐ חברים', max: 30 },
]

// readable text colour for a given background hue
function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#26313d' : '#ffffff'
}

type Blob = { id: number; cat: number }
let SEQ = 0
function freshBatch(numCats: number): Blob[] {
  const n = Math.min(12, Math.max(5, numCats))
  return shuffle(Array.from({ length: n }, () => ({ id: SEQ++, cat: randInt(0, numCats - 1) })))
}

function Face() {
  return (
    <span className="sb-face" aria-hidden="true">
      <i className="sb-eye" />
      <i className="sb-eye" />
      <i className="sb-mouth" />
    </span>
  )
}

export default function SortByColor({ onExit }: GameProps) {
  const { t } = useT()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game). The tier now
  // only sets the STARTING basket count (TIER_COLORS[level].length) — the
  // child grows past it with the "עוד סל" stepper below, up to the mode's max.
  const [level] = useGameLevel('sort', LEVEL_TIERS)
  const startCats = TIER_COLORS[level].length
  // smiley colours always come from FULL_PALETTE (whose first 8 entries ARE
  // TIER_COLORS' four tiers, concatenated) so the default look never changes,
  // and growing past 8 just reveals more of the same muted, sensory-calm set.
  const catColor = (i: number) => FULL_PALETTE[i % FULL_PALETTE.length].c
  const keyOf = (m: Mode, i: number) => (m === 'smiley' ? FULL_PALETTE[i % FULL_PALETTE.length].c : `${m}${i}`)

  const [mode, setMode] = useState<Mode>('smiley')
  const [numCats, setNumCats] = useState(() => Math.min(startCats, MODES.find((x) => x.id === 'smiley')!.max))
  const modeMax = MODES.find((x) => x.id === mode)!.max
  const [blobs, setBlobs] = useState<Blob[]>(() => freshBatch(numCats))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [popped, setPopped] = useState<string | null>(null) // bin that just got a drop
  const [party, setParty] = useState(false)

  // ── drag ghost (perf: NO per-frame React state) ──
  // `dragRef` holds the live drag synchronously for the pointer handlers; a tiny
  // `dragView` state only mounts the ghost + hides the source once. The ghost
  // position is written straight to the DOM via a ref inside one rAF — never
  // through React — so a drag stays flat-heap and jank-free under CPU throttle.
  const dragRef = useRef<{ id: number; cat: number; key: string } | null>(null)
  const [dragView, setDragView] = useState<{ id: number; cat: number; key: string } | null>(null)
  const ghostRef = useRef<HTMLSpanElement | null>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)

  const paintGhost = () => {
    rafRef.current = null
    const g = ghostRef.current
    if (g) g.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%) scale(1.12)`
  }
  useLayoutEffect(() => {
    if (dragView) paintGhost()
  }, [dragView])
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }, [])

  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 360))
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // switching difficulty from the header resets to THAT tier's starting count
  // (skip the first render — the initial board is already dealt above). The
  // child can still grow past it again with the stepper.
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    const next = Math.min(TIER_COLORS[level].length, modeMax)
    dragRef.current = null
    setDragView(null)
    setCounts({})
    setNumCats(next)
    setBlobs(freshBatch(next))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Lay the bins out to fill the width: as many columns as comfortably fit, with
  // a square-ish minimum. The balls track the bin size so they're never huge.
  // On a wide (tablet) screen the width cap is raised so a grown basket count
  // still lays out comfortably large — this is the child's OPT-IN density
  // choice via the stepper, never the default (defaults stay ≤8 baskets, same
  // size as before).
  const GAP = 12
  const wideCap = vw >= 700 ? 1000 : 760
  const availW = Math.min(vw - 24, wideCap)
  const sqrtCols = Math.ceil(Math.sqrt(numCats * 1.6))
  const fitCols = Math.floor((availW + GAP) / (64 + GAP))
  const perRow = Math.min(numCats, Math.max(sqrtCols, fitCols))
  const bw = Math.max(46, Math.min(112, Math.floor((availW - (perRow - 1) * GAP) / perRow)))
  const bh = bw // the pail sprite is square (pail + baked contact shadow)
  const countFont = Math.round(bw * 0.3)
  const labelFont = Math.round(bw * 0.34)
  // On short screens the stepper row costs tray height — cap the loose balls
  // smaller there so the tray's rows stay fully visible above the table.
  const shortScreen = typeof window !== 'undefined' && window.innerHeight < 860
  const ballSize = Math.max(42, Math.min(shortScreen ? 56 : 76, Math.round(bw * 0.86)))

  function newRound() {
    playTap()
    dragRef.current = null
    setDragView(null)
    setBlobs(freshBatch(numCats))
  }
  function chooseMode(m: Mode) {
    if (m === mode) return
    playTap()
    const nc = Math.min(numCats, MODES.find((x) => x.id === m)!.max)
    setMode(m)
    setNumCats(nc)
    dragRef.current = null
    setDragView(null)
    setCounts({})
    setBlobs(freshBatch(nc))
  }
  // the child-facing stepper: "עוד סל" grows baskets one at a time up to the
  // mode's max (30 / 30 / 26 / 30); "פחות" shrinks back down to MIN_CATS.
  // Baskets get smaller as the count grows (floor 46px, same as before) — that
  // density increase is the child's OWN opt-in choice, never forced on them.
  function changeCats(d: number) {
    const next = Math.min(modeMax, Math.max(MIN_CATS, numCats + d))
    if (next === numCats) return
    playTap()
    setNumCats(next)
    dragRef.current = null
    setDragView(null)
    setCounts({})
    setBlobs(freshBatch(next))
  }

  function down(e: React.PointerEvent, b: Blob) {
    unlockAudio()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { id: b.id, cat: b.cat, key: keyOf(mode, b.cat) }
    posRef.current = { x: e.clientX, y: e.clientY }
    setDragView(dragRef.current)
  }
  function move(e: React.PointerEvent) {
    if (!dragRef.current) return
    posRef.current = { x: e.clientX, y: e.clientY }
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(paintGhost)
  }
  function endDrag() {
    dragRef.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setDragView(null)
  }
  function up(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    // forgiving: snap to the NEAREST bin (no need to land exactly on it), as long
    // as it's the right one and the drop is reasonably close to it
    let basket: HTMLElement | null = null
    let bestD = Infinity
    document.querySelectorAll<HTMLElement>('[data-basket]').forEach((el) => {
      const r = el.getBoundingClientRect()
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
      if (d < bestD) {
        bestD = d
        basket = el
      }
    })
    const tol = Math.max(bw, bh) * 1.2
    if (basket && bestD <= tol && (basket as HTMLElement).dataset.basket === drag.key) {
      const newCount = (counts[drag.key] ?? 0) + 1
      setCounts((c) => ({ ...c, [drag.key]: newCount }))
      const left = blobs.filter((x) => x.id !== drag.id)
      setBlobs(left)
      speakNumber(newCount)
      const droppedKey = drag.key
      setPopped(droppedKey)
      window.setTimeout(() => setPopped((p) => (p === droppedKey ? null : p)), 380)
      if (left.length === 0) {
        playWin()
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
        window.setTimeout(() => setBlobs(freshBatch(numCats)), 1400)
      } else {
        playSuccess()
      }
    } else {
      playNudge()
    }
    endDrag()
  }

  // the contents of a draggable item / ghost, per mode
  function ItemInner({ cat }: { cat: number }) {
    if (mode === 'smiley') return <Face />
    if (mode === 'friend') return <Friend index={cat} scale={(ballSize * 0.85) / friendMaxDim(cat)} showNumber={false} />
    return (
      <span className="sort-sym" style={{ color: textOn(catColor(cat)) }}>
        {mode === 'number' ? cat + 1 : LETTERS[cat]}
      </span>
    )
  }
  const itemClass = `sort-blob ${mode === 'friend' ? 'is-friend' : ''}`

  function basketAria(i: number) {
    if (mode === 'smiley') return FULL_PALETTE[i % FULL_PALETTE.length].name
    if (mode === 'number') return t('sort.numAria', { n: i + 1 })
    if (mode === 'letter') return t('sort.letterAria', { l: LETTERS[i] })
    return friendName(i)
  }

  return (
    <GameShell title={t('game.sort')} emoji="🧺" onExit={onExit} levels={{ gameId: 'sort', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className={`sort-screen ${numCats > 12 ? 'sort-screen--dense' : ''}`}>
        <div className="sort-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`pill pill-small ${mode === m.id ? 'pill-active' : ''}`}
              onClick={() => chooseMode(m.id)}
            >
              {t(`sort.${m.id}`)}
            </button>
          ))}
        </div>

        {/* the child-facing basket stepper — grows/shrinks numCats up to the
            mode's max. RTL-first: in Hebrew "פחות" (fewer) sits on the right
            and "עוד סל" (more) on the left, matching reading order; the
            English/LTR mode mirrors automatically via dir-aware flex. */}
        <div className="sort-controls">
          <button
            className="pill sort-step-btn"
            onClick={() => changeCats(-1)}
            disabled={numCats <= MIN_CATS}
            aria-label={t('sort.fewer')}
          >
            ➖
          </button>
          <span className="sort-controls-label">{t('sort.baskets', { n: numCats })}</span>
          <button
            className="pill sort-step-btn"
            onClick={() => changeCats(1)}
            disabled={numCats >= modeMax}
            aria-label={t('sort.more')}
          >
            ➕
          </button>
        </div>

        {/* the SCENE — bins on a warm table inside a calm playroom (baked art) */}
        <div className="sort-stage">
          <SceneBackdrop src="sorting-room.jpg" position="center 32%" scrim="soft" />

          <div className="sort-tray">
            {blobs.map((b) => (
              <button
                key={b.id}
                className={itemClass}
                style={{ '--c': catColor(b.cat), '--bs': `${ballSize}px`, opacity: dragView?.id === b.id ? 0 : 1 } as React.CSSProperties}
                onPointerDown={(e) => down(e, b)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={endDrag}
                aria-label={t('sort.item')}
              >
                <ItemInner cat={b.cat} />
              </button>
            ))}
          </div>

          <div className="sort-surface">
            <div className="sort-baskets">
              {Array.from({ length: numCats }, (_, i) => {
                const key = keyOf(mode, i)
                const count = counts[key] ?? 0
                return (
                  <div className="sort-basket-cell" key={key}>
                    <div
                      className={`sort-basket ${popped === key ? 'is-pop' : ''}`}
                      data-basket={key}
                      style={{ '--c': mode === 'friend' ? NEUTRAL : catColor(i), width: bw, height: bh } as React.CSSProperties}
                      aria-label={basketAria(i)}
                    >
                      {mode === 'smiley' ? (
                        <span className="sort-count" style={{ fontSize: countFont, color: textOn(catColor(i)) }}>
                          {count}
                        </span>
                      ) : mode === 'friend' ? (
                        <span className="sort-basket-friend">
                          <Friend index={i} scale={(bw * 0.52) / friendMaxDim(i)} showNumber={false} />
                        </span>
                      ) : (
                        <span className="sort-basket-label" style={{ fontSize: labelFont, color: textOn(catColor(i)) }}>
                          {mode === 'number' ? i + 1 : LETTERS[i]}
                        </span>
                      )}
                    </div>
                    {mode !== 'smiley' && <span className="sort-count-below">{count}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="color-actions">
          <button className="big-button" onClick={newRound}>
            🔄 {t('sort.new')}
          </button>
        </div>
      </div>

      {dragView && (
        <span
          ref={ghostRef}
          className={`${itemClass} is-drag`}
          style={{ '--c': catColor(dragView.cat), '--bs': `${ballSize}px` } as React.CSSProperties}
          aria-hidden="true"
        >
          <ItemInner cat={dragView.cat} />
        </span>
      )}
    </GameShell>
  )
}
