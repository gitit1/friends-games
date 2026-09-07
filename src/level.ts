import { getSettings } from './settings'
import { FRIENDS } from './friends'
import { randInt } from './games/util'

// Single source of truth for the parent-configurable LEVEL: how high the numbers
// go and which arithmetic the child sees. Games read these instead of hard-coded
// ceilings / FRIENDS.length, so one Settings change re-levels the whole app.
export type Op = 'add' | 'sub' | 'mul' | 'div'

/** Highest number / friend the child sees in GAMES (1..maxNumber, capped to the
 *  real roster). Games should never present a number above this. */
export function numberMax(): number {
  return Math.max(1, Math.min(FRIENDS.length, getSettings().maxNumber))
}

/** Number of friends available to games (0-based indices 0..friendCount()-1). */
export function friendCount(): number {
  return numberMax()
}

/** A random friend index within the allowed range (for game picks). */
export function randFriendIndex(): number {
  return randInt(0, friendCount() - 1)
}

/** How many friends the "My Friends" roster shows. Capped to the level only when
 *  the parent opted in (limitRoster); otherwise the child can still meet all 100. */
export function rosterCount(): number {
  return getSettings().limitRoster ? numberMax() : FRIENDS.length
}

/** Enabled arithmetic operations, in canonical order. Never empty (if a parent
 *  turns everything off, addition stays so the games still work). */
export function enabledOps(): Op[] {
  const o = getSettings().ops
  const list = (['add', 'sub', 'mul', 'div'] as Op[]).filter((k) => o[k])
  return list.length ? list : ['add']
}

export function opEnabled(op: Op): boolean {
  return enabledOps().includes(op)
}
