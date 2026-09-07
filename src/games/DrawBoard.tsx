import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendCount, randFriendIndex } from '../level'
import Friend from '../components/Friend'
import IconButton from '../components/IconButton'
import Stepper from '../components/Stepper'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPop, playTap, unlockAudio } from '../audio'
import { friendName } from '../friends'
import { MORE_COLORS } from './palette'
import { useT } from '../i18n'

// Free-draw board: draw with your finger in any colour + brush size, and stamp
// friends (= numbers) or fun stickers anywhere on the page. No timer, no rules.
// The tools are baked physical materials (see scripts/gen-draw-art.mjs): real
// crayons resting in a wooden tray, a rubber eraser, and a paper drawing surface.
const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#111827']
// baked material sprites (original CC0 art, public/art/sprites/draw/)
const SPRITE = import.meta.env.BASE_URL + 'art/sprites/draw/'
const crayonUrl = (i: number) => `${SPRITE}crayon-${i}.png`
const BRUSHES = [5, 12, 22]
const EMOJI = ['⭐', '❤️', '🌈', '🌟', '🎈', '🌸']

type Stamp = { id: number; x: number; y: number; friend?: number; emoji?: string }

export default function DrawBoard({ onExit }: GameProps) {
  const { t } = useT()
  const boardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const idRef = useRef(0)
  const stampsRef = useRef<Stamp[]>([])
  const dragStamp = useRef<{ id: number; moved: boolean; sx: number; sy: number } | null>(null)

  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(BRUSHES[1])
  const [stamp, setStamp] = useState<'friend' | string | null>(null) // null = pen
  const [stampFriend, setStampFriend] = useState(0)
  const [stamps, setStamps] = useState<Stamp[]>([])
  const [more, setMore] = useState(false)
  // "grab" mode: stop drawing/stamping and instead pick a placed sticker to move
  // it (with drag or the arrow pad) / delete it. Picking a colour, eraser or a
  // sticker switches back to drawing/stamping.
  const [grab, setGrab] = useState(false)
  const [eraser, setEraser] = useState(false) // free eraser — rubs out drawing only
  const [selectedId, setSelectedId] = useState<number | null>(null) // chosen sticker (grab mode)
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 }) // to keep the move-pad on the canvas
  const selectedIdRef = useRef<number | null>(null)
  selectedIdRef.current = selectedId
  stampsRef.current = stamps // latest stamps, for the pointer handlers below

  // undo / redo — a list of {canvas image, stamps} snapshots with a cursor
  type Snap = { img: string | null; stamps: Stamp[] }
  const hist = useRef<Snap[]>([{ img: null, stamps: [] }])
  const cursor = useRef(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  function flags() {
    setCanUndo(cursor.current > 0)
    setCanRedo(cursor.current < hist.current.length - 1)
  }
  function commit(nextStamps: Stamp[]) {
    const img = canvasRef.current?.toDataURL() ?? null
    hist.current = hist.current.slice(0, cursor.current + 1)
    hist.current.push({ img, stamps: nextStamps })
    if (hist.current.length > 30) hist.current.shift()
    cursor.current = hist.current.length - 1
    flags()
  }
  function restoreCanvas(dataUrl: string | null) {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (dataUrl) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      img.src = dataUrl
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }
  function restore(i: number) {
    const snap = hist.current[i]
    setStamps(snap.stamps)
    restoreCanvas(snap.img)
  }
  function undo() {
    if (cursor.current <= 0) return
    cursor.current -= 1
    restore(cursor.current)
    flags()
    playTap()
  }
  function redo() {
    if (cursor.current >= hist.current.length - 1) return
    cursor.current += 1
    restore(cursor.current)
    flags()
    playTap()
  }

  // size the canvas to the board (crisp on retina)
  useEffect(() => {
    const board = boardRef.current
    const canvas = canvasRef.current
    if (!board || !canvas) return
    const setup = () => {
      const r = board.getBoundingClientRect()
      setBoardSize({ w: r.width, h: r.height })
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctxRef.current = ctx
    }
    setup()
    const ro = new ResizeObserver(setup)
    ro.observe(board)
    return () => ro.disconnect()
  }, [])

  function pos(e: React.PointerEvent) {
    const r = boardRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = ctxRef.current
    if (!ctx) return
    // the free eraser rubs out only the drawing (canvas pixels); stickers are
    // separate DOM elements, so they're untouched — exactly "erase writing only".
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    ctx.lineWidth = eraser ? size * 2.2 : size
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  function down(e: React.PointerEvent) {
    if (grab) {
      setSelectedId(null) // tapped empty canvas → release the selected sticker
      return
    }
    unlockAudio()
    boardRef.current?.setPointerCapture?.(e.pointerId)
    const p = pos(e)
    if (stamp) {
      const s: Stamp = { id: idRef.current++, x: p.x, y: p.y, ...(stamp === 'friend' ? { friend: stampFriend } : { emoji: stamp }) }
      const next = [...stamps, s]
      setStamps(next)
      commit(next)
      playPop()
      return
    }
    drawing.current = true
    last.current = p
    stroke(p, { x: p.x + 0.01, y: p.y }) // a dot on a single tap
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return
    const p = pos(e)
    stroke(last.current, p)
    last.current = p
  }
  function up() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    commit(stamps) // a completed stroke
  }

  // in grab mode: tap a sticker to SELECT it (then nudge with the arrow pad /
  // keyboard, or delete it), or drag it to move it directly.
  function stampDown(e: React.PointerEvent, s: Stamp) {
    e.stopPropagation()
    unlockAudio()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragStamp.current = { id: s.id, moved: false, sx: e.clientX, sy: e.clientY }
    setSelectedId(s.id)
  }
  function stampMove(e: React.PointerEvent) {
    const d = dragStamp.current
    if (!d) return
    e.stopPropagation()
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return
    d.moved = true
    const p = pos(e)
    setStamps((prev) => prev.map((st) => (st.id === d.id ? { ...st, x: p.x, y: p.y } : st)))
  }
  function stampUp(e: React.PointerEvent) {
    const d = dragStamp.current
    if (!d) return
    e.stopPropagation()
    dragStamp.current = null
    if (d.moved) commit(stampsRef.current) // a drag finished
    playTap()
  }

  // move / delete the selected sticker — used by the on-screen arrow pad and the
  // keyboard arrows. Read from refs so the keydown handler is never stale.
  function moveSel(dx: number, dy: number) {
    const id = selectedIdRef.current
    if (id == null) return
    const r = boardRef.current?.getBoundingClientRect()
    const next = stampsRef.current.map((st) =>
      st.id === id
        ? {
            ...st,
            x: r ? Math.max(0, Math.min(r.width, st.x + dx)) : st.x + dx,
            y: r ? Math.max(0, Math.min(r.height, st.y + dy)) : st.y + dy,
          }
        : st,
    )
    setStamps(next)
    commit(next)
    playTap()
  }
  function removeSel() {
    const id = selectedIdRef.current
    if (id == null) return
    const next = stampsRef.current.filter((st) => st.id !== id)
    setStamps(next)
    commit(next)
    setSelectedId(null)
    playPop()
  }

  // keyboard arrows / delete move the selected sticker while in grab mode
  useEffect(() => {
    if (!grab) return
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 2 : 12
      if (e.key === 'ArrowUp') moveSel(0, -step)
      else if (e.key === 'ArrowDown') moveSel(0, step)
      else if (e.key === 'ArrowLeft') moveSel(-step, 0)
      else if (e.key === 'ArrowRight') moveSel(step, 0)
      else if (e.key === 'Delete' || e.key === 'Backspace') removeSel()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grab])

  function clearAll() {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (ctx && canvas) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    setStamps([])
    commit([])
    playTap()
  }

  function leaveGrab() {
    setGrab(false)
    setSelectedId(null)
  }
  function pickColor(c: string) {
    setColor(c)
    setStamp(null)
    setEraser(false)
    leaveGrab()
    playTap()
  }
  function pickBrush(b: number) {
    setSize(b)
    setStamp(null)
    leaveGrab()
    playTap()
  }
  function pickEraser() {
    setEraser(true)
    setStamp(null)
    leaveGrab()
    playTap()
  }
  function pickStamp(s: 'friend' | string) {
    setStamp(s)
    setEraser(false)
    leaveGrab()
    playTap()
  }

  // keep a tap on the move-pad from reaching the board (which would deselect)
  const stopProp = (e: React.PointerEvent) => e.stopPropagation()

  // the move-pad floats over the canvas, centred on the selected sticker, clamped
  // so it never spills off the board
  const sel = grab && selectedId != null ? stamps.find((s) => s.id === selectedId) : undefined
  const PAD = 82 // half the pad's footprint, for clamping
  const padX = sel ? (boardSize.w ? Math.max(PAD, Math.min(boardSize.w - PAD, sel.x)) : sel.x) : 0
  const padY = sel ? (boardSize.h ? Math.max(PAD, Math.min(boardSize.h - PAD, sel.y)) : sel.y) : 0

  return (
    <GameShell title={t('game.draw')} emoji="🖍️" onExit={onExit} canvasLayout>
      <div className="draw-screen">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 40%" scrim="soft" className="draw-backdrop" />
        {/* the crayon tray — real baked crayons resting in a wooden tray */}
        <div className="draw-palette">
          {COLORS.map((c, i) => (
            <button
              key={c}
              className={`crayon-swatch ${!grab && !stamp && !eraser && color === c ? 'is-active' : ''}`}
              onClick={() => pickColor(c)}
              aria-label={t('draw.color')}
            >
              <img src={crayonUrl(i)} alt="" draggable={false} />
            </button>
          ))}
          {/* keep all 8 colour crayons on one row; tools wrap to the next */}
          <span className="draw-tray-break" aria-hidden="true" />
          <button
            className={`color-more-btn ${!grab && !stamp && !eraser && !COLORS.includes(color) ? 'is-active' : ''}`}
            style={!grab && !stamp && !eraser && !COLORS.includes(color) ? { background: color } : undefined}
            onClick={() => {
              playTap()
              setMore(true)
            }}
            aria-label={t('color.more')}
          >
            <span aria-hidden="true">➕</span>
          </button>
          {BRUSHES.map((b, i) => (
            <button
              key={b}
              className={`brush-btn ${!grab && !stamp && size === b ? 'is-active' : ''}`}
              onClick={() => pickBrush(b)}
              aria-label={t('draw.brush', { n: i + 1 })}
            >
              <span className="brush-dot" style={{ width: 6 + i * 7, height: 6 + i * 7 }} />
            </button>
          ))}
          <button
            className={`eraser-btn ${!grab && !stamp && eraser ? 'is-active' : ''}`}
            onClick={pickEraser}
            aria-label={t('draw.eraser')}
          >
            <img className="eraser-img" src={`${SPRITE}eraser.png`} alt="" draggable={false} />
          </button>
        </div>

        <div className="draw-stampbar">
          <Stepper
            label={
              <span className="stamp-pick">
                <span className="stamp-digit" aria-hidden="true">
                  {stampFriend + 1}
                </span>
                <button
                  className={`stamp-friend ${!grab && stamp === 'friend' ? 'is-active' : ''}`}
                  onClick={() => pickStamp('friend')}
                  aria-label={t('draw.stampFriend', { name: friendName(stampFriend) })}
                >
                  <Friend index={stampFriend} scale={52 / friendMaxDim(stampFriend)} showNumber={false} />
                </button>
              </span>
            }
            onPrev={() => {
              setStampFriend((p) => (p + friendCount() - 1) % friendCount())
              pickStamp('friend') // browsing friends re-selects the friend stamp
            }}
            onNext={() => {
              setStampFriend((p) => (p + 1) % friendCount())
              pickStamp('friend')
            }}
          />
          <div className="emoji-stamps">
            {EMOJI.map((em) => (
              <button
                key={em}
                className={`emoji-stamp ${!grab && stamp === em ? 'is-active' : ''}`}
                onClick={() => pickStamp(em)}
                aria-label={t('draw.sticker')}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div
          className="draw-board"
          ref={boardRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <canvas ref={canvasRef} className="draw-canvas" />
          <div className="draw-stamps">
            {stamps.map((s) => (
              <span
                key={s.id}
                className={`draw-stamp ${s.emoji ? 'draw-stamp-emoji' : ''} ${grab ? 'is-grabbable' : ''} ${
                  grab && selectedId === s.id ? 'is-selected' : ''
                }`}
                style={{ left: s.x, top: s.y }}
                {...(grab
                  ? {
                      onPointerDown: (e: React.PointerEvent) => stampDown(e, s),
                      onPointerMove: stampMove,
                      onPointerUp: stampUp,
                      onPointerCancel: stampUp,
                    }
                  : {})}
              >
                {s.emoji ?? <Friend index={s.friend!} scale={66 / friendMaxDim(s.friend!)} showNumber={false} />}
              </span>
            ))}
          </div>

          {/* grab mode: a hint until something is picked, then a move-pad that
              floats over the canvas centred on the selected sticker */}
          {grab && !sel && <div className="draw-grabhint">{t('draw.grabHint')}</div>}
          {sel && (
            <div className="draw-movepad" style={{ left: padX, top: padY }}>
              <button className="move-btn mp-up" onPointerDown={stopProp} onClick={() => moveSel(0, -14)} aria-label={t('draw.up')}>
                ↑
              </button>
              <button className="move-btn mp-left" onPointerDown={stopProp} onClick={() => moveSel(-14, 0)} aria-label={t('draw.left')}>
                ←
              </button>
              <button className="move-btn move-del mp-del" onPointerDown={stopProp} onClick={removeSel} aria-label={t('draw.del')}>
                🗑️
              </button>
              <button className="move-btn mp-right" onPointerDown={stopProp} onClick={() => moveSel(14, 0)} aria-label={t('draw.right')}>
                →
              </button>
              <button className="move-btn mp-down" onPointerDown={stopProp} onClick={() => moveSel(0, 14)} aria-label={t('draw.down')}>
                ↓
              </button>
            </div>
          )}
        </div>

        <div className="color-actions">
          <IconButton
            icon="✋"
            label={t('draw.grab')}
            active={grab}
            onClick={() => {
              setGrab((g) => !g)
              setSelectedId(null)
              playTap()
            }}
          />
          <IconButton icon="↺" label={t('color.undo')} onClick={undo} disabled={!canUndo} />
          <IconButton icon="↻" label={t('color.redo')} onClick={redo} disabled={!canRedo} />
          <IconButton icon="🧽" label={t('draw.clear')} onClick={clearAll} />
          <IconButton
            icon="🎲"
            label={t('draw.randomStamp')}
            onClick={() => {
              setStampFriend(randFriendIndex())
              setStamp('friend')
              setGrab(false)
              playTap()
            }}
          />
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
                  className={`color-swatch ${!grab && !stamp && !eraser && color === p.color ? 'is-active' : ''}`}
                  style={{ background: p.color }}
                  onClick={() => {
                    pickColor(p.color)
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
