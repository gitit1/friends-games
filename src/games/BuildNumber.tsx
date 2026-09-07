import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import Stepper from '../components/Stepper'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playRise, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { screenScale, useViewport } from '../useViewport'
import { randInt } from './util'
import { takeBuildPreset } from './buildPreset'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'
import { enabledOps, opEnabled, numberMax } from '../level'

// "בונים מספר" — build/compose a number in a warm little WOODWORK SHOP. Pick an
// operation and two friends, tap "how much?", and their two wooden NUMBER TILES
// slide together and MERGE into the answer tile (the answer friend bounces in),
// with the equation read out loud. No timer, no wrong answers — combos that can't
// make a whole friend (negative / non-divisible) just wait for friendlier numbers.
//
// This is the commercial-quality skin over the SAME compose mechanic: the digit
// tiles + operator pucks are baked maple sprites (public/art/sprites/build), the
// friends are grounded on a perspective workbench, and difficulty is the shared
// header star control — the NUMBER RANGE grows cumulatively with the level.
type Op = 'add' | 'sub' | 'mul' | 'div'
const OPS: { id: Op; sym: string; glyph: string }[] = [
  { id: 'add', sym: '➕', glyph: '+' },
  { id: 'sub', sym: '➖', glyph: '−' },
  { id: 'mul', sym: '✖️', glyph: '×' },
  { id: 'div', sym: '➗', glyph: '÷' },
]

// ── cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ──
// The NUMBER RANGE grows with the level: קל stays small + gentle (as easy as
// today's easiest — tiny numbers, results ≤ 10); each step opens bigger operands
// and a higher answer, until אלוף composes across the FULL 1–100 roster — a real,
// still no-fail, build. The child always freely picks the operation.
const LEVEL_TIERS = [0, 1, 2, 3]
const MAXOP = [5, 9, 10, 10] // operand ceiling per level
const MAXRES = [10, 20, 50, 100] // answer ceiling per level (must be a real friend)

const ADDEND_PX = 92
const RESULT_PX = 132

function compute(op: Op, a: number, b: number): number {
  if (op === 'add') return a + b
  if (op === 'sub') return a - b
  if (op === 'mul') return a * b
  return b !== 0 && a % b === 0 ? a / b : NaN // div: whole results only
}

// a baked wooden NUMBER TILE — the digit engraved crisply on a maple block
function BuildTile({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`build-tile build-tile-${size}`}>
      <span className="build-tile-num">{n}</span>
    </span>
  )
}
// a baked wooden OPERATOR puck — the symbol engraved on a carved maple knob
function OpPuck({ sym, size = 'md' }: { sym: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`build-puck build-puck-${size}`}>
      <span className="build-puck-sym">{sym}</span>
    </span>
  )
}

