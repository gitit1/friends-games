import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playRise, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { useT } from '../i18n'
import { numberMax } from '../level'
import { useGameLevel } from '../gameLevel'

// Skip-counting on a NUMBER LINE, now a receding STEPPING-STONE PATH across a
// meadow: the step-friend (2 / 5 / 10 …) leaps from stone to stone, landing on
// its multiples. Each landing shows step × hops = current, so skip-counting and
// multiplication click together (Numberblocks "Step Squad" / lily-pad number
// path). No timer, no fail — the mechanic is untouched; only the scene, depth,
// materials, difficulty and feel are raised to the commercial-quality bar.

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// Difficulty = how long the number-line path runs (its RANGE) + which step sizes
// are on offer. קל is a short, gentle path with the friendliest steps; each tier
// unrolls a longer line and a wider step palette, up to אלוף's full 1..10 across a
// 10-hop journey — a real (still no-fail) challenge. Adjusting the range / step
// palette per level is the sanctioned difficulty layer; the counting mechanic
// itself (pick a step, hop the multiples) is frozen.
const LEVEL_TIERS = [0, 1, 2, 3]
const STEP_SETS = [
  [2, 5, 10],
  [2, 3, 5, 10],
  [2, 3, 4, 5, 6, 10],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
]
const MAX_HOPS = [5, 7, 9, 10]

const STONE_ASPECT = 208 / 240 // baked sprite height / width

type Box = { w: number; h: number }
type Pos = { x: number; y: number; s: number } // stone centre (px) + perspective scale

// Lay the stones along one receding path: index 0 sits NEAR (bottom-left, big),
// the last stone sits FAR (upper-right, small). Same perspective ease as the
// sports scenes, so near stones spread out and far stones bunch toward the
// horizon — real depth, while the numbers still read 0→max left-to-right.
function layout(box: Box, count: number): Pos[] {
  const LEFT = 0.13
  const RIGHT = 0.87
  const NEAR_Y = 0.82 // fraction of height — nearest stone centre (low)
  const FAR_Y = 0.26 // farthest stone centre (high)
  const out: Pos[] = []
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0
    // perspective: evenly-spaced stones bunch toward the horizon — so the path
    // spreads NEAR (foreground) and compresses FAR. A mild exponent keeps the far
    // cluster legible even at אלוף's 11-stone line.
    const e = 1 - Math.pow(1 - t, 1.42)
    out.push({
      x: (LEFT + (RIGHT - LEFT) * e) * box.w,
      y: (NEAR_Y + (FAR_Y - NEAR_Y) * e) * box.h,
      s: 1 - 0.5 * t, // near 1 … far 0.5, tracking depth
    })
  }
  return out
}

