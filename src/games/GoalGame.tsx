import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import type { GameProps } from './registry'
import { playImpact, playNudge, playPop, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { depthFromY, prefersReducedMotion, projScale, randInt } from './util'
import { useT } from '../i18n'
import Confetti from '../components/Confetti'
import { useGameLevel } from '../gameLevel'

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// קל     = today's game exactly: a slow keeper with a tiny block zone.
// בינוני = + the keeper patrols wider & a touch faster, block zone grows a little.
// קשה    = + two corner target STARS inside the goal earn a bonus when hit.
// אלוף   = + the keeper is livelier (faster, quicker to react) — still beatable.
// Always no-fail: a save is a cheerful "כמעט! עוד פעם!" and the ball comes back.
const LEVEL_TIERS = [0, 1, 2, 3]
const STAR = `${import.meta.env.BASE_URL}art/sprites/star.png`
// index 0 (קל) holds today's EXACT constants, so the default game is unchanged.
const PATROL = [0.028, 0.034, 0.044, 0.06] // keeper phase increment (speed)
const BLOCK = [0.06, 0.078, 0.1, 0.155] // save zone half-width (× field width)
// aim-assist toward the OPEN side — strong (auto-aim) at קל; at אלוף it's almost
// nothing, so the child must aim past the keeper. This is the main difficulty lever.
const ASSIST_G = [0.004, 0.003, 0.0016, 0.0006]
// how wide the keeper patrols (smaller factor = wider swing, covers more goal).
const KRANGE = [0.7, 0.6, 0.46, 0.3]

// static, receding pitch: mow stripes that compress toward a far touchline, a
// squashed penalty arc, and a soft stadium-dusk wall with a crowd silhouette on
// the horizon behind the goal. Purely decorative (drawn over the sage pitch).
function PitchArt() {
  const NEAR_L = 2,
    NEAR_R = 98,
    FAR_L = 30,
    FAR_R = 70,
    TOP = 16
  const edge = (nx: number, fx: number, f: number) => nx + (fx - nx) * f
  // mow stripes bunch toward the far touchline (perspective) — y from the top
  const stripes = [96, 82, 70, 60, 51, 43, 36, 30, 25].map((y) => (100 - y) / (100 - TOP))
  return (
    <svg className="pitch-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="gkSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a6b8c" />
          <stop offset="1" stopColor="#7d8ba6" />
        </linearGradient>
        <linearGradient id="gkFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.14" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* stadium-dusk wall + crowd silhouette on the horizon */}
      <rect x="0" y="0" width="100" height={TOP} fill="url(#gkSky)" />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={1 + i * 4.2} cy={TOP - 3} r={2} fill="#3f4a63" opacity="0.5" />
      ))}
      {/* alternating mow stripes, foreshortened between two converging touchlines */}
      {stripes.slice(0, -1).map((f, i) => {
        const f2 = stripes[i + 1]
        const y1 = 100 - f * (100 - TOP)
        const y2 = 100 - f2 * (100 - TOP)
        return (
          <polygon
            key={i}
            points={`${edge(NEAR_L, FAR_L, f)},${y1} ${edge(NEAR_R, FAR_R, f)},${y1} ${edge(NEAR_R, FAR_R, f2)},${y2} ${edge(NEAR_L, FAR_L, f2)},${y2}`}
            fill={i % 2 === 0 ? '#ffffff' : '#000000'}
            fillOpacity={i % 2 === 0 ? 0.05 : 0.05}
          />
        )
      })}
      {/* converging touchlines */}
      <line x1={NEAR_L} y1="100" x2={FAR_L} y2={TOP} stroke="#fff" strokeOpacity="0.28" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line x1={NEAR_R} y1="100" x2={FAR_R} y2={TOP} stroke="#fff" strokeOpacity="0.28" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {/* far shading + squashed penalty arc */}
      <polygon points={`${NEAR_L},100 ${NEAR_R},100 ${FAR_R},${TOP} ${FAR_L},${TOP}`} fill="url(#gkFar)" />
      <ellipse cx="50" cy={100 - 0.72 * (100 - TOP)} rx="13" ry="3.6" fill="none" stroke="#fff" strokeOpacity="0.24" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// The scripted "goal" — the ball crosses the line, the net bulges deeply at the
