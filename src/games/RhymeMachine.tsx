import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playSuccess, playWin, playTap, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { shuffle } from './util'
import { useT } from '../i18n'
import { LetterGuy } from './LetterGuy'

// "Rhyme Machine" (English) — a word-family / pattern toy. The ENDING stays the
// same (e.g. -AT) and the child swaps the FIRST letter to make a new rhyming word:
// CAT → HAT → BAT → RAT, and the picture morphs each time. Each word plays a
// recorded clip in one of our friend voices that names it in BOTH languages
// ("דוֹג באנגלית, כלב בעברית") — a different voice per family. Pure pattern play,
// no timer, no losing. A star ticks for each new word; finishing a family cheers.
//
// The word list here MUST stay in sync with the RHYME data in scripts/gen-voice.mjs
// (which records rhyme-<WORD>.mp3 with the Hebrew translation + a per-family voice).
type FamilyWord = { onset: string; word: string; emoji: string }
type Family = { rime: string; words: FamilyWord[] }
const FAMILIES: Family[] = [
  { rime: 'AT', words: [
    { onset: 'C', word: 'CAT', emoji: '🐱' }, { onset: 'H', word: 'HAT', emoji: '🎩' },
    { onset: 'B', word: 'BAT', emoji: '🦇' }, { onset: 'R', word: 'RAT', emoji: '🐀' },
  ] },
  { rime: 'OG', words: [
    { onset: 'D', word: 'DOG', emoji: '🐶' }, { onset: 'L', word: 'LOG', emoji: '🪵' },
    { onset: 'F', word: 'FOG', emoji: '🌫️' }, { onset: 'H', word: 'HOG', emoji: '🐗' },
  ] },
  { rime: 'UN', words: [
    { onset: 'S', word: 'SUN', emoji: '☀️' }, { onset: 'B', word: 'BUN', emoji: '🥐' },
    { onset: 'R', word: 'RUN', emoji: '🏃' },
  ] },
  { rime: 'EN', words: [
    { onset: 'H', word: 'HEN', emoji: '🐔' }, { onset: 'P', word: 'PEN', emoji: '🖊️' },
    { onset: 'T', word: 'TEN', emoji: '🔟' },
  ] },
  { rime: 'AP', words: [
    { onset: 'C', word: 'CAP', emoji: '🧢' }, { onset: 'M', word: 'MAP', emoji: '🗺️' },
    { onset: 'N', word: 'NAP', emoji: '😴' },
  ] },
  { rime: 'AN', words: [
    { onset: 'M', word: 'MAN', emoji: '👨' }, { onset: 'F', word: 'FAN', emoji: '🪭' },
    { onset: 'P', word: 'PAN', emoji: '🍳' }, { onset: 'V', word: 'VAN', emoji: '🚐' },
  ] },
  { rime: 'UG', words: [
    { onset: 'B', word: 'BUG', emoji: '🐛' }, { onset: 'M', word: 'MUG', emoji: '☕' },
    { onset: 'H', word: 'HUG', emoji: '🤗' },
  ] },
  { rime: 'ICE', words: [
    { onset: 'R', word: 'RICE', emoji: '🍚' }, { onset: 'D', word: 'DICE', emoji: '🎲' },
    { onset: 'M', word: 'MICE', emoji: '🐭' },
  ] },
  { rime: 'ING', words: [
    { onset: 'R', word: 'RING', emoji: '💍' }, { onset: 'K', word: 'KING', emoji: '🤴' },
    { onset: 'W', word: 'WING', emoji: '🪽' },
  ] },
  { rime: 'OAT', words: [
    { onset: 'B', word: 'BOAT', emoji: '⛵' }, { onset: 'C', word: 'COAT', emoji: '🧥' },
    { onset: 'G', word: 'GOAT', emoji: '🐐' },
  ] },
  { rime: 'OX', words: [
    { onset: 'F', word: 'FOX', emoji: '🦊' }, { onset: 'B', word: 'BOX', emoji: '📦' },
  ] },
  { rime: 'AR', words: [
    { onset: 'C', word: 'CAR', emoji: '🚗' }, { onset: 'J', word: 'JAR', emoji: '🫙' },
  ] },
  { rime: 'AKE', words: [
    { onset: 'C', word: 'CAKE', emoji: '🍰' }, { onset: 'L', word: 'LAKE', emoji: '🏞️' },
  ] },
  { rime: 'OW', words: [
    { onset: 'C', word: 'COW', emoji: '🐄' }, { onset: 'B', word: 'BOW', emoji: '🎀' },
  ] },
  { rime: 'ALL', words: [
    { onset: 'B', word: 'BALL', emoji: '🏀' }, { onset: 'W', word: 'WALL', emoji: '🧱' },
  ] },
]

