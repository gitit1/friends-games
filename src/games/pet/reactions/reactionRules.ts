import type { PetAction, PetReaction, ReactionContext } from './reactionTypes'
import { getNeedLevel, isCritical, isFull, isLow, minutesSince } from './needs'
import { hasTrait } from './personality'
import { repeatStreak } from './reactionHistory'

// Each rule maps a context → a PetReaction (outcome, animation, stat/mood deltas,
// speechKey, optional follow-up). The engine layers cross-cutting tweaks on top.
type Rule = (ctx: ReactionContext) => PetReaction

const REPEAT = 3 // doing the same action this many times in a row = "again?"

function feed(ctx: ReactionContext): PetReaction {
  const h = ctx.stats.hunger
  if (isFull(h)) {
    return {
      id: '', action: 'feed', outcome: 'refusal', priority: 5,
      animation: 'gentle_refuse', expression: 'neutral', posture: 'neutral',
      sound: 'refuse_soft', speechKey: 'feed.full', highlightAction: 'play',
      statChanges: { happy: +2 },
    }
  }
  if (repeatStreak(ctx.history, 'feed') >= REPEAT) {
    return {
      id: '', action: 'feed', outcome: 'request', priority: 4,
      animation: 'curious', expression: 'surprised', speechKey: 'feed.repeat',
      statChanges: { hunger: +18 }, memoryTags: ['variety'],
    }
  }
  if (isCritical(h)) {
    return {
      id: '', action: 'feed', outcome: 'success', priority: 8,
      animation: 'fast_eat', expression: 'relieved', posture: 'happy_bounce',
      sound: 'eat_crunch', visualEffects: ['crumbs', 'hearts'], speechKey: 'feed.strong',
      statChanges: { hunger: +42, happy: +8 }, followUpSuggestion: 'play',
    }
  }
  if (ctx.mood.happiness <= 30) {
    return {
      id: '', action: 'feed', outcome: 'partial_success', priority: 6,
      animation: 'slow_eat', expression: 'soft_sad', speechKey: 'feed.lowmood',
      sound: 'eat_crunch', statChanges: { hunger: +34, happy: +4 },
    }
  }
  return {
    id: '', action: 'feed', outcome: 'success', priority: 6,
    animation: 'eat', expression: 'happy', sound: 'eat_crunch',
    visualEffects: ['crumbs'], speechKey: 'feed.normal',
    statChanges: { hunger: +34, happy: +4 },
  }
}

function water(ctx: ReactionContext): PetReaction {
  const tt = ctx.stats.thirst
  if (isFull(tt)) {
    return {
      id: '', action: 'water', outcome: 'refusal', priority: 5,
      animation: 'gentle_refuse', expression: 'neutral', sound: 'refuse_soft', speechKey: 'drink.full',
    }
  }
  const afterPlay = minutesSince(ctx.history.lastPlayedAt, ctx.now) < 2
  if (isCritical(tt)) {
    return {
      id: '', action: 'water', outcome: 'success', priority: 8,
      animation: 'drink_happy', expression: 'relieved', sound: 'drink_sip',
      visualEffects: ['water_droplets'], speechKey: 'drink.strong', statChanges: { thirst: +42, happy: +6 },
    }
  }
  if (afterPlay) {
    return {
      id: '', action: 'water', outcome: 'success', priority: 7,
      animation: 'drink_happy', expression: 'happy', sound: 'drink_sip',
      visualEffects: ['water_droplets'], speechKey: 'drink.afterplay', statChanges: { thirst: +36, happy: +5 },
    }
  }
  return {
    id: '', action: 'water', outcome: 'success', priority: 6,
    animation: 'drink', expression: 'happy', sound: 'drink_sip',
    visualEffects: ['water_droplets'], speechKey: 'drink.normal', statChanges: { thirst: +34, happy: +3 },
  }
}

function play(ctx: ReactionContext): PetReaction {
  const energetic = hasTrait(ctx.personality, 'energetic')
  const calm = hasTrait(ctx.personality, 'calm')
  if (isLow(ctx.stats.energy)) {
    return {
      id: '', action: 'play', outcome: 'request', priority: 7,
      animation: 'tired_try_play', expression: 'tired', posture: 'tired_slouch',
      sound: 'sleepy_yawn', speechKey: 'play.tired', highlightAction: 'sleep',
      statChanges: { happy: +6, energy: -4 },
    }
  }
  if (ctx.mood.happiness <= 30) {
    return {
      id: '', action: 'play', outcome: 'partial_success', priority: 6,
      animation: 'small_smile', expression: 'soft_sad', speechKey: 'play.lowmood',
      statChanges: { happy: +16, energy: -6 }, moodChange: { boredom: -20, happiness: +16 },
    }
  }
  const bored = ctx.mood.boredom >= 60
  const repeat = repeatStreak(ctx.history, 'play') >= 2
  return {
    id: '', action: 'play', outcome: 'success', priority: bored ? 8 : 6,
    animation: 'excited_jump', expression: 'very_happy',
    posture: energetic ? 'excited_ready' : calm ? 'happy_bounce' : 'happy_bounce',
    sound: 'happy_chime', visualEffects: ['hearts', 'tiny_confetti'],
    speechKey: bored ? 'play.bored' : repeat ? 'play.repeat' : 'play.normal',
    statChanges: { happy: +28, energy: -8, thirst: -6 },
    moodChange: { boredom: -35, excitement: +25, happiness: +20 },
    followUpSuggestion: 'water',
  }
}

