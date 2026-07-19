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
import { useT } from '../i18n'
import {
  initEngine,
  playNote,
  playNoteNow,
  StepScheduler,
  type InstrumentName,
} from './music/engine'
import { saveBand, useBandShelf } from './music/collection'

// ── #61 להקת החברים — Toca-Band, friends edition ────────────────────────────
// Host ריקו (friend 60) raises a baton; the child fills the evening stage with
// friends and each joins with its own calm pentatonic LOOP, all locked to one
// look-ahead scheduler so nothing is ever out of time or "wrong". Higher on the
// stage = more intense (denser + a touch louder). Tap a friend for a little
// solo. No score, no losing. Uses the shared music engine (engine.ts).

const RICO = 60 // friend #61, the conductor

// One loop-instrument = a band member (friend) + a timbre + a 16-step pentatonic
// pattern (degree per step, null = rest). Intensity 0/1/2 = sparse/normal/dense.
type Bank = {
  key: string
  inst: InstrumentName
  friend: number
  emoji: string
  pattern: (number | null)[]
  fill: number // degree used for the intensity-2 off-beat fills
}
const N = null
// prettier-ignore
const LOOP_BANK: Bank[] = [
  { key: 'bass',    inst: 'bass',    friend: 66, emoji: '🎵', fill: 2,
    pattern: [0, N, N, N, 4, N, N, N, 2, N, N, N, 4, N, N, N] },
  { key: 'perc',    inst: 'perc',    friend: 61, emoji: '🥁', fill: 0,
    pattern: [0, N, 0, N, 0, N, 0, N, 0, N, 0, N, 0, N, 0, N] },
  { key: 'kalimba', inst: 'kalimba', friend: 63, emoji: '🎼', fill: 7,
    pattern: [4, N, 7, N, 9, N, 7, N, 4, N, 2, N, 0, N, 4, N] },
  { key: 'pad',     inst: 'pad',     friend: 68, emoji: '🎶', fill: 4,
    pattern: [2, N, N, N, N, N, N, N, 4, N, N, N, N, N, N, N] },
  { key: 'pluck',   inst: 'pluck',   friend: 67, emoji: '🎸', fill: 9,
    pattern: [N, 4, N, 7, N, 9, N, 7, N, 4, N, 2, N, 4, N, 7] },
  { key: 'marimba', inst: 'marimba', friend: 64, emoji: '🎹', fill: 4,
    pattern: [0, N, 4, N, 2, N, 4, N, 7, N, 4, N, 2, N, 0, N] },
  { key: 'bell',    inst: 'bell',    friend: 69, emoji: '🔔', fill: 4,
    pattern: [7, N, N, N, N, N, N, N, 9, N, N, N, N, N, N, N] },
  { key: 'melody2', inst: 'kalimba', friend: 65, emoji: '🎤', fill: 2,
    pattern: [9, N, 7, N, 4, N, 2, N, 4, N, 7, N, 9, N, 7, N] },
]

// spots + how many instruments the drawer offers, per tier (cumulative · אלוף=all)
const SPOTS_BY_TIER = [3, 6, 6, 8]
const BANK_BY_TIER = [3, 6, 6, 8]
const LEVEL_TIERS = [0, 1, 2, 3]
const BPM = 78
const INTENSITY_GAIN = [0.82, 1, 1.18]

type Spot = { bank: number; intensity: number } | null

/** Which pentatonic degree (if any) this bank plays at `step`, given intensity. */
function degreeAt(b: Bank, step: number, intensity: number): number | null {
  const base = b.pattern[step]
  if (intensity === 0) return step % 4 === 0 ? base : null // sparse: downbeats only
  if (intensity === 2 && base == null && step % 2 === 1) return b.fill // dense: off-beat fills
  return base
}

