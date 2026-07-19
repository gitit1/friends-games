import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playCount, playClap, playSuccess, playNudge, playWin, unlockAudio } from '../audio'
import { speak, stopSpeech } from '../speech'
import { speakNumber } from '../voice'
import { randInt, shuffle, numberWord, prefersReducedMotion } from './util'
import { numberMax, randFriendIndex } from '../level'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'

// ── מספר וכמות · "party invitations" ────────────────────────────────────────
// A host friend is throwing a party and needs exactly N guests for the table.
// Find the friend-GROUP that has that many, then TAP it → its members are
// counted one-by-one aloud (1… 2… 3…), lighting up as the count climbs. The
// counting IS the feedback AND the verification: the right group ends on the
// target, so the guests take their seats and the table is set; a wrong group is
// still lovely counting, then a gentle "let's try another group" (errorless —
// no penalty, tap again). A session = 5 tables set → "all the tables are full!"
// + a party sticker. No timer.
//
// SCENE (grounded, one warm room): a back wall with a soft flag-garland and one
// warm lamp light (upper-left), a receding wood floor, and a round party table
// in the foreground whose cloth occludes the seated guests' feet = grounded.
//
// PERF: the group members are the cheap COMPACT crowd tokens (~5 nodes each), so
// even 6 groups of 8 stay well under budget; the host is the one full friend.

// the four canonical tiers (קל · בינוני · קשה · אלוף) map straight through
const LEVEL_TIERS = [0, 1, 2, 3]
// biggest group a tier may show, and how many group-cards are on screen
const QMAX_FOR_TIER = [3, 5, 8, 8]
const GROUPS_FOR_TIER = [3, 4, 6, 6]
const TABLES_GOAL = 5 // a full party = 5 tables set
const PEAK_TABLE = 3 // the third table is the little peak
const TOKEN_PX = 30 // per-member compact token size (countable, not tiny)

type Group = { count: number; members: number[] }
type Round = { target: number; groups: Group[]; correct: number; spokenOnly: boolean }
type Counting = { group: number; lit: number } | null

const cluster = (count: number): number[] => Array.from({ length: count }, () => randFriendIndex())

function newRound(tier: number): Round {
  const spokenOnly = tier >= 3 // אלוף: the number is spoken only, never shown
  const qmax = Math.max(3, Math.min(QMAX_FOR_TIER[tier], numberMax()))
  const nGroups = Math.max(2, Math.min(GROUPS_FOR_TIER[tier], qmax))
  const target = randInt(1, qmax)

  const counts = new Set<number>([target])
  let guard = 0
  if (spokenOnly) {
    // אלוף: similar-sized groups clustered near the target — must count carefully
    while (counts.size < nGroups && guard++ < 300) {
      const d = target + randInt(1, 2) * (Math.random() < 0.5 ? -1 : 1)
      if (d >= 1 && d <= qmax) counts.add(d)
    }
  }
  guard = 0
  while (counts.size < nGroups && guard++ < 300) counts.add(randInt(1, qmax))
  for (let n = 1; n <= qmax && counts.size < nGroups; n++) counts.add(n) // tiny-range fallback

  const arr = shuffle([...counts]) // size === nGroups, always includes target
  const groups = arr.map((c) => ({ count: c, members: cluster(c) }))
  return { target, groups, correct: groups.findIndex((g) => g.count === target), spokenOnly }
}

/** one compact crowd token at a fixed pixel size (the cheap ~5-node friend) */
function Token({ index, counted }: { index: number; counted: boolean }) {
  return (
    <span className={`qty-mem ${counted ? 'is-counted' : ''}`}>
      <Friend index={index} scale={TOKEN_PX / friendMaxDim(index)} showNumber={false} compact />
    </span>
  )
}

