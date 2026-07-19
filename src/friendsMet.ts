import { useSyncExternalStore } from 'react'

// Which friends the child has MET (collected) in the swallow game — a permanent,
// self-paced album (Pokédex / sticker-book style). Saved to localStorage and
// never lost: meeting a friend only ever adds, never removes. Autism-friendly —
// a calm "collect them all at your own pace" loop with no pressure.

const KEY = 'assaf-games:friendsMet'

function load(): Set<number> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch {
    return new Set()
  }
}

let met = load()
// a stable snapshot reference for useSyncExternalStore (changes identity only on update)
let snapshot = Array.from(met).sort((a, b) => a - b)
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // private mode / storage off — just won't persist, no crash
  }
}

export function getMetFriends(): number[] {
  return snapshot
}

export function hasMetFriend(index: number): boolean {
  return met.has(index)
}

/** Record meeting a friend (idempotent). Notifies subscribers + saves. */
export function markFriendMet(index: number) {
  if (met.has(index)) return
  met.add(index)
  snapshot = Array.from(met).sort((a, b) => a - b)
  persist()
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Sorted array of met friend indices; re-renders on change. */
export function useMetFriends(): number[] {
  return useSyncExternalStore(subscribe, getMetFriends, getMetFriends)
}
