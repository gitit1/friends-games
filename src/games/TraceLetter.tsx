import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playWin, playTap, unlockAudio } from '../audio'
import { speakEn } from '../speech'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'

// "Trace a living letter" (English) — a big letter is shown faintly; the child
// traces over it with a finger and a glowing rainbow trail follows. Once enough
// has been drawn the letter comes to life as an animal/object that starts with it
// (S → 🐍, "S is for snake"), with a cheer. Pure motor + letter-sound play, no
// timer, no losing — any tracing works.
type Item = { emoji: string; word: string }
const ITEMS: Record<string, Item> = {
  A: { emoji: '🐜', word: 'ant' }, B: { emoji: '🐻', word: 'bear' }, C: { emoji: '🐱', word: 'cat' },
  D: { emoji: '🐶', word: 'dog' }, E: { emoji: '🥚', word: 'egg' }, F: { emoji: '🦊', word: 'fox' },
  G: { emoji: '🐐', word: 'goat' }, H: { emoji: '🎩', word: 'hat' }, I: { emoji: '🍦', word: 'ice cream' },
  J: { emoji: '🫙', word: 'jar' }, K: { emoji: '🪁', word: 'kite' }, L: { emoji: '🦁', word: 'lion' },
  M: { emoji: '🌙', word: 'moon' }, N: { emoji: '🥜', word: 'nut' }, O: { emoji: '🐙', word: 'octopus' },
  P: { emoji: '🐷', word: 'pig' }, Q: { emoji: '👑', word: 'queen' }, R: { emoji: '🌈', word: 'rainbow' },
  S: { emoji: '🐍', word: 'snake' }, T: { emoji: '🐯', word: 'tiger' }, U: { emoji: '☂️', word: 'umbrella' },
  V: { emoji: '🎻', word: 'violin' }, W: { emoji: '🐋', word: 'whale' }, X: { emoji: '🩻', word: 'x-ray' },
  Y: { emoji: '🪀', word: 'yo-yo' }, Z: { emoji: '🦓', word: 'zebra' },
}
const LETTERS = Object.keys(ITEMS)
const TRAIL = ['#fb7185', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6']

export default function TraceLetter({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const size = Math.round(Math.min(vp.w * 0.86, 360))
  const [letter, setLetter] = useState(() => LETTERS[Math.floor(Math.random() * LETTERS.length)])
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false) // hides the "start here" dot once tracing begins
  const item = ITEMS[letter]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const len = useRef(0)
  const doneRef = useRef(false)
  const hueRef = useRef(0)
  const THRESH = size * 1.4 // how much tracing "completes" the letter

  // say the letter to trace at the start of each round
  useEffect(() => {
    const id = window.setTimeout(() => speakEn(letter), 350)
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
    speakEn(`${letter} is for ${item.word}`)
  }
  function newLetter() {
    playTap()
    setDone(false)
    let next = letter
    while (next === letter) next = LETTERS[Math.floor(Math.random() * LETTERS.length)]
    setLetter(next)
  }

  return (
    <GameShell title={t('game.trace')} emoji="✏️" onExit={onExit}>
      <Confetti active={done} />
      <p className="fl-q" aria-hidden="true">{done ? '' : t('trace.hint')}</p>

      <div className="trace-area" style={{ width: size, height: size }}>
        <span className="trace-guide" aria-hidden="true">{letter}</span>
        {!done && !started && <span className="trace-start-dot" aria-hidden="true" />}
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
        {done && <span className="trace-reveal" aria-hidden="true">{item.emoji}</span>}
      </div>

      <div className="spell-foot">
        <button className="pill spell-say" onClick={() => { unlockAudio(); speakEn(done ? `${letter} is for ${item.word}` : letter) }}>
          🔊
        </button>
        <button className="big-button" onClick={newLetter}>
          🔄 {t('trace.next')}
        </button>
      </div>
    </GameShell>
  )
}
