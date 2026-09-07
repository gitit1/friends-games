// Small shared helpers for the quiz-style games.

import { getSettings } from '../settings'

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// True when motion should be gentled: either the parent's in-app "calm motion"
// toggle OR the OS `prefers-reduced-motion` setting. Physics loops read this to
// drop decorative amplitudes ~70% and switch trails/particles off (the CSS side
// is already handled by the global `.reduce-motion *` freeze). Safe on SSR.
export function prefersReducedMotion(): boolean {
  const os =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return getSettings().reduceMotion || os
}

// Hebrew feminine number words WITH niqqud (vowel points), built from parts so
// it covers 1–59 correctly. Every place that reads a number ALOUD uses this; the
// niqqud is what makes a Hebrew TTS pronounce it right ("עֶשְׂרִים וּשְׁתַּיִם", not a
// mangled "20 2"). Nothing puts this on screen, so the marks are safe.
const NIQ_ONES = ['', 'אַחַת', 'שְׁתַּיִם', 'שָׁלוֹשׁ', 'אַרְבַּע', 'חָמֵשׁ', 'שֵׁשׁ', 'שֶׁבַע', 'שְׁמוֹנֶה', 'תֵּשַׁע']
const NIQ_TEENS = [
  'עֶשֶׂר', 'אַחַת עֶשְׂרֵה', 'שְׁתֵּים עֶשְׂרֵה', 'שְׁלוֹשׁ עֶשְׂרֵה', 'אַרְבַּע עֶשְׂרֵה', 'חֲמֵשׁ עֶשְׂרֵה',
  'שֵׁשׁ עֶשְׂרֵה', 'שְׁבַע עֶשְׂרֵה', 'שְׁמוֹנֶה עֶשְׂרֵה', 'תְּשַׁע עֶשְׂרֵה',
]
const NIQ_TENS: Record<number, string> = { 20: 'עֶשְׂרִים', 30: 'שְׁלוֹשִׁים', 40: 'אַרְבָּעִים', 50: 'חֲמִשִּׁים' }

export function numberWord(n: number): string {
  if (n >= 1 && n <= 9) return NIQ_ONES[n]
  if (n >= 10 && n <= 19) return NIQ_TEENS[n - 10]
  const tens = n - (n % 10)
  const unit = n % 10
  const tensWord = NIQ_TENS[tens]
  if (tensWord) {
    if (unit === 0) return tensWord
    // the vav is "וּ" before שתיים / שמונה (they start with a shva), else "וְ"
    const vav = unit === 2 || unit === 8 ? 'וּ' : 'וְ'
    return `${tensWord} ${vav}${NIQ_ONES[unit]}`
  }
  return String(n)
}

// kept as an alias so callers that explicitly asked for the vocalised form still work
export const numberWordNiqqud = numberWord

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickOne<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)]
}

// ---- perspective projection for the sports scenes ----
// The sports playfields read as a receding floor: things nearer the child sit low
// and big, things deep in the scene sit high and small. Depth `d` runs 0 (nearest,
// front of the field) → 1 (far horizon). These helpers PROJECT depth to screen
// space so a ball travelling "into" the scene shrinks and rises along one curve.
// Rendering only — hit-testing always stays in the untransformed logical plane.

// mild convex compression so the far half of the field bunches up (perspective),
// instead of a flat linear march into the distance.
function persp(d: number): number {
  const t = d < 0 ? 0 : d > 1 ? 1 : d
  return t * t * 0.36 + t * 0.64
}

// depth → size multiplier. Near (d=0) = 1, far horizon (d=1) = farScale.
export function projScale(d: number, farScale = 0.42): number {
  return 1 + (farScale - 1) * persp(d)
}

// full parametric projection for an object that travels a set path into the scene
// (e.g. the bowling roll). z 0..1 → { y: fraction of field height from the top,
// scale: size multiplier }. Multiply y by the field's pixel height to place it.
export function project(
  z: number,
  nearY = 0.86,
  farY = 0.16,
  farScale = 0.4,
): { y: number; scale: number } {
  const e = persp(z)
  return { y: nearY + (farY - nearY) * e, scale: 1 + (farScale - 1) * e }
}

// for physics games whose object lives in SCREEN space (a flick arc): given the
// object's screen-y and the near/far y-bands of the receding floor, recover its
// depth 0..1 so it can be distance-scaled as it flies toward the horizon.
export function depthFromY(y: number, nearY: number, farY: number): number {
  const d = (nearY - y) / (nearY - farY)
  return d < 0 ? 0 : d > 1 ? 1 : d
}

// Build `count` answer choices: the correct value plus nearby numeric distractors,
// all within [min, max], returned in random order.
export function numberChoices(correct: number, count: number, min: number, max: number): number[] {
  const choices = new Set<number>([correct])
  let guard = 0
  while (choices.size < count && guard < 200) {
    guard++
    const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1)
    const candidate = correct + delta
    if (candidate >= min && candidate <= max) choices.add(candidate)
  }
  // Fall back to filling sequentially if the range was too tight.
  for (let n = min; n <= max && choices.size < count; n++) choices.add(n)
  return shuffle([...choices])
}
