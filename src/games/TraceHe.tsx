import { useEffect, useRef, useState, type CSSProperties } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Confetti from '../components/Confetti'
import { LetterGuy } from './LetterGuy'
import { BASE_LETTERS, FINAL_LETTERS, letterNameClip, letterSoundClip, letterWordClip, type Letter } from './LetterTalk'
import type { GameProps } from './registry'
import { playWin, playTap, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'

// "לצייר אות חיה" (Hebrew) — a Hebrew fork of the English "Trace a Letter". A big
// letter is shown faintly over a baked writing-page material (the light guide
// contrast lesson from QA is baked into .trace-guide, and its opacity now also
// rides the difficulty ramp — see GUIDE_OPACITY below); a glowing "start here"
// dot + a direction arrow show where the FIRST stroke begins and which way it
// heads (right-to-left / top-down Hebrew writing conventions — simple 1–2 stroke
// approximations). The child traces over it and a glowing rainbow trail follows.
// Once enough has been drawn the letter COMES ALIVE — a coloured googly-eyed
// character (the shared LetterGuy) — and says its NAME + its onset SOUND, with
// the acrophonic picture as a reward. Pure motor + letter-sound play: no timer,
// no losing — any tracing completes it.
//
// Reuses TraceLetter's tracing engine wholesale (canvas + pointer + length
// threshold — FROZEN, untouched) and LetterTalk's letter data (names, sounds,
// acrophonic words), so the Hebrew tracer pronounces + illustrates each letter
// identically. The commercial-quality pass adds (1) MATERIALS — the writing page
// and the desk backdrop are baked sprites (public/art/sprites/tracehe +
// art/bg/tracehe-desk.jpg), matching drawnum's "worksheet on a desk" family — and
// (2) a DIFFICULTY axis on the shared header, wired the same way as drawnum: the
// guide fades from bold (קל) to a faint ghost (אלוף), the canonical tracing-
// worksheet progression, cumulative & no-fail throughout.

// Cumulative tiers, like LetterTalk (each level serves its items + all below):
//   קל = א-ה · בינוני = + ו-י · קשה = full 22 · אלוף = + final letters.
const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף (chosen via the header)
const TIER_LETTERS: Letter[][] = [
  BASE_LETTERS.slice(0, 5),
  BASE_LETTERS.slice(5, 10),
  BASE_LETTERS.slice(10, 22),
  FINAL_LETTERS,
]
const POOLS = TIER_LETTERS.map((_, i) => TIER_LETTERS.slice(0, i + 1).flat())
// how much GUIDE the child gets — the same ramp as drawnum's GUIDE_OPACITY (bold
// guide → faint ghost). The letter itself is still always fully traceable; only
// the visual crutch fades. אלוף also drops the "start here" dot/arrow so the
// champion tier is traced largely from memory.
const GUIDE_OPACITY = [1, 0.78, 0.55, 0.32]
const SHOW_START_UNTIL = 3

// First-stroke hint per letter: where the pen STARTS (percent within the square)
// and which way the first stroke heads (deg: 0 = →, 90 = ↓, 180 = ←, 270 = ↑).
// Hebrew is written right-to-left, most letters starting at the top-right with a
// leftward top stroke or a downward stroke — simple approximations, as intended.
type Hint = { x: number; y: number; deg: number }
const HINTS: Record<string, Hint> = {
  א: { x: 70, y: 26, deg: 135 }, ב: { x: 72, y: 24, deg: 180 }, ג: { x: 56, y: 26, deg: 100 },
  ד: { x: 74, y: 24, deg: 180 }, ה: { x: 74, y: 24, deg: 180 }, ו: { x: 52, y: 18, deg: 90 },
  ז: { x: 60, y: 24, deg: 100 }, ח: { x: 74, y: 24, deg: 180 }, ט: { x: 40, y: 28, deg: 90 },
  י: { x: 56, y: 26, deg: 110 }, כ: { x: 70, y: 24, deg: 180 }, ל: { x: 56, y: 16, deg: 90 },
  מ: { x: 44, y: 26, deg: 95 }, נ: { x: 66, y: 24, deg: 180 }, ס: { x: 58, y: 22, deg: 180 },
  ע: { x: 68, y: 26, deg: 225 }, פ: { x: 72, y: 24, deg: 180 }, צ: { x: 70, y: 24, deg: 225 },
  ק: { x: 72, y: 24, deg: 180 }, ר: { x: 74, y: 24, deg: 180 }, ש: { x: 40, y: 26, deg: 90 },
  ת: { x: 74, y: 24, deg: 180 },
  ם: { x: 60, y: 22, deg: 180 }, ן: { x: 52, y: 16, deg: 90 }, ץ: { x: 66, y: 22, deg: 225 },
  ף: { x: 66, y: 20, deg: 180 }, ך: { x: 66, y: 20, deg: 180 },
}
const DEFAULT_HINT: Hint = { x: 72, y: 24, deg: 180 }

const TRAIL = ['#fb7185', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6']

function pickIndex(pool: Letter[], notCh?: string): number {
  if (pool.length < 2) return 0
  let i = 0
  do {
    i = Math.floor(Math.random() * pool.length)
  } while (pool[i].ch === notCh)
  return i
}

export default function TraceHe({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  // the tracing area is ALL play surface for this game (no shrinking touch targets) —
  // keep the same 0.86-of-viewport / 360 cap sizing as before the art pass
  const size = Math.round(Math.min(vp.w * 0.86, 360))
  const [level] = useGameLevel('tracehe', LEVEL_TIERS)
  const pool = POOLS[level] ?? POOLS[0]
  const guide = GUIDE_OPACITY[level] ?? 1
  const showStartTier = level < SHOW_START_UNTIL
  const [idx, setIdx] = useState(() => pickIndex(pool))
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false) // hides the "start here" dot once tracing begins
  const letter = pool[idx % pool.length]
  const hint = HINTS[letter.ch] ?? DEFAULT_HINT

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const len = useRef(0)
  const doneRef = useRef(false)
  const hueRef = useRef(0)
  const THRESH = size * 1.4 // how much tracing "completes" the letter

  // say the letter to trace at the start of each round (its name)
  useEffect(() => {
    const id = window.setTimeout(() => playClip(letterNameClip(letter), letter.name), 350)
    return () => window.clearTimeout(id)
  }, [letter])

  // reset the canvas when the letter (or size) changes
  useEffect(() => {
    const c = canvasRef.current
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    len.current = 0
    doneRef.current = false
    last.current = null
    setStarted(false)
  }, [letter, size])

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function start(e: React.PointerEvent) {
    if (doneRef.current) return
    unlockAudio()
    drawing.current = true
    last.current = pos(e)
    setStarted(true)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || doneRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    const p = pos(e)
    const l = last.current
    if (ctx && l) {
      hueRef.current += 6
      ctx.strokeStyle = TRAIL[Math.floor(hueRef.current / 18) % TRAIL.length]
      ctx.lineWidth = 16
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowBlur = 14
      ctx.shadowColor = ctx.strokeStyle
      ctx.beginPath()
      ctx.moveTo(l.x, l.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      len.current += Math.hypot(p.x - l.x, p.y - l.y)
      if (len.current > THRESH) complete()
    }
    last.current = p
  }
  function end() {
    drawing.current = false
    last.current = null
  }
  function complete() {
    if (doneRef.current) return
    doneRef.current = true
    drawing.current = false
    setDone(true)
    playWin()
    // the letter comes alive: say its NAME, then its onset SOUND
    playClip(letterNameClip(letter), letter.name)
    window.setTimeout(() => playClip(letterSoundClip(letter), letter.sound), 950)
  }
  function newLetter() {
    playTap()
    setDone(false)
    setIdx((i) => pickIndex(pool, pool[i % pool.length].ch))
  }

  return (
    <GameShell title={t('game.tracehe')} emoji="✍️" onExit={onExit} levels={{ gameId: 'tracehe', tiers: LEVEL_TIERS }}>
      <Confetti active={done} />
      <p className="fl-q" aria-hidden="true">{done ? '' : t('trace.hint')}</p>

      {/* the desk SCENE — a warm angled wooden desk (baked backdrop, drawnum's
          sibling) that the writing page rests on, giving the tracer real depth */}
      <div className="th-scene">
        <SceneBackdrop src="tracehe-desk.jpg" position="center 55%" scrim="soft" />

        <div className="th-page">
          <div className="trace-area" style={{ width: size, height: size }}>
            <span
              className={`trace-guide${done ? ' is-hidden' : ''}`}
              dir="rtl"
              aria-hidden="true"
              style={{ opacity: done ? 0 : guide }}
            >
              {letter.ch}
            </span>

            {/* first-stroke guide: a glowing start dot + a direction arrow — the
                difficulty ramp hides this too at אלוף, traced from memory */}
            {!done && !started && showStartTier && (
              <>
                <span
                  className="trace-start-dot"
                  aria-hidden="true"
                  style={{ top: `${hint.y}%`, left: `${hint.x}%`, transform: 'translate(-50%, -50%)' }}
                />
                <span
                  className="traceh-arrow"
                  aria-hidden="true"
                  style={{ top: `${hint.y}%`, left: `${hint.x}%`, '--deg': `${hint.deg}deg` } as CSSProperties}
                />
              </>
            )}

            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              className="trace-canvas"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />

            {/* completed → the letter comes alive as a googly-eyed character */}
            {done && (
              <span className="traceh-alive" aria-hidden="true">
                <LetterGuy ch={letter.ch} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* the acrophonic reward picture + word appears once the letter is alive */}
      <div className={`traceh-reward${done ? ' is-shown' : ''}`} aria-hidden={!done}>
        <span className="traceh-reward-emoji">{letter.emoji}</span>
        <span className="traceh-reward-word" dir="rtl">{letter.word}</span>
      </div>

      <div className="spell-foot">
        <button
          className="pill spell-say"
          onClick={() => {
            unlockAudio()
            if (done) playClip(letterNameClip(letter), letter.name, () => playClip(letterWordClip(letter), letter.word))
            else playClip(letterNameClip(letter), letter.name)
          }}
          aria-label={t('bs.replay')}
        >
          🔊
        </button>
        <button className="big-button" onClick={newLetter}>
          🔄 {t('trace.next')}
        </button>
      </div>
    </GameShell>
  )
}
