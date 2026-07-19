import { memo, useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendCount } from '../level'
import type { GameProps } from './registry'
import { playNudge, playRise, playSuccess, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendColor } from '../friends'
import { randInt, shuffle } from './util'
import { speakNumber } from '../voice'
import { useViewport } from '../useViewport'
import Confetti from '../components/Confetti'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'

// A calm "pop" game (no timer, no losing): drag across 3+ connected friends of
// the SAME kind, then let go to pop them all. Friends above fall down and fresh
// ones drop in from the top. Longer chains = more stars. Each board sprite is a
// friend-BUBBLE: one baked glossy-sphere material (public/art/sprites/pop) tinted
// to the friend's identity colour under a simple face — one clean, calm surface
// per cell (the old detailed 6×6 art was visually noisy, QA), floating on a calm
// pool backdrop. Popping is a soap-bubble dissolve, never an explosion.
const COLS = 5
const ROWS = 5
// Cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף), set from
// the top-bar star control. The lever is how many DISTINCT friends share the board:
// more kinds → matches are rarer to spot → harder — yet always no-fail (🔄 deals a
// fresh pool any time and MIN_CHAIN stays 3, so a pop is always within reach). GDD:
// קל 3 · בינוני 4 · קשה 5 · אלוף 6 friend kinds. COLS/ROWS stay 5×5 (frozen geometry
// → the drag hit-test + collapse maths are untouched).
const LEVEL_TIERS = [0, 1, 2, 3]
const PALETTE_BY_LEVEL = [3, 4, 5, 6]
const MIN_CHAIN = 3 // need at least 3 connected same friends to pop

