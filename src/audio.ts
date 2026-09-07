// Gentle Web Audio feedback. No external files, no harsh sounds.
// Designed to be calm and predictable for sensory comfort.

import { getSong } from './music/songs'

let ctx: AudioContext | null = null
let muted = false
// "מצב ערב" (evening mode) quiets everything a touch instead of a hard mute —
// a single master gain every tone() routes through, so one setting scales the
// whole app's sound. 1 = normal, EVENING_GAIN = evening mode.
const EVENING_GAIN = 0.6
let masterGain: GainNode | null = null
let eveningMode = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    masterGain = ctx.createGain()
    masterGain.gain.value = eveningMode ? EVENING_GAIN : 1
    masterGain.connect(ctx.destination)
  }
  // Mobile browsers suspend the context until a user gesture resumes it.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Should be called from within a user gesture (tap) to unlock audio on mobile.
export function unlockAudio() {
  getCtx()
}

// ── Shared access for the music engine (src/games/music/engine.ts). The
// musicians-decade (games 61–70) build their own instrument voices + a
// look-ahead loop scheduler, but they MUST reuse THIS single AudioContext and
// route through the same evening-aware masterGain — never a second context.
// These accessors are the seam: everything the engine schedules still passes
// through masterGain, so evening mode + a future global fade scale it too.
export function getAudioContext(): AudioContext | null {
  return getCtx()
}
export function getMasterGain(): GainNode | null {
  getCtx() // ensure the context + masterGain exist (lazily created on first use)
  return masterGain
}
export function isEvening(): boolean {
  return eveningMode
}

export function setMuted(value: boolean) {
  muted = value
}

export function isMuted() {
  return muted
}

// Scale the master gain for evening mode (called from settings.ts whenever
// the setting changes, and once at startup). Safe to call before the audio
// context exists — the value is applied lazily once getCtx() creates it.
export function setEveningGain(active: boolean) {
  eveningMode = active
  if (ctx && masterGain) {
    masterGain.gain.setTargetAtTime(active ? EVENING_GAIN : 1, ctx.currentTime, 0.05)
  }
  // the recorded laugh clip is a plain <audio> element, outside Web Audio —
  // scale its own volume to match.
  if (laughEl) laughEl.volume = (active ? EVENING_GAIN : 1) * LAUGH_VOLUME
}

type ToneOptions = {
  freq: number
  duration?: number
  type?: OscillatorType
  volume?: number
  delay?: number
}

