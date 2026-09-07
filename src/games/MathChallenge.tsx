import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { randFriendIndex } from '../level'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playNudge, playSuccess, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendSay } from '../friends'
import { numberWord, randInt, shuffle } from './util'
import { speakNumber } from '../voice'
import { screenScale, useViewport } from '../useViewport'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'

// "אתגר חשבון" — multi-step expressions (a × b ± c) for a number-strong kid who
// already does combined operations in his head. Multiple choice, no timer; a
// wrong tap is a gentle nudge that just retries (NO-FAIL — never a loss).
//
// Commercial-quality skin over the SAME frozen mechanic: the question sits on a
// baked framed CHALK SLATE, the answers are baked CREAM flashcard tiles, and the
// friends are grounded on a receding wooden DESK inside a warm classroom
// (public/art/sprites/challenge + art/bg). Difficulty is the shared header star
// control — the number range grows cumulatively with the level.
type Op = '+' | '-'
type Level = { maxFactor: number; maxC: number; ops: Op[] }
// ── cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ──
// The frozen mechanic is untouched; each tier only widens the numbers. קל stays
// exactly as easy as today (× with a small + offset); אלוף is a real — still
// NO-FAIL — challenge with the biggest factors and the widest ± offset.
const LEVELS: Level[] = [
  { maxFactor: 5, maxC: 5, ops: ['+'] },
  { maxFactor: 9, maxC: 9, ops: ['+', '-'] },
  { maxFactor: 10, maxC: 12, ops: ['+', '-'] },
  { maxFactor: 12, maxC: 20, ops: ['+', '-'] },
]
const LEVEL_TIERS = [0, 1, 2, 3]

type Problem = { a: number; b: number; op: Op; c: number; answer: number; choices: number[] }

function makeChoices(answer: number): number[] {
  const set = new Set<number>([answer])
  let guard = 0
  while (set.size < 4 && guard < 300) {
    guard++
    const d = answer + randInt(1, 6) * (randInt(0, 1) === 0 ? -1 : 1)
    if (d >= 0) set.add(d)
  }
  let extra = 1
  while (set.size < 4) set.add(answer + extra++)
  return shuffle([...set])
}

function makeProblem(level: Level): Problem {
  const a = randInt(2, level.maxFactor)
  const b = randInt(2, level.maxFactor)
  const op = level.ops[randInt(0, level.ops.length - 1)]
  const prod = a * b
  const c = op === '-' ? randInt(1, Math.min(level.maxC, prod)) : randInt(1, level.maxC)
  const answer = op === '+' ? prod + c : prod - c
  return { a, b, op, c, answer, choices: makeChoices(answer) }
}

export default function MathChallenge({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const grow = screenScale(vp.w, 1.5)
  const [party, setParty] = useState(false)
  // per-game difficulty from the shared header star control (opens at the
  // parent's global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('challenge', LEVEL_TIERS)
  const [problem, setProblem] = useState<Problem>(() => makeProblem(LEVELS[level]))
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [mascot] = useState(() => randFriendIndex())
  const [watcher] = useState(() => randFriendIndex())

  function say(p: Problem = problem) {
    const opw = p.op === '+' ? 'ועוד' : 'פחות'
    speak(`${numberWord(p.a)} כפול ${numberWord(p.b)} ${opw} ${numberWord(p.c)}`)
  }

  useEffect(() => {
    say(problem)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem])

  // switching difficulty from the header deals a fresh in-range question (skip
  // the first render — the initial problem is already made above). This replaces
  // the old in-body level pills, now migrated to the top-bar <LevelButton>.
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    unlockAudio()
    setLocked(false)
    setWrong(null)
    setProblem(makeProblem(LEVELS[level]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function pick(n: number) {
    if (locked) return
    unlockAudio()
    if (n === problem.answer) {
      setLocked(true)
      const ns = score + 1
      setScore(ns)
      if (ns % 5 === 0) {
        playWin()
        speakNumber(ns) // calm milestone: announce the running count
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
      } else {
        playSuccess()
        speak(`${numberWord(problem.answer)}! ${friendSay(mascot)}`)
      }
      window.setTimeout(() => {
        setProblem(makeProblem(LEVELS[level]))
        setLocked(false)
      }, 1000)
    } else {
      // NO-FAIL: a soft nudge + a quick shake, then the choice re-arms.
      setWrong(n)
      playNudge()
      window.setTimeout(() => setWrong(null), 450)
    }
  }

  const sym = problem.op === '-' ? '−' : '+'

  return (
    <GameShell title={t('game.challenge')} emoji="🎓" onExit={onExit} levels={{ gameId: 'challenge', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="chal-screen">
        {/* the classroom stage: a warm illustrated room, a receding wooden DESK
            (baked, in perspective) the friends stand on, and one calm CSS ambient */}
        <div className="chal-scene">
          <SceneBackdrop src="wooden-playroom.jpg" position="center 32%" scrim="soft" />
          <div className="chal-ambient" aria-hidden="true">
            <span className="chal-sheen" />
            <span className="chal-mote m1" />
            <span className="chal-mote m2" />
            <span className="chal-mote m3" />
          </div>
          <span className="chal-score" aria-label={t('bs.score', { n: score })}>
            <span aria-hidden="true">⭐</span> {score}
          </span>
          <div className="chal-desk">
            <span className="chal-friend chal-friend-watch">
              <Friend
                index={watcher}
                scale={(58 / friendMaxDim(watcher)) * grow}
                showNumber={false}
                mood="smile"
                action={party ? 'hug' : null}
                bouncing={party}
              />
              <span className="chal-shadow" aria-hidden="true" />
            </span>
            <span className="chal-friend chal-friend-main">
              <Friend
                index={mascot}
                scale={(88 / friendMaxDim(mascot)) * grow}
                showNumber={false}
                mood="smile"
                lively
                bouncing={locked}
                action={party ? 'hug' : null}
              />
              <span className="chal-shadow" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* the QUESTION CARD — a baked framed chalk slate; the expression is crisp
            CSS chalk text engraved on top (one slate serves every question) */}
        <div className={`chal-card ${locked ? 'is-solved' : ''}`}>
          <div className="chal-expr" dir="ltr">
            <span className="chal-n">{problem.a}</span>
            <span className="chal-op">×</span>
            <span className="chal-n">{problem.b}</span>
            <span className="chal-op">{sym}</span>
            <span className="chal-n">{problem.c}</span>
            <span className="chal-eq">= ?</span>
          </div>
        </div>
        <button className="chal-say" onClick={() => say()}>
          🔊 {t('bs.replay')}
        </button>

        {/* the ANSWER TILES — baked cream flashcards, the number engraved in CSS */}
        <div className="chal-answers">
          {problem.choices.map((n) => (
            <button
              key={n}
              className={`chal-tile ${wrong === n ? 'is-wrong' : ''} ${locked && n === problem.answer ? 'is-right' : ''}`}
              onClick={() => pick(n)}
              disabled={locked}
            >
              <span className="chal-tile-num">{n}</span>
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  )
}
