import { useMemo, useState } from 'react'
import GameShell from '../components/GameShell'
import type { GameProps } from './registry'
import { playNudge, playSuccess, playWin } from '../audio'
import { speak } from '../speech'
import { ROUTINE } from './data/routine'
import { shuffle } from './util'

type Mode = 'play' | 'quiz'

// Build 3 answer choices for "what comes after step `index`": the real next
// step plus two other steps, shuffled.
function nextChoices(index: number) {
  const answer = ROUTINE[index + 1]
  const distractors = shuffle(ROUTINE.filter((_, i) => i !== index && i !== index + 1)).slice(0, 2)
  return shuffle([answer, ...distractors])
}

export default function RoutineGame({ onExit }: GameProps) {
  const [mode, setMode] = useState<Mode>('play')
  const [index, setIndex] = useState(0)
  const [wrong, setWrong] = useState<string | null>(null)

  const step = ROUTINE[index]
  const atEnd = index === ROUTINE.length - 1

  // Stable per step so tapping a wrong answer doesn't reshuffle the choices.
  const choices = useMemo(() => (atEnd ? [] : nextChoices(index)), [index, atEnd])

  function go(to: number) {
    setIndex(to)
    setWrong(null)
    speak(ROUTINE[to].say)
  }

  function start(nextMode: Mode) {
    setMode(nextMode)
    setIndex(0)
    setWrong(null)
    speak(ROUTINE[0].say)
  }

  function advance() {
    if (atEnd) {
      playWin()
      speak('כל הכבוד אסף! עברנו על כל היום')
      return
    }
    playSuccess()
    go(index + 1)
  }

  function pickNext(label: string) {
    if (label === ROUTINE[index + 1].label) {
      playSuccess()
      if (index + 1 === ROUTINE.length - 1) {
        // Show the final step, then it's the end.
        go(index + 1)
        window.setTimeout(() => {
          playWin()
          speak('כל הכבוד! סיימנו את היום')
        }, 700)
      } else {
        go(index + 1)
      }
    } else {
      playNudge()
      setWrong(label)
    }
  }

  return (
    <GameShell title="סדר היום" emoji="📅" onExit={onExit}>
      <div className="row-controls">
        <button className={`pill ${mode === 'play' ? 'pill-active' : ''}`} onClick={() => start('play')}>
          📅 סדר היום
        </button>
        <button className={`pill ${mode === 'quiz' ? 'pill-active' : ''}`} onClick={() => start('quiz')}>
          ❓ מה הבא?
        </button>
      </div>

      {/* Progress strip of the whole day. */}
      <div className="routine-strip" aria-hidden="true">
        {ROUTINE.map((s, i) => (
          <span
            key={s.label}
            className={`routine-chip ${i === index ? 'is-current' : ''} ${i < index ? 'is-done' : ''}`}
          >
            {s.emoji}
          </span>
        ))}
      </div>

      <button
        className="routine-current"
        onClick={() => speak(step.say)}
        aria-label={`${step.label}, לחצו לשמוע`}
      >
        <span className="routine-current-emoji" aria-hidden="true">
          {step.emoji}
        </span>
        <span className="routine-current-label">{step.label}</span>
        <span className="picture-hint" aria-hidden="true">🔊</span>
      </button>

      {mode === 'play' ? (
        <div className="counting-next">
          <button className="big-button" onClick={advance}>
            {atEnd ? '🎉 סיימנו!' : 'הבא ➡️'}
          </button>
          {index > 0 && (
            <button className="pill" onClick={() => go(0)}>
              🔄 מהתחלה
            </button>
          )}
        </div>
      ) : atEnd ? (
        <div className="counting-next">
          <div className="banner banner-success" role="status">
            סיימנו את היום! 🎉
          </div>
          <button className="big-button" onClick={() => start('quiz')}>
            🔄 עוד פעם
          </button>
        </div>
      ) : (
        <div className="counting-next">
          <p className="counting-prompt">מה עושים אחר כך?</p>
          <div className="word-choices">
            {choices.map((choice) => (
              <button
                key={choice.label}
                className={`word-card ${wrong === choice.label ? 'is-wrong' : ''}`}
                onClick={() => pickNext(choice.label)}
                aria-label={choice.label}
              >
                <span aria-hidden="true">{choice.emoji}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </GameShell>
  )
}