function tone({ freq, duration = 0.18, type = 'sine', volume = 0.18, delay = 0 }: ToneOptions) {
  const audio = getCtx()
  if (!audio || muted) return
  const start = audio.currentTime + delay
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  // Soft attack + release so nothing clicks or startles.
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(masterGain ?? audio.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

// A soft tap/select sound.
export function playTap() {
  tone({ freq: 440, duration: 0.12, type: 'sine', volume: 0.14 })
}

// A wooden "rattle" of clacks for rolling a die.
export function playDice() {
  ;[0, 0.08, 0.16, 0.24, 0.34].forEach((delay, i) =>
    tone({ freq: 150 + (i % 2) * 40, duration: 0.05, type: 'square', volume: 0.1, delay }),
  )
}

// ±5% pitch jitter so a repeated micro-sound never sounds mechanical.
function jitter() {
  return 0.95 + Math.random() * 0.1
}

// A friendly "bubble pop". `pitch` (a multiplier, default 1) lets callers vary
// it per bubble so a screen full of pops sounds lively, not machine-gun-like.
export function playPop(pitch = 1) {
  const p = pitch * jitter()
  tone({ freq: 660 * p, duration: 0.1, type: 'triangle', volume: 0.16 })
  tone({ freq: 990 * p, duration: 0.08, type: 'sine', volume: 0.1, delay: 0.03 })
}

// A soft, watery "plop" for popping a bubble — rounder and gentler than playPop,
// with per-tap pitch variation for a calm, natural feel.
export function playPlop(pitch = 1) {
  const p = pitch * jitter()
  tone({ freq: 420 * p, duration: 0.12, type: 'sine', volume: 0.15 })
  tone({ freq: 760 * p, duration: 0.07, type: 'triangle', volume: 0.07, delay: 0.02 })
}

// A soft landing "tap" — used when dice settle and when a caught friend lands its
// hop. Low, short, felt more than heard, with a touch of pitch variation.
export function playLand() {
  const p = jitter()
  tone({ freq: 150 * p, duration: 0.11, type: 'sine', volume: 0.16 })
  tone({ freq: 224 * p, duration: 0.06, type: 'triangle', volume: 0.06, delay: 0.01 })
}

// One step of counting — pitch rises with each number, like climbing the blocks.
export function playCount(step: number) {
  // C major scale-ish so a full count sounds musical.
  const scale = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.25]
  const freq = scale[Math.min(step - 1, scale.length - 1)]
  tone({ freq, duration: 0.16, type: 'triangle', volume: 0.16 })
}

// One rising note for the "counting becomes a melody" games (count / connect-
// the-dots / draw-a-number). `step` is 0-based; the pitch climbs a major
// pentatonic scale across three octaves and then wraps, so a count of ANY length
// sounds like a pleasant tune that keeps going up — and never lands on a sour
// note. Honours mute via tone().
const RISE_PENTA = [0, 2, 4, 7, 9] // major-pentatonic semitone offsets
export function playRise(step: number) {
  const i = ((Math.floor(step) % 15) + 15) % 15 // 3-octave climbing riff, then wraps
  const semis = RISE_PENTA[i % RISE_PENTA.length] + Math.floor(i / RISE_PENTA.length) * 12
  const freq = 261.63 * Math.pow(2, semis / 12)
  tone({ freq, duration: 0.22, type: 'triangle', volume: 0.16 })
  tone({ freq: freq * 2, duration: 0.14, type: 'sine', volume: 0.045 }) // soft sparkle
}

// A friend's little "voice" boop when poked — each friend a distinct pitch.
export function playFriend(index: number) {
  // Two octaves so friends 1–20 each sound different.
  const scale = [
    392, 440, 494, 523, 587, 659, 698, 784, 880, 988,
    1047, 1175, 1319, 1397, 1568, 1760, 1865, 2093, 2349, 2637,
  ]
  const freq = scale[index % scale.length]
  tone({ freq, duration: 0.16, type: 'sine', volume: 0.18 })
  tone({ freq: freq * 1.5, duration: 0.12, type: 'triangle', volume: 0.09, delay: 0.05 })
}

// Musical piano-ish note for the "friends piano" (C-major scale: Do Re Mi…),
// longer and softer so a melody sounds nice.
const PIANO_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25]
export function playPiano(degree: number) {
  const n = PIANO_SCALE.length
  const freq = PIANO_SCALE[((degree % n) + n) % n]
  tone({ freq, duration: 0.5, type: 'triangle', volume: 0.2 })
  tone({ freq: freq * 2, duration: 0.4, type: 'sine', volume: 0.06, delay: 0 })
}

// Cheerful rising chime for a correct answer / match.
export function playSuccess() {
  tone({ freq: 523.25, duration: 0.18, type: 'sine', volume: 0.16 })
  tone({ freq: 659.25, duration: 0.18, type: 'sine', volume: 0.16, delay: 0.12 })
  tone({ freq: 783.99, duration: 0.26, type: 'sine', volume: 0.16, delay: 0.24 })
}

// Soft "nom" munch for eating. `rise` (a combo count) climbs the pitch gently —
// up to ~an octave over a fast sweep — for a satisfying chain, then resets calmly.
export function playMunch(rise = 0) {
  const base = 180 * Math.pow(2, Math.min(rise, 12) / 24)
  tone({ freq: base, duration: 0.13, type: 'sine', volume: 0.17 })
  tone({ freq: base * 0.72, duration: 0.11, type: 'triangle', volume: 0.12, delay: 0.07 })
}

// A gentle, non-punishing "try again" — soft and low, never harsh.
export function playNudge() {
  tone({ freq: 300, duration: 0.16, type: 'sine', volume: 0.12 })
}

// Little fanfare when a whole game is finished.
export function playWin() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => tone({ freq, duration: 0.24, type: 'triangle', volume: 0.16, delay: i * 0.14 }))
}

