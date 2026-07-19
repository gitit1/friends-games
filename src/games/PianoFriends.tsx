import { useState } from 'react'
import GameShell from '../components/GameShell'
import { friendCount } from '../level'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playNudge, playPiano, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendColor } from '../friends'
import { numberWordNiqqud, randInt, shuffle } from './util'
import { screenScale, useViewport } from '../useViewport'
import Confetti from '../components/Confetti'
import { SONGS as TUNES, songEmoji } from '../music/songs'
import { useT } from '../i18n'

// "Friends piano" — Guitar-Hero / Just-Dance style but SELF-PACED (no timer):
// the next note of a known kids' tune falls down its lane as a number, its key
// glows, and the child taps it to play. Tapping through plays the whole melody.
// A free-play mode lets them just make music. No losing. The friends on the
// keys are drawn at random from the whole roster (fresh each play).
const LANES = 6 // 6 lanes = Do Re Mi Fa Sol La (the pitch is fixed per lane)
// decorative ebony keys sit at the true black-key boundaries of Do·Re·Mi·Fa·Sol·La
// (between Do–Re, Re–Mi, Fa–Sol, Sol–La — none at Mi–Fa). Non-interactive baked
// material so the keyboard reads as a REAL piano; each value is the boundary /6.
const BLACK_KEYS = [1, 2, 4, 5]

function pickBand(): number[] {
  return shuffle(Array.from({ length: friendCount() }, (_, i) => i)).slice(0, LANES)
}

// the 6 keys are Do Re Mi Fa Sol La — fold any semitone onto its nearest of these
const DEG = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 5]
type Song = { id: string; label: string; emoji: string; notes: number[] } // notes = scale degrees 0..5
// ONE shared song list for every game (src/music/songs.ts). Each tune's real
// melody is folded onto the 6 keys here so the child can tap it through.
const SONGS: Song[] = TUNES.map((s) => ({
  id: s.id,
  label: s.label,
  emoji: songEmoji(s.id),
  notes: s.notes.map(([semi]) => DEG[((semi % 12) + 12) % 12]),
}))

