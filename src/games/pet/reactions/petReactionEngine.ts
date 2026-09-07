import { RULES } from './reactionRules'
import type { PetAction, PetExpressionKey, PetPostureKey, PetReaction, PetVisualEffectKey, ReactionContext } from './reactionTypes'
import { isCritical, isLow, minutesSince } from './needs'

let counter = 0
const uid = () => `r${++counter}`

// The one entry point the UI calls on every action. It runs the action's rule,
// then layers context-wide tweaks (returned-after-a-while warmth, etc.).
export function getPetReaction(ctx: ReactionContext): PetReaction {
  const r: PetReaction = { ...RULES[ctx.action](ctx), id: uid() }

  // came back after a long absence → a warm "missed you" on the first good action
  const away = minutesSince(ctx.history.lastInteractionAt, ctx.now)
  if (away >= 30 && r.outcome !== 'refusal') {
    r.memoryTags = [...(r.memoryTags ?? []), 'missed']
    if (ctx.mood.loneliness >= 50) r.speechKey = 'generic.missed'
  }
  return r
}

// "Alive even when you do nothing." Given the current state, what body language
// (+ maybe a gentle bubble and a suggested action) should the pet show while idle.
export type IdleResult = {
  posture: PetPostureKey
  expression: PetExpressionKey
  speechKey?: string
  highlightAction?: PetAction
  visualEffects?: PetVisualEffectKey[]
}

export function getIdleReaction(
  ctx: Pick<ReactionContext, 'stats' | 'mood' | 'poop'> & { canSpeak: boolean },
): IdleResult {
  const { stats, mood, poop, canSpeak } = ctx
  const say = (k: string) => (canSpeak ? k : undefined)
  if (isCritical(stats.hunger) || isLow(stats.hunger))
    return { posture: 'hungry_hold_tummy', expression: 'hungry', highlightAction: 'feed', speechKey: say('idle.hungry') }
  if (isCritical(stats.thirst) || isLow(stats.thirst))
    return { posture: 'thirsty_waiting', expression: 'thirsty', highlightAction: 'water', speechKey: say('idle.thirsty') }
  if (poop || isLow(stats.clean))
    return { posture: 'dirty_uncomfortable', expression: 'annoyed', highlightAction: 'clean' }
  if (isLow(stats.energy))
    return { posture: 'tired_slouch', expression: 'sleepy', highlightAction: 'sleep', speechKey: say('idle.sleepy') }
  if (mood.loneliness >= 60)
    return { posture: 'sad_sit', expression: 'sad', highlightAction: 'hug', speechKey: say('idle.lonely'), visualEffects: ['sad_cloud'] }
  if (mood.boredom >= 60)
    return { posture: 'neutral', expression: 'neutral', highlightAction: 'play', speechKey: say('idle.bored') }
  return { posture: 'happy_bounce', expression: 'happy', speechKey: say('idle.happy') }
}
