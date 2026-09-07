import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playGiggle, playRaspberry, playHonk, playLaugh, playTap, unlockAudio } from '../audio'
import { playClip, stopClip } from '../voice'
import { randFriendIndex, friendCount } from '../level'
import { randInt } from './util'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'

// "Make the friend laugh": tickle, pull faces, make silly sounds, spin him, or
// hear a recorded knock-knock joke (Assaf's favourite). After EVERY action the
// friend laughs out loud (recorded, in his voice). No timer, no win/lose.
const FACES = ['😝', '🤪', '😜', '😛', '🤓', '😬']
const JOKE_LINES = [5, 5, 9] // lines per joke — keep in sync with JOKES in scripts/gen-voice.mjs
// warm BAKED giggle motes that float up on every gag (real material sprites, not
// raw emoji): a gold sparkle, a soft coral heart, a muted musical note
const FX_SPRITES = ['burst-star', 'burst-heart', 'burst-note']
const ACTIONS = [
  { key: 'tickle', emoji: '🪶', anim: 'tickle', sound: playGiggle, face: false },
  { key: 'face', emoji: '😝', anim: 'face', sound: playHonk, face: true },
  { key: 'raspberry', emoji: '💨', anim: 'wiggle', sound: playRaspberry, face: false },
  { key: 'honk', emoji: '📯', anim: 'wiggle', sound: playHonk, face: false },
  { key: 'spin', emoji: '🌀', anim: 'spin', sound: playGiggle, face: false },
] as const

export default function LaughGame({ onExit, friend }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const [who, setWho] = useState(() => friend ?? randFriendIndex())
  const [act, setAct] = useState<{ kind: string; n: number } | null>(null)
  const [faceEmoji, setFaceEmoji] = useState<string | null>(null)
  const [fx, setFx] = useState<{ id: number; sprite: string; x: number; d: number }[]>([])
  const actN = useRef(0)
  const fxId = useRef(0)
  const timers = useRef<number[]>([])
  const jokeTimer = useRef<number | null>(null)

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(
    () => () => {
      stopClip()
      clearTimers()
      if (jokeTimer.current) window.clearTimeout(jokeTimer.current)
    },
    [],
  )

  function burst(count = 6) {
    const base = import.meta.env.BASE_URL
    const items = Array.from({ length: count }, () => ({
      id: fxId.current++,
      sprite: `${base}art/sprites/laugh/${FX_SPRITES[Math.floor(Math.random() * FX_SPRITES.length)]}.png`,
      x: 26 + Math.floor(Math.random() * 48),
      d: Math.random() * 0.22, // a little stagger so the motes don't rise in lockstep
    }))
    setFx((f) => [...f, ...items])
    const ids = new Set(items.map((i) => i.id))
    timers.current.push(window.setTimeout(() => setFx((f) => f.filter((x) => !ids.has(x.id))), 1500))
  }
  function trigger(kind: string) {
    actN.current += 1
    setAct({ kind, n: actN.current })
    timers.current.push(window.setTimeout(() => setAct(null), 1000))
  }
  function doGag(a: (typeof ACTIONS)[number]) {
    unlockAudio()
    stopClip()
    trigger(a.anim)
    if (a.face) {
      setFaceEmoji(FACES[randInt(0, FACES.length - 1)])
      timers.current.push(window.setTimeout(() => setFaceEmoji(null), 1100))
    }
    a.sound()
    burst(6)
    playLaugh() // the friend laughs out loud (real recorded laugh)
  }
  // tell a knock-knock joke LINE BY LINE, with a gap after each so it doesn't
  // rush (a longer beat after the "knock knock"); the friend laughs at the end
  function playJokeLine(j: number, n: number) {
    if (n >= JOKE_LINES[j]) {
      playLaugh()
      return
    }
    trigger('wiggle')
    playClip(`joke-${j}-${n}`, '', () => {
      jokeTimer.current = window.setTimeout(() => playJokeLine(j, n + 1), n === 0 ? 600 : 320)
    })
  }
  function tellJoke() {
    unlockAudio()
    stopClip()
    if (jokeTimer.current) window.clearTimeout(jokeTimer.current)
    burst(6)
    playJokeLine(randInt(0, JOKE_LINES.length - 1), 0)
  }
  function swap() {
    playTap()
    let n = randFriendIndex()
    if (friendCount() > 1) while (n === who) n = randFriendIndex()
    setWho(n)
  }

  const nat = FRIEND_NATURAL[friendKindForIndex(who)]
  const scale = Math.min((vp.h * 0.24) / nat.h, (vp.w * 0.5) / nat.w)

  return (
    <GameShell title={t('game.laugh')} emoji="😂" onExit={onExit}>
      <div className="laugh-screen center-body">
        {/* a cosy little comedy STAGE, all BAKED art: an illustrated theatre backdrop
            (velvet drapes, gold valance, warm spotlight, receding wood-plank floor),
            a baked wooden stool + retro mic prop on the floor, and a soft baked
            spotlight pool. The scene + props are CLIPPED to the rounded stage; the
            friend is a sibling OVER it so a big belly-laugh is never cut off. */}
        <div className="laugh-stage">
          <div className="laugh-scene" aria-hidden="true">
            <SceneBackdrop src="laugh-stage.jpg" position="center 60%" scrim="soft" />
            <span className="laugh-glow" />
            <span className="laugh-mic" />
            <span className="laugh-stool" />
            <span className="laugh-shadow" />
          </div>
          <button className="dance-swap" onClick={swap} aria-label={t('dance.swap')}>
            🔀
          </button>
          <button
            className={`laugh-friend ${act ? `laugh-${act.kind}` : ''}`}
            key={act?.n ?? 0}
            onClick={() => doGag(ACTIONS[0])}
            aria-label={t('laugh.tickle')}
          >
            <Friend index={who} scale={scale} lively />
          </button>
          {faceEmoji && (
            <span className="laugh-face-pop" key={`face-${actN.current}`} aria-hidden="true">
              {faceEmoji}
            </span>
          )}
          <div className="world-fx-layer" aria-hidden="true">
            {fx.map((f) => (
              <span
                key={f.id}
                className="laugh-fx"
                style={{ left: `${f.x}%`, backgroundImage: `url("${f.sprite}")`, animationDelay: `${f.d}s` }}
              />
            ))}
          </div>
        </div>

        <div className="laugh-buttons">
          {ACTIONS.map((a) => (
            <button key={a.key} className="laugh-btn" onClick={() => doGag(a)}>
              <span className="laugh-btn-emoji" aria-hidden="true">
                {a.emoji}
              </span>
              <span>{t(`laugh.${a.key}`)}</span>
            </button>
          ))}
          <button className="laugh-btn laugh-joke" onClick={tellJoke}>
            <span className="laugh-btn-emoji" aria-hidden="true">
              🎤
            </span>
            <span>{t('laugh.joke')}</span>
          </button>
        </div>
      </div>
    </GameShell>
  )
}
