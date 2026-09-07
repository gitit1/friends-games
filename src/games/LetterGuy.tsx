// A single "living letter" — a baked painted-wooden tile-block character (real
// 3D cube, wood grain, baked lighting/AO, bevel, contact shadow + baked googly
// eyes: scripts/gen-livingletters-art.mjs, public/art/sprites/livingletters/) with
// a crisp CSS glyph over its front face. The Alphablocks-style character shared
// by the English games (Spell the Word, First Letter, Rhyme Machine, Blend
// Sounds). Styling lives in app.css (.ll-guy and friends).
const TILE_COUNT = 10
// the same letter always gets the same tile art, so each is a consistent character
export const tileFor = (ch: string) => (ch.charCodeAt(0) - 65 + 26) % TILE_COUNT

export function LetterGuy({ ch, className = '' }: { ch: string; className?: string }) {
  return (
    <span className={`ll-guy ll-guy-${tileFor(ch)} ${className}`}>
      <span className="ll-ch">{ch}</span>
    </span>
  )
}
