import { useState } from 'react'
import GameShell from '../components/GameShell'
import type { GameProps } from './registry'
import { playNudge, playSuccess, unlockAudio } from '../audio'
import { speak } from '../speech'
import { WORDS, type WordItem } from './data/words'
import { pickOne, randInt, shuffle } from './util'

const PRAISE = ['כל הכבוד!', 'מצוין אסף!', 'יופי!', 'נכון מאוד!']

type Round = {
  target: WordItem
  choices: WordItem[]
}

function makeRound(): Round {
  const target = pickOne(WORDS)
  const others = shuffle(WORDS.filter((w) => w.word !== target.word)).slice(0, 2)
  return { target, choices: shuffle([target, ...others]) }
}

export default function WordsGame({ onExit }: GameProps) {
  const [round, setRound] = useState<Round>(() => makeRound())
  const [solved, setSolved] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [stars, setStars] = useState(0)

  function ask() {
    const next = makeRound()
    setRound(next)
    setSolved(false)
    setWrong(null)
    speak(`איפה ה${next.target.word}?`)
  }

  function repeat() {
    speak(`איפה ה${round.target.word}?`)
  }

  function pick(item: WordItem) {
    if (solved) return
    unlockAudio()
    if (item.word === round.target.word) {
      playSuccess()
      setSolved(true)
      setWrong(null)
      setStars((s) => s + 1)
      speak(`${round.target.word}! ${PRAISE[randInt(0, PRAISE.length - 1)]}`)
    } else {
      playNudge()
      setWrong(item.word)
    }
  }

  return (
    <GameShell title="חידון מילים" emoji="🗣️" onExit={onExit}>
      <div className="counting-stars" aria-label={`אספת ${stars} כוכבים`}>
        {'⭐'.repeat(Math.min(stars, 12))}
      </div>

      <button className="word-prompt" onClick={repeat} aria-label="שמעו שוב את המילה">
        <span aria-hidden="true">🔊</span> איפה ה{round.target.word}?
      </button>

      <div className="word-choices">
        {round.choices.map((item) => (
          <button
            key={item.word}
            className={`word-card ${wrong === item.word ? 'is-wrong' : ''} ${
              solved && item.word === round.target.word ? 'is-right' : ''
            }`}
            onClick={() => pick(item)}
            aria-label={item.word}
          >
            <span aria-hidden="true">{item.emoji}</span>
          </button>
        ))}
      </div>

      {solved && (
        <div className="counting-next">
          <div className="banner banner-success" role="status">
            {round.target.emoji} {round.target.word} 🎉
          </div>
          <button className="big-button" onClick={ask}>
            ✨ עוד אחד
          </button>
        </div>
      )}
    </GameShell>
  )
}
