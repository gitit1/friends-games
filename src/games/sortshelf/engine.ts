import type { GameState, LevelConfig, ShelfSlot } from './gameTypes'

// ── pure puzzle logic, fully separate from the UI ──
// The board is just an array of shelves. All functions are immutable: they take a
// board and return a NEW board, so Undo is a simple history of snapshots.

const WIN_BONUS = 500

export function cloneShelves(shelves: ShelfSlot[]): ShelfSlot[] {
  return shelves.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i })),
    hiddenItems: s.hiddenItems ? s.hiddenItems.map((i) => ({ ...i }) ) : undefined,
  }))
}

const countItems = (s: ShelfSlot) => s.items.length + (s.hiddenItems?.length ?? 0)
const totalItems = (shelves: ShelfSlot[]) => shelves.reduce((n, s) => n + countItems(s), 0)

export function initState(level: LevelConfig): GameState {
  const shelves = cloneShelves(level.shelves)
  return {
    levelId: level.id,
    shelves,
    selected: null,
    score: 0,
    combo: 0,
    moves: 0,
    cleared: 0,
    total: totalItems(shelves),
    history: [],
    status: 'playing',
  }
}

// only the FRONT (rightmost) good of a shelf is movable
export function isLegalMove(shelves: ShelfSlot[], sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return false
  const src = shelves.find((s) => s.id === sourceId)
  const tgt = shelves.find((s) => s.id === targetId)
  if (!src || !tgt) return false
  if (src.items.length === 0) return false
  if (tgt.locked) return false // a locked crate can't receive (until it's emptied)
  return tgt.items.length < tgt.capacity
}

// goods queued behind the front come forward as space frees up
function reveal(s: ShelfSlot) {
  while (s.items.length < s.capacity && s.hiddenItems && s.hiddenItems.length) {
    s.items.unshift(s.hiddenItems.shift()!) // revealed good sits BEHIND the front
  }
}

// clear every shelf that holds a full set of identical goods; cascade until stable.
// returns how many triples were cleared this pass.
function resolveMatches(shelves: ShelfSlot[]): { triples: number; clearedShelfIds: string[] } {
  let triples = 0
  const clearedShelfIds: string[] = []
  let again = true
  while (again) {
    again = false
    for (const s of shelves) {
      if (s.items.length === s.capacity && s.items.every((it) => it.type === s.items[0].type)) {
        s.items = []
        triples++
        clearedShelfIds.push(s.id)
        again = true
        reveal(s) // hidden goods drop in to take the cleared spot
      }
    }
  }
  return { triples, clearedShelfIds }
}

export type MoveResult = { state: GameState; cleared: number; clearedShelfIds: string[]; illegal?: boolean }

export function applyMove(state: GameState, sourceId: string, itemId: string, targetId: string): MoveResult {
  if (!isLegalMove(state.shelves, sourceId, targetId)) return { state, cleared: 0, clearedShelfIds: [], illegal: true }

  const snapshot = cloneShelves(state.shelves)
  const shelves = cloneShelves(state.shelves)
  const src = shelves.find((s) => s.id === sourceId)!
  const tgt = shelves.find((s) => s.id === targetId)!

  const idx = src.items.findIndex((i) => i.id === itemId)
  if (idx < 0) return { state, cleared: 0, clearedShelfIds: [], illegal: true }
  tgt.items.push(src.items.splice(idx, 1)[0]) // move the CHOSEN good across (any one)
  reveal(src) // a hidden good behind it (if any) comes forward

  const { triples, clearedShelfIds } = resolveMatches(shelves)

  // emptied locked crates unlock (become normal shelves)
  for (const s of shelves) if (s.locked && s.items.length === 0 && !(s.hiddenItems?.length)) s.locked = false

  // scoring: a clearing move bumps the combo; each triple scores 100 × combo
  let combo = state.combo
  let score = state.score
  if (triples > 0) {
    combo = state.combo + 1
    score += triples * 100 * combo
  } else {
    combo = 0
  }

  const cleared = state.cleared + triples * 3
  const won = totalItems(shelves) === 0
  if (won) score += WIN_BONUS

  const next: GameState = {
    ...state,
    shelves,
    selected: null,
    score,
    combo,
    moves: state.moves + 1,
    cleared,
    history: [...state.history, snapshot],
    status: won ? 'won' : hasAnyLegalMove(shelves) ? 'playing' : 'no_moves',
  }
  return { state: next, cleared: triples, clearedShelfIds }
}

// just place the chosen good on the target (move + reveal) WITHOUT resolving any
// match — so the UI can show the 3 line up for a beat before they pop.
export function placeOnly(shelves: ShelfSlot[], sourceId: string, itemId: string, targetId: string): ShelfSlot[] {
  const next = cloneShelves(shelves)
  const src = next.find((s) => s.id === sourceId)
  const tgt = next.find((s) => s.id === targetId)
  if (!src || !tgt) return next
  const idx = src.items.findIndex((i) => i.id === itemId)
  if (idx < 0) return next
  tgt.items.push(src.items.splice(idx, 1)[0])
  reveal(src)
  return next
}

export function undo(state: GameState): GameState {
  if (!state.history.length) return state
  const history = state.history.slice()
  const prev = history.pop()!
  return { ...state, shelves: prev, history, selected: null, combo: 0, status: 'playing' }
}

export function hasAnyLegalMove(shelves: ShelfSlot[]): boolean {
  for (const src of shelves) {
    if (!src.items.length) continue
    for (const tgt of shelves) {
      if (isLegalMove(shelves, src.id, tgt.id)) return true
    }
  }
  return false
}

type Hint = { sourceId: string; itemId: string; targetId: string }
// a helpful move: first one that completes a triple; else one that groups a pair.
// Any visible good may move (not just the front).
export function getHint(shelves: ShelfSlot[]): Hint | null {
  let group: Hint | null = null
  for (const src of shelves) {
    for (const it of src.items) {
      for (const tgt of shelves) {
        if (!isLegalMove(shelves, src.id, tgt.id)) continue
        const sameInTgt = tgt.items.filter((x) => x.type === it.type).length
        // moving `it` makes a full set of 3 identical → an immediate clear
        if (tgt.items.length === 2 && sameInTgt === 2) return { sourceId: src.id, itemId: it.id, targetId: tgt.id }
        // otherwise remember a move that puts it next to a matching good
        if (!group && sameInTgt > 0 && tgt.items.length < tgt.capacity)
          group = { sourceId: src.id, itemId: it.id, targetId: tgt.id }
      }
    }
  }
  return group
}

// rearrange the loose (unlocked, non-hidden) goods, keeping the same free space so
// the board stays workable. Locked crates and hidden goods are left untouched.
export function shuffleBoard(shelves: ShelfSlot[]): ShelfSlot[] {
  const next = cloneShelves(shelves)
  const open = next.filter((s) => !s.locked)
  const pool = open.flatMap((s) => s.items)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // keep each shelf's original visible count, just with reshuffled goods
  let k = 0
  for (const s of open) {
    const n = s.items.length
    s.items = pool.slice(k, k + n)
    k += n
  }
  return next
}
