import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import GameShell from './GameShell'
import { playFriend, playSuccess, unlockAudio } from '../audio'
import { playClip } from '../voice'
import { friendName, friendSay } from '../friends'
import { friendCount } from '../level'
import { buildFriend3D } from './buildFriend3D'

// The 3D friend gallery. Every data-driven friend (11–100) is generated in 3D
// from its own bump data by buildFriend3D — step through them with ◀ ▶. Each
// idles with a gentle breathing bob (drag to spin), and the buttons play real
// animations: a squash-and-stretch jump, a raised-hand high-five (כיף), and a
// lean-in arms-wrap hug (חיבוק). No timer, calm motion, sound can be muted.
type ActionName = 'idle' | 'jump' | 'five' | 'hug'

// arm rest pose — short stubs splayed outward (like the 2D friends' tilted arms)
const REST = { lx: 0, lz: 0.5, rx: 0, rz: -0.5 }

export default function Friend3D({ onExit, start }: { onExit: () => void; start?: number }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<{ name: ActionName; until: number }>({ name: 'idle', until: 0 })
  // start at friend #11 (first data-driven one) unless a deep-link picks one
  const [index, setIndex] = useState(() =>
    Number.isInteger(start) && (start as number) >= 0 && (start as number) < friendCount() ? (start as number) : 10,
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const W = () => mount.clientWidth || 320
    const H = () => mount.clientHeight || 360

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eaf2fb')
    const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 100)
    camera.position.set(0, 0.1, 6.6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W(), H())
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const key = new THREE.DirectionalLight(0xffffff, 0.95)
    key.position.set(3, 5, 4)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.3)
    fill.position.set(-3, 1, 3)
    scene.add(fill)

    // soft contact shadow on the ground
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 32),
      new THREE.MeshBasicMaterial({ color: 0x0b1b3a, transparent: true, opacity: 0.14 }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -1.95
    scene.add(shadow)

    const rig = buildFriend3D(index)
    scene.add(rig.group)
    const { group, bumps, armL, armR } = rig
    const baseScale = group.scale.x
    armL.rotation.set(REST.lx, 0, REST.lz)
    armR.rotation.set(REST.rx, 0, REST.rz)

    // drag-to-spin
    const userRot = { y: 0 }
    const dragState = { active: false, lastX: 0 }
    const el = renderer.domElement
    const onDown = (e: PointerEvent) => {
      dragState.active = true
      dragState.lastX = e.clientX
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragState.active) return
      userRot.y += (e.clientX - dragState.lastX) * 0.01
      dragState.lastX = e.clientX
    }
    const onUp = () => {
      dragState.active = false
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)

    const clock = new THREE.Clock()
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const t = clock.getElapsedTime()
      const now = performance.now()
      let act = actionRef.current
      if (act.name !== 'idle' && now > act.until) {
        act = { name: 'idle', until: 0 }
        actionRef.current = act
      }

      const sway = reduced ? 0 : Math.sin(t * 0.6) * 0.16
      const bob = reduced ? 0 : Math.sin(t * 2) * 0.06
      group.rotation.y = userRot.y + sway
      group.rotation.x = 0
      group.position.y = bob
      group.scale.setScalar(baseScale)
      // breathing — puff each bump a touch in place
      const breathe = reduced ? 0 : 1 + Math.sin(t * 2) * 0.03
      for (const b of bumps) b.scale.setScalar(breathe)

      let tLx = REST.lx
      let tLz = REST.lz
      let tRx = REST.rx
      let tRz = REST.rz

      if (act.name === 'hug') {
        tLx = -1.2
        tLz = -0.55
        tRx = -1.2
        tRz = 0.55
        const p = Math.min(1, Math.max(0, 1 - (act.until - now) / 1600))
        const squeeze = Math.sin(p * Math.PI)
        group.rotation.x = 0.18 * squeeze
        group.scale.set(baseScale * (1 + 0.06 * squeeze), baseScale * (1 - 0.05 * squeeze), baseScale * (1 + 0.06 * squeeze))
      } else if (act.name === 'five') {
        // raise the RIGHT hand up-and-out on its own side (+z rotation), tilted a
        // touch toward the viewer, with an eager little bounce
        const bounce = reduced ? 0 : Math.sin(t * 18) * 0.12
        tRx = -0.35
        tRz = 2.62 + bounce
      } else if (act.name === 'jump') {
        const p = Math.min(1, Math.max(0, 1 - (act.until - now) / 800))
        const hh = Math.sin(p * Math.PI)
        group.position.y = bob + hh * 0.9
        const s = 1 + hh * 0.12
        group.scale.set(baseScale * (1 - hh * 0.08), baseScale * s, baseScale * (1 - hh * 0.08))
        tLz = 0.95
        tRz = -0.95
      }

      armL.rotation.x = lerp(armL.rotation.x, tLx, 0.2)
      armL.rotation.z = lerp(armL.rotation.z, tLz, 0.2)
      armR.rotation.x = lerp(armR.rotation.x, tRx, 0.2)
      armR.rotation.z = lerp(armR.rotation.z, tRz, 0.2)

      renderer.render(scene, camera)
    }
    frame()

    const onResize = () => {
      camera.aspect = W() / H()
      camera.updateProjectionMatrix()
      renderer.setSize(W(), H())
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mm = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose())
        else if (mm) mm.dispose()
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [index])

  const run = (name: ActionName, dur: number) => {
    unlockAudio()
    actionRef.current = { name, until: performance.now() + dur }
  }
  const jump = () => {
    run('jump', 800)
    playFriend(index)
  }
  const five = () => {
    run('five', 1200)
    playSuccess()
    playClip('fx-five', 'כיף!')
  }
  const hug = () => {
    run('hug', 1600)
    playFriend(index)
    playClip('fx-hug', 'חיבוק גדול!')
  }
  const hi = () => {
    unlockAudio()
    playClip(`intro-${index}`, friendSay(index))
  }
  const step = (d: number) => {
    const n = friendCount()
    setIndex((i) => (i + d + n) % n)
  }

  return (
    <GameShell title={`${friendName(index)} · תלת מימד`} emoji="🧊" onExit={onExit}>
      <div className="three-screen">
        <div className="three-canvas" ref={mountRef} />
        <div className="three-stepper">
          <button className="three-arrow" onClick={() => step(-1)} aria-label="הקודם">
            ◀
          </button>
          <span className="three-name">
            {friendName(index)} · {index + 1}
          </span>
          <button className="three-arrow" onClick={() => step(1)} aria-label="הבא">
            ▶
          </button>
        </div>
        <div className="world-actions">
          <button className="world-btn" onClick={hi}>
            <span className="world-btn-emoji" aria-hidden="true">🔊</span>
            <span>שלום</span>
          </button>
          <button className="world-btn" onClick={jump}>
            <span className="world-btn-emoji" aria-hidden="true">⬆️</span>
            <span>קפיצה</span>
          </button>
          <button className="world-btn" onClick={five}>
            <span className="world-btn-emoji" aria-hidden="true">✋</span>
            <span>כיף</span>
          </button>
          <button className="world-btn" onClick={hug}>
            <span className="world-btn-emoji" aria-hidden="true">🤗</span>
            <span>חיבוק</span>
          </button>
        </div>
      </div>
    </GameShell>
  )
}
