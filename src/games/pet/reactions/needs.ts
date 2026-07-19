import type { NeedLevel } from './reactionTypes'

// Need thresholds (so rules never use magic numbers).
//   critical 0–20 · low 21–40 · medium 41–70 · high 71–90 · full 91–100
export const THRESH = { critical: 20, low: 40, medium: 70, high: 90 } as const

export function getNeedLevel(v: number): NeedLevel {
  if (v <= THRESH.critical) return 'critical'
  if (v <= THRESH.low) return 'low'
  if (v <= THRESH.medium) return 'medium'
  if (v <= THRESH.high) return 'high'
  return 'full'
}

export const isCritical = (v: number) => v <= THRESH.critical
export const isLow = (v: number) => v <= THRESH.low
export const isMedium = (v: number) => v > THRESH.low && v <= THRESH.medium
export const isFull = (v: number) => v > THRESH.high // 91–100

// time helpers (ms)
export const MIN = 60_000
export const minutesSince = (then: number | undefined, now: number) =>
  then === undefined ? Infinity : (now - then) / MIN
