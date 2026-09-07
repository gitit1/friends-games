import { useMemo, useState } from 'react'
import GameShell from '../components/GameShell'
import type { GameProps } from './registry'
import { playNudge, playSuccess, unlockAudio } from '../audio'

const CRITTERS = ['🐠', '🍎', '⭐', '🎈', '🐥', '🌸', '🐢', '🦋']

type Round = {
  critter: string
  count: number
  choices: number[]
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function makeRound(max: number): Round {
  const critter = CRITTERS[randInt(0, CRITTERS.length - 1)]
  const count = randInt(1, max)

  // Build three answer choices: the right one plus two nearby distractors.
  const choices = new Set<number>([count])
  while (choices.size < 3) {
    const candidate = count + randInt(-2, 2)
    if (candidate >= 1 && candidate <= max) choices.add(candidate)
  }
  // Pad in case the range was too small to find distractors.
  let pad = 1
  while (choices.size < 3) {
    if (pad <= max) choices.add(pad)
    pad++
  }

  return {
    critter,
    count,
    choices: [...choices].sort(() => Math.random() - 0.5),
  }
}

export default function CountingGame({ onExit }: GameProps) {
  const [max] = useState(5)
  const [round, setRound] = useState<Round>(() => makeRound(5))
  const [solved, setSolved] = useState(false)
  const [wrongChoice, setWrongChoice] = useState<number | null>(null)
  const [stars, setStars] = useState(0)

  const items = useMemo(() => Array.from({ length: round.count }), [round])

  function pick(value: number) {
    if (solved) return
    unlockAudio()
    if (value === round.count) {
      playSuccess()
      setSolved(true)
      setWrongChoice(null)
      setStars((s) => s + 1)
    } else {
      // Gentle nudge — highlight the wrong choice softly, no failure, keep trying.
      playNudge()
      setWrongChoice(value)
    }
  }

  function nextRound() {
    setRound(makeRound(max))
    setSolved(false)
    setWrongChoice(null)
  }

  return (
    <GameShell title="סופרים ביחד" emoji="🔢" onExit={onExit}>
      <div className="counting-stars" aria-label={`אספת ${stars} כוכבים`}>
        {'⭐'.repeat(Math.min(stars, 10))}
      </div>

      <p className="counting-prompt">כמה יש?</p>

      <div className="counting-stage" role="img" aria-label={`${round.count} ${round.critter}`}>
        {items.map((_, i) => (
          <span key={i} className="counting-item" style={{ animationDelay: `${i * 60}ms` }} aria-hidden="true">
            {round.critter}
          </span>
        ))}
      </div>

      {solved ? (
        <div className="counting-next">
          <div className="banner banner-success" role="status">
            יופי! יש {round.count} 🎉
          </div>
          <button className="big-button" onClick={nextRound}>
            ✨ עוד אחד
          </button>
        </div>
      ) : (
        <div className="counting-choices">
          {round.choices.map((choice) => (
            <button
              key={choice}
              className={`number-button ${wrongChoice === choice ? 'is-wrong' : ''}`}
              onClick={() => pick(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
    </GameShell>
  )
}
