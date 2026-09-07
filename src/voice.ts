import { speak, speechOn, stopSpeech } from './speech'
import { numberWord } from './games/util'
import { getSettings } from './settings'

// Plays a PRE-RECORDED clip (public/voice/<id>.mp3) for a fixed line, and falls
// back to the browser voice if the clip isn't there yet. This lets us swap the
// robotic TTS for a natural voice gradually: drop in clips and they're used; if
// a clip is missing the app still talks (TTS). Missing ids are remembered so we
// don't re-fetch a 404 every time.
let current: HTMLAudioElement | null = null
const missing = new Set<string>()

export function stopClip() {
  if (current) {
    current.pause()
    current = null
  }
  stopSpeech()
}

export function playClip(id: string, fallback: string, onEnd?: () => void) {
  if (!speechOn()) {
    onEnd?.()
    return
  }
  stopClip()
  // clips live per language: public/voice/<lang>/<id>.mp3
  const key = `${getSettings().lang}/${id}`
  let done = false
  const finish = () => {
    if (!done) {
      done = true
      onEnd?.()
    }
  }
  if (missing.has(key)) {
    speak(fallback)
    if (onEnd) window.setTimeout(finish, 1200)
    return
  }
  const audio = new Audio(`${import.meta.env.BASE_URL}voice/${key}.mp3`)
  current = audio
  let failed = false
  const onFail = () => {
    if (failed) return
    failed = true
    missing.add(key)
    if (current === audio) current = null
    speak(fallback)
    if (onEnd) window.setTimeout(finish, 1200)
  }
  audio.addEventListener('error', onFail)
  audio.addEventListener('ended', finish)
  audio.play().catch(onFail)
}

// Read a single number — plays the recorded `num-<n>.mp3` if present, otherwise
// the (niqqud) browser voice. Use this everywhere a game reads a number ALOUD,
// so dropping in recorded clips fixes the pronunciation across the whole app.
export function speakNumber(n: number) {
  // English TTS reads the digits correctly ("22" → twenty-two); Hebrew uses the
  // niqqud word. The recorded clip (when present) wins either way.
  const en = getSettings().lang === 'en'
  playClip(`num-${n}`, en ? String(n) : numberWord(n))
}
