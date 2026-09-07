import type { PetPersonality, PetTrait, SpeechStyle, PetAction, Species } from './reactionTypes'

// Each friend-pet gets a personality so the SAME action feels different per
// character. Species is 'friend' for now (the app draws number-friends, not
// animals) but the structure is animal-ready for the future.
type Template = { traits: PetTrait[]; speechStyle: SpeechStyle; fav: PetAction[]; dislike: PetAction[] }

const TEMPLATES: Template[] = [
  { traits: ['playful', 'energetic'], speechStyle: 'energetic', fav: ['play', 'walk'], dislike: ['sleep'] },
  { traits: ['calm', 'cuddly'], speechStyle: 'sweet', fav: ['hug', 'sleep'], dislike: [] },
  { traits: ['curious', 'playful'], speechStyle: 'curious', fav: ['play', 'walk'], dislike: ['clean'] },
  { traits: ['shy', 'cuddly'], speechStyle: 'shy', fav: ['hug'], dislike: ['walk'] },
  { traits: ['dramatic', 'picky'], speechStyle: 'dramatic', fav: ['dress', 'feed'], dislike: ['clean'] },
  { traits: ['sleepy', 'calm'], speechStyle: 'sleepy', fav: ['sleep', 'feed'], dislike: ['play'] },
]

// named overrides for the early, well-known friends (1-based number → index)
const NAMED: Record<number, Template> = {
  0: { traits: ['calm', 'cuddly'], speechStyle: 'sweet', fav: ['hug', 'feed'], dislike: [] }, // לולו — sweet, gentle
  1: { traits: ['energetic', 'playful'], speechStyle: 'funny', fav: ['play', 'walk'], dislike: ['sleep'] }, // טוקי — noisy, funny
  2: { traits: ['playful', 'curious'], speechStyle: 'funny', fav: ['play'], dislike: ['clean'] }, // בובי — playful, silly
  3: { traits: ['dramatic', 'picky'], speechStyle: 'dramatic', fav: ['dress'], dislike: ['clean'] }, // גוגו — dramatic
}

export function getPersonality(friendIndex: number): PetPersonality {
  const t = NAMED[friendIndex] ?? TEMPLATES[friendIndex % TEMPLATES.length]
  const species: Species = 'friend'
  return {
    id: `pet-${friendIndex}`,
    traits: t.traits,
    species,
    favoriteActions: t.fav,
    dislikedActions: t.dislike,
    speechStyle: t.speechStyle,
  }
}

export const hasTrait = (p: PetPersonality, trait: PetTrait) => p.traits.includes(trait)
