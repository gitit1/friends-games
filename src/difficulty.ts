// Global default difficulty.
//
// Games each have their own list of levels with their own labels (קל/רגיל/אלוף…).
// This module gives a single canonical scale the parent can set once in Settings,
// which every game uses to decide *which level it opens at*. The in-game level
// buttons still work — this only chooses the starting level.
//
// The canonical scale ascends: 0 קל · 1 בינוני · 2 קשה · 3 אלוף.
export const DIFFICULTY_TIERS = ['קל', 'בינוני', 'קשה', 'אלוף'] as const
export type DifficultyTier = 0 | 1 | 2 | 3

// Each game tags its own levels with the canonical tier each one represents
// (an ascending list, e.g. CarRace's קל/בינוני/אלוף → [0, 1, 3]). Given the
// chosen tier, return the index of the *hardest* game level that is still ≤ the
// chosen tier. So picking "אלוף" on a game whose top level is only "קשה" falls
// back to "קשה" — never overshoots, just steps down to the closest below.
export function levelForTier(levelTiers: number[], wanted: number): number {
  let idx = 0
  for (let i = 0; i < levelTiers.length; i++) {
    if (levelTiers[i] <= wanted) idx = i
  }
  return idx
}
