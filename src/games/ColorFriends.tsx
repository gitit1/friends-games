import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import IconButton from '../components/IconButton'
import Stepper from '../components/Stepper'
import FriendArt, {
  FRIEND_NATURAL,
  friendKindForIndex,
  friendPartCount,
} from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPop, playSuccess, playTap, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendName, friendSay } from '../friends'
import { randInt } from './util'
import { MORE_COLORS, type Swatch } from './palette'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'
import { friendCount, randFriendIndex } from '../level'

// "Color a friend" — a friend appears as a blank outline (its body bumps are
// empty). Pick a colour, then tap each bump to fill it in. No timer, no wrong:
// any colour anywhere is fine. Undo/redo, clear, and 🎲 for a new random friend.
// When every bump is filled the friend wakes and cheers.
type Grid = (string | null)[]

// Each palette colour is a REAL baked ceramic paint pot (public/art/sprites/
// colorme/pot-<slug>.png): a muted stoneware body + a vivid glossy meniscus in
// the exact `color` the child paints with. `slug` maps the swatch to its sprite.
type PotSwatch = Swatch & { slug: string }
const PALETTE: PotSwatch[] = [
  { color: '#ef4444', name: 'אדום', slug: 'red' },
  { color: '#f97316', name: 'כתום', slug: 'orange' },
  { color: '#facc15', name: 'צהוב', slug: 'yellow' },
  { color: '#22c55e', name: 'ירוק', slug: 'green' },
  { color: '#14b8a6', name: 'טורקיז', slug: 'teal' },
  { color: '#3b82f6', name: 'כחול', slug: 'blue' },
  { color: '#8b5cf6', name: 'סגול', slug: 'purple' },
  { color: '#ec4899', name: 'ורוד', slug: 'pink' },
  { color: '#a16207', name: 'חום', slug: 'brown' },
  { color: '#f8fafc', name: 'לבן', slug: 'white' },
  { color: '#111827', name: 'שחור', slug: 'black' },
  { color: '#9ca3af', name: 'אפור', slug: 'gray' },
]
const POT_ART = import.meta.env.BASE_URL + 'art/sprites/colorme/'

const MAX_NAT = 278
const blank = (n: number): Grid => Array(n).fill(null)

function useIsWide() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 720px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 720px)')
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

