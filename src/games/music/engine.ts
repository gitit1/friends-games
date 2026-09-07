// ─────────────────────────────────────────────────────────────────────────────
// SHARED MUSIC ENGINE — the "friends' stage" WebAudio core for the musicians
// decade (games 61–70). Built once here so #61 להקת החברים, #62 מכונת הקצב, and
// every music game after them reuse the SAME sound bank, scheduler, and gain
// discipline instead of re-inventing audio per game.
//
// WHY it sounds calm & never "wrong" (the decade doctrine):
//  • PENTATONIC palette only — any combination of notes is consonant, so a child
//    dropping instruments in any order can never make a sour chord.
//  • Soft-attack synth voices (kalimba / marimba / bell / bass / pluck / pad),
//    each a couple of oscillators with a gentle attack + exponential release —
//    no clicks, no startle. Timbres extend the existing tone() patterns in
//    src/audio.ts rather than forking a second audio stack.
//  • ONE AudioContext for the whole app (from src/audio.ts), opened on first tap.
//    The engine adds its own submix → soft limiter → the shared evening-aware
//    masterGain. The limiter stops layers from clipping as the band fills up.
//  • Voice cap: at most MAX_VOICES sound at once; the oldest is gently stolen.
//  • ±5% pitch jitter on every note so a repeated loop never sounds mechanical.
//  • A look-ahead STEP SCHEDULER driven by the WebAudio clock (not setInterval),
//    so loops stay perfectly in sync and animation can be pushed from audio time.
//
// Games 63–70 reuse: pentaFreq(), the INSTRUMENTS bank, playNote()/playNoteNow(),
// and StepScheduler. See #61/#62 for two worked examples.
// ─────────────────────────────────────────────────────────────────────────────

import { getAudioContext, getMasterGain, isEvening, isMuted } from '../../audio'

// ── Pentatonic palette ───────────────────────────────────────────────────────
// Major-pentatonic semitone offsets. Degrees climb this scale and wrap octaves,
// so pentaFreq(n) for ANY integer n lands on a consonant note.
const PENTA = [0, 2, 4, 7, 9]
const ROOT_HZ = 261.63 // middle C — the palette's degree 0

/** Frequency for pentatonic `degree` (integer, may be negative for bass).
 *  degree 0..4 = one octave of the scale, 5 wraps to the next octave, etc. */
export function pentaFreq(degree: number, rootHz = ROOT_HZ): number {
  const oct = Math.floor(degree / PENTA.length)
  const idx = ((degree % PENTA.length) + PENTA.length) % PENTA.length
  const semis = PENTA[idx] + oct * 12
  return rootHz * Math.pow(2, semis / 12)
}

/** How many degrees are in one octave of the palette (5). */
export const PENTA_STEPS = PENTA.length

// ── Instrument bank ──────────────────────────────────────────────────────────
// Each instrument is a tiny additive-synth recipe: a few partials (harmonic
// ratio + relative gain + wave) sharing one soft attack/decay envelope. All are
// deliberately quiet and rounded — timbres a kalimba/marimba music box would
// make, not a synth lead. `octave` shifts the whole instrument in pentatonic
// octaves (bass sits low, bells sit high) so layers occupy different registers.
type Partial = { ratio: number; gain: number; type: OscillatorType }
export type Instrument = {
  partials: Partial[]
  attack: number // seconds to peak (soft — never < ~4ms so nothing clicks)
  decay: number // seconds of exponential release
  peak: number // envelope ceiling (kept low; the limiter is a safety net, not a crutch)
  octave: number // pentatonic-octave offset applied to the played degree
}

