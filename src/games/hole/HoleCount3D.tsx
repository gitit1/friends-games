import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import GameShell from '../../components/GameShell'
import Confetti from '../../components/Confetti'
import { playCount, playMunch, playNudge, playPop, playSuccess, playWin, unlockAudio } from '../../audio'
import { speakNumber, playClip } from '../../voice'
import { useT, sayTextFor, getLang } from '../../i18n'
import { useSettings } from '../../settings'
import { mergeProp, numberBlock, type World } from './world'
import { markCountDone } from '../../holeProgress'

// "בולעים וסופרים" — a calm counting activity inside the 3D hole world. A gentle
// arc of numbered blocks sits on the road; the child swallows them IN ORDER. The
// next correct block glows softly (slow) — the rest are "too heavy" and only give
// a tiny wiggle if bumped (errorless, nothing negative). Each swallow speaks the
// number, climbs a musical note, and grows the hole a little (the same eased path
// as the main mode). Four difficulty variants: 1–5, 1–10, skip-count 2..20, or
// 10..1 descending. Fully separate from the main play mode — that stays untouched.

// the four counting rows (0 קל · 1 בינוני · 2 קשה · 3 אלוף)
const SEQS: number[][] = [
  [1, 2, 3, 4, 5],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
  [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
]
// calm, MUTED block colours (no neon) — one per position along the row
const BLOCK_COLORS = ['#d98c8c', '#d9a97b', '#d9c979', '#a9cf8c', '#7fc0b0', '#7fa6d0', '#9a94d0', '#c48fbf', '#cf8fa0', '#8fb0c0']

type Props = { world: World; difficulty: number; sw: string; swColor: string; onExit: () => void }

export default function HoleCount3D({ world, difficulty, sw, swColor, onExit }: Props) {
  const { t } = useT()
  const { reduceMotion } = useSettings()
  const seq = SEQS[Math.max(0, Math.min(SEQS.length - 1, difficulty))]

  const [runId, setRunId] = useState(0) // "again" bumps this → the effect rebuilds a fresh row
  const [done, setDone] = useState(0) // how many swallowed (drives the HUD)
  const [finished, setFinished] = useState(false)
  const [party, setParty] = useState(false)
  const mountRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = () => mount.clientWidth || 360
    const H = () => mount.clientHeight || 480
    doneRef.current = false
    setDone(0); setFinished(false); setParty(false)

    const scene = new THREE.Scene()
    // soft vertical-gradient sky (matches the main mode's "reads as a place" look)
    const skyCv = document.createElement('canvas'); skyCv.width = 8; skyCv.height = 256
    const skyCx = skyCv.getContext('2d')!
    const skyTop = new THREE.Color(world.sky).multiplyScalar(0.82)
    const skyBot = new THREE.Color(world.sky).lerp(new THREE.Color(0xffffff), 0.32)
    const skyGrad = skyCx.createLinearGradient(0, 0, 0, 256)
    skyGrad.addColorStop(0, `#${skyTop.getHexString()}`); skyGrad.addColorStop(1, `#${skyBot.getHexString()}`)
    skyCx.fillStyle = skyGrad; skyCx.fillRect(0, 0, 8, 256)
    const skyTex = new THREE.CanvasTexture(skyCv)
    scene.background = skyTex

    const bound = 30
    scene.fog = new THREE.Fog(world.sky, bound * 2.4, bound * 5)
    const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 600)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W(), H())
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    scene.add(new THREE.HemisphereLight(new THREE.Color(world.sky), new THREE.Color(world.ground), 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(20, 40, 18); scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.28); fill.position.set(-20, 14, -10); scene.add(fill)

    // a bounded island disc + shore + sea = the calm "place" (no gates here)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(bound * 10, bound * 10), new THREE.MeshLambertMaterial({ color: 0x3a90d0 }))
    water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(bound, 72), new THREE.MeshLambertMaterial({ color: world.ground }))
    ground.rotation.x = -Math.PI / 2; scene.add(ground)
    const shore = new THREE.Mesh(new THREE.RingGeometry(bound - 1.4, bound + 0.2, 72), new THREE.MeshLambertMaterial({ color: new THREE.Color(world.ground).lerp(new THREE.Color(0xe9dfae), 0.5) }))
    shore.rotation.x = -Math.PI / 2; shore.position.y = 0.02; scene.add(shore)
    // a gentle road arc under the blocks (a darker ground ribbon leading across)
    const roadCol = new THREE.Color(world.ground).multiplyScalar(0.72)

    // ---- the numbered blocks, laid out in a gentle arc across the front ----
    const N = seq.length
    const gap = 2.8
    const spanX = gap * (N - 1)
    type Block = { grp: THREE.Group; x: number; z: number; n: number; idx: number; captured: boolean; capT: number; dead: boolean; wiggle: number; wCd: number }
    const blocks: Block[] = seq.map((n, i) => {
      const fx = N > 1 ? i / (N - 1) : 0.5
      const x = -spanX / 2 + fx * spanX
      const z = -7 - Math.cos((fx - 0.5) * Math.PI) * 4 // a soft rainbow bow away from the camera
      const g = mergeProp(numberBlock(n, BLOCK_COLORS[i % BLOCK_COLORS.length]))
      g.position.set(x, 0, z)
      scene.add(g)
      return { grp: g, x, z, n, idx: i, captured: false, capT: 0, dead: false, wiggle: 0, wCd: 0 }
    })
    // a thin road ribbon following the arc so the row reads as a path
    const roadPts = blocks.map((b) => new THREE.Vector3(b.x, 0, b.z))
    if (roadPts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 2), ...roadPts])
      const roadMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 1.5, 6, false), new THREE.MeshLambertMaterial({ color: roadCol }))
      roadMesh.scale.y = 0.02; roadMesh.position.y = 0.03; scene.add(roadMesh)
    }

    // a single SOFT GLOW disc, moved under whichever block is next — the calm
    // "this one" cue (slow opacity pulse, no flash). Its own material, so nothing
    // shared is touched.
    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128
    const gx = glowCv.getContext('2d')!
    const gGrad = gx.createRadialGradient(64, 64, 4, 64, 64, 64)
    gGrad.addColorStop(0, 'rgba(255,236,180,0.95)'); gGrad.addColorStop(0.6, 'rgba(255,214,120,0.45)'); gGrad.addColorStop(1, 'rgba(255,214,120,0)')
    gx.fillStyle = gGrad; gx.beginPath(); gx.arc(64, 64, 64, 0, 6.283); gx.fill()
    const glowTex = new THREE.CanvasTexture(glowCv)
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
    const glow = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), glowMat)
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; scene.add(glow)

    // the swallower — same pit look as the main mode (creature optional)
    const hole = new THREE.Group()
    const pitCv = document.createElement('canvas'); pitCv.width = pitCv.height = 128
    const pitCx = pitCv.getContext('2d')!
    const pitGrad = pitCx.createRadialGradient(64, 64, 3, 64, 64, 64)
    pitGrad.addColorStop(0, '#04040a'); pitGrad.addColorStop(0.55, '#0a0a12'); pitGrad.addColorStop(0.86, '#15151f'); pitGrad.addColorStop(1, '#22222e')
    pitCx.fillStyle = pitGrad; pitCx.beginPath(); pitCx.arc(64, 64, 64, 0, 6.283); pitCx.fill()
    const pitTex = new THREE.CanvasTexture(pitCv)
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: pitTex }))
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; hole.add(disc)
    const innerRim = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.99, 48), new THREE.MeshBasicMaterial({ color: 0x02020a }))
    innerRim.rotation.x = -Math.PI / 2; innerRim.position.y = 0.055; hole.add(innerRim)
    if (sw !== 'hole') {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 10, 36), new THREE.MeshLambertMaterial({ color: swColor }))
      rim.rotation.x = -Math.PI / 2; rim.position.y = 0.12; hole.add(rim)
      for (const sx of [-0.5, 0.5]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshLambertMaterial({ color: 0xffffff })); eye.position.set(sx, 0.7, -0.7); hole.add(eye)
        const pup = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0x16210f })); pup.position.set(sx, 0.72, -0.95); hole.add(pup)
      }
      if (sw === 'cat' || sw === 'monster') for (const sx of [-0.6, 0.6]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 4), new THREE.MeshLambertMaterial({ color: sw === 'monster' ? '#f4d35e' : swColor })); ear.position.set(sx, 1.0, -0.6); hole.add(ear)
      }
    }
    scene.add(hole)

    // soft dust poof + a calm bubble column (same cheap Points pool as the main mode)
    const PMAX = 96
    const pPos = new Float32Array(PMAX * 3).fill(-999)
    const pState = Array.from({ length: PMAX }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, g: 4 }))
    const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    const pcv = document.createElement('canvas'); pcv.width = pcv.height = 32
    const pcx = pcv.getContext('2d')!; const pgrad = pcx.createRadialGradient(16, 16, 0, 16, 16, 16)
    pgrad.addColorStop(0, 'rgba(255,255,255,0.95)'); pgrad.addColorStop(1, 'rgba(255,255,255,0)')
    pcx.fillStyle = pgrad; pcx.beginPath(); pcx.arc(16, 16, 16, 0, 6.283); pcx.fill()
    const ptex = new THREE.CanvasTexture(pcv)
    const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xfff4fb, size: 0.5, map: ptex, transparent: true, opacity: 0.7, depthWrite: false }))
    points.frustumCulled = false; scene.add(points)
    let pHead = 0
    const poof = (x: number, z: number) => { for (let k = 0; k < 7; k++) { const i = pHead++ % PMAX, a = Math.random() * 6.28, s = 1 + Math.random() * 2.2; pState[i] = { life: 0.5, vx: Math.cos(a) * s, vy: 1.4 + Math.random() * 2, vz: Math.sin(a) * s, g: 4 }; pPos[i * 3] = x; pPos[i * 3 + 1] = 0.3; pPos[i * 3 + 2] = z } }
    const bubbles = (x: number, z: number) => { for (let k = 0; k < 16; k++) { const i = pHead++ % PMAX, a = Math.random() * 6.28, rr = Math.random() * 0.5; pState[i] = { life: 1.4 + Math.random() * 0.6, vx: Math.cos(a) * 0.25, vy: 0.8 + Math.random() * 0.7, vz: Math.sin(a) * 0.25, g: -0.6 }; pPos[i * 3] = x + Math.cos(a) * rr; pPos[i * 3 + 1] = 0.3; pPos[i * 3 + 2] = z + Math.sin(a) * rr } }

    const pos = { x: 0, z: 0 }
    const targetPos = { x: 0, z: 0 }
    let R = 1.4, targetR = 1.4, combo = 0, lastEat = -1, squash = 0, gulp = 0
    let velX = 0, velZ = 0
    let nextIdx = 0 // the block that's currently correct to swallow
    const BLOCK_SIZE = 1.5

    const smoothDamp = (cur: number, target: number, vel: number, smoothTime: number, maxSpeed: number, dt: number): [number, number] => {
      const omega = 2 / smoothTime
      const x = omega * dt
      const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
      let change = cur - target
      const maxChange = maxSpeed * smoothTime
      change = Math.max(-maxChange, Math.min(maxChange, change))
      const t2 = cur - change
      const temp = (vel + omega * change) * dt
      let nv = (vel - omega * temp) * exp
      let out = t2 + (change + temp) * exp
      if ((target - cur > 0) === (out > target)) { out = target; nv = (out - target) / dt }
      return [out, nv]
    }
    const camPos = new THREE.Vector3(0, 9 + R * 2.0, 9 + R * 1.85)
    camera.position.copy(camPos)

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const el = renderer.domElement
    const onPointer = (e: PointerEvent) => {
      unlockAudio()
      const r = el.getBoundingClientRect()
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(plane, hit)) { targetPos.x = hit.x; targetPos.z = hit.z }
    }
    el.addEventListener('pointerdown', onPointer)
    el.addEventListener('pointermove', onPointer)
    el.style.touchAction = 'none'

    const clock = new THREE.Clock()
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, clock.getDelta())
      R += (targetR - R) * (1 - Math.exp(-6 * dt))

      const maxDist = bound - 1.2
      let tx = targetPos.x, tz = targetPos.z
      const tdc = Math.hypot(tx, tz)
      if (tdc > maxDist) { tx *= maxDist / tdc; tz *= maxDist / tdc }
      const maxSpd = 3.4 + R * 0.35
      ;[pos.x, velX] = smoothDamp(pos.x, tx, velX, 0.26, maxSpd, dt)
      ;[pos.z, velZ] = smoothDamp(pos.z, tz, velZ, 0.26, maxSpd, dt)
      const dc = Math.hypot(pos.x, pos.z)
      if (dc > maxDist) { pos.x *= maxDist / dc; pos.z *= maxDist / dc }
      squash = Math.max(0, squash - dt * 4)
      gulp = Math.max(0, gulp - dt * 5)
      hole.position.set(pos.x, 0, pos.z)
      const hs = 1 + squash * 0.1 + gulp * 0.06
      hole.scale.set(R * hs, R * (1 + gulp * 0.03), R * hs)

      // the active (next) block: park the soft glow under it and give it a slow,
      // calm scale pulse. If everything's swallowed, hide the glow.
      const active = blocks.find((b) => b.idx === nextIdx && !b.dead) ?? null
      if (active) {
        glow.visible = true
        glow.position.set(active.x, 0.06, active.z)
        const pulse = reduceMotion ? 0.5 : 0.34 + 0.22 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2))
        glowMat.opacity = pulse
      } else {
        glow.visible = false
      }

      let swallowed = false
      for (const b of blocks) {
        if (b.dead) continue
        const isActive = b.idx === nextIdx
        // gentle guiding pulse only on the active block (others stay calm/static)
        if (!b.captured) {
          if (isActive && !reduceMotion) { const s = 1 + 0.05 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2)); b.grp.scale.setScalar(s) }
          else if (isActive) b.grp.scale.setScalar(1)
        }
        // decay a "too heavy" wiggle
        b.wCd = Math.max(0, b.wCd - dt)
        if (b.wiggle > 0) {
          b.wiggle = Math.max(0, b.wiggle - dt)
          b.grp.rotation.z = Math.sin((0.45 - b.wiggle) * 34) * 0.13 * (b.wiggle / 0.45)
          if (b.wiggle === 0) b.grp.rotation.z = 0
        }
        if (b.captured) {
          b.capT += dt
          const fall = b.capT
          const ox = b.grp.position.x - pos.x, oz = b.grp.position.z - pos.z
          const sw = 2.0 * dt, cs = Math.cos(sw), sn = Math.sin(sw), keep = Math.exp(-10 * dt)
          b.grp.position.x = pos.x + (ox * cs - oz * sn) * keep
          b.grp.position.z = pos.z + (ox * sn + oz * cs) * keep
          b.grp.position.y -= dt * (4 + fall * 16)
          b.grp.rotation.x += dt * (3 + fall * 5); b.grp.rotation.z += dt * 3
          b.grp.scale.multiplyScalar(Math.max(0, 1 - dt * 2.1))
          if (b.grp.scale.x < 0.06 || b.grp.position.y < -3) { if (!reduceMotion) poof(pos.x, pos.z); scene.remove(b.grp); b.dead = true }
          continue
        }
        const dh = Math.hypot(pos.x - b.x, pos.z - b.z)
        const reach = R * 0.9 + 0.9
        if (dh < reach) {
          if (isActive) { b.captured = true; b.capT = 0; nextIdx += 1; swallowed = true }
          else if (b.wCd <= 0) { b.wiggle = 0.45; b.wCd = 0.9; playNudge() } // "too heavy" — errorless nudge
        }
      }

      for (let i = 0; i < PMAX; i++) { const p = pState[i]; if (p.life > 0) { p.life -= dt; pPos[i * 3] += p.vx * dt; pPos[i * 3 + 1] += p.vy * dt; pPos[i * 3 + 2] += p.vz * dt; p.vy -= dt * p.g; if (p.life <= 0) pPos[i * 3 + 1] = -999 } }
      pGeo.attributes.position.needsUpdate = true

      if (swallowed) {
        const step = nextIdx // 1-based ordinal of what we just ate
        const val = seq[nextIdx - 1]
        const now = clock.elapsedTime; combo = now - lastEat < 0.7 ? combo + 1 : 0; lastEat = now; squash = 1; gulp = 1
        targetR = Math.cbrt(targetR * targetR * targetR + BLOCK_SIZE * BLOCK_SIZE * BLOCK_SIZE * 0.35) // small eased growth
        playMunch(combo); playCount(step); speakNumber(val)
        setDone(nextIdx)
        if (nextIdx >= seq.length && !doneRef.current) {
          doneRef.current = true
          playWin(); playSuccess()
          if (!reduceMotion) bubbles(pos.x, pos.z)
          markCountDone(difficulty)
          setFinished(true); setParty(true)
          // let the final number finish, then the warm "we counted!" line
          window.setTimeout(() => playClip('hole-count-done', sayTextFor(getLang(), 'hole.count.done')), 850)
        }
      }

      const dist = 9 + R * 1.85, height = 9 + R * 2.0
      const csp = Math.hypot(velX, velZ)
      const fx = pos.x + (csp > 0.01 ? (velX / csp) * 0.4 : 0), fz = pos.z + (csp > 0.01 ? (velZ / csp) * 0.4 : 0)
      const camK = 1 - Math.exp(-6 * dt)
      camPos.x += (fx - camPos.x) * camK
      camPos.y += (height - camPos.y) * camK
      camPos.z += (fz + dist - camPos.z) * camK
      camera.position.copy(camPos); camera.lookAt(fx, 0, fz)

      renderer.render(scene, camera)
    }
    frame()

    const onResize = () => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()) }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', onResize)
      el.removeEventListener('pointerdown', onPointer); el.removeEventListener('pointermove', onPointer)
      // dispose per-level resources but NEVER shared cached geometry/materials
      const killMat = (x: THREE.Material) => {
        const map = (x as THREE.MeshBasicMaterial).map
        if (map) map.dispose()
        if (!x.userData.shared) x.dispose()
      }
      scene.traverse((o) => {
        const me = o as THREE.Mesh
        if (me.geometry && !me.geometry.userData.shared) me.geometry.dispose()
        const mm = me.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mm)) mm.forEach(killMat); else if (mm) killMat(mm)
      })
      skyTex.dispose(); ptex.dispose(); glowTex.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [world, difficulty, sw, swColor, reduceMotion, runId, seq])

  const next = seq[done] ?? null

  return (
    <GameShell title={t('hole.count')} emoji="🔢" onExit={onExit}>
      <Confetti active={party} calm />
      <div className="hole-fs">
        <div className="hole-hud hc-hud">
          <span className="hc-count">🔢 {done} / {seq.length}</span>
        </div>
        {/* the target sequence, subtly — done ones checked, the next one lit */}
        <div className="hc-seq" aria-hidden="true">
          {seq.map((n, i) => (
            <span key={i} className={`hc-seq-dot ${i < done ? 'done' : ''} ${i === done ? 'now' : ''}`}>{n}</span>
          ))}
        </div>
        {/* growth-bar area: the NEXT number, big */}
        <div className="hole-grow hc-grow">
          <span className="hc-next-lbl">{t('hole.count.next')}</span>
          <span className="hc-next-num">{next ?? '✓'}</span>
        </div>
        <div className="hole3d-wrap">
          <div className="hole3d-canvas" ref={mountRef} />
          {finished && (
            <div className="hole-done">
              <p>✓ {t('hole.count.done')}</p>
              <button className="big-button" onClick={() => { playPop(); setParty(false); setRunId((n) => n + 1) }}>🔁 {t('hole.count.again')}</button>
              <button className="big-button hole-map-btn" onClick={() => { playPop(); setParty(false); onExit() }}>🏠 {t('hole.count.menu')}</button>
            </div>
          )}
        </div>
      </div>
      <p className="sport-hint">{t('hole.count.hint')}</p>
    </GameShell>
  )
}
