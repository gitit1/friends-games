import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playNudge, playSuccess, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendColor, friendSay, friendSize } from '../friends'
import { numberWordNiqqud, randInt } from './util'
import { speakNumber } from '../voice'
import { screenScale, useViewport } from '../useViewport'
import { useT } from '../i18n'
import { numberMax } from '../level'
import { useGameLevel } from '../gameLevel'

// "Bigger / smaller / closest?" — two friends stand in the two pans of a real
// BALANCE SCALE (the ⚖️ the game already carries). Each friend IS its number, so
// the bigger number is the bigger friend AND the heavier pan, which DIPS: a
// language-free magnitude cue (the balance-scale metaphor is the strongest
// research-backed way to show "which is bigger" to a pre-symbolic child). A lit
// legend SHOWS the goal (big / small / closest) because words don't mean much to
// a non-reader. No timer; wrong taps give a gentle nudge — never a loss.
//
// FROZEN LOGIC: makeRound / sameQuestion / `correct` / pick are unchanged from the
// original — only the difficulty SOURCE (now the shared header star control) and
// the PRESENTATION (baked material scale, depth, grounded friends) are upgraded.
type Goal = 'big' | 'small' | 'near'
type Round = { a: number; b: number; goal: Goal; target: number }

// canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף, chosen via the header control.
const LEVEL_TIERS = [0, 1, 2, 3]
const RANGE = [10, 12, 16, 20] // friends 1..N by tier — index 0 (קל) = today's exact ceiling
// the pan DIP is a magnitude hint; it's strong at קל (the big one obviously sinks)
// and eased right down at אלוף, so the child must read the numbers/sizes — a real
// (still no-fail) challenge. Cumulative, קל stays as easy as today.
const TILT_GAIN = [1, 0.82, 0.62, 0.42]

function sameQuestion(p: Round, a: number, b: number, goal: Goal) {
  return p.goal === goal && Math.max(p.a, p.b) === Math.max(a, b) && Math.min(p.a, p.b) === Math.min(a, b)
}

function makeRound(maxn: number, allowNear: boolean, prev?: Round): Round {
  const a = randInt(1, maxn)
  let b = randInt(1, maxn)
  while (b === a) b = randInt(1, maxn)
  if (allowNear && Math.random() < 0.4) {
    let x = randInt(1, maxn)
    let guard = 0
    while (Math.abs(a - x) === Math.abs(b - x) && guard++ < 60) x = randInt(1, maxn)
    return { a, b, goal: 'near', target: x }
  }
  const goal: Goal = randInt(0, 1) === 0 ? 'big' : 'small'
  if (prev && sameQuestion(prev, a, b, goal)) return makeRound(maxn, allowNear, prev)
  return { a, b, goal, target: 0 }
}