export default function RhymeMachine({ onExit }: GameProps) {
  const { t } = useT()
  const [famIdx, setFamIdx] = useState(() => Math.floor(Math.random() * FAMILIES.length))
  const fam = FAMILIES[famIdx]
  const [options, setOptions] = useState<FamilyWord[]>(() => shuffle(fam.words))
  const [onset, setOnset] = useState(() => fam.words[0].onset)
  const [found, setFound] = useState<Set<string>>(() => new Set([fam.words[0].onset]))
  const [party, setParty] = useState(false)
  const timers = useRef<number[]>([])

  const cur = fam.words.find((w) => w.onset === onset) ?? fam.words[0]
  const complete = found.size === fam.words.length
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  // play the recorded clip that names the word in both languages, in this family's
  // friend voice ("דוֹג באנגלית, כלב בעברית"). Falls back to the word if missing.
  const say = (word: string) => playClip(`rhyme-${word}`, word)

  // say the current word whenever it changes (start of family + each swap)
  useEffect(() => {
    const id = window.setTimeout(() => say(cur.word), 300)
    timers.current.push(id)
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [famIdx, onset])

  function newFamily() {
    clear()
    playTap()
    const next = FAMILIES.length <= 1 ? famIdx : (famIdx + 1 + Math.floor(Math.random() * (FAMILIES.length - 1))) % FAMILIES.length
    setFamIdx(next)
    setOptions(shuffle(FAMILIES[next].words))
    setOnset(FAMILIES[next].words[0].onset)
    setFound(new Set([FAMILIES[next].words[0].onset]))
    setParty(false)
  }

  function choose(w: FamilyWord) {
    if (w.onset === onset) {
      say(w.word) // re-hear the same word
      return
    }
    unlockAudio()
    setOnset(w.onset)
    playSuccess()
    setFound((f) => {
      if (f.has(w.onset)) return f
      const nf = new Set(f).add(w.onset)
      if (nf.size === fam.words.length) {
        setParty(true)
        later(() => setParty(false), 2400)
        later(() => playWin(), 250)
      }
      return nf
    })
  }

  return (
    <GameShell title={t('game.rhyme')} emoji="🎡" onExit={onExit}>
      <Confetti active={party} />
      <div className="memory-controls">
        <span className="qty-score" dir="ltr" aria-label={t('rm.found', { n: found.size, total: fam.words.length })}>
          ⭐ {found.size} / {fam.words.length}
        </span>
        <button className="pill" onClick={newFamily}>
          🎡 {t('rm.newfam')}
        </button>
      </div>

      <div className="spell-screen center-body">
        <button className="spell-pic" onClick={() => { unlockAudio(); say(cur.word) }} aria-label={t('spell.hear')}>
          {/* key on the word so it remounts with a little morph each swap */}
          <span key={cur.word} className="rm-pic" aria-hidden="true">{cur.emoji}</span>
        </button>

        {/* the word: a changeable onset guy + the fixed family ending */}
        <div className="spell-slots rm-word" dir="ltr">
          <span className="rm-cell is-onset" key={onset}>
            <LetterGuy ch={cur.onset} />
          </span>
          {fam.rime.split('').map((ch, i) => (
            <span className="rm-cell" key={i}>
              <LetterGuy ch={ch} />
            </span>
          ))}
        </div>

        <p className="fl-q" aria-hidden="true">{t('rm.q')}</p>

        {/* pick the first letter — each makes a rhyming word */}
        <div className="spell-tray ll-tray" dir="ltr">
          {options.map((w) => (
            <button
              key={w.onset}
              className={`ll-tile ${w.onset === onset ? 'is-picked' : ''} ${found.has(w.onset) ? 'is-found' : ''}`}
              onClick={() => choose(w)}
              aria-label={w.word}
            >
              <LetterGuy ch={w.onset} className="idle" />
            </button>
          ))}
        </div>

        {complete && (
          <button className="big-button" onClick={newFamily}>
            🎡 {t('rm.newfam')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
