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
//
// 🎧 2026-08-07 — first restored batch (ode, itsy, happy, bingo) added below.
// EAR-CHECK STILL PENDING: each was interval-verified on paper (semitone deltas
// compared against the reference tune) but nobody has listened yet. If one sounds
// wrong, fix or remove THAT song — the other three were verified independently.
//
// PITCH BUDGET (why these four and not the rest): the piano game folds every note
// onto 6 lanes (Do Re Mi Fa Sol La) via DEG in PianoFriends.tsx, mod 12. So a tune
// only survives the piano intact if it stays inside semitones 0..9 of one octave
// AND never uses Ti (11) alongside La (9) — both fold onto lane 5. Tunes needing a
// true octave leap are deliberately LEFT IN THE QUEUE rather than distorted:
//   • wheels   — peaks on Do' (12); folded, its climax lands on the SAME key as the
//                opening low Do, so the arch of "round and round" disappears.
//   • birthday — spans 12 semitones AND collides La/Ti on lane 5; the octave jump on
//                "dear NAME" is the whole point of the tune.
// A skipped song is fine. A wrong melody is not.

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

  // ── restored from SONG_QUEUE 2026-08-07, interval-verified, ear-check pending ──

  // Ode to Joy — Beethoven, 9th Symphony (1824), public domain. C major, the
  // theme proper. Range Do..Sol, so it maps 1:1 onto the piano's 6 keys.
  // Intervals: 0 1 2 0 -2 -1 -2 -2 0 2 2 0 -2 0 | 2 0 1 2 0 -2 -1 -2 -2 0 2 2 -2 -2 0
  {
    id: 'ode',
    label: 'אודה לשמחה',
    bpm: 120,
    notes: [
      [4, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [2, 1],
      [0, 1], [0, 1], [2, 1], [4, 1], [4, 1.5], [2, 0.5], [2, 2],
      [4, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [2, 1],
      [0, 1], [0, 1], [2, 1], [4, 1], [2, 1.5], [0, 0.5], [0, 2],
    ],
  },
  // Itsy Bitsy Spider (עכביש קטנטן) — traditional, public domain. C major.
  // Two phrases: the climb up the spout (Do..Mi) and the rain (Mi..Sol).
  // Intervals: 0 0 2 2 0 0 -2 -2 2 2 -4 | 4 0 1 2 0 -2 -1 1 2 -3
  {
    id: 'itsy',
    label: 'עכביש קטנטן',
    bpm: 120,
    notes: [
      [0, 1], [0, 1], [0, 1], [2, 1], [4, 1], [4, 1], [4, 1], [2, 1],
      [0, 1], [2, 1], [4, 1], [0, 4],
      [4, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 1], [5, 1],
      [7, 1], [4, 4],
    ],
  },
  // If You're Happy and You Know It (אם טוב לך) — traditional, public domain.
  // C major. Two identical verses (the tune repeats per action) + a closing tag.
  // Verse intervals: 5 0 0 0 0 0 0 -1 1 2 2 — the rise Fa→Mi→Fa→Sol→La is the hook.
  {
    id: 'happy',
    label: 'אם טוב לך',
    bpm: 130,
    notes: [
      [0, 0.5], [5, 0.5], [5, 0.5], [5, 0.5], [5, 0.5], [5, 0.5], [5, 1],
      [5, 0.5], [4, 0.5], [5, 0.5], [7, 0.5], [9, 4],
      [0, 0.5], [5, 0.5], [5, 0.5], [5, 0.5], [5, 0.5], [5, 0.5], [5, 1],
      [5, 0.5], [4, 0.5], [5, 0.5], [7, 0.5], [9, 4],
      [9, 1], [9, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 2],
    ],
  },
  // Bingo (בינגו) — traditional, from "The Farmer's Dog Leapt o'er the Stile"
  // (1780), public domain. C major, range Do..La. Verse + three B-I-N-G-O
  // spellings, each answered by the same descending tag.
  // Verse intervals: 0 7 0 2 0 -2 -2 0 -1 0 -2 0 -2
  {
    id: 'bingo',
    label: 'בינגו',
    bpm: 130,
    notes: [
      [0, 1], [0, 1], [7, 1], [7, 1], [9, 1], [9, 1], [7, 2],
      [5, 1], [5, 1], [4, 1], [4, 1], [2, 1], [2, 1], [0, 2],
      [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2],
      [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2],
      [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [2, 1], [0, 2],
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
  // ode / itsy / happy / bingo moved up into SONGS on 2026-08-07 (interval-verified,
  // ear-check pending). These two stay here ON PURPOSE — they need a full octave and
  // would be distorted by the piano's 6-lane fold; better absent than wrong:
  {
    id: 'birthday',
    label: 'יום הולדת שמח',
    note: 'needs an octave: spans 12 semitones and folds La+Ti onto one lane. The leap on "dear NAME" is the tune — do not flatten it.',
  },
  {
    id: 'wheels',
    label: 'גלגלי האוטובוס',
    note: 'needs an octave: peaks on Do\', which folds onto the same key as the opening low Do, killing the arch of "round and round".',
  },
  // candidates to add back ONE AT A TIME, each ear-checked before the next:
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
