import * as THREE from 'three'
import { BIG, BIG_KINDS, friendKindForIndex } from './FriendArt'

// Build ANY data-driven friend (11–100) as a 3D model, straight from the same
// `BIG` table the 2D art uses: each friend is a grid of round "bumps" whose count
// is its number. Overlapping spheres fuse into one soft blob; on top we add a flat
// cartoon face, tapered arms with mitt hands, little feet, the friend's accessory,
// and a floating number — all in its own colour, with a soft cel/toon shade.

export type Friend3DRig = {
  group: THREE.Group
  inner: THREE.Group
  bumps: THREE.Mesh[]
  armL: THREE.Group
  armR: THREE.Group
  bc: THREE.Color
}

const STEP_H = 1 - 0.16
const STEP_V = 1 - 0.26
const R = 0.6

// smooth, soft shading (the toon/cel band looked menacing on the small smooth
// bodies — a dark crescent across the face). Standard material reads cute.
const mat = (c: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.5, metalness: 0 })
// flat, UNLIT material — the trick for eyes that read as painted-on cartoon shapes
const flat = (c: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c) })

type Spec = { rows: number[]; bc: string; shoe: string; face: 'plain' | 'girl'; acc?: string }
const SMALL: Spec[] = [
  { rows: [1], bc: '#ef4444', shoe: '#b91c1c', face: 'plain', acc: 'bow' }, // 1 lulu
  { rows: [2], bc: '#f97316', shoe: '#1e3a8a', face: 'plain', acc: 'cap' }, // 2 toki
  { rows: [3], bc: '#f59e0b', shoe: '#1e3a8a', face: 'plain' }, // 3 bobby
  { rows: [2, 2], bc: '#22c55e', shoe: '#1e3a8a', face: 'girl' }, // 4 gogo
  { rows: [3, 2], bc: '#14b8a6', shoe: '#1e3a8a', face: 'plain', acc: 'glasses' }, // 5 moki
  { rows: [3, 3], bc: '#06b6d4', shoe: '#db2777', face: 'girl', acc: 'flower' }, // 6 nuni
  { rows: [3, 4], bc: '#3b82f6', shoe: '#1e3a8a', face: 'plain', acc: 'crown' }, // 7 piko
  { rows: [4, 4], bc: '#6366f1', shoe: '#1e3a8a', face: 'plain', acc: 'earmuffs' }, // 8 dudi
  { rows: [3, 3, 3], bc: '#8b5cf6', shoe: '#1e3a8a', face: 'plain' }, // 9 zuzu
  { rows: [3, 4, 3], bc: '#ec4899', shoe: '#1e3a8a', face: 'girl', acc: 'tiara' }, // 10 koko
]

function bumpCenters(rows: number[]) {
  const maxCols = Math.max(...rows)
  const w = 1 + (maxCols - 1) * STEP_H
  const h = 1 + (rows.length - 1) * STEP_V
  const centers: { x: number; y: number }[] = []
  rows.forEach((c, r) => {
    const rowW = 1 + (c - 1) * STEP_H
    const rowLeft = (w - rowW) / 2
    const cy = r * STEP_V + 0.5
    for (let j = 0; j < c; j++) {
      const cx = rowLeft + j * STEP_H + 0.5
      centers.push({ x: cx - w / 2, y: h / 2 - cy })
    }
  })
  return { centers, w, h, maxCols }
}

// A flat cartoon eye that matches the 2D friends: a white disc with a thin dark
// rim, a MEDIUM centred pupil (~half the eye — not a huge one) and one small glint.
// `r` is the eye radius, so it scales with the friend. Unlit → reads as drawn-on.
function makeEye(x: number, y: number, z: number, r: number) {
  const g = new THREE.Group()
  const rim = new THREE.Mesh(new THREE.CircleGeometry(r * 1.12, 32), flat(0x1a1a1a))
  rim.scale.set(1, 1.14, 1)
  const white = new THREE.Mesh(new THREE.CircleGeometry(r, 32), flat(0xffffff))
  white.scale.set(1, 1.14, 1)
  white.position.z = 0.01
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 28), flat(0x1a1a1a))
  pupil.scale.set(1, 1.1, 1)
  pupil.position.z = 0.02
  const glint = new THREE.Mesh(new THREE.CircleGeometry(r * 0.17, 12), flat(0xffffff))
  glint.position.set(-r * 0.16, r * 0.22, 0.03)
  g.add(rim, white, pupil, glint)
  g.position.set(x, y, z)
  return g
}

// A short, stubby DARK arm (like the 2D friends' nub + round hand) — not a long
// body-coloured limb. `len` scales it with the friend. Pivots at the shoulder.
function makeArm(side: number, x: number, y: number, len: number) {
  const shoulder = new THREE.Group()
  const dark = 0x34343f
  const stub = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.42, len * 0.8, 6, 12), mat(dark))
  stub.position.y = -len * 0.5
  const hand = new THREE.Mesh(new THREE.SphereGeometry(len * 0.52, 16, 16), mat(dark))
  hand.position.y = -len
  shoulder.add(stub, hand)
  shoulder.position.set(side * x, y, 0.12)
  return shoulder
}

