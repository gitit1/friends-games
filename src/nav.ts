import { createContext, useContext } from 'react'

// Where the shared "back" button (in GameShell) should say it returns to. App
// fills this per route so a game returns to ITS category list — not all the way
// out to the main page — exactly like a friend's world returns to the friends
// list. Defaults to home when no provider sets it.
export type BackTarget = { emoji: string; label: string }

// Navigation info for the shared top bar: the one-level-up "back" target, a way
// to jump straight to the main page, and whether "back" already IS the main page
// (so a deeper screen also shows a separate 🏠 Home button, but a one-level
// screen — whose back already goes home — does not need the duplicate).
export type NavInfo = {
  back: BackTarget
  goHome: () => void
  backIsHome: boolean
}

export const BackContext = createContext<NavInfo | null>(null)

export function useNav(): NavInfo | null {
  return useContext(BackContext)
}
