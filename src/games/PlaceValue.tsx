import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playRise, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendSay } from '../friends'
import { numberWord, randInt } from './util'
import { fitScale, useViewport } from '../useViewport'
import { useT } from '../i18n'
import { numberMax } from '../level'
import { useGameLevel } from '../gameLevel'

// Build a two-digit number from TEN-rods and ONE-cubes — place value the
// Numberblocks "Tens" way. A live "X tens + Y ones = N" updates as you build, and
// the matching friend wakes up. No timer, no wrong answers — over/undershoot just
// adjusts. Distinct from "Build a Number" (a±×÷b) and from counting.
//
// The blocks are BAKED base-ten material tokens (public/art/sprites/placevalue):
// a slate-blue stained-wood tens rod of ten unit segments + a warm honey-wood
// unit cube, resting on a perspective felt work-mat inside a warm playroom.

const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף (chosen via the header star)
// Cumulative target ceiling per level (אלוף = everything up to 99), always capped
// by the parent's global numberMax. The floor stays 11 so gentle teens still turn
// up at every level — קל is exactly as easy as before, אלוף a real (no-fail) reach.
const LEVEL_MAX = [19, 39, 69, 99]
function rangeFor(level: number) {
  const max = Math.min(numberMax(), LEVEL_MAX[level] ?? 99)
  return { min: Math.min(11, max), max }
}
function pickTarget(level: number, avoid?: number) {
  const { min, max } = rangeFor(level)
  let n = randInt(min, max)
  if (n === avoid) n = n >= max ? min : n + 1
  return n
}

export default function PlaceValue({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('placevalue', LEVEL_TIERS)
  const [target, setTarget] = useState(() => pickTarget(level))
  const [tens, setTens] = useState(0)
  const [ones, setOnes] = useState(0)
  const current = tens * 10 + ones
  const done = current === target

  // switching difficulty from the header rolls a fresh target in the new range
  // (skip the first render — the initial target is already picked above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setTens(0)
    setOnes(0)
    setTarget(pickTarget(level))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const [pop, setPop] = useState(false)
  const popTimer = useRef<number | undefined>(undefined)
  function bump() {
    setPop(true)
    window.clearTimeout(popTimer.current)
    popTimer.current = window.setTimeout(() => setPop(false), 280)
  }

  function react(now: number, added: boolean, riseIdx: number) {
    if (now === target) {
      playWin()
      speak(`${numberWord(target)}! ${friendSay(target - 1)}!`)
    } else if (added) {
      playRise(riseIdx % 8) // climbing notes as it grows
    } else {
      playTap()
    }
  }
  function changeTens(d: number) {
    if (done) return
    const next = Math.max(0, Math.min(9, tens + d))
    if (next === tens) return
    unlockAudio()
    setTens(next)
    bump()
    react(next * 10 + ones, d > 0, next - 1)
  }
  function changeOnes(d: number) {
    if (done) return
    const next = Math.max(0, Math.min(9, ones + d))
    if (next === ones) return
    unlockAudio()
    setOnes(next)
    bump()
    react(tens * 10 + next, d > 0, tens + next - 1)
  }

  function newTarget() {
    setTens(0)
    setOnes(0)
    setTarget((prev) => pickTarget(level, prev))
  }

  return (
    <GameShell
      title={t('game.placevalue')}
      emoji="🔟"
      onExit={onExit}
      levels={{ gameId: 'placevalue', tiers: LEVEL_TIERS }}
    >
      <Confetti active={done} />
      <p className="count-target" aria-hidden="true">
        {t('pv.make')} <strong>{target}</strong>
      </p>

      {/* the build DIORAMA — a warm playroom, a perspective felt work-mat, the
          friend helper grounded at the back, and the baked base-ten tokens resting
          on the mat in front. Static + one gentle mote drift (calm/perf doctrine). */}
      <div className="pv-scene">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 20%" scrim="soft" />
        <div className="pv-ambient" aria-hidden="true">
          <span className="pv-mote m1" />
          <span className="pv-mote m2" />
          <span className="pv-mote m3" />
        </div>
        <div className="pv-mat" aria-hidden="true" />

        {/* the friend wakes up (litUnits) as the number is built — grounded with a
            contact shadow, feet resting on the mat behind the tokens */}
        <div className="pv-helper" aria-hidden="true">
          <Friend
            index={target - 1}
            // damp by bead-count (beads pack in 2D, so √) so a big-number friend
            // still fits IN FRAME with its feet on the mat — not just the kind's
            // natural box, which ignores how many beads a 90s friend actually has.
            scale={fitScale(target - 1, vp, 0.4, 0.17) * Math.min(1, Math.sqrt(20 / target))}
            litUnits={current > target ? target : current}
            bouncing={done || pop}
            lively
          />
        </div>

        {/* base-ten tokens on the mat. direction:ltr keeps TENS on the left and
            ONES on the right — like the written number — in Hebrew and English. */}
        <div className="pv-zones" aria-hidden="true">
          <div className="pv-zone">
            <span className="pv-zone-label">{t('pv.tens')}</span>
            <div className="pv-rods">
              {tens === 0 ? (
                <span className="pv-empty">0</span>
              ) : (
                Array.from({ length: tens }).map((_, i) => (
                  <span className={`pv-rod ${pop && i === tens - 1 ? 'pv-in' : ''}`} key={i} />
                ))
              )}
            </div>
          </div>
          <div className="pv-zone">
            <span className="pv-zone-label">{t('pv.ones')}</span>
            <div className="pv-cubes">
              {ones === 0 ? (
                <span className="pv-empty">0</span>
              ) : (
                Array.from({ length: ones }).map((_, i) => (
                  <span className={`pv-cube ${pop && i === ones - 1 ? 'pv-in' : ''}`} key={i} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pv-eq" aria-live="polite">
        <strong>{tens}</strong> {t('pv.tens')} + <strong>{ones}</strong> {t('pv.ones')} ={' '}
        <strong className={done ? 'pv-eq-done' : ''}>{current}</strong>
        {done && ' 🎉'}
      </div>

      {/* on completion the steppers become a single "new number" button — no extra
          banner; the confetti + waking friend + green equation say "done!" */}
      {done ? (
        <div className="pv-controls">
          <button className="big-button" onClick={newTarget}>
            🔄 {t('pv.new')}
          </button>
        </div>
      ) : (
        <div className="pv-controls">
          <div className="pv-stepper">
            <button className="btn-utility" onClick={() => changeTens(-1)} aria-label={`−10 ${t('pv.tens')}`}>
              ➖
            </button>
            <span className="pv-stepper-label">{t('pv.tens')}</span>
            <button className="btn-utility" onClick={() => changeTens(1)} aria-label={`+10 ${t('pv.tens')}`}>
              ➕
            </button>
          </div>
          <div className="pv-stepper">
            <button className="btn-utility" onClick={() => changeOnes(-1)} aria-label={`−1 ${t('pv.ones')}`}>
              ➖
            </button>
            <span className="pv-stepper-label">{t('pv.ones')}</span>
            <button className="btn-utility" onClick={() => changeOnes(1)} aria-label={`+1 ${t('pv.ones')}`}>
              ➕
            </button>
          </div>
        </div>
      )}
    </GameShell>
  )
}
