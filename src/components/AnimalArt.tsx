// Real-animal pets for the "My Friend" (Tamagotchi) game. Each is a soft, rounded,
// plush SVG (radial-gradient volume, no hard outline) based on beloved cute
// characters — dog≈Cinnamoroll+Pompompurin, cat≈Pusheen+Angela, rabbit≈My Melody,
// parrot≈cute cockatiel. Three life stages (baby → juvenile → adult) via the "Pou
// trick": the head stays a constant size and the BODY grows; the baby also gets a
// slightly younger face (bigger, lower eyes).
import type { CSSProperties, ReactElement } from 'react'

export type AnimalKind = 'dog' | 'cat' | 'rabbit' | 'parrot'

export const ANIMAL_KINDS: AnimalKind[] = ['dog', 'cat', 'rabbit', 'parrot']

export const ANIMAL_NAMES: Record<AnimalKind, string> = {
  dog: 'כלב',
  cat: 'חתול',
  rabbit: 'ארנב',
  parrot: 'תוכי',
}

export const ANIMAL_EMOJI: Record<AnimalKind, string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  parrot: '🦜',
}

export const ANIMAL_NATURAL: Record<AnimalKind, { w: number; h: number }> = {
  dog: { w: 156, h: 168 },
  cat: { w: 156, h: 172 },
  rabbit: { w: 150, h: 196 },
  parrot: { w: 150, h: 178 },
}

export const animalMaxDim = (k: AnimalKind) => Math.max(ANIMAL_NATURAL[k].w, ANIMAL_NATURAL[k].h)

type Props = {
  kind: AnimalKind
  walking?: boolean
  eating?: boolean
  /** life stage: 0 = baby (tiny body, younger face), 1 = juvenile, 2 = adult */
  stage?: number
  /** "Alive" — gentle staggered eye-blink (for the featured pet, not a picker thumbnail). */
  lively?: boolean
  /** Face-borne emotion — morphs the muzzle mouth / beak line (smile / neutral /
   *  soft frown), crossfaded in CSS. Default 'smile' keeps the happy resting face. */
  mood?: 'smile' | 'neutral' | 'frown'
}

// the "Pou trick": HEAD stays a constant size across stages; the BABY just has a
// tiny round body (head naturally dominates) and is the shortest; the ADULT grows
// a full body. (A baby is NOT made by enlarging the head.)
function stageT(stage: number) {
  const bs = [0.67, 0.84, 1][stage] ?? 1 // body scale (chubby baby, not skinny)
  const dy = [14, 6, 0][stage] ?? 0 // head drops onto the smaller body (no gap)
  return {
    head: `translate(0 ${dy})`,
    body: `translate(100 205) scale(${bs}) translate(-100 -205)`,
  }
}

