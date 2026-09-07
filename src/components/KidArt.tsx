// Cute cartoon kids (boy / girl) for the potty-training game. Front-facing chibi,
// drawn as SVG in a warm, hand-drawn "Open Peeps"-style: soft outline strokes, a
// muted/calm palette (no neon — this is for a sensory-sensitive child), and a
// gentle face. The bottom garments are SEPARATE, ANIMATABLE layers so the game
// can show them slide down and off, step by step:
//   • pants  (.kid-pants)  — worn over the diaper / on their own
//   • diaper (.kid-diaper) — under the pants
// `removing` adds a class that runs the slide-down-and-off keyframe on that layer,
// so a child sees the garment actually come off (not just blink away).
// For a BOY, when he's undressed and aiming, a small tasteful בולבול is drawn and
// the "pee" is a yellow stream flowing FROM it into the toilet (so a boy learns to aim).
// (The character is our own art in the Open Peeps hand-drawn STYLE — the real Open
//  Peeps assets are adult, whole-body figures that can't undress or carry a bulbul.)
import type { ReactElement } from 'react'

export type KidGender = 'boy' | 'girl'
export type Removing = 'pants' | 'diaper' | null

const INK = '#4b3b3d' // warm dark outline (hand-drawn feel)
const stroke = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function GentleEye({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5.2} fill="#3a2e30" />
      <circle cx={cx - 1.8} cy={cy - 2.2} r={1.9} fill="#fff" />
    </g>
  )
}