function clean(ctx: ReactionContext): PetReaction {
  const dirty = ctx.poop || ctx.stats.clean <= 40
  if (!dirty && isFull(ctx.stats.clean) && !ctx.poop) {
    return {
      id: '', action: 'clean', outcome: 'refusal', priority: 5,
      animation: 'gentle_refuse', expression: 'neutral', sound: 'refuse_soft', speechKey: 'clean.full',
    }
  }
  const strong = ctx.poop || isCritical(ctx.stats.clean)
  return {
    id: '', action: 'clean', outcome: 'success', priority: strong ? 8 : 6,
    animation: 'bath_bubbles', expression: 'relieved', sound: 'bath_bubbles',
    visualEffects: ['bubbles', 'sparkles'], speechKey: strong ? 'clean.strong' : 'clean.normal',
    setPoop: false, statChanges: { clean: +100, happy: +6 }, followUpSuggestion: 'dress',
  }
}

function sleep(ctx: ReactionContext): PetReaction {
  const e = ctx.stats.energy
  if (isFull(e)) {
    return {
      id: '', action: 'sleep', outcome: 'refusal', priority: 5,
      animation: 'refuse_sleep', expression: 'playful', speechKey: 'sleep.energetic', highlightAction: 'play',
    }
  }
  const lonely = ctx.mood.loneliness >= 60
  if (isLow(e) || isCritical(e)) {
    return {
      id: '', action: 'sleep', outcome: 'success', priority: 8,
      animation: 'curl_sleep', expression: 'sleepy', posture: 'sleeping',
      sound: 'sleepy_yawn', visualEffects: ['sleepy_z'], speechKey: lonely ? 'sleep.lonely' : 'sleep.tired',
      statChanges: { energy: +55, happy: +8 }, memoryTags: ['slept'],
    }
  }
  return {
    id: '', action: 'sleep', outcome: 'success', priority: 6,
    animation: 'nap', expression: 'sleepy', posture: 'sleeping',
    sound: 'sleepy_yawn', visualEffects: ['sleepy_z'], speechKey: 'sleep.medium',
    statChanges: { energy: +35, happy: +5 },
  }
}

function walk(ctx: ReactionContext): PetReaction {
  if (isLow(ctx.stats.energy)) {
    return {
      id: '', action: 'walk', outcome: 'request', priority: 6,
      animation: 'tired_try_play', expression: 'tired', posture: 'tired_slouch',
      speechKey: 'walk.tired', highlightAction: 'sleep',
    }
  }
  return {
    id: '', action: 'walk', outcome: 'success', priority: 6,
    animation: 'excited_walk', expression: 'happy', sound: 'happy_chime',
    visualEffects: ['sparkles'], speechKey: 'walk.after',
    statChanges: { happy: +20, energy: -10, clean: -22, thirst: -6 },
    moodChange: { boredom: -25, excitement: +15 },
    followUpSuggestion: 'clean', highlightAction: 'clean',
  }
}

function potty(ctx: ReactionContext): PetReaction {
  if (ctx.poop) {
    return {
      id: '', action: 'potty', outcome: 'success', priority: 6,
      animation: 'gentle_refuse', expression: 'relieved', speechKey: 'potty.go',
      setPoop: false, statChanges: { clean: +30, happy: +4 },
    }
  }
  return {
    id: '', action: 'potty', outcome: 'refusal', priority: 4,
    animation: 'gentle_refuse', expression: 'neutral', speechKey: 'potty.no',
  }
}

function dress(ctx: ReactionContext): PetReaction {
  const p = ctx.personality
  const key = hasTrait(p, 'shy') ? 'dress.shy'
    : hasTrait(p, 'dramatic') ? 'dress.dramatic'
      : hasTrait(p, 'playful') ? 'dress.playful'
        : hasTrait(p, 'calm') ? 'dress.calm' : 'dress.normal'
  return {
    id: '', action: 'dress', outcome: 'success', priority: 5,
    animation: 'happy_bounce', expression: 'happy', visualEffects: ['sparkles', 'glow'],
    speechKey: key, statChanges: { happy: +8 }, moodChange: { excitement: +12, boredom: -10 },
  }
}

function hug(ctx: ReactionContext): PetReaction {
  if (hasTrait(ctx.personality, 'shy')) {
    return {
      id: '', action: 'hug', outcome: 'success', priority: 6,
      animation: 'shy_turn', expression: 'shy', posture: 'shy_turn', speechKey: 'hug.shy',
      statChanges: { happy: +10 }, moodChange: { loneliness: -40, trust: +8 },
    }
  }
  const lonely = ctx.mood.loneliness >= 50
  const repeat = repeatStreak(ctx.history, 'hug') >= 2
  return {
    id: '', action: 'hug', outcome: 'success', priority: lonely ? 8 : 6,
    animation: 'cuddle', expression: 'relieved', posture: 'happy_bounce',
    sound: 'happy_chime', visualEffects: ['hearts'],
    speechKey: lonely ? 'hug.lonely' : repeat ? 'hug.repeat' : 'hug.happy',
    statChanges: { happy: +12 }, moodChange: { loneliness: -50, trust: +6, happiness: +12 },
  }
}

export const RULES: Record<PetAction, Rule> = { feed, water, play, clean, sleep, walk, potty, dress, hug }

export { getNeedLevel } // re-export for convenience
