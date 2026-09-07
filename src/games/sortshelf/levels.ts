import type { LevelConfig, ShelfSlot } from './gameTypes'
import { cloneShelves } from './engine'

// cute, clearly-distinguishable grocery goods (original placeholder glyphs)
export const GOODS: Record<string, string> = {
  apple: '🍎',
  banana: '🍌',
  milk: '🥛',
  bread: '🍞',
  cheese: '🧀',
  carrot: '🥕',
  tomato: '🍅',
  cookie: '🍪',
  juice: '🧃',
  choco: '🍫',
  grapes: '🍇',
  cupcake: '🧁',
}

type ShelfSpec = { v: string[]; h?: string[]; locked?: boolean }

const item = (lvl: number, si: number, slot: string, idx: number, type: string) => ({
  id: `L${lvl}-S${si}-${slot}${idx}`,
  type,
  icon: GOODS[type],
})

function shelf(lvl: number, si: number, s: ShelfSpec): ShelfSlot {
  return {
    id: `L${lvl}-S${si}`,
    capacity: 3,
    items: s.v.map((t, i) => item(lvl, si, 'v', i, t)),
    hiddenItems: s.h?.map((t, i) => item(lvl, si, 'h', i, t)),
    locked: s.locked,
  }
}

function level(id: number, title: string, specs: ShelfSpec[], tutorial = false): LevelConfig {
  return { id, title, tutorial, shelves: specs.map((s, si) => shelf(id, si, s)) }
}

// Each goods type appears in a multiple of 3 across the board, so everything can
// be cleared. Difficulty grows: more types, less space, then hidden + locked.
export const LEVELS: LevelConfig[] = [
  // 1 — tutorial: 2 types, lots of room
  level(
    1,
    'שלב ראשון',
    [
      { v: ['apple', 'apple'] },
      { v: ['banana'] },
      { v: ['apple'] },
      { v: ['banana', 'banana'] },
      { v: [] },
      { v: [] },
    ],
    true,
  ),
  // 2 — 3 types
  level(2, 'מתחממים', [
    { v: ['apple', 'banana', 'apple'] },
    { v: ['milk', 'milk'] },
    { v: ['banana'] },
    { v: ['apple'] },
    { v: ['milk'] },
    { v: ['banana'] },
    { v: [] },
    { v: [] },
  ]),
  // 3 — 4 types
  level(3, 'ארבעה מצרכים', [
    { v: ['apple', 'milk', 'banana'] },
    { v: ['bread', 'bread'] },
    { v: ['milk', 'apple'] },
    { v: ['banana', 'bread'] },
    { v: ['apple'] },
    { v: ['milk'] },
    { v: ['banana'] },
    { v: [] },
    { v: [] },
  ]),
  // 4 — 5 types, less room
  level(4, 'מתמלא', [
    { v: ['apple', 'cheese', 'banana'] },
    { v: ['milk', 'bread', 'milk'] },
    { v: ['cheese', 'apple'] },
    { v: ['banana', 'bread'] },
    { v: ['cheese', 'milk'] },
    { v: ['apple', 'banana'] },
    { v: ['bread'] },
    { v: [] },
  ]),
  // 5 — 6 types
  level(5, 'שישה מצרכים', [
    { v: ['apple', 'carrot', 'banana'] },
    { v: ['milk', 'bread', 'cheese'] },
    { v: ['carrot', 'apple', 'milk'] },
    { v: ['banana', 'bread', 'carrot'] },
    { v: ['cheese', 'apple'] },
    { v: ['milk', 'banana'] },
    { v: ['bread', 'cheese'] },
    { v: [] },
    { v: [] },
  ]),
  // 6 — 6 types, tighter
  level(6, 'צפוף', [
    { v: ['tomato', 'cookie', 'tomato'] },
    { v: ['juice', 'cheese', 'juice'] },
    { v: ['cookie', 'tomato', 'juice'] },
    { v: ['cheese', 'milk', 'cookie'] },
    { v: ['milk', 'cheese'] },
    { v: ['milk', 'banana'] },
    { v: ['banana', 'banana'] },
    { v: [] },
  ]),
  // 7 — hidden goods behind the front
  level(7, 'מי מסתתר?', [
    { v: ['apple', 'banana'], h: ['milk'] },
    { v: ['bread', 'bread'], h: ['apple'] },
    { v: ['milk', 'banana'] },
    { v: ['apple'], h: ['bread'] },
    { v: ['milk'], h: ['banana'] },
    { v: [] },
    { v: [] },
  ]),
  // 8 — more hidden + 5 types
  level(8, 'הפתעות', [
    { v: ['cheese', 'apple'], h: ['carrot'] },
    { v: ['banana', 'cheese'], h: ['apple'] },
    { v: ['carrot', 'banana'], h: ['cheese'] },
    { v: ['apple'], h: ['carrot', 'banana'] },
    { v: ['milk', 'milk'], h: ['milk'] },
    { v: [] },
    { v: [] },
  ]),
  // 9 — a locked crate (clear it out to free the shelf)
  level(9, 'ארגז נעול', [
    { v: ['apple', 'banana', 'milk'], locked: true },
    { v: ['banana', 'milk'] },
    { v: ['apple', 'cheese'] },
    { v: ['milk', 'cheese'] },
    { v: ['apple', 'banana'] },
    { v: ['cheese'] },
    { v: [] },
    { v: [] },
  ]),
  // 10 — locked + hidden, full board
  level(10, 'אתגר המכולת', [
    { v: ['choco', 'grapes', 'cupcake'], locked: true },
    { v: ['grapes', 'cupcake'], h: ['choco'] },
    { v: ['cupcake', 'choco'] },
    { v: ['apple', 'grapes'], h: ['apple'] },
    { v: ['banana', 'apple'] },
    { v: ['banana', 'banana'] },
    { v: ['choco', 'grapes', 'cupcake'], locked: true },
    { v: [] },
    { v: [] },
  ]),
]

// ── The shared header difficulty tier reshapes a level's BOARD DATA only
// (free space + crate locks) — the sort MECHANIC is never touched. Cumulative,
// no-fail:
//   0 קל    — +2 empty shelves, every crate unlocked → lots of room, no obstacles
//   1 בינוני — +1 empty shelf, crates unlocked, hidden goods kept
//   2 קשה    — the authored board exactly as-is (hidden goods + locked crates)
//   3 אלוף   — one FEWER empty shelf (tighter planning) + all obstacles kept
// A board always keeps at least one empty shelf so it stays workable. ──
const isEmpty = (s: ShelfSlot) => s.items.length === 0 && !(s.hiddenItems?.length)

export function applyDifficulty(cfg: LevelConfig, tier: number): LevelConfig {
  const shelves = cloneShelves(cfg.shelves)
  if (tier <= 1) for (const s of shelves) s.locked = false // easy tiers: unlock crates
  const extra = tier === 0 ? 2 : tier === 1 ? 1 : tier === 2 ? 0 : -1
  if (extra > 0) {
    for (let i = 0; i < extra; i++) shelves.push({ id: `${cfg.id}-EX${i}`, capacity: 3, items: [] })
  } else if (extra < 0) {
    let toRemove = -extra
    while (toRemove > 0 && shelves.filter(isEmpty).length > 1) {
      for (let i = shelves.length - 1; i >= 0; i--) {
        if (isEmpty(shelves[i])) {
          shelves.splice(i, 1)
          break
        }
      }
      toRemove--
    }
  }
  return { ...cfg, shelves }
}
