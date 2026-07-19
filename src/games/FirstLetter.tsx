import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import { LetterGuy } from './LetterGuy'
import type { GameProps } from './registry'
import { playSuccess, playNudge, playWin, playTap, unlockAudio } from '../audio'
import { speakEn } from '../speech'
import { shuffle } from './util'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import { useT } from '../i18n'
import { POOLS, LEVEL_TIERS, pickWord } from './englishWords'

// "First letter" (English phonics) — a picture appears and is named in English;
// the child taps which letter it STARTS with, from a few choices. Applies letter
// knowledge (a step beyond reciting the ABC). No timer, no losing: a wrong letter
// gives a gentle nudge; the right one cheers and says the letter + word. More
// choices at higher levels. Words come from the shared cumulative pools.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const CHOICES_BY_LEVEL = [3, 4, 5, 6] // how many letter options per level

type Round = { word: string; emoji: string; answer: string; choices: string[] }

function newRound(lvl: number): Round {
  const item = POOLS[lvl][pickWord(lvl)]
  const answer = item.word[0]
  const n = CHOICES_BY_LEVEL[lvl]
  const distractors = shuffle(ALPHABET.filter((c) => c !== answer)).slice(0, n - 1)
  return { word: item.word, emoji: item.emoji, answer, choices: shuffle([answer, ...distractors]) }
}

export default function FirstLetter({ onExit }: GameProps) {
  const { t } = useT()
  const [lvl, setLvl] = useState(() => levelForTier(LEVEL_TIERS, getSettings().difficulty))
  const [round, setRound] = useState<Round>(() => newRound(lvl))
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [party, setParty] = useState(false)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  // name the picture in English each round so the child can sound out its start
  useEffect(() => {
    const id = window.setTimeout(() => speakEn(round.word), 350)
    timers.current.push(id)
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  function chooseLevel(nextLvl: number) {
    clear()
    playTap()
    setLvl(nextLvl)
    setScore(0)
    setSolved(false)
    setWrong(null)
    setParty(false)
    setRound(newRound(nextLvl))
  }

  function sayWord() {
    unlockAudio()
    speakEn(round.word)
  }

  function pick(letter: string) {
    if (solved) return
    unlockAudio()
    if (letter === round.answer) {
      setSolved(true)
      const ns = score + 1
      setScore(ns)
      playSuccess()
      speakEn(`${round.answer}. ${round.word}`) // the letter, then the whole word
      if (ns % 5 === 0) {
        setParty(true)
        later(() => setParty(false), 2200)
        later(() => playWin(), 200)
      }
      later(() => {
        setRound(newRound(lvl))
        setSolved(false)
      }, 1300)
    } else {
      setWrong(letter)
      playNudge()
      later(() => setWrong(null), 450)
    }
  }

  return (
    <GameShell title={t('game.firstletter')} emoji="🔡" onExit={onExit}>
      <Confetti active={party} />
      <div className="memory-controls">
        {LEVEL_TIERS.map((_, i) => (
          <button key={i} className={`pill ${i === lvl ? 'pill-active' : ''}`} onClick={() => chooseLevel(i)}>
            {t(`diff.${i}`)}
          </button>
        ))}
      </div>

      <div className="spell-screen center-body">
        <span className="score-pill" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>

        <button className="spell-pic" onClick={sayWord} aria-label={t('spell.hear')}>
          <span aria-hidden="true">{round.emoji}</span>
        </button>

        <p className="fl-q" aria-hidden="true">{t('fl.q')}</p>

        <div className="spell-tray ll-tray" dir="ltr">
          {round.choices.map((c) => (
            <button
              key={c}
              className={`ll-tile ${wrong === c ? 'is-wrong' : ''} ${solved && c === round.answer ? 'is-right' : ''}`}
              onClick={() => pick(c)}
              disabled={solved}
              aria-label={c}
            >
              <LetterGuy ch={c} className="idle" />
            </button>
          ))}
        </div>

        <button className="pill spell-say" onClick={sayWord}>
          🔊 {t('spell.hear')}
        </button>
      </div>
    </GameShell>
  )
}
