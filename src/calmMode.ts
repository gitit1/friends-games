import { useSyncExternalStore } from 'react'

// A tiny global on/off flag for the site-wide "רגע של רוגע" (a moment of
// calm) overlay — see components/CalmOverlay.tsx. It's rendered ABOVE
// whatever screen/game is currently on screen (not instead of it), so opening
// and closing it never unmounts the game underneath — nothing is lost, like
// the stop&go freeze concept. No persistence on purpose: it's a momentary
// tool the child reaches for, not a setting, so it always starts closed.
let open = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((fn) => fn())
}

export function openCalm() {
  open = true
  emit()
}

export function closeCalm() {
  open = false
  emit()
}

function getSnapshot() {
  return open
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCalmOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