export default function QtyMatch({ onExit }: GameProps) {
  const { t, say, lang } = useT()
  // the level comes from the shared per-game store, driven by the top-bar star
  // control (<LevelButton>) — a tap on the header reaches the game instantly and
  // the choice persists per game (src/gameLevel.ts).
  const [tier] = useGameLevel('quantity', LEVEL_TIERS)
  const [host] = useState(() => randFriendIndex()) // the party host — stable all session
  const [round, setRound] = useState<Round>(() => newRound(tier))
  const [tables, setTables] = useState(0) // tables set so far (session progress)
  const [phase, setPhase] = useState<'play' | 'counting' | 'seated' | 'done'>('play')
  const [counting, setCounting] = useState<Counting>(null)
  const [wrong, setWrong] = useState<number | null>(null)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => () => {
    clearTimers()
    stopSpeech()
  }, [])

  // switching difficulty from the header star deals a fresh party at the new
  // level (skip the very first render — the opening round is already set up).
  const firstTier = useRef(true)
  useEffect(() => {
    if (firstTier.current) {
      firstTier.current = false
      return
    }
    clearTimers()
    stopSpeech()
    setTables(0)
    setCounting(null)
    setWrong(null)
    setRound(newRound(tier))
    setPhase('play')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  // the spoken party request, said on every new round (and on the 🔊 replay)
  function sayRequest() {
    const num = lang === 'en' ? String(round.target) : numberWord(round.target)
    speak(`${say('qty.needSay')} ${num}`)
  }
  useEffect(() => {
    if (phase === 'play') sayRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  function pick(i: number) {
    if (phase !== 'play') return
    unlockAudio()
    const g = round.groups[i]
    setPhase('counting')
    setCounting({ group: i, lit: 0 })
    const reduce = prefersReducedMotion()
    // a calm, even cadence; a touch quicker for big groups so it never drags
    const step = reduce ? 240 : Math.max(430, 700 - g.count * 20)

    for (let k = 1; k <= g.count; k++) {
      timers.current.push(
        window.setTimeout(() => {
          setCounting({ group: i, lit: k })
          playCount(k)
          speakNumber(k)
        }, step * k),
      )
    }
    timers.current.push(window.setTimeout(() => resolve(i, g), step * (g.count + 1) + 120))
  }

  function resolve(i: number, g: Group) {
    if (g.count === round.target) {
      // right group — invitation delivered, the guests take their seats
      playSuccess()
      speak(say('qty.tableReady'))
      const next = tables + 1
      setTables(next)
      setPhase('seated')
      timers.current.push(window.setTimeout(() => playClap(), 480))
      if (next === PEAK_TABLE) timers.current.push(window.setTimeout(() => speak(say('qty.peak')), 900))
      if (next >= TABLES_GOAL) {
        timers.current.push(
          window.setTimeout(() => {
            playWin()
            speak(say('qty.allFull'))
            setPhase('done')
          }, 1500),
        )
      } else {
        timers.current.push(
          window.setTimeout(() => {
            setRound(newRound(tier))
            setCounting(null)
            setPhase('play')
          }, 1900),
        )
      }
    } else {
      // errorless — the counting was still lovely; gently suggest another group
      playNudge()
      setWrong(i)
      speak(say('qty.tryOther'))
      timers.current.push(
        window.setTimeout(() => {
          setWrong(null)
          setCounting(null)
          setPhase('play')
        }, 1000),
      )
    }
  }

  function again() {
    clearTimers()
    setTables(0)
    setCounting(null)
    setRound(newRound(tier))
    setPhase('play')
  }

  const correct = round.groups[round.correct]

  return (
    <GameShell
      title={t('game.quantity')}
      emoji="🎉"
      onExit={onExit}
      levels={{ gameId: 'quantity', tiers: LEVEL_TIERS }}
    >
      <div className="qty-screen center-body">
        {/* ── the grounded party room ─────────────────────────────────────── */}
        <div className={`qty-scene ${phase === 'seated' ? 'is-seated' : ''}`}>
          {/* static back layers: lamp glow + flag garland + receding floor */}
          <div className="qty-lamp" aria-hidden="true" />
          <div className="qty-garland" aria-hidden="true" />
          <div className="qty-floor" aria-hidden="true" />

          {/* the session progress — 5 little tables that fill as the party fills */}
          <div
            className="qty-progress"
            role="img"
            aria-label={t('qty.tables', { n: tables, g: TABLES_GOAL })}
          >
            {Array.from({ length: TABLES_GOAL }).map((_, i) => (
              <span key={i} className={`qty-dot ${i < tables ? 'is-full' : ''}`} aria-hidden="true">
                🍽️
              </span>
            ))}
          </div>

          {/* the host friend, standing on the stage behind the table */}
          <div className={`qty-host ${phase === 'seated' ? 'cheer' : ''}`}>
            <Friend
              index={host}
              scale={104 / friendMaxDim(host)}
              showNumber={false}
              lively
              bouncing={phase === 'seated'}
            />
          </div>

          {/* the hanging request sign — the number the party needs (or 🔊 at אלוף) */}
          <div className="qty-sign" aria-hidden="true">
            <span className="qty-sign-rope l" />
            <span className="qty-sign-rope r" />
            <span className="qty-sign-board">
              {phase === 'seated' ? (
                <span className="qty-sign-yay">🥳</span>
              ) : round.spokenOnly ? (
                <span className="qty-sign-ear">🔊</span>
              ) : (
                <b className="qty-sign-num" dir="ltr">
                  {round.target}
                </b>
              )}
            </span>
          </div>

          {/* the round party table (foreground) — guests take their seats on a set */}
          <div className="qty-table" aria-hidden="true">
            {phase === 'seated' && (
              <div className="qty-guests">
                {correct.members.map((f, k) => (
                  <span key={k} className="qty-guest" style={{ ['--i' as string]: k }}>
                    <Friend index={f} scale={30 / friendMaxDim(f)} showNumber={false} compact />
                  </span>
                ))}
              </div>
            )}
            <span className="qty-table-top">
              {phase === 'seated' && <span className="qty-clink" aria-hidden="true">🥂</span>}
            </span>
          </div>

          {/* the replay button — hear the party request again */}
          <button className="qty-replay" onClick={sayRequest} aria-label={t('bs.replay')}>
            🔊
          </button>
        </div>

        {/* ── the caption + the large group-cards (the action) ────────────── */}
        <p className="qty-caption">{t('qty.caption')}</p>
        <div className={`qty-groups n-${round.groups.length}`}>
          {round.groups.map((g, i) => (
            <button
              key={i}
              className={`qty-card ${wrong === i ? 'is-wrong' : ''} ${
                phase === 'seated' && i === round.correct ? 'is-win' : ''
              }`}
              onClick={() => pick(i)}
              disabled={phase !== 'play'}
              aria-label={t('qty.groupAria')}
            >
              <span
                className={`qty-badge ${
                  counting?.group === i && counting.lit === g.count ? 'is-total' : ''
                }`}
                aria-hidden="true"
              >
                {counting?.group === i ? counting.lit : ''}
              </span>
              <span className={`qty-cluster ${counting?.group === i ? 'is-counting' : ''}`}>
                {g.members.map((f, k) => (
                  <Token key={k} index={f} counted={counting?.group === i && k < counting.lit} />
                ))}
              </span>
            </button>
          ))}
        </div>

        {/* ── session complete ────────────────────────────────────────────── */}
        {phase === 'done' && (
          <div className="qty-done" role="dialog" aria-label={t('qty.done')}>
            <Confetti active />
            <span className="qty-sticker" aria-hidden="true">🎉</span>
            <p className="qty-done-title">{t('qty.done')}</p>
            <button className="big-button" onClick={again}>
              🔁 {t('qty.again')}
            </button>
          </div>
        )}
      </div>
    </GameShell>
  )
}