export default function KidArt({
  gender,
  pantsOn = true,
  diaperOn = false,
  removing = null,
  bulbul = false,
  peeing = false,
  washing = false,
}: {
  gender: KidGender
  pantsOn?: boolean
  diaperOn?: boolean
  removing?: Removing
  /** boy only: show the little בולבול (so a boy learns to aim); only when undressed. */
  bulbul?: boolean
  /** boy only: a yellow pee stream flowing FROM the bulbul (into the toilet). */
  peeing?: boolean
  /** hands meet in front and rub with soap foam — shown at the sink. */
  washing?: boolean
}): ReactElement {
  // muted, warm palette — nothing neon
  const skin = '#f1c69f'
  const skinD = '#e0a877'
  const hair = gender === 'boy' ? '#6d4327' : '#78492c'
  const shirt = gender === 'boy' ? '#6bb6a3' : '#e5a0b5'
  const pants = gender === 'boy' ? '#5f82c1' : '#bd79a6'
  return (
    <svg className="kid-svg" viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="kidSoft" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#6a4a2a" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter="url(#kidSoft)">
        {/* legs (always) — soft capsules with a hand-drawn outline */}
        <rect x="46" y="139" width="13" height="44" rx="6.5" fill={skin} {...stroke} />
        <rect x="61" y="139" width="13" height="44" rx="6.5" fill={skin} {...stroke} />
        <ellipse cx="52" cy="185" rx="9.5" ry="6" fill={skinD} {...stroke} />
        <ellipse cx="68" cy="185" rx="9.5" ry="6" fill={skinD} {...stroke} />

        {/* diaper layer (under the pants) */}
        {diaperOn && (
          <g className={`kid-diaper${removing === 'diaper' ? ' removing' : ''}`}>
            <path
              d="M37 122 H83 C 84 138 75 156 60 156 C 45 156 36 138 37 122 Z"
              fill="#fbfdff"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path d="M37 128 H83" stroke="#cfe0f0" strokeWidth="3" strokeLinecap="round" />
            <circle cx="48" cy="118" r="4" fill="#ffd5e6" />
            <circle cx="72" cy="118" r="4" fill="#cfe6ff" />
          </g>
        )}

        {/* pants layer (over the diaper, or on their own) */}
        {pantsOn && (
          <g className={`kid-pants${removing === 'pants' ? ' removing' : ''}`}>
            <path
              d="M36 120 H84 L 82 150 C 82 158 70 158 60 153 C 50 158 38 158 38 150 Z"
              fill={pants}
              stroke={INK}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path d="M36 125 H84" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}

        {/* body / shirt */}
        <path
          d="M41 99 C 41 91 79 91 79 99 L 81 131 C 81 139 39 139 39 131 Z"
          fill={shirt}
          {...stroke}
        />
        {/* arms — at the sides normally; while WASHING they angle in and the hands
            meet in front with soap foam, so the child clearly sees the hand-wash */}
        {washing ? (
          <g className="kid-washing">
            <rect x="33" y="102" width="12" height="32" rx="6" fill={skin} {...stroke} transform="rotate(-35 39 104)" />
            <rect x="75" y="102" width="12" height="32" rx="6" fill={skin} {...stroke} transform="rotate(35 81 104)" />
            <circle cx="55" cy="129" r="6.5" fill={skin} {...stroke} />
            <circle cx="65" cy="129" r="6.5" fill={skin} {...stroke} />
            <circle className="kw-foam kw-f1" cx="60" cy="119" r="5" fill="#fff" opacity="0.9" />
            <circle className="kw-foam kw-f2" cx="51" cy="123" r="3.6" fill="#fff" opacity="0.85" />
            <circle className="kw-foam kw-f3" cx="69" cy="123" r="3.2" fill="#fff" opacity="0.85" />
          </g>
        ) : (
          <g>
            <rect x="31" y="101" width="12" height="35" rx="6" fill={skin} {...stroke} />
            <rect x="77" y="101" width="12" height="35" rx="6" fill={skin} {...stroke} />
          </g>
        )}

        {/* the little בולבול (boy only, when undressed) — so a boy learns to AIM, and
            the pee clearly comes out of IT. Small, cartoon, below the shirt hem, in front. */}
        {gender === 'boy' && bulbul && (
          <g className="kid-bulbul">
            <rect x="56" y="132" width="8" height="12" rx="4" fill={skinD} stroke={INK} strokeWidth="1.4" />
            <ellipse cx="60" cy="145" rx="4.7" ry="4" fill={skinD} stroke={INK} strokeWidth="1.1" />
          </g>
        )}
        {/* the pee — a yellow flowing arc straight out of the bulbul TIP, forward into
            the toilet bowl in front of him (overflows the svg toward the bowl). */}
        {gender === 'boy' && peeing && (
          <g className="kid-pee" aria-hidden="true">
            <path className="kp-flow" d="M60 148 Q 95 156 134 150" />
            <circle className="kp-drop kp-d1" r="3" />
            <circle className="kp-drop kp-d2" r="2.5" />
            <circle className="kp-drop kp-d3" r="2.2" />
          </g>
        )}

        {/* head */}
        <ellipse cx="60" cy="62" rx="37" ry="35" fill={skin} {...stroke} />
        {/* hair (outlined, hand-drawn) */}
        {gender === 'boy' ? (
          <path
            d="M25 57 C 23 27 97 27 95 57 C 89 44 77 38 60 38 C 43 38 31 44 25 57 Z"
            fill={hair}
            {...stroke}
          />
        ) : (
          <g>
            <path
              d="M25 60 C 23 25 97 25 95 60 C 89 43 77 35 60 35 C 43 35 31 43 25 60 Z"
              fill={hair}
              {...stroke}
            />
            <ellipse cx="23" cy="74" rx="10" ry="15" fill={hair} {...stroke} />
            <ellipse cx="97" cy="74" rx="10" ry="15" fill={hair} {...stroke} />
            <circle cx="31" cy="41" r="5.5" fill="#e39aae" stroke={INK} strokeWidth="1.6" />
          </g>
        )}
        {/* face — gentle & calm */}
        <GentleEye cx={49} cy={63} />
        <GentleEye cx={71} cy={63} />
        <path d="M55 76 C 58 80 62 80 65 76" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <ellipse cx="39" cy="73" rx="6" ry="4" fill="#eaa1a8" opacity="0.6" />
        <ellipse cx="81" cy="73" rx="6" ry="4" fill="#eaa1a8" opacity="0.6" />
      </g>
    </svg>
  )
}