export default function PianoFriends({ onExit }: GameProps) {
  const { t } = useT()
  const [songIdx, setSongIdx] = useState(() => randInt(0, SONGS.length - 1))
  const [free, setFree] = useState(false)
  const [pos, setPos] = useState(0)
  const [pressed, setPressed] = useState<number | null>(null)
  const [nod, setNod] = useState<number | null>(null) // key whose friend just nodded on a correct hit
  const [wrong, setWrong] = useState<number | null>(null)
  const [band, setBand] = useState<number[]>(pickBand) // which friends sit on the keys
  const [picker, setPicker] = useState(false) // song-list pop-up

  const vp = useViewport()
  const keyPx = 48 * screenScale(vp.w) // bigger, brighter friend on each key
  const song = SONGS[songIdx]
  const done = !free && pos >= song.notes.length
  const current = !free && !done ? song.notes[pos] : null

  function bounce(i: number) {
    setPressed(i)
    window.setTimeout(() => setPressed((p) => (p === i ? null : p)), 350)
  }
  // the friend on a correctly-hit key gives a little nod (GDD signature move #2)
  function nudgeNod(i: number) {
    setNod(i)
    window.setTimeout(() => setNod((n) => (n === i ? null : n)), 600)
  }

  function chooseSong(i: number) {
    unlockAudio()
    setFree(false)
    setSongIdx(i)
    setPos(0)
    setWrong(null)
    setBand(pickBand())
    setPicker(false)
  }
  function chooseFree() {
    unlockAudio()
    setFree(true)
    setWrong(null)
    setBand(pickBand())
    setPicker(false)
  }
  function restart() {
    setPos(0)
    setWrong(null)
    setBand(pickBand())
  }
  function newRound() {
    unlockAudio()
    setFree(false)
    setSongIdx(randInt(0, SONGS.length - 1))
    setPos(0)
    setWrong(null)
    setBand(pickBand())
  }

  function tap(i: number) {
    unlockAudio()
    if (free) {
      playPiano(i)
      bounce(i)
      return
    }
    if (done) return
    if (i === current) {
      playPiano(i)
      bounce(i)
      nudgeNod(i)
      const np = pos + 1
      setPos(np)
      if (np >= song.notes.length) window.setTimeout(() => { playWin(); speak('כל הכבוד!') }, 350)
    } else {
      setWrong(i)
      playNudge()
      if (current != null) speak(numberWordNiqqud(band[current] + 1)) // point to the right key
      window.setTimeout(() => setWrong(null), 350)
    }
  }

  return (
    <GameShell title={t('game.piano')} emoji="🎹" onExit={onExit}>
      <Confetti active={done} />
      <div className="gh-top">
        <button className="pill gh-choose" onClick={() => { unlockAudio(); setPicker(true) }}>
          🎵 {free ? t('piano.free') : `${song.emoji} ${song.label}`} ▾
        </button>
        <button className="pill" onClick={newRound}>
          🔄 {t('pop.new')}
        </button>
      </div>

      {!free && !done && <p className="gh-hint" aria-hidden="true">{t('piano.hintSong')}</p>}
      {free && <p className="gh-hint" aria-hidden="true">{t('piano.hintFree')}</p>}

      {/* the concert-hall STAGE: a warm evening scene (velvet curtain backdrop,
          one soft spotlight upper-inline-start, a receding wood stage). The
          falling-note lane and the keys live INSIDE it as one grounded set, so
          the note that drops in a lane lands right on the friend-key below it.
          A piano is laid out left→right (low→high) in both languages (dir=ltr),
          so the falling note (positioned by --lane) lines up with its key. */}
      <div className="piano-stage">
        <span className="piano-curtain" aria-hidden="true" />
        <span className="piano-spot" aria-hidden="true" />
        <span className="piano-floor" aria-hidden="true" />

        <div className="gh-board" dir="ltr" style={{ '--lanes': LANES } as React.CSSProperties}>
          {current != null && (
            <>
              {/* the connecting beam — a soft coloured column marking the target
                  lane the note is falling into, pointing straight at its key */}
              <span
                className="gh-lane-beam"
                key={`beam-${pos}`}
                style={{ '--lane': current, '--c': friendColor(band[current]) } as React.CSSProperties}
                aria-hidden="true"
              />
              <span
                className="gh-note"
                key={pos}
                style={{ '--lane': current, '--c': friendColor(band[current]) } as React.CSSProperties}
              >
                <span className="gh-tile">{band[current] + 1}</span>
              </span>
            </>
          )}
          {done && <span className="gh-board-done" aria-hidden="true">🎉</span>}
        </div>

        <div className="gh-keys" dir="ltr">
          {/* the wooden instrument fascia rail (baked material) the keys tuck under */}
          <span className="piano-fascia" aria-hidden="true" />
          {/* raised ebony keys in the gaps — pure baked material, non-interactive */}
          {BLACK_KEYS.map((b) => (
            <span
              key={`bk-${b}`}
              className="piano-black-key"
              style={{ left: `calc(${b} / ${LANES} * 100%)` }}
              aria-hidden="true"
            />
          ))}
          {Array.from({ length: LANES }).map((_, i) => (
            <button
              key={i}
              className={`gh-key ${current === i ? 'is-active' : ''} ${wrong === i ? 'is-wrong' : ''} ${pressed === i ? 'is-hit' : ''}`}
              onClick={() => tap(i)}
              aria-label={t('piano.keyAria', { n: i + 1 })}
            >
              {/* on the target key: the number to hit, so the falling note connects
                  visually to a key the child can name (fixes the orphaned float) */}
              {current === i && (
                <span className="gh-key-num" style={{ '--c': friendColor(band[i]) } as React.CSSProperties} aria-hidden="true">
                  {band[i] + 1}
                </span>
              )}
              <Friend
                index={band[i]}
                scale={keyPx / friendMaxDim(band[i])}
                showNumber={false}
                bouncing={pressed === i && nod !== i}
                nodding={nod === i}
              />
            </button>
          ))}
        </div>
      </div>

      {!free && (
        <div className="gh-foot">
          {done ? (
            <button className="big-button" onClick={restart}>
              🔁 {t('seq.again')}
            </button>
          ) : (
            // dir="ltr" (an LTR isolate) so it reads "♪ 0 / 26" in RTL too
            <span className="gh-progress score-pill" dir="ltr" aria-hidden="true">
              ♪ {pos} / {song.notes.length}
            </span>
          )}
        </div>
      )}

      {picker && (
        <div className="song-overlay" onClick={() => setPicker(false)}>
          <div className="song-card" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close" onClick={() => setPicker(false)} aria-label={t('seq.close')}>
              ✕
            </button>
            <h3 className="song-title">{t('piano.pick')}</h3>
            <div className="song-list">
              {SONGS.map((s, i) => (
                <button key={s.id} className="song-item" onClick={() => chooseSong(i)}>
                  <span className="song-item-emoji" aria-hidden="true">
                    {s.emoji}
                  </span>
                  <span className="song-item-name">{s.label}</span>
                </button>
              ))}
              <button className="song-item" onClick={chooseFree}>
                <span className="song-item-emoji" aria-hidden="true">
                  🎶
                </span>
                <span className="song-item-name">{t('piano.free')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </GameShell>
  )
}
