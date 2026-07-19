import { useSyncExternalStore } from 'react'

// Which (world, prop-kind) pairs the child has SWALLOWED for the first time in the
// hole game — a permanent, self-paced per-world sticker book (mirrors friendsMet.ts
// exactly). Saved to localStorage and never lost: discovering a prop only ever
// adds, never removes. Key format: "worldId:propKind" (e.g. "beach:lighthouse") —
// swallowing the same prop kind again in a DIFFERENT world is a fresh discovery,
// which is the whole point: a reason to replay every world, not just one.

const KEY = 'assaf-games:holeDiscoveries'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

let found = load()
// a stable snapshot reference for useSyncExternalStore (changes identity only on update)
let snapshot = Array.from(found).sort()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // private mode / storage off — just won't persist, no crash
  }
}

function keyOf(worldId: string, kind: string): string {
  return `${worldId}:${kind}`
}

export function getDiscoveries(): string[] {
  return snapshot
}

export function hasDiscovered(worldId: string, kind: string): boolean {
  return found.has(keyOf(worldId, kind))
}

/** Record swallowing a prop `kind` in `worldId` for the first time (idempotent,
 * cheap set-add). Returns true iff this was the FIRST time — the caller can use
 * that to show a one-off "you discovered it!" toast. Notifies subscribers + saves. */
export function recordDiscovery(worldId: string, kind: string): boolean {
  const key = keyOf(worldId, kind)
  if (found.has(key)) return false
  found.add(key)
  snapshot = Array.from(found).sort()
  persist()
  listeners.forEach((fn) => fn())
  return true
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Sorted array of "worldId:kind" discovery keys; re-renders on change. */
export function useDiscoveries(): string[] {
  return useSyncExternalStore(subscribe, getDiscoveries, getDiscoveries)
}
