import { useEffect, useRef, useState } from 'react'
import { closeCalm, useCalmOpen } from '../calmMode'
import { playTap, unlockAudio } from '../audio'
import { speak, stopSpeech } from '../speech'
import { playClip } from '../voice'
import { useT } from '../i18n'

// "רגע של רוגע" — a global calm corner, reachable from every screen via
// CalmButton. It sits ABOVE the current game (App.tsx renders it as a sibling
// of the routed screen, never in place of it), so the game underneath stays
// mounted exactly as it was — closing always returns to it with nothing lost,
// the same idea as the potty game's stop&go freeze.
//
// The breathing guide reuses the Feelings toolbox's cadence and voice lines
// (~4s in / ~5s out, `feel.in` / `feel.out`) rather than a new one — see
// games/Feelings.tsx's own 'breathe' phase for the sibling implementation.
// No timer, no goal: the cue loop just keeps going until the child taps
// "חוזרים למשחק".
export default function CalmOverlay() {
  const open = useCalmOpen()
  const { t } = useT()
  const [cue, setCue] = useState<'in' | 'out'>('in')
  const spokenFirst = useRef(false)

  useEffect(() => {
    if (!open) return
    unlockAudio()
    spokenFirst.current = false
    setCue('in')
    playClip('calm-say-open', t('calm.say.open'))
    const start = Date.now()
    const iv = window.setInterval(() => {
      const el = (Date.now() - start) / 1000
      setCue(el % 9 < 4 ? 'in' : 'out')
    }, 250)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // speak each breath cue as it changes — skip the very first tick (already
  // covered by the welcome line above) so the two never talk over each other
  useEffect(() => {
    if (!open) return
    if (!spokenFirst.current) {
      spokenFirst.current = true
      return
    }
    speak(t(cue === 'in' ? 'feel.in' : 'feel.out'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue])

  if (!open) return null

  function close() {
    unlockAudio()
    stopSpeech()
    playTap()
    closeCalm()
  }

  return (
    <div className="calm-overlay" role="dialog" aria-modal="true" aria-label={t('calm.title')}>
      <div className="calm-card">
        <span className="calm-cloud" aria-hidden="true">☁️</span>
        <h2 className="calm-title">{t('calm.title')}</h2>
        <p className="calm-bubble" key={cue}>{t(cue === 'in' ? 'feel.in' : 'feel.out')}</p>
        <div className="calm-breathe-box">
          <span className={`calm-breathe-fig calm-cue-${cue}`} aria-hidden="true">
            🌸
          </span>
        </div>
        <button className="btn-secondary calm-close" onClick={close}>
          {t('calm.close')}
        </button>
      </div>
    </div>
  )
}
