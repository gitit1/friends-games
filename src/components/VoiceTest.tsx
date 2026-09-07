import { speak, speakName } from '../speech'
import { friendName, friendSay } from '../friends'
import { playFriend, unlockAudio } from '../audio'

// Dev-only voice check (route #/voicetest): tap to hear the recorded clips.
export default function VoiceTest({ onExit }: { onExit: () => void }) {
  const friends = Array.from({ length: 16 }, (_, i) => i)
  const nums = [1, 2, 3, 4, 5, 10, 20, 50, 100]
  const words = ['אכלתי', 'נם נם נם', 'יש!', 'אני שמח', 'תודה', 'שלום']
  const sayName = (i: number) => {
    unlockAudio()
    playFriend(i)
    speakName(friendSay(i))
  }
  const sayText = (text: string) => {
    unlockAudio()
    speak(text)
  }
  return (
    <div className="lab-page">
      <div className="lab-top">
        <button className="lab-home" onClick={onExit} aria-label="חזרה">
          ⬅️
        </button>
        <h2 className="lab-title">בדיקת קול 🔊</h2>
      </div>

      <h3 className="lab-row-title">שמות חברים</h3>
      <div className="test-voice-grid">
        {friends.map((i) => (
          <button key={i} className="test-voice-btn" onClick={() => sayName(i)}>
            {friendName(i)}
          </button>
        ))}
      </div>

      <h3 className="lab-row-title">מספרים</h3>
      <div className="test-voice-grid">
        {nums.map((n) => (
          <button key={n} className="test-voice-btn" onClick={() => sayText(String(n))}>
            {n}
          </button>
        ))}
      </div>

      <h3 className="lab-row-title">מילים</h3>
      <div className="test-voice-grid">
        {words.map((w) => (
          <button key={w} className="test-voice-btn" onClick={() => sayText(w)}>
            {w}
          </button>
        ))}
      </div>
    </div>
  )
}
