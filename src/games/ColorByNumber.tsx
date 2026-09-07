import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import IconButton from '../components/IconButton'
import Stepper from '../components/Stepper'
import type { GameProps } from './registry'
import { playNudge, playPop, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { randInt } from './util'
import { speakNumber } from '../voice'
import { PICTURES } from './cbnPictures'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'

// "Color by number" — a picture drawn on a grid where every cell holds a
// number. Pick the colour for a number, then tap the cells with that number to
// fill them in. Wrong number = gentle nudge. Fill them all and the picture is
// revealed. Teaches number ↔ colour matching. No timer, no losing.
const COLORS: Record<number, { color: string; name: string }> = {
  1: { color: '#ef4444', name: 'אדום' },
  2: { color: '#f97316', name: 'כתום' },
  3: { color: '#facc15', name: 'צהוב' },
  4: { color: '#22c55e', name: 'ירוק' },
  5: { color: '#3b82f6', name: 'כחול' },
  6: { color: '#8b5cf6', name: 'סגול' },
  7: { color: '#ec4899', name: 'ורוד' },
  8: { color: '#92400e', name: 'חום' },
  9: { color: '#14b8a6', name: 'טורקיז' },
  10: { color: '#1f2937', name: 'שחור' },
  11: { color: '#38bdf8', name: 'תכלת' },
  12: { color: '#84cc16', name: 'ליים' },
  13: { color: '#fb7185', name: 'ורוד בהיר' },
  14: { color: '#1e3a8a', name: 'כחול כהה' },
  15: { color: '#15803d', name: 'ירוק כהה' },
  16: { color: '#c084fc', name: 'סגול בהיר' },
  17: { color: '#eab308', name: 'זהב' },
  18: { color: '#c2410c', name: 'חמרה' },
  19: { color: '#94a3b8', name: 'אפור' },
  20: { color: '#f8fafc', name: 'לבן' },
  21: { color: '#db2777', name: 'מג׳נטה' },
  22: { color: '#0e7490', name: 'כחול ים' },
  23: { color: '#d9b88f', name: 'בז׳' },
  24: { color: '#991b1b', name: 'בורדו' },
  25: { color: '#86efac', name: 'ירוק בהיר' },
  26: { color: '#bae6fd', name: 'תכלת בהיר' },
  27: { color: '#5b21b6', name: 'סגול כהה' },
  28: { color: '#d08b3f', name: 'חום בהיר' },
  29: { color: '#e879f9', name: 'לילך' },
  30: { color: '#cbd5e1', name: 'אפור בהיר' },
}

function present(grid: number[][]) {
  return [...new Set(grid.flat().filter((v) => v > 0))].sort((a, b) => a - b)
}
function countCells(grid: number[][]) {
  return grid.flat().filter((v) => v > 0).length
}

// How many colours each picture uses — for the "filter by number of colours"
// control (fewer colours = easier).
const COLOR_COUNT = PICTURES.map((p) => present(p.grid).length)
const FILTERS: { id: string; label: string; test: (n: number) => boolean }[] = [
  { id: 'all', label: 'הכל', test: () => true },
  { id: 'f23', label: '2–3', test: (n) => n <= 3 },
  { id: 'f45', label: '4–5', test: (n) => n === 4 || n === 5 },
  { id: 'f68', label: '6–8', test: (n) => n >= 6 && n <= 8 },
  { id: 'f9', label: '9+', test: (n) => n >= 9 },
  { id: 'fav', label: '❤️', test: () => false }, // pool is the favourites set (special-cased)
]
const FILTER_HAS = FILTERS.map((f) => COLOR_COUNT.some((n) => f.test(n)))

const FAV_KEY = 'assaf-games:cbn-favs'
function loadFavs(): Set<number> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return new Set<number>(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export default function ColorByNumber({ onExit }: GameProps) {
  const { t } = useT()
  const [pic, setPic] = useState(() => randInt(0, PICTURES.length - 1))
  const [filled, setFilled] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState(() => present(PICTURES[pic].grid)[0])
  const [done, setDone] = useState(false)
  const [zoom, setZoom] = useState(1) // child can enlarge/shrink the board
  const [past, setPast] = useState<Set<string>[]>([]) // undo / redo history of filled cells
  const [future, setFuture] = useState<Set<string>[]>([])
  const [filterId, setFilterId] = useState('all') // show only boards with N colours
  const [favs, setFavs] = useState<Set<number>>(loadFavs)
  const pool = useMemo(() => {
    if (filterId === 'fav') return PICTURES.map((_, i) => i).filter((i) => favs.has(i))
    const f = FILTERS.find((x) => x.id === filterId) ?? FILTERS[0]
    return PICTURES.map((_, i) => i).filter((i) => f.test(COLOR_COUNT[i]))
  }, [filterId, favs])

  const [win, setWin] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 360,
    h: typeof window !== 'undefined' ? window.innerHeight : 700,
  }))
  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Size the board to the ACTUAL free space of its stage (measured), not a fixed
  // fraction of the window — so the picture fills the screen on a phone AND grows
  // on a tablet (the old `win.h * 0.4` + 46px cap kept it tiny everywhere).
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const read = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const picture = PICTURES[pic]
  const grid = picture.grid
  const cols = grid[0].length
  const rows = grid.length
  const legend = present(grid)
  const total = countCells(grid)
  // fit the grid into the measured stage box (fall back to the window before the
  // first measure), accounting for the grid's 4px padding + 2px gaps, capped large
  // (96px) so cells stay finger-friendly and can fill a tablet. Zoom multiplies it.
  const GAP = 2
  const PADDING = 4
  const availW = stage.w > 0 ? stage.w : Math.floor(win.w * 0.92)
  const availH = stage.h > 0 ? stage.h : Math.floor(win.h * 0.5)
  const fitW = Math.floor((availW - PADDING * 2 - (cols - 1) * GAP) / cols)
  const fitH = Math.floor((availH - PADDING * 2 - (rows - 1) * GAP) / rows)
  const baseCell = Math.min(fitW, fitH, 96)
  const cell = Math.max(14, Math.round(baseCell * zoom)) // zoom in/out for a closer look

  useEffect(() => {
    if (!done && total > 0 && filled.size >= total) {
      setDone(true)
      playWin()
      speak(`כל הכבוד! ציירת ${picture.name}!`)
    }
  }, [filled, total, done, picture.name])

  function goTo(next: number) {
    setPic(next)
    setFilled(new Set())
    setSelected(present(PICTURES[next].grid)[0])
    setDone(false)
    setPast([])
    setFuture([])
    playTap()
  }
  function clearAll() {
    setFilled(new Set())
    setDone(false)
    setPast([])
    setFuture([])
    playTap()
  }
  function undo() {
    if (past.length === 0) return
    playTap()
    setFuture((f) => [filled, ...f])
    setFilled(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
    setDone(false)
  }
  function redo() {
    if (future.length === 0) return
    playTap()
    setPast((p) => [...p, filled])
    setFilled(future[0])
    setFuture((f) => f.slice(1))
  }
  function zoomBy(d: number) {
    playTap()
    setZoom((z) => Math.min(2.6, Math.max(0.6, Math.round((z + d) * 100) / 100)))
  }
  function step(d: number) {
    if (pool.length === 0) return
    const pos = pool.indexOf(pic)
    const i = pos < 0 ? 0 : (pos + d + pool.length) % pool.length
    goTo(pool[i])
  }
  function chooseFilter(id: string) {
    if (id === filterId) return
    playTap()
    setFilterId(id)
    const p =
      id === 'fav'
        ? PICTURES.map((_, i) => i).filter((i) => favs.has(i))
        : PICTURES.map((_, i) => i).filter((i) => (FILTERS.find((x) => x.id === id) ?? FILTERS[0]).test(COLOR_COUNT[i]))
    if (p.length) goTo(p[randInt(0, p.length - 1)])
  }
  function toggleFav() {
    playTap()
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(pic)) next.delete(pic)
      else next.add(pic)
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      } catch {
        // storage off — favourites just won't persist
      }
      return next
    })
  }
  function pickNumber(num: number) {
    unlockAudio()
    setSelected(num)
    playTap()
    speakNumber(num)
  }
  function tap(r: number, c: number, v: number) {
    if (done || v === 0) return
    unlockAudio()
    const key = `${r}-${c}`
    if (filled.has(key)) return
    if (v === selected) {
      setPast((p) => [...p, filled])
      setFuture([])
      setFilled((prev) => new Set(prev).add(key))
      playPop()
    } else {
      playNudge()
    }
  }

  return (
    <GameShell title={t('game.paintnum')} emoji="🧩" onExit={onExit} canvasLayout>
      <Confetti active={done} />
      <div className="color-screen">
        <Stepper
          // keep it a mystery — show only the picture's number until it's done,
          // then reveal what it turned out to be (name stays Hebrew content)
          label={done ? `🎉 ${picture.name}` : t('cbn.pic', { n: pic + 1 })}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />

        {/* filter the boards by how many colours they use (fewer = easier) */}
        <div className="cbn-filter">
          <span className="cbn-filter-label">{t('cbn.colors')}</span>
          {FILTERS.map((f, i) => (
            <button
              key={f.id}
              className={`pill pill-small ${filterId === f.id ? 'pill-active' : ''}`}
              onClick={() => chooseFilter(f.id)}
              disabled={f.id === 'fav' ? favs.size === 0 : !FILTER_HAS[i]}
            >
              {f.id === 'all' ? t('cbn.all') : f.label}
            </button>
          ))}
        </div>

        <div className="cbn-legend">
          {legend.map((num) => (
            <button
              key={num}
              className={`cbn-swatch ${selected === num ? 'is-active' : ''}`}
              style={{ background: COLORS[num].color }}
              onClick={() => pickNumber(num)}
              aria-label={t('cbn.swatchAria', { name: COLORS[num].name, n: num })}
            >
              {num}
            </button>
          ))}
        </div>

        <div className="cbn-stage" ref={stageRef}>
          <div
            className={`cbn-grid ${done ? 'is-done' : ''}`}
            style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridAutoRows: `${cell}px` }}
          >
            {grid.flatMap((row, r) =>
              row.map((v, c) => {
                if (v === 0) return <span key={`${r}-${c}`} className="cbn-cell cbn-empty" />
                const isFilled = filled.has(`${r}-${c}`)
                return (
                  <button
                    key={`${r}-${c}`}
                    className={`cbn-cell ${isFilled ? 'is-filled' : ''}`}
                    style={isFilled ? { background: COLORS[v].color } : undefined}
                    onClick={() => tap(r, c, v)}
                    aria-label={t('cbn.cellAria', { n: v })}
                  >
                    {isFilled ? '' : v}
                  </button>
                )
              }),
            )}
          </div>
        </div>

        {done && <p className="cbn-reveal">🎉 {picture.name}!</p>}

        <div className="color-actions">
          <IconButton icon="↩️" label={t('dots.back')} onClick={undo} disabled={past.length === 0} />
          <IconButton icon="↪️" label={t('cbn.fwd')} onClick={redo} disabled={future.length === 0} />
          <IconButton icon={<span className="cbn-zoomic">🔍−</span>} label={t('cbn.zoomOut')} onClick={() => zoomBy(-0.25)} />
          <IconButton icon={<span className="cbn-zoomic">🔍+</span>} label={t('cbn.zoomIn')} onClick={() => zoomBy(0.25)} />
          <IconButton icon="🧽" label={t('dots.restart')} onClick={clearAll} />
          <IconButton icon={favs.has(pic) ? '❤️' : '🤍'} label={t('cbn.fav')} onClick={toggleFav} />
          <IconButton
            icon="🎲"
            label={t('cbn.newPic')}
            onClick={() => pool.length && goTo(pool[randInt(0, pool.length - 1)])}
          />
        </div>
      </div>
    </GameShell>
  )
}
