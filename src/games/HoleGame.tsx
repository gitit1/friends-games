import { useEffect, useMemo, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import { playMunch, playPop, playWin, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { useT } from '../i18n'
import { useSettings } from '../settings'
import type { GameProps } from './registry'

// "בולעים הכול" — a calm, no-fail, no-timer Hole.io for the spectrum, done with a
// 2.5D look: a BIG world the camera follows (distances), objects arranged in tidy
// STACKS/PYRAMIDS, the swallower a flat black ELLIPSE (or a distinct creature), a
// juicy wobble→tip→suck swallow, and a clear GOAL — a checklist of marked targets
// to collect ("🍎×5 🚗×3"). Eat them all → celebrate → next, harder level. The
// size climbs as a number, and you grow to reach bigger targets.

type SwId = 'hole' | 'frog' | 'monster' | 'cat'
const SWALLOWERS: { id: SwId; color: string }[] = [
  { id: 'hole', color: '#15151c' },
  { id: 'frog', color: '#46c552' },
  { id: 'monster', color: '#8b5cf6' },
  { id: 'cat', color: '#fb923c' },
]

type Kind = { e: string; t: number } // emoji + size tier
type Theme = { id: string; ground: string; tile: string; kinds: Kind[] }
const THEMES: Theme[] = [
  { id: 'park', ground: '#86d99e', tile: 'rgba(255,255,255,.10)',
    kinds: [{ e: '🌼', t: 1 }, { e: '🐞', t: 1 }, { e: '🍓', t: 1 }, { e: '🍎', t: 2 }, { e: '🐤', t: 2 }, { e: '🎈', t: 2 }, { e: '🌳', t: 3 }, { e: '🐶', t: 3 }, { e: '🏠', t: 4 }] },
  { id: 'city', ground: '#aab8c8', tile: 'rgba(0,0,0,.06)',
    kinds: [{ e: '🔵', t: 1 }, { e: '🚦', t: 1 }, { e: '🧊', t: 1 }, { e: '🛵', t: 2 }, { e: '🐈', t: 2 }, { e: '📦', t: 2 }, { e: '🚗', t: 3 }, { e: '🌳', t: 3 }, { e: '🚌', t: 4 }] },
  { id: 'beach', ground: '#f4e2b0', tile: 'rgba(255,255,255,.14)',
    kinds: [{ e: '🐚', t: 1 }, { e: '⭐', t: 1 }, { e: '🦀', t: 1 }, { e: '🏐', t: 2 }, { e: '🐠', t: 2 }, { e: '🪼', t: 2 }, { e: '🐢', t: 3 }, { e: '🏖️', t: 3 }, { e: '⛵', t: 4 }] },
  { id: 'farm', ground: '#bfe07a', tile: 'rgba(0,0,0,.05)',
    kinds: [{ e: '🌾', t: 1 }, { e: '🐛', t: 1 }, { e: '🥚', t: 1 }, { e: '🐔', t: 2 }, { e: '🥕', t: 2 }, { e: '🐇', t: 2 }, { e: '🐑', t: 3 }, { e: '🌳', t: 3 }, { e: '🐄', t: 4 }] },
  { id: 'space', ground: '#241d3f', tile: 'rgba(255,255,255,.07)',
    kinds: [{ e: '⭐', t: 1 }, { e: '☄️', t: 1 }, { e: '✨', t: 1 }, { e: '🛰️', t: 2 }, { e: '👽', t: 2 }, { e: '🌙', t: 2 }, { e: '🚀', t: 3 }, { e: '🪐', t: 3 }, { e: '🛸', t: 4 }] },
  { id: 'candy', ground: '#ffd1e8', tile: 'rgba(255,255,255,.18)',
    kinds: [{ e: '🍬', t: 1 }, { e: '🫐', t: 1 }, { e: '🍒', t: 1 }, { e: '🍪', t: 2 }, { e: '🧁', t: 2 }, { e: '🍩', t: 2 }, { e: '🍰', t: 3 }, { e: '🍦', t: 3 }, { e: '🎂', t: 4 }] },
]

type Obj = { id: number; nx: number; ny: number; tier: number; e: string; target: boolean; eaten: boolean }
type Target = { e: string; tier: number; need: number; got: number }
type Level = { objects: Obj[]; targets: Target[]; theme: Theme; scale: number; maxTier: number }

let _oid = 0
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }

// build a tidy PILE (pyramid/row/blob) of one kind at a cluster centre
function pileAt(cx: number, cy: number, kind: Kind, count: number, target: boolean, out: Obj[]) {
  const gap = 0.045
  const cols = Math.ceil(Math.sqrt(count))
  let placed = 0
  for (let r = 0; r < cols && placed < count; r++) {
    const inRow = Math.min(cols - r, count - placed) // shrinking rows → pyramid feel
    for (let c = 0; c < inRow; c++) {
      const nx = cx + (c - (inRow - 1) / 2) * gap
      const ny = cy + (r - (cols - 1) / 2) * gap
      out.push({ id: _oid++, nx: Math.max(0.04, Math.min(0.96, nx)), ny: Math.max(0.04, Math.min(0.96, ny)), tier: kind.t, e: kind.e, target, eaten: false })
      placed++
    }
  }
}

function buildLevel(n: number): Level {
  const theme = THEMES[(n - 1) % THEMES.length]
  const scale = Math.min(4.2, 2.4 + n * 0.08) // a big world → real distance to travel
  const maxTier = Math.min(4, 2 + Math.floor((n - 1) / 5))
  const kinds = theme.kinds.filter((k) => k.t <= maxTier)
  // pick target kinds (1..3, grows with level), each with a small required count
  const nTargets = Math.min(3, 1 + Math.floor((n - 1) / 3))
  const shuffled = [...kinds].sort(() => Math.random() - 0.5)
  const targetKinds = shuffled.slice(0, nTargets)
  const targets: Target[] = targetKinds.map((k) => ({ e: k.e, tier: k.t, need: 3 + Math.floor(n / 4) + k.t, got: 0 }))

  const objects: Obj[] = []
  // a spaced grid of cluster slots across the (big) world
  const slotsX = 4, slotsY = 5
  const slots: { x: number; y: number }[] = []
  for (let y = 0; y < slotsY; y++) for (let x = 0; x < slotsX; x++)
    slots.push({ x: (x + 0.5) / slotsX + (Math.random() - 0.5) * 0.06, y: (y + 0.5) / slotsY + (Math.random() - 0.5) * 0.06 })
  slots.sort(() => Math.random() - 0.5)

  let si = 0
  // 1) target piles — enough of each target kind to satisfy `need`
  for (const tk of targetKinds) {
    const tgt = targets.find((t) => t.e === tk.e)!
    let remaining = tgt.need
    while (remaining > 0 && si < slots.length) {
      const c = Math.min(6, remaining)
      const s = slots[si++]
      pileAt(s.x, s.y, tk, c, true, objects)
      remaining -= c
    }
  }
  // 2) lots of small filler piles so you can always GROW to reach the targets
  while (si < slots.length) {
    const s = slots[si++]
    const lowKinds = kinds.filter((k) => k.t <= Math.max(1, maxTier - 1))
    pileAt(s.x, s.y, pick(lowKinds.length ? lowKinds : kinds), 3 + Math.floor(Math.random() * 4), false, objects)
  }
  return { objects, targets, theme, scale, maxTier }
}

const GROW_EVERY = 3

export default function HoleGame({ onExit }: GameProps) {
  const { t } = useT()
  const { reduceMotion } = useSettings()
  const [sw, setSw] = useState<SwId | null>(null)
  const [level, setLevel] = useState(1)
  const [size, setSize] = useState(0)
  const [targets, setTargets] = useState<Target[]>([])
  const [done, setDone] = useState(false)
  const [party, setParty] = useState(false)

  const fieldRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)
  const view = useRef({ w: 360, h: 460 })
  const holeN = useRef({ x: 0.5, y: 0.5 }) // normalized world coords
  const fingerN = useRef({ x: 0.5, y: 0.5 })
  const tier = useRef(1)
  const count = useRef(0)
  const sizeRef = useRef(0)
  const objsRef = useRef<Obj[]>([])
  const targetsRef = useRef<Target[]>([])
  const [, force] = useState(0)

  const built = useMemo(() => (sw ? buildLevel(level) : null), [sw, level])
  useEffect(() => {
    if (!built) return
    objsRef.current = built.objects
    targetsRef.current = built.targets.map((x) => ({ ...x }))
    tier.current = 1
    count.current = 0
    sizeRef.current = 0
    holeN.current = { x: 0.5, y: 0.5 }
    fingerN.current = { x: 0.5, y: 0.5 }
    setSize(0)
    setTargets(targetsRef.current.map((x) => ({ ...x })))
    setDone(false)
    setParty(false)
    force((v) => v + 1)
  }, [built])

  useEffect(() => {
    if (!sw || !built) return
    const f = fieldRef.current
    if (!f) return
    const measure = () => {
      const r = f.getBoundingClientRect()
      view.current = { w: r.width, h: r.height }
    }
    measure()
    window.addEventListener('resize', measure)
    const scale = built.scale

    let raf = 0
    const stepLoop = () => {
      const { w: vw, h: vh } = view.current
      const Ww = vw * scale
      const Wh = vh * scale
      const R = Math.min(vw * 0.22, vw * (0.085 + tier.current * 0.032 + count.current * 0.0016)) // px radius
      const z = Math.max(0.55, 1 - (tier.current - 1) * 0.07 - count.current * 0.004) // camera zooms OUT as you grow
      // chase the finger — slow, deliberate (tactile, calm), a touch faster as you grow
      const hx = holeN.current.x * Ww
      const hy = holeN.current.y * Wh
      const fx = fingerN.current.x * Ww
      const fy = fingerN.current.y * Wh
      const dx = fx - hx, dy = fy - hy
      const d = Math.hypot(dx, dy)
      const spd = vw * (0.011 + tier.current * 0.0012)
      let nhx = hx, nhy = hy
      if (d > 3) { const s = Math.min(d, spd); nhx = hx + (dx / d) * s; nhy = hy + (dy / d) * s }
      holeN.current = { x: Math.max(0, Math.min(1, nhx / Ww)), y: Math.max(0, Math.min(1, nhy / Wh)) }
      const HX = holeN.current.x * Ww
      const HY = holeN.current.y * Wh
      // camera follows the hole; visible world span = view / z (zoom-out reveals more space)
      const visW = vw / z, visH = vh / z
      const camX = Math.max(0, Math.min(Math.max(0, Ww - visW), HX - visW / 2))
      const camY = Math.max(0, Math.min(Math.max(0, Wh - visH), HY - visH / 2))
      if (worldRef.current) {
        worldRef.current.style.width = `${Ww}px`
        worldRef.current.style.height = `${Wh}px`
        worldRef.current.style.transformOrigin = '0 0'
        worldRef.current.style.transform = `translate(${-camX * z}px, ${-camY * z}px) scale(${z})`
      }
      if (blobRef.current) {
        blobRef.current.style.width = `${R * 2}px`
        blobRef.current.style.height = `${R * 1.5}px`
        blobRef.current.style.transform = `translate(${HX - R}px, ${HY - R * 0.75}px)`
      }
      // a guide arrow to the nearest OFF-SCREEN target, so it's never lost
      if (arrowRef.current) {
        let best: { sx: number; sy: number } | null = null
        let bestD = Infinity
        for (const o of objsRef.current) {
          if (o.eaten || !o.target) continue
          const sx = (o.nx * Ww - camX) * z
          const sy = (o.ny * Wh - camY) * z
          if (sx >= 0 && sx <= vw && sy >= 0 && sy <= vh) continue // visible — no arrow needed
          const dd = Math.hypot(sx - vw / 2, sy - vh / 2)
          if (dd < bestD) { bestD = dd; best = { sx, sy } }
        }
        if (best) {
          const ang = Math.atan2(best.sy - vh / 2, best.sx - vw / 2)
          const m = 24
          const ex = vw / 2 + Math.cos(ang) * (vw / 2 - m)
          const ey = vh / 2 + Math.sin(ang) * (vh / 2 - m)
          arrowRef.current.style.display = 'flex'
          arrowRef.current.style.transform = `translate(${ex - 20}px, ${ey - 20}px) rotate(${ang}rad)`
        } else {
          arrowRef.current.style.display = 'none'
        }
      }
      // swallow
      let ate = false
      for (const o of objsRef.current) {
        if (o.eaten || o.tier > tier.current) continue
        const ox = o.nx * Ww, oy = o.ny * Wh
        if (Math.hypot(HX - ox, HY - oy) < R * 0.95) {
          o.eaten = true
          ate = true
          count.current += 1
          sizeRef.current += o.tier
          if (count.current % GROW_EVERY === 0 && tier.current < 5) tier.current += 1
          if (o.target) {
            const tg = targetsRef.current.find((x) => x.e === o.e && x.got < x.need)
            if (tg) tg.got += 1
          }
        }
      }
      if (ate) {
        playMunch()
        setSize(sizeRef.current)
        setTargets(targetsRef.current.map((x) => ({ ...x })))
        force((v) => v + 1)
        const allDone = targetsRef.current.every((x) => x.got >= x.need)
        if (allDone) {
          playWin(); speakNumber(level); setParty(true); setDone(true)
        } else if (count.current % GROW_EVERY === 0) {
          speakNumber(sizeRef.current)
        }
      }
      raf = requestAnimationFrame(stepLoop)
    }
    raf = requestAnimationFrame(stepLoop)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure) }
  }, [sw, built, level])

  function onMove(e: React.PointerEvent) {
    unlockAudio()
    const f = fieldRef.current
    if (!f || done || !built) return
    const r = f.getBoundingClientRect()
    const { w: vw, h: vh } = view.current
    const Ww = vw * built.scale, Wh = vh * built.scale
    const z = Math.max(0.55, 1 - (tier.current - 1) * 0.07 - count.current * 0.004)
    const visW = vw / z, visH = vh / z
    const HX = holeN.current.x * Ww, HY = holeN.current.y * Wh
    const camX = Math.max(0, Math.min(Math.max(0, Ww - visW), HX - visW / 2))
    const camY = Math.max(0, Math.min(Math.max(0, Wh - visH), HY - visH / 2))
    const wx = camX + (e.clientX - r.left) / z
    const wy = camY + (e.clientY - r.top) / z
    fingerN.current = { x: Math.max(0, Math.min(1, wx / Ww)), y: Math.max(0, Math.min(1, wy / Wh)) }
  }

  function nextLevel() { playPop(); setParty(false); setLevel((n) => n + 1) }

  // ── swallower picker ──
  if (!sw) {
    return (
      <GameShell title={t('game.hole')} emoji="🕳️" onExit={onExit}>
        <p className="pet-pick-title">{t('hole.pick')}</p>
        <div className="hole-pick">
          {SWALLOWERS.map((s) => (
            <button key={s.id} className="hole-pick-btn" onClick={() => { playPop(); setSw(s.id) }}>
              <span className="sw-holder pick"><Swallower id={s.id} color={s.color} /></span>
              <span>{t(`hole.sw.${s.id}`)}</span>
            </button>
          ))}
        </div>
      </GameShell>
    )
  }

  const theme = built?.theme ?? THEMES[0]
  const swColor = SWALLOWERS.find((s) => s.id === sw)!.color
  return (
    <GameShell title={t('game.hole')} emoji="🕳️" onExit={onExit}>
      <Confetti active={party} />
      <div className="hole-hud">
        <span className="hole-level">{t('hole.level')} {level}</span>
        <span className="hole-size">📏 {size}</span>
        <span className="hole-targets">
          {targets.map((tg, i) => (
            <span key={i} className={`hole-tgt ${tg.got >= tg.need ? 'ok' : ''}`}>
              {tg.e}<b>{Math.max(0, tg.need - tg.got)}</b>
            </span>
          ))}
        </span>
      </div>

      <div
        className={`hole-field ${reduceMotion ? 'calm' : ''}`}
        ref={fieldRef}
        onPointerDown={onMove}
        onPointerMove={onMove}
        style={{ touchAction: 'none' }}
      >
        <div className="hole-world" ref={worldRef} style={{ background: theme.ground, ['--tile' as string]: theme.tile }}>
          {objsRef.current.map((o) => (
            <span
              key={o.id}
              className={`hole-obj tier-${o.tier} ${o.target ? 'is-tgt' : ''} ${o.eaten ? 'eaten' : ''}`}
              style={{ left: `${o.nx * 100}%`, top: `${o.ny * 100}%` }}
            >
              {o.e}
            </span>
          ))}
          <div className="sw-holder field" ref={blobRef}>
            <Swallower id={sw} color={swColor} />
          </div>
        </div>

        <div className="hole-arrow" ref={arrowRef} aria-hidden="true"><span className="arr-tip" /></div>

        {done && (
          <div className="hole-done">
            <p>🎉 {t('hole.done')}</p>
            <button className="big-button" onClick={nextLevel}>➡️ {t('hole.next')}</button>
          </div>
        )}
      </div>

      <p className="sport-hint">{t('hole.hint')}</p>
    </GameShell>
  )
}

// a distinct swallower: a flat ellipse "mouth" + features unique to each one
function Swallower({ id, color }: { id: SwId; color: string }) {
  return (
    <span className={`sw sw-${id}`} style={{ ['--c' as string]: color }}>
      {id === 'frog' && (<><span className="sw-eye l" /><span className="sw-eye r" /></>)}
      {id === 'monster' && (<><span className="sw-horn l" /><span className="sw-horn r" /><span className="sw-teeth" /></>)}
      {id === 'cat' && (<><span className="sw-ear l" /><span className="sw-ear r" /><span className="sw-whisk wl" /><span className="sw-whisk wr" /></>)}
    </span>
  )
}