// A soft, warm "tom" for the syllable-clapping game — one gentle beat per tap.
// `step` nudges the pitch a touch per syllable so a word makes a little rhythm.
export function playDrum(step = 0) {
  const base = 158 - Math.min(step, 4) * 9
  tone({ freq: base, duration: 0.24, type: 'sine', volume: 0.2 })
  tone({ freq: base * 1.5, duration: 0.08, type: 'triangle', volume: 0.05 })
}

// A gentle "the friend claps" — a few soft, quick pats (never a sharp smack).
export function playClap() {
  ;[0, 0.1, 0.2].forEach((d, i) =>
    tone({ freq: 480 + i * 70, duration: 0.07, type: 'triangle', volume: 0.13, delay: d }),
  )
}

// ── Sports micro-impacts (research §5: fire the sound on the impact FRAME, keep
// each < ~200ms with a soft attack, and jitter the pitch ±5% so repeats never
// sound mechanical). All stay well under the celebration/voice level (calm).
const PITCH_JITTER = () => 0.95 + Math.random() * 0.1 // ±5%

// A soft, felt bounce/land (ball on ground, pin tap). `strength` 0..1 scales it.
export function playImpact(strength = 0.6) {
  const j = PITCH_JITTER()
  const v = 0.05 + Math.min(0.11, strength * 0.12)
  tone({ freq: 156 * j, duration: 0.1, type: 'sine', volume: v })
  tone({ freq: 96 * j, duration: 0.13, type: 'triangle', volume: v * 0.55, delay: 0.004 })
}

// A muted wall "clack" (air-hockey rebound) — a very short woodblock tick, never
// a sharp smack. `strength` scales with how fast the puck hit the wall.
export function playClack(strength = 0.6) {
  const j = PITCH_JITTER()
  const v = 0.045 + Math.min(0.07, strength * 0.08)
  tone({ freq: 300 * j, duration: 0.05, type: 'triangle', volume: v })
  tone({ freq: 152 * j, duration: 0.06, type: 'sine', volume: v * 0.7, delay: 0.003 })
}

// A soft net "swish" for a basket — two gentle falling breaths on a pentatonic
// pair, so it harmonises with everything else (calm, not a crowd roar).
export function playSwish() {
  const j = PITCH_JITTER()
  tone({ freq: 523.25 * j, duration: 0.13, type: 'sine', volume: 0.05 })
  tone({ freq: 392 * j, duration: 0.16, type: 'sine', volume: 0.05, delay: 0.05 })
}

// ── Number-train journey ──
// A soft coupling "clack" when a car joins; the pitch climbs with the car's
// number so a full consist sounds like a gentle rising scale (calm, felt).
export function playCouple(step = 1) {
  const p = 1 + Math.min(step, 12) * 0.045
  const j = jitter()
  tone({ freq: 190 * p * j, duration: 0.09, type: 'sine', volume: 0.15 })
  tone({ freq: 120 * p * j, duration: 0.11, type: 'triangle', volume: 0.08, delay: 0.015 })
}

// A soft two-tone train whistle — a warm toot, never shrill (used at departure
// and station arrival).
export function playWhistle() {
  tone({ freq: 392, duration: 0.5, type: 'sine', volume: 0.1 })
  tone({ freq: 523.25, duration: 0.5, type: 'sine', volume: 0.09, delay: 0.02 })
  tone({ freq: 587.33, duration: 0.42, type: 'sine', volume: 0.06, delay: 0.06 })
}

// One soft "chuff" of the drive rhythm — low + breathy + short. The game calls
// it on a slow interval while driving (the interval + its cleanup live there).
export function playChuff() {
  const j = jitter()
  tone({ freq: 96 * j, duration: 0.12, type: 'triangle', volume: 0.06 })
  tone({ freq: 150 * j, duration: 0.06, type: 'sine', volume: 0.03, delay: 0.02 })
}

// A soft station bell — two gentle dings on arrival.
export function playStationBell() {
  tone({ freq: 784, duration: 0.4, type: 'sine', volume: 0.09 })
  tone({ freq: 784, duration: 0.5, type: 'sine', volume: 0.08, delay: 0.28 })
}