function starShape(outer: number, inner: number, spikes = 5) {
  const s = new THREE.Shape()
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)
  }
  s.closePath()
  return s
}

// The friend's accessory, in 3D. Head-top pieces sit at the crown; glasses sit on
// the face. Returns null for any we haven't modelled yet.
function makeAccessory(acc: string | undefined, h: number, faceY: number, faceZ: number, halfW: number, limb: THREE.Color) {
  if (!acc) return null
  const g = new THREE.Group()
  const topY = h / 2
  switch (acc) {
    case 'cone': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 22), mat('#f43f5e'))
      cone.position.y = 0.4
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), mat('#fde047'))
      pom.position.y = 0.82
      g.add(cone, pom)
      g.position.set(0, topY - 0.05, 0.06)
      break
    }
    case 'cap': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2563eb'))
      const brim = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 18), mat('#1d4ed8'))
      brim.scale.set(1, 0.16, 1)
      brim.position.set(0, 0.0, 0.36)
      g.add(dome, brim)
      g.position.set(0, topY - 0.06, 0.05)
      break
    }
    case 'sunglasses':
    case 'glasses': {
      const dark = acc === 'sunglasses'
      const lensMat = dark ? flat(0x1f2530) : flat(0x9ec5ff)
      for (const s of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), lensMat)
        lens.scale.set(1, 0.86, 1)
        lens.position.set(s * 0.27, 0, 0)
        g.add(lens)
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 24), mat('#1f2937'))
        rim.scale.set(1, 0.86, 1)
        rim.position.set(s * 0.27, 0, 0.005)
        g.add(rim)
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), mat('#1f2937'))
      g.add(bridge)
      g.position.set(0, faceY + 0.02, faceZ + 0.07)
      return g
    }
    case 'bunnyears': {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), mat('#fbcfe8'))
        ear.scale.set(0.6, 1.8, 0.5)
        ear.position.set(s * 0.2, 0.55, 0)
        ear.rotation.z = s * 0.12
        g.add(ear)
      }
      g.position.set(0, topY - 0.05, 0.05)
      break
    }
    case 'catears': {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 4), mat(limb))
        ear.position.set(s * 0.32, 0.34, 0)
        ear.rotation.z = s * -0.18
        g.add(ear)
      }
      g.position.set(0, topY - 0.08, 0.05)
      break
    }
    case 'star': {
      const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(0.28, 0.13), { depth: 0.06, bevelEnabled: false }), mat('#fde047'))
      star.position.set(0, topY + 0.34, 0.05)
      g.add(star)
      break
    }
    case 'earmuffs': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 10, 28, Math.PI), mat('#f43f5e'))
      band.position.set(0, topY - 0.02, 0)
      g.add(band)
      for (const s of [-1, 1]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), mat('#fb7185'))
        puff.position.set(s * (halfW + 0.12), faceY + 0.18, 0.1)
        g.add(puff)
      }
      break
    }
    case 'propeller': {
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), mat('#334155'))
      hub.position.y = topY + 0.36
      g.add(hub)
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.12), mat('#22d3ee'))
        blade.position.set(Math.cos(a) * 0.18, topY + 0.36, Math.sin(a) * 0.18)
        blade.rotation.y = a
        g.add(blade)
      }
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), mat('#334155'))
      stalk.position.y = topY + 0.26
      g.add(stalk)
      break
    }
    case 'beret': {
      const disc = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), mat('#dc2626'))
      disc.scale.set(1, 0.34, 1)
      disc.rotation.z = 0.18
      const nub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), mat('#dc2626'))
      nub.position.set(0.05, 0.18, 0)
      g.add(disc, nub)
      g.position.set(0, topY + 0.02, 0.05)
      break
    }
    case 'feather': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 24, Math.PI * 1.2), mat('#a16207'))
      band.position.set(0, topY - 0.02, 0.04)
      const feather = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), mat('#10b981'))
      feather.scale.set(0.42, 1.9, 0.3)
      feather.position.set(0.26, topY + 0.42, 0.05)
      feather.rotation.z = -0.4
      g.add(band, feather)
      break
    }
    case 'bow': {
      for (const s of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 18), mat('#fb7185'))
        loop.scale.set(1, 0.72, 0.42)
        loop.position.set(s * 0.2, 0, 0)
        g.add(loop)
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), mat('#f43f5e'))
      g.add(knot)
      g.position.set(0, topY + 0.12, 0.12)
      break
    }
    case 'crown': {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 22, 1, true), mat('#fbbf24'))
      g.add(band)
      for (const a of [-0.6, 0, 0.6]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 12), mat('#fbbf24'))
        spike.position.set(Math.sin(a) * 0.32, 0.16, Math.cos(a) * 0.32 * 0 + 0.0)
        spike.position.x = Math.sin(a) * 0.3
        spike.position.z = 0.0
        g.add(spike)
      }
      g.position.set(0, topY + 0.06, 0.05)
      break
    }
    case 'tiara': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24, Math.PI), mat('#f9a8d4'))
      band.position.y = 0.04
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 14), flat(0xff77c8))
      gem.position.set(0, 0.12, 0.02)
      g.add(band, gem)
      g.position.set(0, topY + 0.02, 0.06)
      break
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), mat('#f472b6'))
        petal.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0)
        g.add(petal)
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), mat('#fde047'))
      g.add(center)
      g.position.set(0.22, faceY + 0.5, faceZ)
      break
    }
    default:
      return null
  }
  return g
}

