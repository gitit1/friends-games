import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Confetti from '../components/Confetti'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import { useT } from '../i18n'
import { playDrum, playClap, playTap, unlockAudio } from '../audio'
import { speak } from '../speech'
import { playClip } from '../voice'
import { useGameLevel } from '../gameLevel'
import { screenScale, useViewport } from '../useViewport'
import type { GameProps } from './registry'

// "תופסים הברות" — syllable clapping, the evidence-based FIRST phonological skill
// (syllables come before single sounds). A picture + word appear; the word is
// spoken naturally once, then the child taps a friendly drum once per syllable —
// each tap bounces the drum, plays a soft tom, fills a syllable-dot, and speaks
// that syllable. The game GUIDES rather than tests: ANY tap advances the current
// syllable (errorless). When all are drummed, the friend claps + the word repeats.
//
// Voice recipe: words are DISPLAYED without niqqud (plain letters); syllable
// separation is carried only by the audio + dots. All spoken strings are plain
// text — TTS reads them approximately and recorded Narakeet clips make them exact.

type Word = {
  word: string // plain display (no niqqud)
  emoji: string // big picture (when it isn't a friend)
  syl: string[] // spoken syllables (plain); its length = the syllable count
  friend?: number // roster index → show the friend as the picture (אלוף tier)
}

// ~10 words per tier, cumulative (game rule): קל = 2 syllables · בינוני = 3 ·
// קשה = 4 · אלוף = friends' names (+ everything below → the biggest pool).
const EASY2: Word[] = [
  { word: 'בית', emoji: '🏠', syl: ['בה', 'ית'] },
  { word: 'ספר', emoji: '📖', syl: ['סה', 'פר'] },
  { word: 'כלב', emoji: '🐶', syl: ['כה', 'לב'] },
  { word: 'חתול', emoji: '🐱', syl: ['חה', 'תול'] },
  { word: 'שמש', emoji: '☀️', syl: ['שה', 'מש'] },
  { word: 'פרח', emoji: '🌸', syl: ['פה', 'רח'] },
  { word: 'עוגה', emoji: '🎂', syl: ['עו', 'גה'] },
  { word: 'כדור', emoji: '⚽', syl: ['כה', 'דור'] },
  { word: 'דלת', emoji: '🚪', syl: ['דה', 'לת'] },
  { word: 'ילד', emoji: '👦', syl: ['יה', 'לד'] },
]
const MED3: Word[] = [
  { word: 'מכונית', emoji: '🚗', syl: ['מה', 'כו', 'נית'] },
  { word: 'שוקולד', emoji: '🍫', syl: ['שו', 'קו', 'לד'] },
  { word: 'בננה', emoji: '🍌', syl: ['בה', 'נה', 'נה'] },
  { word: 'תפוח', emoji: '🍎', syl: ['תה', 'פו', 'אח'] },
  { word: 'אבטיח', emoji: '🍉', syl: ['אה', 'בה', 'טיח'] },
  { word: 'טלפון', emoji: '📞', syl: ['טה', 'לה', 'פון'] },
  { word: 'מטריה', emoji: '☂️', syl: ['מיט', 'רי', 'יה'] },
  { word: 'עוגיה', emoji: '🍪', syl: ['עו', 'גי', 'יה'] },
  { word: 'ענבים', emoji: '🍇', syl: ['עה', 'נה', 'בים'] },
  { word: 'אמבטיה', emoji: '🛁', syl: ['אם', 'בט', 'יה'] },
]
const HARD4: Word[] = [
  { word: 'טלוויזיה', emoji: '📺', syl: ['טה', 'לה', 'ויז', 'יה'] },
  { word: 'דינוזאור', emoji: '🦕', syl: ['די', 'נו', 'זה', 'אור'] },
  { word: 'מלפפון', emoji: '🥒', syl: ['מה', 'לה', 'פה', 'פון'] },
  { word: 'מספריים', emoji: '✂️', syl: ['מיס', 'פה', 'רה', 'ים'] },
  { word: 'קרוסלה', emoji: '🎠', syl: ['קה', 'רו', 'סה', 'לה'] },
  { word: 'טרמפולינה', emoji: '🤸', syl: ['טרם', 'פו', 'לי', 'נה'] },
  { word: 'כדורגל', emoji: '⚽', syl: ['כה', 'דו', 'רה', 'גל'] },
  { word: 'אופנוע', emoji: '🏍️', syl: ['או', 'פה', 'נו', 'עה'] },
  { word: 'מכוניות', emoji: '🚗', syl: ['מה', 'כו', 'ני', 'ות'] },
  { word: 'קלמנטינה', emoji: '🍊', syl: ['קלה', 'מן', 'טי', 'נה'] },
]
// אלוף — the friends themselves (a direct link to the child's special interest):
const NAMES: Word[] = [
  { word: 'לולו', emoji: '⭐', friend: 0, syl: ['לו', 'לו'] },
  { word: 'טוקי', emoji: '⭐', friend: 1, syl: ['טו', 'קי'] },
  { word: 'בובי', emoji: '⭐', friend: 2, syl: ['בו', 'בי'] },
  { word: 'גוגו', emoji: '⭐', friend: 3, syl: ['גו', 'גו'] },
  { word: 'דובי', emoji: '⭐', friend: 4, syl: ['דו', 'בי'] },
  { word: 'נוני', emoji: '⭐', friend: 5, syl: ['נו', 'ני'] },
  { word: 'זוזו', emoji: '⭐', friend: 8, syl: ['זו', 'זו'] },
  { word: 'קוקו', emoji: '⭐', friend: 9, syl: ['קו', 'קו'] },
  { word: 'מומו', emoji: '⭐', friend: 12, syl: ['מו', 'מו'] },
  { word: 'רומי', emoji: '⭐', friend: 20, syl: ['רו', 'מי'] },
]

