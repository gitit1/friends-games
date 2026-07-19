import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import type { GameProps } from './registry'
import { playClack, playNudge, playPop, playSwish, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { prefersReducedMotion, randInt } from './util'
import { useT } from '../i18n'
import Confetti from '../components/Confetti'
import { useGameLevel } from '../gameLevel'

// Air hockey — drag your striker (the lower half) to knock the puck into the far
// goal. The rink is drawn in true receding perspective (converging rails, a far
// horizon); the puck & strikers ride that baked surface and shrink into the
// distance. There is no way to lose — the near wall always bounces the puck back
// and a save is a cheerful "כמעט!". A goal is celebrated and counted aloud.
//
// Physics stays in a flat top-down logical rectangle [0..w]×[0..h] (so the feel is
// exact and collisions are clean circles); ONLY rendering is projected through the
// rink trapezoid, and the finger is inverse-projected back to that plane.

// ---- rink trapezoid — MUST match the baked table.png geometry ----
const FAR_Y = 0.16
const NEAR_Y = 0.985
const FAR_HALF = 0.3
const NEAR_HALF = 0.486
const FAR_SCALE = 0.52
const persp = (t: number) => 0.36 * t * t + 0.64 * t
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

// ---- cumulative difficulty (canonical tiers 0 קל · 1 בינוני · 2 קשה · 3 אלוף) ----
// קל     = today's easy game: wide goal, slow puck, a big forgiving striker, and a
//          strong steer that pulls the puck toward the goal. No defender.
// בינוני = + a faster puck and a slightly narrower goal (posts slide in); weaker steer.
// קשה    = + a lazy defender striker drifting across the goal mouth.
// אלוף   = + the defender actively tracks the puck's column, the narrowest goal, and
//          almost no steer — a real challenge to score. Always no-fail.
const LEVEL_TIERS = [0, 1, 2, 3]
// striker radius (× w) — קל is the biggest / most forgiving
const DR = [0.135, 0.122, 0.112, 0.104]
// puck pace: the speed floor it never drops below, and the cap it never exceeds (× w)
const MINSP = [0.013, 0.02, 0.027, 0.033]
const MAXSP = [0.05, 0.064, 0.077, 0.09]
// steer toward the goal centre while the puck heads up — strong at קל, nearly off at אלוף
const ASSIST = [0.011, 0.0065, 0.003, 0.001]
// goal scoring half-width (× w). Wide & forgiving at קל, narrowest at אלוף.
const GOALHALF = [0.22, 0.185, 0.155, 0.125]
// defender (קשה+): patrol speed, save half-zone (× w). קל / בינוני = none.
const PATROL = [0, 0, 0.03, 0.055]
const BLOCK = [0, 0, 0.075, 0.06]

export default function HockeyGame({ onExit }: GameProps) {
  const { t, tAddr } = useT()
  const [score, setScore] = useState(0)
  const [party, setParty] = useState(false)
  const [goalLit, setGoalLit] = useState(false)
  const [almost, setAlmost] = useState(false)
  const [level] = useGameLevel('hockey', LEVEL_TIERS)
  // spectators standing around the rink — reshuffled after each goal
  const [fans, setFans] = useState(() => [randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9)])

  const rinkRef = useRef<HTMLDivElement>(null)
  const puckRef = useRef<HTMLDivElement>(null)
  const paddleRef = useRef<HTMLDivElement>(null)
  const defRef = useRef<HTMLDivElement>(null)
  const postLRef = useRef<HTMLSpanElement>(null)
  const postRRef = useRef<HTMLSpanElement>(null)

  const size = useRef({ w: 340, h: 560 })
  const dims = useRef({ pr: 28, dr: 46, defR: 36 })
  // world state (logical, flat top-down — top y=0 is the far goal line)
  const puck = useRef({ x: 170, y: 320, vx: 2, vy: 3 })
  const paddle = useRef({ x: 170, y: 480, px: 170, py: 480 })
  const defend = useRef({ x: 170, phase: 0 })
  const scoreRef = useRef(0)
  const levelRef = useRef(level)
  const justScored = useRef(false)
  const raf = useRef(0)
  const reduced = useRef(prefersReducedMotion())
  const litTimer = useRef(0)

  // ---- perspective projection (logical → screen) ----
  const proj = (lx: number, ly: number) => {
    const { w, h } = size.current
    const e = persp(clamp(ly / h, 0, 1))
    const sy = h * FAR_Y + h * (NEAR_Y - FAR_Y) * e
    const half = w * (FAR_HALF + (NEAR_HALF - FAR_HALF) * e)
    const sx = w / 2 + ((lx / w) * 2 - 1) * half
    return { sx, sy, scale: FAR_SCALE + (1 - FAR_SCALE) * e }
  }
  // inverse (screen → logical) for the finger drag
  const unproj = (sx: number, sy: number) => {
    const { w, h } = size.current
    const e = clamp((sy / h - FAR_Y) / (NEAR_Y - FAR_Y), 0, 1)
    const tt = (-0.64 + Math.sqrt(0.4096 + 1.44 * e)) / 0.72
    const half = w * (FAR_HALF + (NEAR_HALF - FAR_HALF) * e)
    const u = (sx - w / 2) / half
    return { lx: ((u + 1) / 2) * w, ly: tt * h }
  }

  // striker/puck radii depend on w AND level — recompute + resize the sprites
  const applySizes = () => {
    const { w } = size.current
    const pr = Math.max(16, w * 0.085)
    const dr = Math.max(22, w * DR[levelRef.current])
    const defR = Math.max(20, w * 0.11)
    dims.current = { pr, dr, defR }
    if (puckRef.current) {
      puckRef.current.style.width = `${pr * 2}px`
      puckRef.current.style.height = `${pr * 2}px`
    }
    if (paddleRef.current) {
      paddleRef.current.style.width = `${dr * 2}px`
      paddleRef.current.style.height = `${dr * 2}px`
    }
    if (defRef.current) {
      defRef.current.style.width = `${defR * 2}px`
      defRef.current.style.height = `${defR * 2}px`
    }
  }
  // the goal-narrowing posts sit at the current goal edges on the far rail
  const placePosts = () => {
    const { w } = size.current
    const gh = w * GOALHALF[levelRef.current]
    const lvl = levelRef.current
    for (const [ref, lx] of [
      [postLRef, w / 2 - gh],
      [postRRef, w / 2 + gh],
    ] as const) {
      const el = ref.current
      if (!el) continue
      const p = proj(lx, 0)
      // only show once the goal is narrower than the baked (קל) mouth
      el.style.opacity = lvl >= 1 ? '1' : '0'
      el.style.transform = `translate(${p.sx}px, ${p.sy}px) translate(-50%, -60%) scale(${p.scale})`
    }
  }

  const drawPuck = () => {
    const p = proj(puck.current.x, puck.current.y)
    const pr = dims.current.pr
    if (puckRef.current)
      puckRef.current.style.transform = `translate(${p.sx - pr}px, ${p.sy - pr}px) scale(${p.scale})`
  }
  const drawPaddle = () => {
    const p = proj(paddle.current.x, paddle.current.y)
    const dr = dims.current.dr
    if (paddleRef.current)
      paddleRef.current.style.transform = `translate(${p.sx - dr}px, ${p.sy - dr}px) scale(${p.scale})`
  }
  const drawDefender = () => {
    const { h } = size.current
    const p = proj(defend.current.x, h * 0.07)
    const defR = dims.current.defR
    if (defRef.current)
      defRef.current.style.transform = `translate(${p.sx - defR}px, ${p.sy - defR}px) scale(${p.scale})`
  }

  // put a fresh puck in the middle, drifting down toward the player
  const serve = () => {
    const { w, h } = size.current
    const p = puck.current
    p.x = w / 2
    p.y = h * 0.5
    p.vx = (Math.random() - 0.5) * w * 0.02
    p.vy = w * 0.02
    justScored.current = false
  }

  useEffect(() => {
    const rink = rinkRef.current
    if (!rink) return
    reduced.current = prefersReducedMotion()
    const measure = () => {
      const r = rink.getBoundingClientRect()
      size.current = { w: r.width, h: r.height }
      applySizes()
      const pr = dims.current.pr
      const p = puck.current
      p.x = clamp(p.x, pr, r.width - pr)
      p.y = clamp(p.y, pr, r.height - pr)
      paddle.current.y = clamp(paddle.current.y, r.height * 0.55, r.height - dims.current.dr)
      paddle.current.x = clamp(paddle.current.x, dims.current.dr, r.width - dims.current.dr)
      placePosts()
      drawPuck()
      drawPaddle()
      drawDefender()
    }
    measure()
    window.addEventListener('resize', measure)

    const step = () => {
      const { w, h } = size.current
      const lvl = levelRef.current
      const { pr, dr } = dims.current
      const p = puck.current
      const gh = w * GOALHALF[lvl]
      const defLy = h * 0.07

      // ---- defender (קשה+) ----
      const d = defend.current
      const defActive = lvl >= 2
      if (defActive) {
        const gentle = reduced.current ? 0.7 : 1
        d.phase += PATROL[lvl] * gentle
        let dx = w / 2 + Math.sin(d.phase) * gh * 0.78
        // אלוף: read the puck's column and slide under it
        if (lvl >= 3) dx += (p.x - dx) * 0.06 * gentle
        d.x = clamp(dx, w / 2 - gh, w / 2 + gh)
        drawDefender()
      }

      // ---- puck integrate ----
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.994 // low-friction ice glide
      p.vy *= 0.994
      // steer toward the goal while heading up (kid-friendly aim-assist)
      if (p.vy < 0) p.vx += (w / 2 - p.x) * ASSIST[lvl]
      // keep it alive at the level's pace; cap the top speed
      let sp = Math.hypot(p.vx, p.vy)
      const minsp = w * MINSP[lvl]
      const maxsp = w * MAXSP[lvl]
      if (sp < minsp) {
        const a = Math.atan2(p.vy || 1, p.vx || 0)
        p.vx = Math.cos(a) * minsp
        p.vy = Math.sin(a) * minsp
        sp = minsp
      } else if (sp > maxsp) {
        p.vx = (p.vx / sp) * maxsp
        p.vy = (p.vy / sp) * maxsp
      }

      // side + bottom walls bounce with a soft clack (the near wall never lets you lose)
      if (p.x - pr < 0) {
        p.x = pr
        p.vx = Math.abs(p.vx)
        playClack(Math.abs(p.vx) / maxsp)
      } else if (p.x + pr > w) {
        p.x = w - pr
        p.vx = -Math.abs(p.vx)
        playClack(Math.abs(p.vx) / maxsp)
      }
      if (p.y + pr > h) {
        p.y = h - pr
        p.vy = -Math.abs(p.vy)
        playClack(Math.abs(p.vy) / maxsp)
      }

      // defender save — a happy block, a cheerful "כמעט!", the puck comes back down
      if (!justScored.current && defActive && p.vy < 0 && p.y - pr <= defLy + dims.current.defR * 0.5) {
        if (Math.abs(p.x - d.x) < w * BLOCK[lvl] + pr) {
          p.y = defLy + dims.current.defR * 0.5 + pr
          p.vy = Math.abs(p.vy) * 0.7
          playNudge()
          setAlmost(true)
          window.setTimeout(() => setAlmost(false), 1200)
        }
      }

      // far goal line: a goal in the middle, else bounce off the far boards
      if (!justScored.current && p.y - pr < 0) {
        if (Math.abs(p.x - w / 2) < gh) {
          justScored.current = true
          scoreRef.current += 1
          setScore(scoreRef.current)
          playWin()
          playSwish()
          speakNumber(scoreRef.current)
          setParty(true)
          setGoalLit(true)
          window.setTimeout(() => setParty(false), 2200)
          window.clearTimeout(litTimer.current)
          litTimer.current = window.setTimeout(() => setGoalLit(false), 800)
          // the puck sails up into the mouth, then a fresh serve
          p.vx = (w / 2 - p.x) * 0.2
          p.vy = -Math.abs(p.vy) - w * 0.01
          window.setTimeout(() => {
            serve()
            setFans([randInt(0, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9)])
          }, 520)
        } else {
          p.y = pr
          p.vy = Math.abs(p.vy)
          playClack(Math.abs(p.vy) / maxsp)
        }
      }
      // after a goal the puck flies up & out — park it above the rink until serve()
      if (justScored.current && p.y + pr < 0) {
        p.vx = 0
        p.vy = 0
      }

      // ---- striker collision (logical circle test — exact feel) ----
      const pad = paddle.current
      const cdx = p.x - pad.x
      const cdy = p.y - pad.y
      const dist = Math.hypot(cdx, cdy)
      const minD = pr + dr
      if (!justScored.current && dist < minD && dist > 0.01) {
        const nx = cdx / dist
        const ny = cdy / dist
        p.x = pad.x + nx * minD
        p.y = pad.y + ny * minD
        const swing = Math.hypot(pad.x - pad.px, pad.y - pad.py)
        const boost = clamp(Math.max(w * 0.03, swing), 0, maxsp)
        p.vx = nx * boost
        p.vy = ny * boost
        playPop()
      }
      pad.px = pad.x
      pad.py = pad.y

      drawPuck()
      drawPaddle()
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(litTimer.current)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // header level switch: the loop reads levelRef every frame; also resize the
  // striker and reposition the goal posts for the new level.
  useEffect(() => {
    levelRef.current = level
    applySizes()
    placePosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function movePaddle(e: React.PointerEvent) {
    unlockAudio()
    const rink = rinkRef.current
    if (!rink) return
    const r = rink.getBoundingClientRect()
    const { lx, ly } = unproj(e.clientX - r.left, e.clientY - r.top)
    const { w, h } = size.current
    const dr = dims.current.dr
    // the striker stays in the lower (near) half of the rink
    paddle.current.x = clamp(lx, dr, w - dr)
    paddle.current.y = clamp(ly, h * 0.55, h - dr * 0.4)
  }
  function onDown(e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    movePaddle(e)
  }

  return (
    <GameShell title={t('game.hockey')} emoji="🏒" onExit={onExit} levels={{ gameId: 'hockey', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="sport-screen">
        <div className="sport-score" aria-live="polite">
          <span aria-hidden="true">🏒</span> {score}
        </div>

        <div
          className="phys-court hockey-rink2"
          ref={rinkRef}
          onPointerDown={onDown}
          onPointerMove={movePaddle}
          style={{ touchAction: 'none' }}
        >
          {/* gentle ambient life — one very slow ice-glare sheen drifting across the
              surface (transform-only CSS keyframe, frozen under reduce-motion). */}
          <div className="court-ambient" aria-hidden="true">
            <span className="court-drift" />
          </div>

          {/* spectators standing around the rink, on the floor beside the boards —
              grounded (friend contact shadow), feet inside the frame. The nearest
              one carries the number. They cheer on a goal. */}
          <span className="hockey-fan l1" aria-hidden="true">
            <Friend index={fans[0]} scale={0.3} showNumber mood="smile" action={party ? 'hug' : null} bouncing={party} />
          </span>
          <span className="hockey-fan r1" aria-hidden="true">
            <Friend index={fans[1]} scale={0.3} showNumber={false} mood="smile" action={party ? 'hug' : null} bouncing={party} />
          </span>
          <span className="hockey-fan l2" aria-hidden="true">
            <Friend index={fans[2]} scale={0.21} showNumber={false} mood="smile" action={party ? 'hug' : null} bouncing={party} />
          </span>
          <span className="hockey-fan r2" aria-hidden="true">
            <Friend index={fans[3]} scale={0.21} showNumber={false} mood="smile" action={party ? 'hug' : null} bouncing={party} />
          </span>

          {/* the goal mouth light — flashes on a goal */}
          <span className={`hockey-goal-flash ${goalLit ? 'is-lit' : ''}`} aria-hidden="true" />
          {/* goal-narrowing posts (slide in at בינוני+) */}
          <span className="hockey-post" ref={postLRef} aria-hidden="true" />
          <span className="hockey-post" ref={postRRef} aria-hidden="true" />

          {/* defender striker (קשה+) — patrols / tracks the goal mouth */}
          <div className={`hockey-mallet def ${level >= 2 ? '' : 'is-hidden'}`} ref={defRef} aria-hidden="true" />
          {/* puck + the player's striker */}
          <div className="hockey-puck2" ref={puckRef} aria-hidden="true" />
          <div className="hockey-mallet" ref={paddleRef} aria-hidden="true" />
        </div>

        {almost && <div className="sport-almost" aria-hidden="true">{t('sport.almost')}</div>}
        <p className="sport-hint">{tAddr('hockey.hint')}</p>
      </div>
    </GameShell>
  )
}
