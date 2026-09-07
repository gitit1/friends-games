import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import IconButton from '../components/IconButton'
import SceneBackdrop from '../components/SceneBackdrop'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playMelody, stopMelody, playMove, playTap, unlockAudio } from '../audio'
import { SONGS } from '../music/songs'
import { randFriendIndex, friendCount } from '../level'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'

// "Dance floor": pick a (public-domain) children's tune from the song pager, then
// tap moves to make the friend dance. A universal RECORD button captures the
// taps into a little dance you can PLAY back; a trash button clears it. The
// child can also swap to another friend. No timer, no winning or losing.
// Spatial order (not reading order): שמאלה/Left stays physically on the LEFT
// and ימינה/Right on the RIGHT in both languages, with the non-directional
// moves between them — the row is rendered dir="ltr" always (see dance-moves
// below), so this array order IS the on-screen left-to-right order.
const MOVES = [
  { key: 'left', emoji: '⬅️' },
  { key: 'spin', emoji: '🌀' },
  { key: 'jump', emoji: '⬆️' },
  { key: 'wiggle', emoji: '🪩' },
  { key: 'right', emoji: '➡️' },
]

export default function DanceGame({ onExit, friend }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  // dance the friend we came from (e.g. Toki), else a random one
  const [dancer, setDancer] = useState(() => friend ?? randFriendIndex())
  const [songIdx, setSongIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [move, setMove] = useState<{ key: string; n: number } | null>(null)
  const [recording, setRecording] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null) // 3·2·1 before recording
  const [recCount, setRecCount] = useState(0)
  const rec = useRef<{ i: number; t: number }[]>([])
  const startT = useRef(0)
  const moveN = useRef(0)
  const timers = useRef<number[]>([])
  const recTimer = useRef<number | null>(null) // the 30s recording cap

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    if (recTimer.current) {
      window.clearTimeout(recTimer.current)
      recTimer.current = null
    }
  }
  const SONG_MAX = 30000 // a dance recording is at most 30 seconds
  useEffect(
    () => () => {
      stopMelody()
      clearTimers()
    },
    [],
  )

  const song = SONGS[songIdx]
  function gotoSong(d: number) {
    playTap()
    const next = (songIdx + d + SONGS.length) % SONGS.length
    setSongIdx(next)
    // while recording the song loops as backing; a preview just plays once
    if (recording) playMelody(SONGS[next].id, { loop: true })
    else if (playing) playMelody(SONGS[next].id, { loop: false, onEnd: () => setPlaying(false) })
  }
  // preview the song ONCE (not a loop)
  function togglePlaySong() {
    unlockAudio()
    playTap()
    if (playing) {
      stopMelody()
      setPlaying(false)
    } else {
      setPlaying(true)
      playMelody(song.id, { loop: false, onEnd: () => setPlaying(false) })
    }
  }

  // animate + sound one move; record it while the record button is on
  function doMove(i: number, fromTap: boolean) {
    unlockAudio()
    moveN.current += 1
    setMove({ key: MOVES[i].key, n: moveN.current })
    playMove(i)
    if (fromTap && recording) {
      rec.current.push({ i, t: Date.now() - startT.current })
      setRecCount(rec.current.length)
    }
  }

  // ⏺️ record / ⏹️ stop
  function toggleRecord() {
    unlockAudio()
    playTap()
    if (recording) {
      stopRecording()
      return
    }
    if (countdown !== null) {
      // cancel the countdown
      clearTimers()
      setCountdown(null)
      return
    }
    startCountdown()
  }

  // 3 · 2 · 1 on screen so the child can get ready, then start recording
  function startCountdown() {
    clearTimers()
    setReplaying(false)
    setCountdown(3)
    playMove(0)
    timers.current.push(
      window.setTimeout(() => {
        setCountdown(2)
        playMove(1)
      }, 700),
    )
    timers.current.push(
      window.setTimeout(() => {
        setCountdown(1)
        playMove(2)
      }, 1400),
    )
    timers.current.push(
      window.setTimeout(() => {
        setCountdown(null)
        beginRecording()
      }, 2100),
    )
  }

  function stopRecording() {
    if (recTimer.current) {
      window.clearTimeout(recTimer.current)
      recTimer.current = null
    }
    stopMelody()
    setRecording(false)
    setPlaying(false)
  }
  function beginRecording() {
    rec.current = []
    setRecCount(0)
    startT.current = Date.now()
    setRecording(true)
    setPlaying(true)
    // record WITH the chosen song; it plays once, and recording stops at the
    // song's end OR after 30s (whichever comes first)
    playMelody(song.id, { loop: false, onEnd: stopRecording })
    recTimer.current = window.setTimeout(stopRecording, SONG_MAX)
  }

  // ▶️ play / ⏸️ stop the replay
  function togglePlayback() {
    if (replaying) {
      clearTimers()
      stopMelody()
      setReplaying(false)
      return
    }
    if (!rec.current.length || recording) return
    unlockAudio()
    playTap()
    clearTimers()
    setReplaying(true)
    playMelody(song.id, { loop: false }) // replay the dance WITH its music
    const moves = rec.current
    moves.forEach((m) => timers.current.push(window.setTimeout(() => doMove(m.i, false), m.t)))
    const last = moves[moves.length - 1]?.t ?? 0
    timers.current.push(
      window.setTimeout(() => {
        setReplaying(false)
        stopMelody()
      }, last + 900),
    )
  }

  // 🗑️ clear the recorded dance
  function deleteDance() {
    if (recording || replaying) return
    playTap()
    clearTimers()
    rec.current = []
    setRecCount(0)
  }

  function swapDancer() {
    playTap()
    let n = randFriendIndex()
    if (friendCount() > 1) while (n === dancer) n = randFriendIndex()
    setDancer(n)
  }

  const nat = FRIEND_NATURAL[friendKindForIndex(dancer)]
  const scale = Math.min((vp.h * 0.22) / nat.h, (vp.w * 0.5) / nat.w)

  return (
    <GameShell title={t('game.dance')} emoji="💃" onExit={onExit}>
      <div className="dance-screen">
        {/* song pager (LTR so ◀ prev sits left, ▶ next right) */}
        <div className="dance-songs" dir="ltr">
          <IconButton icon="◀" label={t('nav.prev')} onClick={() => gotoSong(-1)} />
          <button className={`dance-song ${playing ? 'is-playing' : ''}`} onClick={togglePlaySong}>
            <span aria-hidden="true">{playing ? '⏸️' : '🎵'}</span> {song.label}
          </button>
          <IconButton icon="▶" label={t('nav.next')} onClick={() => gotoSong(1)} />
        </div>

        {/* the dance floor — a grounded evening STAGE, all baked art (real, not
            CSS): an illustrated stage-room backdrop (muted wall + soft blurred
            stage lights + a receding WOODEN dance floor with a warm centre spot),
            two baked walnut SPEAKERS grounded on the floor, and a faceted DISCO
            BALL hanging above. The scene layers are CLIPPED to the rounded stage;
            the dancer is a sibling OVER it (feet on the floor, a contact shadow),
            free to jump/lean without its arms or ears being cut off. */}
        <div className="dance-floor">
          <div className="dance-scene" aria-hidden="true">
            <SceneBackdrop src="dance-stage.jpg" position="center bottom" scrim="none" />
            <span className="dance-speaker dance-speaker-start" />
            <span className="dance-speaker dance-speaker-end" />
            <span className="dance-ball" />
          </div>
          <span className="dance-shadow" aria-hidden="true" />
          <button className="dance-swap" onClick={swapDancer} aria-label={t('dance.swap')}>
            🔀
          </button>
          <div className={`dancer ${move ? `dance-${move.key}` : ''}`} key={move?.n ?? 0}>
            <Friend index={dancer} scale={scale} lively bouncing={playing} showNumber={false} />
          </div>
          {countdown !== null && (
            <div className="dance-count" key={countdown} aria-hidden="true">
              {countdown}
            </div>
          )}
        </div>

        {/* moves — LTR so שמאלה is physically on the left and ימינה on the right;
            nowrap so they always stay in one row, shrinking to fit the screen */}
        <div className="dance-moves" dir="ltr">
          {MOVES.map((m, i) => (
            <button
              key={m.key}
              className="dance-move-btn"
              onClick={() => doMove(i, true)}
              disabled={replaying || countdown !== null}
            >
              <span className="dance-move-emoji" aria-hidden="true">
                {m.emoji}
              </span>
              <span className="dance-move-label">{t(`dance.${m.key}`)}</span>
            </button>
          ))}
        </div>

        {/* universal media controls — each icon now carries a small text label
            so the record/play/clear row is legible to a pre-reader's grown-up */}
        <div className="dance-controls">
          <button
            className={`dance-ctrl dance-rec ${recording ? 'is-on' : ''}`}
            onClick={toggleRecord}
            disabled={replaying}
            aria-label={t(recording ? 'dance.stop' : 'dance.record')}
          >
            <span className="dance-ctrl-ic" aria-hidden="true">{recording ? '⏹️' : '⏺️'}</span>
            <span className="dance-ctrl-label">{t(recording ? 'dance.stop' : 'dance.record')}</span>
          </button>
          <button
            className="dance-ctrl"
            onClick={togglePlayback}
            disabled={recording || countdown !== null || (!recCount && !replaying)}
            aria-label={t(replaying ? 'dance.pause' : 'dance.play')}
          >
            <span className="dance-ctrl-ic" aria-hidden="true">{replaying ? '⏸️' : '▶️'}</span>
            <span className="dance-ctrl-label">{t(replaying ? 'dance.pause' : 'dance.play')}</span>
          </button>
          <button
            className="dance-ctrl"
            onClick={deleteDance}
            disabled={recording || replaying || countdown !== null || !recCount}
            aria-label={t('dance.delete')}
          >
            <span className="dance-ctrl-ic" aria-hidden="true">🗑️</span>
            <span className="dance-ctrl-label">{t('dance.delete')}</span>
          </button>
        </div>
      </div>
    </GameShell>
  )
}
