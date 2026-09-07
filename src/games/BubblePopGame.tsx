import { memo, useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPlop, unlockAudio } from '../audio'
import { friendCount, randFriendIndex } from '../level'
import { useT } from '../i18n'

const COLORS = ['#ffd466', '#86f5c4', '#7cc4f5', '#ff9fb0', '#c9a7ff', '#ffb37c']

// Baked soap-bubble sprites (public/art/sprites/bubbles/ — see LICENSES.md): a
// translucent body, an iridescent thin-film rim, a Fresnel edge glow and specular
// highlights. Four muted films; a bubble picks one at spawn so the drift shows a
// gentle mix. These read as REAL soap bubbles — a flat CSS radial-gradient did not.
const BUBBLE_ART = [1, 2, 3, 4].map((n) => `${import.meta.env.BASE_URL}art/sprites/bubbles/bubble-${n}.png`)

// keep every bubble fully inside the rounded playfield (px inset from each side)
const EDGE = 10
const DOUBLE_CHANCE = 0.16 // occasional "double bubble" — two friends inside

type Bubble = {
  id: number
  pos: number // 0–1 across the playfield (mapped to a clamped left, see style below)
  size: number // px
  depth: number // 0 = near (big, bright, faster) … 1 = far (small, faint, slower) — a gentle sense of space
  duration: number // seconds to rise
  delay: number // negative = starts already partway up (the opening bubbles)
  sway: number // px of horizontal sway amplitude
  swayDur: number // seconds per sway cycle
  swayDelay: number // desync the sway between bubbles
  color: string
  variant: number // which baked soap-bubble film (0..3)
  friends: number[] // one friend — or two, in a "double bubble"
}

// a short-lived burst left behind when a bubble pops: a ripple ring, a few
// droplets, and the freed friend(s) waving as they fade.
type Pop = { id: number; x: number; y: number; size: number; color: string; friends: number[] }

let nextBubbleId = 0
let nextPopId = 0

function makeBubble(pos: number, delay = 0): Bubble {
  // depth gives the drift a gentle sense of space: near bubbles are bigger,
  // brighter and rise a touch faster; far ones are smaller, fainter and drift up
  // slower (parallax) with less sway. Purely presentational — no per-frame JS.
  const depth = Math.random()
  const size = Math.round(74 + (1 - depth) * 52 + Math.random() * 10) // ~74 (far) … ~136 (near)
  const friends = [randFriendIndex()]
  if (Math.random() < DOUBLE_CHANCE && friendCount() > 1) {
    let f2 = randFriendIndex()
    if (f2 === friends[0]) f2 = (f2 + 1) % friendCount()
    friends.push(f2)
  }
  return {
    id: nextBubbleId++,
    pos: Math.min(1, Math.max(0, pos)),
    size,
    depth,
    duration: 5.4 + depth * 3.6 + Math.random() * 1.2, // far bubbles rise slower
    delay,
    sway: (7 + Math.random() * 9) * (1 - depth * 0.45), // far bubbles sway less
    swayDur: 3.4 + Math.random() * 2,
    swayDelay: -Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    variant: Math.floor(Math.random() * BUBBLE_ART.length),
    friends,
  }
}

// One drifting bubble. Memoized (with stable onPop/onExpire callbacks from the
// parent) so spawning a NEW bubble every 850ms — or popping one — never re-renders
// the friends inside every OTHER bubble. Bubble objects keep their identity across
// renders, so React skips every untouched bubble.
const BubbleItem = memo(function BubbleItem({
  bubble,
  onPop,
  onExpire,
}: {
  bubble: Bubble
  onPop: (bubble: Bubble, rect: DOMRect) => void
  onExpire: (id: number) => void
}) {
  return (
    <button
      className={`bubble ${bubble.friends.length > 1 ? 'is-double' : ''}`}
      style={{
        left: `calc(${EDGE}px + ${bubble.pos} * (100% - ${Math.round(bubble.size) + EDGE * 2}px))`,
        width: `${bubble.size}px`,
        height: `${bubble.size}px`,
        // the baked soap-bubble sprite is a STATIC background (only transform/
        // translate animate), so it composites on the GPU layer — perf-safe.
        backgroundImage: `url(${BUBBLE_ART[bubble.variant]})`,
        opacity: 0.74 + (1 - bubble.depth) * 0.26, // far bubbles a touch fainter
        zIndex: Math.round((1 - bubble.depth) * 20), // near bubbles float over far ones
        animationDuration: `${bubble.duration}s, ${bubble.swayDur}s`,
        animationDelay: `${bubble.delay}s, ${bubble.swayDelay}s`,
        '--sway': `${bubble.sway}px`,
      } as React.CSSProperties}
      onAnimationEnd={(ev) => {
        if (ev.animationName === 'rise') onExpire(bubble.id)
      }}
      onClick={(e) => onPop(bubble, e.currentTarget.getBoundingClientRect())}
      aria-label="בועה"
    >
      {bubble.friends.map((f, i) => (
        <span className="bubble-friend" key={i}>
          {/* Compact colour-blob while drifting: a fresh bubble spawns every 850ms,
              and mounting full anatomy each time was the freeze. The full, waving
              friend is revealed at the pop (the reward) below. */}
          <Friend
            index={f}
            scale={
              (bubble.size * (bubble.friends.length > 1 ? 0.4 : 0.54)) / FRIEND_NATURAL[friendKindForIndex(f)].h
            }
            showNumber={false}
            compact
          />
        </span>
      ))}
    </button>
  )
})

