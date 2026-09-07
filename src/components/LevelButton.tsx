import { useState } from 'react'
import { playTap } from '../audio'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'

// The site-standard difficulty control, piloted in the sports games: one round
// top-bar button (same physical look as 🏠/🔊) that shows the CURRENT level as
// 1–4 small stars — readable for a pre-reader, no text needed. Tapping it opens
// a calm little sheet with the four levels as large options (stars for the
// child + the Hebrew label for the parent, via the existing diff.* keys).
// Tapping outside closes. The chosen level goes through the shared per-game
// store (src/gameLevel.ts), so the game reacts instantly and the choice
// persists per game.

const STAR = `${import.meta.env.BASE_URL}art/sprites/star.png`

function Stars({ count, size }: { count: number; size: number }) {
  return (
    <span className={`level-stars n${count}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <img key={i} src={STAR} alt="" width={size} height={size} draggable={false} />
      ))}
    </span>
  )
}

export default function LevelButton({ gameId, tiers }: { gameId: string; tiers: number[] }) {
  const { t } = useT()
  const [level, setLevel] = useGameLevel(gameId, tiers)
  const [open, setOpen] = useState(false)
  return (
    <span className="level-anchor">
      <button
        className="control-btn level-btn"
        onClick={() => {
          playTap()
          setOpen((o) => !o)
        }}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t(`diff.${tiers[level]}`)}
      >
        <Stars count={level + 1} size={13} />
      </button>
      {open && (
        <>
          <span className="level-pop-backdrop" onClick={() => setOpen(false)} />
          <div className="level-pop" role="group">
            {tiers.map((tier, i) => (
              <button
                key={tier}
                className={`pill level-opt ${level === i ? 'pill-active' : ''}`}
                onClick={() => {
                  playTap()
                  setLevel(i)
                  setOpen(false)
                }}
              >
                <Stars count={i + 1} size={16} />
                <span className="level-opt-label">{t(`diff.${tier}`)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}
