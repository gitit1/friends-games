import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { unlockAudio, playTap } from '../audio'
import { speak } from '../speech'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import { prefersReducedMotion } from './util'
import { screenScale, useViewport } from '../useViewport'
import { useT, useLang } from '../i18n'
import { initEngine, playNote, playNoteNow, StepScheduler, type InstrumentName } from './music/engine'
import { savePattern, usePatternBook } from './music/collection'

// ── #62 מכונת הקצב — Loopimal, friends edition ──────────────────────────────
// Host דאבי (friend 61) stands over a track of slots. The child fills slots with
// coloured blocks (each = a move + a pentatonic sound); the sequence loops under
// a gliding playhead, blocks light as they sound, and Dabi dances a different
// move per block. Patterns = math through music; every arrangement works. The
// playhead + slot-lighting + Dabi's bob are driven by rAF reading the audio
// clock (never per-frame setState); audio is scheduled off the render loop.

const DABI = 61 // friend #62, the dancer

type Move = 'jump' | 'spin' | 'sway'
type Block = { key: string; color: string; icon: string; inst: InstrumentName; degree: number; move: Move }
const BLOCKS: Block[] = [
  { key: 'a', color: '#fb923c', icon: '🔶', inst: 'marimba', degree: 0, move: 'jump' },
  { key: 'b', color: '#818cf8', icon: '🔷', inst: 'marimba', degree: 2, move: 'sway' },
  { key: 'c', color: '#f472b6', icon: '🔺', inst: 'marimba', degree: 4, move: 'spin' },
  { key: 'd', color: '#5eead4', icon: '⭐', inst: 'bell', degree: 7, move: 'jump' },
  { key: 'e', color: '#a3e635', icon: '🟢', inst: 'kalimba', degree: 5, move: 'sway' },
  { key: 'f', color: '#e879f9', icon: '🥁', inst: 'perc', degree: 0, move: 'spin' },
]
const BLOCK_BY_KEY: Record<string, Block> = Object.fromEntries(BLOCKS.map((b) => [b.key, b]))

const SLOTS_BY_TIER = [4, 8, 8, 8]
const BLOCKS_BY_TIER = [3, 6, 6, 6]
const TRACKS_BY_TIER = [1, 1, 2, 2]
const LEVEL_TIERS = [0, 1, 2, 3]
const DEFAULT_BPM = 78

function emptyTracks(slots: number, tracks: number): (string | null)[][] {
  return Array.from({ length: tracks }, () => Array<string | null>(slots).fill(null))
}

