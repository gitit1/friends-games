import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playSuccess, playNudge, playWin, playTap, unlockAudio } from '../audio'
import { speakEn } from '../speech'
import { shuffle } from './util'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import { useT } from '../i18n'
import { POOLS, LEVEL_TIERS, pickWord } from './englishWords'
import { LetterGuy } from './LetterGuy'

// "Spell the word" (English, Alphablocks-style) — a picture appears and the child
// builds its English word by tapping the letter CHARACTERS (a coloured body with
// googly eyes) into the slots, left-to-right. When the word is whole the row of
// letter-guys hops in sequence and the picture springs to life (big bounce +
// sparkles + the word spoken) — a sibling to our number-friends. No timer, no
// losing: a wrong letter wobbles and isn't placed; the right next one snaps in and
// says its name; tapping the waiting slot hints its letter. Shared cumulative word
// pools (englishWords.ts); אלוף draws from everything.
type Tile = { id: number; ch: string; used: boolean }
function makeTiles(word: string): Tile[] {
  const chars = word.split('')
  let order = shuffle(chars.map((_, i) => i))
  if (chars.length > 1) {
    let guard = 0
    while (order.every((pos, i) => chars[pos] === chars[i]) && guard++ < 8) order = shuffle(order)
  }
  return order.map((pos, id) => ({ id, ch: chars[pos], used: false }))
}

export default function SpellWord({ onExit }: GameProps) {
  const { t } = useT()
  const [lvl, setLvl] = useState(() => levelForTier(LEVEL_TIERS, getSettings().difficulty))
  const [idx, setIdx] = useState(() => pickWord(lvl))
  const item = POOLS[lvl][idx]
  const [placed, setPlaced] = useState<string[]>([])
  const [tiles, setTiles] = useState<Tile[]>(() => makeTiles(item.word))
  const [wrong, setWrong] = useState<number | null>(null)
  const [alive, setAlive] = useState(false) // finale: the word has come to life
  const timers = useRef<number[]>([])

  const done = placed.length === item.word.length
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  // say the word at the start of each round so a non-reader knows what to build
  useEffect(() => {
    const id = window.setTimeout(() => speakEn(item.word), 350)
    timers.current.push(id)
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lvl, idx])

  function load(nextLvl: number, nextIdx: number) {
    clear()
    playTap()
    setLvl(nextLvl)
    setIdx(nextIdx)
    setPlaced([])
    setTiles(makeTiles(POOLS[nextLvl][nextIdx].word))
    setWrong(null)
    setAlive(false)
  }
  function newWord() {
    const n = POOLS[lvl].length
    load(lvl, n <= 1 ? idx : (idx + 1 + Math.floor(Math.random() * (n - 1))) % n)
  }
  function chooseLevel(nextLvl: number) {
    load(nextLvl, pickWord(nextLvl))
  }
  function sayWord() {
    unlockAudio()
    speakEn(item.word)
  }
  // tap a slot for a hint: the waiting (empty) slot says the letter it needs; a
  // filled slot re-says its letter.
  function tapSlot(i: number) {
    unlockAudio()
    if (i < placed.length) speakEn(placed[i])
    else if (!done) speakEn(item.word[placed.length])
  }

  function tapTile(tile: Tile) {
    if (done || tile.used) return
    unlockAudio()
    if (tile.ch === item.word[placed.length]) {
      setTiles((ts) => ts.map((x) => (x.id === tile.id ? { ...x, used: true } : x)))
      const next = [...placed, tile.ch]
      setPlaced(next)
      playSuccess()
      speakEn(tile.ch)
      if (next.length === item.word.length) {
        // finale: the letters merge and the picture comes to life
        later(() => {
          setAlive(true)
          playWin()
          speakEn(item.word)
        }, 650)
      }
    } else {
      setWrong(tile.id)
      playNudge()
      later(() => setWrong(null), 450)
    }
  }

  return (
    <GameShell title={t('game.spell')} emoji="🔠" onExit={onExit}>
      <Confetti active={alive} />
      <div className="memory-controls">
        {LEVEL_TIERS.map((_, i) => (
          <button key={i} className={`pill ${i === lvl ? 'pill-active' : ''}`} onClick={() => chooseLevel(i)}>
            {t(`diff.${i}`)}
          </button>
        ))}
      </div>

      <div className="spell-screen center-body">
        <button className={`spell-pic ${alive ? 'is-alive' : ''}`} onClick={sayWord} aria-label={t('spell.hear')}>
          <span aria-hidden="true">{item.emoji}</span>
        </button>

        {/* the word builds left-to-right (English is LTR); when whole, the row of
            letter-guys hops. Tapping the waiting slot hints its letter. */}
        <div className={`spell-slots ll-slots ${done ? 'is-merged' : ''}`} dir="ltr">
          {item.word.split('').map((_, i) => (
            <button
              key={i}
              className={`spell-slot ll-slot ${placed[i] ? 'is-filled' : ''} ${i === placed.length && !done ? 'is-next' : ''}`}
              onClick={() => tapSlot(i)}
              style={{ '--n': i } as React.CSSProperties}
              aria-label={placed[i] ?? t('spell.hear')}
            >
              {placed[i] ? <LetterGuy ch={placed[i]} /> : ''}
            </button>
          ))}
        </div>

        {done ? (
          <div className="spell-foot">
            <button className="pill spell-say" onClick={sayWord} aria-label={t('spell.hear')}>
              🔊
            </button>
            <button className="big-button" onClick={newWord}>
              🔄 {t('spell.next')}
            </button>
          </div>
        ) : (
          <>
            <div className="spell-tray ll-tray" dir="ltr">
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  className={`ll-tile ${tile.used ? 'is-used' : ''} ${wrong === tile.id ? 'is-wrong' : ''}`}
                  onClick={() => tapTile(tile)}
                  disabled={tile.used}
                  aria-label={tile.ch}
                >
                  <LetterGuy ch={tile.ch} className="idle" />
                </button>
              ))}
            </div>
            <button className="pill spell-say" onClick={sayWord}>
              🔊 {t('spell.hear')}
            </button>
          </>
        )}
      </div>
    </GameShell>
  )
}
