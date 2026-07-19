import { useState } from 'react'
import GameShell from './GameShell'
import Friend from './Friend'
import { friendMaxDim } from './FriendArt'
import { friendName, friendSay } from '../friends'
import { friendCount } from '../level'
import { playClip } from '../voice'
import { unlockAudio } from '../audio'

// "Pop-up depth" view: the EXISTING 2D friend, but its layers (face, arms, feet,
// number) floated apart in 3D inside a perspective stage, gently swaying so you
// get real parallax. No remodelling — it's the same art the child already knows.
export default function FriendDepth({ onExit, start }: { onExit: () => void; start?: number }) {
  const [index, setIndex] = useState(() =>
    Number.isInteger(start) && (start as number) >= 0 && (start as number) < friendCount() ? (start as number) : 0,
  )
  const step = (d: number) => setIndex((i) => (i + d + friendCount()) % friendCount())
  const hi = () => {
    unlockAudio()
    playClip(`intro-${index}`, friendSay(index))
  }
  const scale = 250 / friendMaxDim(index)

  return (
    <GameShell title={`${friendName(index)} · תלת מימד`} emoji="🧊" onExit={onExit}>
      <div className="depth-screen">
        <div className="depth-stage">
          {/* no floating number badge here — at this size it climbs over the page
              title; the number shows in the caption below instead */}
          <Friend index={index} scale={scale} interactive lively showNumber={false} />
        </div>
        <div className="three-stepper">
          <button className="three-arrow" onClick={() => step(-1)} aria-label="הקודם">
            ◀
          </button>
          <span className="three-name">
            {friendName(index)} · {index + 1}
          </span>
          <button className="three-arrow" onClick={() => step(1)} aria-label="הבא">
            ▶
          </button>
        </div>
        <div className="world-actions">
          <button className="world-btn" onClick={hi}>
            <span className="world-btn-emoji" aria-hidden="true">🔊</span>
            <span>שלום</span>
          </button>
        </div>
      </div>
    </GameShell>
  )
}
