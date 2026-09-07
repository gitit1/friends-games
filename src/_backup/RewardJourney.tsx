import { useEffect, useState } from 'react'
import GameShell from './GameShell'
import type { GameProps } from '../games/registry'
import { playSuccess, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'

export type StoryCard = { emoji: string; text: string }

export type RewardJourneyConfig = {
  title: string
  emoji: string
  storageKey: string
  story: StoryCard[]
  doneLabel: string // big button: "I did it!"
  donePraise: string[] // spoken when a star is earned
  goal: number // stars needed for the big celebration
  celebrate: string // spoken at the goal
}

function loadCount(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

// A gentle motivational journey: a short social story plus a star chart the
// child fills up by succeeding (parent or child taps "I did it!").
// Shared by the diaper and pacifier games — each keeps its own saved progress.
export default function RewardJourney({ config, onExit }: { config: RewardJourneyConfig } & GameProps) {
  const [card, setCard] = useState(0)
  const [stars, setStars] = useState(() => loadCount(config.storageKey))
  const justWon = stars > 0 && stars % config.goal === 0

  useEffect(() => {
    try {
      localStorage.setItem(config.storageKey, String(stars))
    } catch {
      // Storage unavailable — progress just won't persist.
    }
  }, [stars, config.storageKey])

  function tellCard(i: number) {
    speak(config.story[i].text)
  }

  function nextCard() {
    unlockAudio()
    playTap()
    const next = (card + 1) % config.story.length
    setCard(next)
    tellCard(next)
  }

  function addStar() {
    unlockAudio()
    const next = stars + 1
    setStars(next)
    if (next % config.goal === 0) {
      playWin()
      speak(config.celebrate)
    } else {
      playSuccess()
      speak(config.donePraise[next % config.donePraise.length])
    }
  }

  function removeStar() {
    if (stars === 0) return
    playTap()
    setStars(stars - 1)
  }

  // How many stars to show in the current chart (resets visually each goal).
  const inThisRound = justWon ? config.goal : stars % config.goal
  const slots = Array.from({ length: config.goal }, (_, i) => i < inThisRound)

  return (
    <GameShell title={config.title} emoji={config.emoji} onExit={onExit}>
      {/* Social story card */}
      <button
        className="story-card"
        onClick={() => {
          unlockAudio()
          tellCard(card)
        }}
        aria-label={`${config.story[card].text}, לחצו לשמוע`}
      >
        <span className="story-emoji" aria-hidden="true">
          {config.story[card].emoji}
        </span>
        <span className="story-text">{config.story[card].text}</span>
        <span className="picture-hint" aria-hidden="true">🔊</span>
      </button>

      <div className="row-controls">
        <button className="pill" onClick={nextCard}>
          הסיפור הבא ➡️
        </button>
      </div>

      {/* Star chart */}
      <div className="reward-chart" aria-label={`${inThisRound} מתוך ${config.goal} כוכבים`}>
        {slots.map((filled, i) => (
          <span key={i} className={`reward-slot ${filled ? 'is-filled' : ''}`} aria-hidden="true">
            {filled ? '⭐' : '☆'}
          </span>
        ))}
      </div>

      {justWon && (
        <div className="banner banner-success" role="status">
          כל הכבוד אסף! ילד גדול! 🎉
        </div>
      )}

      <div className="counting-next">
        <button className="big-button reward-done" onClick={addStar}>
          {config.doneLabel}
        </button>
        <div className="reward-mini-controls">
          <span className="reward-total">סה״כ: {stars} ⭐</span>
          <button className="pill pill-small" onClick={removeStar} aria-label="הסרת כוכב אחרון">
            ↩️ ביטול
          </button>
        </div>
      </div>
    </GameShell>
  )
}