export default function BandGame({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const initialTier = levelForTier(LEVEL_TIERS, getSettings().difficulty)
  const [tier, setTier] = useState(initialTier)
  const spotCount = SPOTS_BY_TIER[tier]
  const bankCount = BANK_BY_TIER[tier]
  const heightControl = tier >= 2

  const [spots, setSpots] = useState<Spot[]>(() => Array(SPOTS_BY_TIER[initialTier]).fill(null))
  const [wave, setWave] = useState(0) // spotlight-sweep trigger (increments on add)
  const [flash, setFlash] = useState<number | null>(null) // spot index doing a tap-solo
  const [ending, setEnding] = useState(false) // curtain-close in progress
  const shelf = useBandShelf()

  const spotsRef = useRef<Spot[]>(spots)
  const schedRef = useRef<StepScheduler | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  spotsRef.current = spots

  const f = screenScale(vp.w)
  const memberPx = Math.round(74 * f)

  // ── scheduler: one shared clock plays every placed friend's loop ───────────
  function ensureScheduler(): StepScheduler | null {
    if (schedRef.current) return schedRef.current
    const ctx = initEngine()
    if (!ctx) return null
    const s = new StepScheduler(ctx)
    s.bpm = BPM
    s.stepsPerBeat = 4
    s.totalSteps = 16
    s.onStep((step, when) => {
      const cur = spotsRef.current
      for (const spot of cur) {
        if (!spot) continue
        const b = LOOP_BANK[spot.bank]
        const deg = degreeAt(b, step, spot.intensity)
        if (deg == null) continue
        playNote(b.inst, deg, { when, gain: INTENSITY_GAIN[spot.intensity] })
      }
    })
    schedRef.current = s
    return s
  }
  function syncTransport() {
    const s = ensureScheduler()
    if (!s) return
    const any = spotsRef.current.some(Boolean)
    if (any && !s.running) s.start()
    else if (!any && s.running) s.stop()
  }

  // ── on-beat "breathing": drive one CSS var from the audio clock via rAF ────
  useEffect(() => {
    let raf = 0
    const reduce = prefersReducedMotion()
    const loop = () => {
      const s = schedRef.current
      const el = stageRef.current
      if (el) {
        let pulse = 0
        if (s && s.running && !reduce) {
          const beatPhase = (s.phase() % s.stepsPerBeat) / s.stepsPerBeat
          pulse = 1 - beatPhase // 1 on the beat → 0 before the next (soft saw)
        }
        el.style.setProperty('--beat', pulse.toFixed(3))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    speak('מי מצטרף ללהקה שלנו?') // Rico's anchor line
    return () => {
      schedRef.current?.stop()
      timers.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  function chooseTier(i: number) {
    unlockAudio()
    playTap()
    setTier(i)
    setSpots(Array(SPOTS_BY_TIER[i]).fill(null))
    spotsRef.current = Array(SPOTS_BY_TIER[i]).fill(null)
    schedRef.current?.stop()
    setEnding(false)
  }

  // tap a drawer instrument: place into the first empty spot, or (if already on
  // stage) lift it off with a soft falling woop
  function toggleBank(bankIdx: number) {
    unlockAudio()
    if (ending) return
    const at = spots.findIndex((s) => s?.bank === bankIdx)
    if (at >= 0) {
      // remove — falling woop
      const b = LOOP_BANK[bankIdx]
      playNoteNow(b.inst, 2, 0.5)
      playNoteNow(b.inst, -1, 0.4)
      setSpots((prev) => prev.map((s, i) => (i === at ? null : s)))
      spotsRef.current = spotsRef.current.map((s, i) => (i === at ? null : s))
      syncTransport()
      return
    }
    const empty = spots.findIndex((s) => s == null)
    if (empty < 0) return // stage full — no-fail, just nothing happens
    const next: Spot = { bank: bankIdx, intensity: 1 }
    setSpots((prev) => prev.map((s, i) => (i === empty ? next : s)))
    spotsRef.current = spotsRef.current.map((s, i) => (i === empty ? next : s))
    // soft placing "pling" + a spotlight sweep
    playNoteNow(LOOP_BANK[bankIdx].inst, 4, 0.7)
    setWave((w) => w + 1)
    syncTransport()
  }

  // tap a friend already on stage: a little rising solo flourish + glow
  function soloSpot(spotIdx: number) {
    unlockAudio()
    const spot = spots[spotIdx]
    if (!spot) return
    const b = LOOP_BANK[spot.bank]
    ;[4, 7, 9, 11].forEach((deg, k) =>
      window.setTimeout(() => playNoteNow(b.inst, deg, 0.9), k * 90),
    )
    setFlash(spotIdx)
    window.setTimeout(() => setFlash((s) => (s === spotIdx ? null : s)), 900)
  }

  function setIntensity(spotIdx: number, delta: number) {
    unlockAudio()
    playTap()
    setSpots((prev) =>
      prev.map((s, i) =>
        i === spotIdx && s ? { ...s, intensity: Math.max(0, Math.min(2, s.intensity + delta)) } : s,
      ),
    )
    spotsRef.current = spotsRef.current.map((s, i) =>
      i === spotIdx && s ? { ...s, intensity: Math.max(0, Math.min(2, s.intensity + delta)) } : s,
    )
  }

  function saveMySong() {
    if (!spots.some(Boolean)) return
    playTap()
    saveBand(spots.map((s) => (s ? s.bank : null)))
    speak('שמרתי את השיר שלנו')
  }

  // 🎬 close the show — loops fade one by one to silence, then the curtain dims
  function endShow() {
    if (ending || !spots.some(Boolean)) return
    unlockAudio()
    setEnding(true)
    const occupied = spots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0)
    occupied.forEach((idx, k) => {
      timers.current.push(
        window.setTimeout(() => {
          const b = spotsRef.current[idx]
          if (b) playNoteNow(LOOP_BANK[b.bank].inst, 0, 0.4)
          setSpots((prev) => prev.map((s, i) => (i === idx ? null : s)))
          spotsRef.current = spotsRef.current.map((s, i) => (i === idx ? null : s))
          syncTransport()
        }, k * 300),
      )
    })
    timers.current.push(window.setTimeout(() => setEnding(false), occupied.length * 300 + 900))
  }

  const onStageCount = spots.filter(Boolean).length

  return (
    <GameShell title={t('game.band')} emoji="🎸" onExit={onExit} canvasLayout>
      <div className="band-screen">
        {/* level pills + tools */}
        <div className="band-toolbar">
          <div className="band-levels">
            {LEVEL_TIERS.map((_, i) => (
              <button
                key={i}
                className={`pill ${i === tier ? 'pill-active' : ''}`}
                onClick={() => chooseTier(i)}
              >
                {t(`diff.${i}`)}
              </button>
            ))}
          </div>
          <div className="band-tool-btns">
            {tier >= 3 && (
              <button className="pill" onClick={saveMySong} disabled={onStageCount === 0}>
                💾 {t('band.save')}
              </button>
            )}
            <button className="pill" onClick={endShow} disabled={onStageCount === 0 || ending}>
              🎬 {t('band.end')}
            </button>
          </div>
        </div>

        {/* instrument drawer (second-top strip) */}
        <div className="band-drawer" role="group" aria-label={t('band.drawer')}>
          {LOOP_BANK.slice(0, bankCount).map((b, i) => {
            const on = spots.some((s) => s?.bank === i)
            return (
              <button
                key={b.key}
                className={`band-chip ${on ? 'is-on' : ''}`}
                onClick={() => toggleBank(i)}
                aria-pressed={on}
                aria-label={t('band.add', { name: `${b.emoji}` })}
              >
                <span className="band-chip-friend">
                  <Friend index={b.friend} scale={44 / friendMaxDim(b.friend)} showNumber={false} />
                </span>
                <span className="band-chip-emoji" aria-hidden="true">
                  {b.emoji}
                </span>
              </button>
            )
          })}
        </div>

        <p className="gh-hint" aria-hidden="true">
          {t('band.hint')}
        </p>

        {/* the evening stage — curtain → floor → spotlight → Rico + spots */}
        <div className={`band-stage ${ending ? 'is-ending' : ''}`} ref={stageRef}>
          <div className="band-curtain" aria-hidden="true" />
          <div className="band-floor" aria-hidden="true" />
          <div className="band-spotlight" aria-hidden="true" />
          {wave > 0 && <div className="band-wave" key={wave} aria-hidden="true" />}

          <div className="band-rico" aria-hidden="true">
            <span className="band-baton" />
            <Friend index={RICO} scale={memberPx / friendMaxDim(RICO)} showNumber={false} lively />
          </div>

          <div className="band-spots" data-count={spotCount}>
            {spots.map((spot, i) => {
              if (!spot) {
                return (
                  <div className="band-spot is-empty" key={i} aria-hidden="true">
                    <span className="band-spot-ring" />
                  </div>
                )
              }
              const b = LOOP_BANK[spot.bank]
              return (
                <div
                  className={`band-spot int-${spot.intensity} ${flash === i ? 'is-solo' : ''}`}
                  key={i}
                >
                  <button
                    className="band-member"
                    onClick={() => soloSpot(i)}
                    aria-label={t('band.solo')}
                  >
                    <span className="band-member-shadow" aria-hidden="true" />
                    <Friend
                      index={b.friend}
                      scale={memberPx / friendMaxDim(b.friend)}
                      showNumber={false}
                      lively
                    />
                  </button>
                  {heightControl && (
                    <div className="band-height" aria-hidden={false}>
                      <button
                        className="band-h-btn"
                        onClick={() => setIntensity(i, 1)}
                        disabled={spot.intensity >= 2}
                        aria-label={t('band.up')}
                      >
                        ▲
                      </button>
                      <button
                        className="band-h-btn"
                        onClick={() => setIntensity(i, -1)}
                        disabled={spot.intensity <= 0}
                        aria-label={t('band.down')}
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* band shelf — saved lineups (אלוף) */}
        {shelf.length > 0 && (
          <div className="band-shelf" aria-label={t('band.shelf')}>
            <span className="band-shelf-label">🎼 {t('band.shelf')}</span>
            <span className="band-shelf-count">{shelf.length}</span>
          </div>
        )}
      </div>
    </GameShell>
  )
}