export const INSTRUMENTS: Record<string, Instrument> = {
  // thumb-piano: bright ping + soft octave shimmer, medium ring
  kalimba: { partials: [{ ratio: 1, gain: 1, type: 'triangle' }, { ratio: 2, gain: 0.26, type: 'sine' }, { ratio: 3, gain: 0.08, type: 'sine' }], attack: 0.008, decay: 0.55, peak: 0.15, octave: 5 },
  // wooden mallet: rounded sine with a woody upper partial, short ring
  marimba: { partials: [{ ratio: 1, gain: 1, type: 'sine' }, { ratio: 2, gain: 0.32, type: 'sine' }, { ratio: 4, gain: 0.1, type: 'triangle' }], attack: 0.006, decay: 0.4, peak: 0.16, octave: 5 },
  // soft bell / glockenspiel: inharmonic partials, long gentle tail
  bell: { partials: [{ ratio: 1, gain: 1, type: 'sine' }, { ratio: 2.76, gain: 0.28, type: 'sine' }, { ratio: 5.4, gain: 0.1, type: 'sine' }], attack: 0.005, decay: 1.1, peak: 0.12, octave: 6 },
  // warm round bass — felt more than heard, holds the floor of the mix
  bass: { partials: [{ ratio: 1, gain: 1, type: 'sine' }, { ratio: 2, gain: 0.16, type: 'triangle' }], attack: 0.02, decay: 0.7, peak: 0.2, octave: 3 },
  // gentle plucked string, quick decay — a nimble mid-voice melody
  pluck: { partials: [{ ratio: 1, gain: 1, type: 'triangle' }, { ratio: 3, gain: 0.14, type: 'sine' }], attack: 0.004, decay: 0.32, peak: 0.14, octave: 5 },
  // sustained pad breath — for chord layers; long attack + long release (soft)
  pad: { partials: [{ ratio: 1, gain: 1, type: 'sine' }, { ratio: 2, gain: 0.3, type: 'sine' }, { ratio: 3, gain: 0.12, type: 'triangle' }], attack: 0.09, decay: 1.4, peak: 0.075, octave: 4 },
  // soft woodblock/shaker tick — the pulse. Pitch is nearly fixed (see perc()).
  perc: { partials: [{ ratio: 1, gain: 1, type: 'triangle' }, { ratio: 2, gain: 0.3, type: 'sine' }], attack: 0.004, decay: 0.07, peak: 0.13, octave: 6 },
}

export type InstrumentName = keyof typeof INSTRUMENTS

// ── Engine submix (bus → limiter → shared masterGain) ────────────────────────
let bus: GainNode | null = null // everything the engine plays sums here
let limiter: DynamicsCompressorNode | null = null

function ensureBus(ctx: AudioContext): GainNode | null {
  const master = getMasterGain()
  if (!master) return null
  if (bus && limiter) return bus
  bus = ctx.createGain()
  bus.gain.value = 1
  // A gentle brick-wall-ish limiter so stacking 6–8 loops never clips or gets
  // harsh. High ratio + fast-ish attack, but soft knee so it stays transparent.
  limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 8
  limiter.ratio.value = 12
  limiter.attack.value = 0.004
  limiter.release.value = 0.12
  bus.connect(limiter).connect(master)
  return bus
}

/** Ensure the shared context + engine submix exist (call from a user gesture,
 *  e.g. when the first friend/block is placed). Returns the context or null. */
export function initEngine(): AudioContext | null {
  const ctx = getAudioContext()
  if (!ctx) return null
  ensureBus(ctx)
  return ctx
}

// ── Voice cap (gentle voice-stealing of the oldest) ──────────────────────────
const MAX_VOICES = 8
type ActiveVoice = { end: number; kill: (t: number) => void }
let active: ActiveVoice[] = []

function reap(now: number) {
  active = active.filter((v) => v.end > now)
}

function jitter() {
  return 0.95 + Math.random() * 0.1 // ±5%
}

// ── One scheduled note ───────────────────────────────────────────────────────
type NoteOpts = {
  /** absolute AudioContext time to sound the note (from the scheduler) */
  when?: number
  /** loudness scale 0..~1.3 on top of the instrument's own peak (intensity) */
  gain?: number
  /** override the instrument's pentatonic octave */
  octave?: number
}

/** Schedule one pentatonic note of `instrument` at pentatonic `degree`. Routes
 *  through the engine bus → limiter → masterGain, applies ±5% pitch jitter, and
 *  respects the voice cap. `when` defaults to "now" (a tap); loops pass the
 *  scheduler's precise step time. */
