import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import type { GameProps } from './registry'
import { playImpact, playRise, playSwish, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { useViewport } from '../useViewport'
import { FRIEND_KINDS, FRIEND_NATURAL } from '../components/FriendArt'
import { friendNumber } from '../friends'
import { prefersReducedMotion, project, projScale, randInt } from './util'
import { useT } from '../i18n'
import { useGameLevel } from '../gameLevel'
import Confetti from '../components/Confetti'

// Bowling — a REAL finger-roll. The 10 pins ARE friends 1–10, racked as a neat
// receding triangle at the FAR THIRD of a varnished-maple lane (baked wood art +
// projection). The child DRAGS/FLICKS up the lane with a finger: the flick's
// DIRECTION aims the ball across the rack and its STRENGTH sets the roll speed,
// exactly like the throw in the basket/goal games. The ball rolls briskly up the
// projection (shrinks + rises + drifts up the converging boards); the pins it
// reaches WOBBLE, then TIP OVER about their feet away from the impact — staggered
// by distance, with a little settle — lie down, and we COUNT how many fell out
// loud. Then they spring back up smiling and the standing ones wave. No gutter to
// fall in, no fail — a weak or crooked roll still knocks something down and the
// ball returns cheerfully.
const ROWS = [4, 3, 2, 1] // far → near: base of 4 deepest, head pin nearest
// each row's depth 0 (near) → 1 (far horizon). Pushed into the FAR THIRD so the
// rack reads distant + neat (not a near blob); the back row sits deepest = the
// smallest + highest, the head pin nearest = biggest + lowest.
const ROW_DEPTH = [0.93, 0.83, 0.73, 0.63]
const ROLL_FROM = 0.04 // ball's resting depth (near, big)
const ROLL_TO = 0.6 // depth it rolls to (up to the front of the rack)
const PIN_FAR = 0.58 // pin size falloff with depth (deep rows clearly smaller)
const PIN_W_FRAC = 0.2 // a near (depth-0) pin's WIDTH as a fraction of lane width (× rowScale)
const PIN_ASPECT = 1.5 // pin height / width — matches the 200×300 baked pin.png sprite
const DECAL_W = 0.56 // belly decal (friend face) width as a fraction of the pin's width
const DECAL_TOP = 0.6 // decal centre down the pin (0 crown … 1 base) — the belly
const UNIT_FRAC = 0.15 // rack column spacing as a fraction of lane width (× rowScale)

// The baked lane's WOOD boundary as a fraction of lane WIDTH from the centre, at a
// vertical fraction y (0 top … 1 bottom of the box). The lane is a straight-edged
// trapezoid, so the half-width is linear between the far (narrow) and near (wide)
// ends — measured from the bake geometry. Every pin's x is CLAMPED inside this so
// no friend ever sits on the dark gutter margins.
const WOOD_FAR_Y = 0.156
const WOOD_FAR_HALF = 0.133
const WOOD_NEAR_Y = 0.883
const WOOD_NEAR_HALF = 0.417
function woodHalfFrac(y: number) {
  const t = (y - WOOD_FAR_Y) / (WOOD_NEAR_Y - WOOD_FAR_Y)
  return WOOD_FAR_HALF + (WOOD_NEAR_HALF - WOOD_FAR_HALF) * t
}

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// קל     = today's forgiving game: big ball, strong aim-assist that straightens
//          almost any flick to the centre, a huge knock radius → a near-auto strike.
// בינוני = less assist — a real aim is needed to sweep the whole rack.
// קשה    = pins spaced wider + a tighter knock radius → you must aim a line.
// אלוף   = minimal assist + a narrow knock radius: a crooked flick genuinely
//          misses the far pins (cheerfully). Always no-fail — a poor roll still
//          knocks the nearest pin down and the ball returns, never a gutter loss.
const LEVEL_TIERS = [0, 1, 2, 3]
// How much of the raw finger-aim SURVIVES onto the ball's line. The ball must
// VISIBLY go where the child flicks at EVERY level (the #1 QA fix) — the roll is
// no longer straightened to the centre. Forgiveness comes from the KNOCK radius
// below (a slightly-off aim still knocks pins), NOT from centring the ball. קל
// keeps a gentle line-straightening so a wild flick still lands on the rack; אלוף
// keeps the full crookedness so aiming a real line matters.
const AIM_KEEP = [0.62, 0.78, 0.9, 1.0]
// knock radius in rack-column units around where the ball arrives — this is the
// "no-fail generosity": big at קל (a near-auto sweep however you aim), tight at
// אלוף (a crooked line honestly leaves the far pins standing).
const KNOCK = [2.8, 1.6, 1.1, 0.85]
// rack column spacing multiplier — wider at the top levels = must aim a line
const COL_SPREAD = [1.0, 1.06, 1.14, 1.2]
// chance a standing pin next to a fallen one also topples (bounded scatter ring)
const CHAIN = [1.0, 0.82, 0.55, 0.42]
const AIM_RANGE = 1.25 // maps assisted aim → arrival offset in rack-column units
const AIM_CLAMP = 1.75 // the ball never rolls past this (stays on the lane, no gutter)

// each pin's logical x across the rack (in column units), matching how the rows
// render — so the hit-test and the drawn pins always agree.
function pinPositions(spread: number) {
  const out: number[] = []
  ROWS.forEach((c) => {
    for (let k = 0; k < c; k++) out.push((k - (c - 1) / 2) * spread)
  })
  return out // length 10, index = pin id
}

export default function BowlingGame({ onExit }: GameProps) {
  const { t, tAddr } = useT()
  const vp = useViewport()
  // Only the SCORE and the celebration are React state. The 10 pins are rendered
  // ONCE (memoized rack) and never re-rendered during a roll — their wobble /
  // topple / pop-up are driven by direct transform+class writes on refs (below),
  // so a roll never reconciles the heavy friend-pin DOM (no per-roll longtasks).
  const [count, setCount] = useState<number | null>(null)
  const [party, setParty] = useState(false)
  // spectators are chosen ONCE (no per-roll identity churn / remount) — they just
  // cheer via `bouncing` when the celebration fires.
  const [crowd] = useState(() => [randInt(0, 9), randInt(0, 9)])
  const [level] = useGameLevel('bowling', LEVEL_TIERS)
  const laneRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLSpanElement>(null)
  const pinRefs = useRef<(HTMLSpanElement | null)[]>([])
  // pooled per-pin topple data (tip angle + stagger delay) — MUTATED each roll,
  // never reallocated (flat heap).
  const fall = useRef<{ rot: number; delay: number }[]>(
    Array.from({ length: 10 }, () => ({ rot: 0, delay: 0 })),
  )
  const timers = useRef<number[]>([])
  const raf = useRef(0)
  const reduced = useRef(prefersReducedMotion())
  const levelRef = useRef(level)
  const rollingRef = useRef(false)
  const samples = useRef<{ x: number; y: number; t: number }[]>([])
  // lane box measured OUTSIDE the animation loop (a resize handler + roll start),
  // so the per-frame ball placement never forces a synchronous layout.
  const laneSize = useRef({ w: 340, h: 460 })

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    cancelAnimationFrame(raf.current)
  }

  useEffect(() => {
    levelRef.current = level
  }, [level])

  const ballD = () => Math.max(40, laneSize.current.w * 0.24)
  const measure = () => {
    const lane = laneRef.current
    if (!lane) return
    const r = lane.getBoundingClientRect()
    laneSize.current = { w: r.width, h: r.height }
    sizeBall()
  }
  // the ball's pixel size changes ONLY on resize — set it here, never per frame,
  // so the sprite raster is cached on the compositor layer and the roll writes a
  // pure transform (translate + scale + rotate) that the GPU handles for free.
  const sizeBall = () => {
    const el = ballRef.current
    if (!el) return
    const D = ballD()
    el.style.width = `${D}px`
    el.style.height = `${D}px`
  }

  // place the ball on the lane at depth z (projected: y-from-top × distance scale)
  // plus a lateral drift in px. Reads the cached size — NO layout/raster per frame.
  const placeBall = (z: number, rot = 0, driftPx = 0) => {
    const el = ballRef.current
    if (!el) return
    const { h } = laneSize.current
    const D = ballD()
    const p = project(z)
    const y = p.y * h - D / 2
    el.style.transform = `translate(${driftPx - D / 2}px, ${y}px) scale(${p.scale}) rotate(${rot}deg)`
  }
  const restBall = () => {
    sizeBall()
    placeBall(ROLL_FROM)
  }

  // ---- pin visuals driven by DIRECT DOM writes (no React state per roll) ----
  // The wobble/topple/pop-up are class + CSS-var writes on the pin refs; the CSS
  // transition/keyframes do the animating on the compositor. Discrete events
  // (not per-frame), so the friend-pin DOM is never reconciled during a roll.
  const wobblePins = (set: Set<number>) =>
    set.forEach((i) => {
      const el = pinRefs.current[i]
      if (el) {
        el.classList.remove('is-down', 'is-wave')
        el.classList.add('is-wobble')
      }
    })
  const dropPins = (set: Set<number>) =>
    set.forEach((i) => {
      const el = pinRefs.current[i]
      if (!el) return
      const f = fall.current[i]
      // tip over about the feet (transform-origin base), staggered by distance
      // from the ball's impact — the CSS `pin-fall` keyframe adds the gravity +
      // little settle. --fr carries the direction/angle (away from impact).
      el.style.setProperty('--fr', `${f.rot}deg`)
      el.style.animationDelay = `${f.delay}ms`
      el.classList.remove('is-wobble')
      el.classList.add('is-down')
    })
  // pop everyone back up; the still-STANDING pins (not in `fell`) give a wave.
  const resetPins = (fell?: Set<number>) => {
    for (let i = 0; i < 10; i++) {
      const el = pinRefs.current[i]
      if (!el) continue
      el.classList.remove('is-down', 'is-wobble', 'is-wave')
      el.style.animationDelay = '0ms'
      if (fell && !fell.has(i)) el.classList.add('is-wave')
    }
  }
  const clearWave = () => {
    for (let i = 0; i < 10; i++) pinRefs.current[i]?.classList.remove('is-wave')
  }

  useEffect(() => {
    measure()
    restBall()
    const onResize = () => {
      measure()
      if (!rollingRef.current) restBall()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // which pins fall for a ball arriving at `arrivalX` (rack-column units) at this
  // level — the direct knock radius, a neighbour-scatter chain, and a no-fail
  // guarantee of at least the single nearest pin.
  function computeFalls(arrivalX: number): number[] {
    const lvl = levelRef.current
    const pos = pinPositions(COL_SPREAD[lvl])
    const kr = KNOCK[lvl]
    const down = new Set<number>()
    pos.forEach((x, i) => {
      if (Math.abs(x - arrivalX) < kr) down.add(i)
    })
    // scatter to standing neighbours — a BOUNDED spread (max 2 rings), each pin
    // rolled once per ring. Not an unbounded cascade: at אלוף that would flip the
    // whole rack regardless of aim; bounding it keeps a crooked roll honestly
    // leaving the far-side pins standing.
    const chainR = kr * 0.7 + 0.4
    for (let ring = 0; ring < 2; ring++) {
      const prev = new Set(down)
      pos.forEach((x, i) => {
        if (down.has(i)) return
        for (const j of prev) {
          if (Math.abs(pos[j] - x) < chainR && Math.random() < CHAIN[lvl]) {
            down.add(i)
            break
          }
        }
      })
    }
    // never a total whiff: knock the nearest pin at least
    if (down.size === 0) {
      let best = 0
      let bd = Infinity
      pos.forEach((x, i) => {
        const dd = Math.abs(x - arrivalX)
        if (dd < bd) {
          bd = dd
          best = i
        }
      })
      down.add(best)
    }
    return [...down]
  }

  // roll the ball up the lane from a finger-flick: it eases out (fast then
  // settles), spinning + drifting toward the arrival point as it shrinks.
  function launch(arrivalX: number, power: number) {
    if (rollingRef.current) return
    unlockAudio()
    clear()
    reduced.current = prefersReducedMotion() // honour a mid-session calm toggle
    rollingRef.current = true
    setCount(null)
    setParty(false)
    resetPins() // pop any leftover pins up via DOM (no re-render)
    measure()
    restBall()

    const falling = computeFalls(arrivalX)
    const n = falling.length
    const fallingSet = new Set(falling)
    // topple physics per pin: TIP OVER about the feet AWAY from the impact point
    // (left of impact tips left, right tips right), ~80–90°, STAGGERED by distance
    // from the ball's arrival so the nearest pins go first (a real chain reaction).
    // MUTATE the pooled objects in place — no per-roll allocation.
    const pos = pinPositions(COL_SPREAD[levelRef.current])
    const order = falling.slice().sort((a, b) => Math.abs(pos[a] - arrivalX) - Math.abs(pos[b] - arrivalX))
    const rMul = reduced.current ? 0.72 : 1
    for (let i = 0; i < 10; i++) {
      const f = fall.current[i]
      if (fallingSet.has(i)) {
        const dir = pos[i] < arrivalX ? -1 : pos[i] > arrivalX ? 1 : Math.random() < 0.5 ? -1 : 1
        f.rot = dir * (84 + Math.random() * 10) * rMul // tip ~84–94° over its base
        f.delay = order.indexOf(i) * (reduced.current ? 34 : 60)
      } else {
        f.rot = 0
        f.delay = 0
      }
    }

    // the ball's lateral travel: drift toward the arrival point, in the SAME rack
    // spacing the pins use (so it visually meets them) at the roll depth's scale.
    const driftEnd = arrivalX * UNIT_FRAC * laneSize.current.w * projScale(ROLL_TO, PIN_FAR)
    const spin = (reduced.current ? 240 : 820) * (0.7 + power * 0.6)
    const DUR = reduced.current ? 340 : Math.round(620 - power * 320) // brisk: ~300–620ms
    playSwish() // whoosh synced to the release
    const start = performance.now()
    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / DUR)
      const ease = 1 - (1 - p) * (1 - p) // ease-out — loses speed as it arrives
      const z = ROLL_FROM + ease * (ROLL_TO - ROLL_FROM)
      const wob = Math.sin(ease * Math.PI) * 4 * (reduced.current ? 0.3 : 1)
      placeBall(z, ease * spin, driftEnd * ease + wob)
      if (p < 1) raf.current = requestAnimationFrame(animate)
      else onArrive(falling, fallingSet, n)
    }
    raf.current = requestAnimationFrame(animate)
  }

  // the ball has reached the rack → pins wobble, topple in a scatter, we count
  // them aloud, celebrate, then everyone pops back up and the standing ones wave.
  // Pin visuals are ALL direct DOM writes (no setState) — only the score + the
  // one-shot confetti are React state.
  function onArrive(falling: number[], fallingSet: Set<number>, n: number) {
    wobblePins(fallingSet)
    playImpact(0.7)
    timers.current.push(
      window.setTimeout(() => {
        dropPins(fallingSet)
        falling.forEach((_, k) => timers.current.push(window.setTimeout(() => playRise(k), k * 70)))
      }, 240),
    )
    timers.current.push(
      window.setTimeout(() => {
        setCount(n)
        playWin()
        speakNumber(n)
        setParty(true)
        timers.current.push(window.setTimeout(() => setParty(false), 2200))
      }, 240 + n * 60 + 380),
    )
    timers.current.push(
      window.setTimeout(() => {
        resetPins(fallingSet) // pop up; still-standing pins wave (DOM only)
        rollingRef.current = false
        restBall()
        timers.current.push(window.setTimeout(() => clearWave(), 900))
      }, 240 + n * 60 + 1250),
    )
  }

  // ---- finger-roll input (sample the flick → velocity → aim + strength) ----
  function onDown(e: React.PointerEvent) {
    if (rollingRef.current) return
    unlockAudio()
    samples.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]
  }
  function onMove(e: React.PointerEvent) {
    if (rollingRef.current || samples.current.length === 0) return
    samples.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    if (samples.current.length > 6) samples.current.shift()
  }
  function onUp() {
    if (rollingRef.current) return
    const s = samples.current
    samples.current = []
    if (s.length < 2) {
      // a plain tap → a gentle straight roll (still reaches the pins)
      launch(0, 0.32)
      return
    }
    const a = s[0]
    const z = s[s.length - 1]
    const dt = Math.max(16, z.t - a.t)
    const flickUp = a.y - z.y // + when flicking up the lane (toward the pins)
    const flickX = z.x - a.x // + to the right
    const speed = Math.hypot(flickX, flickUp) / dt // px/ms
    // strength: a gentle flick still gets a floor of power; a hard flick rolls fast
    const power = Math.max(0.28, Math.min(1, speed / 3))
    // aim: how sideways the flick is relative to its up-travel, kept per level
    const rawAim = Math.max(-1.6, Math.min(1.6, flickX / Math.max(60, flickUp)))
    const assisted = rawAim * AIM_KEEP[levelRef.current]
    const arrivalX = Math.max(-AIM_CLAMP, Math.min(AIM_CLAMP, assisted * AIM_RANGE))
    launch(arrivalX, power)
  }

  // The rack is built ONCE per level/viewport (not per roll): 10 memoized friend
  // pins whose wrapper elements are captured in pinRefs. Roll/topple never touches
  // this React subtree — it only writes classes/transforms on the refs. This is
  // what keeps a roll off the reconciler (no per-roll longtasks / element churn).
  const rack = useMemo(() => {
    // A real regulation rack — a receding equilateral triangle of BAKED bowling
    // pins (pin.png), apex (head pin) nearest the child. Each pin is placed
    // ABSOLUTELY by the projection:
    // - vertical: feet at project(depth).y (deep rows sit higher).
    // - size: PIN_W_FRAC × projScale(depth) (deep rows clearly smaller + higher).
    // - horizontal: world column × UNIT × rowScale (perspective-narrowed), then
    //   CLAMPED inside woodHalfFrac(y) minus the pin's own half-width, so no pin
    //   ever sits on the dark gutter margins.
    // On each pin's BELLY sits a compact friend face + the friend's number bead,
    // so every pin still "wears" its friend identity (colour + number) — the game
    // counts friends, so pin id 0..9 = friends 1..10, numbers legible + correct.
    const spread = COL_SPREAD[level]
    const laneW = Math.min(0.86 * vp.w, 384) // matches .bowl-lane width
    let pin = 0
    const pins: React.ReactNode[] = []
    ROWS.forEach((c, r) => {
      const d = ROW_DEPTH[r]
      const y = project(d).y
      const rowScale = projScale(d, PIN_FAR)
      const pw = PIN_W_FRAC * laneW * rowScale // pin pixel width at this depth
      const ph = pw * PIN_ASPECT
      const pinHalf = pw / 2 / laneW // the pin's own half-width (fraction of lane W)
      const woodLimit = Math.max(0, woodHalfFrac(y) - pinHalf)
      const decalPx = pw * DECAL_W // belly decal (friend face) size
      for (let k = 0; k < c; k++) {
        const i = pin++
        const col = (k - (c - 1) / 2) * spread
        let xFrac = col * UNIT_FRAC * rowScale
        if (xFrac > woodLimit) xFrac = woodLimit
        if (xFrac < -woodLimit) xFrac = -woodLimit
        const nat = FRIEND_NATURAL[FRIEND_KINDS[i % FRIEND_KINDS.length]]
        const faceScale = decalPx / Math.max(nat.w, nat.h)
        const numPx = Math.max(9, Math.round(decalPx * 0.62))
        pins.push(
          <span className="bowl-pin" key={i} style={{ left: `${50 + xFrac * 100}%`, top: `${y * 100}%` }}>
            {/* flat contact shadow on the deck — a sibling of the body, so it stays
                grounded while the body tips over it */}
            <span className="bowl-pin-shadow" style={{ width: pw * 0.66, height: pw * 0.2 }} />
            <span
              className="bowl-pin-body"
              style={{ width: `${pw}px`, height: `${ph}px` }}
              ref={(el) => {
                pinRefs.current[i] = el
              }}
            >
              <span className="bowl-pin-decal" style={{ width: `${decalPx}px`, top: `${DECAL_TOP * 100}%` }}>
                <Friend index={i} compact scale={faceScale} showNumber={false} mood="smile" />
                <span className="bowl-pin-num" style={{ fontSize: `${numPx}px` }}>
                  {friendNumber(i)}
                </span>
              </span>
            </span>
          </span>,
        )
      }
    })
    return <div className="bowl-pins">{pins}</div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, vp])

  return (
    <GameShell title={t('game.bowling')} emoji="🎳" onExit={onExit} levels={{ gameId: 'bowling', tiers: LEVEL_TIERS }}>
      <Confetti active={party} pieces={26} />
      <div className="sport-screen">
        <div className="sport-score" aria-live="polite">
          {count === null ? '🎳' : t('bowl.knocked', { n: count })}
        </div>

        <div
          className="bowl-lane"
          ref={laneRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: 'none' }}
        >
          {/* baked varnished-maple lane (wood + gutters + foul line + arrows + far
              arena wall), stretched to the box — the receding scene backdrop */}
          <img className="bowl-lane-img" src={`${import.meta.env.BASE_URL}art/sprites/bowling/lane.jpg`} alt="" draggable={false} />
          {/* gentle ambient life: one very slow overhead-light sheen drifting down
              the lane. Static DOM + a pure-CSS keyframe (frozen under reduce-motion). */}
          <div className="bowl-ambient" aria-hidden="true">
            <span className="bowl-sheen" />
          </div>

          {rack}

          {/* two spectator friends by the approach, grounded (contact shadow), feet
              inside the frame — they cheer on a strike */}
          <span className="bowl-fan l" aria-hidden="true">
            <Friend index={crowd[0]} scale={0.26} showNumber={false} mood="smile" bouncing={party} action={party ? 'hug' : null} />
          </span>
          <span className="bowl-fan r" aria-hidden="true">
            <Friend index={crowd[1]} scale={0.22} showNumber={false} mood="smile" bouncing={party} action={party ? 'hug' : null} />
          </span>

          <span className="bowl-ball" ref={ballRef} aria-hidden="true" />
        </div>

        <p className="sport-hint">{tAddr('bowl.hint')}</p>
      </div>
    </GameShell>
  )
}