export default function BigSmall({ onExit }: GameProps) {
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('bigsmall', LEVEL_TIERS)
  const maxn = Math.max(2, Math.min(RANGE[Math.min(3, level)], numberMax()))
  const allowNear = level >= 2
  const [round, setRound] = useState<Round>(() => makeRound(maxn, allowNear))
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [party, setParty] = useState(false) // confetti burst at every 5th in a row
  const vp = useViewport()
  const { t } = useT()

  const correct =
    round.goal === 'big'
      ? Math.max(round.a, round.b)
      : round.goal === 'small'
        ? Math.min(round.a, round.b)
        : Math.abs(round.a - round.target) < Math.abs(round.b - round.target)
          ? round.a
          : round.b

  const prompt =
    round.goal === 'big' ? t('bs.big') : round.goal === 'small' ? t('bs.small') : t('bs.near', { n: round.target })
  // spoken stays Hebrew (the app's voice is Hebrew) regardless of UI language
  const spoken =
    round.goal === 'near'
      ? `מי הכי קרוב ל-${numberWordNiqqud(round.target)}`
      : round.goal === 'big'
        ? 'מי הגדול?'
        : 'מי הקטן?'

  useEffect(() => {
    speak(spoken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  // switching difficulty from the header re-deals a fresh round at the new level
  // (skip the first render — the initial round is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setLocked(false)
    setWrong(null)
    setRound(makeRound(maxn, allowNear))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // ── PRESENTATION ONLY: the beam tips toward the HEAVIER (bigger) pan. Honest
  // physics — the bigger number is heavier, so it dips — and it never touches
  // `correct`. `round.a` is the LEFT pan, `round.b` the RIGHT pan; a positive
  // CSS rotation lowers the right end, so tip right when b is the bigger. ──
  const diff = Math.abs(round.a - round.b)
  const tilt = (round.a > round.b ? -1 : 1) * Math.min(9, 3 + diff * 0.8) * TILT_GAIN[Math.min(3, level)]

  // friend size ENCODES its number (bigger number → bigger friend) — a second,
  // congruent magnitude cue on top of the dip. Capped so both pans fit the stage.
  function scaleFor(n: number) {
    const px = Math.min(friendSize(n, 66, 10, 138) * screenScale(vp.w), vp.w * 0.27, vp.h * 0.22)
    return px / friendMaxDim(n - 1)
  }

  function pick(n: number) {
    if (locked) return
    unlockAudio()
    if (n === correct) {
      setLocked(true)
      const ns = score + 1
      setScore(ns)
      if (ns % 5 === 0) {
        playWin()
        speakNumber(ns)
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
      } else {
        playSuccess()
        speak(friendSay(n - 1))
      }
      window.setTimeout(() => {
        setRound((r) => makeRound(maxn, allowNear, r))
        setLocked(false)
      }, 950)
    } else {
      setWrong(n)
      playNudge()
      window.setTimeout(() => setWrong(null), 450)
    }
  }

  // one pan of the scale: cord + brass dish + the friend standing in it + a baked,
  // colour-tinted number tile. `n` is the friend's number; `side` is l | r.
  function Pan({ n, side }: { n: number; side: 'l' | 'r' }) {
    const isWin = locked && n === correct
    return (
      <button
        className={`bs-arm ${side} ${wrong === n ? 'is-wrong' : ''} ${isWin ? 'is-win' : ''}`}
        onClick={() => pick(n)}
        disabled={locked}
        aria-label={t('bs.friendAria', { n })}
      >
        <span className="bs-panwrap">
          <span className="bs-pan-img" aria-hidden="true" />
          <span className="bs-friend">
            <Friend index={n - 1} scale={scaleFor(n)} showNumber={false} bouncing={isWin} lively mood="smile" />
          </span>
          <span className="bs-tile" style={{ '--c': friendColor(n - 1) } as React.CSSProperties} aria-hidden="true">
            {n}
          </span>
        </span>
      </button>
    )
  }

  return (
    <GameShell
      title={t('game.bigsmall')}
      emoji="⚖️"
      onExit={onExit}
      levels={{ gameId: 'bigsmall', tiers: LEVEL_TIERS }}
    >
      <Confetti active={party} />
      <div className="bs-head">
        <span className="bs-prompt">{prompt}</span>
        <span className="score-pill" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>
      </div>

      {/* show the GOAL (what we're after) as baked tiles, not just words */}
      {round.goal === 'near' ? (
        <div className="bs-cue bs-cue-near" aria-hidden="true">
          <span className="bs-cue-target" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>
            <span className="bs-cue-bull">🎯</span>
            <span className="bs-cue-num">{round.target}</span>
          </span>
        </div>
      ) : (
        <div className="bs-cue" aria-hidden="true">
          <span className={`bs-cue-tile small ${round.goal === 'small' ? 'is-target' : ''}`}>
            <span className="bs-cue-word">{t('bs.cue.small')}</span>
          </span>
          <span className={`bs-cue-tile big ${round.goal === 'big' ? 'is-target' : ''}`}>
            <span className="bs-cue-word">{t('bs.cue.big')}</span>
          </span>
        </div>
      )}

      <button className="pill bs-say" onClick={() => speak(spoken)}>
        🔊 {t('bs.replay')}
      </button>

      {/* the balance-scale diorama: receding rug (depth) → post → pivoting beam →
          two pans, each a tappable choice with a grounded friend standing in it. */}
      <div className="bs-stage">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 42%" scrim="soft" />
        <span className="bs-rug" aria-hidden="true" />
        <div className="bs-scale">
          <span className="bs-post" aria-hidden="true" />
          <div className="bs-beam-pivot">
            <div className="bs-beam" style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}>
              <Pan n={round.a} side="l" />
              <Pan n={round.b} side="r" />
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
