import type { CSSProperties } from 'react'

// A single "living letter" — a coloured body with googly eyes and a big letter,
// the Alphablocks-style character shared by the English games (Spell the Word,
// Rhyme Machine, …). Styling lives in app.css (.ll-guy and friends).
const LL_COLORS: [string, string][] = [
  ['#fb7185', '#e11d48'], ['#fbbf24', '#d97706'], ['#34d399', '#059669'],
  ['#38bdf8', '#0284c7'], ['#a78bfa', '#7c3aed'], ['#f472b6', '#db2777'],
  ['#facc15', '#ca8a04'], ['#2dd4bf', '#0d9488'], ['#60a5fa', '#4338ca'],
  ['#f87171', '#b91c1c'],
]
// the same letter always gets the same colour, so each is a consistent character
export const colorFor = (ch: string) => LL_COLORS[(ch.charCodeAt(0) - 65 + 26) % LL_COLORS.length]

export function LetterGuy({ ch, className = '' }: { ch: string; className?: string }) {
  const [c1, c2] = colorFor(ch)
  return (
    <span className={`ll-guy ${className}`} style={{ '--c1': c1, '--c2': c2 } as CSSProperties}>
      <span className="ll-eyes" aria-hidden="true">
        <span className="ll-eye"><span className="ll-pupil" /></span>
        <span className="ll-eye"><span className="ll-pupil" /></span>
      </span>
      <span className="ll-ch">{ch}</span>
    </span>
  )
}