// hue (0–360) of a hex colour; -1 for greys, which we skip for clearer contrast.
function hexHue(hex: string): number {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return -1
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return ((h * 60) % 360 + 360) % 360
}
function hueDist(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

// Pick `size` friends whose colours are well separated round the wheel, so the
// board never puts two near-identical hues next to each other.
function pickPalette(size: number): number[] {
  const all = shuffle(Array.from({ length: friendCount() }, (_, i) => i))
  const chosen: number[] = []
  const hues: number[] = []
  const MIN_SEP = 40
  for (const i of all) {
    if (chosen.length >= size) break
    const h = hexHue(friendColor(i))
    if (h < 0) continue
    if (hues.every((hh) => hueDist(hh, h) >= MIN_SEP)) {
      chosen.push(i)
      hues.push(h)
    }
  }
  // top up if the roster was too small (few tiers) or hues collided
  for (const i of all) {
    if (chosen.length >= size) break
    if (!chosen.includes(i)) chosen.push(i)
  }
  return chosen
}

function makeGrid(palette: number[]): number[] {
  return Array.from({ length: ROWS * COLS }, () => palette[randInt(0, palette.length - 1)])
}

const rowOf = (i: number) => Math.floor(i / COLS)
const colOf = (i: number) => i % COLS
function adjacent(a: number, b: number) {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1
}

// Remove the popped cells; survivors in each column fall to the bottom and new
// friends (from the current palette) fill the gaps at the top.
function collapse(grid: number[], popped: Set<number>, palette: number[]): number[] {
  const next = grid.slice()
  for (let c = 0; c < COLS; c++) {
    const survivors: number[] = []
    for (let r = ROWS - 1; r >= 0; r--) {
      const idx = r * COLS + c
      if (!popped.has(idx)) survivors.push(grid[idx])
    }
    let writeRow = ROWS - 1
    let k = 0
    for (; k < survivors.length; k++, writeRow--) next[writeRow * COLS + c] = survivors[k]
    for (; writeRow >= 0; writeRow--) next[writeRow * COLS + c] = palette[randInt(0, palette.length - 1)]
  }
  return next
}

// The flat board sprite: a soft colour blob with two dot eyes and one smile.
// Memoized so a board-wide re-render (score/collapse/settle) only re-draws cells
// whose friend actually changed — the rest are skipped.
const PopBlob = memo(function PopBlob({ index }: { index: number }) {
  return (
    <span className="pop-blob" style={{ '--c': friendColor(index) } as React.CSSProperties}>
      <span className="pop-eye l" />
      <span className="pop-eye r" />
      <span className="pop-smile" />
    </span>
  )
})

export default function PopFriends({ onExit }: GameProps) {
  const { t } = useT()
  // per-game difficulty from the shared header star control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('pop', LEVEL_TIERS)
  const paletteSize = PALETTE_BY_LEVEL[level] ?? 4
  const [party, setParty] = useState(false)
  const [palette, setPalette] = useState<number[]>(() => pickPalette(paletteSize))
  const [grid, setGrid] = useState<number[]>(() => makeGrid(palette))
  // ordered list of the cells currently dissolving (order drives the pop wave)
  const [popping, setPopping] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [settling, setSettling] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastCell = useRef<number | null>(null)
  // The chain being drawn lives ONLY in a ref during the drag; the highlight is a
  // direct class toggle on each cell element (no setState per cell crossed), so a
  // finger sweeping the board never re-renders all 25 cells. React state is touched
  // only on release (the pop). This is the sports-game doctrine applied to a drag.
  const chainRef = useRef<number[]>([])
  const cellEls = useRef<(HTMLSpanElement | null)[]>([])

  function paintPicked(idx: number, on: boolean) {
    cellEls.current[idx]?.classList.toggle('is-picked', on)
  }
  function clearPicked() {
    for (const idx of chainRef.current) cellEls.current[idx]?.classList.remove('is-picked')
  }

  function cellFromEvent(e: React.PointerEvent): number | null {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / (rect.width / COLS))
    const row = Math.floor((e.clientY - rect.top) / (rect.height / ROWS))
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    return row * COLS + col
  }

  function onDown(e: React.PointerEvent) {
    unlockAudio()
    if (popping.length) return
    const idx = cellFromEvent(e)
    if (idx == null) return
    dragging.current = true
    lastCell.current = idx
    boardRef.current?.setPointerCapture(e.pointerId)
    chainRef.current = [idx]
    paintPicked(idx, true)
  }

  function onMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const idx = cellFromEvent(e)
    if (idx == null || idx === lastCell.current) return
    lastCell.current = idx
    const prev = chainRef.current
    if (prev.length === 0) return
    // backtrack — sliding back onto the previous friend shortens the chain
    if (prev.length >= 2 && idx === prev[prev.length - 2]) {
      const removed = prev[prev.length - 1]
      chainRef.current = prev.slice(0, -1)
      paintPicked(removed, false)
      return
    }
    const type = grid[prev[0]]
    const last = prev[prev.length - 1]
    if (grid[idx] === type && !prev.includes(idx) && adjacent(idx, last)) {
      playRise(prev.length) // soft pitch rises with the chain length
      chainRef.current = [...prev, idx]
      paintPicked(idx, true)
      speakNumber(prev.length + 1) // "שתיים! שלוש! ארבע!" as the chain grows
    }
  }

  function onUp() {
    if (!dragging.current) return
    dragging.current = false
    lastCell.current = null
    const picked = chainRef.current
    clearPicked()
    chainRef.current = []
    if (picked.length < MIN_CHAIN) {
      if (picked.length > 0) playNudge() // not silent — needs at least 3
      return
    }

    const popped = new Set(picked)
    const gained = picked.length
    setPopping(picked) // keep chain order → the dissolve travels as a wave
    if (gained >= 5) {
      speak('וואו!') // power-up feel for a long chain
      setParty(true)
      window.setTimeout(() => setParty(false), 2500)
    }
    window.setTimeout(() => {
      setGrid((g) => collapse(g, popped, palette))
      setPopping([])
      setSettling(true) // the fresh friends drop in
      window.setTimeout(() => setSettling(false), 480)
      setScore((s) => {
        const ns = s + gained
        if (gained >= 5 || Math.floor(ns / 25) > Math.floor(s / 25)) playWin()
        else playSuccess()
        return ns
      })
    }, 420)
  }

  function reshuffle() {
    dragging.current = false
    lastCell.current = null
    clearPicked()
    chainRef.current = []
    setPopping([])
    const p = pickPalette(paletteSize)
    setPalette(p)
    setGrid(makeGrid(p))
  }

  // switching difficulty from the header deals a fresh pool at the new level
  // (skip the first render — the initial board is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    reshuffle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // board fills the screen width (up to 500) so the 5×5 cells stay big
  const vp = useViewport()
  const boardW = Math.min(500, vp.w * 0.94)

  return (
    <GameShell title={t('game.pop')} emoji="🎈" onExit={onExit} levels={{ gameId: 'pop', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="pop-head" style={{ maxWidth: boardW + 28 }}>
        <span className="score-pill" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>
        <button className="pill pill-small" onClick={reshuffle}>
          🔄 {t('pop.new')}
        </button>
      </div>
      <p className="pop-hint" aria-hidden="true">
        {t('pop.hint')}
      </p>

      {/* the friend-bubbles float on a calm pool: one baked illustrated back plane
          (see art/bg/LICENSES.md), the board sits on the water inset so a rim of
          pool + the near coping show for depth. */}
      <div className="pop-stage" style={{ maxWidth: boardW + 28 }}>
        <SceneBackdrop src="pool.jpg" position="center 62%" scrim="none" />
        <div
          className={`pop-board ${settling ? 'is-settling' : ''}`}
          ref={boardRef}
          style={{ '--cols': COLS, maxWidth: boardW } as React.CSSProperties}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
        {grid.map((type, i) => {
          const popIdx = popping.indexOf(i)
          return (
            <span
              key={i}
              ref={(el) => {
                cellEls.current[i] = el
              }}
              className={`pop-cell ${popIdx >= 0 ? 'is-pop' : ''}`}
              style={
                {
                  '--row': rowOf(i),
                  '--pop-i': popIdx >= 0 ? popIdx : 0,
                } as React.CSSProperties
              }
            >
              <PopBlob index={type} />
              {popIdx >= 0 && (
                <span className="pop-fx" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </span>
          )
        })}
        </div>
      </div>
    </GameShell>
  )
}
