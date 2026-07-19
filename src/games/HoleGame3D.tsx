import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import { playMunch, playPop, playWin, playSuccess, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { useT, getLang, translate } from '../i18n'
import { useSettings } from '../settings'
import { useGameLevel } from '../gameLevel'
import { buildLayout, friendNpc, mergeProp, worldForLevel, propKindOf, propEmoji, TIER_SIZE, TIER_SCALE, LANDMARK_SIZE, LANDMARK_SCALE, BOSS_SIZE, BOSS_SCALE, type Target } from './hole/world'
import { markFriendMet, hasMetFriend } from '../friendsMet'
import { recordDiscovery } from './hole/discoveries'
import { reachLevel, useMaxLevel, useCountDone } from '../holeProgress'
import HoleMap from './hole/HoleMap'
import HoleCount3D from './hole/HoleCount3D'
import Album from '../components/Album'
import type { GameProps } from './registry'

// "בולעים הכול" in REAL 3D (three.js). Drag a swallower across a DESIGNED, bounded
// themed world (Candy City → City) laid out along a winding breadcrumb path with
// stacks, zone clusters, a landmark, and the friends as 3D NPCs / billboards.
// Things tip and fall into the hole; it grows (a progress bar + a "גדלת!" pop tell
// you when), the camera zooms out. Collect the marked targets. No timer, no fail.

// Header difficulty tiers (0 קל · 1 בינוני · 2 קשה · 3 אלוף) for the shared
// top-bar <LevelButton>. This game has NO fail — a tier only tunes how lively /
// how fast the world is: קל keeps the owner-tuned gentle pace (all multipliers
// resolve to 1.0 at tier 0, byte-identical), higher tiers grow the hole faster
// and quicken the critters. Cumulative and no-fail throughout.
const LEVEL_TIERS = [0, 1, 2, 3]

type SwId = 'hole' | 'frog' | 'monster' | 'cat'
const SWALLOWERS: { id: SwId; color: string }[] = [
  { id: 'hole', color: '#15151c' },
  { id: 'frog', color: '#46c552' },
  { id: 'monster', color: '#8b5cf6' },
  { id: 'cat', color: '#fb923c' },
]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const SUCK_TURNS = 1.75 * Math.PI * 2 // ~1.75 spiral turns as a prop is swallowed (a readable whirl)
// an object is edible once the hole's mouth is about as wide as it (Hole.io/agar rule)
const eatable = (size: number, R: number) => size <= R * 2 * 1.12

export default function HoleGame3D({ onExit }: GameProps) {
  const { t } = useT()
  const { reduceMotion, maxNumber, difficulty } = useSettings()
  const countDone = useCountDone() // which counting-mode rows have a remembered ✓
  const [sw, setSw] = useState<SwId>('frog') // who swallows — picked on the same page as the map
  const [phase, setPhase] = useState<'home' | 'map' | 'play' | 'album' | 'count'>('home') // launcher → map/album/play/count
  const [pickerOpen, setPickerOpen] = useState(false) // swallower-choose popup
  const maxLevel = useMaxLevel() // the last level the player reached — where "start" begins
  const [level, setLevel] = useState(1) // WORLD/stage (from the map) — distinct from the difficulty tier below
  const [diffTier] = useGameLevel('hole', LEVEL_TIERS) // shared header difficulty: how lively/fast, never a fail
  const [prog, setProg] = useState(0) // 0..1 toward unlocking the next size
  const [eaten, setEaten] = useState(0) // total swallowed (a big counter, the "sweep")
  const [targets, setTargets] = useState<Target[]>([])
  const [nextIcon, setNextIcon] = useState('')
  const [grew, setGrew] = useState(false)
  const [met, setMet] = useState(false) // a friend popped out of a gift
  const [boss, setBoss] = useState(false) // swallowed the giant boss
  const [discover, setDiscover] = useState<{ emoji: string; name: string } | null>(null) // first-time prop discovery → album toast
  const [done, setDone] = useState(false)
  const [party, setParty] = useState(false)
  const [fs, setFs] = useState(false)
  const mountRef = useRef<HTMLDivElement>(null)
  const fsRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  const diffRef = useRef(diffTier) // the imperative sim loop reads this live each frame

  // full screen — the small window is too cramped
  function toggleFs() {
    if (!document.fullscreenElement) fsRef.current?.requestFullscreen?.()
    else document.exitFullscreen?.()
  }
  useEffect(() => {
    const h = () => { setFs(!!document.fullscreenElement); window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60) }
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // header difficulty → sim: record the value only; the running frame() reads
  // diffRef live, so a tap on the top-bar star retunes pace/growth INSTANTLY
  // without tearing down and rebuilding the three.js scene (diffTier is
  // deliberately NOT a dep of the big sim effect below).
  useEffect(() => { diffRef.current = diffTier }, [diffTier])

  useEffect(() => {
    if (!sw || phase !== 'play') return
    const mount = mountRef.current
    if (!mount) return
    const W = () => mount.clientWidth || 360
    const H = () => mount.clientHeight || 480
    const lvl = buildLayout(level, maxNumber)
    const swColor = SWALLOWERS.find((s) => s.id === sw)!.color
    doneRef.current = false
    setTargets(lvl.targets.map((x) => ({ ...x })))
    setProg(0); setEaten(0)
    setNextIcon(lvl.world.icons[1] ?? lvl.world.icons[0])
    setDone(false); setParty(false); setGrew(false); setMet(false); setBoss(false); setDiscover(null)

    const scene = new THREE.Scene()
    // a soft VERTICAL-GRADIENT sky (richer up top → hazier at the horizon) reads as
    // a place, not a flat void. Full-screen backdrop, so cheap on mobile.
    const skyCv = document.createElement('canvas'); skyCv.width = 256; skyCv.height = 256
    const skyCx = skyCv.getContext('2d')!
    const skyTop = new THREE.Color(lvl.world.sky).multiplyScalar(0.82)
    const skyBot = new THREE.Color(lvl.world.sky).lerp(new THREE.Color(0xffffff), 0.32)
    const skyGrad = skyCx.createLinearGradient(0, 0, 0, 256)
    skyGrad.addColorStop(0, `#${skyTop.getHexString()}`); skyGrad.addColorStop(1, `#${skyBot.getHexString()}`)
    skyCx.fillStyle = skyGrad; skyCx.fillRect(0, 0, 256, 256)
    // a soft radial VIGNETTE (corners gently darkened) reads as depth/lens — premium & cheap
    const skyVig = skyCx.createRadialGradient(128, 116, 30, 128, 128, 190)
    skyVig.addColorStop(0, 'rgba(0,0,0,0)'); skyVig.addColorStop(0.7, 'rgba(0,0,0,0)'); skyVig.addColorStop(1, 'rgba(0,0,0,0.17)')
    skyCx.fillStyle = skyVig; skyCx.fillRect(0, 0, 256, 256)
    const skyTex = new THREE.CanvasTexture(skyCv)
    scene.background = skyTex
    scene.fog = new THREE.Fog(lvl.world.sky, lvl.bound * 2.4, lvl.bound * 5) // far, so the water shore stays visible
    const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 600)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W(), H())
    mount.appendChild(renderer.domElement)

    // sky-tinted top / ground-bounced bottom (HemisphereLight) = the cheap "reads 3D"
    // win for flat Lambert art; ambient lowered so the hemisphere shaping shows
    scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    scene.add(new THREE.HemisphereLight(new THREE.Color(lvl.world.sky), new THREE.Color(lvl.world.ground), 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(20, 40, 18); scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.28); fill.position.set(-20, 14, -10); scene.add(fill)

    // a few slow, soft drifting CLOUDS for light-sky worlds — pure calm ambience,
    // skipped entirely under reduce-motion (and for the dark space / underwater skies)
    const clouds: THREE.Sprite[] = []
    let cloudTex: THREE.CanvasTexture | null = null
    if (!reduceMotion && lvl.world.id !== 'space' && lvl.world.id !== 'underwater') {
      const ccv = document.createElement('canvas'); ccv.width = ccv.height = 128
      const ccx = ccv.getContext('2d')!
      for (const [cx, cy, cr] of [[52, 74, 34], [78, 66, 40], [64, 82, 30], [40, 70, 24]] as const) {
        const gr = ccx.createRadialGradient(cx, cy, 0, cx, cy, cr)
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
        ccx.fillStyle = gr; ccx.beginPath(); ccx.arc(cx, cy, cr, 0, 6.283); ccx.fill()
      }
      cloudTex = new THREE.CanvasTexture(ccv)
      for (let i = 0; i < 4; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.45, depthWrite: false }))
        const a = (i / 4) * 6.283, rad = lvl.bound * (0.5 + Math.random() * 0.4)
        sp.position.set(Math.cos(a) * rad, lvl.bound * 0.5 + Math.random() * 6, Math.sin(a) * rad)
        sp.scale.set(12 + Math.random() * 8, 6 + Math.random() * 4, 1)
        scene.add(sp); clouds.push(sp)
      }
    }

    // WATER all around = the visible EDGE of the world (the child sees where it ends)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(lvl.bound * 10, lvl.bound * 10), new THREE.MeshLambertMaterial({ color: 0x3a90d0 }))
    water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water)
    // the ground is a bounded ISLAND disc; past its shore is the sea (a hard boundary).
    // Richer than a flat fill: a subtle two-tone MOTTLE baked to one texture (per-world
    // tint) reads as gentle terrain, not a paper cut-out. One canvas mapped once across
    // the disc → no repeat, no tiling seams, one cheap texture.
    const grCv = document.createElement('canvas'); grCv.width = grCv.height = 256
    const grCx = grCv.getContext('2d')!
    const grBase = new THREE.Color(lvl.world.ground)
    grCx.fillStyle = `#${grBase.getHexString()}`; grCx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 16; i++) {
      const tone = grBase.clone().lerp(new THREE.Color(i % 2 ? 0x000000 : 0xffffff), 0.1)
      const gx = Math.random() * 256, gy = Math.random() * 256, gr = 34 + Math.random() * 60
      const rc = `${Math.round(tone.r * 255)},${Math.round(tone.g * 255)},${Math.round(tone.b * 255)}`
      const gg = grCx.createRadialGradient(gx, gy, 0, gx, gy, gr)
      gg.addColorStop(0, `rgba(${rc},0.55)`); gg.addColorStop(1, `rgba(${rc},0)`)
      grCx.fillStyle = gg; grCx.beginPath(); grCx.arc(gx, gy, gr, 0, 6.283); grCx.fill()
    }
    const groundTex = new THREE.CanvasTexture(grCv)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(lvl.bound, 72), new THREE.MeshLambertMaterial({ map: groundTex }))
    ground.rotation.x = -Math.PI / 2; scene.add(ground)
    const shore = new THREE.Mesh(new THREE.RingGeometry(lvl.bound - 1.4, lvl.bound + 0.2, 72), new THREE.MeshLambertMaterial({ color: new THREE.Color(lvl.world.ground).lerp(new THREE.Color(0xe9dfae), 0.5) }))
    shore.rotation.x = -Math.PI / 2; shore.position.y = 0.02; scene.add(shore)

    // the visible ROAD the objects line — a darker ground-tone ribbon you follow
    const roadCol = new THREE.Color(lvl.world.ground).multiplyScalar(0.72)
    const roadMesh = new THREE.Mesh(new THREE.TubeGeometry(lvl.road, 120, 2.0, 6, false), new THREE.MeshLambertMaterial({ color: roadCol }))
    roadMesh.scale.y = 0.02; roadMesh.position.y = 0.04; scene.add(roadMesh)

    // NESTED RING FENCES = the barriers; each fades open once the hole is big enough
    const fences = lvl.gates.map((g) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(g.r, 0.42, 8, 72), new THREE.MeshLambertMaterial({ color: 0xcaa46a, transparent: true, opacity: 0.95 }))
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.45; scene.add(ring)
      return { ring, gate: g, opened: false, t: 0 } // opened = sink-away animation is running
    })

    // the swallower — a disc that reads as a real PIT: a radial gradient (near-black
    // centre → soft dark rim) instead of a flat dot, plus a thin darker inner rim ring
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
    // a soft INNER GLOW ring hugging the rim — light catching the pit's lip so the
    // mouth reads as a lit 3D opening, not a printed dot (cheap: one small texture)
    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128
    const glowCx = glowCv.getContext('2d')!
    const glowC = sw === 'hole' ? new THREE.Color(0xfff2d8) : new THREE.Color(swColor).lerp(new THREE.Color(0xffffff), 0.5)
    const glowRc = `${Math.round(glowC.r * 255)},${Math.round(glowC.g * 255)},${Math.round(glowC.b * 255)}`
    const glowGrad = glowCx.createRadialGradient(64, 64, 40, 64, 64, 64)
    glowGrad.addColorStop(0, `rgba(${glowRc},0)`); glowGrad.addColorStop(0.72, `rgba(${glowRc},0.34)`); glowGrad.addColorStop(1, `rgba(${glowRc},0)`)
    glowCx.fillStyle = glowGrad; glowCx.beginPath(); glowCx.arc(64, 64, 64, 0, 6.283); glowCx.fill()
    const glowTex = new THREE.CanvasTexture(glowCv)
    const glowRing = new THREE.Mesh(new THREE.CircleGeometry(1.16, 40), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.85 }))
    glowRing.rotation.x = -Math.PI / 2; glowRing.position.y = 0.06; hole.add(glowRing)
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

    type Obj = { grp: THREE.Group; x: number; z: number; tier: number; size: number; baseY: number; captured: boolean; capT: number; grewF: boolean; dead: boolean; mover: boolean; vx: number; vz: number; wanderT: number; kind?: 'gift' | 'ice' | 'boss' | 'firework' | 'balloon' | 'linked'; thawed: boolean; warm: number; iceShell?: THREE.Mesh; friend?: number; propKind?: string; capR0: number; capA0: number; capY0: number; capDur: number; capScale0: number; capStg: number }
    const objs: Obj[] = lvl.specs.map((s) => {
      // merge flat-colour prop parts into ONE mesh (huge draw-call win); friends
      // (billboards + rigs) keep their separate meshes/textures — never merged
      const grp = s.friend == null ? mergeProp(s.make()) : s.make()
      const scale = s.kind === 'boss' ? BOSS_SCALE : s.landmark ? LANDMARK_SCALE : TIER_SCALE[s.tier - 1]
      grp.scale.setScalar(scale)
      grp.position.set(s.x, s.baseY * scale, s.z)
      let iceShell: THREE.Mesh | undefined
      if (s.kind === 'ice') { // encase it in a frosty block you melt by lingering
        iceShell = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.0, 1.7), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55 }))
        iceShell.position.y = 0.9; grp.add(iceShell)
      }
      scene.add(grp)
      const size = s.kind === 'boss' ? BOSS_SIZE : s.landmark ? LANDMARK_SIZE : TIER_SIZE[s.tier - 1]
      // discovery album key — a friend billboard/NPC uses the separate friends
      // album instead (markFriendMet), so it never gets a propKind here
      const propKind = s.friend == null ? propKindOf(s.make, s.kind) : undefined
      return { grp, x: s.x, z: s.z, tier: s.tier, size, baseY: s.baseY * scale, captured: false, capT: 0, grewF: false, dead: false, mover: !!s.mover, vx: 0, vz: 0, wanderT: 0, kind: s.kind, thawed: s.kind !== 'ice', warm: 0, iceShell, friend: s.friend, propKind, capR0: 0, capA0: 0, capY0: 0, capDur: 0.7, capScale0: scale, capStg: 0 }
    })
    const reveals: { grp: THREE.Group; t: number }[] = [] // friends popping out of swallowed gifts

    // a soft DUST POOF when something is swallowed (cheap THREE.Points pool)
    const PMAX = 96
    const pPos = new Float32Array(PMAX * 3).fill(-999)
    const pState = Array.from({ length: PMAX }, () => ({ life: 0, vx: 0, vy: 0, vz: 0, g: 4 })) // g = downward gravity (dust); bubbles use a gentle negative g so they rise
    const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    // a soft round dust sprite (a radial-gradient dot) so puffs are fluffy, not square
    const pcv = document.createElement('canvas'); pcv.width = pcv.height = 32
    const pcx = pcv.getContext('2d')!; const pgrad = pcx.createRadialGradient(16, 16, 0, 16, 16, 16)
    pgrad.addColorStop(0, 'rgba(255,255,255,0.95)'); pgrad.addColorStop(1, 'rgba(255,255,255,0)')
    pcx.fillStyle = pgrad; pcx.beginPath(); pcx.arc(16, 16, 16, 0, 6.283); pcx.fill()
    const ptex = new THREE.CanvasTexture(pcv)
    const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xfff4fb, size: 0.5, map: ptex, transparent: true, opacity: 0.7, depthWrite: false }))
    points.frustumCulled = false; scene.add(points)
    let pHead = 0
    // a small swallow dust poof (drifts out + settles under gravity)
    const poof = (x: number, z: number) => { for (let k = 0; k < 7; k++) { const i = pHead++ % PMAX, a = Math.random() * 6.28, s = 1 + Math.random() * 2.2; pState[i] = { life: 0.5, vx: Math.cos(a) * s, vy: 1.4 + Math.random() * 2, vz: Math.sin(a) * s, g: 4 }; pPos[i * 3] = x; pPos[i * 3 + 1] = 0.3; pPos[i * 3 + 2] = z } }
    // a CALM bubble column rising slowly out of the hole (calm replacement for the
    // old firework shower) — gentle buoyant rise, no burst, no flash
    const bubbles = (x: number, z: number) => { for (let k = 0; k < 14; k++) { const i = pHead++ % PMAX, a = Math.random() * 6.28, rr = Math.random() * 0.5; pState[i] = { life: 1.4 + Math.random() * 0.6, vx: Math.cos(a) * 0.25, vy: 0.8 + Math.random() * 0.7, vz: Math.sin(a) * 0.25, g: -0.6 }; pPos[i * 3] = x + Math.cos(a) * rr; pPos[i * 3 + 1] = 0.3; pPos[i * 3 + 2] = z + Math.sin(a) * rr } }

    // a MOUTH-RIPPLE ring that blooms from the rim each time something is swallowed —
    // a soft "gulp splash" so a bite reads as an event. Cheap pooled ring meshes; the
    // ring geometry is tagged shared (one manual dispose), the materials are per-mesh.
    const RIPPLES = 6
    const rippleGeo = new THREE.RingGeometry(0.8, 1.0, 40); rippleGeo.userData.shared = true
    const rippleMeshes: THREE.Mesh[] = []
    const rippleSt: { t: number; live: boolean; r: number }[] = []
    for (let i = 0; i < RIPPLES; i++) {
      const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }))
      m.rotation.x = -Math.PI / 2; m.position.y = 0.07; m.visible = false; scene.add(m)
      rippleMeshes.push(m); rippleSt.push({ t: 0, live: false, r: 1 })
    }
    let rippleHead = 0
    const ripple = (x: number, z: number, r: number) => {
      const i = rippleHead++ % RIPPLES, m = rippleMeshes[i], s = rippleSt[i]
      m.position.set(x, 0.07, z); s.t = 0; s.live = true; s.r = r; m.visible = true
    }

    const pos = { x: 0, z: 0 }
    const targetPos = { x: 0, z: 0 }
    // R = displayed radius (eased); targetR = the size actually earned by swallowing.
    // Easing targetR → R (and the camera) makes growth glide instead of snapping.
    let R = 0.8, targetR = 0.8, camR = 0.8, eatTier = 0, totalEaten = 0, combo = 0, lastEat = -1, squash = 0, gulp = 0
    let velX = 0, velZ = 0 // hole velocity, for the critically-damped movement spring
    const tg = lvl.targets.map((x) => ({ ...x }))

    // first-time DISCOVERY toast — a calm little "you found it!" for the album, no
    // confetti/sound beyond the normal munch. Queued so a burst (e.g. a balloon
    // sweep) never shows two at once; each shows in turn with a soft fade.
    const worldId = lvl.world.id
    const toastQueue: { emoji: string; name: string }[] = []
    let toastShowing = false, toastTimeoutId = 0
    const showNextToast = () => {
      const next = toastQueue.shift()
      if (!next) { toastShowing = false; setDiscover(null); return }
      toastShowing = true
      setDiscover(next)
      toastTimeoutId = window.setTimeout(showNextToast, 2200)
    }
    const queueDiscovery = (kind: string) => {
      if (!recordDiscovery(worldId, kind)) return // not the first time — silent
      const name = translate(getLang(), `hole.prop.${kind}`)
      toastQueue.push({ emoji: propEmoji(worldId, kind), name })
      if (!toastShowing) showNextToast()
    }

    // Unity-style SmoothDamp: critically damped (no overshoot), frame-rate independent,
    // with a max-speed cap → the calm accel/decel "creature" feel, never a jump.
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
      if ((target - cur > 0) === (out > target)) { out = target; nv = (out - target) / dt } // clamp overshoot
      return [out, nv]
    }
    // hoisted scratch vectors (no per-frame allocation)
    const camPos = new THREE.Vector3(0, 7.5 + R * 2.0, 7 + R * 1.85)
    camera.position.copy(camPos)
    const arrowV = new THREE.Vector3()

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

      // DIFFICULTY (header star) — read live; all three resolve to 1.0 at קל so the
      // owner-tuned gentle world is byte-identical, then scale up cumulatively.
      // Cheap primitives, no per-frame allocation.
      const d = diffRef.current // 0 קל · 1 בינוני · 2 קשה · 3 אלוף
      const growMul = 1 + d * 0.22 // each bite grows the hole more → the bar fills quicker
      const paceMul = 1 + d * 0.2 // a livelier, quicker world (the wandering critters)
      const glideMul = 1 + d * 0.1 // the swallower glides a touch faster

      // ease the DISPLAYED radius toward the earned size (frame-rate independent) so
      // every bite grows the hole as a gentle swell over ~1s (a hair quicker at higher tiers)
      R += (targetR - R) * (1 - Math.exp(-(3.7 + d * 0.8) * dt))

      // PHYSICAL BOUNDARY: blocked at the first still-closed ring (grow to open it), and
      // never past the island's shore — the hole simply stops there ("this is the end")
      let maxDist = lvl.bound - 1.2
      for (const g of lvl.gates) { if (R < g.open) { maxDist = Math.max(2, g.r - R * 0.5); break } }
      // clamp the pointer target into the reachable area, then a critically-damped
      // spring glides the hole there — accel/decel, no overshoot, no cursor-snap
      let tx = targetPos.x, tz = targetPos.z
      const tdc = Math.hypot(tx, tz)
      if (tdc > maxDist) { tx *= maxDist / tdc; tz *= maxDist / tdc }
      const maxSpd = (3.4 + R * 0.35) * glideMul // calm pace, only mildly faster when big / higher tier
      ;[pos.x, velX] = smoothDamp(pos.x, tx, velX, 0.26, maxSpd, dt)
      ;[pos.z, velZ] = smoothDamp(pos.z, tz, velZ, 0.26, maxSpd, dt)
      const dc = Math.hypot(pos.x, pos.z)
      if (dc > maxDist) { pos.x *= maxDist / dc; pos.z *= maxDist / dc }
      // GATES: once the hole is big enough a fence sinks below ground over ~1s (with a
      // soft chime) instead of blinking out — "the gate opened for you"
      for (const f of fences) {
        if (!f.opened && R >= f.gate.open) { f.opened = true; playSuccess() }
        if (f.opened && f.t < 1) {
          f.t = Math.min(1, f.t + dt)
          f.ring.position.y = 0.45 - f.t * 2.4
          ;(f.ring.material as THREE.MeshLambertMaterial).opacity = 0.95 * (1 - f.t)
          if (f.t >= 1) f.ring.visible = false
        }
      }
      squash = Math.max(0, squash - dt * 4) // gentle mouth "squash" pulse decays after each bite
      gulp = Math.max(0, gulp - dt * 6.5) // brief "gulp" swell on each swallow (~150ms)
      hole.position.set(pos.x, 0, pos.z)
      const hs = 1 + squash * 0.1 + gulp * 0.08 // a slightly stronger rim gulp (~1.08 peak)
      hole.scale.set(R * hs, R * (1 + gulp * 0.04), R * hs)

      let changed = false, metGift = false, ateBoss = false, firedFw = false, poppedBalloon = false
      for (const o of objs) {
        if (o.dead) continue
        // a LIVING world: critters wander, and gently amble AWAY when the hole nears
        // (always slower than the hole, so the child always catches them — it's tag)
        if (o.mover && !o.captured) {
          o.wanderT -= dt
          if (o.wanderT <= 0) { const a = Math.random() * 6.283, sp = (0.55 + Math.random() * 0.5) * paceMul; o.vx = Math.cos(a) * sp; o.vz = Math.sin(a) * sp; o.wanderT = 1.6 + Math.random() * 2.2 }
          const hx = o.x - pos.x, hz = o.z - pos.z, hd = Math.hypot(hx, hz)
          let mvx = o.vx, mvz = o.vz
          // startled amble away — scootier at higher tiers, but fl stays below the hole's
          // maxSpd so the child ALWAYS catches them (it's tag, never a chase you lose)
          if (hd < R + 4 + d * 0.6 && hd > 0.001) { const fl = 1.7 * paceMul; mvx = (hx / hd) * fl; mvz = (hz / hd) * fl }
          o.x += mvx * dt; o.z += mvz * dt
          // keep wanderers inside the CURRENTLY-OPEN area (maxDist), not the whole
          // island — otherwise critters drift past gates the child can't follow through
          const md = Math.hypot(o.x, o.z)
          if (md > maxDist) { o.x *= maxDist / md; o.z *= maxDist / md; o.vx = -o.vx; o.vz = -o.vz }
          o.grp.position.x = o.x; o.grp.position.z = o.z
          o.grp.rotation.y = Math.atan2(mvx, mvz)
          if (!reduceMotion) o.grp.position.y = o.baseY + Math.abs(Math.sin(clock.elapsedTime * 6 + o.x)) * 0.12 // a little hop
        }
        // MARK the surprises (gift / ice / friend): a gentle bob so the child spots them
        if (!reduceMotion && !o.captured && !o.mover && (o.kind != null && o.kind !== 'boss' || o.friend != null)) {
          o.grp.position.y = o.baseY + (Math.sin(clock.elapsedTime * 2.2 + o.x) * 0.5 + 0.5) * 0.22
          o.grp.rotation.y += dt * 0.6
        }
        if (o.captured) {
          o.capT += dt
          const delay = o.baseY * 0.10 + o.capStg // stacked-height + a small per-item stagger (a crowd cascades in, not one blob)
          if (o.capT < delay) continue
          if (!o.grewF) {
            o.grewF = true; targetR = Math.cbrt(targetR * targetR * targetR + o.size * o.size * o.size * 0.28 * growMul); totalEaten += 1 // VOLUME growth (Katamari square-cube: decelerates) — gentle 0.28 gain at קל, bigger per-bite at higher tiers; R eases up over ~1s
            const x = tg.find((q) => q.tier === o.tier && q.got < q.need); if (x) x.got += 1
            if (o.propKind) queueDiscovery(o.propKind) // → the per-world discovery album (cheap set-add, silent unless it's the first time)
            if (o.kind === 'gift') { // a friend pops up — prefer one NOT yet collected
              const cap = Math.max(1, maxNumber)
              let fi = Math.floor(Math.random() * cap)
              for (let tr = 0; tr < 12 && hasMetFriend(fi); tr++) fi = Math.floor(Math.random() * cap)
              const fr = friendNpc(fi); fr.position.set(o.x, -1.6, o.z); scene.add(fr)
              reveals.push({ grp: fr, t: 0 }); metGift = true; markFriendMet(fi) // → the album
            }
            if (o.friend != null) markFriendMet(o.friend) // swallowed an in-world friend → album
            if (o.kind === 'linked') { // its partner (nearest other linked) slides in too, staggered
              let best: Obj | null = null, bd = Infinity
              for (const q of objs) { if (q === o || q.dead || q.captured || q.kind !== 'linked') continue; const dd = Math.hypot(q.x - o.x, q.z - o.z); if (dd < bd) { bd = dd; best = q } }
              if (best) { best.captured = true; best.capT = 0; best.capStg = 0.14 }
            }
            if (o.kind === 'boss') ateBoss = true // swallowed the giant — a triumphant capstone
            if (o.kind === 'firework') firedFw = true // a calm bubble column rises out of the hole
            if (o.kind === 'balloon') { // pops + sweeps a few nearby treats into the hole, each staggered so they cascade
              poppedBalloon = true; let pulled = 0
              for (const q of objs) { if (pulled >= 5) break; if (q === o || q.dead || q.captured || q.kind != null || q.friend != null || q.tier > 2) continue; if (Math.hypot(q.x - o.x, q.z - o.z) < 5.5) { q.captured = true; q.capT = 0; q.capStg = 0.09 * (pulled + 1); pulled++ } }
            }
            // snapshot the entry polar offset → a controlled, readable spiral (fixed turns + duration)
            const ex = o.grp.position.x - pos.x, ez = o.grp.position.z - pos.z
            o.capR0 = Math.max(0.3, Math.hypot(ex, ez)); o.capA0 = Math.atan2(ez, ex)
            o.capY0 = o.grp.position.y; o.capScale0 = o.grp.scale.x
            o.capDur = 0.6 + Math.min(o.size, 4) * 0.09 // medium props ~0.7–0.9s: a swallow you can actually watch
            if (!reduceMotion) ripple(pos.x, pos.z, R) // a soft splash ring blooms at the rim on entry
            changed = true
          }
          // a readable SUCK: it hangs at the rim, then whirls ~1.75 turns inward, tilting
          // toward the pit and sinking with slight acceleration — a swallow that reads as an event
          const u = Math.min(1, (o.capT - delay) / o.capDur) // 0→1 through the suck
          const e = u * u // ease-in on the WHIRL: it turns slowly at first, faster as it tightens
          const ang = o.capA0 + SUCK_TURNS * e
          const rad = o.capR0 * (1 - u) + 0.03 // slides steadily inward (visible the whole way across the mouth)
          o.grp.position.x = pos.x + Math.cos(ang) * rad
          o.grp.position.z = pos.z + Math.sin(ang) * rad
          // stay up at the rim, spiralling in plain sight, then PLUNGE under in the last half
          // (a top-down pit disc occludes anything below it, so a slow early sink = an unseen suck)
          const plunge = Math.max(0, u - 0.5) * 2
          o.grp.position.y = o.capY0 - u * 0.25 - plunge * plunge * (o.capY0 + 3.2)
          const towardX = -Math.cos(ang), towardZ = -Math.sin(ang), tilt = 0.45 + u * 0.7 // TILT toward the pit's centre (lead edge dips)
          o.grp.rotation.x = towardZ * tilt; o.grp.rotation.z = -towardX * tilt
          o.grp.rotation.y += dt * 1.8 // a slow tumble keeps it alive on the way down
          o.grp.scale.setScalar(o.capScale0 * Math.max(0, 1 - e * e)) // holds its shape, then vanishes at the bottom
          if (u >= 1) { if (!reduceMotion) poof(pos.x, pos.z); scene.remove(o.grp); o.dead = true } // dust poof timed to the exact moment it disappears
        } else if (eatable(o.size, R) && o.thawed) {
          const dxh = pos.x - o.x, dzh = pos.z - o.z, dh = Math.hypot(dxh, dzh)
          if (dh < R * 0.95) { o.captured = true; o.capT = 0; o.capStg = Math.random() * 0.09 } // a hair of stagger so a cluster doesn't vanish in unison
          else if (dh < R * 1.35 && dh > 0.001) {
            // ANTICIPATION: inside 1.35·R the object leans + slides gently toward the
            // pit, so a bite is telegraphed instead of a binary snap at the edge
            const slide = (1 - Math.exp(-3 * dt)) * 0.4
            o.x += dxh * slide; o.z += dzh * slide
            o.grp.position.x = o.x; o.grp.position.z = o.z
            const lean = 1 - Math.exp(-8 * dt)
            o.grp.rotation.x += (dzh * 0.28 - o.grp.rotation.x) * lean
            o.grp.rotation.z += (-dxh * 0.28 - o.grp.rotation.z) * lean
          }
        } else if (o.kind === 'ice' && !o.thawed) {
          // melt the frosty block by lingering near the hole's warmth, then it's edible
          const nd = Math.hypot(o.x - pos.x, o.z - pos.z)
          if (nd < R + 2.2) {
            o.warm += dt
            if (o.iceShell) { const k = Math.max(0, 1 - o.warm / 1.3); o.iceShell.scale.setScalar(0.55 + 0.45 * k); (o.iceShell.material as THREE.MeshLambertMaterial).opacity = 0.55 * k }
            if (o.warm >= 1.3) { o.thawed = true; if (o.iceShell) { o.grp.remove(o.iceShell); o.iceShell.geometry.dispose(); (o.iceShell.material as THREE.Material).dispose(); o.iceShell = undefined } playSuccess() }
          }
        } else if (!reduceMotion && o.size < 3) {
          o.grp.rotation.y += dt * 0.15 // gentle idle life on small things you can't eat yet
        }
      }
      // friends popping out of swallowed gifts: rise, bob, then gently fade away
      for (let i = reveals.length - 1; i >= 0; i--) {
        const rv = reveals[i]; rv.t += dt
        rv.grp.position.y = rv.t < 0.5 ? lerp(-1.6, 0.2, rv.t / 0.5) : 0.2 + Math.sin(rv.t * 3) * 0.12
        rv.grp.rotation.y += dt * 1.2
        if (rv.t > 3) rv.grp.scale.setScalar(Math.max(0, 1 - (rv.t - 3)))
        if (rv.t > 4) { scene.remove(rv.grp); reveals.splice(i, 1) }
      }
      // dust poof particles: drift out + up, settle, fade
      for (let i = 0; i < PMAX; i++) { const p = pState[i]; if (p.life > 0) { p.life -= dt; pPos[i * 3] += p.vx * dt; pPos[i * 3 + 1] += p.vy * dt; pPos[i * 3 + 2] += p.vz * dt; p.vy -= dt * p.g; if (p.life <= 0) pPos[i * 3 + 1] = -999 } }
      pGeo.attributes.position.needsUpdate = true
      // mouth-ripple rings: bloom outward from the rim + fade over ~0.55s, then park
      for (let i = 0; i < RIPPLES; i++) {
        const s = rippleSt[i]; if (!s.live) continue
        s.t += dt; const k = Math.min(1, s.t / 0.55), m = rippleMeshes[i]
        const rsc = s.r * (1 + k * 0.95); m.scale.set(rsc, rsc, rsc)
        ;(m.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - k)
        if (k >= 1) { s.live = false; m.visible = false }
      }
      // soft clouds drift slowly across the sky (empty list under reduce-motion)
      for (const c of clouds) { c.position.x += dt * 0.35; if (c.position.x > lvl.bound * 1.15) c.position.x = -lvl.bound * 1.15 }
      if (changed) {
        const now = clock.elapsedTime; combo = now - lastEat < 0.5 ? combo + 1 : 0; lastEat = now; squash = 1; gulp = 1
        playMunch(combo) // rising pitch on a fast sweep, soft reset otherwise
        setEaten(totalEaten)
        if (metGift) { setMet(true); playWin(); window.setTimeout(() => setMet(false), 1900) } // a friend appeared!
        if (ateBoss) { setBoss(true); playWin(); setParty(true); window.setTimeout(() => setBoss(false), 2400) } // swallowed the giant!
        if (firedFw) { if (!reduceMotion) bubbles(pos.x, pos.z); playPop() } // calm bubble column (no flash, no party)
        if (poppedBalloon) playPop() // balloon pop sweeps nearby treats (done above) — no celebration flash
        setTargets(tg.map((x) => ({ ...x })))
        // current max edible tier (by size) + progress toward unlocking the next —
        // measured on the EARNED size (targetR) so the HUD/celebration fire promptly
        const diam = targetR * 2 * 1.12
        let et = 0; for (let i = 0; i < TIER_SIZE.length; i++) if (TIER_SIZE[i] <= diam) et = i + 1
        const nextT = Math.min(et + 1, TIER_SIZE.length)
        setProg(Math.min(1, diam / TIER_SIZE[nextT - 1]))
        setNextIcon(lvl.world.icons[Math.min(nextT - 1, lvl.world.icons.length - 1)])
        if (et > eatTier) {
          eatTier = et
          if (!reduceMotion) { setGrew(true); window.setTimeout(() => setGrew(false), 1100) }
          playSuccess(); speakNumber(et)
        }
        if (tg.every((x) => x.got >= x.need) && !doneRef.current) {
          doneRef.current = true; playWin(); setParty(true); setDone(true); reachLevel(level + 1) // unlock the next on the map
        }
      }

      // camera: a small look-ahead in the movement direction + a damped follow, so the
      // zoom-out on growth glides and you see slightly into where you're heading. The
      // pull-back lags the hole's own growth by a hair (camR eases slower than R) — that
      // slight drift as the world zooms out reads luxurious rather than snappy.
      camR += (R - camR) * (1 - Math.exp(-2.6 * dt))
      const dist = 7 + camR * 1.85, height = 7.5 + camR * 2.0
      const csp = Math.hypot(velX, velZ)
      const fx = pos.x + (csp > 0.01 ? (velX / csp) * 0.4 : 0), fz = pos.z + (csp > 0.01 ? (velZ / csp) * 0.4 : 0)
      const camK = 1 - Math.exp(-6 * dt)
      camPos.x += (fx - camPos.x) * camK
      camPos.y += (height - camPos.y) * camK
      camPos.z += (fz + dist - camPos.z) * camK
      camera.position.copy(camPos); camera.lookAt(fx, 0, fz)

      // guide arrow → nearest still-needed target
      if (arrowRef.current) {
        let near: Obj | null = null, nd = Infinity
        for (const o of objs) {
          if (o.dead || !tg.some((q) => q.tier === o.tier && q.got < q.need)) continue
          const ddx = Math.hypot(o.x - pos.x, o.z - pos.z); if (ddx < nd) { nd = ddx; near = o }
        }
        const vw = el.clientWidth || 1, vh = el.clientHeight || 1
        if (near) {
          const v = arrowV.set(near.x, near.baseY + 1, near.z).project(camera)
          const behind = v.z > 1, onScreen = !behind && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1
          if (onScreen) arrowRef.current.style.display = 'none'
          else {
            let ang = Math.atan2((-v.y * 0.5 + 0.5) * vh - vh / 2, (v.x * 0.5 + 0.5) * vw - vw / 2)
            if (behind) ang += Math.PI
            const mar = 26, ex = vw / 2 + Math.cos(ang) * (vw / 2 - mar), ey = vh / 2 + Math.sin(ang) * (vh / 2 - mar)
            arrowRef.current.style.display = 'flex'
            arrowRef.current.style.transform = `translate(${ex - 20}px, ${ey - 20}px) rotate(${ang}rad)`
          }
        } else arrowRef.current.style.display = 'none'
      }

      renderer.render(scene, camera)
    }
    frame()

    const onResize = () => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()) }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', onResize)
      window.clearTimeout(toastTimeoutId)
      el.removeEventListener('pointerdown', onPointer); el.removeEventListener('pointermove', onPointer)
      // dispose per-level resources but NEVER the shared cached geometry/materials
      // (userData.shared) — they're reused by the next level. Also free each
      // material's texture map: material.dispose() does NOT release material.map.
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
      skyTex.dispose(); ptex.dispose(); groundTex.dispose(); glowTex.dispose(); rippleGeo.dispose(); if (cloudTex) cloudTex.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [sw, phase, level, reduceMotion, maxNumber])

  const swFeatures = (id: SwId) => (
    <>
      {id === 'frog' && (<><span className="sw-eye l" /><span className="sw-eye r" /></>)}
      {id === 'monster' && (<><span className="sw-horn l" /><span className="sw-horn r" /><span className="sw-teeth" /></>)}
      {id === 'cat' && (<><span className="sw-ear l" /><span className="sw-ear r" /></>)}
    </>
  )
  const swColor = SWALLOWERS.find((s) => s.id === sw)!.color

  if (phase === 'album') {
    return <Album onExit={() => setPhase('home')} />
  }
  if (phase === 'count') {
    // "בולעים וסופרים" — swallow the numbered blocks in order. Uses the world theme
    // of the player's latest level (candy by default), and the site difficulty setting.
    return (
      <HoleCount3D
        world={worldForLevel(maxLevel)}
        difficulty={difficulty}
        sw={sw}
        swColor={swColor}
        onExit={() => setPhase('home')}
      />
    )
  }
  if (phase === 'map') {
    // the level map — opened only via "choose a level" (not shown on the home page)
    return (
      <GameShell title={t('game.hole')} emoji="🕳️" onExit={() => setPhase('home')}>
        <HoleMap onPick={(l) => { playPop(); setLevel(l); setPhase('play') }} />
      </GameShell>
    )
  }
  if (phase === 'home') {
    // launcher: small icon buttons — current swallower (→ popup), album, choose-a-level
    return (
      <GameShell title={t('game.hole')} emoji="🕳️" onExit={onExit} levels={{ gameId: 'hole', tiers: LEVEL_TIERS }}>
        <div className="hole-home">
          {/* big START — begins at the last level the player reached */}
          <button className="hole-start-big" onClick={() => { playPop(); setLevel(maxLevel); setPhase('play') }}>
            <span className="hole-start-icon">▶️</span>
            <span>{t('hole.start')}</span>
            <span className="hole-start-lvl">{t('hole.level')} {maxLevel}</span>
          </button>
          <div className="hole-home-row">
            <button className="hole-launch" onClick={() => { playPop(); setPickerOpen(true) }} aria-label={t('hole.pick')}>
              <span className="sw-holder pick"><span className={`sw sw-${sw}`} style={{ ['--c' as string]: swColor }}>{swFeatures(sw)}</span></span>
              <span className="hole-launch-lbl">{t(`hole.sw.${sw}`)}</span>
            </button>
            <button className="hole-launch" onClick={() => { playPop(); setPhase('album') }} aria-label={t('album.title')}>
              <span className="hole-launch-icon">📖</span>
              <span className="hole-launch-lbl">{t('album.title')}</span>
            </button>
            <button className="hole-launch" onClick={() => { playPop(); setPhase('map') }} aria-label={t('hole.map.title')}>
              <span className="hole-launch-icon">🗺️</span>
              <span className="hole-launch-lbl">{t('hole.map.title')}</span>
            </button>
            <button className="hole-launch" onClick={() => { playPop(); setPhase('count') }} aria-label={t('hole.count')}>
              <span className="hole-launch-icon">🔢</span>
              <span className="hole-launch-lbl">{t('hole.count')}</span>
              {countDone.includes(difficulty) && <span className="hole-launch-check" aria-hidden="true">✓</span>}
            </button>
          </div>
        </div>
        {pickerOpen && (
          <div className="hole-pick-modal" onClick={() => setPickerOpen(false)}>
            <div className="hole-pick-sheet" onClick={(e) => e.stopPropagation()}>
              <button className="album-detail-x" onClick={() => setPickerOpen(false)} aria-label="✕">✕</button>
              <p className="hole-pick-title">{t('hole.pick')}</p>
              <div className="hole-pick compact">
                {SWALLOWERS.map((s) => (
                  <button key={s.id} className={`hole-pick-btn ${sw === s.id ? 'sel' : ''}`} onClick={() => { playPop(); setSw(s.id); setPickerOpen(false) }}>
                    <span className="sw-holder pick"><span className={`sw sw-${s.id}`} style={{ ['--c' as string]: s.color }}>{swFeatures(s.id)}</span></span>
                    <span>{t(`hole.sw.${s.id}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </GameShell>
    )
  }

  return (
    <GameShell title={t('game.hole')} emoji="🕳️" onExit={() => setPhase('map')} levels={{ gameId: 'hole', tiers: LEVEL_TIERS }}>
      <Confetti active={party} calm />
      <div className="hole-fs" ref={fsRef}>
        <div className="hole-hud">
          <span className="hole-level">{t('hole.level')} {level}</span>
          <span className="hole-eaten">😋 {eaten}</span>
          <span className="hole-targets">
            {targets.map((tgt, i) => (
              <span key={i} className={`hole-tgt ${tgt.got >= tgt.need ? 'ok' : ''}`}>{tgt.icon}<b>{Math.max(0, tgt.need - tgt.got)}</b></span>
            ))}
          </span>
        </div>
        {/* growth indicator: fills with each bite, the next thing's icon at the end */}
        <div className={`hole-grow ${grew ? 'pop' : ''}`}>
          <span className="hg-bar"><span className="hg-fill" style={{ width: `${prog * 100}%` }} /></span>
          <span className="hg-next">{nextIcon}</span>
        </div>
        <div className="hole3d-wrap">
          <div className="hole3d-canvas" ref={mountRef} />
          <div className="hole-arrow" ref={arrowRef} aria-hidden="true"><span className="arr-tip" /></div>
          <button className="hole-fs-btn" onClick={toggleFs} aria-label={t('hole.fullscreen')}>{fs ? '✕' : '⛶'}</button>
          {grew && <div className="hole-grew">⬆️ {t('hole.grew')}</div>}
          {met && <div className="hole-met">🎁 {t('hole.met')}</div>}
          {boss && <div className="hole-met hole-boss">🏆 {t('hole.boss')}</div>}
          {discover && (
            <div className="hole-discover" key={discover.name}>
              {t('hole.discover.toast', { emoji: discover.emoji, name: discover.name })}
            </div>
          )}
          {done && (
            <div className="hole-done">
              <p>🎉 {t('hole.done')}</p>
              <button className="big-button" onClick={() => { playPop(); setParty(false); setLevel((n) => n + 1) }}>➡️ {t('hole.next')}</button>
              <button className="big-button hole-map-btn" onClick={() => { playPop(); setParty(false); setPhase('map') }}>🗺️ {t('hole.map')}</button>
            </div>
          )}
        </div>
      </div>
      <p className="sport-hint">{t('hole.hint')}</p>
    </GameShell>
  )
}
