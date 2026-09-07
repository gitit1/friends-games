import { useSyncExternalStore } from 'react'

// Saved-music collections for the musicians decade — the "band shelf" (#61) and
// the "pattern book" (#62). Same conventions as holeProgress.ts: load once,
// persist on change, never regress. Cumulative "look what I made" shelves, not
// gates that can be lost. A saved item is only ever ADDED.

// A saved band lineup: the friend index sitting on each stage spot (or null for
// an empty spot), newest first.
export type SavedBand = { id: number; spots: (number | null)[] }
// A saved rhythm pattern: the block id in each track slot (or null), per track.
export type SavedPattern = { id: number; tracks: (string | null)[][] }

function makeStore<T>(key: string, isValid: (v: unknown) => boolean) {
  function load(): T[] {
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? (arr.filter(isValid) as T[]) : []
    } catch {
      return []
    }
  }
  let items = load()
  const listeners = new Set<() => void>()
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify(items))
    } catch {
      /* storage off — just won't persist */
    }
  }
  return {
    get: () => items,
    add(item: T) {
      items = [...items, item]
      persist()
      listeners.forEach((fn) => fn())
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

const bandStore = makeStore<SavedBand>(
  'assaf-games:bandShelf',
  (v) => !!v && typeof v === 'object' && Array.isArray((v as SavedBand).spots),
)
const patternStore = makeStore<SavedPattern>(
  'assaf-games:patternBook',
  (v) => !!v && typeof v === 'object' && Array.isArray((v as SavedPattern).tracks),
)

export function saveBand(spots: (number | null)[]) {
  bandStore.add({ id: Date.now(), spots: spots.slice() })
}
export function useBandShelf(): SavedBand[] {
  return useSyncExternalStore(bandStore.subscribe, bandStore.get, bandStore.get)
}

export function savePattern(tracks: (string | null)[][]) {
  patternStore.add({ id: Date.now(), tracks: tracks.map((t) => t.slice()) })
}
export function usePatternBook(): SavedPattern[] {
  return useSyncExternalStore(patternStore.subscribe, patternStore.get, patternStore.get)
}
