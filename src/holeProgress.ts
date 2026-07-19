import { useSyncExternalStore } from 'react'

// How far the child has reached in the swallow game's world map. `maxLevel` is the
// highest UNLOCKED level (starts at 1). Finishing a level unlocks the next. Saved
// so the journey persists; never goes backward. No-fail — a "how far have I come"
// progress surface, not a gate that can be lost.

const KEY = 'assaf-games:holeMaxLevel'

function load(): number {
  try {
    const raw = localStorage.getItem(KEY)
    const n = raw ? parseInt(raw, 10) : 1
    return Number.isFinite(n) && n >= 1 ? n : 1
  } catch {
    return 1
  }
}

let maxLevel = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, String(maxLevel))
  } catch {
    // storage off — just won't persist
  }
}

export function getMaxLevel(): number {
  return maxLevel
}

/** Unlock up to `n` (idempotent; only ever grows). */
export function reachLevel(n: number) {
  if (n <= maxLevel) return
  maxLevel = n
  persist()
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useMaxLevel(): number {
  return useSyncExternalStore(subscribe, getMaxLevel, getMaxLevel)
}

// ---- "בולעים וסופרים" (counting mode) completion memory --------------------
// A tiny remembered ✓ per difficulty variant (0 קל · 1 בינוני · 2 קשה · 3 אלוף),
// so the home tile can show which counting rows the child has finished. Same
// conventions as maxLevel: load once, persist on change, never regress. A finished
// variant is only ever added — this is a "look how far I've come", not a gate.
const COUNT_KEY = 'assaf-games:holeCountDone'

function loadCount(): number[] {
  try {
    const raw = localStorage.getItem(COUNT_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : []
  } catch {
    return []
  }
}

let countDone = loadCount()
const countListeners = new Set<() => void>()

function persistCount() {
  try {
    localStorage.setItem(COUNT_KEY, JSON.stringify(countDone))
  } catch {
    // storage off — just won't persist
  }
}

export function getCountDone(): number[] {
  return countDone
}

/** Remember that the child finished the counting row for difficulty `diff` (idempotent). */
export function markCountDone(diff: number) {
  if (countDone.includes(diff)) return
  countDone = [...countDone, diff]
  persistCount()
  countListeners.forEach((fn) => fn())
}

function subscribeCount(fn: () => void) {
  countListeners.add(fn)
  return () => countListeners.delete(fn)
}

export function useCountDone(): number[] {
  return useSyncExternalStore(subscribeCount, getCountDone, getCountDone)
}