export default function SkipCount({ onExit }: GameProps) {
  const { t } = useT()
  const [level] = useGameLevel('skipcount', LEVEL_TIERS)
  const max = numberMax()

  const [step, setStep] = useState(2)
  const [hops, setHops] = useState(0)

  const STEPS = useMemo(() => STEP_SETS[level].filter((s) => s <= max), [level, max])
  // keep every multiple within the level's range: cap hops by the level AND by the
  // parent's number ceiling, so no stone ever shows a number above `max`.
  const HOPS = Math.max(1, Math.min(MAX_HOPS[level], Math.floor(max / step), 10))
  const current = step * hops
  const done = hops >= HOPS

  // switching difficulty (or the parent's max) may retire the current step — snap
  // to a valid one and restart the line. Runs only when the step set changes.
  useEffect(() => {
    if (!STEPS.includes(step)) setStep(STEPS[0] ?? 2)
    setHops(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // measure the scene box (once + on resize) so stone positions are real px — the
  // leap animation needs the pixel delta between two stones. Rare, not per-frame.
  const sceneRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Box>({ w: 0, h: 0 })
  useEffect(() => {
    const el = sceneRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const stones = useMemo(() => layout(box, HOPS + 1), [box, HOPS])

  function hop() {
    if (done) return
    unlockAudio()
    const next = hops + 1
    setHops(next)
    playRise(next - 1) // climbing notes → the count sings up the line
    speakNumber(step * next)
    if (next >= HOPS) window.setTimeout(playWin, 380)
  }
  function reset() {
    setHops(0)
  }
  function pickStep(s: number) {
    setStep(s)
    setHops(0)
  }

  const nearW = box.w * 0.185 // near stone width in px (fraction of the scene)

  return (
    <GameShell title={t('game.skipcount')} emoji="🦘" onExit={onExit} levels={{ gameId: 'skipcount', tiers: LEVEL_TIERS }}>
      <Confetti active={done} />
      <div className="count-opt-row hop-steps">
        <span className="count-opt-label">{t('skip.by')}</span>
        {STEPS.map((s) => (
          <button key={s} className={`pill pill-small ${step === s ? 'pill-active' : ''}`} onClick={() => pickStep(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* skip-count = multiplication, shown as it grows */}
      <div className="hop-readout" aria-live="polite">
        {hops === 0 ? (
          <span className="hop-hint">{t('skip.tap')}</span>
        ) : (
          // a maths equation reads left-to-right even in Hebrew (else RTL bidi
          // can flip it to "6 = 3 × 2")
          <span dir="ltr">
            <span className="hop-eq-mul">
              {step} × {hops} ={' '}
            </span>
            <strong>{current}</strong>
            {done && ' 🎉'}
          </span>
        )}
      </div>

      {/* the number line — a receding stepping-stone path across a calm meadow.
          dir=ltr so it reads like a number line (0 nearest/left) in both languages. */}
      <div className="hop-scene" ref={sceneRef} dir="ltr">
        <SceneBackdrop src="meadow.jpg" position="center 62%" scrim="soft" />
        {/* living meadow (calm): a slow light drift, a few swaying grass tufts, and
            a near-edge grounding strip. Static DOM + pure-CSS keyframes (zero JS
            per frame); frozen under both reduced-motion paths (see app.css). */}
        <div className="court-ambient" aria-hidden="true">
          <span className="court-drift" />
          <span className="court-tuft m1" />
          <span className="court-tuft m2" />
          <span className="court-tuft c1" />
          <span className="court-tuft c2" />
          <span className="court-tuft f1" />
          <span className="court-tuft f2" />
          <span className="court-fore" />
        </div>

        {box.w > 0 &&
          stones.map((p, i) => {
            const w = nearW * p.s
            const h = w * STONE_ASPECT
            const isCur = i === hops && hops > 0
            const state = i === 0 ? 'start' : i <= hops ? (i === HOPS ? 'goal visited' : 'visited') : i === HOPS ? 'goal' : ''
            // leap: start the hopper at the PREVIOUS stone and arc to this one
            const prev = stones[i - 1] ?? p
            const leap = {
              '--lx': `${prev.x - p.x}px`,
              '--ly': `${prev.y - p.y}px`,
              '--ls': prev.s / p.s,
            } as React.CSSProperties
            return (
              <div
                key={i}
                className={`hop-stone ${state} ${isCur ? 'cur' : ''}`}
                style={{
                  left: p.x,
                  top: p.y,
                  width: w,
                  height: h,
                  zIndex: isCur ? 200 : 100 - i,
                }}
              >
                <span className="hop-stone-num" style={{ fontSize: Math.max(11, w * 0.3) }}>
                  {i === 0 ? 0 : step * i}
                </span>
                {isCur && (
                  <span className="hop-hopper" key={hops} style={{ ...leap, bottom: `${(1 - 82 / 208) * 100}%` }}>
                    <Friend index={current - 1} scale={(w / 130) * 1.15} showNumber={false} bouncing={done} lively />
                  </span>
                )}
              </div>
            )
          })}
      </div>

      {/* one button that transforms: hop while playing → restart once finished
          (no extra "more" element; the confetti + celebrating friend say "done!") */}
      <div className="counting-next">
        <button className="big-button" onClick={done ? reset : hop}>
          {done ? `🔄 ${t('skip.again')}` : `🦘 ${t('skip.hop')}`}
        </button>
      </div>
    </GameShell>
  )
}
