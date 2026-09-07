// Hebrew text-to-speech using the browser's built-in speechSynthesis.
// No audio files needed. Lets a non-reading child play on his own.
// Controlled by the user's settings (see settings.ts).

let enabled = true
let namesEnabled = true
let voice: SpeechSynthesisVoice | null = null
let langPrefix: 'he' | 'en' = 'he'
let langCode = 'he-IL'

function supported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice() {
  if (!supported()) return
  const voices = window.speechSynthesis.getVoices()
  // pick a voice for the current language ("he"/"iw" for Hebrew, "en" for English)
  voice =
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ??
    (langPrefix === 'he' ? voices.find((v) => v.lang.toLowerCase().startsWith('iw')) : undefined) ??
    null
}

// Switch the spoken language (called from settings when the toggle changes).
export function setSpeechLang(lang: 'he' | 'en') {
  langPrefix = lang
  langCode = lang === 'he' ? 'he-IL' : 'en-US'
  pickVoice()
}

if (supported()) {
  pickVoice()
  // Voices often load asynchronously on first run.
  window.speechSynthesis.onvoiceschanged = pickVoice
}

export function setSpeechEnabled(value: boolean) {
  enabled = value
  if (!value && supported()) window.speechSynthesis.cancel()
}

// Separate, parent-controllable toggle just for friend name/number call-outs
// (e.g. tapping a friend says its name). General voice prompts still work.
export function setNamesEnabled(value: boolean) {
  namesEnabled = value
}

// True only when a real Hebrew voice exists on this device (for the settings
// warning) — independent of the currently-selected language.
export function hasHebrewVoice() {
  if (!supported()) return false
  return window.speechSynthesis
    .getVoices()
    .some((v) => v.lang.toLowerCase().startsWith('he') || v.lang.toLowerCase().startsWith('iw'))
}

// Whether the voice is on (used by the pre-recorded clip player).
export function speechOn() {
  return enabled
}

type SpeakOptions = { rate?: number; pitch?: number }

export function speak(text: string, { rate = 0.92, pitch = 1.05 }: SpeakOptions = {}) {
  if (!enabled || !supported()) return
  // Cancel anything in flight so prompts never overlap or queue up.
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = langCode
  }
  utterance.rate = rate
  utterance.pitch = pitch
  window.speechSynthesis.speak(utterance)
}

// Speak a friend's name/number. Silent when the parent has muted name call-outs
// (or when the voice is off entirely). Use this for "tap a friend → says its
// name" so it can be turned off without silencing game instructions.
export function speakName(text: string, opts?: SpeakOptions) {
  if (!namesEnabled) return
  speak(text, opts)
}

// Speak forcing ENGLISH, regardless of the app's current language — for the
// English-learning games (spell a word, etc.) where the letters/word must sound
// English even though the UI is Hebrew. Picks an English voice if one exists.
export function speakEn(text: string, { rate = 0.85, pitch = 1.05 }: SpeakOptions = {}) {
  if (!enabled || !supported()) return
  window.speechSynthesis.cancel()
  // a lone UPPERCASE letter is read as "capital A" by many voices — lowercase any
  // standalone single letter so it's just the letter name ("ay"). Whole words
  // (CAT, "S is for snake") keep their meaning.
  const spoken = text.replace(/\b[A-Z]\b/g, (c) => c.toLowerCase())
  const utterance = new SpeechSynthesisUtterance(spoken)
  const en = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('en'))
  if (en) utterance.voice = en
  utterance.lang = en?.lang || 'en-US'
  utterance.rate = rate
  utterance.pitch = pitch
  window.speechSynthesis.speak(utterance)
}

export function stopSpeech() {
  if (supported()) window.speechSynthesis.cancel()
}