const TIER_WORDS: Word[][] = [EASY2, MED3, HARD4, NAMES]
const POOLS = TIER_WORDS.map((_, i) => TIER_WORDS.slice(0, i + 1).flat())

// Difficulty axis = the WORD POOL by syllable count, wired to the header control
// (site-standard, like CoinSort). Cumulative — the natural axis this game already
// had, now switchable live:
//   קל (2 syllables, exactly as easy as before) · בינוני (+3) · קשה (+4) ·
//   אלוף (+ the friends' names → the biggest, hardest pool). No-fail throughout.
const LEVEL_TIERS = [0, 1, 2, 3]

// Recorded-clip ids for the SLOW, syllable-by-syllable reading — the one piece
// generic TTS can't approximate well (a real word reads fine on its own; a lone
// fragment like "בה" is ambiguous). `syl-<tier><wordIndex>-<syllableIndex>`,
// built once from the tier arrays above so it can't drift out of sync. Whole-word
// pronunciation (the picture/word appearing, and the 🔊 replay) still uses plain
// TTS. Keep the id scheme in sync with scripts/gen-voice-batch2.mjs.
const SYL_TIERS: [string, Word[]][] = [['e', EASY2], ['m', MED3], ['h', HARD4], ['n', NAMES]]
const SYL_ID = new Map<Word, string[]>()
for (const [code, arr] of SYL_TIERS) arr.forEach((w, i) => SYL_ID.set(w, w.syl.map((_, j) => `syl-${code}${i}-${j}`)))

function pick(pool: Word[], not?: Word): Word {
  if (pool.length < 2) return pool[0]
  let w = not
  while (w === not) w = pool[Math.floor(Math.random() * pool.length)]
  return w as Word
}

