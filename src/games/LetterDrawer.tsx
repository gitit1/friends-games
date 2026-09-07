import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Confetti from '../components/Confetti'
import { LetterGuy } from './LetterGuy'
import { LETTER_BY_CH, LETTER_KEY, letterNameClip, letterSoundClip } from './LetterTalk'
import { useT } from '../i18n'
import { playPop, playSuccess, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { useGameLevel } from '../gameLevel'
import type { GameProps } from './registry'

// "אות במגירה" — a lost-and-found office. Cute objects ride in on a conveyor
// (an emoji + its name spoken); below sit a few drawers, each labelled with a big
// googly letter. The child taps the drawer of the object's FIRST letter → the
// drawer opens, the object hops in, and "תפוח מתחיל בְּ־תּ" is spoken. A wrong drawer
// stays gently closed and its letter just shakes its head — NO negative sound
// (errorless, research-backed). A sorted counter is the only score; no timer.
//
// Skill: word → its onset (first sound). אלוף adds a finals drawer that catches
// words ENDING in a final letter (ם ן ץ ף ך) — "בלון נגמר בְּ־ן". Reuses
// LetterTalk's letter data + the shared googly LetterGuy so every letter game
// pronounces + illustrates each letter identically.

type Word = { word: string; say: string; emoji: string }

// ~8 curated, clearly-picturable words per first-letter. Display is plain (no
// niqqud); `say` carries niqqud as a TTS hint (recording uses plain + IPA).
const BANK: Record<string, Word[]> = {
  א: [
    { word: 'אריה', say: 'אַריֵה', emoji: '🦁' }, { word: 'ארנב', say: 'אַרנָב', emoji: '🐰' },
    { word: 'אבטיח', say: 'אֲבַטִּיחַ', emoji: '🍉' }, { word: 'אוטובוס', say: 'אוֹטוֹבּוּס', emoji: '🚌' },
    { word: 'אורז', say: 'אוֹרֶז', emoji: '🍚' }, { word: 'אווז', say: 'אַוָּז', emoji: '🦢' },
    { word: 'אוזן', say: 'אוֹזֶן', emoji: '👂' }, { word: 'אוהל', say: 'אוֹהֶל', emoji: '⛺' },
  ],
  ב: [
    { word: 'בננה', say: 'בָּנָנָה', emoji: '🍌' }, { word: 'בלון', say: 'בָּלוֹן', emoji: '🎈' },
    { word: 'בית', say: 'בַּיִת', emoji: '🏠' }, { word: 'בקבוק', say: 'בַּקבּוּק', emoji: '🍼' },
    { word: 'ברווז', say: 'בַּרוָז', emoji: '🦆' }, { word: 'בצל', say: 'בָּצָל', emoji: '🧅' },
    { word: 'ביצה', say: 'בֵּיצָה', emoji: '🥚' }, { word: 'בורג', say: 'בּוֹרֶג', emoji: '🔩' },
  ],
  ג: [
    { word: 'גלידה', say: 'גלִידָה', emoji: '🍦' }, { word: 'גזר', say: 'גֶּזֶר', emoji: '🥕' },
    { word: 'גמל', say: 'גָּמָל', emoji: '🐫' }, { word: 'גיטרה', say: 'גִיטָרָה', emoji: '🎸' },
    { word: 'גרב', say: 'גֶּרֶב', emoji: '🧦' }, { word: 'גבינה', say: 'גבִינָה', emoji: '🧀' },
    { word: 'גלגל', say: 'גַּלגַּל', emoji: '🛞' }, { word: 'גדר', say: 'גָּדֵר', emoji: '🚧' },
  ],
  ד: [
    { word: 'דג', say: 'דָּג', emoji: '🐟' }, { word: 'דבש', say: 'דבַשׁ', emoji: '🍯' },
    { word: 'דלת', say: 'דֶּלֶת', emoji: '🚪' }, { word: 'דוב', say: 'דּוֹב', emoji: '🐻' },
    { word: 'דובדבן', say: 'דּוּבדְבָן', emoji: '🍒' }, { word: 'דלי', say: 'דּלִי', emoji: '🪣' },
    { word: 'דגל', say: 'דֶּגֶל', emoji: '🚩' }, { word: 'דלעת', say: 'דּלַעַת', emoji: '🎃' },
  ],
  כ: [
    { word: 'כלב', say: 'כֶּלֶב', emoji: '🐶' }, { word: 'כדור', say: 'כַּדּוּר', emoji: '⚽' },
    { word: 'כובע', say: 'כּוֹבַע', emoji: '🧢' }, { word: 'כתר', say: 'כֶּתֶר', emoji: '👑' },
    { word: 'כוכב', say: 'כּוֹכָב', emoji: '⭐' }, { word: 'כיסא', say: 'כִּסֵּא', emoji: '🪑' },
    { word: 'כרוב', say: 'כרוּב', emoji: '🥬' }, { word: 'כפית', say: 'כַּפִּית', emoji: '🥄' },
  ],
  ל: [
    { word: 'לימון', say: 'לִימוֹן', emoji: '🍋' }, { word: 'ליצן', say: 'לֵיצָן', emoji: '🤡' },
    { word: 'לוויתן', say: 'לוִייָתָן', emoji: '🐋' }, { word: 'לטאה', say: 'לטָאָה', emoji: '🦎' },
    { word: 'לגו', say: 'לֶגוֹ', emoji: '🧱' }, { word: 'לפת', say: 'לֶפֶת', emoji: '🥔' },
    { word: 'לוח', say: 'לוּחַ', emoji: '🪧' }, { word: 'לביבה', say: 'לבִיבָה', emoji: '🥞' },
  ],
  מ: [
    { word: 'מכונית', say: 'מכוֹנִית', emoji: '🚗' }, { word: 'מטרייה', say: 'מִטרִייָה', emoji: '☂️' },
    { word: 'מפתח', say: 'מַפתֵּחַ', emoji: '🔑' }, { word: 'מנורה', say: 'מנוֹרָה', emoji: '💡' },
    { word: 'מברשת', say: 'מִברֶשֶׁת', emoji: '🪥' }, { word: 'מזוודה', say: 'מִזווָדָה', emoji: '🧳' },
    { word: 'מסוק', say: 'מָסוֹק', emoji: '🚁' }, { word: 'מגדל', say: 'מִגדָּל', emoji: '🗼' },
  ],
  נ: [
    { word: 'נחש', say: 'נָחָשׁ', emoji: '🐍' }, { word: 'נר', say: 'נֵר', emoji: '🕯️' },
    { word: 'נמלה', say: 'נמָלָה', emoji: '🐜' }, { word: 'נעל', say: 'נַעַל', emoji: '👟' },
    { word: 'נמר', say: 'נָמֵר', emoji: '🐆' }, { word: 'נוצה', say: 'נוֹצָה', emoji: '🪶' },
    { word: 'נקניק', say: 'נַקנִיק', emoji: '🌭' }, { word: 'נשר', say: 'נֶשֶׁר', emoji: '🦅' },
  ],
  ר: [
    { word: 'רכבת', say: 'רַכֶּבֶת', emoji: '🚂' }, { word: 'רגל', say: 'רֶגֶל', emoji: '🦶' },
    { word: 'רובוט', say: 'רוֹבּוֹט', emoji: '🤖' }, { word: 'רדיו', say: 'רַדיוֹ', emoji: '📻' },
    { word: 'רמזור', say: 'רַמזוֹר', emoji: '🚦' }, { word: 'ראי', say: 'ראִי', emoji: '🪞' },
    { word: 'רוח', say: 'רוּחַ', emoji: '🌬️' }, { word: 'רכב', say: 'רֶכֶב', emoji: '🚙' },
  ],
  ש: [
    { word: 'שמש', say: 'שֶׁמֶשׁ', emoji: '☀️' }, { word: 'שועל', say: 'שוּעָל', emoji: '🦊' },
    { word: 'שלג', say: 'שֶׁלֶג', emoji: '🌨️' }, { word: 'שמלה', say: 'שִׂמלָה', emoji: '👗' },
    { word: 'שק', say: 'שַׂק', emoji: '🛍️' }, { word: 'שבלול', say: 'שַׁבּלוּל', emoji: '🐌' },
    { word: 'שולחן', say: 'שוּלחָן', emoji: '🪑' }, { word: 'שרביט', say: 'שַׁרבִיט', emoji: '🪄' },
  ],
}
const BANK_KEYS = Object.keys(BANK)

// אלוף — the finals drawer: words that END in a final letter (varied first
// letters so they don't collide with the shown first-letter drawers).
const FINALS_BANK: Word[] = [
  { word: 'לחם', say: 'לֶחֶם', emoji: '🍞' }, { word: 'בלון', say: 'בָּלוֹן', emoji: '🎈' },
  { word: 'שעון', say: 'שָׁעוֹן', emoji: '⏰' }, { word: 'עץ', say: 'עֵץ', emoji: '🌳' },
  { word: 'קוף', say: 'קוֹף', emoji: '🐵' }, { word: 'מלך', say: 'מֶלֶך', emoji: '🤴' },
  { word: 'כסף', say: 'כֶּסֶף', emoji: '💰' }, { word: 'חלון', say: 'חַלּוֹן', emoji: '🪟' },
  { word: 'עוף', say: 'עוֹף', emoji: '🐔' }, { word: 'גשם', say: 'גֶּשֶׁם', emoji: '🌧️' },
]
const FINAL_CHARS = ['ם', 'ן', 'ץ', 'ף', 'ך']
const FINALS = new Set(FINAL_CHARS)

// Recorded-clip id per bank word — `ld-word-<letter-slug>-<index>` for the
// first-letter drawers, `ld-word-final-<index>` for the finals drawer. Built
// once from the SAME bank arrays above, so it can never drift out of sync.
// Keep the id scheme in sync with scripts/gen-voice-batch2.mjs.
const WORD_CLIP: Record<string, string> = {}
for (const ch of BANK_KEYS) BANK[ch].forEach((w, i) => { WORD_CLIP[w.word] = `ld-word-${LETTER_KEY[ch]}-${i}` })
FINALS_BANK.forEach((w, i) => { WORD_CLIP[w.word] = `ld-word-final-${i}` })
const glyphs = (s: string) => [...s]
const lastCh = (s: string) => glyphs(s).slice(-1)[0]
const firstCh = (s: string) => glyphs(s)[0]
const endsInFinal = (w: string) => FINALS.has(lastCh(w))

const FIRST_COUNT = [2, 3, 4, 3] // first-letter drawers per tier (אלוף adds a finals drawer)
const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף — chosen via the header <LevelButton>

// baked dresser materials (real wood, grain, bevel, knobs, baked lighting/AO —
// see scripts/gen-letterdrawer-art.mjs + art/sprites/letterdrawer/LICENSES.md)
const ART = import.meta.env.BASE_URL + 'art/sprites/letterdrawer/'

type Drawer = { ch: string; kind: 'first' | 'final'; words: Word[] }
type Parcel = Word & { source: number } // the object on the conveyor + its correct drawer index

function randOf<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)]
}
function shuffle<T>(a: T[]): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export default function LetterDrawer({ onExit }: GameProps) {
  const { t, say, lang } = useT()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game — same as CoinSort).
  // The letter/match logic is unchanged; the tier only picks how many drawers
  // (קל = 2, and אלוף = 4 letters + the finals drawer for a real challenge).
  const [level] = useGameLevel('letterdrawer', LEVEL_TIERS)
  const tier = level
  const hasFinals = tier === 3

  const sortedRef = useRef(0)

  function makeDrawers(): Drawer[] {
    const letters = shuffle(BANK_KEYS).slice(0, FIRST_COUNT[tier])
    const drawers: Drawer[] = letters.map((ch) => ({ ch, kind: 'first', words: BANK[ch] }))
    if (hasFinals) drawers.push({ ch: 'finals', kind: 'final', words: FINALS_BANK })
    return drawers
  }

  // Pick the next object: choose a source drawer, then a word that unambiguously
  // belongs to it (finals words whose first letter isn't a shown drawer; first-
  // letter words that don't themselves end in a final when a finals drawer exists).
  function makeParcel(drawers: Drawer[], notWord?: string): Parcel {
    const shownFirst = new Set(drawers.filter((d) => d.kind === 'first').map((d) => d.ch))
    let guard = 0
    while (guard++ < 60) {
      const source = Math.floor(Math.random() * drawers.length)
      const d = drawers[source]
      let candidates = d.words
      if (d.kind === 'final') {
        candidates = d.words.filter((w) => !shownFirst.has(firstCh(w.word)))
      } else if (hasFinals) {
        candidates = d.words.filter((w) => !endsInFinal(w.word))
      }
      candidates = candidates.filter((w) => w.word !== notWord)
      if (candidates.length) {
        const w = randOf(candidates)
        return { ...w, source }
      }
    }
    // fallback: anything at all
    const source = Math.floor(Math.random() * drawers.length)
    return { ...randOf(drawers[source].words), source }
  }

  // one shared initial instance so the drawers + the first parcel agree
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => {
    const d = makeDrawers()
    return { drawers: d, parcel: makeParcel(d) }
  }, [])
  const [drawers, setDrawers] = useState<Drawer[]>(initial.drawers)
  const [parcel, setParcel] = useState<Parcel>(initial.parcel)
  const [parcelKey, setParcelKey] = useState(0) // remount → replay the arrival slide
  const [score, setScore] = useState(0)
  const [openIdx, setOpenIdx] = useState<number | null>(null) // the drawer opening
  const [shakeIdx, setShakeIdx] = useState<number | null>(null) // a wrong drawer's head-shake
  const [filing, setFiling] = useState(false) // the object hopping into the drawer
  const [hint, setHint] = useState(true) // pulse the object until the first tap
  const busy = useRef(false)

  function announce(w: Word) {
    unlockAudio()
    playClip(WORD_CLIP[w.word] ?? '', w.say)
  }

  // announce the first parcel's name when the office opens
  useEffect(() => {
    const id = window.setTimeout(() => announce(parcel), 550)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // switching difficulty from the header re-rolls a fresh set of drawers at the
  // new tier (skip the first render — the initial set is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    const d = makeDrawers()
    const p = makeParcel(d)
    setDrawers(d)
    setParcel(p)
    setParcelKey((k) => k + 1)
    setOpenIdx(null)
    setShakeIdx(null)
    setFiling(false)
    setHint(true)
    sortedRef.current = 0
    busy.current = false
    window.setTimeout(() => announce(p), 620)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function nextParcel(ds: Drawer[]) {
    const p = makeParcel(ds, parcel.word)
    setParcel(p)
    setParcelKey((k) => k + 1)
    setFiling(false)
    setOpenIdx(null)
    setHint(true)
    busy.current = false
    window.setTimeout(() => announce(p), 620)
  }

  function tap(i: number) {
    if (busy.current) return
    unlockAudio()
    setHint(false)
    if (i !== parcel.source) {
      // errorless: the drawer's letter shakes its head, nothing else
      setShakeIdx(i)
      window.setTimeout(() => setShakeIdx((s) => (s === i ? null : s)), 520)
      return
    }
    // correct → open the drawer, the object hops in, speak the reason
    busy.current = true
    playPop()
    setOpenIdx(i)
    setFiling(true)
    const d = drawers[i]
    const wordClip = WORD_CLIP[parcel.word] ?? ''
    if (d.kind === 'final') {
      const fin = LETTER_BY_CH[lastCh(parcel.word)]
      playClip(wordClip, parcel.say, () =>
        playClip('ld-ends', say('ld.ends'), () => { if (fin) playClip(letterNameClip(fin), fin.name) }),
      )
    } else {
      const first = LETTER_BY_CH[firstCh(parcel.word)]
      playClip(wordClip, parcel.say, () =>
        playClip('ld-starts', say('ld.starts'), () => { if (first) playClip(letterSoundClip(first), first.sound) }),
      )
    }
    window.setTimeout(() => playSuccess(), 300)
    setScore((s) => s + 1)
    sortedRef.current += 1
    window.setTimeout(() => {
      // every few objects, roll a fresh set of drawers for variety
      let ds = drawers
      if (sortedRef.current % 6 === 0) {
        ds = makeDrawers()
        setDrawers(ds)
      }
      nextParcel(ds)
    }, 1500)
  }

  return (
    <GameShell
      title={t('game.letterdrawer')}
      emoji="🗄️"
      onExit={onExit}
      levels={{ gameId: 'letterdrawer', tiers: LEVEL_TIERS }}
    >
      <Confetti active={filing} calm />

      <div className="score-pill" aria-label={t('ld.score', { n: score })}>
        <span aria-hidden="true">🗄️</span> {score}
      </div>

      <div className="center-body ld-wrap">
        <p className="ld-hint">{t('ld.hint')}</p>

        {/* the room: a calm muted playroom (baked backdrop) with the wooden
            dresser standing grounded on the floor, the waiting object above it */}
        <div className="ld-scene">
          <SceneBackdrop src="letterdrawer-room.jpg" position="center 64%" scrim="soft" />

          {/* the object waiting to be filed, arriving from the reading-start side */}
          <div className={`ld-conveyor ${lang}`}>
            <button
              className={`ld-parcel${filing ? ' is-filed' : ''}${hint ? ' hint' : ''}`}
              key={parcelKey}
              onClick={() => announce(parcel)}
              aria-label={parcel.word}
            >
              <span className="ld-parcel-emoji" aria-hidden="true">{parcel.emoji}</span>
            </button>
          </div>

          {/* the wooden chest of drawers — cabinet carcass (baked) with a drawer
              column stacked over the recessed well; each drawer keeps its big
              crisp letter (a finals drawer at אלוף) */}
          <div className="ld-dresser" style={{ backgroundImage: `url("${ART}cabinet.png")` }}>
            <div className="ld-column">
              {drawers.map((d, i) => (
                <button
                  key={`${d.ch}-${i}`}
                  className={`ld-drawer${openIdx === i ? ' is-open' : ''}${shakeIdx === i ? ' is-shake' : ''}`}
                  onClick={() => tap(i)}
                  aria-label={d.kind === 'final' ? t('ld.finalsAria') : (LETTER_BY_CH[d.ch]?.name ?? d.ch)}
                >
                  <span
                    className="ld-interior"
                    aria-hidden="true"
                    style={{ backgroundImage: `url("${ART}drawer-open.png")` }}
                  />
                  <span className="ld-face" style={{ backgroundImage: `url("${ART}drawer-face.png")` }}>
                    <span className="ld-knob ld-knob-l" aria-hidden="true" style={{ backgroundImage: `url("${ART}knob.png")` }} />
                    <span className="ld-knob ld-knob-r" aria-hidden="true" style={{ backgroundImage: `url("${ART}knob.png")` }} />
                    <span className="ld-letter">
                      {d.kind === 'final' ? (
                        <span className="ld-finals" aria-hidden="true">
                          {FINAL_CHARS.map((c) => (
                            <span key={c} className="ld-final-ch">{c}</span>
                          ))}
                        </span>
                      ) : (
                        <LetterGuy ch={d.ch} />
                      )}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