// A calm, no-fail sensory game: friendly bubbles drift up with a gentle sway, tap
// to pop them into a soft ripple and a waving friend.
export default function BubblePopGame({ onExit }: GameProps) {
  const { t } = useT()
  // the screen never starts empty: 3 bubbles near the centre, already mid-rise
  // (a negative animation delay puts each one partway up the playfield)
  const [bubbles, setBubbles] = useState<Bubble[]>(() =>
    [0.38, 0.52, 0.64].map((pos, i) => makeBubble(pos + (Math.random() - 0.5) * 0.08, -(2.4 - i * 0.8))),
  )
  const [pops, setPops] = useState<Pop[]>([])
  const [popped, setPopped] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const spawn = window.setInterval(() => {
      setBubbles((current) => {
        // Keep the screen from ever feeling crowded/overwhelming.
        if (current.length >= 8) return current
        return [...current, makeBubble(Math.random())]
      })
    }, 850)
    return () => window.clearInterval(spawn)
  }, [])

  // Stable across renders so memoized bubbles never re-render when a sibling
  // spawns or pops.
  const onExpire = useCallback((id: number) => {
    setBubbles((current) => current.filter((b) => b.id !== id))
  }, [])

  const onPop = useCallback((bubble: Bubble, rect: DOMRect) => {
    unlockAudio()
    // bigger bubbles get a lower, rounder plop; small ones a higher one
    const pitch = 1.14 - ((bubble.size - 78) / 56) * 0.32
    playPlop(pitch)
    setPopped((p) => p + 1)

    // leave a pop burst where the bubble actually is on screen right now
    const stage = stageRef.current
    if (stage) {
      const sr = stage.getBoundingClientRect()
      const fx: Pop = {
        id: nextPopId++,
        x: rect.left - sr.left + rect.width / 2,
        y: rect.top - sr.top + rect.height / 2,
        size: bubble.size,
        color: bubble.color,
        friends: bubble.friends,
      }
      setPops((cur) => [...cur, fx])
      window.setTimeout(() => setPops((cur) => cur.filter((p) => p.id !== fx.id)), 760)
    }
    setBubbles((current) => current.filter((b) => b.id !== bubble.id))
  }, [])

  return (
    <GameShell title={t('game.bubbles')} emoji="🫧" onExit={onExit}>
      <div className="score-pill" aria-label={`פוצצת ${popped} בועות`}>
        🫧 {popped}
      </div>
      <p className="bubble-hint">{t('bubbles.hint')}</p>

      <div className="bubble-stage" ref={stageRef}>
        {/* calm illustrated sky — a soft twilight the bubbles drift up into (the
            iridescent rims read strongest against it). Static, one <img>. The
            friends live IN the scene as each bubble's passenger (revealed waving
            at the pop), so the calm sky is left uncluttered — no grounded props. */}
        <SceneBackdrop src="night-sky.jpg" position="center 42%" scrim="soft" />

        {bubbles.map((bubble) => (
          <BubbleItem key={bubble.id} bubble={bubble} onPop={onPop} onExpire={onExpire} />
        ))}

        {/* pop bursts: ripple + droplets + the freed friend(s) waving as they fade */}
        {pops.map((p) => (
          <div
            key={p.id}
            className="bubble-pop"
            style={{ left: p.x, top: p.y, width: p.size, height: p.size } as React.CSSProperties}
            aria-hidden="true"
          >
            <span className="bubble-ring" />
            <span className="bubble-drops">
              <i />
              <i />
              <i />
            </span>
            <span className="bubble-wave-row">
              {p.friends.map((f, i) => (
                <span className="bubble-wave-friend" key={i}>
                  <Friend
                    index={f}
                    scale={
                      (p.size * (p.friends.length > 1 ? 0.4 : 0.56)) / FRIEND_NATURAL[friendKindForIndex(f)].h
                    }
                    showNumber={false}
                    waving
                  />
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </GameShell>
  )
}