export function playNote(instrument: InstrumentName, degree: number, opts: NoteOpts = {}): void {
  const ctx = initEngine()
  if (!ctx || isMuted() || !bus) return
  const inst = INSTRUMENTS[instrument]
  const when = Math.max(opts.when ?? ctx.currentTime, ctx.currentTime)
  reap(when)
  // voice cap — steal the oldest still-ringing voice if we're at the ceiling
  if (active.length >= MAX_VOICES) {
    active.sort((a, b) => a.end - b.end)
    const victim = active.shift()
    victim?.kill(when)
  }

  const oct = opts.octave ?? inst.octave
  const base = pentaFreq(degree + oct * PENTA_STEPS) * jitter()
  const gScale = (opts.gain ?? 1) * (isEvening() ? 0.85 : 1)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, when)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, inst.peak * gScale), when + inst.attack)
  const endAt = when + inst.attack + inst.decay
  env.gain.exponentialRampToValueAtTime(0.0001, endAt)
  env.connect(bus)

  const oscs: OscillatorNode[] = []
  for (const p of inst.partials) {
    const osc = ctx.createOscillator()
    osc.type = p.type
    osc.frequency.setValueAtTime(base * p.ratio, when)
    const pg = ctx.createGain()
    pg.gain.value = p.gain
    osc.connect(pg).connect(env)
    osc.start(when)
    osc.stop(endAt + 0.03)
    oscs.push(osc)
  }

  const kill = (t: number) => {
    try {
      env.gain.cancelScheduledValues(t)
      env.gain.setValueAtTime(Math.max(env.gain.value, 0.0001), t)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      oscs.forEach((o) => o.stop(t + 0.08))
    } catch {
      /* already stopped */
    }
  }
  active.push({ end: endAt, kill })
}

/** A soft woodblock/shaker tick for the pulse (nearly pitchless). `high` picks a
 *  higher click (e.g. an accent). Reuses the perc instrument at a fixed-ish freq. */
export function playPerc(when: number, high = false): void {
  playNote('perc', high ? 3 : 0, { when, octave: high ? 7 : 6, gain: 0.8 })
}

/** One-shot note "now" (a tap / solo), unscheduled. */
export function playNoteNow(instrument: InstrumentName, degree: number, gain = 1): void {
  playNote(instrument, degree, { gain })
}

// ── Look-ahead step scheduler ────────────────────────────────────────────────
// The WebAudio-clock loop clock. Instead of a setInterval per instrument (which
// drifts and stalls in background tabs), ONE ~25ms timer looks ~120ms ahead and
// schedules every step that falls in that window at its exact audio time. Games
// register a single onStep(step, when) callback and play their own tracks in it.
// Animation reads phase()/currentStep() from the audio clock in rAF — it is
// never driven by React state per frame.
export class StepScheduler {
  bpm = 80
  stepsPerBeat = 4 // 4 = sixteenth notes
  totalSteps = 16 // one loop = this many steps (a game sets it per tier)

  private ctx: AudioContext
  private lookahead = 0.12 // seconds scheduled ahead
  private tickMs = 25
  private timer: number | null = null
  private nextStepTime = 0
  private step = 0
  private startTime = 0 // audio time at which step 0 sounded (for phase())
  private cb: (step: number, when: number) => void = () => {}

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  get stepDur(): number {
    return 60 / this.bpm / this.stepsPerBeat
  }

  /** Register the per-step callback (play this game's tracks for `step` at `when`). */
  onStep(cb: (step: number, when: number) => void): void {
    this.cb = cb
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.step = 0
    this.nextStepTime = this.ctx.currentTime + 0.06
    this.startTime = this.nextStepTime
    this.tick()
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** Change tempo mid-loop while keeping the playhead phase continuous (calm — no
   *  jump). Games expose this as the אלוף "soft tempo" control. */
  setBpm(bpm: number): void {
    const ph = this.phase()
    this.bpm = bpm
    // re-anchor startTime so phase() stays where it was under the new stepDur
    this.startTime = this.ctx.currentTime - ph * this.stepDur
  }

  /** Whole active step right now, from the audio clock (0..totalSteps-1). */
  currentStep(): number {
    if (!this.startTime) return 0
    const elapsed = Math.max(0, this.ctx.currentTime - this.startTime)
    return Math.floor(elapsed / this.stepDur) % this.totalSteps
  }

  /** Continuous playhead phase 0..totalSteps (fractional) — for a smooth bar. */
  phase(): number {
    if (!this.startTime) return 0
    const elapsed = Math.max(0, this.ctx.currentTime - this.startTime)
    return (elapsed / this.stepDur) % this.totalSteps
  }

  private tick = (): void => {
    while (this.nextStepTime < this.ctx.currentTime + this.lookahead) {
      this.cb(this.step % this.totalSteps, this.nextStepTime)
      this.nextStepTime += this.stepDur
      this.step += 1
    }
    this.timer = window.setTimeout(this.tick, this.tickMs)
  }
}
