import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import type { GameProps } from './registry'
import { playImpact, playPop, playSwish, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { depthFromY, prefersReducedMotion, projScale, randInt } from './util'
import { useT } from '../i18n'
import Confetti from '../components/Confetti'
import { useGameLevel } from '../gameLevel'

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// קל     = today's game exactly: a big, close, STATIC hoop.
// בינוני = + the hoop drifts slowly side-to-side (a calm 9s sine).
// קשה    = + the hoop sits deeper/farther (smaller — perspective scaling), drift on.
// אלוף   = + the depth itself breathes very slowly near→far, and a clean "swish"
//          (nothing touched) earns a bonus star. Always no-fail: a miss just
//          brings the ball gently back.
const LEVEL_TIERS = [0, 1, 2, 3]
// aim-assist per level: קל keeps today's strong home-in; higher levels loosen it
// so AIMING and TIMING matter. אלוף is nearly unassisted — a straight flick at the
// wrong moment misses (cheerfully), so scoring is a real (still no-fail) challenge.
const ASSIST = [0.006, 0.0038, 0.0024, 0.0008]
// the make window narrows at the top levels, so אלוף demands a real aim, not a lob.
const MAKEW = [1, 1, 0.9, 0.72]
const STAR = `${import.meta.env.BASE_URL}art/sprites/star.png`

// static, receding half-court: sidelines converge to a far baseline under the
// hoop, a foreshortened key + free-throw ellipse, a muted arena wall with a soft
// crowd silhouette on the horizon. Purely decorative (line-work over the tan).
function CourtArt() {
  const NEAR_L = 4,
    NEAR_R = 96,
    FAR_L = 33,
    FAR_R = 67,
    TOP = 20
  // key (paint): a lane under the hoop, from the far baseline toward the child
  const keyNear = 0.62
  const keyNearY = 100 - keyNear * (100 - TOP)
  return (
    <svg className="court-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="bkWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b5340" />
          <stop offset="1" stopColor="#6f6449" />
        </linearGradient>
        <linearGradient id="bkFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* far arena wall + crowd silhouette on the horizon */}
      <rect x="0" y="0" width="100" height={TOP} fill="url(#bkWall)" />
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} cx={2 + i * 4.5} cy={TOP - 3.5} r={2.2} fill="#4a4335" opacity="0.55" />
      ))}
      {/* floor shading: darker at the far end = depth */}
      <polygon points={`${NEAR_L},100 ${NEAR_R},100 ${FAR_R},${TOP} ${FAR_L},${TOP}`} fill="url(#bkFar)" />
      {/* sidelines converging to the far baseline */}
      <line x1={NEAR_L} y1="100" x2={FAR_L} y2={TOP} stroke="#fff" strokeOpacity="0.4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line x1={NEAR_R} y1="100" x2={FAR_R} y2={TOP} stroke="#fff" strokeOpacity="0.4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line x1={FAR_L} y1={TOP} x2={FAR_R} y2={TOP} stroke="#fff" strokeOpacity="0.4" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {/* the key/paint, foreshortened (wider near the child, narrow at the hoop) */}
      <polygon
        points={`37,${keyNearY} 63,${keyNearY} 58,${TOP} 42,${TOP}`}
        fill="#fff"
        fillOpacity="0.08"
        stroke="#fff"
        strokeOpacity="0.32"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
      {/* free-throw circle as a squashed (perspective) ellipse */}
      <ellipse cx="50" cy={keyNearY} rx="10" ry="3.4" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {/* soft centre sheen from the one overhead light */}
      <polygon points="41,100 59,100 55,20 45,20" fill="#fff" opacity="0.06" />
    </svg>
  )
}

// The scripted "make" — a phase timeline (ms) plus the key positions the ball is
// interpolated through so a score always reads: rise above the rim → hang → drop
// THROUGH the hoop (net waves as it passes) → fall below → one floor bounce.
type Takeover = {
  t0: number
  sx: number
  sy: number
  cx: number
  cy: number
  apexY: number
  throughY: number
  floorYv: number
  rise: number
  hang: number
  drop: number
  fall: number
  bounce: number
  bounceH: number
  netFired: boolean
  landed: boolean
}

