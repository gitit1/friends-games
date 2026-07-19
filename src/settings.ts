import { useSyncExternalStore } from 'react'
import { setEveningGain, setMuted } from './audio'
import { setNamesEnabled, setSpeechEnabled, setSpeechLang } from './speech'
import type { Lang } from './i18n/types'

// Small persisted settings store. Parents can turn the Hebrew voice or the
// sound effects on/off; choices survive a refresh via localStorage.

/** Which arithmetic operations the child sees (parent-configurable). */
export type Ops = { add: boolean; sub: boolean; mul: boolean; div: boolean }

export type Settings = {
  voice: boolean
  sound: boolean
  /** Say a friend's name/number out loud when tapped. */
  sayNames: boolean
  /** Seconds between switching the "catch" target friend (30 or 60). */
  catchSeconds: number
  /** Default difficulty every game opens at (0 קל · 1 בינוני · 2 קשה · 3 אלוף). */
  difficulty: number
  /** Highest number / friend shown to the child (5 / 10 / 20 / 50 / 100). */
  maxNumber: number
  /** Which arithmetic operations are enabled. */
  ops: Ops
  /** When true, `maxNumber` also caps the "My Friends" roster (not only games). */
  limitRoster: boolean
  /** App language (drives text, voice, and page direction). */
  lang: Lang
  /** Calmer motion: dampens idle/celebration animations (also auto-on if the
   *  device asks for reduced motion). For sensory comfort. */
  reduceMotion: boolean
  /** Pet care model. 'gentle' (default) = the friend is ALWAYS fine: its needs
   *  never decay on their own or while away, and it never looks sad — calm and
   *  autism-friendly. 'regular' = classic care, needs drop over time. */
  petCareMode: 'gentle' | 'regular'
  /** Hebrew address-form (לשון פנייה) used for 2nd-person game text. 'plural'
   *  (default, matches most of the site: בחרו/לחצו) · 'boy' (בחר) · 'girl'
   *  (בחרי). Purely a Hebrew grammar choice — English text is unaffected. */
  address: 'plural' | 'boy' | 'girl'
  /** "מצב ערב" (evening mode) — a parent-controlled wind-down look for the
   *  hour before bed: dims/warms the UI palette and quiets the sound effects.
   *  Visual + audio softening only — no games are hidden in this version. */
  eveningMode: boolean
}

const STORAGE_KEY = 'assaf-games:settings'
// Defaults = "Assaf's level" (advanced): the whole range, every operation, top
// difficulty. A parent lowers it via the level controls / presets in Settings.
const DEFAULTS: Settings = {
  voice: true,
  sound: true,
  sayNames: true,
  catchSeconds: 30,
  difficulty: 3,
  maxNumber: 100,
  ops: { add: true, sub: true, mul: true, div: true },
  limitRoster: false,
  lang: 'he',
  reduceMotion: false,
  petCareMode: 'gentle',
  address: 'plural',
  eveningMode: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw)
    // merge `ops` deeply so an older/partial saved object never drops a key
    return { ...DEFAULTS, ...saved, ops: { ...DEFAULTS.ops, ...(saved.ops ?? {}) } }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

function applySideEffects() {
  setMuted(!current.sound)
  setSpeechEnabled(current.voice)
  setNamesEnabled(current.sayNames)
  setSpeechLang(current.lang)
  setEveningGain(current.eveningMode)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current.lang
    document.documentElement.dir = current.lang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.classList.toggle('reduce-motion', current.reduceMotion)
    // dimmer/warmer UI palette (DOM only — see .evening-mode in app.css, scoped
    // to stay clear of the Three.js canvas)
    document.documentElement.classList.toggle('evening-mode', current.eveningMode)
  }
}

// Reflect persisted settings into the audio/speech modules at startup.
applySideEffects()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Private-mode / storage-disabled: settings just won't persist. No crash.
  }
}

export function getSettings() {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  persist()
  applySideEffects()
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}
