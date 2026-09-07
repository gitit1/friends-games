// Generates the PWA app icons from an inline, on-brand friend SVG.
// One-off build tool — needs sharp installed: `npm i -D sharp && node scripts/gen-icons.mjs`
// (sharp is not kept as a permanent dependency; reinstall it to regenerate.)
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const OUT = new URL('../public/', import.meta.url)
mkdirSync(OUT, { recursive: true })

// A plump yellow friend (eyes, smile, blush, little arms) with a soft ground
// shadow on the brand-blue background — the same character the whole app is made of.
function friendSVG({ corner, cy, scale }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c4e74"/>
      <stop offset="1" stop-color="#11304a"/>
    </linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe49a"/>
      <stop offset="1" stop-color="#ffc23d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${corner}" fill="url(#bg)"/>
  <g transform="translate(256,${cy}) scale(${scale})">
    <ellipse cx="0" cy="158" rx="120" ry="26" fill="#000" opacity="0.22"/>
    <rect x="-150" y="-6" width="56" height="120" rx="28" fill="url(#body)" transform="rotate(-14 -150 54)"/>
    <rect x="94" y="-6" width="56" height="120" rx="28" fill="url(#body)" transform="rotate(14 150 54)"/>
    <path d="M -132 -8 C -132 -120 132 -120 132 -8 C 132 110 96 150 0 150 C -96 150 -132 110 -132 -8 Z" fill="url(#body)"/>
    <ellipse cx="-84" cy="34" rx="22" ry="13" fill="#ff9aa2" opacity="0.55"/>
    <ellipse cx="84" cy="34" rx="22" ry="13" fill="#ff9aa2" opacity="0.55"/>
    <circle cx="-50" cy="-30" r="34" fill="#fff"/>
    <circle cx="50" cy="-30" r="34" fill="#fff"/>
    <circle cx="-46" cy="-22" r="17" fill="#15324a"/>
    <circle cx="54" cy="-22" r="17" fill="#15324a"/>
    <circle cx="-52" cy="-32" r="6" fill="#fff"/>
    <circle cx="48" cy="-32" r="6" fill="#fff"/>
    <path d="M -46 44 Q 0 92 46 44" stroke="#15324a" stroke-width="13" fill="none" stroke-linecap="round"/>
  </g>
</svg>`
}

// rounded corners for the normal "any" icons; full-bleed square (platform masks
// it) for maskable + Apple touch, with the friend pulled into the safe zone.
const ROUNDED = friendSVG({ corner: 112, cy: 268, scale: 1.0 })
const MASKABLE = friendSVG({ corner: 0, cy: 256, scale: 0.8 })
const APPLE = friendSVG({ corner: 0, cy: 256, scale: 0.9 })

async function png(svg, size, name) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(name, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  console.log('  ✓', name, `${size}×${size}`)
}

console.log('Generating PWA icons →')
await png(ROUNDED, 192, 'icon-192.png')
await png(ROUNDED, 512, 'icon-512.png')
await png(MASKABLE, 512, 'icon-maskable-512.png')
await png(APPLE, 180, 'icon-180.png')
console.log('Done.')
