import { memo, useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playNudge, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendColor, friendName } from '../friends'
import { FRIEND_KINDS, friendMaxDim } from '../components/FriendArt'
import { numberWord, numberWordNiqqud, randInt } from './util'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'
import { opEnabled, numberMax } from '../level'

const REAL_FRIENDS = FRIEND_KINDS.length // numbers up to here have a real friend
// קל · בינוני · קשה · אלוף — grows the goal-mode number range (chosen via the
// top-bar star control; free mode is an open toy, unaffected).
const LEVEL_TIERS = [0, 1, 2, 3]

type Op = '+' | '-' | '×' | '÷'

function compute(a: number, op: Op, b: number) {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '÷') return b === 0 ? a : Math.round((a / b) * 100) / 100 // never /0; keep it tidy
  return a * b
}

// Express a big number as a sum of friend-sized chunks (each ≤ the biggest
// friend), e.g. 42 → [40, 2], 90 → [40, 40, 10]. Lets a number with no single
// friend be shown as a little crowd of real friends that add up to it.
function decompose(value: number): number[] {
  const chunks: number[] = []
  let rest = value
  while (rest > REAL_FRIENDS) {
    chunks.push(REAL_FRIENDS)
    rest -= REAL_FRIENDS
  }
  if (rest > 0) chunks.push(rest)
  return chunks
}

// Layout switches to a side-by-side split on wider screens (e.g. iPad).
function useIsWide() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 720px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 720px)')
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

// Numbers with no real friend yet → a chunky friend made of connected circles
// (one per digit), with the number on it, that looks like it holds lots inside.
const BigFriend = memo(function BigFriend({ value, scale }: { value: number; scale: number }) {
  const digits = String(value).length
  const base = Math.round(72 * scale)
  // Shrink the bumps when there are many digits so big numbers still fit.
  const unit = Math.max(22, digits > 4 ? Math.round((base * 4) / digits) : base)
  return (
    <div className="bigf">
      <div className="bigf-body" style={{ '--u': `${unit}px` } as React.CSSProperties}>
        {Array.from({ length: digits }).map((_, i) => (
          <span className="bigf-circle" style={{ '--bc': friendColor(i % 10) } as React.CSSProperties} key={i} />
        ))}
        <span className="bigf-face">
          <i className="bigf-eye" />
          <i className="bigf-eye" />
          <span className="bigf-mouth" />
        </span>
      </div>
      <span className="bigf-num">{value}</span>
    </div>
  )
})

// A number with no single friend, shown as the real friends that add up to it
// (42 = friend 40 + friend 2). Each chunk is normalised to a uniform box so the
// crowd fits, and shows its own number.
const CompositeFriend = memo(function CompositeFriend({ value, scale }: { value: number; scale: number }) {
  const chunks = decompose(value)
  const room = scale >= 0.8 ? 300 : 196
  const per = Math.max(46, Math.min(96, Math.floor(room / chunks.length)))
  return (
    <div className="calc-compose">
      <div className="calc-compose-row">
        {chunks.map((c, i) => (
          <span className="calc-compose-cell" key={i}>
            {i > 0 && <span className="calc-plus">+</span>}
            <Friend index={c - 1} scale={per / friendMaxDim(c - 1)} showNumber />
          </span>
        ))}
      </div>
      <span className="calc-compose-sum">= {value}</span>
    </div>
  )
})

// "Build N" challenge: a target number + two hint numbers that make it (one way;
// the child can reach it however they like). Range grows with difficulty, and the
// target stays within the level + uses only an enabled operation.
type Goal = { target: number; hint: number[] }
function newGoal(tier: number): Goal {
  const maxF = [6, 9, 10, 12][Math.min(3, tier)]
  const max = numberMax()
  for (let i = 0; i < 40; i++) {
    const a = randInt(2, maxF)
    const b = randInt(2, maxF)
    const useMul = opEnabled('mul') && (!opEnabled('add') || (tier >= 1 && Math.random() < 0.5))
    const target = useMul ? a * b : a + b
    if (target >= 2 && target <= max) return { target, hint: [a, b] }
  }
  const a = Math.max(1, Math.min(maxF, max - 1))
  return { target: Math.min(max, a + 1), hint: [a, 1] }
}

