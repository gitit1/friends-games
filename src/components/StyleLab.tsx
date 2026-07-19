import Friend from './Friend'
import AnimalArt, { ANIMAL_KINDS, ANIMAL_EMOJI, ANIMAL_NAMES } from './AnimalArt'

// A scratch page (route #/lab) to review the animal art at its 3 life stages, and
// to compare friend styles. Not part of the game.

const STAGES = [
  { s: 0, l: 'גור' },
  { s: 1, l: 'מתבגר' },
  { s: 2, l: 'בוגר' },
]

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lab-cell">
      <div className="lab-fig">{children}</div>
      <span className="lab-label">{label}</span>
    </div>
  )
}

export default function StyleLab({ onExit }: { onExit: () => void }) {
  return (
    <div className="lab-page">
      <div className="lab-top">
        <button className="lab-home" onClick={onExit} aria-label="חזרה">
          ⬅️
        </button>
        <h2 className="lab-title">בדיקת חיות 🐾</h2>
      </div>

      {ANIMAL_KINDS.map((k) => (
        <div key={k}>
          <h3 className="lab-row-title">
            {ANIMAL_EMOJI[k]} {ANIMAL_NAMES[k]}
          </h3>
          <div className="lab-row">
            {STAGES.map((st) => (
              <Cell key={st.s} label={st.l}>
                <span className="lab-anim">
                  <AnimalArt kind={k} stage={st.s} />
                </span>
              </Cell>
            ))}
          </div>
        </div>
      ))}

      {/* friends keep their 50-bump identity — shown for reference */}
      <h3 className="lab-row-title">⭐ חבר 50 (דנה)</h3>
      <div className="lab-row">
        <Cell label="חבר 50">
          <span className="lab-cur">
            <Friend index={50} scale={0.62} showNumber={false} />
          </span>
        </Cell>
      </div>
    </div>
  )
}
