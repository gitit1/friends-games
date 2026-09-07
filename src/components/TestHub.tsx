import { playTap, unlockAudio } from '../audio'

// Dev-only "test area" hub (route #/test), reached from the home 🧪 button.
// Links to the various try-out screens.
export default function TestHub({ onExit, go }: { onExit: () => void; go: (path: string) => void }) {
  const open = (path: string) => {
    unlockAudio()
    playTap()
    go(path)
  }
  const links: { path: string; emoji: string; label: string }[] = [
    { path: 'lab', emoji: '🐾', label: 'בדיקת חיות וסגנונות' },
    { path: 'gallery', emoji: '🖼️', label: 'בדיקת גלריה (תלת מימד)' },
    { path: 'voicetest', emoji: '🔊', label: 'בדיקת קול' },
  ]
  return (
    <div className="lab-page">
      <div className="lab-top">
        <button className="lab-home" onClick={onExit} aria-label="בית">
          🏠
        </button>
        <h2 className="lab-title">אזור בדיקות 🧪</h2>
      </div>
      <div className="test-links">
        {links.map((l) => (
          <button key={l.path} className="test-link" onClick={() => open(l.path)}>
            <span className="test-emoji">{l.emoji}</span>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}