export default function Syllables({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting mapped through this game's tiers, then the child's choice
  // sticks per game). The pool grows with the level — the syllable count is the
  // real challenge, so this is the game's genuine difficulty axis.
  const [level] = useGameLevel('syllables', LEVEL_TIERS)
  const pool = POOLS[level]
  const [word, setWord] = useState<Word>(() => pick(pool))
  const [done, setDone] = useState(0) // syllables drummed so far
  const [clap, setClap] = useState(false) // finale: the friend claps
  const [hint, setHint] = useState(true) // pulse the drum until the first tap
  const [beat, setBeat] = useState(0) // bump to retrigger the drum bounce
  // buddy = the friend who drums along + claps. For a friend-name word it's that
  // same friend (also the picture); otherwise a rotating roster friend.
  const [buddy, setBuddy] = useState(0)

  const n = word.syl.length

  // Speak the whole word naturally when a new one appears.
  useEffect(() => {
    speak(word.word)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word])

  // Switching difficulty from the header serves a fresh word from the new pool
  // (skip the first render — the initial word is already picked above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    const w = pick(POOLS[level])
    setWord(w)
    setDone(0)
    setClap(false)
    setHint(true)
    setBeat(0)
    setBuddy(w.friend ?? Math.floor(Math.random() * 20))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function nextWord() {
    playTap()
    const w = pick(pool, word)
    setWord(w)
    setDone(0)
    setClap(false)
    setHint(true)
    setBeat(0) // remount the drum fresh so only the gentle "tap me" pulse plays
    setBuddy(w.friend ?? Math.floor(Math.random() * 20))
  }

  function drum() {
    if (clap || done >= n) return // ignore taps once the word is fully drummed
    unlockAudio()
    setHint(false)
    setBeat((b) => b + 1)
    const i = Math.min(done, n - 1)
    playDrum(i)
    // slow, syllable-by-syllable — the child drives the pace
    playClip(SYL_ID.get(word)?.[i] ?? '', word.syl[i])
    const next = done + 1
    setDone(next)
    if (next >= n) {
      // all syllables drummed → the friend claps + the word repeats, quick.
      window.setTimeout(() => {
        setClap(true)
        playClap()
        window.setTimeout(() => speak(word.word), 250)
      }, 480)
      window.setTimeout(nextWord, 2400)
    }
  }

  // The picture friend (for name words) claps; otherwise the side buddy claps.
  const bigFriend = word.friend != null
  const picIx = word.friend ?? 0
  const picScale = Math.min(120 * screenScale(vp.w), vp.w * 0.34) / friendMaxDim(picIx)
  const buddyScale = Math.min(62 * screenScale(vp.w), vp.w * 0.18) / friendMaxDim(buddy)

  return (
    <GameShell
      title={t('game.syllables')}
      emoji="🥁"
      onExit={onExit}
      levels={{ gameId: 'syllables', tiers: LEVEL_TIERS }}
    >
      <Confetti active={clap} />
      <p className="syl-hint">{t('syl.hint')}</p>

      {/* the stage: a warm playroom back plane, a framed picture card, the baked
          count-beads on a wooden rail, and the drum + buddy grounded on a rug.
          Every surface is baked raster art (texture + baked light/AO); only the
          Hebrew word + the friends stay crisp on top. */}
      <div className="syl-stage">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 34%" scrim="soft" />

        {/* framed picture card — the emoji/friend + the word (razor-legible CSS) */}
        <div className="syl-panel">
          <div className="syl-pic">
            {bigFriend ? (
              <Friend index={picIx} scale={picScale} showNumber={false} lively bouncing={clap} />
            ) : (
              <span className="syl-emoji" aria-hidden="true">{word.emoji}</span>
            )}
            <span className="syl-word" dir="rtl">{word.word}</span>
          </div>
        </div>

        {/* one baked bead per syllable, resting on a wooden rail — a socket-cup
            until the child drums it, then a glossy lit amber bead */}
        <div className="syl-rail">
          <div className="syl-dots" aria-hidden="true">
            {word.syl.map((_, i) => (
              <span key={i} className={`syl-dot${i < done ? ' is-on' : ''}`} />
            ))}
          </div>
        </div>

        {/* the drum + a buddy who drums along, grounded on a woven rug */}
        <div className="syl-floor">
          <span className="syl-rug" aria-hidden="true" />
          {!bigFriend && (
            <span className="syl-buddy">
              <Friend index={buddy} scale={buddyScale} showNumber={false} lively bouncing={clap} />
            </span>
          )}
          <button
            className={`syl-drum${hint ? ' hint' : ''}${beat ? ' hit' : ''}`}
            key={beat}
            onClick={drum}
            aria-label={t('syl.tap')}
          />
        </div>
      </div>

      <div className="syl-controls">
        <button className="syl-hear" onClick={() => { unlockAudio(); speak(word.word) }} aria-label={t('bs.replay')}>
          🔊
        </button>
        <button className="syl-next" onClick={nextWord}>
          {t('syl.next')}
        </button>
      </div>
    </GameShell>
  )
}
