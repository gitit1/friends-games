import { useEffect, useState, memo, type CSSProperties } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playNudge, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendSay, friendColor } from '../friends'
import { numberWord, randInt, shuffle } from './util'
import { fitScale, useViewport } from '../useViewport'
import { useT } from '../i18n'
import { numberMax } from '../level'
import { useGameLevel } from '../gameLevel'

// "The missing number": a + ? = c — find the friend that fills the blank. Unlike
// "Build a Number" (which computes a result), here the RESULT is given and an
// addend is hidden, so it's the reverse / algebraic step. Tap the right friend →
// it fills the wooden SLOT and celebrates. Wrong tap just wiggles — no fail.
//
// The mechanic is FROZEN (makePuzzle keeps the a+b=c shape). This upgrade is
// presentation: baked wooden number TILES + a carved empty SLOT resting on a
// perspective wooden SHELF over an illustrated playroom — real materials + depth,
// no CSS boxes — plus the shared header difficulty control.

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// The header star control picks the level; it opens at the parent's global
// setting, then the child's choice sticks per game (src/gameLevel.ts).
// קל stays gentle (small results, 3 tiles); each step raises the result ceiling,
// and אלוף adds a 4th near-distractor tile — a real, still no-fail, challenge.
const LEVEL_TIERS = [0, 1, 2, 3]
const RESULT_HI = [6, 10, 14, 18] // highest result c per level (still capped by numberMax)
const N_CHOICES = [3, 3, 3, 4] // אלוף offers one extra near tile to weigh

type Puzzle = { a: number; b: number; c: number; missing: 'a' | 'b'; answer: number; choices: number[] }

function makePuzzle(level: number, prev?: number): Puzzle {
  const hi = Math.max(4, Math.min(RESULT_HI[level] ?? 18, numberMax())) // result stays within the level
  let c = randInt(4, hi)
  if (c === prev) c = c >= hi ? 4 : c + 1
  const a = randInt(1, c - 1)
  const b = c - a
  const missing: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b'
  const answer = missing === 'a' ? a : b
  // near distractors, valid (1..c-1), distinct; take as many as the level asks
  const want = N_CHOICES[level] ?? 3
  const pool = shuffle([-3, -2, -1, 1, 2, 3].map((d) => answer + d).filter((n) => n >= 1 && n <= c - 1 && n !== answer))
  const choices = shuffle([answer, ...pool.slice(0, want - 1)])
  return { a, b, c, missing, answer, choices }
}

// the friend + a crisp engraved number, mounted in a wooden tile's recessed panel
const TileFace = memo(function TileFace({ n, vp, big }: { n: number; vp: { w: number; h: number }; big: boolean }) {
  const idx = n - 1
  return (
    <>
      <span className="miss-tile-friend">
        <Friend index={idx} scale={fitScale(idx, vp, big ? 0.128 : 0.108, 0.1)} showNumber={false} lively />
      </span>
      <span className="miss-tile-num" style={{ '--c': friendColor(idx) } as CSSProperties}>
        {n}
      </span>
    </>
  )
})

export default function MissingNumber({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const [level] = useGameLevel('missing', LEVEL_TIERS)
  const [puz, setPuz] = useState<Puzzle>(() => makePuzzle(level))
  const [solved, setSolved] = useState(false)
  const [wrong, setWrong] = useState<number | null>(null)

  // a header level switch deals a fresh puzzle at the new range (skip the first
  // render — the initial puzzle is already dealt above).
  const [firstLevel] = useState({ v: true })
  useEffect(() => {
    if (firstLevel.v) {
      firstLevel.v = false
      return
    }
    setSolved(false)
    setWrong(null)
    setPuz(makePuzzle(level))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function pick(n: number) {
    if (solved) return
    unlockAudio()
    if (n === puz.answer) {
      setSolved(true)
      playWin()
      speak(`${numberWord(puz.answer)}! ${friendSay(puz.answer - 1)}!`)
    } else {
      setWrong(n)
      playNudge() // gentle wiggle, never a "wrong" penalty
      window.setTimeout(() => setWrong((w) => (w === n ? null : w)), 520)
    }
  }
  function next() {
    setSolved(false)
    setWrong(null)
    setPuz(makePuzzle(level, puz.c))
  }

  // an operand slot: its wooden tile, or a carved empty SLOT while it's the hidden one
  const slot = (which: 'a' | 'b') => {
    const value = which === 'a' ? puz.a : puz.b
    const hidden = puz.missing === which && !solved
    if (hidden)
      return (
        <span className="miss-tile is-slot" aria-hidden="true">
          <span className="miss-q">?</span>
        </span>
      )
    const justFilled = solved && puz.missing === which
    return (
      <span className={`miss-tile is-eq ${justFilled ? 'is-filled' : ''}`}>
        <TileFace n={value} vp={vp} big={false} />
      </span>
    )
  }

  return (
    <GameShell title={t('game.missing')} emoji="❓" onExit={onExit} levels={{ gameId: 'missing', tiers: LEVEL_TIERS }}>
      <Confetti active={solved} />
      <div className="miss-scene">
        {/* illustrated back plane — a warm wooden playroom (in-repo art, art/bg/LICENSES.md) */}
        <SceneBackdrop src="wooden-playroom.jpg" position="center 44%" scrim="soft" />
        {/* living light — a slow warm skylight sheen + a few drifting motes (calm;
            frozen under prefers-reduced-motion AND .reduce-motion). Zero JS/frame. */}
        <div className="miss-ambient" aria-hidden="true">
          <span className="miss-sheen" />
          <span className="miss-mote m1" />
          <span className="miss-mote m2" />
          <span className="miss-mote m3" />
        </div>

        <div className="miss-stage">
          <p className="miss-prompt" aria-hidden="true">
            {t('missing.prompt')}
          </p>

          {/* the equation on a RECEDED shelf (deeper = smaller + higher). Maths reads
              left-to-right in both languages, so this row is always ltr. */}
          <div className="miss-row is-eq">
            <div className="miss-eq" dir="ltr">
              {slot('a')}
              <span className="miss-op">+</span>
              {slot('b')}
              <span className="miss-op">=</span>
              <span className={`miss-tile is-eq is-result ${solved ? 'is-cheer' : ''}`}>
                <TileFace n={puz.c} vp={vp} big={false} />
              </span>
            </div>
            <span className="miss-shelf" aria-hidden="true" />
          </div>

          {/* the choice tiles on the NEAR shelf — grounded friends within the frame */}
          {!solved ? (
            <div className="miss-row is-choices">
              <div className="miss-choices">
                {puz.choices.map((n) => (
                  <button
                    key={n}
                    className={`miss-tile is-choice ${wrong === n ? 'is-wrong' : ''}`}
                    onClick={() => pick(n)}
                    aria-label={String(n)}
                  >
                    <TileFace n={n} vp={vp} big />
                  </button>
                ))}
              </div>
              <span className="miss-shelf" aria-hidden="true" />
            </div>
          ) : (
            <div className="miss-again">
              <button className="big-button" onClick={next}>
                🔄 {t('missing.new')}
              </button>
            </div>
          )}
        </div>
      </div>
    </GameShell>
  )
}