export default function ColorFriends({ onExit }: GameProps) {
  const { t } = useT()
  const [index, setIndex] = useState(() => randFriendIndex())
  const [colors, setColors] = useState<Grid>(() => blank(friendPartCount(friendKindForIndex(index))))
  const [undoStack, setUndoStack] = useState<Grid[]>([])
  const [redoStack, setRedoStack] = useState<Grid[]>([])
  const [sel, setSel] = useState<Swatch>(PALETTE[0])
  const [done, setDone] = useState(false)
  const [more, setMore] = useState(false)
  const wide = useIsWide()

  // live screen size, so big friends can be sized against the real screen width
  const [win, setWin] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 360,
    h: typeof window !== 'undefined' ? window.innerHeight : 700,
  }))
  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // measure the actual stage box so the framed page (friend + wooden frame + mat)
  // ALWAYS fits between the stepper and the palette — otherwise a tall friend's
  // page would overflow and its frame top would be clipped by the scene panel.
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setStageBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const kind = friendKindForIndex(index)
  const nat = FRIEND_NATURAL[kind]
  // The friend rides a framed cream page: reserve room for the wooden frame +
  // mat (FRAME_V vertical, FRAME_H horizontal, incl. the feet dip + resting
  // brush) and fit the friend inside the MEASURED stage. Before the first
  // measure, fall back to a conservative window fraction (never oversized).
  const FRAME_V = 74
  const FRAME_H = 60
  const availH = (stageBox.h > 0 ? stageBox.h : win.h * 0.32) - FRAME_V
  const availW = (stageBox.w > 0 ? stageBox.w : win.w) - FRAME_H
  const fitScale = Math.min(availW / (nat.w + 14), availH / nat.h)
  // big data-driven friends fill the page; small hand-built friends keep their
  // cosier natural size but never exceed what the page can hold.
  const scale = index >= 10 ? fitScale : Math.min((wide ? 440 : 290) / MAX_NAT, fitScale)

  function goTo(next: number) {
    setIndex(next)
    setColors(blank(friendPartCount(friendKindForIndex(next))))
    setUndoStack([])
    setRedoStack([])
    setDone(false)
    playTap()
  }

  function clearAll() {
    // clearing is itself undoable — keep the history so ↺ brings the colours
    // back. Only switching friend (goTo) or leaving the game resets it.
    setUndoStack((s) => [...s, colors])
    setRedoStack([])
    setColors(blank(friendPartCount(kind)))
    setDone(false)
    playTap()
  }

  function pickColor(s: Swatch) {
    unlockAudio()
    setSel(s)
    playTap()
    speak(s.name)
  }

  function paintPart(i: number) {
    unlockAudio()
    setUndoStack((s) => [...s, colors])
    setRedoStack([])
    const next = colors.slice()
    next[i] = sel.color
    setColors(next)
    playPop()
    speak(sel.name)
    const full = next.every((c) => c !== null)
    if (full && !done) {
      setDone(true)
      window.setTimeout(() => {
        playSuccess()
        speak(`כל הכבוד! צבעת את ${friendSay(index)}`)
      }, 260)
    } else if (!full && done) {
      setDone(false)
    }
  }

  // "magic" — fill the whole friend with a pleasant rainbow in one tap (undoable),
  // with a random starting hue so it looks different each time
  function magic() {
    unlockAudio()
    const rainbow = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899']
    const start = randInt(0, rainbow.length - 1)
    setUndoStack((s) => [...s, colors])
    setRedoStack([])
    setColors(colors.map((_, i) => rainbow[(i + start) % rainbow.length]))
    setDone(true)
    playSuccess()
    speak('קסם!')
  }

  function undo() {
    if (!undoStack.length) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((r) => [...r, colors])
    setColors(prev)
    setDone(prev.every((c) => c !== null))
    playTap()
  }

  function redo() {
    if (!redoStack.length) return
    const nxt = redoStack[redoStack.length - 1]
    setRedoStack((r) => r.slice(0, -1))
    setUndoStack((s) => [...s, colors])
    setColors(nxt)
    setDone(nxt.every((c) => c !== null))
    playTap()
  }

  return (
    <GameShell title={t('game.colorme')} emoji="🖌️" onExit={onExit} canvasLayout>
      <Confetti active={done} />
      <div className="color-screen cf-scene">
        {/* calm art-studio back plane (original baked art, see art/bg/LICENSES.md) */}
        <SceneBackdrop src="colorme-studio.jpg" position="center 34%" scrim="soft" className="cf-backdrop" />
        <Stepper
          label={`${friendName(index)} · ${index + 1}`}
          onPrev={() => goTo((index + friendCount() - 1) % friendCount())}
          onNext={() => goTo((index + 1) % friendCount())}
        />

        <div className="color-stage" ref={stageRef}>
          {/* the friend is coloured on a cream page held in a baked wooden frame */}
          <div className="cf-page">
            <span
              className={`color-fit ${done ? 'is-done' : ''}`}
              style={{ width: nat.w * scale, height: nat.h * scale }}
            >
              <span className="color-scaler" style={{ width: nat.w, transform: `scale(${scale})` }}>
                <FriendArt kind={kind} showHalo={false} paint={{ colors, onPick: paintPart }} />
              </span>
            </span>
            {/* a baked paintbrush resting against the page corner */}
            <img className="cf-brush" src={`${POT_ART}brush.png`} alt="" aria-hidden="true" draggable={false} />
          </div>
        </div>

        {/* the palette pots rest on a baked wooden art table */}
        <div className="color-palette">
          {PALETTE.map((p) => (
            <button
              key={p.color}
              type="button"
              className={`color-swatch cf-pot ${sel.color === p.color ? 'is-active' : ''}`}
              style={{ backgroundImage: `url("${POT_ART}pot-${p.slug}.png")` }}
              onClick={() => pickColor(p)}
              aria-label={p.name}
            />
          ))}
          <button
            type="button"
            className={`color-swatch cf-pot cf-pot-more ${!PALETTE.some((p) => p.color === sel.color) ? 'is-active' : ''}`}
            style={{ backgroundImage: `url("${POT_ART}pot-more.png")` }}
            onClick={() => {
              playTap()
              setMore(true)
            }}
            aria-label={t('color.more')}
          />
        </div>

        <div className="color-actions">
          <IconButton icon="↺" label={t('color.undo')} onClick={undo} disabled={!undoStack.length} />
          <IconButton icon="↻" label={t('color.redo')} onClick={redo} disabled={!redoStack.length} />
          <IconButton icon="🧽" label={t('color.clear')} onClick={clearAll} />
          <IconButton icon="✨" label={t('color.magic')} onClick={magic} />
          <IconButton icon="🎲" label={t('color.new')} onClick={() => goTo(randFriendIndex())} />
        </div>
      </div>

      {more && (
        <div className="color-more-overlay" onClick={() => setMore(false)}>
          <div className="color-more-card" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close" onClick={() => setMore(false)} aria-label={t('seq.close')}>
              ✕
            </button>
            <h3 className="color-more-title">🌈 {t('color.more')}</h3>
            <div className="color-more-grid">
              {MORE_COLORS.map((p, i) => (
                <button
                  key={`${p.color}-${i}`}
                  type="button"
                  className={`color-swatch ${sel.color === p.color ? 'is-active' : ''}`}
                  style={{ background: p.color }}
                  onClick={() => {
                    pickColor(p)
                    setMore(false)
                  }}
                  aria-label={p.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </GameShell>
  )
}
