import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playSuccess, playNudge, playWin, playTap, unlockAudio } from '../audio'
import { speakEn } from '../speech'
import { shuffle, randInt } from './util'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import { useT } from '../i18n'

// "Count in English" — a real numbers game for a number-loving child, in English.
// A bunch of things appear; the child can tap the 🔊 to count them out loud in
// English ("one, two, three…"), then picks the matching number. Right pick says
// the number in English and cheers; wrong is a gentle nudge (and counts them as a
// hint). He already reads numerals, so the new thing he learns is the English
// number WORDS. No timer, no losing. Levels raise the highest count.
const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
const ITEMS = ['🍎', '⭐', '🎈', '🐱', '🍓', '🐠', '🌸', '🍪']
const MAX_BY_LEVEL = [5, 10, 15, 20] // קל / בינוני / קשה / אלוף
const LEVEL_TIERS = [0, 1, 2, 3]

type Round = { n: number; emoji: string; choices: number[] }
function newRound(lvl: number): Round {
  const max = MAX_BY_LEVEL[lvl]
  const n = randInt(1, max)
  const emoji = ITEMS[Math.floor(Math.random() * ITEMS.length)]
  const pool = new Set<number>([n])
  while (pool.size < 3) pool.add(randInt(1, max))
  return { n, emoji, choices: shuffle([...pool]) }
}

export default function EnglishCount({ onExit }: GameProps) {
  const { t } = useT()
  const [lvl, setLvl] = useState(() => levelForTier(LEVEL_TIERS, getSettings().difficulty))
  const [round, setRound] = useState<Round>(() => newRound(lvl))
  const [score, setScore] = useState(0)
  const [lit, setLit] = useState(0) // how many items are "counted" (highlighted)
  const [wrong, setWrong] = useState<number | null>(null)
  const [solved, setSolved] = useState(false)
  const [party, setParty] = useState(false)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => clear, [])

  // count the items out loud in English, lighting each in turn
  function countAloud() {
    unlockAudio()
    clear()
    setLit(0)
    for (let i = 1; i <= round.n; i++) {
      later(() => {
        setLit(i)
        speakEn(EN[i])
      }, (i - 1) * 750)
    }
    later(() => setLit(0), round.n * 750 + 600)
  }

  function chooseLevel(next: number) {
    clear()
    playTap()
    setLvl(next)
    setScore(0)
    setLit(0)
    setWrong(null)
    setSolved(false)
    setParty(false)
    setRound(newRound(next))
  }

  function pick(c: number) {
    if (solved) return
    unlockAudio()
    if (c === round.n) {
      setSolved(true)
      setLit(round.n)
      const ns = score + 1
      setScore(ns)
      playSuccess()
      speakEn(`${EN[round.n]}!`)
      if (ns % 5 === 0) {
        setParty(true)
        later(() => setParty(false), 2200)
        later(() => playWin(), 200)
      }
      later(() => {
        setRound(newRound(lvl))
        setLit(0)
        setSolved(false)
      }, 1400)
    } else {
      setWrong(c)
      playNudge()
      countAloud() // gentle hint: count them together
      later(() => setWrong(null), 450)
    }
  }

  return (
    <GameShell title={t('game.encount')} emoji="🔢" onExit={onExit}>
      <Confetti active={party} />
      <div className="memory-controls">
        {LEVEL_TIERS.map((_, i) => (
          <button key={i} className={`pill ${i === lvl ? 'pill-active' : ''}`} onClick={() => chooseLevel(i)}>
            {t(`diff.${i}`)}
          </button>
        ))}
      </div>

      <div className="spell-screen center-body">
        <span className="score-pill" dir="ltr" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>

        <div className="ec-group" aria-hidden="true">
          {Array.from({ length: round.n }).map((_, i) => (
            <span key={i} className={`ec-item ${i < lit ? 'is-lit' : ''}`}>{round.emoji}</span>
          ))}
        </div>

        <button className="pill ec-count" onClick={countAloud}>
          🔊 {t('ec.count')}
        </button>

        <p className="fl-q" aria-hidden="true">{t('ec.q')}</p>

        <div className="math-choices" dir="ltr">
          {round.choices.map((c) => (
            <button
              key={c}
              className={`math-choice ${wrong === c ? 'is-wrong' : ''} ${solved && c === round.n ? 'is-right' : ''}`}
              onClick={() => pick(c)}
              disabled={solved}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  )
}