// ── Children's melodies (the list lives in src/music/songs.ts — public-domain
// tunes generated in code, no audio files). Loops the chosen song.
let melodyTimer: number | null = null
let melodyStop = false
export function stopMelody() {
  melodyStop = true
  if (melodyTimer) {
    window.clearTimeout(melodyTimer)
    melodyTimer = null
  }
}
export function playMelody(id: string, opts: { loop?: boolean; onEnd?: () => void } = {}) {
  const { loop = true, onEnd } = opts
  stopMelody()
  const song = getSong(id)
  if (!song) return
  melodyStop = false
  const beat = 60 / song.bpm
  let i = 0
  const step = () => {
    if (melodyStop) return
    const [semi, beats] = song.notes[i]
    const freq = 261.63 * Math.pow(2, semi / 12)
    tone({ freq, duration: beat * beats * 0.9, type: 'triangle', volume: 0.16 })
    tone({ freq: freq * 2, duration: beat * beats * 0.6, type: 'sine', volume: 0.035 })
    const dur = beat * beats * 1000
    i += 1
    if (i < song.notes.length) {
      melodyTimer = window.setTimeout(step, dur)
    } else if (loop) {
      i = 0
      melodyTimer = window.setTimeout(step, dur)
    } else {
      // play through ONCE (a preview), then signal it's done
      melodyTimer = window.setTimeout(() => {
        melodyTimer = null
        if (!melodyStop) onEnd?.()
      }, dur)
    }
  }
  step()
}

// ── Petting purr — a soft, continuous low rumble, gently amplitude-modulated so
// it "rolls" like a real purr. Starts on a slow stroke, stops within ~300ms of the
// hand lifting. Uses the existing WebAudio context; kept very quiet (calm).
let purrNodes: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null
export function startPurr() {
  const audio = getCtx()
  if (!audio || muted || purrNodes) return
  const now = audio.currentTime
  const osc = audio.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(56, now) // low, felt more than heard
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.25) // soft fade-in
  // a slow tremolo on the amplitude gives the purr its gentle flutter
  const lfo = audio.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(23, now)
  const lfoGain = audio.createGain()
  lfoGain.gain.setValueAtTime(0.022, now)
  lfo.connect(lfoGain).connect(gain.gain)
  osc.connect(gain).connect(audio.destination)
  osc.start(now)
  lfo.start(now)
  purrNodes = { osc, lfo, gain }
}
export function stopPurr() {
  if (!purrNodes) return
  const audio = getCtx()
  const { osc, lfo, gain } = purrNodes
  purrNodes = null
  if (!audio) return
  const now = audio.currentTime
  try {
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26) // fade out within ~300ms
    osc.stop(now + 0.3)
    lfo.stop(now + 0.3)
  } catch {
    /* already stopped */
  }
}

// A short, bright "hit" per dance move (each move a different pitch).
export function playMove(i: number) {
  const scale = [392, 440, 523.25, 587.33, 659.25]
  tone({ freq: scale[i % scale.length], duration: 0.16, type: 'triangle', volume: 0.18 })
}

// ── Silly sounds for the laugh game ──
export function playGiggle() {
  ;[680, 760, 680, 800, 720].forEach((f, i) => tone({ freq: f, duration: 0.07, type: 'sine', volume: 0.14, delay: i * 0.08 }))
}
export function playRaspberry() {
  ;[0, 0.05, 0.1, 0.15, 0.2, 0.25].forEach((d, i) =>
    tone({ freq: 95 + (i % 2) * 30, duration: 0.06, type: 'sawtooth', volume: 0.12, delay: d }),
  )
}
export function playHonk() {
  tone({ freq: 330, duration: 0.18, type: 'square', volume: 0.12 })
  tone({ freq: 247, duration: 0.2, type: 'square', volume: 0.12, delay: 0.16 })
}

// A REAL recorded laugh (royalty-free sound files in public/sfx/) — used by the
// laugh game instead of a robotic spoken "ha ha".
let laughEl: HTMLAudioElement | null = null
const LAUGH_FILES = ['sfx/laugh1.wav', 'sfx/laugh2.mp3']
const LAUGH_VOLUME = 0.75
export function playLaugh() {
  if (muted || typeof Audio === 'undefined') return
  if (laughEl) laughEl.pause()
  laughEl = new Audio(import.meta.env.BASE_URL + LAUGH_FILES[Math.floor(Math.random() * LAUGH_FILES.length)])
  laughEl.volume = (eveningMode ? EVENING_GAIN : 1) * LAUGH_VOLUME
  laughEl.play().catch(() => {})
}
