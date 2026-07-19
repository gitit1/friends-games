import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playTap, playWin, unlockAudio } from '../audio'
import { speakEn } from '../speech'
import { useT } from '../i18n'
import { LetterGuy } from './LetterGuy'
import { LEVELS } from './englishWords'

// "Blend Sounds" (English phonics) — sound out a short word and blend it. The
// child taps each letter to hear its SOUND (/c/ /a/ /t/), then taps "blend" and
// the letters slide together while the sounds run into the whole word ("cat") and
// the picture comes to life. The real reading skill (blending), no timer/no fail.
// Reuses the living-letter characters; uses the 3-letter words from the shared bank.
const WORDS = LEVELS[0] // the 3-letter CVC words (CAT, DOG, SUN, …)

// an approximate spoken SOUND per letter (browser TTS says letter NAMES otherwise),
// so blending sounds like phonics rather than "see-ay-tee"
const SOUND: Record<string, string> = {
  A: 'ah', B: 'buh', C: 'kuh', D: 'duh', E: 'eh', F: 'fff', G: 'guh', H: 'huh',
  I: 'ih', J: 'juh', K: 'kuh', L: 'luh', M: 'muh', N: 'nuh', O: 'oh', P: 'puh',
  Q: 'kwuh', R: 'ruh', S: 'sss', T: 'tuh', U: 'uh', V: 'vuh', W: 'wuh', X: 'ks',
  Y: 'yuh', Z: 'zzz',
}
const soundOf = (ch: string) => SOUND[ch] ?? ch

export default function BlendSounds({ onExit }: GameProps) {
  const { t } = useT()
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * WORDS.length))
  const item = WORDS[idx]
  const [blending, setBlending] = useState(false)
  const [alive, setAlive] = useState(false)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => clear, [])

  function newWord() {
    clear()
    playTap()
    const n = WORDS.length
    setIdx((i) => (i + 1 + Math.floor(Math.random() * (n - 1))) % n)
    setBlending(false)
    setAlive(false)
  }

  function tapLetter(ch: string) {
    if (blending) return
    unlockAudio()
    speakEn(soundOf(ch))
  }

  function blend() {
    if (blending) return
    unlockAudio()
    setBlending(true)
    const chars = item.word.split('')
    // run the sounds together quickly, then say the whole word
    chars.forEach((ch, i) => later(() => speakEn(soundOf(ch)), i * 420))
    later(() => speakEn(item.word), chars.length * 420 + 250)
    later(() => {
      setAlive(true)
      playWin()
    }, chars.length * 420 + 350)
  }

  return (
    <GameShell title={t('game.blend')} emoji="🔊" onExit={onExit}>
      <Confetti active={alive} />

      <div className="spell-screen center-body">
        <button className={`spell-pic ${alive ? 'is-alive' : ''}`} onClick={() => { unlockAudio(); speakEn(item.word) }} aria-label={t('spell.hear')}>
          <span aria-hidden="true">{item.emoji}</span>
        </button>

        {/* tap each letter for its sound; on blend the letters slide together */}
        <div className={`spell-slots blend-word ${blending ? 'is-blending' : ''}`} dir="ltr">
          {item.word.split('').map((ch, i) => (
            <button key={i} className="blend-letter" onClick={() => tapLetter(ch)} aria-label={ch}>
              <LetterGuy ch={ch} className={blending ? '' : 'idle'} />
            </button>
          ))}
        </div>

        <p className="fl-q" aria-hidden="true">{alive ? '' : t('blend.hint')}</p>

        {alive ? (
          <button className="big-button" onClick={newWord}>
            🔄 {t('spell.next')}
          </button>
        ) : (
          <button className="big-button blend-go" onClick={blend}>
            🔗 {t('blend.go')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
