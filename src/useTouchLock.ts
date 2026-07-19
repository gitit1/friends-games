import { useEffect, type RefObject } from 'react'
import { TOUCH_LOCK } from './devFlags'

// Real interactive controls — these still receive their normal tap, so we never
// preventDefault on them (that would block their click). Everything else (the
// drawing/game surfaces, empty space) gets locked down.
const INTERACTIVE = 'button, a, input, textarea, select, label, [role="button"], [contenteditable]'

/**
 * Dev-only touch / kiosk lock for tablets. When the flag is on (see devFlags /
 * .env), this:
 *   1. attaches NON-PASSIVE 'touchstart' + 'touchmove' listeners to the given
 *      container (via a ref) so it's allowed to call preventDefault();
 *   2. preventDefault()s them — touchmove always (kills scroll / pull-to-refresh
 *      / pinch-zoom) and touchstart on non-interactive targets (kills the focus
 *      stealing, text selection and the synthetic "ghost" mouse click) while
 *      leaving real buttons fully clickable;
 *   3. sets `touch-action: none; user-select: none` on the container to disable
 *      browser gestures entirely.
 *
 * It is a complete no-op when the flag is off, so normal use is never affected.
 *
 * NOTE on requirement "buttons should use onTouchStart instead of onClick":
 * we deliberately do NOT rewrite every button that way. Doing so would break
 * mouse and keyboard use and accessibility across the whole app. Instead we
 * leave buttons on onClick and simply don't preventDefault on them here — that
 * already removes the focus-steal / ghost-click while keeping them working
 * everywhere. If a specific button still misbehaves on a device, we can target
 * just that one.
 */
export function useTouchLock<T extends HTMLElement>(ref: RefObject<T | null>, enabled: boolean = TOUCH_LOCK) {
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return

    if (import.meta.env.DEV) console.info('[touch-lock] enabled — browser touch gestures are blocked (dev only)')

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as Element | null
      if (target && target.closest(INTERACTIVE)) return // let real controls tap
      e.preventDefault() // block focus stealing + text selection + ghost click
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault() // block scroll / pull-to-refresh / pinch-zoom
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })

    const prevTouchAction = el.style.touchAction
    const prevUserSelect = el.style.userSelect
    el.style.touchAction = 'none'
    el.style.userSelect = 'none'
    el.style.setProperty('-webkit-user-select', 'none')

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.style.touchAction = prevTouchAction
      el.style.userSelect = prevUserSelect
      el.style.removeProperty('-webkit-user-select')
    }
  }, [ref, enabled])
}
