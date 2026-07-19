// Hebrew letters with a picture whose name starts with that letter.
// Used by the letters quiz: show the picture, child picks the right letter.

export type LetterItem = {
  letter: string
  name: string // spoken letter name
  word: string // spoken word
  emoji: string
}

export const LETTERS: LetterItem[] = [
  { letter: 'א', name: 'אָלֶף', word: 'אריה', emoji: '🦁' },
  { letter: 'ב', name: 'בֵּית', word: 'בננה', emoji: '🍌' },
  { letter: 'ג', name: 'גִימֶל', word: 'גלידה', emoji: '🍦' },
  { letter: 'ד', name: 'דָלֶת', word: 'דג', emoji: '🐟' },
  { letter: 'ה', name: 'הֵא', word: 'הר', emoji: '⛰️' },
  { letter: 'ו', name: 'וָו', word: 'ורד', emoji: '🌹' },
  { letter: 'ז', name: 'זַיִן', word: 'זברה', emoji: '🦓' },
  { letter: 'ח', name: 'חֵית', word: 'חתול', emoji: '🐱' },
  { letter: 'ט', name: 'טֵית', word: 'טווס', emoji: '🦚' },
  { letter: 'י', name: 'יוֹד', word: 'ירח', emoji: '🌙' },
  { letter: 'כ', name: 'כָּף', word: 'כלב', emoji: '🐶' },
  { letter: 'ל', name: 'לָמֶד', word: 'לימון', emoji: '🍋' },
  { letter: 'מ', name: 'מֵם', word: 'מטוס', emoji: '✈️' },
  { letter: 'נ', name: 'נוּן', word: 'נחש', emoji: '🐍' },
  { letter: 'ס', name: 'סָמֶך', word: 'סוס', emoji: '🐴' },
  { letter: 'ע', name: 'עַיִן', word: 'עוגה', emoji: '🍰' },
  { letter: 'פ', name: 'פֵּא', word: 'פיל', emoji: '🐘' },
  { letter: 'צ', name: 'צָדִי', word: 'צב', emoji: '🐢' },
  { letter: 'ק', name: 'קוֹף', word: 'קוף', emoji: '🐵' },
  { letter: 'ר', name: 'רֵישׁ', word: 'רכבת', emoji: '🚂' },
  { letter: 'ש', name: 'שִׁין', word: 'שמש', emoji: '☀️' },
  { letter: 'ת', name: 'תָו', word: 'תפוח', emoji: '🍎' },
]
