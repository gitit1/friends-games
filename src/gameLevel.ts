import { useCallback, useSyncExternalStore } from 'react'
import { levelForTier } from './difficulty'
import { getSettings } from './settings'

// Per-GAME difficulty level, shared between the top-bar <LevelButton> and the
// game component itself (both subscribe to this tiny external store, so a tap
// on the header control reaches the game instantly and vice versa).
//
// - The first visit opens at the parent's global `difficulty` setting mapped
//   through the game's own tier list (`levelForTier`), exactly like the games
//   with in-body chips do.
// - After that the child's last choice wins: it persists per game in
//   localStorage (`assaf-games:level:<gameId>`), surviving a refresh.
//
// Adopting this in another game is mechanical: declare LEVEL_TIERS, pass
// `levels={{ gameId, tiers: LEVEL_TIERS }}` to <GameShell>, and read
// `useGameLevel(gameId, LEVEL_TIERS)` for the current level index.

const PREFIX = 'assaf-games:level:'
const cache = new Map<string, number>()
const subs = new Map<string, Set<() => void>>()

export function getGameLevel(gameId: string, tiers: number[]): number {
  const cached = cache.get(gameId)
  if (cached !== undefined) return cached
  let level: number | null = null
  try {
    const raw = localStorage.getItem(PREFIX + gameId)
    if (raw !== null) {
      const n = Number(raw)
      if (Number.isInteger(n) && n >= 0 && n < tiers.length) level = n
    }
  } catch {
    // private mode / storage off — just fall back to the global setting
  }
  if (level === null) level = levelForTier(tiers, getSettings().difficulty)
  cache.set(gameId, level)
  return level
}

export function setGameLevel(gameId: string, level: number) {
  if (cache.get(gameId) === level) return
  cache.set(gameId, level)
  try {
    localStorage.setItem(PREFIX + gameId, String(level))
  } catch {
    // fine — the choice just won't survive a refresh
  }
  subs.get(gameId)?.forEach((fn) => fn())
}

/** [levelIndex, setLevelIndex] for one game. `tiers` must be a stable array
 *  (a module-scope LEVEL_TIERS constant). */
export function useGameLevel(gameId: string, tiers: number[]): [number, (level: number) => void] {
  const subscribe = useCallback(
    (fn: () => void) => {
      let set = subs.get(gameId)
      if (!set) {
        set = new Set()
        subs.set(gameId, set)
      }
      set.add(fn)
      return () => {
        set.delete(fn)
      }
    },
    [gameId],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const read = useCallback(() => getGameLevel(gameId, tiers), [gameId, tiers])
  const level = useSyncExternalStore(subscribe, read, read)
  const set = useCallback((l: number) => setGameLevel(gameId, l), [gameId])
  return [level, set]
}