// impact point, the ball nestles in the net for a beat, THEN the celebration fires.
type GoalTakeover = {
  t0: number
  sx: number
  sy: number
  nx: number
  ny: number
  cross: number
  nestle: number
  hold: number
  celebrated: boolean
}

// Soccer — a REAL kick: flick with your finger toward the goal and the ball
// shoots with that strength + direction, rolling (it spins with its speed). A
// friend keeps goal, patrolling and leaning lazily toward the ball; when you
// score, the net bulges, the keeper smiles + claps, and the kicker runs a small
// arc with arms up. Miss or a save just resets the ball — no fail.
export default function GoalGame({ onExit }: GameProps) {
  const { t, tAddr } = useT()
  const [score, setScore] = useState(0)
  const [party, setParty] = useState(false)
  const [netBulge, setNetBulge] = useState(false)
  const [bulgeOrigin, setBulgeOrigin] = useState('50% 46%')
  // a soft "pocket" where the ball pushes the net back — the clearest read that the
  // ball is IN the net (null = hidden). Positioned/sized in court px from the takeover.
  const [pocket, setPocket] = useState<{ x: number; y: number; r: number } | null>(null)
  const [kicker, setKicker] = useState(() => randInt(0, 9))
  const [keeper, setKeeper] = useState(() => randInt(0, 9))
  const [level] = useGameLevel('goal', LEVEL_TIERS)
  const [stars, setStars] = useState(0)
  const [almost, setAlmost] = useState(false) // gentle "כמעט!" after a save
  const [starHit, setStarHit] = useState<'l' | 'r' | null>(null)
  const levelRef = useRef(level)
  const fieldRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const keeperRef = useRef<HTMLSpanElement>(null)

  const size = useRef({ w: 340, h: 480 })
  const ball = useRef({ x: 170, y: 400, vx: 0, vy: 0, r: 22, live: false, spin: 0 })
  const keep = useRef({ x: 170, phase: 0, lean: 0 })
  const done = useRef(false)
  const gtk = useRef<GoalTakeover | null>(null)
  const scoreRef = useRef(0)
  const samples = useRef<{ x: number; y: number; t: number }[]>([])
  const raf = useRef(0)
  const reduced = useRef(prefersReducedMotion())

  const goalHalf = () => size.current.w * 0.36
  const goalY = () => size.current.h * 0.15
  // keeper is at the FAR end (the goal), so it renders at far-scale (small)
  const keeperR = () => Math.max(22, size.current.w * 0.088)

  const drawBall = () => {
    const b = ball.current
    const el = ballRef.current
    if (!el) return
    // distance scaling: the ball starts big at the child's feet and shrinks as it
    // travels up the pitch toward the goal at the horizon. Physics radius b.r is
    // untouched (visual scale about the ball's centre), so the save/score line and
    // the goal mouth test are unchanged.
    const d = depthFromY(b.y, size.current.h * 0.86, goalY())
    const ds = projScale(d, 0.5)
    el.style.width = `${b.r * 2}px`
    el.style.height = `${b.r * 2}px`
    el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.spin}deg) scale(${ds})`
  }
  const drawKeeper = () => {
    const el = keeperRef.current
    // sit the keeper LOWER so its body stands inside the goal mouth (under the
    // crossbar) instead of poking above the frame — the friend art overflows the
    // small keeperR box upward, so drop the anchor by most of a radius. Purely
    // visual: the save test uses keep.x, never the keeper's y.
    if (el)
      el.style.transform = `translate(${keep.current.x - keeperR()}px, ${goalY() - keeperR() * 0.25}px) rotate(${keep.current.lean}deg)`
  }
  // one idle-patrol tick at the current level's speed (קל = today's 0.028).
  const patrolStep = () => {
    const k = keep.current
    k.phase += PATROL[levelRef.current]
    k.x = size.current.w / 2 + Math.sin(k.phase) * (goalHalf() - keeperR() * KRANGE[levelRef.current])
    k.lean += (0 - k.lean) * 0.1
    drawKeeper()
  }
  const rest = () => {
    const { w, h } = size.current
    const b = ball.current
    b.r = Math.max(16, w * 0.06)
    b.x = w * 0.5
    b.y = h * 0.82
    b.vx = 0
    b.vy = 0
    b.spin = 0
    b.live = false
    done.current = false
    drawBall()
  }

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    reduced.current = prefersReducedMotion()
    const measure = () => {
      const r = field.getBoundingClientRect()
      size.current = { w: r.width, h: r.height }
      if (!ball.current.live) rest()
      drawKeeper()
    }
    measure()
    window.addEventListener('resize', measure)
    // the keeper always patrols the goal, even before the first kick
    const patrol = () => {
      patrolStep()
      if (!ball.current.live) raf.current = requestAnimationFrame(patrol)
    }
    raf.current = requestAnimationFrame(patrol)
    return () => {
      window.removeEventListener('resize', measure)
      cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // the patrol/loop read levelRef every frame, so a header level switch just
  // updates the ref — the keeper's speed/zone change from the next tick on.
  useEffect(() => {
    levelRef.current = level
  }, [level])

  function loop() {
    if (gtk.current) return // the scripted goal owns the ball now
    const b = ball.current
    const { w, h } = size.current
    // keeper keeps patrolling during the shot, leaning lazily toward the ball
    const k = keep.current
    k.phase += PATROL[levelRef.current]
    let kx = w / 2 + Math.sin(k.phase) * (goalHalf() - keeperR() * KRANGE[levelRef.current])
    // אלוף: the keeper actively reads the ball's column and slides under it, so a
    // straight centred shot gets met — beat it by aiming a corner (aim-assist is
    // nearly off here) and timing the keeper to the far side. Still fully no-fail.
    if (levelRef.current >= 3) kx += (b.x - kx) * 0.26
    k.x = kx
    const reactive = levelRef.current >= 3 ? 0.14 : 0.08 // אלוף: quicker to lean
    const wantLean = Math.max(-10, Math.min(10, (b.x - k.x) * 0.08)) * (reduced.current ? 0.3 : 1)
    k.lean += (wantLean - k.lean) * reactive // lazy — eases toward the ball
    drawKeeper()

    // aim-assist: curve the ball toward the OPEN side of the goal (kid-friendly),
    // looser at higher levels so the child aims more deliberately
    const openX = k.x < w / 2 ? w / 2 + goalHalf() * 0.5 : w / 2 - goalHalf() * 0.5
    b.vx += (openX - b.x) * ASSIST_G[levelRef.current]

    b.x += b.vx
    b.y += b.vy
    b.vx *= 0.994
    b.vy *= 0.994
    // the ball rolls — spin follows travel (mostly horizontal)
    b.spin += (b.vx * 2.6 + b.vy * 0.4) * (reduced.current ? 0.3 : 1)

    if (b.x < b.r) {
      b.x = b.r
      b.vx = Math.abs(b.vx)
      playImpact(0.3)
    }
    if (b.x > w - b.r) {
      b.x = w - b.r
      b.vx = -Math.abs(b.vx)
      playImpact(0.3)
    }

    // reaching the goal line (moving up)
    if (!done.current && b.vy < 0 && b.y - b.r <= goalY()) {
      const inMouth = Math.abs(b.x - w / 2) < goalHalf()
      const saved = Math.abs(b.x - k.x) < w * BLOCK[levelRef.current] + b.r // block zone grows with level
      if (inMouth && !saved) {
        done.current = true
        startGoalTakeover(b.x) // hand off: cross the line, bulge the net, nestle
        return
      } else {
        // a save or a hit off the post → bounce back down
        b.y = goalY() + b.r
        b.vy = Math.abs(b.vy) * 0.6
        if (inMouth) {
          // the keeper made a save — a visible happy lunge, and a cheerful "כמעט!"
          // (no-fail: encouragement, never a loss). The ball just comes back.
          k.lean = Math.max(-24, Math.min(24, (b.x - k.x) * 0.8))
          drawKeeper()
          playNudge()
          setAlmost(true)
          window.setTimeout(() => setAlmost(false), 1300)
        } else playImpact(0.4)
      }
    }

    drawBall()

    const speed = Math.hypot(b.vx, b.vy)
    const off = b.y < -160 || b.y > h + 140
    const stopped = !done.current && speed < 0.6
    if (off || (done.current && b.y < -40) || stopped) {
      rest()
      setKicker(randInt(0, 9))
      setKeeper(randInt(0, 9))
      // hand back to the idle keeper-patrol loop
      raf.current = requestAnimationFrame(function patrol() {
        patrolStep()
        if (!ball.current.live) raf.current = requestAnimationFrame(patrol)
      })
      return
    }
    raf.current = requestAnimationFrame(loop)
  }

  // the keeper resumes idle patrol once the ball is back at the kicker's feet
  function idlePatrol() {
    patrolStep()
    if (!ball.current.live) raf.current = requestAnimationFrame(idlePatrol)
  }

  // the celebration — fired only once the ball has nestled in the net
  function fireGoal() {
    scoreRef.current += 1
    setScore(scoreRef.current)
    playWin()
    speakNumber(scoreRef.current)
    setParty(true)
    window.setTimeout(() => setParty(false), 2200)
  }

  function startGoalTakeover(impactX: number) {
    const { w } = size.current
    const b = ball.current
    const gy = goalY()
    const red = reduced.current
    const nx = Math.max(w * 0.5 - goalHalf() * 0.8, Math.min(w * 0.5 + goalHalf() * 0.8, impactX))
    // קשה+: a shot into a top corner (near a post) pops that target star for a bonus.
    if (levelRef.current >= 2) {
      const near = goalHalf() * 0.5
      const lc = w * 0.5 - goalHalf() * 0.8
      const rc = w * 0.5 + goalHalf() * 0.8
      const side = Math.abs(impactX - lc) < near ? 'l' : Math.abs(impactX - rc) < near ? 'r' : null
      if (side) {
        setStars((n) => n + 1)
        setStarHit(side)
        window.setTimeout(() => setStarHit(null), 1200)
      }
    }
    gtk.current = {
      t0: performance.now(),
      sx: b.x,
      sy: b.y,
      nx,
      ny: gy - b.r * 0.5, // just past the line, into the net
      cross: red ? 120 : 200,
      nestle: red ? 200 : 450,
      hold: red ? 180 : 480,
      celebrated: false,
    }
    // deep net bulge, emanating from where the ball crossed
    const originPct = Math.max(12, Math.min(88, ((impactX - w * 0.19) / (w * 0.62)) * 100))
    setBulgeOrigin(`${originPct}% 46%`)
    setNetBulge(true)
    window.setTimeout(() => setNetBulge(false), red ? 360 : 650)
    // a pocket the ball's size (as rendered at the far goal) pushed into the net
    const rr = b.r * projScale(1, 0.5)
    setPocket({ x: nx, y: gy - b.r * 0.15, r: rr * 2.6 })
    playImpact(0.3) // soft net thump on contact
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(stepGoalTakeover)
  }

  function stepGoalTakeover() {
    const b = ball.current
    const t = gtk.current
    if (!t) return
    const red = reduced.current
    const e = performance.now() - t.t0
    const tCross = t.cross
    const tNestle = tCross + t.nestle
    const tHold = tNestle + t.hold
    const easeOut = (p: number) => 1 - (1 - p) * (1 - p)

    if (e < tCross) {
      const p = easeOut(e / t.cross)
      b.x = t.sx + (t.nx - t.sx) * p
      b.y = t.sy + (t.ny - t.sy) * p
    } else if (e < tNestle) {
      // settle into the net with a tiny damped bob
      const p = (e - tCross) / t.nestle
      const bob = red ? 0 : Math.sin(p * Math.PI * 2) * b.r * 0.12 * (1 - p)
      b.x = t.nx
      b.y = t.ny + bob
    } else if (e < tHold) {
      if (!t.celebrated) {
        t.celebrated = true
        fireGoal()
      }
      b.x = t.nx
      b.y = t.ny
    } else {
      if (!t.celebrated) fireGoal()
      gtk.current = null
      setPocket(null)
      rest()
      setKicker(randInt(0, 9))
      setKeeper(randInt(0, 9))
      raf.current = requestAnimationFrame(idlePatrol)
      return
    }
    b.spin += red ? 1.2 : 3.5
    drawBall()
    raf.current = requestAnimationFrame(stepGoalTakeover)
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
    const GAIN = 14
    let vx = ((z.x - a.x) / dt) * GAIN
    let vy = ((z.y - a.y) / dt) * GAIN
    const { w, h } = size.current
    const b = ball.current
    const cap = w * 0.2
    // always kick toward the goal with enough power to reach it — so even a weak
    // or sideways flick gets there. A harder flick still shoots faster.
    const reach = (b.y - h * 0.15) / 90
    vy = -Math.max(Math.abs(vy), reach)
    vy = Math.max(-cap, vy)
    vx = Math.max(-cap, Math.min(cap, vx))
    b.vx = vx
    b.vy = vy
    b.live = true
    playPop()
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }

  return (
    <GameShell title={t('game.goal')} emoji="⚽" onExit={onExit} levels={{ gameId: 'goal', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="sport-screen">
        <div className="sport-score" aria-live="polite">
          <span aria-hidden="true">⚽</span> {score}
          {stars > 0 && (
            <span className="sport-stars" aria-hidden="true">
              <img src={STAR} alt="" width={20} height={20} draggable={false} /> {stars}
            </span>
          )}
        </div>

        <div
          className="phys-court goal-field2"
          ref={fieldRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: 'none' }}
        >
          <PitchArt />
          {/* living painted pitch — swaying grass tufts along the touchlines, a
              slow drifting cloud shadow, and a near-edge strip that wraps over
              the friends' feet. Static DOM + pure-CSS keyframes (zero JS/frame). */}
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
          <div
            className={`goal-frame ${party ? 'is-scored' : ''} ${netBulge ? 'is-bulging' : ''}`}
            aria-hidden="true"
          >
            {/* side netting drawn with skew = the goal has depth going back */}
            <span className="goal-side l" />
            <span className="goal-side r" />
            <span className="goal-mesh" style={{ transformOrigin: bulgeOrigin }} />
            <span className="goal-post l" />
            <span className="goal-post r" />
            <span className="goal-bar" />
          </div>
          {/* קשה+: target stars in the top corners — aim for them for a bonus */}
          {level >= 2 && (
            <>
              <span className={`goal-star l ${starHit === 'l' ? 'is-hit' : ''}`} aria-hidden="true">
                <img src={STAR} alt="" width={26} height={26} draggable={false} />
              </span>
              <span className={`goal-star r ${starHit === 'r' ? 'is-hit' : ''}`} aria-hidden="true">
                <img src={STAR} alt="" width={26} height={26} draggable={false} />
              </span>
            </>
          )}
          {/* the net pushed back where the ball struck — the clearest goal read */}
          {pocket && (
            <span
              className="goal-pocket"
              aria-hidden="true"
              style={{ left: pocket.x - pocket.r, top: pocket.y - pocket.r, width: pocket.r * 2, height: pocket.r * 2 }}
            />
          )}
          <span className="phys-keeper" ref={keeperRef} aria-hidden="true">
            <Friend
              index={keeper}
              scale={0.3}
              showNumber={false}
              mood="smile"
              action={party ? 'hug' : null}
              bouncing={party}
            />
          </span>
          <span className={`phys-player ${party ? 'is-celebrating' : ''}`} aria-hidden="true">
            <Friend index={kicker} scale={0.42} showNumber mood="smile" action={party ? 'hug' : null} />
          </span>
          <div className="phys-ball goal-real" ref={ballRef} aria-hidden="true" />
        </div>

        {almost && <div className="sport-almost" aria-hidden="true">{t('sport.almost')}</div>}
        <p className="sport-hint">{tAddr('goal.hint')}</p>
      </div>
    </GameShell>
  )
}
