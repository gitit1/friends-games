// ── data models for the calm shelf-sorting puzzle (no timer, ever) ──
// A board is a set of shelves. Each shelf holds up to `capacity` (3) goods.
// You move the FRONT (rightmost) good of a shelf onto another shelf; when a shelf
// holds 3 identical goods they clear. Win = every good cleared.

export type Item = {
  id: string
  type: string // the goods kind ('apple', 'milk', …) — a match needs 3 of the same
  icon: string // its cute glyph
}

export type ShelfSlot = {
  id: string
  capacity: number
  items: Item[] // visible goods, front = last in the array
  locked?: boolean // a locked shelf can't receive goods until unlocked
  hiddenItems?: Item[] // goods queued behind the visible ones; revealed as space frees
}

export type LevelConfig = {
  id: number
  title: string
  shelves: ShelfSlot[]
  tutorial?: boolean
}

export type Selected = { shelfId: string; itemId: string } | null
export type Status = 'playing' | 'won' | 'no_moves'

export type GameState = {
  levelId: number
  shelves: ShelfSlot[]
  selected: Selected
  score: number
  combo: number
  moves: number
  cleared: number // goods cleared so far (for the progress bar)
  total: number // goods at the start (for the progress bar)
  history: ShelfSlot[][] // snapshots for Undo
  status: Status
}
