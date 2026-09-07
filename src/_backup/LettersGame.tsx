import { useState } from 'react'
import GameShell from '../components/GameShell'
import type { GameProps } from './registry'
import { playNudge, playSuccess, unlockAudio } from '../audio'
import { speak } from '../speech'
import { LETTERS, type LetterItem } from './data/letters'
import { pickOne, randInt, shuffle } from './util'

const PRAISE = ['כל הכבוד!', 'מצוין!', 'יופי אסף!', 'נכון!']

type Round = {
  item: LetterItem
  choices: string[]
}

function makeRound(): Round {
  const item = pickOne(LETTERS)
  const others = shuffle(LETTERS.filter((l) => l.letter !== item.letter)).slice(0, 2)
  const choices = shuffle([item.letter, ...others.map((o) => o.letter)])
  return { item, choices }
}

export default function LettersGame({ onExit }: GameProps) {
  const [round, setRound] = useState<Round>(() => makeRound())
  const [solved, setSolved] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [stars, setStars] = useState(0)

  function ask() {
    const next = makeRound()
    setRound(next)
    setSolved(false)
    setWrong(null)
    speak(`${next.item.word}. באיזו אות מתחילה המילה?`)
  }

  function say() {
    speak(round.item.word)
  }

  function pick(letter: string) {
    if (solved) return
    unlockAudio()
    if (letter === round.item.letter) {
      playSuccess()
      setSolved(true)
      setWrong(null)
      setStars((s) => s + 1)
      speak(`${round.item.word} מתחילה באות ${round.item.name}. ${PRAISE[randInt(0, PRAISE.length - 1)]}`)
    } else {
      playNudge()
      setWrong(letter)
    }
  }

  return (
    <GameShell title="חידון אותיות" emoji="🔤" onExit={onExit}>
      <div className="counting-stars" aria-label={`אספת ${stars} כוכבים`}>
        {'⭐'.repeat(Math.min(stars, 12))}
      </div>

      <p className="counting-prompt">באיזו אות מתחילה?</p>

      <button className="picture-stage" onClick={say} aria-label={`${round.item.word}, לחצו לשמוע`}>
        <span className="picture-emoji" aria-hidden="true">
          {round.item.emoji}
        </span>
        <span className="picture-hint" aria-hidden="true">🔊</span>
      </button>

      {solved ? (
        <div className="counting-next">
          <div className="banner banner-success" role="status">
            {round.item.letter} — {round.item.word} 🎉
          </div>
          <button className="big-button" onClick={ask}>
            ✨ עוד אחד
          </button>
        </div>
      ) : (
        <div className="counting-choices">
          {round.choices.map((letter) => (
            <button
              key={letter}
              className={`letter-button ${wrong === letter ? 'is-wrong' : ''}`}
              onClick={() => pick(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      )}
    </GameShell>
  )
}
