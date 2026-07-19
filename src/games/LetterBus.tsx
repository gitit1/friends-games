import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Confetti from '../components/Confetti'
import { LetterGuy } from './LetterGuy'
import { LETTER_BY_CH, letterNameClip, letterSoundClip, letterWordClip, type Letter } from './LetterTalk'
import { useT } from '../i18n'
import { playPop, playSuccess, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { useGameLevel } from '../gameLevel'
import type { GameProps } from './registry'

// baked street-scene materials (real, not CSS) — see art/sprites/letterbus/LICENSES.md
const SPR = import.meta.env.BASE_URL + 'art/sprites/letterbus/'
// per-game difficulty picked from the shared header control (קל · בינוני · קשה · אלוף)
const LEVEL_TIERS = [0, 1, 2, 3]

// "אוטובוס האותיות" — a friendly bus pulls up; a few letter-passengers (googly
// letter tiles, the shared LetterGuy) wait at the station. The loudspeaker
// announces a SOUND + acrophonic cue ("מי מתחיל בְּ־מְ… כמו מכונית 🚗") and the
// child taps the matching passenger: the right one hops aboard (soft chime + its
// name spoken) and waves through a window; a wrong one just gives a gentle
// head-shake and stays — NO negative sound (errorless, research-backed). When the
// bus is full it drives off slowly toward the reading-forward side (LEFT in
// Hebrew) with everyone waving + a calm celebration, then a fresh bus arrives.
//
// Skill taught: letter NAME → onset SOUND (Hebrew letter names are acrophonic —
// the name begins with the sound). Reuses LetterTalk's letter data model so every
// letter game pronounces + illustrates each letter identically.

// Curated, cumulative tiers (game rule: each level serves its items + all below):
//   קל = 6 very DISTINCT letters (shows 2 at a time, e.g. א / מ)
//   בינוני = + more everyday letters (3 at a time)
//   קשה = + the sound-alike partners so ב/פ and כ/ק can appear together (4 tiles)
//   אלוף = + final letters (ם ן ץ ף ך) — "ends with" cues, base↔final look-alikes
const TIER_CH: string[][] = [
  ['א', 'מ', 'ל', 'ש', 'ר', 'ו'],
  ['ד', 'נ', 'ב', 'ה', 'ג', 'י'],
  ['פ', 'כ', 'ק', 'ת', 'ס', 'ט', 'ז', 'ח', 'ע', 'צ'],
  ['ם', 'ן', 'ץ', 'ף', 'ך'],
]
const POOLS: Letter[][] = TIER_CH.map((_, i) =>
  TIER_CH.slice(0, i + 1).flat().map((c) => LETTER_BY_CH[c]),
)
const PASSENGERS_FOR = [2, 3, 4, 4] // how many wait at once, per tier
const GOAL_FOR = [4, 5, 6, 6] // boardings that fill a bus, per tier

// Look-alike / sound-alike groups: at the harder tiers one distractor is seeded
// from the target's group so the child must really listen (ב vs פ) or look
// (מ vs its final ם).
const CONFUSE: string[][] = [
  ['ב', 'פ', 'ף'], ['כ', 'ק', 'ך'], ['ד', 'ת', 'ט'], ['ס', 'ש', 'ז', 'צ', 'ץ'],
  ['מ', 'ם'], ['נ', 'ן'], ['ע', 'א', 'ה'], ['ר', 'ד'], ['ו', 'ז'],
]
const groupOf = (ch: string) => CONFUSE.find((g) => g.includes(ch)) ?? []

function randOf<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)]
}
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Rider = { id: number; letter: Letter }
type Bus = {
  wave: Rider[] // passengers currently waiting at the station
  boarded: Letter[] // who's already aboard (fills the windows)
  filled: number // boardings on THIS bus (0…goal)
  target: Letter | null // the passenger the loudspeaker is calling now
  leaving: boolean // driving off
}

