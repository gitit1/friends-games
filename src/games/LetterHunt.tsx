import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { LETTER_BY_CH, letterNameClip, type Letter } from './LetterTalk'
import { useT } from '../i18n'
import { playPop, playSuccess, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { useGameLevel } from '../gameLevel'
import type { GameProps } from './registry'

// "מוצאים את האות" — a calm hunt-and-find. A warm wooden PLAY TABLE (baked art,
// seen at a gentle top-down angle so it reads 3D, against a muted greige wall) is
// scattered with real wooden ALPHABET BLOCKS — each a baked sprite (texture +
// baked lighting/AO + a carved painted panel + a contact shadow) with the Hebrew
// letter overlaid as crisp CSS text on the panel, razor-legible. The loudspeaker
// asks for one letter (its NAME spoken + the plain glyph shown big) and the child
// taps the matching block: the right one pops out, hops, and says its name; a
// wrong one just gives a gentle head-shake and stays put — NO negative sound
// (errorless, research-backed). A found counter is the only score; no timer, no
// way to lose. A friend sits on the table's near edge as a calm companion.

// Cumulative tiers (game rule: each level serves its items + all below), wired to
// the header star. Difficulty = how MANY blocks are hidden and how SIMILAR they
// look (the market's "more letters + trickier, look-alike distractors" ramp):
//   קל   = 3 hidden, VERY distinct letters
//   בינוני = 5 hidden
//   קשה  = 7 hidden, now including sound-/look-alikes (ב/כ, ר/ד…)
//   אלוף = 7 hidden, final letters join the pool too (ם ן ץ ף ך)
const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף (chosen via the header)
const TIER_CH: string[][] = [
  ['א', 'מ', 'ש', 'ל', 'ר', 'ו', 'ק', 'ה'],
  ['ב', 'ד', 'ג', 'נ', 'ס', 'ת'],
  ['כ', 'פ', 'צ', 'ז', 'ח', 'ט', 'ע', 'י'],
  ['ם', 'ן', 'ץ', 'ף', 'ך'],
]
const POOLS: Letter[][] = TIER_CH.map((_, i) =>
  TIER_CH.slice(0, i + 1).flat().map((c) => LETTER_BY_CH[c]),
)
const HIDDEN_FOR = [3, 5, 7, 7] // how many blocks are hidden in the scene, per tier

// Look-alike / sound-alike groups: at the harder tiers one distractor is seeded
// from the target's group so the hunt is a real "look carefully" (ב vs כ, ר vs ד).
const CONFUSE: string[][] = [
  ['ב', 'כ', 'נ'], ['ר', 'ד', 'ך'], ['ה', 'ח', 'ת'], ['ס', 'ם', 'ט'],
  ['ע', 'צ', 'ץ'], ['ו', 'ז', 'ן'], ['מ', 'ם'], ['נ', 'ן'], ['פ', 'ף'], ['כ', 'ך'],
]
const groupOf = (ch: string) => CONFUSE.find((g) => g.includes(ch)) ?? []

// The four baked block tints (a real toy-set variety, all muted/sensory-calm). The
// tint is decorative only — assigned by scatter position, NEVER by letter — so it
// gives no colour cue to the answer; the child must read the glyph.
const BLOCK_TINTS = ['cream', 'sage', 'sky', 'blush'] as const
const ART = import.meta.env.BASE_URL + 'art/sprites/letterhunt/'

// A calm friend companion sits on the table's near edge (identity kept, grounded).
const HELPER = 6

// Eight fixed, well-spread positions (percent within the scene box) that all sit ON
// the baked table top face, clear of the far wall, the near lip and the friend in
// the near-left corner. A subset is used each round so blocks never overlap.
const SPOTS: { top: number; left: number }[] = [
  { top: 30, left: 31 }, { top: 28, left: 66 },
  { top: 47, left: 49 }, { top: 44, left: 82 },
  { top: 50, left: 20 }, { top: 65, left: 38 },
  { top: 66, left: 72 }, { top: 80, left: 56 },
]

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
// a subtle depth scale: blocks nearer the front (higher top%) sit a touch larger.
const depthScale = (top: number) => 0.9 + (top / 100) * 0.26

type Hidden = { id: number; letter: Letter; tint: string; top: number; left: number }

export default function LetterHunt({ onExit }: GameProps) {
  const { t, say } = useT()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [tier] = useGameLevel('letterhunt', LEVEL_TIERS)
  const pool = POOLS[tier]
  const count = Math.min(HIDDEN_FOR[tier], SPOTS.length)

  const idRef = useRef(0)

  // Build one round: pick a target + (count-1) distinct distractors (one seeded
  // from the target's look-alike group at the harder tiers), scatter them onto a
  // shuffled subset of the fixed spots, each on a baked wooden block.
  function makeRound() {
    const target = randOf(pool)
    const chosen: Letter[] = [target]
    if (tier >= 2) {
      const twins = groupOf(target.ch).filter((c) => c !== target.ch && pool.some((l) => l.ch === c))
      if (twins.length) chosen.push(LETTER_BY_CH[randOf(twins)])
    }
    let guard = 0
    while (chosen.length < count && guard++ < 300) {
      const cand = randOf(pool)
      if (!chosen.some((l) => l.ch === cand.ch)) chosen.push(cand)
    }
    const spots = shuffle(SPOTS).slice(0, count)
    const tints = shuffle(BLOCK_TINTS.slice())
    const hidden: Hidden[] = shuffle(chosen).map((letter, i) => ({
      id: idRef.current++,
      letter,
      tint: tints[i % tints.length],
      top: spots[i].top,
      left: spots[i].left,
    }))
    return { target, hidden }
  }

  const [round, setRound] = useState(() => makeRound())
  const [found, setFound] = useState(0)
  const [poppedId, setPoppedId] = useState<number | null>(null)
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [cheer, setCheer] = useState(false)
  const [hint, setHint] = useState(true) // pulse the loudspeaker until the first tap

  // Ask for the target: its NAME (finals resolve to the twin's name via the data).
  function announce(letter: Letter) {
    unlockAudio()
    playClip('lh-where', say('lh.where'), () => playClip(letterNameClip(letter), letter.name))
  }

  // Announce the first target when the game opens.
  useEffect(() => {
    const id = window.setTimeout(() => announce(round.target), 500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching difficulty from the header re-scatters a fresh round at the new tier
  // (skip the first render — the initial round is already built above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    const r = makeRound()
    setRound(r)
    setPoppedId(null)
    setShakeId(null)
    setCheer(false)
    window.setTimeout(() => announce(r.target), 320)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  function nextRound() {
    const r = makeRound()
    setRound(r)
    setPoppedId(null)
    setCheer(false)
    window.setTimeout(() => announce(r.target), 480)
  }

  function tap(h: Hidden) {
    if (poppedId != null) return
    unlockAudio()
    setHint(false)
    if (h.letter.ch !== round.target.ch) {
      // errorless: a gentle head-shake and NOTHING else — no negative sound.
      setShakeId(h.id)
      window.setTimeout(() => setShakeId((s) => (s === h.id ? null : s)), 520)
      return
    }
    // correct → the block pops off the table, hops, and says its name
    playPop()
    setPoppedId(h.id)
    setFound((f) => f + 1)
    setCheer(true)
    playClip(letterNameClip(h.letter), h.letter.name)
    window.setTimeout(() => playSuccess(), 260)
    window.setTimeout(nextRound, 1500)
  }

  return (
    <GameShell
      title={t('game.letterhunt')}
      emoji="🔍"
      onExit={onExit}
      levels={{ gameId: 'letterhunt', tiers: LEVEL_TIERS }}
    >
      <Confetti active={cheer} calm />

      {/* score pill hugs the top leading edge; the scene fills the rest */}
      <div className="score-pill" aria-label={t('lh.score', { n: found })}>
        <span aria-hidden="true">🔍</span> {found}
      </div>

      <div className="center-body lh-wrap">
        {/* loudspeaker: asks for the target — its plain glyph shown BIG on a mini
            wooden block, echoing the blocks to find. Tap = ask again. */}
        <button
          className={`lh-speaker${hint ? ' hint' : ''}`}
          onClick={() => {
            unlockAudio()
            setHint(false)
            announce(round.target)
          }}
          aria-label={round.target.name}
        >
          <span className="lh-horn" aria-hidden="true">📣</span>
          <span
            className="lh-target"
            style={{ backgroundImage: `url("${ART}block-cream.png")` }}
          >
            <span className="lh-target-ch" dir="rtl" aria-hidden="true">{round.target.ch}</span>
          </span>
        </button>

        <p className="lh-hint">{t('lh.hint')}</p>

        {/* the calm scene: a baked wooden play-table (depth + real shadows), blocks
            scattered on it, a friend grounded on the near edge. */}
        <div className="lh-scene">
          <SceneBackdrop src="letterhunt-room.jpg" position="center 62%" scrim="none" />

          {round.hidden.map((h) => (
            <button
              key={h.id}
              className={`lh-block${poppedId === h.id ? ' is-popped' : ''}${
                shakeId === h.id ? ' is-shake' : ''
              }`}
              style={{
                top: `${h.top}%`,
                left: `${h.left}%`,
                '--z': depthScale(h.top),
              } as React.CSSProperties}
              onClick={() => tap(h)}
              aria-label={h.letter.name}
            >
              <span
                className="lh-block-art"
                style={{ backgroundImage: `url("${ART}block-${h.tint}.png")` }}
                aria-hidden="true"
              />
              <span className="lh-block-ch" dir="rtl" aria-hidden="true">{h.letter.ch}</span>
            </button>
          ))}

          {/* the calm companion — grounded on the near-left edge, identity kept */}
          <div className="lh-friend" aria-hidden="true">
            <Friend index={HELPER} scale={0.5} showNumber={false} />
          </div>
        </div>
      </div>
    </GameShell>
  )
}