export default function RhythmBlocks({ onExit }: GameProps) {
  const { t } = useT()
  const lang = useLang()
  const vp = useViewport()
  const initialTier = levelForTier(LEVEL_TIERS, getSettings().difficulty)
  const [tier, setTier] = useState(initialTier)
  const slotCount = SLOTS_BY_TIER[tier]
  const trackCount = TRACKS_BY_TIER[tier]
  const blockCount = BLOCKS_BY_TIER[tier]

  const [tracks, setTracks] = useState<(string | null)[][]>(() =>
    emptyTracks(SLOTS_BY_TIER[initialTier], TRACKS_BY_TIER[initialTier]),
  )
  const [brush, setBrush] = useState<string>(BLOCKS[0].key)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [lock, setLock] = useState(false) // "pattern lock" flash on loop complete
  const book = usePatternBook()

  const tracksRef = useRef(tracks)
  const schedRef = useRef<StepScheduler | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const dabiRef = useRef<HTMLDivElement>(null)
  const prevPhase = useRef(0)
  const lastLit = useRef(-1)
  tracksRef.current = tracks

  const f = screenScale(vp.w)
  const dabiPx = Math.round(150 * f)

  function ensureScheduler(): StepScheduler | null {
    if (schedRef.current) return schedRef.current
    const ctx = initEngine()
    if (!ctx) return null
    const s = new StepScheduler(ctx)
    s.bpm = bpm
    s.stepsPerBeat = 2
    s.totalSteps = SLOTS_BY_TIER[tier]
    s.onStep((step, when) => {
      const cur = tracksRef.current
      let sounded = false
      cur.forEach((row, tIdx) => {
        const key = row[step]
        if (!key) return
        const b = BLOCK_BY_KEY[key]
        // track 0 keeps each block's own timbre; a second track (hard+) shimmers
        // the same pentatonic degrees on bells, an octave up, as a harmony layer
        const inst: InstrumentName = tIdx === 1 ? 'bell' : b.inst
        playNote(inst, b.degree, { when, gain: 0.95 })
        sounded = true
      })
      // soft "playhead tick" on each quarter pulse, so the moving head is felt
      if (step % s.stepsPerBeat === 0 && (sounded || cur.some((r) => r.some(Boolean)))) {
        playNote('perc', 0, { when, gain: 0.26, octave: 7 })
      }
    })
    schedRef.current = s
    return s
  }
  function syncTransport() {
    const s = ensureScheduler()
    if (!s) return
    s.totalSteps = SLOTS_BY_TIER[tier]
    const any = tracksRef.current.some((r) => r.some(Boolean))
    if (any && !s.running) s.start()
    else if (!any && s.running) s.stop()
  }

  // ── rAF: playhead glide + slot lighting + Dabi bob/move + loop-lock flash ──
  useEffect(() => {
    let raf = 0
    const reduce = prefersReducedMotion()
    const loop = () => {
      const s = schedRef.current
      const wrap = wrapRef.current
      const head = playheadRef.current
      if (wrap && head) {
        const slots = SLOTS_BY_TIER[tier]
        const slotW = wrap.clientWidth / slots
        if (s && s.running) {
          const ph = s.phase() // 0..slots (continuous)
          // playhead is INFORMATION — it always glides, even under reduce-motion
          head.style.width = `${slotW}px`
          head.style.insetInlineStart = `${(ph % slots) * slotW}px`
          head.style.opacity = '1'
          const lit = Math.floor(ph) % slots
          if (lit !== lastLit.current) {
            const rows = wrap.querySelectorAll<HTMLElement>('.rb-track')
            rows.forEach((row) => {
              row.children[lastLit.current]?.classList.remove('is-lit')
              row.children[lit]?.classList.add('is-lit')
            })
            // Dabi performs the move of the block now sounding (track 0)
            const key0 = tracksRef.current[0]?.[lit]
            if (dabiRef.current) {
              dabiRef.current.classList.remove('dabi-jump', 'dabi-spin', 'dabi-sway')
              if (key0 && !reduce) dabiRef.current.classList.add(`dabi-${BLOCK_BY_KEY[key0].move}`)
            }
            lastLit.current = lit
          }
          // Dabi's calm bob, on the beat, from the audio clock
          if (dabiRef.current) {
            const beat = (s.phase() % s.stepsPerBeat) / s.stepsPerBeat
            const bob = reduce ? 0 : (1 - beat) * 7
            dabiRef.current.style.setProperty('--bob', `${bob.toFixed(1)}px`)
          }
          // pattern-lock: the loop just wrapped back to the start
          if (ph < prevPhase.current - 1) {
            setLock(true)
            window.setTimeout(() => setLock(false), 420)
          }
          prevPhase.current = ph
        } else {
          head.style.opacity = '0'
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tier])

  useEffect(() => {
    speak('תסדר לי צעדים ואני ארקוד') // Dabi's anchor line
    return () => schedRef.current?.stop()
  }, [])

  function chooseTier(i: number) {
    unlockAudio()
    playTap()
    setTier(i)
    const fresh = emptyTracks(SLOTS_BY_TIER[i], TRACKS_BY_TIER[i])
    setTracks(fresh)
    tracksRef.current = fresh
    lastLit.current = -1
    schedRef.current?.stop()
  }

  function paintSlot(trackIdx: number, slot: number) {
    unlockAudio()
    const cur = tracks[trackIdx][slot]
    const nextKey = cur === brush ? null : brush
    setTracks((prev) => prev.map((row, ti) => (ti === trackIdx ? row.map((c, si) => (si === slot ? nextKey : c)) : row)))
    tracksRef.current = tracksRef.current.map((row, ti) =>
      ti === trackIdx ? row.map((c, si) => (si === slot ? nextKey : c)) : row,
    )
    // immediate feedback: hear the block you just placed
    if (nextKey) {
      const b = BLOCK_BY_KEY[nextKey]
      playNoteNow(trackIdx === 1 ? 'bell' : b.inst, b.degree, 0.9)
    } else {
      playTap()
    }
    syncTransport()
  }

  function changeBpm(delta: number) {
    playTap()
    const next = Math.max(70, Math.min(90, bpm + delta))
    setBpm(next)
    schedRef.current?.setBpm(next)
  }

  function savePat() {
    if (!tracks.some((r) => r.some(Boolean))) return
    playTap()
    savePattern(tracks)
    speak('שמרתי את התבנית')
  }

  const dir = lang === 'he' ? 'rtl' : 'ltr'

  return (
    <GameShell title={t('game.rhythmblocks')} emoji="🥁" onExit={onExit} canvasLayout>
      <div className="rb-screen">
        {/* level pills + (אלוף) tempo + save */}
        <div className="rb-toolbar">
          <div className="rb-levels">
            {LEVEL_TIERS.map((_, i) => (
              <button key={i} className={`pill ${i === tier ? 'pill-active' : ''}`} onClick={() => chooseTier(i)}>
                {t(`diff.${i}`)}
              </button>
            ))}
          </div>
          <div className="rb-tool-btns">
            {tier >= 3 && (
              <span className="rb-tempo" dir="ltr">
                <button className="rb-t-btn" onClick={() => changeBpm(-4)} aria-label={t('rb.slower')}>
                  −
                </button>
                <span className="rb-tempo-val" aria-hidden="true">
                  ♩{bpm}
                </span>
                <button className="rb-t-btn" onClick={() => changeBpm(4)} aria-label={t('rb.faster')}>
                  +
                </button>
              </span>
            )}
            {tier >= 3 && (
              <button className="pill" onClick={savePat}>
                💾 {t('rb.save')}
              </button>
            )}
          </div>
        </div>

        {/* Dabi on the soft evening stage */}
        <div className={`rb-stage ${lock ? 'is-lock' : ''}`}>
          <div className="rb-bg" aria-hidden="true" />
          <div className="rb-floor" aria-hidden="true" />
          <div className="rb-dabi" ref={dabiRef}>
            <span className="rb-dabi-shadow" aria-hidden="true" />
            <Friend index={DABI} scale={dabiPx / friendMaxDim(DABI)} showNumber={false} lively />
          </div>
        </div>

        <p className="gh-hint" aria-hidden="true">
          {t('rb.hint')}
        </p>

        {/* block palette (the brush) */}
        <div className="rb-palette" role="group" aria-label={t('rb.palette')}>
          {BLOCKS.slice(0, blockCount).map((b) => (
            <button
              key={b.key}
              className={`rb-block-btn ${brush === b.key ? 'is-brush' : ''}`}
              style={{ '--bc': b.color } as React.CSSProperties}
              onClick={() => {
                playTap()
                setBrush(b.key)
              }}
              aria-pressed={brush === b.key}
              aria-label={t('rb.pickBlock')}
            >
              <span aria-hidden="true">{b.icon}</span>
            </button>
          ))}
        </div>

        {/* the track(s) with a gliding playhead — reading-forward in both langs */}
        <div className="rb-tracks" ref={wrapRef} dir={dir}>
          <div className="rb-playhead" ref={playheadRef} aria-hidden="true" />
          {Array.from({ length: trackCount }).map((_, ti) => (
            <div className="rb-track" key={ti} style={{ '--slots': slotCount } as React.CSSProperties}>
              {Array.from({ length: slotCount }).map((_, si) => {
                const key = tracks[ti]?.[si]
                const b = key ? BLOCK_BY_KEY[key] : null
                return (
                  <button
                    key={si}
                    className={`rb-slot ${b ? 'is-filled' : ''}`}
                    style={b ? ({ '--bc': b.color } as React.CSSProperties) : undefined}
                    onClick={() => paintSlot(ti, si)}
                    aria-label={t('rb.slot', { n: si + 1 })}
                  >
                    {b && (
                      <span className="rb-slot-icon" aria-hidden="true">
                        {b.icon}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {book.length > 0 && (
          <div className="rb-book" aria-label={t('rb.book')}>
            <span className="rb-book-label">📖 {t('rb.book')}</span>
            <span className="rb-book-count">{book.length}</span>
          </div>
        )}
      </div>
    </GameShell>
  )
}
