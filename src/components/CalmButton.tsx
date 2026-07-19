import { openCalm } from '../calmMode'
import { playTap, unlockAudio } from '../audio'
import { useT } from '../i18n'

// A small, soft, semi-transparent ☁️ button that lives beside the other
// utility buttons in every top bar (GameShell / home / category screen). One
// tap opens the full-screen "רגע של רוגע" calm overlay ABOVE whatever's on
// screen right now — see CalmOverlay.tsx + calmMode.ts. Deliberately quieter
// than the dark .control-btn circles around it (calm, not another loud icon)
// so it never competes with the game/content for attention.
export default function CalmButton({ className = 'control-btn calm-btn' }: { className?: string }) {
  const { t } = useT()
  return (
    <button
      className={className}
      onClick={() => {
        unlockAudio()
        playTap()
        openCalm()
      }}
      aria-label={t('calm.button.aria')}
    >
      <span aria-hidden="true">☁️</span>
    </button>
  )
}
