# Feelings (איך אני מרגיש?) material sprites — licenses

All files here (and `bg/feelings-nook.jpg`) are **original art generated
in-project** by a node-canvas bake script (`scripts/gen-feelings-art.mjs`) —
analytic gradients, baked lighting/AO and seeded material grain, no
third-party assets. **CC0 / no attribution required.** This tool is used
while the child may be dysregulated, so every piece is deliberately calm:
warm muted palette, soft low-contrast lighting, no neon, no busy detail, and
nothing here carries baked-in motion beyond what the CSS already animated.

| File | What it is | Used by |
|---|---|---|
| `bg/feelings-nook.jpg` | the calm "regulation nook" backdrop: a soft rounded cushioned alcove recessed into a muted warm wall (gentle inner AO + a soft top-left key light) above a low knitted rug on the floor in shallow perspective. Deliberately neutral warm — not tinted per emotion — so it reads calm under any Zones color | `.fe-stage` background, via `SceneBackdrop`; the per-emotion Zones color rides on top as a translucent `.fe-scrim` wash |
| `tool-flower.png` | a soft plush flower: six rounded dusty-pink petals (baked top-left lighting per petal), a muted cream-gold domed centre, a stem + leaf, baked drop shadow | `.fe-tool-fig[data-tool="flower"]` (breathing figure) + `.fe-tool[data-tool="flower"] .fe-tool-emoji` (toolbox picker) |
| `tool-balloon.png` | a matte dusty sky-blue balloon: domed sheen upper-left, soft AO lower-right, string + knot, baked drop shadow | `.fe-tool-fig[data-tool="balloon"]` + `.fe-tool[data-tool="balloon"] .fe-tool-emoji` |
| `tool-bubbles.png` | a small cluster of glassy soft-seafoam bubbles: radial glass gradient + glossy highlight per bubble, baked combined drop shadow | `.fe-tool-fig[data-tool="bubbles"]` + `.fe-tool[data-tool="bubbles"] .fe-tool-emoji` |

Total: ~57KB for all four files, well under budget. The emotion vocabulary,
Zones color mapping and the hand-drawn `EmotionFace` SVG are untouched — only
the scene/props around the face were baked.
