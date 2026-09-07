import type { PetAction, PetInteractionHistory, ReactionOutcome } from './reactionTypes'

const RECENT_MAX = 12

export function emptyHistory(): PetInteractionHistory {
  return { recentActions: [], repeatedActionCount: {}, totalCareCount: 0 }
}

// how many times in a row (looking back) the same action was the LAST one
export function repeatStreak(history: PetInteractionHistory, action: PetAction): number {
  let n = 0
  for (let i = history.recentActions.length - 1; i >= 0; i--) {
    if (history.recentActions[i].action === action) n++
    else break
  }
  return n
}

const lastAtKey: Partial<Record<PetAction, keyof PetInteractionHistory>> = {
  feed: 'lastFedAt',
  play: 'lastPlayedAt',
  clean: 'lastCleanedAt',
  sleep: 'lastSleptAt',
}

// returns a NEW history with this interaction recorded (immutable)
export function recordAction(
  history: PetInteractionHistory,
  action: PetAction,
  outcome: ReactionOutcome,
  now: number,
): PetInteractionHistory {
  const recentActions = [...history.recentActions, { action, timestamp: now, outcome }].slice(-RECENT_MAX)
  const repeatedActionCount = { ...history.repeatedActionCount, [action]: (history.repeatedActionCount[action] ?? 0) + 1 }
  // a refusal ("I'm full", "already clean") isn't real care — it doesn't count toward
  // the up-only "times cared for" number, nor mark the action as freshly done.
  const cared = outcome !== 'refusal'
  const next: PetInteractionHistory = {
    ...history,
    recentActions,
    repeatedActionCount,
    lastInteractionAt: now,
    totalCareCount: (history.totalCareCount ?? 0) + (cared ? 1 : 0),
  }
  const k = lastAtKey[action]
  if (cared && k) (next as Record<string, unknown>)[k] = now
  return next
}