export default function LetterBus({ onExit }: GameProps) {
  const { t, lang } = useT()
  // per-game difficulty from the shared header control: opens at the parent's
  // global setting, then the child's choice sticks per game. Higher = more
  // passengers waiting + a bigger bus to fill + sound/look-alike distractors.
  const [level] = useGameLevel('letterbus', LEVEL_TIERS)
  const pool = POOLS[level]
  const size = PASSENGERS_FOR[level]
  const goal = GOAL_FOR[level]

  const idRef = useRef(0)

  // Pick `count` distinct passengers, biasing one toward the target's look-alike
  // group at the tricky tiers. Returns the set + who to call first.
  function makeWave(count: number): { passengers: Rider[]; first: Letter } {
    const first = randOf(pool)
    const chosen: Letter[] = [first]
    if (level >= 2 && count >= 2) {
      const twins = groupOf(first.ch).filter((c) => c !== first.ch && pool.some((l) => l.ch === c))
      if (twins.length) chosen.push(LETTER_BY_CH[randOf(twins)])
    }
    let guard = 0
    while (chosen.length < count && guard++ < 200) {
      const cand = randOf(pool)
      if (!chosen.some((l) => l.ch === cand.ch)) chosen.push(cand)
    }
    const passengers = shuffle(chosen.slice()).map((letter) => ({ id: idRef.current++, letter }))
    return { passengers, first }
  }

  const [bus, setBus] = useState<Bus>(() => {
    const { passengers, first } = makeWave(Math.min(size, goal))
    return { wave: passengers, boarded: [], filled: 0, target: first, leaving: false }
  })
  const [score, setScore] = useState(0) // total boardings across buses (the pill)
  const [boardingId, setBoardingId] = useState<number | null>(null)
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [hint, setHint] = useState(true) // pulse the loudspeaker until the first tap

  // Say the loudspeaker cue: sound + acrophonic word. Finals never START a word,
  // so they're announced as "ends with…".
  function announce(letter: Letter) {
    unlockAudio()
    const leadId = letter.twin ? 'lbus-ends' : 'lbus-starts'
    const leadText = letter.twin ? t('lbus.ends') : t('lbus.starts')
    // built from 4 recorded fragments, chained so the whole cue plays as clips
    // when present (falls back to browser TTS fragment-by-fragment otherwise)
    playClip(leadId, leadText, () =>
      playClip(letterSoundClip(letter), letter.sound, () =>
        playClip('lbus-like', t('lbus.like'), () => playClip(letterWordClip(letter), letter.word)),
      ),
    )
  }

  // Announce the first passenger when the game opens.
  useEffect(() => {
    const id = window.setTimeout(() => bus.target && announce(bus.target), 500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching difficulty from the header rolls up a fresh bus at the new level
  // (more/less passengers, a bigger/smaller bus). Skip the first render — the
  // opening bus is already staged above. Never changes the letter/sound logic.
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    const { passengers, first } = makeWave(Math.min(size, goal))
    setBus({ wave: passengers, boarded: [], filled: 0, target: first, leaving: false })
    setBoardingId(null)
    setShakeId(null)
    setHint(true)
    const id = window.setTimeout(() => announce(first), 500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function newBus() {
    const { passengers, first } = makeWave(Math.min(size, goal))
    setBus({ wave: passengers, boarded: [], filled: 0, target: first, leaving: false })
    setBoardingId(null)
    setHint(true)
    window.setTimeout(() => announce(first), 500)
  }

  function tap(p: Rider) {
    if (bus.leaving || boardingId != null || !bus.target) return
    unlockAudio()
    setHint(false)
    if (p.letter.ch !== bus.target.ch) {
      // errorless: a gentle head-shake, and NOTHING else — no negative sound.
      setShakeId(p.id)
      window.setTimeout(() => setShakeId((s) => (s === p.id ? null : s)), 520)
      return
    }
    // correct → a happy hop, soft chime, and its name spoken as it boards
    playPop()
    setBoardingId(p.id)
    playClip(letterNameClip(p.letter), p.letter.name)
    window.setTimeout(() => {
      setBoardingId(null)
      const remaining = bus.wave.filter((w) => w.id !== p.id)
      const nextFilled = bus.filled + 1
      const nextBoarded = [...bus.boarded, p.letter]
      setScore((s) => s + 1)
      if (nextFilled >= goal) {
        // bus is full → drive off, wave, celebrate, then a fresh bus rolls up
        setBus({ wave: [], boarded: nextBoarded, filled: nextFilled, target: null, leaving: true })
        playSuccess()
        window.setTimeout(() => playClip('lbus-bye', t('lbus.bye')), 320)
        window.setTimeout(newBus, 2600)
      } else if (remaining.length === 0) {
        // this batch is aboard but the bus isn't full → a new batch walks up
        const { passengers, first } = makeWave(Math.min(size, goal - nextFilled))
        setBus({ wave: passengers, boarded: nextBoarded, filled: nextFilled, target: first, leaving: false })
        window.setTimeout(() => announce(first), 650)
      } else {
        // call the next waiting passenger
        const next = randOf(remaining).letter
        setBus({ wave: remaining, boarded: nextBoarded, filled: nextFilled, target: next, leaving: false })
        window.setTimeout(() => announce(next), 480)
      }
    }, 480)
  }

  return (
    <GameShell
      title={t('game.letterbus')}
      emoji="🚌"
      onExit={onExit}
      levels={{ gameId: 'letterbus', tiers: LEVEL_TIERS }}
    >
      <Confetti active={bus.leaving} calm />

      {/* score pill hugs the top leading edge; the scene centres in the rest */}
      <div className="score-pill" aria-label={t('lbus.score', { n: score })}>
        <span aria-hidden="true">🚌</span> {score}
      </div>

      <div className="center-body lbus-wrap">
        {/* loudspeaker: a wordless cue — the acrophonic word's picture. Tap to hear again.
            The gentle glow lives on the CUE (not the answer) so it guides the eye to
            what's being called without giving away which passenger to tap. */}
        <button
          className={`lbus-speaker${hint ? ' hint' : ''}`}
          onClick={() => {
            unlockAudio()
            setHint(false)
            if (bus.target) announce(bus.target)
          }}
          aria-label={t('bs.replay')}
        >
          <span className="lbus-horn" aria-hidden="true">📣</span>
          <span className="lbus-cue" aria-hidden="true">{bus.target ? bus.target.emoji : '🚌'}</span>
        </button>

        <p className="lbus-hint">{t('lbus.hint')}</p>

        {/* a real street diorama: town backdrop (far) → baked road + bus (mid) →
            near sidewalk with the bus-stop + waiting letters (near). The bus drives
            off toward the reading-forward side (left in he, right in en). */}
        <div className={`lbus-scene ${lang}`}>
          <SceneBackdrop src="town.jpg" position="center 64%" scrim="soft" />
          <img className="lbus-street" src={SPR + 'street.png'} alt="" aria-hidden="true" draggable={false} />
          <img className="lbus-stop" src={SPR + 'stop.png'} alt="" aria-hidden="true" draggable={false} />

          <div className={`lbus-bus${bus.leaving ? ' is-leaving' : ''}`} aria-hidden="true">
            {/* the baked bus body — mirrored (image only) in English so it faces its
                driving-forward side; the letters riding inside never mirror. */}
            <img className="lbus-bus-img" src={SPR + 'bus.png'} alt="" draggable={false} />
            <img className="lbus-wheel lbus-wheel-f" src={SPR + 'wheel.png'} alt="" draggable={false} />
            <img className="lbus-wheel lbus-wheel-r" src={SPR + 'wheel.png'} alt="" draggable={false} />
            {/* riders overlay the baked window band (crisp CSS letters, never baked) */}
            <div className="lbus-windows">
              {Array.from({ length: goal }).map((_, i) => (
                <span className="lbus-window" key={i}>
                  {bus.boarded[i] && (
                    <span className="lbus-rider" style={{ animationDelay: `${(i % 4) * 0.18}s` }}>
                      <LetterGuy ch={bus.boarded[i].ch} />
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* the station: the waiting passengers, big tap targets on the near sidewalk
            (they overlap up onto the diorama's kerb so they read as standing there) */}
        <div className="lbus-station">
          {bus.wave.map((p) => (
            <button
              key={p.id}
              className={`lbus-passenger${boardingId === p.id ? ' is-boarding' : ''}${
                shakeId === p.id ? ' is-shake' : ''
              }`}
              onClick={() => tap(p)}
              aria-label={p.letter.name}
            >
              <LetterGuy ch={p.letter.ch} className={boardingId === p.id ? '' : 'idle'} />
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  )
}
