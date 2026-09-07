import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../../components/GameShell'
import SceneBackdrop from '../../components/SceneBackdrop'
import Friend from '../../components/Friend'
import { friendMaxDim } from '../../components/FriendArt'
import { useGameLevel } from '../../gameLevel'
import { useT } from '../../i18n'
import type { GameProps } from '../registry'
import { playDice, playNudge, playPop, playSuccess, playTap, playWin, unlockAudio } from '../../audio'
import { applyDifficulty, LEVELS } from './levels'
import type { GameState } from './gameTypes'
import { applyMove, getHint, initState, isLegalMove, placeOnly, shuffleBoard, undo } from './engine'

// the shared header difficulty control: קל · בינוני · קשה · אלוף (cumulative, no-fail)
const LEVEL_TIERS = [0, 1, 2, 3]
// the baked, lit grocery sprite for a goods type (real materials, not emoji)
const goodUrl = (type: string) => `${import.meta.env.BASE_URL}art/sprites/sortshelf/good-${type}.png`
// a calm, friendly shopkeeper who stands grounded in the shop
const KEEPER_INDEX = 6

// ── "מכולת" — a calm shelf-sorting puzzle. NO timer, no countdown, no time loss.
// Pick ANY good off a shelf, move it onto another shelf; 3 identical on one shelf
// clear. Win = the whole board is tidied. Challenge is planning + space. ──

// pre-baked confetti pieces for the win modal (no Math.random at render)
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 37) % 100,
  d: (i % 7) * 0.18,
  c: ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#ec4899', '#fde047'][i % 6],
  r: (i * 53) % 360,
}))

// best stars earned per level, saved across sessions
const STARS_KEY = 'assaf-friends:sortshelf:stars:v1'
const loadStars = (): Record<number, number> => {
  try {
    return JSON.parse(localStorage.getItem(STARS_KEY) || '{}')
  } catch {
    return {}
  }
}
const starsFor = (score: number, total: number) => (score >= total * 110 ? 3 : score >= total * 70 ? 2 : 1)

