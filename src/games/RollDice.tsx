import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playCount, playDice, playLand, playSuccess, playTap, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendSay } from '../friends'
import { numberWord, randInt } from './util'
import { useT } from '../i18n'
import { numberMax } from '../level'

// "Roll a dice" — pick a dice TYPE (each a different 3D shape), add as many dice
// as fit the screen, tap to roll: they tumble with a couple of real bounces, the
// rotation eases out, and they land with a little squash. The total is added up
// live and read out; when it lands on a friend (1–30) that friend is crowned and
// gives a proud little bounce. No timer, no losing — keep rolling and adding more.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

type DiceType = { key: string; label: string; sides: number; dots: boolean; color: string; shape: string }
const DICE_TYPES: DiceType[] = [
  { key: 'dots', label: '⚄', sides: 6, dots: true, color: '#eef2f7', shape: 'square' },
  { key: 'd4', label: '4', sides: 4, dots: false, color: '#fca5a5', shape: 'triangle' },
  { key: 'd6', label: '6', sides: 6, dots: false, color: '#fdba74', shape: 'square' },
  { key: 'd8', label: '8', sides: 8, dots: false, color: '#fcd34d', shape: 'diamond' },
  { key: 'd10', label: '10', sides: 10, dots: false, color: '#86efac', shape: 'kite' },
  { key: 'd12', label: '12', sides: 12, dots: false, color: '#93c5fd', shape: 'pentagon' },
  { key: 'd20', label: '20', sides: 20, dots: false, color: '#c4b5fd', shape: 'hexagon' },
]
const MIN_S = 40 // smallest a die shrinks to (drives the screen-based max count)
const GAP = 10
const SAY_EACH = 6 // up to this many dice, read the sum out as an addition sentence
const COUNT_MAX = 12 // dot-by-dot counting only up to this total (else it would drone)

// "שש ועוד ארבע ועוד ארבע, ביחד ארבע-עשרה" — each die read aloud, then the total.
function spokenAddition(vals: number[], sum: number) {
  return `${vals.map((v) => numberWord(v)).join(' ועוד ')}, ביחד ${numberWord(sum)}`
}

// The number dice ride a BAKED faceted body (public/art/sprites/dice/body-*.png);
// their rolled number overlays in the DOM at the body's visual centre (it changes
// each roll, so it can't be baked in). Percentages are the number's centre on the
// square sprite for each shape.
const BODY_SPRITE: Record<string, string> = {
  square: 'body-square',
  triangle: 'body-triangle',
  diamond: 'body-diamond',
  kite: 'body-kite',
  pentagon: 'body-pentagon',
  hexagon: 'body-hexagon',
}
const NUM_POS: Record<string, { x: number; y: number }> = {
  square: { x: 40.7, y: 59.2 }, // the cube's front-face centre
  triangle: { x: 50, y: 60 },
  diamond: { x: 50, y: 49 },
  kite: { x: 50, y: 46 },
  pentagon: { x: 50, y: 52 },
  hexagon: { x: 50, y: 47 },
}

function Die({
  value,
  type,
  size,
  rolling,
  delay,
  baseIndex,
  countStep,
  onClick,
  aria,
}: {
  value: number
  type: DiceType
  size: number
  rolling: boolean
  delay: number
  baseIndex: number // how many pips came before this die (for the one-by-one count)
  countStep: number // 0 = not counting; else the pip number reached so far
  onClick: () => void
  aria: string
}) {
  const base = import.meta.env.BASE_URL
  // the die is a BAKED material sprite: the spotted die swaps its face (pip-1..6),
  // the number dice ride a single baked faceted body. Nothing here is flat CSS.
  const sprite = type.dots
    ? `${base}art/sprites/dice/pip-${value}.png`
    : `${base}art/sprites/dice/${BODY_SPRITE[type.shape] ?? 'body-square'}.png`
  const pos = NUM_POS[type.shape] ?? { x: 50, y: 50 }
  return (
    <button
      type="button"
      className={`die ${rolling ? 'is-rolling' : ''} ${type.dots ? 'die-dots' : 'die-num'}`}
      style={{
        width: size,
        height: size,
        fontSize: `${size}px`,
        '--td': `${delay}s`,
        backgroundImage: `url("${sprite}")`,
      } as React.CSSProperties}
      onClick={onClick}
      aria-label={aria}
    >
      {type.dots ? (
        // a crisp CSS COUNT-GLOW overlay, aligned pixel-for-pixel over the baked
        // recessed pips (the .die-face box = the sprite's front face). Invisible
        // at rest — the baked pips show — it only lights up during the beloved
        // pip-by-pip count.
        <span className="die-face" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => {
            const on = PIPS[value].includes(i)
            // this slot's order among the die's visible pips → its global pip number
            const globalPip = on ? baseIndex + PIPS[value].indexOf(i) : -1
            const counted = countStep > 0 && globalPip >= 0 && globalPip < countStep
            const current = countStep > 0 && globalPip === countStep - 1
            return (
              <span
                key={i}
                className={`pip-glow ${on ? 'on' : ''} ${counted ? 'counted' : ''} ${current ? 'is-counting' : ''}`}
              />
            )
          })}
        </span>
      ) : (
        <span className="die-value" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
          {value}
        </span>
      )}
    </button>
  )
}

