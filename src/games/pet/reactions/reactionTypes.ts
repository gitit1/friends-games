// ─────────────────────────────────────────────────────────────────────────
// Pet Reaction Engine — shared types.
// A state-aware system: the same action reacts differently by stats, mood,
// personality, and recent history. Pure data/logic — no React, no DOM.
// ─────────────────────────────────────────────────────────────────────────

export type PetAction = 'feed' | 'water' | 'play' | 'walk' | 'potty' | 'clean' | 'dress' | 'sleep' | 'hug'

// physical needs (0–100; higher = more satisfied)
export type PetStats = {
  hunger: number
  thirst: number
  happy: number // happiness
  clean: number
  energy: number
}

// emotional state (0–100)
export type PetMoodState = {
  happiness: number
  loneliness: number
  boredom: number
  excitement: number
  trust: number
}

export type NeedLevel = 'critical' | 'low' | 'medium' | 'high' | 'full'

export type PetTrait =
  | 'energetic' | 'shy' | 'dramatic' | 'calm' | 'playful' | 'sleepy' | 'curious' | 'picky' | 'cuddly'
export type SpeechStyle = 'sweet' | 'funny' | 'shy' | 'dramatic' | 'energetic' | 'sleepy' | 'curious'
export type Species = 'friend' | 'dog' | 'cat' | 'rabbit' | 'bird' | 'dinosaur' | 'panda' | 'unicorn' | 'robot'

export type PetPersonality = {
  id: string
  traits: PetTrait[]
  species: Species
  favoriteActions: PetAction[]
  dislikedActions: PetAction[]
  speechStyle: SpeechStyle
}

export type ReactionOutcome = 'success' | 'partial_success' | 'refusal' | 'request' | 'idle' | 'warning'

export type PetAnimationKey =
  | 'idle' | 'eat' | 'fast_eat' | 'slow_eat' | 'drink' | 'drink_happy' | 'excited_jump'
  | 'tired_try_play' | 'small_smile' | 'bath_bubbles' | 'curl_sleep' | 'nap' | 'refuse_sleep'
  | 'excited_walk' | 'cuddle' | 'happy_bounce' | 'shy_turn' | 'gentle_refuse' | 'curious' | 'wake_up'

export type PetPostureKey =
  | 'neutral' | 'happy_bounce' | 'sad_sit' | 'tired_slouch' | 'hungry_hold_tummy'
  | 'thirsty_waiting' | 'dirty_uncomfortable' | 'excited_ready' | 'shy_turn' | 'sleeping'

export type PetExpressionKey =
  | 'happy' | 'very_happy' | 'neutral' | 'sad' | 'soft_sad' | 'tired' | 'hungry' | 'thirsty'
  | 'surprised' | 'annoyed' | 'relieved' | 'sleepy' | 'playful' | 'shy'

export type PetSoundKey =
  | 'happy_chime' | 'eat_crunch' | 'drink_sip' | 'bath_bubbles' | 'sleepy_yawn'
  | 'sad_tiny' | 'refuse_soft' | 'success_pop'

export type PetVisualEffectKey =
  | 'hearts' | 'sparkles' | 'bubbles' | 'sleepy_z' | 'crumbs' | 'water_droplets'
  | 'tiny_confetti' | 'sad_cloud' | 'dirt_smudge' | 'glow'

export type RecentAction = { action: PetAction; timestamp: number; outcome: ReactionOutcome }

export type PetInteractionHistory = {
  lastInteractionAt?: number
  lastFedAt?: number
  lastPlayedAt?: number
  lastCleanedAt?: number
  lastSleptAt?: number
  recentActions: RecentAction[]
  repeatedActionCount: Partial<Record<PetAction, number>>
  totalCareCount?: number
}

export type PetReaction = {
  id: string
  action: PetAction
  outcome: ReactionOutcome
  priority: number
  statChanges?: Partial<PetStats>
  moodChange?: Partial<PetMoodState>
  setPoop?: boolean // explicitly set the poop flag (true/false)
  animation: PetAnimationKey
  posture?: PetPostureKey
  expression?: PetExpressionKey
  sound?: PetSoundKey
  visualEffects?: PetVisualEffectKey[]
  speechKey: string // logical message group → resolved in reactionMessages
  followUpSuggestion?: PetAction
  highlightAction?: PetAction
  memoryTags?: string[]
}

export type ReactionContext = {
  action: PetAction
  stats: PetStats
  mood: PetMoodState
  personality: PetPersonality
  history: PetInteractionHistory
  now: number
  poop?: boolean // the pet currently has a mess to clean
  food?: string // food key, when feeding
}