export default function BuildNumber({ onExit }: GameProps) {
  const { t } = useT()
  const grow = screenScale(useViewport().w, 1.6)
  // the operations the parent enabled (the chooser is the frozen mechanic)
  const ops = OPS.filter((o) => opEnabled(o.id))
  // per-game difficulty from the shared header control — opens at the parent's
  // global setting, then the child's choice sticks per game. Drives the range.
  const [level] = useGameLevel('build', LEVEL_TIERS)
  const parentMax = numberMax()
  const max = Math.max(1, Math.min(MAXRES[level], parentMax)) // answer ceiling
  const maxOp = Math.max(1, Math.min(MAXOP[level], parentMax)) // operand ceiling
  // if a friend's world sent us here via "build me!", open already set to that
  // split (e.g. 3 + 4) instead of a random one — read once on mount
  const [preset] = useState(takeBuildPreset)
  const [op, setOp] = useState<Op>(() => enabledOps()[0])
  const [a, setA] = useState(() => preset?.a ?? randInt(1, Math.min(9, maxOp)))
  const [b, setB] = useState(() => preset?.b ?? randInt(1, Math.min(9, maxOp)))
  const [phase, setPhase] = useState<'pick' | 'merge' | 'done'>('pick')
  const timers = useRef<number[]>([])
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => clear, [])

  const c = compute(op, a, b)
  const valid = Number.isInteger(c) && c >= 1 && c <= max
  const glyph = OPS.find((o) => o.id === op)!.glyph
  const clamp = (n: number) => Math.max(1, Math.min(maxOp, n))
  const set = (fn: (v: number) => void, v: number) => {
    if (phase === 'pick') fn(clamp(v))
  }
  const pickOp = (o: Op) => {
    if (phase === 'pick') setOp(o)
  }

  const hint =
    valid || phase !== 'pick' ? '' : op === 'sub' ? t('build.hintSub') : t('build.hintDiv')

  // switching difficulty from the header re-opens a fresh, in-range build (skip
  // the first render — the initial split is already set above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    clear()
    setPhase('pick')
    setA(randInt(1, Math.min(9, maxOp)))
    setB(randInt(1, Math.min(9, maxOp)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function combine() {
    if (phase !== 'pick' || !valid) return
    unlockAudio()
    setPhase('merge')
    playRise(2)
    timers.current.push(
      window.setTimeout(() => {
        setPhase('done')
        playWin()
        speakNumber(c)
      }, 750),
    )
  }
  function again() {
    clear()
    setPhase('pick')
    setA(randInt(1, Math.min(9, maxOp)))
    setB(randInt(1, Math.min(9, maxOp)))
  }

  const merging = phase === 'merge'

  return (
    <GameShell title={t('game.build')} emoji="🧮" onExit={onExit} levels={{ gameId: 'build', tiers: LEVEL_TIERS }}>
      <Confetti active={phase === 'done'} />
      <div className="build-screen">
        {/* equation read-out on tiles (announced) */}
        <div className="build-eq" aria-live="polite" dir="ltr">
          <BuildTile n={a} size="sm" />
          <OpPuck sym={glyph} size="sm" />
          <BuildTile n={b} size="sm" />
          {phase === 'done' && (
            <>
              <OpPuck sym="=" size="sm" />
              <BuildTile n={c} size="sm" />
            </>
          )}
        </div>

        {/* the woodwork-shop stage: a warm playroom behind a perspective bench,
            with the friends grounded on it building their number out of tiles */}
        <div className="build-stage">
          <SceneBackdrop src="wooden-playroom.jpg" position="center 26%" scrim="soft" />
          {/* calm living scene — a slow warm light drift + drifting dust motes in
              the window light. Pure CSS, frozen under reduced motion. */}
          <div className="build-ambient" aria-hidden="true">
            <span className="build-sheen" />
            <span className="build-mote m1" />
            <span className="build-mote m2" />
            <span className="build-mote m3" />
          </div>

          <div className="build-bench">
            {phase !== 'done' ? (
              <div className={`build-assembly ${merging ? 'is-merging' : ''}`}>
                <span className="build-slot build-slot-a">
                  <span className="build-actor">
                    <Friend
                      index={a - 1}
                      scale={(ADDEND_PX / friendMaxDim(a - 1)) * grow}
                      showNumber={false}
                      mood="smile"
                      lively
                    />
                    <span className="build-shadow" aria-hidden="true" />
                  </span>
                  <BuildTile n={a} size="md" />
                </span>

                <OpPuck sym={glyph} size="md" />

                <span className="build-slot build-slot-b">
                  <span className="build-actor">
                    <Friend
                      index={b - 1}
                      scale={(ADDEND_PX / friendMaxDim(b - 1)) * grow}
                      showNumber={false}
                      mood="smile"
                      lively
                    />
                    <span className="build-shadow" aria-hidden="true" />
                  </span>
                  <BuildTile n={b} size="md" />
                </span>
              </div>
            ) : (
              <div className="build-result">
                <span className="build-actor">
                  <Friend
                    index={c - 1}
                    scale={(RESULT_PX / friendMaxDim(c - 1)) * grow}
                    showNumber={false}
                    bouncing
                    lively
                  />
                  <span className="build-shadow" aria-hidden="true" />
                </span>
                <BuildTile n={c} size="lg" />
              </div>
            )}
          </div>
        </div>

        {phase === 'pick' && (
          <div className="build-controls">
            <div className="build-ops">
              {ops.map((o) => (
                <button
                  key={o.id}
                  className={`build-op-btn ${op === o.id ? 'is-active' : ''}`}
                  onClick={() => pickOp(o.id)}
                  aria-label={t(`build.${o.id}`)}
                >
                  <OpPuck sym={o.glyph} size="sm" />
                </button>
              ))}
            </div>
            <div className="build-steppers">
              <Stepper
                label={<BuildTile n={a} size="sm" />}
                onPrev={() => set(setA, a - 1)}
                onNext={() => set(setA, a + 1)}
              />
              <Stepper
                label={<BuildTile n={b} size="sm" />}
                onPrev={() => set(setB, b - 1)}
                onNext={() => set(setB, b + 1)}
              />
            </div>
            {hint ? (
              <p className="build-hint">{hint}</p>
            ) : (
              <button className="big-button" onClick={combine}>
                🟰 {t('build.how')}
              </button>
            )}
          </div>
        )}
        {phase === 'done' && (
          <button className="big-button" onClick={again}>
            🔄 {t('missing.new')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
