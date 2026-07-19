import { useEffect, useRef, useState, type CSSProperties } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { LETTER_BY_CH } from './LetterTalk'
import { useT } from '../i18n'
import { playClack, playTap, unlockAudio } from '../audio'
import { speak } from '../speech'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import type { GameProps } from './registry'

// "גלגל הצלילים" — a pure sound TOY (no task, no fail). Two gentle concentric
// wheels: the OUTER ring holds consonants (letter glyphs), the INNER ring holds
// the five Hebrew vowels shown as COLOURS ONLY — never as niqqud marks (the
// research's "audio-only vowels": the ear leads the eye). Spinning either wheel
// (tap a segment, or the ⟲ / ⟳ arrows) aligns a consonant with a vowel colour at
// the top pointer and SPEAKS the syllable ("בָּה", "בּוֹ", "בִּי"…). The display shows
// only the letter + the colour dot; the vowel lives entirely in the sound.
//
// COMMERCIAL-QUALITY MATERIALS: every surface is BAKED art (public/art/sprites/
// soundwheel/, CC0) — a real oak turntable with a lit raised rim, turned-wood
// grooves and a clicker-notch track; a maple vowel disc; domed painted-wood
// letter buttons; enamel vowel wells; a metal hub knob; a wooden clicker pointer
// with a baked shadow; and a wooden easel/stand with a grounded contact shadow
// (the game-show depth). Nothing here is a flat CSS conic-gradient or shape. Only
// the Hebrew LETTERS stay crisp CSS text, laid over the baked buttons so they are
// razor-legible and upright at rest. The spin is driven in rAF via refs (one
// transform write per frame, no per-frame React state) with a tick per segment.
//
// Voice recipe: the syllable's niqqud lives ONLY in the spoken string (never
// shown) as a TTS hint — exactly like LetterTalk's letter names. The recorded
// Narakeet clips use plain text + an IPA override per vowel (documented in
// docs/plan-2026-07/voice-lines-needed.md).

// The five vowel sounds → a calm, muted colour each (no neon). `core` is the
// niqqud appended to the consonant for the SPOKEN string only.
type Vowel = { id: string; color: string; core: string }
const VOWELS: Vowel[] = [
  { id: 'a', color: '#d98a8a', core: 'ָ' },   // patach/kamatz  → "בָּ" (ba)
  { id: 'e', color: '#86c7a1', core: 'ֶ' },   // segol          → "בֶּ" (be)
  { id: 'i', color: '#7fb2e0', core: 'ִי' },  // chirik         → "בִּי" (bi)
  { id: 'o', color: '#e6b877', core: 'וֹ' },  // cholam         → "בּוֹ" (bo)
  { id: 'u', color: '#b79ce0', core: 'וּ' },  // shuruk         → "בּוּ" (bu)
]

// Outer ring consonants, per difficulty. אלוף adds the final letters to the ring.
const OUTER_BASE = ['ב', 'מ', 'ש', 'ל', 'ר', 'נ', 'ס', 'ת']
const OUTER_FINALS = ['ם', 'ן', 'ץ', 'ף', 'ך']
const OUTER_COUNT = [6, 7, 8, 8]

// בכפ take a dagesh in the spoken string so the plosive (/b/ /k/ /p/) is heard,
// not the fricative (/v/ /kh/ /f/). Finals voice as their base twin (ם→מ …).
const HARD = new Set(['ב', 'כ', 'פ'])
function spokenSyllable(ch: string, v: Vowel): string {
  const base = LETTER_BY_CH[ch]?.twin ?? ch
  const dag = HARD.has(base) ? 'ּ' : ''
  return base + dag + v.core
}

// baked material paths (served straight from /public)
const SPR = import.meta.env.BASE_URL + 'art/sprites/soundwheel/'
const DOT_SRC: Record<string, string> = { a: 'dot-a', e: 'dot-e', i: 'dot-i', o: 'dot-o', u: 'dot-u' }
const MASCOT = 6 // a fixed friend, grounded beside the stand (identity kept)

