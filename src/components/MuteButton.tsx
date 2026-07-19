import { updateSettings, useSettings } from '../settings'
import { playTap } from '../audio'
import { useT } from '../i18n'

// Quick MASTER mute on every screen's top bar. One tap silences EVERYTHING —
// the spoken clips AND the tap/effect sounds together (the owner expects the
// mute button to quiet the sounds that come from pressing things, not only the
// voice). Mirrors both the `voice` and `sound` settings, so it persists. Parents
// can still set voice/effects independently in Settings.
export default function MuteButton({ className = 'control-btn' }: { className?: string }) {
  const s = useSettings()
  const { t } = useT()
  const audible = s.voice || s.sound // anything currently making sound
  return (
    <button
      className={className}
      onClick={() => {
        const next = !audible // audible → silence all; fully muted → restore all
        updateSettings({ voice: next, sound: next })
        // the confirmation blip is heard only when turning sound back ON
        playTap()
      }}
      aria-label={audible ? t('mute.silence') : t('mute.unmute')}
      aria-pressed={!audible}
    >
      <span aria-hidden="true">{audible ? '🔊' : '🔇'}</span>
    </button>
  )
}