export default function SortShelf({ onExit }: GameProps) {
  const { t } = useT()
  const [tier] = useGameLevel('sortshelf', LEVEL_TIERS)
  const [levelIdx, setLevelIdx] = useState(0)
  const [state, setState] = useState<GameState>(() => initState(applyDifficulty(LEVELS[0], tier)))
  const [shakeId, setShakeId] = useState<string | null>(null)
  const [hint, setHint] = useState<{ sourceId: string; itemId: string; targetId: string } | null>(null)
  const [comboPop, setComboPop] = useState(0)
  const [paused, setPaused] = useState(false)
  // polish: a good that flies from shelf to shelf, + sparkle bursts where a triple clears
  const [flying, setFlying] = useState<{ type: string; left: number; top: number; dx: number; dy: number; id: number } | null>(null)
  const [hideId, setHideId] = useState<string | null>(null)
  const [landId, setLandId] = useState<string | null>(null) // the good that just landed (squash)
  const [sparkles, setSparkles] = useState<{ id: number; left: number; top: number }[]>([])
  const [bestStars, setBestStars] = useState<Record<number, number>>(() => loadStars())
  const [showLevels, setShowLevels] = useState(false)
  // drag-to-move
  const [drag, setDrag] = useState<{ type: string; x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const pressRef = useRef<{ shelfId: string; itemId: string; type: string; x: number; y: number } | null>(null)
  const draggedRef = useRef(false)
  const level = LEVELS[levelIdx]

  // re-deal when the header difficulty tier changes (skip the very first render)
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setState(initState(applyDifficulty(LEVELS[levelIdx], tier)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  // which shelves are legal targets for the currently-picked good (for highlights)
  const legalTargets = useMemo(() => {
    const set = new Set<string>()
    if (state.selected) {
      for (const s of state.shelves) if (isLegalMove(state.shelves, state.selected.shelfId, s.id)) set.add(s.id)
    }
    return set
  }, [state.selected, state.shelves])

  // a sparkle burst centred on a shelf's goods area
  function burstAt(shelfId: string) {
    const el = document.querySelector(`[data-goods="${shelfId}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const id = state.moves * 100 + Math.floor(r.left)
    setSparkles((s) => [...s, { id, left: r.left + r.width / 2, top: r.top + r.height / 2 }])
    window.setTimeout(() => setSparkles((s) => s.filter((x) => x.id !== id)), 700)
  }

  // apply the move to the board + all the feedback (sound, combo, sparkles, win)
  function applyAndFeedback(sourceId: string, itemId: string, targetId: string) {
    const beforeCombo = state.combo
    const res = applyMove(state, sourceId, itemId, targetId)
    setLandId(itemId) // the good that just dropped does a little squash
    window.setTimeout(() => setLandId(null), 320)
    if (res.cleared > 0) {
      // show the 3 line up for a beat, THEN pop them
      setState({ ...state, shelves: placeOnly(state.shelves, sourceId, itemId, targetId), selected: null })
      playPop()
      window.setTimeout(() => {
        setState(res.state)
        playSuccess()
        res.clearedShelfIds.forEach((sid) => burstAt(sid)) // sparkle where each triple cleared
        if (res.state.combo > beforeCombo && res.state.combo >= 2) {
          setComboPop(res.state.combo)
          window.setTimeout(() => setComboPop(0), 900)
        }
        if (res.state.status === 'won') {
          window.setTimeout(playWin, 250)
          const st = starsFor(res.state.score, res.state.total)
          setBestStars((prev) => {
            const next = { ...prev, [level.id]: Math.max(prev[level.id] || 0, st) }
            localStorage.setItem(STARS_KEY, JSON.stringify(next))
            return next
          })
        }
      }, 360)
    } else {
      setState(res.state)
      playPop()
    }
  }

  // move the picked good onto a target shelf — flies smoothly, then lands
  function moveTo(targetId: string) {
    const sel = state.selected
    if (!sel) return
    if (!isLegalMove(state.shelves, sel.shelfId, targetId)) {
      playNudge() // illegal → a little shake, keep the good in hand
      setShakeId(targetId)
      window.setTimeout(() => setShakeId(null), 420)
      return
    }
    const good = state.shelves.find((s) => s.id === sel.shelfId)?.items.find((i) => i.id === sel.itemId)
    const srcEl = document.querySelector(`[data-good="${sel.itemId}"]`)
    const tgtEl = document.querySelector(`[data-goods="${targetId}"]`)
    if (good && srcEl && tgtEl) {
      const f = (srcEl as HTMLElement).getBoundingClientRect()
      const t = (tgtEl as HTMLElement).getBoundingClientRect()
      setHideId(sel.itemId) // hide the real good while its ghost flies
      setFlying({ type: good.type, left: f.left, top: f.top, dx: t.right - 42 - f.left, dy: t.bottom - 44 - f.top, id: Date.now() })
      window.setTimeout(() => {
        setFlying(null)
        setHideId(null)
        applyAndFeedback(sel.shelfId, sel.itemId, targetId)
      }, 250)
    } else {
      applyAndFeedback(sel.shelfId, sel.itemId, targetId)
    }
  }

  // tapping a specific good: pick it up / swap which one is held / or move onto it
  function tapGood(shelfId: string, itemId: string) {
    if (state.status === 'won' || paused) return
    setHint(null)
    if (!state.selected) {
      unlockAudio()
      playTap()
      setState({ ...state, selected: { shelfId, itemId } })
      return
    }
    if (state.selected.shelfId === shelfId) {
      // same shelf → switch to this good, or put it down if it's the same one
      if (state.selected.itemId === itemId) setState({ ...state, selected: null })
      else {
        playTap()
        setState({ ...state, selected: { shelfId, itemId } })
      }
      return
    }
    moveTo(shelfId) // good is on another shelf → drop the held good there
  }

  // tapping the shelf itself (its empty area / plank) → a drop target
  function tapShelf(shelfId: string) {
    if (state.status === 'won' || paused || draggedRef.current) return
    setHint(null)
    if (!state.selected) return
    if (state.selected.shelfId === shelfId) {
      setState({ ...state, selected: null })
      return
    }
    moveTo(shelfId)
  }

  // ── drag a good with the finger/mouse (tap-tap still works too) ──
  function onWinPointerMove(e: PointerEvent) {
    const p = pressRef.current
    if (!p) return
    if (!draggedRef.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      draggedRef.current = true // it's a drag, not a tap
      unlockAudio()
      setHint(null)
      setHideId(p.itemId)
      setState((s) => ({ ...s, selected: { shelfId: p.shelfId, itemId: p.itemId } }))
    }
    if (draggedRef.current) {
      setDrag({ type: p.type, x: e.clientX, y: e.clientY })
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-shelf]')
      setDragOver(over?.getAttribute('data-shelf') ?? null)
    }
  }
  function onWinPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onWinPointerMove)
    window.removeEventListener('pointerup', onWinPointerUp)
    const p = pressRef.current
    pressRef.current = null
    if (!draggedRef.current || !p) return // a plain tap → handled by onClick
    setDrag(null)
    setDragOver(null)
    setHideId(null)
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-shelf]')
    const targetId = over?.getAttribute('data-shelf')
    if (targetId && targetId !== p.shelfId && isLegalMove(state.shelves, p.shelfId, targetId)) {
      applyAndFeedback(p.shelfId, p.itemId, targetId)
    } else {
      setState((s) => ({ ...s, selected: null })) // dropped nowhere useful
    }
    window.setTimeout(() => (draggedRef.current = false), 60) // swallow the trailing click
  }
  function onGoodPointerDown(e: React.PointerEvent, shelfId: string, itemId: string, type: string) {
    if (state.status === 'won' || paused) return
    pressRef.current = { shelfId, itemId, type, x: e.clientX, y: e.clientY }
    draggedRef.current = false
    window.addEventListener('pointermove', onWinPointerMove)
    window.addEventListener('pointerup', onWinPointerUp)
  }

  const doUndo = () => {
    if (!state.history.length) return
    playTap()
    setState(undo(state))
  }
  const doHint = () => {
    playTap()
    const h = getHint(state.shelves)
    if (h) {
      setHint(h)
      window.setTimeout(() => setHint(null), 1700)
    }
  }
  const doShuffle = () => {
    playDice()
    setState({ ...state, shelves: shuffleBoard(state.shelves), selected: null })
  }
  const restart = () => {
    playTap()
    setState(initState(applyDifficulty(level, tier)))
  }
  const goNext = () => {
    const ni = (levelIdx + 1) % LEVELS.length
    playTap()
    setLevelIdx(ni)
    setState(initState(applyDifficulty(LEVELS[ni], tier)))
  }
  const playLevel = (idx: number) => {
    playTap()
    setLevelIdx(idx)
    setState(initState(applyDifficulty(LEVELS[idx], tier)))
    setShowLevels(false)
  }

  const stars = starsFor(state.score, state.total)
  const progress = state.total ? Math.round((state.cleared / state.total) * 100) : 0

  return (
    <GameShell title={t('game.sortshelf')} emoji="🛒" onExit={onExit} levels={{ gameId: 'sortshelf', tiers: LEVEL_TIERS }}>
      {/* ── top bar (no timer!) ── */}
      <div className="ss-top">
        <button className="ss-chip ss-level-chip" onClick={() => setShowLevels(true)}>
          🗂️ {t('ss.level')} {level.id}
        </button>
        <span className="ss-chip ss-score">⭐ {state.score}</span>
        <span className="ss-chip">{t('ss.moves')} {state.moves}</span>
        <button className="ss-chip ss-pause" onClick={() => setPaused(true)} aria-label={t('ss.pause')}>
          ⏸️
        </button>
      </div>
      <div className="ss-progress">
        <span className="ss-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      {comboPop >= 2 && <div className="ss-combo-pop">{t('ss.combo')} ×{comboPop}! 🔥</div>}

      {level.tutorial && <p className="ss-tutorial">{t('ss.tutorial')}</p>}

      {/* ── the shop scene: illustrated backdrop + wooden shelves + shopkeeper ── */}
      <div className="ss-stage">
        <SceneBackdrop src="sortshelf-shop.jpg" position="center 32%" scrim="soft" />

        {/* the shelves (real baked wood ledges / a locked crate) */}
        <div className="ss-board">
          {state.shelves.map((shelf) => {
            const isSource = state.selected?.shelfId === shelf.id
            const isTarget = !!state.selected && legalTargets.has(shelf.id)
            const isHintTarget = hint?.targetId === shelf.id
            return (
              <div
                key={shelf.id}
                role="button"
                tabIndex={0}
                data-shelf={shelf.id}
                className={`ss-shelf ${isSource ? 'is-source' : ''} ${isTarget ? 'is-target' : ''} ${
                  isHintTarget ? 'is-hint' : ''
                } ${dragOver === shelf.id ? 'is-dragover' : ''} ${shelf.locked ? 'is-locked' : ''} ${
                  shakeId === shelf.id ? 'is-shake' : ''
                }`}
                onClick={() => tapShelf(shelf.id)}
              >
                <span className="ss-goods" data-goods={shelf.id}>
                  {/* mystery goods queued behind the visible ones */}
                  {shelf.hiddenItems?.map((h) => (
                    <span className="ss-good is-hidden" key={h.id} aria-hidden="true" />
                  ))}
                  {/* every visible good is tappable — pick ANY one */}
                  {shelf.items.map((it) => {
                    const isPicked = state.selected?.shelfId === shelf.id && state.selected?.itemId === it.id
                    return (
                      <button
                        className={`ss-good ${isPicked ? 'is-picked' : ''} ${
                          hint?.itemId === it.id ? 'is-hint-good' : ''
                        } ${landId === it.id ? 'is-landing' : ''}`}
                        key={it.id}
                        data-good={it.id}
                        style={{
                          backgroundImage: `url("${goodUrl(it.type)}")`,
                          ...(hideId === it.id ? { visibility: 'hidden' as const } : null),
                        }}
                        aria-label={t('ss.item')}
                        onPointerDown={(e) => onGoodPointerDown(e, shelf.id, it.id, it.type)}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (draggedRef.current) return
                          tapGood(shelf.id, it.id)
                        }}
                      />
                    )
                  })}
                </span>
                <span className={`ss-plank ${shelf.locked ? 'ss-crate' : ''}`} />
              </div>
            )
          })}
        </div>

        {/* the shopkeeper — grounded on the shop floor, feet in frame */}
        <div className="ss-keeper" aria-hidden="true">
          <Friend index={KEEPER_INDEX} scale={84 / friendMaxDim(KEEPER_INDEX)} />
        </div>
      </div>

      {/* flying good (smooth move) + sparkle bursts where triples clear */}
      {flying && (
        <span
          className="ss-fly"
          key={flying.id}
          style={{
            left: flying.left,
            top: flying.top,
            backgroundImage: `url("${goodUrl(flying.type)}")`,
            '--dx': `${flying.dx}px`,
            '--dy': `${flying.dy}px`,
          } as React.CSSProperties}
        />
      )}
      {drag && (
        <span
          className="ss-drag"
          style={{ left: drag.x, top: drag.y, backgroundImage: `url("${goodUrl(drag.type)}")` }}
          aria-hidden="true"
        />
      )}
      {sparkles.map((s) => (
        <span className="ss-sparkle" key={s.id} style={{ left: s.left, top: s.top }} aria-hidden="true">
          {[
            ['-24px', '-18px'],
            ['24px', '-18px'],
            ['-28px', '8px'],
            ['28px', '8px'],
            ['0px', '-30px'],
            ['0px', '22px'],
          ].map(([sx, sy], i) => (
            <i key={i} style={{ '--sx': sx, '--sy': sy } as React.CSSProperties} />
          ))}
        </span>
      ))}

      {/* ── boosters ── */}
      <div className="ss-boosters">
        <button className="btn-utility" onClick={doUndo} disabled={!state.history.length} aria-label={t('ss.undo')}>
          <span aria-hidden="true">↩️</span>
        </button>
        <button className="btn-utility" onClick={doHint} aria-label={t('ss.hint')}>
          <span aria-hidden="true">💡</span>
        </button>
        <button className="btn-utility" onClick={doShuffle} aria-label={t('ss.shuffle')}>
          <span aria-hidden="true">🔀</span>
        </button>
        <button className="btn-utility" onClick={restart} aria-label={t('ss.restart')}>
          <span aria-hidden="true">🔄</span>
        </button>
      </div>

      {state.status === 'no_moves' && (
        <div className="ss-banner">
          <span>{t('ss.noMoves')}</span>
        </div>
      )}

      {/* ── win modal ── */}
      {state.status === 'won' && (
        <div className="ss-overlay">
          <div className="ss-confetti" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                style={
                  { left: `${c.x}%`, background: c.c, animationDelay: `${c.d}s`, '--r': `${c.r}deg` } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="ss-modal">
            <h3>{t('ss.win')}</h3>
            <div className="ss-stars">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
            <p className="ss-modal-score">⭐ {state.score} · {state.moves} {t('ss.moves')}</p>
            <div className="ss-modal-btns">
              <button className="big-button" onClick={goNext}>
                {levelIdx < LEVELS.length - 1 ? t('ss.next') : `${t('ss.restart')} 🔄`}
              </button>
              <button className="ss-ghost-btn" onClick={restart}>
                {t('ss.again')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── pause modal ── */}
      {paused && (
        <div className="ss-overlay" onClick={() => setPaused(false)}>
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('ss.pause')} ⏸️</h3>
            <div className="ss-modal-btns">
              <button className="big-button" onClick={() => setPaused(false)}>
                {t('ss.resume')}
              </button>
              <button className="ss-ghost-btn" onClick={() => { setPaused(false); restart() }}>
                {t('ss.restart')} 🔄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── level select ── */}
      {showLevels && (
        <div className="ss-overlay" onClick={() => setShowLevels(false)}>
          <div className="ss-modal ss-levels-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('ss.levels')} 🗂️</h3>
            <div className="ss-level-grid">
              {LEVELS.map((lv, i) => (
                <button
                  key={lv.id}
                  className={`ss-level-btn ${i === levelIdx ? 'is-current' : ''}`}
                  onClick={() => playLevel(i)}
                >
                  <b>{lv.id}</b>
                  <span className="ss-level-stars">
                    {'⭐'.repeat(bestStars[lv.id] || 0)}
                    {'☆'.repeat(3 - (bestStars[lv.id] || 0))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </GameShell>
  )
}