function makeNumberSprite(n: number, color: string) {
  const size = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  ctx.font = 'bold 150px Fredoka, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 22
  ctx.strokeStyle = color
  ctx.strokeText(String(n), size / 2, size / 2 + 8)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(n), size / 2, size / 2 + 8)
  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 4
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
}

export function buildFriend3D(index: number): Friend3DRig {
  const kind = friendKindForIndex(index)
  const isBig = (BIG_KINDS as readonly string[]).includes(kind)
  const spec = isBig ? BIG[kind as keyof typeof BIG] : (SMALL[index] ?? SMALL[0])
  const { centers, maxCols } = bumpCenters(spec.rows)
  const bc = new THREE.Color(spec.bc)
  const limbColor = bc.clone().multiplyScalar(0.85)
  const faceZ = R - 0.02
  // true visual extent of the blob (centres span + a bump radius each side)
  const vW = (maxCols - 1) * STEP_H + 2 * R
  const vH = (spec.rows.length - 1) * STEP_V + 2 * R
  const bodyHalfCenters = ((maxCols - 1) * STEP_H) / 2

  const inner = new THREE.Group()
  const bumps: THREE.Mesh[] = []
  const bumpGeo = new THREE.SphereGeometry(R, 32, 32)
  const bodyMat = mat(spec.bc)
  for (const c of centers) {
    const m = new THREE.Mesh(bumpGeo, bodyMat)
    m.position.set(c.x, c.y, 0)
    inner.add(m)
    bumps.push(m)
  }

  // face — eyes are 22% of the friend's width (like the 2D .gf-eye), set in the
  // upper third, fairly close together. Everything scales with the friend so the
  // small ones don't get giant features.
  const eyeR = 0.11 * vW
  const eyeX = 0.16 * vW
  const eyeY = vH / 2 - 0.36 * vH
  inner.add(makeEye(-eyeX, eyeY, faceZ + 0.03, eyeR), makeEye(eyeX, eyeY, faceZ + 0.03, eyeR))
  const mouthR = 0.16 * vW
  const mouthY = vH / 2 - 0.62 * vH
  if (spec.face === 'girl') {
    const lips = new THREE.Mesh(new THREE.TorusGeometry(mouthR * 0.9, mouthR * 0.32, 12, 24, Math.PI), flat(0xc81e54))
    lips.position.set(0, mouthY, faceZ + 0.03)
    lips.rotation.z = Math.PI
    inner.add(lips)
  } else {
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(mouthR, mouthR * 0.22, 12, 28, Math.PI), flat(0x3a0a12))
    mouth.position.set(0, mouthY, faceZ + 0.03)
    mouth.rotation.z = Math.PI
    inner.add(mouth)
  }
  // rosy cheeks just below + outside the eyes
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.42 })
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.74, 20), cheekMat)
    c.scale.set(1, 0.74, 1)
    c.position.set(s * (eyeX + eyeR * 0.9), eyeY - eyeR * 1.15, faceZ + 0.02)
    inner.add(c)
  }

  // feet — shoe-coloured, at the bottom, sized with the friend
  const footR = 0.16 * vW
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(footR, 20, 20), mat(spec.shoe))
    f.scale.set(1, 0.56, 1.3)
    f.position.set(s * 0.18 * vW, -vH / 2 + footR * 0.3, 0.28)
    inner.add(f)
  }

  // arms — short dark stubs at mid-height, just outside the body sides
  const armLen = 0.3 * vW
  const armX = bodyHalfCenters + R * 0.55
  const armY = vH * 0.06
  const armL = makeArm(-1, armX, armY, armLen)
  const armR = makeArm(1, armX, armY, armLen)
  inner.add(armL, armR)

  // accessory (hat / glasses / …)
  const acc = makeAccessory(spec.acc, vH, eyeY, faceZ, bodyHalfCenters + R, limbColor)
  if (acc) inner.add(acc)

  // frame to a constant size from the body+features (NOT the floating number)
  const group = new THREE.Group()
  group.add(inner)
  const box = new THREE.Box3().setFromObject(inner)
  const sizeV = new THREE.Vector3()
  box.getSize(sizeV)
  const centerV = new THREE.Vector3()
  box.getCenter(centerV)
  const maxDim = Math.max(sizeV.x, sizeV.y) || 1
  const scale = 3.4 / maxDim
  inner.position.sub(centerV)
  group.scale.setScalar(scale)

  // floating number above the head (added after framing so it doesn't shrink it)
  const num = makeNumberSprite(index + 1, spec.bc)
  num.scale.set(0.9, 0.9, 0.9)
  num.position.set(0, vH / 2 + 0.7, 0.4)
  inner.add(num)

  return { group, inner, bumps, armL, armR, bc }
}