// Basketball — a REAL throw: flick anywhere with your finger, and the ball flies
// with that exact strength + direction (a hard flick = a hard throw) and arcs
// down under gravity. A ground shadow tracks it, the ball spins with its speed,
// near-misses roll softly around the rim and drop IN, the net ripples, and a
// couple of friends throw their arms up. No fail — every throw scores or the ball
// gently returns. The number is the player who throws.
export default function BasketGame({ onExit }: GameProps) {
  const { t, tAddr } = useT()
  const [score, setScore] = useState(0)
  const [party, setParty] = useState(false)
  const [player, setPlayer] = useState(() => randInt(0, 9))
  const [crowd, setCrowd] = useState(() => [randInt(0, 9), randInt(0, 9)])
  const [stars, setStars] = useState(0)
  const [swish, setSwish] = useState<{ x: number } | null>(null)
  const [level] = useGameLevel('basket', LEVEL_TIERS)
  const courtRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const hoopRef = useRef<HTMLDivElement>(null)
  const rimRef = useRef<HTMLSpanElement>(null)
  const frontRimRef = useRef<HTMLSpanElement>(null)

  const size = useRef({ w: 340, h: 520 })
  const ball = useRef({ x: 170, y: 430, vx: 0, vy: 0, r: 24, live: false, spin: 0 })
  const scored = useRef(false)
  const rolled = useRef(false)
  const touched = useRef(false) // rim-roll or wall contact — vetoes the swish star
  const scoreRef = useRef(0)
  const levelRef = useRef(level)
  // the hoop's slow drift (בינוני+). Everything lives in refs and is applied with
  // direct transform writes inside the existing rAF loops — zero per-frame React.
  // `amp`/`s` ease toward their per-level targets, so switching levels mid-play
  // morphs gently instead of snapping.
  const drift = useRef({ phase: 0, bPhase: 0, amp: 0, s: 1, dx: 0, lastT: 0 })
  // measured VISUAL rim centre (in court px), at rest (no drift transform) — the
  // takeover drops the ball through the CURRENT hoop pose derived from this.
  const hoopVis = useRef({ cx: 170, cy: 90, rx: 42, ry: 8, blockTop: 20 })
  // once a make is detected we stop the physics and run a scripted "through-hoop"
  // drop so the score moment is unmistakable (decoupled from the trigger).
  const tk = useRef<Takeover | null>(null)
  const samples = useRef<{ x: number; y: number; t: number }[]>([])
  const raf = useRef(0)
  const reduced = useRef(prefersReducedMotion())

  const floorY = () => size.current.h * 0.9

  const draw = () => {
    const b = ball.current
    const el = ballRef.current
    if (el) {
      // distance scaling: the ball shrinks as it flies "into" the scene toward the
      // hoop (near the floor = full size, at the hoop line ≈ half). Physics radius
      // b.r is untouched — this is a VISUAL scale about the ball's centre, so the
      // rim/scoring math is unchanged.
      const d = depthFromY(b.y, floorY(), size.current.h * 0.17)
      const ds = projScale(d, 0.55)
      el.style.width = `${b.r * 2}px`
      el.style.height = `${b.r * 2}px`
      el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.spin}deg) scale(${ds})`
    }
    // a soft ground shadow that slides under the ball and shrinks/fades as the
    // ball rises — the single cheapest cue that sells "a real throw in the air"
    const sh = shadowRef.current
    if (sh) {
      const fy = floorY()
      const h = size.current.h
      const air = Math.min(1, Math.max(0, (fy - b.y) / (h * 0.7)))
      const s = 1 - air * 0.55
      sh.style.transform = `translate(${b.x}px, ${fy}px) translate(-50%, -50%) scaleX(${s})`
      sh.style.opacity = `${0.26 - air * 0.2}`
    }
  }
  const rest = () => {
    const { w, h } = size.current
    const b = ball.current
    b.r = Math.max(18, w * 0.07)
    b.x = w * 0.5
    b.y = h * 0.84
    b.vx = 0
    b.vy = 0
    b.spin = 0
    b.live = false
    scored.current = false
    rolled.current = false
    touched.current = false
    draw()
  }

  // ---- hoop drift (difficulty layer) ----
  // advance the slow sine(s). Time-based (dt), so speed is frame-rate independent;
  // amplitude/scale EASE toward the level's targets = graceful level switches.
  const stepDrift = () => {
    const d = drift.current
    const now = performance.now()
    const dt = d.lastT ? Math.min(64, now - d.lastT) : 16
    d.lastT = now
    const lvl = levelRef.current
    const calm = reduced.current ? 0.6 : 1
    const ampTarget = lvl >= 1 ? size.current.w * (lvl >= 3 ? 0.17 : 0.14) * calm : 0
    d.amp += (ampTarget - d.amp) * 0.02
    // one full sweep ≈ 9s, but אלוף swings faster (~6.5s) so timing is harder
    if (lvl >= 1) d.phase += dt * ((Math.PI * 2) / (lvl >= 3 ? 6500 : 9000))
    let sTarget = 1
    if (lvl === 2) sTarget = 0.82 // קשה: parked deeper — a smaller, farther hoop
    if (lvl >= 3) {
      // אלוף: the depth itself breathes near→far, very slowly (≈13s)
      if (!reduced.current) d.bPhase += dt * ((Math.PI * 2) / 13000)
      sTarget = 0.82 + Math.sin(d.bPhase) * 0.1
    }
    d.s += (sTarget - d.s) * 0.03
    d.dx = Math.sin(d.phase) * d.amp
  }
  // true while the hoop needs per-frame transforms (drifting, or easing home)
  const driftOn = () =>
    levelRef.current >= 1 || Math.abs(drift.current.dx) > 0.3 || Math.abs(drift.current.s - 1) > 0.004
  const drawHoop = () => {
    const d = drift.current
    const hv = hoopVis.current
    const hoopEl = hoopRef.current
    if (hoopEl) hoopEl.style.transform = `translateX(calc(-50% + ${d.dx}px)) scale(${d.s})`
    // the front-rim occluder mirrors the hoop's pose (it scales about the hoop
    // block's top-centre, so its centre slides up as the hoop shrinks)
    const fr = frontRimRef.current
    if (fr) {
      const cyNow = hv.blockTop + (hv.cy - hv.blockTop) * d.s
      fr.style.transform = `translate(${d.dx}px, ${cyNow - hv.cy}px) scale(${d.s})`
    }
  }
  const clearHoopTransforms = () => {
    if (hoopRef.current) hoopRef.current.style.transform = ''
    if (frontRimRef.current) frontRimRef.current.style.transform = ''
  }
  // idle drift — keeps the hoop moving between throws (the child TIMES the shot).
  // Runs only while a drifting level is active; at קל it settles home and stops,
  // leaving the hoop exactly as the original static game.
  function idleDrift() {
    if (ball.current.live || tk.current) return
    stepDrift()
    drawHoop()
    if (driftOn()) raf.current = requestAnimationFrame(idleDrift)
    else clearHoopTransforms()
  }
  function startIdleDrift() {
    if (!driftOn()) return
    drift.current.lastT = 0
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(idleDrift)
  }

  useEffect(() => {
    const court = courtRef.current
    if (!court) return
    reduced.current = prefersReducedMotion()
    const measure = () => {
      const r = court.getBoundingClientRect()
      size.current = { w: r.width, h: r.height }
      // measure the hoop AT REST (drift transforms cleared) so the base pose is
      // clean; the idle drift re-applies its transform on the very next frame.
      clearHoopTransforms()
      // where the rim actually sits on screen (border-box centre), so the drop
      // lines up with the drawn hoop and the front-rim occluder overlays it.
      const rimEl = rimRef.current
      const hoopEl = hoopRef.current
      if (rimEl && hoopEl) {
        const rr = rimEl.getBoundingClientRect()
        const hv = {
          cx: rr.left - r.left + rr.width / 2,
          cy: rr.top - r.top + rr.height / 2,
          rx: rr.width / 2,
          ry: rr.height / 2,
          blockTop: hoopEl.getBoundingClientRect().top - r.top,
        }
        hoopVis.current = hv
        const fr = frontRimRef.current
        if (fr) {
          fr.style.left = `${hv.cx - hv.rx}px`
          fr.style.top = `${hv.cy - hv.ry}px`
          fr.style.width = `${hv.rx * 2}px`
          fr.style.height = `${hv.ry * 2}px`
        }
      }
      if (!ball.current.live) rest()
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // level changes (from the shared top-bar control): the loops read levelRef, so
  // this only records the value and (re)starts the idle drift when the ball is
  // parked. Mid-flight switches morph in gracefully via the eased amp/scale.
  useEffect(() => {
    levelRef.current = level
    if (!ball.current.live && !tk.current) startIdleDrift()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const GRAV = 0.5
  function loop() {
    if (tk.current) return // the scripted make owns the ball now
    // keep the hoop drifting while the ball is in the air, so the child has to
    // TIME the release (בינוני+). At קל this is a no-op — the hoop stays home.
    stepDrift()
    drawHoop()
    const b = ball.current
    const d = drift.current
    const { w, h } = size.current
    // live hoop centre = the static base pose + the current drift (dx) and depth
    // (s). At קל (dx=0, s=1) these collapse to the original constants exactly.
    const hoopX = w * 0.5 + d.dx
    const hoopY = h * 0.17 - (1 - d.s) * (h * 0.06)
    const py = b.y
    b.vy += GRAV
    // gentle aim-assist toward the (possibly moving) hoop — strong at קל, looser at
    // higher levels so a mistimed flick can miss (cheerfully).
    b.vx += (hoopX - b.x) * ASSIST[levelRef.current]
    b.vx *= 0.99
    b.x += b.vx
    b.y += b.vy
    // spin follows the travel — mostly horizontal velocity, a touch of tumble
    b.spin += (b.vx * 2.4 + (b.vy > 0 ? 1 : -1) * 0.6) * (reduced.current ? 0.3 : 1)

    const rim = Math.max(48, w * 0.2 * MAKEW[levelRef.current]) * d.s
    const dx = b.x - hoopX
    // near-miss: catch the rim and roll softly toward the middle, then drop IN
    const nearRim = Math.abs(b.y - hoopY) < b.r * 2.2
    if (!scored.current && nearRim && Math.abs(dx) > rim * 0.55 && Math.abs(dx) < rim * 1.7) {
      b.vx += -Math.sign(dx) * 0.55 // roll inward
      b.vy *= 0.9 // lose a little pace on the rim
      if (!rolled.current) {
        rolled.current = true
        touched.current = true // rolled the rim → not a clean swish
        playImpact(0.35)
      }
    }
    // a wide, forgiving rim — a make is DETECTED on the rim line (unchanged), but the
    // celebration is no longer fired here: we hand the ball to a scripted drop so the
    // score is seen going THROUGH the hoop instead of scoring on the way up and out.
    const crossedRim = (py - hoopY) * (b.y - hoopY) <= 0
    if (!scored.current && crossedRim && Math.abs(dx) < rim) {
      scored.current = true
      startTakeover(b.x, b.y)
      return
    }
    // side walls bounce gently
    if (b.x < b.r) {
      b.x = b.r
      b.vx = Math.abs(b.vx) * 0.6
      touched.current = true
      playImpact(0.3)
    }
    if (b.x > w - b.r) {
      b.x = w - b.r
      b.vx = -Math.abs(b.vx) * 0.6
      touched.current = true
      playImpact(0.3)
    }
    draw()
    // gone off the court → put a fresh ball back in the player's hands
    if (b.y > h + 120 || b.y < -160) {
      rest()
      setPlayer(randInt(0, 9))
      setCrowd([randInt(0, 9), randInt(0, 9)])
      startIdleDrift() // keep the hoop drifting while the next ball waits
      return
    }
    raf.current = requestAnimationFrame(loop)
  }

  // fire the celebration exactly as the ball passes through the hoop
  function fireScore() {
    scoreRef.current += 1
    setScore(scoreRef.current)
    playWin()
    playSwish()
    speakNumber(scoreRef.current)
    setParty(true)
    window.setTimeout(() => setParty(false), 2200)
    // אלוף bonus: a clean "swish" (never touched rim or wall) earns a star.
    if (levelRef.current >= 3 && !touched.current) {
      setStars((n) => n + 1)
      setSwish({ x: hoopVis.current.cx + drift.current.dx })
      window.setTimeout(() => setSwish(null), 1400)
    }
  }

  // begin the scripted make from the ball's current position
  function startTakeover(sx: number, sy: number) {
    const { h } = size.current
    const b = ball.current
    const hv = hoopVis.current
    const d = drift.current
    const red = reduced.current
    // the hoop may be drifted/depth-scaled — drop the ball through its LIVE pose
    // (matches how drawHoop/frontRim place it on screen, so the make still reads).
    const liveCx = hv.cx + d.dx
    const liveCy = hv.blockTop + (hv.cy - hv.blockTop) * d.s
    const liveRy = hv.ry * d.s
    const apexAbove = Math.max(b.r * 2.2, liveRy * 3 + 26)
    tk.current = {
      t0: performance.now(),
      sx,
      sy,
      cx: liveCx,
      cy: liveCy,
      apexY: liveCy - apexAbove,
      throughY: liveCy + b.r * 1.7,
      floorYv: h * 0.88,
      rise: red ? 120 : 260,
      hang: red ? 40 : 130,
      drop: red ? 300 : 620,
      fall: red ? 170 : 420,
      bounce: red ? 0 : 320,
      bounceH: h * 0.1,
      netFired: false,
      landed: false,
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(stepTakeover)
  }

  function stepTakeover() {
    const b = ball.current
    const t = tk.current
    if (!t) return
    const red = reduced.current
    const e = performance.now() - t.t0
    const tRise = t.rise
    const tHang = tRise + t.hang
    const tDrop = tHang + t.drop
    const tFall = tDrop + t.fall
    const tBounce = tFall + t.bounce
    const easeOut = (p: number) => 1 - (1 - p) * (1 - p)
    const easeIn = (p: number) => p * p

    if (e < tRise) {
      const p = easeOut(e / t.rise)
      b.x = t.sx + (t.cx - t.sx) * p
      b.y = t.sy + (t.apexY - t.sy) * p
    } else if (e < tHang) {
      b.x = t.cx
      b.y = t.apexY
    } else if (e < tDrop) {
      const p = easeIn((e - tHang) / t.drop)
      b.x = t.cx
      b.y = t.apexY + (t.throughY - t.apexY) * p
      if (!t.netFired && b.y >= t.cy) {
        t.netFired = true // the moment it passes through the rim
        fireScore()
      }
    } else if (e < tFall) {
      const p = (e - tDrop) / t.fall
      b.x = t.cx
      b.y = t.throughY + (t.floorYv - t.throughY) * easeIn(p)
    } else if (e < tBounce) {
      if (!t.landed) {
        t.landed = true
        playImpact(0.3)
      }
      const p = (e - tFall) / t.bounce
      b.x = t.cx
      b.y = t.floorYv - t.bounceH * Math.sin(Math.PI * p)
    } else {
      if (!t.netFired) fireScore()
      if (!t.landed) playImpact(0.3)
      tk.current = null
      rest()
      setPlayer(randInt(0, 9))
      setCrowd([randInt(0, 9), randInt(0, 9)])
      startIdleDrift() // resume the drift for the next shot
      return
    }
    b.spin += red ? 1.5 : 5
    draw()
    raf.current = requestAnimationFrame(stepTakeover)
  }

  function onDown(e: React.PointerEvent) {
    if (ball.current.live) return
    unlockAudio()
    samples.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]
  }
  function onMove(e: React.PointerEvent) {
    if (ball.current.live || samples.current.length === 0) return
    samples.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
    if (samples.current.length > 6) samples.current.shift()
  }
  function onUp() {
    if (ball.current.live) return
    const s = samples.current
    samples.current = []
    if (s.length < 2) return
    const a = s[0]
    const z = s[s.length - 1]
    const dt = Math.max(16, z.t - a.t)
    const GAIN = 13
    let vx = ((z.x - a.x) / dt) * GAIN
    let vy = ((z.y - a.y) / dt) * GAIN
    const { w, h } = size.current
    const b = ball.current
    const cap = w * 0.16
    // ALWAYS shoot upward, with at least enough power to reach the hoop — so even
    // a weak or sideways flick scores. A harder flick still makes a bigger arc.
    const reach = Math.sqrt(2 * GRAV * Math.max(60, b.y - h * 0.17))
    vy = -Math.max(Math.abs(vy), reach * 1.02)
    vy = Math.max(-cap * 2.4, vy)
    vx = Math.max(-cap, Math.min(cap, vx))
    b.vx = vx
    b.vy = vy
    b.live = true
    rolled.current = false
    playPop()
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }

  return (
    <GameShell title={t('game.basket')} emoji="🏀" onExit={onExit} levels={{ gameId: 'basket', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="sport-screen">
        <div className="sport-score" aria-live="polite">
          <span aria-hidden="true">🏀</span> {score}
          {stars > 0 && (
            <span className="sport-stars" aria-hidden="true">
              <img src={STAR} alt="" width={20} height={20} draggable={false} /> {stars}
            </span>
          )}
        </div>

        <div
          className="phys-court basket-court2"
          ref={courtRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: 'none' }}
        >
          <CourtArt />
          {/* living painted field — swaying dry courtside tufts, a slow skylight
              sheen, and a near-edge strip that wraps over the friends' feet.
              Static DOM + pure-CSS keyframes (zero JS per frame). */}
          <div className="court-ambient" aria-hidden="true">
            <span className="court-drift" />
            <span className="court-tuft m1" />
            <span className="court-tuft m2" />
            <span className="court-tuft c1" />
            <span className="court-tuft c2" />
            <span className="court-tuft f1" />
            <span className="court-tuft f2" />
            <span className="court-fore" />
          </div>
          <div className={`basket-hoop ${party ? 'is-scored' : ''}`} ref={hoopRef} aria-hidden="true">
            <span className="basket-pole" />
            <span className="basket-board" />
            <span className="basket-rim" ref={rimRef} />
            <span className="basket-net" />
          </div>
          {swish && (
            <span className="sport-swish" style={{ left: swish.x }} aria-hidden="true">
              <img src={STAR} alt="" width={34} height={34} draggable={false} />
            </span>
          )}
          {/* the FRONT arc of the rim, lifted above the ball, so a make reads as the
              ball dropping THROUGH the hoop (behind this arc, in front of the board) */}
          <span className="basket-rim-front" ref={frontRimRef} aria-hidden="true" />
          <span className="phys-player" aria-hidden="true">
            <Friend index={player} scale={0.42} showNumber mood="smile" />
          </span>
          {/* fans along the receding sideline: the far one sits higher + smaller */}
          <span className="basket-fan near" aria-hidden="true">
            <Friend index={crowd[0]} scale={0.3} showNumber={false} mood="smile" action={party ? 'hug' : null} bouncing={party} />
          </span>
          <span className="basket-fan far" aria-hidden="true">
            <Friend index={crowd[1]} scale={0.2} showNumber={false} mood="smile" action={party ? 'hug' : null} bouncing={party} />
          </span>
          <div className="phys-shadow" ref={shadowRef} aria-hidden="true" />
          <div className="phys-ball basket-real" ref={ballRef} aria-hidden="true" />
        </div>

        <p className="sport-hint">{tAddr('basket.hint')}</p>
      </div>
    </GameShell>
  )
}
