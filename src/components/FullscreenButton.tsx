import { useEffect, useState } from 'react'
import { playTap } from '../audio'

// A fullscreen toggle for mobile. Rendered only on the home screen, so the
// button appears just on the opening screen (fullscreen stays on inside games).
// Hidden where the Fullscreen API isn't available (e.g. iOS Safari, which only
// allows fullscreen video — there, "Add to Home Screen" gives a fullscreen app).
type FsDoc = Document & {
  webkitFullscreenElement?: Element
  webkitExitFullscreen?: () => void
  webkitFullscreenEnabled?: boolean
}
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void }

function fsElement(d: FsDoc) {
  return d.fullscreenElement || d.webkitFullscreenElement || null
}

export default function FullscreenButton() {
  const [supported] = useState(() => {
    if (typeof document === 'undefined') return false
    // Check the actual request method exists (more reliable than
    // fullscreenEnabled, which some in-app browsers report false even when it
    // works). iOS Safari has neither for regular elements, so it stays hidden.
    const el = document.documentElement as FsEl
    return !!(el.requestFullscreen || el.webkitRequestFullscreen)
  })
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(!!fsElement(document as FsDoc))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    onChange()
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  if (!supported) return null

  function toggle() {
    playTap()
    const d = document as FsDoc
    if (fsElement(d)) {
      ;(d.exitFullscreen || d.webkitExitFullscreen)?.call(d)
    } else {
      const el = document.documentElement as FsEl
      ;(el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
    }
  }

  return (
    <button
      className="fullscreen-button"
      onClick={toggle}
      aria-label={active ? 'יציאה ממסך מלא' : 'מסך מלא'}
    >
      <span aria-hidden="true">{active ? '✕' : '⛶'}</span>
    </button>
  )
}