function prefersReduced() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    (typeof document !== 'undefined' && document.body.classList.contains('reduce-motion'))
  )
}

export default function SoundWheel({ onExit }: GameProps) {
  const { t } = useT()
  const tier = levelForTier([0, 1, 2, 3], getSettings().difficulty)
  const outer = tier === 3 ? [...OUTER_BASE, ...OUTER_FINALS] : OUTER_BASE.slice(0, OUTER_COUNT[tier])

  const [selO, setSelO] = useState(0)
  const [selI, setSelI] = useState(0)

  const nO = outer.length
  const nI = VOWELS.length
  const stepO = 360 / nO
  const stepI = 360 / nI

  // The spin is driven imperatively (rAF → one `--spin` write per frame on the
  // disc element), never via per-frame React state. `ang*` hold the CONTINUOUS
  // angle so a wheel wrap takes the short path and keeps turning the same way.
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const angO = useRef(0)
  const angI = useRef(0)
  const rafO = useRef<number | null>(null)
  const rafI = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafO.current) cancelAnimationFrame(rafO.current)
      if (rafI.current) cancelAnimationFrame(rafI.current)
    }
  }, [])

  // Ease the disc to bring segment `target` under the top pointer, ticking once
  // per segment boundary crossed. Gentle ease-out (not a wild fast spin); under
  // reduced-motion it snaps softly with a single tick.
  function spinTo(kind: 'o' | 'i', target: number, step: number, n: number) {
    const el = kind === 'o' ? outerRef.current : innerRef.current
    const angRef = kind === 'o' ? angO : angI
    const rafRef = kind === 'o' ? rafO : rafI
    if (!el) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const curSeg = Math.round(-angRef.current / step)
    const fwd = (((target - (curSeg % n)) % n) + n) % n // 0..n-1 forward
    const deltaSeg = fwd > n / 2 ? fwd - n : fwd // short path (can be negative)
    const from = angRef.current
    const to = from - deltaSeg * step
    const steps = Math.abs(deltaSeg)

    if (steps === 0) {
      angRef.current = to
      el.style.setProperty('--spin', `${to}deg`)
      return
    }
    if (prefersReduced()) {
      angRef.current = to
      el.style.setProperty('--spin', `${to}deg`)
      playClack(0.4)
      return
    }

    const dur = Math.min(900, 240 + steps * 90)
    const t0 = performance.now()
    const ease = (u: number) => 1 - Math.pow(1 - u, 3) // ease-out cubic
    let lastCrossed = 0
    const frame = (now: number) => {
      const u = Math.min(1, (now - t0) / dur)
      const ang = from + (to - from) * ease(u)
      el.style.setProperty('--spin', `${ang}deg`) // the single per-frame write
      const crossed = Math.round(Math.abs(ang - from) / step)
      if (crossed > lastCrossed) {
        lastCrossed = crossed
        playClack(0.32)
      }
      if (u < 1) rafRef.current = requestAnimationFrame(frame)
      else {
        angRef.current = to
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  function sayPair(o: number, i: number) {
    unlockAudio()
    speak(spokenSyllable(outer[o], VOWELS[i]))
  }
  function pickOuter(o: number) {
    playTap()
    setSelO(o)
    spinTo('o', o, stepO, nO)
    sayPair(o, selI)
  }
  function pickInner(i: number) {
    playTap()
    setSelI(i)
    spinTo('i', i, stepI, nI)
    sayPair(selO, i)
  }
  function spinOuter(d: number) {
    const o = (selO + d + nO) % nO
    playTap()
    setSelO(o)
    spinTo('o', o, stepO, nO)
    sayPair(o, selI)
  }
  function spinInner(d: number) {
    const i = (selI + d + nI) % nI
    playTap()
    setSelI(i)
    spinTo('i', i, stepI, nI)
    sayPair(selO, i)
  }

  return (
    <GameShell title={t('game.soundwheel')} emoji="🎡" onExit={onExit}>
      <div className="center-body sw-wrap">
        <p className="sw-hint">{t('sw.hint')}</p>

        <div className="sw-stage">
          {/* illustrated back plane — a warm muted playroom (in-repo CC0 art) */}
          <SceneBackdrop src="wooden-playroom.jpg" position="center 34%" scrim="soft" />

          {/* the wooden easel the wheel is mounted on (baked; grounds the scene) */}
          <img className="sw-stand" src={`${SPR}stand.png`} alt="" aria-hidden="true" draggable={false} />

          {/* the wheel assembly — a slight forward tilt gives the game-show depth
              while the discs spin in their own plane so letters stay upright */}
          <div className="sw-assembly">
            <div className="sw-tilt">
              {/* OUTER disc — the oak turntable holding the consonant buttons */}
              <div
                ref={outerRef}
                className="sw-disc sw-disc-outer"
                style={{ '--step': `${stepO}deg`, '--r': 'calc(var(--D) * 0.375)' } as CSSProperties}
              >
                {outer.map((ch, i) => (
                  <button
                    key={ch}
                    className={`sw-seg${selO === i ? ' is-sel' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                    onClick={() => pickOuter(i)}
                    aria-label={LETTER_BY_CH[ch]?.name ?? ch}
                  >
                    <span className="sw-seg-in">
                      <span className={`sw-peg ${i % 2 ? 'pb' : 'pa'}`}>
                        <span className="sw-glyph" dir="rtl">{ch}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {/* INNER disc — the maple vowel wheel; colours only, no niqqud */}
              <div
                ref={innerRef}
                className="sw-disc sw-disc-inner"
                style={{ '--step': `${stepI}deg`, '--r': 'calc(var(--D) * 0.155)' } as CSSProperties}
              >
                {VOWELS.map((v, i) => (
                  <button
                    key={v.id}
                    className={`sw-seg${selI === i ? ' is-sel' : ''}`}
                    style={{ '--i': i } as CSSProperties}
                    onClick={() => pickInner(i)}
                    aria-label={t('sw.vowel')}
                  >
                    <span className="sw-seg-in">
                      <img className="sw-dot" src={`${SPR}${DOT_SRC[v.id]}.png`} alt="" aria-hidden="true" draggable={false} />
                    </span>
                  </button>
                ))}
              </div>

              {/* the hub knob: the current pair (letter + colour). Tap to replay. */}
              <button className="sw-hub" onClick={() => sayPair(selO, selI)} aria-label={t('bs.replay')}>
                <span className="sw-hub-glyph" dir="rtl" aria-hidden="true">{outer[selO]}</span>
                <img className="sw-hub-dot" src={`${SPR}${DOT_SRC[VOWELS[selI].id]}.png`} alt="" aria-hidden="true" draggable={false} />
              </button>

              {/* the clicker pointer marks the aligned pair at the top */}
              <img className="sw-pointer" src={`${SPR}pointer.png`} alt="" aria-hidden="true" draggable={false} />
            </div>
          </div>

          {/* a friend, grounded in-frame beside the stand (no-fail, identity kept) */}
          <span className="sw-mascot" aria-hidden="true">
            <Friend index={MASCOT} scale={0.48} showNumber={false} />
          </span>
        </div>

        {/* spin controls — one pair per wheel (⟲ back · ⟳ on) */}
        <div className="sw-controls">
          <div className="sw-ctl-group">
            <button className="sw-arrow" onClick={() => spinOuter(-1)} aria-label={t('sw.spinLetters')}>⟲</button>
            <span className="sw-ctl-label">{t('sw.letters')}</span>
            <button className="sw-arrow" onClick={() => spinOuter(1)} aria-label={t('sw.spinLetters')}>⟳</button>
          </div>
          <div className="sw-ctl-group">
            <button className="sw-arrow" onClick={() => spinInner(-1)} aria-label={t('sw.spinVowels')}>⟲</button>
            <span className="sw-ctl-label">{t('sw.vowels')}</span>
            <button className="sw-arrow" onClick={() => spinInner(1)} aria-label={t('sw.spinVowels')}>⟳</button>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