export default function RollDice({ onExit }: GameProps) {
  const { t } = useT()
  const [typeIdx, setTypeIdx] = useState(0)
  const [values, setValues] = useState<number[]>([3, 4])
  const [rolling, setRolling] = useState(false)
  const [settled, setSettled] = useState(true)
  const [rollId, setRollId] = useState(0)
  const [countStep, setCountStep] = useState(0) // pip-by-pip counter after a roll
  const [firstDone, setFirstDone] = useState(false) // has the child rolled once?
  const finalRef = useRef<number[]>([3, 4])

  const [win, setWin] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 360,
    h: typeof window !== 'undefined' ? window.innerHeight : 700,
  }))
  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const interval = useRef<number | null>(null)
  const timers = useRef<number[]>([])
  function clearTimers() {
    if (interval.current) window.clearInterval(interval.current)
    interval.current = null
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const type = DICE_TYPES[typeIdx]
  const n = values.length
  const sum = values.reduce((a, b) => a + b, 0)

  // how big the dice area is, and how the dice pack into it
  const areaW = Math.min(440, win.w - 24)
  const areaH = Math.max(150, win.h * 0.36)
  const colsAt = (s: number) => Math.max(1, Math.floor((areaW + GAP) / (s + GAP)))
  const rowsAt = (s: number) => Math.max(1, Math.floor((areaH + GAP) / (s + GAP)))
  const maxDice = Math.min(40, colsAt(MIN_S) * rowsAt(MIN_S))
  // largest die size at which all n dice still fit the area
  const dieSize = (() => {
    for (let s = 80; s > MIN_S; s -= 2) if (colsAt(s) * rowsAt(s) >= n) return s
    return MIN_S
  })()

  // walk 1..total, lighting one dot at a time with a rising count tone, then
  // announce the total. Only for the dotted die and small totals (else it drones).
  function startCount(final: number[]) {
    const s = final.reduce((a, b) => a + b, 0)
    const tail = s >= 1 && s <= numberMax() ? `! ${friendSay(s - 1)}` : ''
    if (type.dots && s >= 1 && s <= COUNT_MAX) {
      setCountStep(0)
      for (let k = 1; k <= s; k++) {
        const id = window.setTimeout(() => {
          setCountStep(k)
          playCount(k)
          if (k === s) {
            const done = window.setTimeout(() => speak(`${numberWord(s)}${tail}`), 240)
            timers.current.push(done)
            // let the finished count glow linger a moment, then return the pips
            // to their resting look
            const reset = window.setTimeout(() => setCountStep(0), 1100)
            timers.current.push(reset)
          }
        }, k * 300)
        timers.current.push(id)
      }
    } else {
      // with a few dice, read the addition aloud ("6 ועוד 4 ועוד 4, ביחד 14");
      // with many, just the total so it doesn't drone on
      if (final.length >= 2 && final.length <= SAY_EACH) speak(`${spokenAddition(final, s)}${tail}`)
      else speak(`${numberWord(s)}${tail}`)
    }
  }

  function roll() {
    if (rolling) return
    unlockAudio()
    clearTimers()
    setCountStep(0)
    setFirstDone(true)
    setSettled(false)
    setRolling(true)
    playDice()
    interval.current = window.setInterval(() => {
      setValues((vs) => vs.map(() => randInt(1, type.sides)))
    }, 85)
    // lock in the final faces a touch before the tumble lands
    const lock = window.setTimeout(() => {
      if (interval.current) window.clearInterval(interval.current)
      interval.current = null
      const final = finalRef.current.map(() => randInt(1, type.sides))
      finalRef.current = final
      setValues(final)
    }, 680)
    timers.current.push(lock)
    // landing: stop the tumble, thud, count, announce
    const land = window.setTimeout(() => {
      setRolling(false)
      setSettled(true)
      setRollId((r) => r + 1)
      playLand()
      playSuccess()
      startCount(finalRef.current)
    }, 1000)
    timers.current.push(land)
  }

  function addDie() {
    if (rolling || n >= maxDice) return
    playTap()
    setValues((vs) => {
      const next = [...vs, randInt(1, type.sides)]
      finalRef.current = next
      return next
    })
    setSettled(true)
    setCountStep(0)
  }
  function removeDie() {
    if (rolling || n <= 1) return
    playTap()
    setValues((vs) => {
      const next = vs.slice(0, -1)
      finalRef.current = next
      return next
    })
    setSettled(true)
    setCountStep(0)
  }
  function chooseType(i: number) {
    if (rolling) return
    playTap()
    setTypeIdx(i)
    setValues((vs) => {
      const next = vs.map(() => randInt(1, DICE_TYPES[i].sides))
      finalRef.current = next
      return next
    })
    setSettled(true)
    setCountStep(0)
  }

  const hasFriend = settled && !rolling && sum >= 1 && sum <= numberMax()
  // running pip offset per die, for the one-by-one count highlight
  let pipBase = 0

  return (
    <GameShell title={t('game.dice')} emoji="🎲" onExit={onExit}>
      <div className="roll-screen">
        <div className="dice-types">
          {DICE_TYPES.map((dt, i) => (
            <button
              key={dt.key}
              className={`die-type-chip ${i === typeIdx ? 'is-active' : ''}`}
              style={dt.dots ? undefined : { background: dt.color }}
              onClick={() => chooseType(i)}
              aria-label={dt.dots ? t('dice.dots') : t('dice.upTo', { n: dt.sides })}
            >
              {dt.label}
            </button>
          ))}
        </div>

        {/* DOM order = increase, label, decrease: a plain flex row honours the
            document dir, so "+" lands on the reading-start side (right in he,
            left in en) without any manual mirroring */}
        <div className="dice-count">
          <button className="icon-button" onClick={addDie} disabled={rolling || n >= maxDice} aria-label={t('dice.more')}>
            ➕
          </button>
          <span className="dice-count-label">{t('dice.count', { n })}</span>
          <button className="icon-button" onClick={removeDie} disabled={rolling || n <= 1} aria-label={t('dice.fewer')}>
            ➖
          </button>
        </div>

        <div
          className={`dice-stage ${!firstDone && !rolling ? 'is-hint' : ''}`}
          style={{ maxWidth: areaW }}
        >
          {values.map((v, i) => {
            const base = pipBase
            if (type.dots) pipBase += v
            return (
              <Die
                key={i}
                value={v}
                type={type}
                size={dieSize}
                rolling={rolling}
                delay={(i % 4) * 0.04}
                baseIndex={base}
                countStep={countStep}
                onClick={roll}
                aria={t('dice.aria')}
              />
            )
          })}
        </div>
        {!firstDone && !rolling && (
          <p className="dice-tap-hint" aria-hidden="true">
            {t('dice.tapHint')}
          </p>
        )}

        <div className="roll-result">
          {settled && !rolling && n >= 2 && n <= 12 && (
            <div className="roll-expr" dir="ltr" aria-hidden="true">
              {values.join(' + ')} = {sum}
            </div>
          )}
          <div className="roll-sum" aria-label={t('dice.totalAria', { n: sum })}>
            <span className="roll-sum-label">{t('dice.total')}</span>
            <span className="roll-sum-num">{sum}</span>
          </div>
          {hasFriend && (
            <span key={rollId} className="roll-friend is-in">
              <span className="roll-crown" aria-hidden="true">
                👑
              </span>
              <Friend index={sum - 1} scale={104 / friendMaxDim(sum - 1)} showNumber={false} />
            </span>
          )}
        </div>

        <button className="icon-button roll-icon" onClick={roll} disabled={rolling} aria-label={t('dice.roll')}>
          <span aria-hidden="true">🎲</span>
        </button>
      </div>
    </GameShell>
  )
}