// What the friends panel shows for the number currently on the display. The
// friend rests on a baked contact shadow so it reads as GROUNDED on the tray,
// never a cut-out floating in a box.
const NumberView = memo(function NumberView({ value, scale }: { value: number; scale: number }) {
  let inner
  if (Number.isInteger(value) && value >= 1 && value <= REAL_FRIENDS) {
    inner = <Friend index={value - 1} scale={scale} />
  } else if (Number.isInteger(value) && value > REAL_FRIENDS) {
    // a small crowd of friends if it decomposes into a few; otherwise the chunky big-friend
    inner =
      decompose(value).length <= 5 ? (
        <CompositeFriend value={value} scale={scale} />
      ) : (
        <BigFriend value={value} scale={scale} />
      )
  } else {
    inner = <span className="calc-bignum">{value}</span>
  }
  return (
    <span className="calc-actor">
      {inner}
      <span className="calc-actor-shadow" aria-hidden="true" />
    </span>
  )
})

export default function CalcFriends({ onExit }: GameProps) {
  const { t } = useT()
  const wide = useIsWide()
  // per-game difficulty from the shared top-bar star control (opens at the
  // parent's global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('calc', LEVEL_TIERS)
  const [display, setDisplay] = useState('0')
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [fresh, setFresh] = useState(true)
  const [mode, setMode] = useState<'free' | 'goal'>('free')
  const [goal, setGoal] = useState<Goal>(() => newGoal(level))
  const [reveal, setReveal] = useState(0) // bumps on "=", so the result friend pops in
  const [party, setParty] = useState(false)

  const value = Number(display)

  // changing the difficulty from the header re-rolls the challenge at the new
  // range (skip the first render — the initial goal is already set above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    if (mode === 'goal') {
      setGoal(newGoal(level))
      setDisplay('0')
      setAcc(null)
      setOp(null)
      setFresh(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function chooseMode(m: 'free' | 'goal') {
    playTap()
    setMode(m)
    setDisplay('0')
    setAcc(null)
    setOp(null)
    setFresh(true)
    if (m === 'goal') setGoal(newGoal(level))
  }

  function digit(d: string) {
    unlockAudio()
    playTap()
    if (fresh) {
      setDisplay(d)
      setFresh(false)
      return
    }
    setDisplay((p) => (p === '0' ? d : p + d))
  }

  function chooseOp(next: Op) {
    unlockAudio()
    playTap()
    const cur = Number(display)
    if (acc !== null && op !== null && !fresh) {
      const r = compute(acc, op, cur)
      setAcc(r)
      setDisplay(String(r))
    } else if (acc === null) {
      setAcc(cur)
    }
    setOp(next)
    setFresh(true)
  }

  function equals() {
    if (op === null || acc === null || fresh) return
    unlockAudio()
    const r = compute(acc, op, Number(display))
    setDisplay(String(r))
    setAcc(null)
    setOp(null)
    setFresh(true)
    setReveal((k) => k + 1) // pop the result friend in
    if (mode === 'goal') {
      if (r === goal.target) {
        playWin()
        speak(`${numberWordNiqqud(r)}! כל הכבוד!`)
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
        window.setTimeout(() => {
          setGoal(newGoal(level))
          setDisplay('0')
        }, 1400)
      } else {
        playNudge()
        speak('כמעט! נסו שוב')
      }
      return
    }
    playWin()
    if (Number.isInteger(r) && r >= 1 && r <= REAL_FRIENDS) {
      speak(`${numberWord(r)}. ${friendName(r - 1)}`)
    } else if (Number.isInteger(r) && r > REAL_FRIENDS) {
      const chunks = decompose(r)
      // "ארבעים ועוד שתיים, ביחד 42" — hear the number built from its friends
      if (chunks.length <= 5) speak(`${chunks.map((c) => numberWord(c)).join(' ועוד ')}, ביחד ${numberWord(r)}`)
      else speak(numberWord(r))
    }
  }

  function clear() {
    playTap()
    setDisplay('0')
    setAcc(null)
    setOp(null)
    setFresh(true)
  }

  // "Back" — always works. If an operator was just chosen, cancel it and return
  // to the previous number; otherwise erase the last digit being typed.
  function back() {
    playTap()
    if (fresh && op !== null) {
      if (acc !== null) setDisplay(String(acc))
      setAcc(null)
      setOp(null)
      setFresh(false)
      return
    }
    setFresh(false)
    setDisplay((p) => {
      const next = p.slice(0, -1)
      return next === '' || next === '-' ? '0' : next
    })
  }

  // crisp calculator glyphs (not emoji) so each key reads as a real pressable
  // face; `key` is the id, `label` the visible glyph, `--c` its muted hue wash.
  const keys: { id: string; label: string; kind: string; onClick: () => void }[] = [
    { id: '7', label: '7', kind: 'num', onClick: () => digit('7') },
    { id: '8', label: '8', kind: 'num', onClick: () => digit('8') },
    { id: '9', label: '9', kind: 'num', onClick: () => digit('9') },
    { id: 'div', label: '÷', kind: 'op', onClick: () => chooseOp('÷') },
    { id: '4', label: '4', kind: 'num', onClick: () => digit('4') },
    { id: '5', label: '5', kind: 'num', onClick: () => digit('5') },
    { id: '6', label: '6', kind: 'num', onClick: () => digit('6') },
    { id: 'mul', label: '×', kind: 'op', onClick: () => chooseOp('×') },
    { id: '1', label: '1', kind: 'num', onClick: () => digit('1') },
    { id: '2', label: '2', kind: 'num', onClick: () => digit('2') },
    { id: '3', label: '3', kind: 'num', onClick: () => digit('3') },
    { id: 'sub', label: '−', kind: 'op', onClick: () => chooseOp('-') },
    { id: 'clear', label: 'C', kind: 'clear', onClick: clear },
    { id: '0', label: '0', kind: 'num', onClick: () => digit('0') },
    { id: 'back', label: '⌫', kind: 'back', onClick: back },
    { id: 'add', label: '+', kind: 'op', onClick: () => chooseOp('+') },
    { id: 'eq', label: '=', kind: 'eq', onClick: equals },
  ]

  return (
    <GameShell title={t('game.calc')} emoji="🧮" onExit={onExit} levels={{ gameId: 'calc', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="calc-modes">
        <button className={`pill pill-small ${mode === 'free' ? 'pill-active' : ''}`} onClick={() => chooseMode('free')}>
          🧮 {t('calc.free')}
        </button>
        <button className={`pill pill-small ${mode === 'goal' ? 'pill-active' : ''}`} onClick={() => chooseMode('goal')}>
          🎯 {t('calc.goal')}
        </button>
      </div>

      {mode === 'goal' && (
        <div className="calc-goal">
          <span className="calc-goal-label">{t('calc.make')}</span>
          <span className="calc-goal-target">{goal.target}</span>
          <span className="calc-goal-hint" aria-hidden="true" dir="ltr">
            💡 {goal.hint[0]} · {goal.hint[1]}
          </span>
        </div>
      )}

      <div className={`calc-stage ${wide ? 'is-wide' : ''}`}>
        {/* illustrated back plane — the numbers-family wooden playroom (in-repo
            CC0 art, see art/bg/LICENSES.md); the device sits on it, grounded. */}
        <SceneBackdrop src="wooden-playroom.jpg" position="center 42%" scrim="soft" />
        <div className={`calc-layout ${wide ? 'is-wide' : ''}`}>
          <div className="calc-panel">
            <div className="calc-reveal" key={reveal}>
              <NumberView value={value} scale={wide ? 0.85 : 0.5} />
            </div>
          </div>

          {/* a calculator keypad is always laid out LTR (7-8-9 left-to-right), in
              both languages. The whole pad is a baked physical device (body +
              recessed LCD + domed keys); CSS only lays it out + prints digits. */}
          <div className="calc-device" dir="ltr">
            <div className="calc-display">
              <span className="calc-history">{acc !== null && op ? `${acc} ${op}` : ''}</span>
              <span className="calc-current">{display}</span>
            </div>
            <div className="calc-grid">
              {keys.map((k) => (
                <button
                  key={k.id}
                  className={`calc-key calc-key-${k.kind}`}
                  onClick={k.onClick}
                  aria-label={k.label}
                >
                  <span className="calc-key-face">{k.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
