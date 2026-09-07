import { useEffect, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { useT } from '../i18n'
import { playTap, playPop, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import type { GameProps } from './registry'

// "האות שלי מדברת" — pure cause-and-effect, zero demand. A big letter fills the
// screen; tapping it makes it come alive (googly eyes open, a gentle bounce) and
// SPEAK: its name (אָלֶף), its sound (אה), and an acrophonic word with a big
// emoji (אָלֶף — אַרְנָב 🐰). Nav arrows cycle letters in RTL order; a dice button
// jumps to a random one. No fail states, ever.
//
// Voice recipe: the letter NAME carries niqqud so TTS says "alef" (not "elef"),
// exactly like the existing letters game (WhichFriend). The DISPLAYED glyph and
// word are plain (no niqqud) per the Hebrew-literacy research. The sound + word
// spoken strings are plain — recorded clips (Narakeet) become the real voice.

// Shared with the sibling letter games (אוטובוס האותיות, מגדל השם שלי): they
// reuse this exact data model + the letter constants below, so every letter
// game pronounces + illustrates each letter identically.
export type Letter = {
  ch: string // the glyph shown on screen (plain, no niqqud)
  name: string // spoken letter name — niqqud for correct TTS ("אָלֶף")
  sound: string // spoken onset sound, plain ("אה" ≈ /a/, "בה" ≈ /b/…)
  word: string // acrophonic word, plain display (no niqqud)
  emoji: string
  twin?: string // final letters (ם ן ץ ף ך): the base letter they're a twin of
}

// The 22 base letters (+ 5 finals). Names match WhichFriend's LETTER_NAMES so the
// two letter games pronounce every letter identically.
const A: Letter = { ch: 'א', name: 'אָלֶף', sound: 'אה', word: 'ארנב', emoji: '🐰' }
const B: Letter = { ch: 'ב', name: 'בֵּית', sound: 'בה', word: 'בננה', emoji: '🍌' }
const G: Letter = { ch: 'ג', name: 'גִּימֶל', sound: 'גה', word: 'גלידה', emoji: '🍦' }
const D: Letter = { ch: 'ד', name: 'דָּלֶת', sound: 'דה', word: 'דג', emoji: '🐟' }
const H: Letter = { ch: 'ה', name: 'הֵא', sound: 'הה', word: 'הר', emoji: '⛰️' }
const V: Letter = { ch: 'ו', name: 'וָו', sound: 'וה', word: 'ורד', emoji: '🌹' }
const Z: Letter = { ch: 'ז', name: 'זַיִן', sound: 'זה', word: 'זברה', emoji: '🦓' }
const HET: Letter = { ch: 'ח', name: 'חֵית', sound: 'חה', word: 'חתול', emoji: '🐱' }
const TET: Letter = { ch: 'ט', name: 'טֵית', sound: 'טה', word: 'טרקטור', emoji: '🚜' }
const Y: Letter = { ch: 'י', name: 'יוּד', sound: 'יה', word: 'ירח', emoji: '🌙' }
const K: Letter = { ch: 'כ', name: 'כָּף', sound: 'כה', word: 'כלב', emoji: '🐶' }
const L: Letter = { ch: 'ל', name: 'לָמֶד', sound: 'לה', word: 'לימון', emoji: '🍋' }
const M: Letter = { ch: 'מ', name: 'מֵם', sound: 'מה', word: 'מכונית', emoji: '🚗' }
const N: Letter = { ch: 'נ', name: 'נוּן', sound: 'נה', word: 'נחש', emoji: '🐍' }
const S: Letter = { ch: 'ס', name: 'סָמֶךְ', sound: 'סה', word: 'סוס', emoji: '🐴' }
const AYIN: Letter = { ch: 'ע', name: 'עַיִן', sound: 'עה', word: 'עץ', emoji: '🌳' }
const P: Letter = { ch: 'פ', name: 'פֵּא', sound: 'פה', word: 'פיל', emoji: '🐘' }
const TS: Letter = { ch: 'צ', name: 'צָדִי', sound: 'צה', word: 'צב', emoji: '🐢' }
const Q: Letter = { ch: 'ק', name: 'קוּף', sound: 'קה', word: 'קוף', emoji: '🐵' }
const R: Letter = { ch: 'ר', name: 'רֵישׁ', sound: 'רה', word: 'רכבת', emoji: '🚂' }
const SH: Letter = { ch: 'ש', name: 'שִׁין', sound: 'שה', word: 'שמש', emoji: '☀️' }
const TAV: Letter = { ch: 'ת', name: 'תָּו', sound: 'תה', word: 'תות', emoji: '🍓' }

// Final ("sofit") letters — twins of their base letter, shown ending a word.
const FM: Letter = { ch: 'ם', name: 'מֵם', sound: 'מה', word: 'לחם', emoji: '🍞', twin: 'מ' }
const FN: Letter = { ch: 'ן', name: 'נוּן', sound: 'נה', word: 'בלון', emoji: '🎈', twin: 'נ' }
const FTS: Letter = { ch: 'ץ', name: 'צָדִי', sound: 'צה', word: 'עץ', emoji: '🌳', twin: 'צ' }
const FP: Letter = { ch: 'ף', name: 'פֵּא', sound: 'פה', word: 'קוף', emoji: '🐵', twin: 'פ' }
const FK: Letter = { ch: 'ך', name: 'כָּף', sound: 'כה', word: 'מלך', emoji: '👑', twin: 'כ' }

// Exports shared with אוטובוס האותיות + מגדל השם שלי so those games never
// duplicate the letter data (same names, sounds, acrophonic words, emojis).
export const BASE_LETTERS: Letter[] = [A, B, G, D, H, V, Z, HET, TET, Y, K, L, M, N, S, AYIN, P, TS, Q, R, SH, TAV]
export const FINAL_LETTERS: Letter[] = [FM, FN, FTS, FP, FK]
export const ALL_LETTERS: Letter[] = [...BASE_LETTERS, ...FINAL_LETTERS]
// glyph → Letter, and glyph → spoken name (finals resolve to their twin's name).
export const LETTER_BY_CH: Record<string, Letter> = Object.fromEntries(ALL_LETTERS.map((l) => [l.ch, l]))
export const LETTER_NAME: Record<string, string> = Object.fromEntries(ALL_LETTERS.map((l) => [l.ch, l.name]))

// Latin slug per glyph — ONLY used to build recorded-clip ids (never shown or
// spoken). Finals share their base twin's slug for NAME/SOUND (identical audio);
// WORD differs per glyph, so it's keyed by the glyph itself. Keep in sync with
// scripts/gen-voice-batch2.mjs.
export const LETTER_KEY: Record<string, string> = {
  א: 'alef', ב: 'bet', ג: 'gimel', ד: 'dalet', ה: 'he', ו: 'vav', ז: 'zayin',
  ח: 'het', ט: 'tet', י: 'yod', כ: 'kaf', ל: 'lamed', מ: 'mem', נ: 'nun',
  ס: 'samekh', ע: 'ayin', פ: 'pe', צ: 'tsadi', ק: 'qof', ר: 'resh', ש: 'shin', ת: 'tav',
  ם: 'mem-sof', ן: 'nun-sof', ץ: 'tsadi-sof', ף: 'pe-sof', ך: 'kaf-sof',
}
// Recorded-clip ids for a letter's NAME / onset SOUND / acrophonic WORD — shared
// by every letter game (LetterTalk, LetterBus, LetterHunt, NameTower, TraceHe,
// LetterDrawer) so they all reuse the SAME clips instead of re-recording them.
export const letterNameClip = (l: Letter) => `letter-name-${LETTER_KEY[l.twin ?? l.ch]}`
export const letterSoundClip = (l: Letter) => `letter-sound-${LETTER_KEY[l.twin ?? l.ch]}`
export const letterWordClip = (l: Letter) => `letter-word-${LETTER_KEY[l.ch]}`

// Cumulative difficulty (game rule: each level serves its items + all below):
//   קל = א-ה (5) · בינוני = א-י (11) · קשה = full 22 · אלוף = + final letters.
const TIER_LETTERS: Letter[][] = [
  [A, B, G, D, H],
  [V, Z, HET, TET, Y],
  [K, L, M, N, S, AYIN, P, TS, Q, R, SH, TAV],
  [FM, FN, FTS, FP, FK],
]
const POOLS = TIER_LETTERS.map((_, i) => TIER_LETTERS.slice(0, i + 1).flat())

// The letter is a real painted-WOODEN alphabet BLOCK (baked art, not a CSS square):
// eight muted boho tints, one stable tint per letter so every letter stays the same
// consistent little character. `block-N.png` is a 3/4-angle cube with baked wood
// grain, lighting/AO, bevel + contact shadow (public/art/sprites/lettertalk/).
const BLOCK_TINTS = 8
const blockFor = (i: number) => i % BLOCK_TINTS

// The big "living letter": a baked wooden block with two baked glossy googly EYES
// (a closed sleeping lid until it's tapped awake) and — the ONLY non-baked part —
// the razor-crisp CSS Hebrew GLYPH laid over the block's flat baked front face, so
// the letter is always pixel-sharp and legible on top of the material.
function LivingLetter({ letter, awake, index }: { letter: Letter; awake: boolean; index: number }) {
  return (
    <span className={`lt-block lt-block-${blockFor(index)}${awake ? ' is-awake' : ''}`}>
      <span className="lt-face" aria-hidden="true">
        <span className="lt-eye">
          <span className="lt-eye-open" />
          <span className="lt-eye-lid" />
        </span>
        <span className="lt-eye">
          <span className="lt-eye-open" />
          <span className="lt-eye-lid" />
        </span>
      </span>
      <span className="lt-ch" dir="rtl">{letter.ch}</span>
    </span>
  )
}

export default function LetterTalk({ onExit }: GameProps) {
  const { t } = useT()
  const pool = POOLS[levelForTier([0, 1, 2, 3], getSettings().difficulty)]
  const [idx, setIdx] = useState(0)
  const [awake, setAwake] = useState(false)
  const [bounce, setBounce] = useState(0) // bump to retrigger the one-shot bounce

  const letter = pool[idx % pool.length]

  // Reset the "asleep" state whenever the shown letter changes.
  useEffect(() => {
    setAwake(false)
  }, [idx])

  // Speak the same predictable sequence on every tap: name → sound → word.
  function wakeAndSpeak() {
    unlockAudio()
    playPop()
    setAwake(true)
    setBounce((b) => b + 1)
    if (letter.twin) {
      // finals live at the END of a word — teach the twin + a word that ends in it
      playClip(letterNameClip(letter), letter.name)
      window.setTimeout(() => playClip('lt-final-say', t('lt.final.say')), 1000)
      window.setTimeout(() => playClip(letterWordClip(letter), letter.word), 2050)
    } else {
      playClip(letterNameClip(letter), letter.name)
      window.setTimeout(() => playClip(letterSoundClip(letter), letter.sound), 950)
      window.setTimeout(
        () => playClip(letterNameClip(letter), letter.name, () => playClip(letterWordClip(letter), letter.word)),
        1950,
      )
    }
  }

  // RTL cycling: א sits first (on the right). "Previous" steps toward א (rightwards
  // → arrow), "next" steps onward through the alphabet (leftwards ← arrow).
  function go(delta: number) {
    playTap()
    setIdx((i) => (i + delta + pool.length) % pool.length)
  }
  function random() {
    playTap()
    setIdx((i) => {
      if (pool.length < 2) return i
      let r = i
      while (r === i) r = Math.floor(Math.random() * pool.length)
      return r
    })
  }

  return (
    <GameShell title={t('game.lettertalk')} emoji="🗣️" onExit={onExit}>
      <p className="lt-hint">{awake ? ' ' : t('lt.hint')}</p>

      {/* the row is pinned dir="rtl": the Hebrew alphabet reads right-to-left in BOTH
          UI languages, so "previous" (toward א) is always the right arrow and "next"
          the left one — stable whether the surrounding UI is he (RTL) or en (LTR). */}
      <div className="lt-stage" dir="rtl">
        {/* nav: prev toward א (→) sits on the right · next onward (←) on the left. */}
        <button className="lt-nav" onClick={() => go(-1)} aria-label={t('lt.prev')}>
          <span aria-hidden="true">→</span>
        </button>

        {/* a calm wooden-playroom scene: an ILLUSTRATED backdrop (warm wall + window
            + shelf) is clipped in the back plane; the baked wooden PLINTH and the
            letter block are siblings OVER it (not clipped), so the block rests
            grounded on the stand with its own baked contact shadow. */}
        <div className="lt-scene-box">
          <div className="lt-scene" aria-hidden="true">
            <SceneBackdrop src="wooden-playroom.jpg" position="center 32%" scrim="soft" />
          </div>
          <span className="lt-plinth" aria-hidden="true" />

          <button
            className={`lt-letter-btn${bounce ? ' hop' : ''}`}
            key={bounce}
            onClick={wakeAndSpeak}
            aria-label={letter.name}
          >
            <LivingLetter letter={letter} awake={awake} index={idx} />
            {letter.twin && (
              <span className="lt-twin" aria-hidden="true">
                <span className="lt-twin-label">{t('lt.final')}</span>
                <span className="lt-twin-eq">= {letter.twin}</span>
              </span>
            )}
          </button>
        </div>

        <button className="lt-nav" onClick={() => go(1)} aria-label={t('lt.next')}>
          <span aria-hidden="true">←</span>
        </button>
      </div>

      {/* the acrophonic word + big picture appear once the letter is awake */}
      <div className={`lt-word-card${awake ? ' is-shown' : ''}`} aria-hidden={!awake}>
        <span className="lt-word-emoji">{letter.emoji}</span>
        <span className="lt-word-text" dir="rtl">{letter.word}</span>
      </div>

      <div className="lt-controls">
        <button className="lt-dice" onClick={random} aria-label={t('lt.random')}>
          🎲
        </button>
      </div>
    </GameShell>
  )
}
