// Shared list of children's melodies — reusable across the dance game, the piano,
// and future games. Encoded as notes so they're generated in code (no audio
// files). Each note is [semitones from middle C (C4 = 0), beats].
//
// LICENSING: only PUBLIC-DOMAIN tunes (traditional / folk, copyright long
// expired). We deliberately DO NOT include still-copyrighted songs such as
// "I'm a Little Teapot" (1939), "I Can Sing a Rainbow" (1955), or "Hokey Cokey"
// (1949). Add a song only after checking its melody is public domain.
//
// We grow this list a few at a time and verify each one by ear in the app, so
// the notes are right before relying on it.
//
// ⏸ STATUS (paused 2026-06-09): 10 verified tunes are live (both dance + piano use
// this list). Adding more is ON HOLD until the user can listen — encoding melodies
// from memory produced wrong tunes (e.g. Wheels on the Bus), so we add ONE from
// SONG_QUEUE at a time, ear-check it, then the next. Do NOT bulk-add untested tunes.
// While music is paused we plan the rest of the roster instead — see
// docs/ROSTER-PLAN.md (gender + game + phrases for friends 12–100).

export type Note = [number, number]
export type Song = { id: string; label: string; bpm: number; notes: Note[] }

export const SONGS: Song[] = [
  // Twinkle Twinkle Little Star — same melody as Baa Baa Black Sheep & the
  // Alphabet song ("Ah! vous dirai-je, maman", 1761).
  {
    id: 'twinkle',
    label: 'כוכב קטן',
    bpm: 132,
    notes: [
      [0, 1], [0, 1], [7, 1], [7, 1], [9, 1], [9, 1], [7, 2],
      [5, 1], [5, 1], [4, 1], [4, 1], [2, 1], [2, 1], [0, 2],
      [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2],
      [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2],
      [0, 1], [0, 1], [7, 1], [7, 1], [9, 1], [9, 1], [7, 2],
      [5, 1], [5, 1], [4, 1], [4, 1], [2, 1], [2, 1], [0, 2],
    ],
  },
  // Frère Jacques (אחינו יעקב)
  {
    id: 'jacques',
    label: 'אחינו יעקב',
    bpm: 120,
    notes: [
      [0, 1], [2, 1], [4, 1], [0, 1], [0, 1], [2, 1], [4, 1], [0, 1],
      [4, 1], [5, 1], [7, 2], [4, 1], [5, 1], [7, 2],
      [7, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [4, 1], [0, 1],
      [7, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [4, 1], [0, 1],
      [0, 1], [-5, 1], [0, 2], [0, 1], [-5, 1], [0, 2],
    ],
  },
  // Old MacDonald Had a Farm (לדוד משה הייתה חווה)
  {
    id: 'macdonald',
    label: 'לדוד משה',
    bpm: 130,
    notes: [
      [7, 1], [7, 1], [7, 1], [2, 1], [4, 1], [4, 1], [2, 2],
      [11, 1], [11, 1], [9, 1], [9, 1], [7, 2],
      [2, 1], [7, 1], [7, 1], [7, 1], [2, 1], [4, 1], [4, 1], [2, 2],
    ],
  },
  // Mary Had a Little Lamb (טלה קטן)
  {
    id: 'mary',
    label: 'טלה קטן',
    bpm: 120,
    notes: [
      [4, 1], [2, 1], [0, 1], [2, 1], [4, 1], [4, 1], [4, 2],
      [2, 1], [2, 1], [2, 2], [4, 1], [7, 1], [7, 2],
      [4, 1], [2, 1], [0, 1], [2, 1], [4, 1], [4, 1], [4, 1], [4, 1],
      [2, 1], [2, 1], [4, 1], [2, 1], [0, 2],
    ],
  },
  // Row, Row, Row Your Boat (הסירה שלי)
  {
    id: 'row',
    label: 'הסירה שלי',
    bpm: 120,
    notes: [
      [0, 1], [0, 1], [0, 1.5], [2, 0.5], [4, 1.5],
      [4, 0.5], [2, 0.5], [4, 0.5], [5, 0.5], [7, 2],
      [12, 0.5], [12, 0.5], [7, 0.5], [7, 0.5], [4, 0.5], [4, 0.5], [0, 0.5], [0, 0.5],
      [7, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [0, 2],
    ],
  },
  // London Bridge Is Falling Down (גשר לונדון)
  {
    id: 'london',
    label: 'גשר לונדון',
    bpm: 120,
    notes: [
      [7, 1.5], [9, 0.5], [7, 1], [5, 1], [4, 1], [5, 1], [7, 2],
      [2, 1], [4, 1], [5, 2], [4, 1], [5, 1], [7, 2],
      [7, 1.5], [9, 0.5], [7, 1], [5, 1], [4, 1], [5, 1], [7, 2],
      [2, 2], [7, 1], [4, 1], [0, 2],
    ],
  },
  // Hot Cross Buns
  {
    id: 'hotcross',
    label: 'באנים חמים',
    bpm: 120,
    notes: [
      [4, 1], [2, 1], [0, 2], [4, 1], [2, 1], [0, 2],
      [0, 0.5], [0, 0.5], [0, 0.5], [0, 0.5], [2, 0.5], [2, 0.5], [2, 0.5], [2, 0.5],
      [4, 1], [2, 1], [0, 2],
    ],
  },
  // Three Blind Mice (שלושה עכברים עיוורים)
  {
    id: 'threeblind',
    label: 'שלושה עכברים',
    bpm: 120,
    notes: [
      [4, 1], [2, 1], [0, 2], [4, 1], [2, 1], [0, 2],
      [7, 1], [5, 0.5], [5, 0.5], [4, 2], [7, 1], [5, 0.5], [5, 0.5], [4, 2],
    ],
  },
  // Hänschen klein (יונתן הקטן)
  {
    id: 'yonatan',
    label: 'יונתן הקטן',
    bpm: 120,
    notes: [
      [7, 1], [4, 1], [4, 2], [5, 1], [2, 1], [2, 2],
      [0, 1], [2, 1], [4, 1], [5, 1], [7, 1], [7, 1], [7, 2],
      [7, 1], [4, 1], [4, 1], [4, 1], [5, 1], [2, 1], [2, 2],
      [0, 1], [4, 1], [7, 1], [7, 1], [4, 2], [0, 2],
    ],
  },
  // Rain, Rain, Go Away
  {
    id: 'rainrain',
    label: 'גשם גשם',
    bpm: 120,
    notes: [
      [7, 1], [4, 1], [7, 1], [4, 1], [7, 1], [7, 1], [4, 2],
      [7, 1], [4, 1], [7, 1], [4, 1], [4, 1], [2, 1], [0, 2],
    ],
  },
]

export const SONG_IDS = SONGS.map((s) => s.id)
export function getSong(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id)
}

// An emoji per song, for the pickers (dance pager, piano list). Missing → 🎵.
export const SONG_EMOJI: Record<string, string> = {
  twinkle: '⭐', jacques: '😴', macdonald: '🐄', mary: '🐑', row: '🚣', london: '🌉',
  hotcross: '🥯', threeblind: '🐭', yonatan: '🐦', rainrain: '🌧️',
  ode: '🎼', itsy: '🕷️', happy: '😊', bingo: '🐶', wheels: '🚌', muffin: '🧁', birthday: '🎂',
}
export const songEmoji = (id: string) => SONG_EMOJI[id] ?? '🎵'

// Public-domain tunes still TO ENCODE — kept here so nothing is forgotten. Each
// moves up into SONGS once its notes are written and checked by ear.
export const SONG_QUEUE: { id: string; label: string; note?: string }[] = [
  // candidates to add back ONE AT A TIME, each ear-checked before the next:
  { id: 'ode', label: 'אודה לשמחה' },
  { id: 'birthday', label: 'יום הולדת שמח' },
  { id: 'wheels', label: 'גלגלי האוטובוס' },
  { id: 'itsy', label: 'עכביש קטנטן' },
  { id: 'happy', label: 'אם טוב לך' },
  { id: 'bingo', label: 'בינגו' },
  { id: 'muffin', label: 'איש המאפינס' },
  { id: 'headshoulders', label: 'ראש, כתפיים, ברך ואצבעות' },
  { id: 'loobyloo', label: 'Here We Go Looby Loo' },
  { id: 'humpty', label: 'Humpty Dumpty' },
  { id: 'ladybug', label: 'Ladybug Ladybug' },
  { id: 'buckle', label: 'One, Two, Buckle My Shoe' },
  { id: 'patacake', label: 'Pat-a-cake' },
  { id: 'mountain', label: "She'll Be Coming 'Round the Mountain" },
  { id: 'kittens', label: 'Three Little Kittens' },
  { id: 'tweedle', label: 'Tweedledum and Tweedledee' },
  { id: 'downbay', label: 'Down by the Bay', note: 'verify melody is public domain (Raffi popularised it)' },
  { id: 'fingerfamily', label: 'Finger Family', note: 'verify melody origin is public domain' },
]

// NOT public domain — recorded here so we remember NOT to use them.
export const SONG_EXCLUDED: { label: string; reason: string }[] = [
  { label: "I'm a Little Teapot", reason: '1939 — still under copyright' },
  { label: 'I Can Sing a Rainbow', reason: '1955, Arthur Hamilton — copyrighted' },
  { label: 'Hokey Cokey / Hokey Pokey', reason: '1949 — disputed / likely copyrighted' },
]