// a big, low-set, GLOSSY eye: dark iris + a large catchlight up-left + a small sparkle.
// the `an-eye` class lets the pet game squish it shut for a blink (scaleY, CSS-driven).
function Eye({ cx, cy, grad, rx = 13.5, ry = 16.5 }: { cx: number; cy: number; grad: string; rx?: number; ry?: number }) {
  return (
    <g className="an-eye">
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${grad})`} />
      <circle cx={cx - rx * 0.36} cy={cy - ry * 0.4} r={rx * 0.44} fill="#fff" />
      <circle cx={cx + rx * 0.38} cy={cy + ry * 0.34} r={rx * 0.2} fill="#fff" opacity="0.85" />
    </g>
  )
}

// ears grow with age (research: a baby's ears are small/folded; they unfold &
// lengthen as it grows). Scales the ears around their root at the top of the head.
function earT(stage: number, py: number) {
  const es = [0.72, 0.87, 1][stage] ?? 1 // small but present on the baby (never bald)
  return `translate(100 ${py}) scale(${es}) translate(-100 -${py})`
}

// both eyes, with a YOUNGER face for the baby: bigger + lower + a touch wider-set
// (this is what reads as "younger" — not a bigger head).
function FaceEyes({ dx, cy, grad, stage, rx = 13.5, ry = 16.5 }: { dx: number; cy: number; grad: string; stage: number; rx?: number; ry?: number }) {
  const es = [1.18, 1.08, 1][stage] ?? 1
  const dyv = [3.5, 1.5, 0][stage] ?? 0
  const t = `translate(0 ${dyv}) translate(100 ${cy}) scale(${es}) translate(-100 -${cy})`
  return (
    <g transform={t}>
      <Eye cx={100 - dx} cy={cy} grad={grad} rx={rx} ry={ry} />
      <Eye cx={100 + dx} cy={cy} grad={grad} rx={rx} ry={ry} />
    </g>
  )
}

/* ───────────────────────────── DOG (Cinnamoroll + Pompompurin) ───────────────────────────── */
function DogSvg({ stage = 2 }: { stage?: number }) {
  const t = stageT(stage)
  return (
    <svg className="an-svg" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="dgFur" cx="40%" cy="30%" r="78%"><stop offset="0%" stopColor="#f6d29c" /><stop offset="55%" stopColor="#dca164" /><stop offset="100%" stopColor="#b3793c" /></radialGradient>
        <radialGradient id="dgEar" cx="42%" cy="22%" r="90%"><stop offset="0%" stopColor="#cb9258" /><stop offset="100%" stopColor="#9a6330" /></radialGradient>
        <radialGradient id="dgMuz" cx="50%" cy="32%" r="75%"><stop offset="0%" stopColor="#fff6e6" /><stop offset="100%" stopColor="#efd4ab" /></radialGradient>
        <radialGradient id="dgEye" cx="38%" cy="30%" r="80%"><stop offset="0%" stopColor="#5a4030" /><stop offset="70%" stopColor="#140c06" /></radialGradient>
        <filter id="dgSoft" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3a1d05" floodOpacity="0.26" /></filter>
        {/* fur was roughened by a feTurbulence/feDisplacement filter, but that re-rasterizes
            every frame during walk/bob/breathe — dropped for smoothness (radial gradients
            already give the plush volume). */}
      </defs>
      <g filter="url(#dgSoft)">
        <g transform={t.body}>
          <g className="an-tail"><path d="M150 158 C 180 152 184 124 168 116 C 172 134 158 148 150 154 Z" fill="url(#dgFur)" /></g>
          <ellipse cx="100" cy="158" rx="52" ry="46" fill="url(#dgFur)" />
          <ellipse cx="100" cy="172" rx="30" ry="26" fill="#f7e6c8" />
          <ellipse cx="82" cy="196" rx="15" ry="11" fill="url(#dgFur)" />
          <ellipse cx="118" cy="196" rx="15" ry="11" fill="url(#dgFur)" />
        </g>
        <g transform={t.head}>
          <g>
            <g className="an-ears"><g transform={earT(stage, 58)}>
              <path d="M56 54 C 14 46 8 120 32 142 C 52 132 58 86 64 60 Z" fill="url(#dgEar)" />
              <path d="M144 54 C 186 46 192 120 168 142 C 148 132 142 86 136 60 Z" fill="url(#dgEar)" />
            </g></g>
            <ellipse cx="100" cy="84" rx="58" ry="54" fill="url(#dgFur)" />
            <circle cx="124" cy="80" r="21" fill="#a9652e" opacity="0.8" />
            <ellipse cx="100" cy="108" rx="33" ry="25" fill="url(#dgMuz)" />
          </g>
          <FaceEyes dx={23} cy={94} grad="dgEye" stage={stage} />
          <ellipse cx="100" cy="105" rx="6" ry="5" fill="#241a13" />
          <path className="an-mouth" d="M100 110 C 96 117 90 116 88 112 M100 110 C 104 117 110 116 112 112" fill="none" stroke="#3a2a1c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="58" cy="110" rx="12" ry="7.5" fill="#f4a0ad" opacity="0.72" />
          <ellipse cx="142" cy="110" rx="12" ry="7.5" fill="#f4a0ad" opacity="0.72" />
        </g>
      </g>
    </svg>
  )
}

/* ───────────────────────────── CAT (Pusheen + Talking Angela) ───────────────────────────── */
function CatSvg({ stage = 2 }: { stage?: number }) {
  const t = stageT(stage)
  return (
    <svg className="an-svg" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="ctFur" cx="40%" cy="28%" r="80%"><stop offset="0%" stopColor="#dfe3e8" /><stop offset="55%" stopColor="#abb1b9" /><stop offset="100%" stopColor="#7d848e" /></radialGradient>
        <radialGradient id="ctMuz" cx="50%" cy="32%" r="75%"><stop offset="0%" stopColor="#fbfcfd" /><stop offset="100%" stopColor="#dadee3" /></radialGradient>
        <radialGradient id="ctEye" cx="38%" cy="30%" r="80%"><stop offset="0%" stopColor="#4a5040" /><stop offset="70%" stopColor="#12140d" /></radialGradient>
        <filter id="ctSoft" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2a2f37" floodOpacity="0.24" /></filter>
        {/* fur-roughening displacement filter dropped (per-frame re-raster during motion) */}
      </defs>
      <g filter="url(#ctSoft)">
        <g transform={t.body}>
          <g className="an-tail"><path d="M150 170 C 176 152 180 116 162 110 C 164 134 152 152 146 162 Z" fill="url(#ctFur)" /></g>
          <ellipse cx="100" cy="160" rx="50" ry="44" fill="url(#ctFur)" />
          <ellipse cx="100" cy="174" rx="28" ry="24" fill="#eceff2" />
          <ellipse cx="84" cy="196" rx="14" ry="10" fill="url(#ctFur)" />
          <ellipse cx="116" cy="196" rx="14" ry="10" fill="url(#ctFur)" />
        </g>
        <g transform={t.head}>
          <g>
            <g className="an-ears"><g transform={earT(stage, 48)}>
              <path d="M60 54 L50 16 L92 42 Z" fill="url(#ctFur)" />
              <path d="M140 54 L150 16 L108 42 Z" fill="url(#ctFur)" />
              <path d="M64 50 L58 28 L84 44 Z" fill="#f2b6c6" />
              <path d="M136 50 L142 28 L116 44 Z" fill="#f2b6c6" />
            </g></g>
            <ellipse cx="100" cy="86" rx="56" ry="52" fill="url(#ctFur)" />
            <ellipse cx="100" cy="108" rx="30" ry="22" fill="url(#ctMuz)" />
          </g>
          <FaceEyes dx={22} cy={94} grad="ctEye" stage={stage} rx={13} ry={16} />
          <path d="M100 104 L94 109 L106 109 Z" fill="#ef9bb0" />
          <path className="an-mouth" d="M100 109 C 96 115 91 114 89 110 M100 109 C 104 115 109 114 111 110" fill="none" stroke="#6a6570" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <g stroke="#9aa0a8" strokeWidth="1.8" strokeLinecap="round">
            <path d="M72 108 L40 103 M72 114 L40 117" />
            <path d="M128 108 L160 103 M128 114 L160 117" />
          </g>
          <ellipse cx="60" cy="110" rx="11" ry="7" fill="#f4a0ad" opacity="0.62" />
          <ellipse cx="140" cy="110" rx="11" ry="7" fill="#f4a0ad" opacity="0.62" />
        </g>
      </g>
    </svg>
  )
}

/* ───────────────────────────── RABBIT (My Melody) ───────────────────────────── */
function RabbitSvg({ stage = 2 }: { stage?: number }) {
  const t = stageT(stage)
  const ears = earT(stage, 60) // a baby bunny has short little ears that grow long
  return (
    <svg className="an-svg" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="rbFur" cx="40%" cy="28%" r="82%"><stop offset="0%" stopColor="#ffffff" /><stop offset="58%" stopColor="#eeecf2" /><stop offset="100%" stopColor="#d2cfdc" /></radialGradient>
        <radialGradient id="rbEye" cx="38%" cy="30%" r="80%"><stop offset="0%" stopColor="#4a4452" /><stop offset="70%" stopColor="#151120" /></radialGradient>
        <filter id="rbSoft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3a3550" floodOpacity="0.2" /></filter>
        {/* fur-roughening displacement filter dropped (per-frame re-raster during motion) */}
      </defs>
      <g filter="url(#rbSoft)">
        <g transform={t.body}>
          <g className="an-tail"><ellipse cx="150" cy="150" rx="16" ry="14" fill="#f4f2f7" /></g>
          <ellipse cx="100" cy="160" rx="48" ry="42" fill="url(#rbFur)" />
          <ellipse cx="100" cy="174" rx="27" ry="22" fill="#fbfafd" />
          <ellipse cx="84" cy="196" rx="14" ry="10" fill="url(#rbFur)" />
          <ellipse cx="116" cy="196" rx="14" ry="10" fill="url(#rbFur)" />
        </g>
        <g transform={t.head}>
          <g>
            <g className="an-ears"><g transform={ears}>
              <path d="M76 62 C 56 6 40 6 52 50 C 60 64 70 64 78 60 Z" fill="url(#rbFur)" />
              <path d="M124 62 C 144 6 160 6 148 50 C 140 64 130 64 122 60 Z" fill="url(#rbFur)" />
              <path d="M72 56 C 60 22 52 22 58 48 C 63 57 69 57 73 55 Z" fill="#f6c2d4" />
              <path d="M128 56 C 140 22 148 22 142 48 C 137 57 131 57 127 55 Z" fill="#f6c2d4" />
            </g></g>
            <ellipse cx="100" cy="90" rx="52" ry="50" fill="url(#rbFur)" />
            <ellipse cx="100" cy="110" rx="28" ry="21" fill="#fbfafd" />
          </g>
          <FaceEyes dx={22} cy={96} grad="rbEye" stage={stage} rx={13} ry={16} />
          <path d="M100 106 L95 110 L105 110 Z" fill="#ef9bb0" />
          <path className="an-mouth" d="M100 110 C 97 115 92 114 90 111 M100 110 C 103 115 108 114 110 111" fill="none" stroke="#a99fb8" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="60" cy="112" rx="11" ry="7" fill="#f7adba" opacity="0.62" />
          <ellipse cx="140" cy="112" rx="11" ry="7" fill="#f7adba" opacity="0.62" />
        </g>
      </g>
    </svg>
  )
}

/* ───────────────────────────── PARROT (cute cockatiel) ───────────────────────────── */
function ParrotSvg({ stage = 2 }: { stage?: number }) {
  const t = stageT(stage)
  return (
    <svg className="an-svg" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="prBody" cx="40%" cy="28%" r="80%"><stop offset="0%" stopColor="#8be08f" /><stop offset="55%" stopColor="#52bf6a" /><stop offset="100%" stopColor="#2f9b4f" /></radialGradient>
        <radialGradient id="prWing" cx="40%" cy="28%" r="85%"><stop offset="0%" stopColor="#4fb6e0" /><stop offset="100%" stopColor="#2f86c0" /></radialGradient>
        <radialGradient id="prHead" cx="42%" cy="26%" r="80%"><stop offset="0%" stopColor="#fbe27a" /><stop offset="60%" stopColor="#f4c93f" /><stop offset="100%" stopColor="#e0a81f" /></radialGradient>
        <linearGradient id="prBeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffb04a" /><stop offset="100%" stopColor="#e07c1e" /></linearGradient>
        <radialGradient id="prEye" cx="38%" cy="30%" r="80%"><stop offset="0%" stopColor="#4a4030" /><stop offset="70%" stopColor="#140c06" /></radialGradient>
        <filter id="prSoft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1d5a2a" floodOpacity="0.24" /></filter>
      </defs>
      <g filter="url(#prSoft)">
        <g transform={t.body}>
          {/* long tail feathers */}
          <g className="an-tail">
            <path d="M96 168 C 92 200 96 214 104 214 C 112 214 116 200 112 168 Z" fill="url(#prWing)" />
            <path d="M108 170 C 116 198 126 206 132 200 C 128 184 118 174 110 168 Z" fill="#3a9e4f" />
          </g>
          <ellipse cx="100" cy="156" rx="50" ry="46" fill="url(#prBody)" />
          <ellipse cx="100" cy="168" rx="30" ry="28" fill="#cdeccf" />
          {/* folded wings on the sides */}
          <path d="M54 140 C 40 150 42 178 58 184 C 64 168 62 150 60 140 Z" fill="url(#prWing)" />
          <path d="M146 140 C 160 150 158 178 142 184 C 136 168 138 150 140 140 Z" fill="url(#prWing)" />
          {/* feet */}
          <path d="M88 196 l-6 8 M88 196 l0 9 M88 196 l6 8" stroke="#e07c1e" strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M112 196 l-6 8 M112 196 l0 9 M112 196 l6 8" stroke="#e07c1e" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        </g>
        <g transform={t.head}>
          {/* crest — a small soft tuft on the baby (fluffy, not bald), full on the adult */}
          <g className="an-ears"><g transform={`translate(100 42) scale(${[0.58, 0.8, 1][stage] ?? 1}) translate(-100 -42)`}>
            <path d="M88 44 C 84 18 92 16 96 38 Z" fill="#f4c93f" />
            <path d="M100 40 C 98 12 106 12 106 38 Z" fill="#fbe27a" />
            <path d="M112 44 C 116 18 108 16 104 38 Z" fill="#f4c93f" />
          </g></g>
          <ellipse cx="100" cy="86" rx="55" ry="52" fill="url(#prHead)" />
          {/* coral cockatiel cheek circles (double as blush) */}
          <circle cx="62" cy="104" r="13" fill="#f6915a" opacity="0.85" />
          <circle cx="138" cy="104" r="13" fill="#f6915a" opacity="0.85" />
          <FaceEyes dx={23} cy={88} grad="prEye" stage={stage} />
          {/* hooked beak */}
          <path d="M84 100 C 90 95 110 95 116 100 C 114 110 108 118 100 124 C 92 118 86 110 84 100 Z" fill="url(#prBeak)" />
          <path className="an-mouth" d="M88 106 C 94 110 106 110 112 106" fill="none" stroke="#c96a18" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

const SVG: Record<string, (p: { stage?: number }) => ReactElement> = {
  dog: DogSvg,
  cat: CatSvg,
  rabbit: RabbitSvg,
  parrot: ParrotSvg,
}

export default function AnimalArt({ kind, walking = false, eating = false, stage = 2, lively = false, mood = 'smile' }: Props) {
  const Art = SVG[kind] ?? DogSvg
  const stageClass = stage === 0 ? 'stage-cub' : stage === 1 ? 'stage-teen' : 'stage-adult'
  // stagger the blink a touch per species so the eyes don't feel metronomic
  const liveStyle = lively ? ({ '--blink-delay': `${ANIMAL_KINDS.indexOf(kind) * 0.7}s` } as CSSProperties) : undefined
  return (
    <div
      className={`friend-art animal animal-${kind} an-svg-wrap mood-${mood} ${stageClass} ${walking ? 'is-walking' : ''} ${eating ? 'is-eating' : ''} ${lively ? 'is-lively' : ''}`}
      style={liveStyle}
    >
      <Art stage={stage} />
    </div>
  )
}
