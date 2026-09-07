import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendCount } from '../level'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playNudge, playSuccess, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendSay } from '../friends'
import { randInt, shuffle } from './util'
import { useGameLevel } from '../gameLevel'
import { screenScale, useViewport } from '../useViewport'
import { useT } from '../i18n'

// "מי נעלם?" — a little PUPPET THEATRE. A lineup of friends stands grounded on a
// baked wooden stage (real material + perspective, not a flat CSS row) against
// the playroom backdrop. The child taps when ready → a velvet curtain sweeps
// down over the whole stage (the child controls the timing, so there's NO time
// pressure), one friend ducks away behind a toy box, and the curtain lifts —
// who's missing? The options are the missing friend + friends that were NEVER on
// stage (a real memory task, not "spot the odd one"). No losing; a wrong pick is
// a gentle nudge. The proven mechanic is unchanged — only the scene, materials,
// depth, feel and the header difficulty are new.

const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף (chosen via the header star)
// how many friends stand on stage per level — MORE friends = a harder memory
// task (a real challenge at אלוף), while קל stays the roomy 3 it always was.
const FRIENDS_PER_LEVEL = [3, 4, 5, 6]
// a couple more decoy options among the answers as it climbs
const DECOYS_PER_LEVEL = [2, 2, 3, 3]
// the friends shrink a touch as the lineup grows, so all k still stand in one
// grounded row across a phone stage (feet on the boards, nothing clipped)
const FRIEND_PX = [66, 60, 54, 48]

type Phase = 'show' | 'hide' | 'guess'

function newGroup(k: number): number[] {
  return shuffle(Array.from({ length: friendCount() }, (_, i) => i)).slice(0, k)
}

// options: the missing friend + `count` friends drawn from `outsiders` (friends
// that were NOT in the group)
function pickChoices(missing: number, outsiders: number[], count: number): number[] {
  return shuffle([missing, ...shuffle(outsiders).slice(0, count)])
}

export default function WhoGame({ onExit }: GameProps) {
  const { t } = useT()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('who', LEVEL_TIERS)
  const k = FRIENDS_PER_LEVEL[level]

  const [group, setGroup] = useState<number[]>(() => newGroup(k))
  const [phase, setPhase] = useState<Phase>('show')
  const [missing, setMissing] = useState<number | null>(null)
  const [choices, setChoices] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const [party, setParty] = useState(false)

  const vp = useViewport()
  const scaleTo = (px: number, n: number) => (px * screenScale(vp.w)) / friendMaxDim(n)

  useEffect(() => {
    if (phase === 'guess') speak('מי נעלם?')
  }, [phase])

  function start(nk: number) {
    setPhase('show')
    setMissing(null)
    setChoices([])
    setSolved(false)
    setWrong(null)
    setGroup(newGroup(nk))
  }

  // switching difficulty from the header deals a fresh lineup at the new size
  // (skip the first render — the initial group is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    start(FRIENDS_PER_LEVEL[level])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function cover() {
    unlockAudio()
    if (phase !== 'show') return
    const m = group[randInt(0, group.length - 1)]
    const outsiders = Array.from({ length: friendCount() }, (_, i) => i).filter((i) => !group.includes(i))
    setMissing(m)
    setChoices(pickChoices(m, outsiders, DECOYS_PER_LEVEL[level]))
    setPhase('hide')
    window.setTimeout(() => setPhase('guess'), 850)
  }

  function pick(n: number) {
    if (phase !== 'guess' || solved) return
    unlockAudio()
    if (n === missing) {
      setSolved(true)
      const ns = score + 1
      setScore(ns)
      if (ns % 5 === 0) {
        playWin()
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
      } else playSuccess()
      speak(`${friendSay(n)}! כל הכבוד`)
      window.setTimeout(() => start(k), 1300)
    } else {
      setWrong(n)
      playNudge()
      window.setTimeout(() => setWrong(null), 450)
    }
  }

  const friendPx = FRIEND_PX[level]

  return (
    <GameShell title={t('game.who')} emoji="🙈" onExit={onExit} levels={{ gameId: 'who', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="who-head">
        <span className="who-score" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>
      </div>

      {/* the little theatre: illustrated playroom backdrop, a baked wooden stage
          the friends stand grounded on, and a velvet curtain that sweeps over */}
      <div className={`who-stage lvl-${level}`}>
        <SceneBackdrop src="wooden-playroom.jpg" position="center 30%" scrim="soft" />
        <div className="who-floor">
          <div className="who-row">
            {group.map((n, i) => {
              // the friend stays mounted the whole round (memoized → never
              // re-renders across phases); the missing spot swaps to a baked toy
              // box in the guess beat, and the friend pops back out on a right pick.
              const gap = phase === 'guess' && n === missing && !solved
              return (
                <span
                  className={`who-item ${gap ? 'is-gap' : ''} ${solved && n === missing ? 'is-back' : ''}`}
                  key={n}
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <span className="who-friend">
                    <Friend index={n} scale={scaleTo(friendPx, n)} bouncing={solved && n === missing} />
                  </span>
                  {gap && (
                    <span className="who-hidebox" aria-hidden="true">
                      <span className="who-q">?</span>
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
        {/* the velvet curtain drops over the whole stage for the hide beat, then
            lifts — the peekaboo reveal (transform only; frozen by reduce-motion) */}
        <span className={`who-curtain ${phase === 'hide' ? 'is-closed' : ''}`} aria-hidden="true" />
      </div>

      {phase === 'show' && (
        <button className="big-button who-cta" onClick={cover}>
          🎭 {t('who.cover')}
        </button>
      )}

      {phase === 'guess' && (
        <>
          <p className="who-prompt">{t('who.prompt')}</p>
          <div className="who-choices">
            {choices.map((n) => (
              <button
                key={n}
                className={`who-choice ${wrong === n ? 'is-wrong' : ''}`}
                onClick={() => pick(n)}
                disabled={solved}
                aria-label={t('bs.friendAria', { n: n + 1 })}
              >
                <Friend index={n} scale={scaleTo(72, n)} />
              </button>
            ))}
          </div>
        </>
      )}
    </GameShell>
  )
}
