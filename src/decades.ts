// The 100 friends organised into 10 thematic "families" by their tens digit —
// friend 47 belongs to the 41–50 decade. This is an IDENTITY/organisation layer
// only (not a constraint): existing friend↔game links (1–56) don't perfectly
// match every decade's theme, and that's fine — decades are never reshuffled
// to fit a game. See docs/plan-2026-07/hundred.html § "עשיריות".
//
// Display NAMES live in i18n as decade.0 … decade.9 (mirrors the world.like.<n>
// pattern) so he/en stay in parity — see src/i18n/he.ts + en.ts. `say` here is
// niqqud-only, used ONLY for the Hebrew voice's spoken-intro fallback.
export type Decade = {
  start: number // first friend NUMBER (1-based) in this decade — 1, 11, 21, …
  say: string // niqqud spelling (Hebrew TTS pronunciation), not shown on screen
  emoji: string
  color: string // theme tint (hex); UI always mixes this at LOW opacity into
  // --panel via color-mix() — never shown as a solid/saturated fill (sensory rule)
}

export const DECADES: Decade[] = [
  { start: 1, say: 'הַחֲלוּצִים', emoji: '🌟', color: '#f59e0b' },
  { start: 11, say: 'הַסְּפוֹרְטָאִים', emoji: '⚽', color: '#f97316' },
  { start: 21, say: 'חֲבֵרֵי הַמִּסְפָּרִים', emoji: '🔢', color: '#eab308' },
  { start: 31, say: 'אֳמָנֵי הַיְּצִירָה', emoji: '🎨', color: '#22c55e' },
  { start: 41, say: 'הַטַּבָּחִים הַקְּטַנִּים', emoji: '🍰', color: '#f472b6' },
  { start: 51, say: 'חֲבֵרֵי הָאוֹתִיּוֹת', emoji: '🔤', color: '#3b82f6' },
  { start: 61, say: 'הַמּוּזִיקָאִים', emoji: '🎵', color: '#8b5cf6' },
  { start: 71, say: 'חוֹקְרֵי הָעוֹלָם', emoji: '🌍', color: '#14b8a6' },
  { start: 81, say: 'הַמַּרְגִּיעִים', emoji: '🫧', color: '#06b6d4' },
  { start: 91, say: 'הַמִּסְפָּרִים הַגְּדוֹלִים', emoji: '💯', color: '#a855f7' },
]

// index into DECADES (and the decade.<n> i18n key) for a friend's 1-based NUMBER
export function decadeIndexForNumber(n: number): number {
  return Math.max(0, Math.min(DECADES.length - 1, Math.floor((n - 1) / 10)))
}
export function decadeForNumber(n: number): Decade {
  return DECADES[decadeIndexForNumber(n)]
}
