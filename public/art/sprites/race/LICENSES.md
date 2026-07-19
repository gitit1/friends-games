# Car-race material sprites — licenses

All files here are **original art generated in-project** (`scripts/gen-race-art.mjs`,
a dependency-free node baker — seeded value-noise materials, analytic key light +
edge ambient occlusion, SDF anti-aliasing; no third-party assets, Node built-ins
only). No attribution required (CC0-equivalent).

Palette is deliberately muted (sensory rule): a friendly toy-racer look on a calm
slate road. Baked at ~1.6× display size for crispness.

| File | What it is | Used by |
|---|---|---|
| `car-*.png` (×8) | the race-car BODY (no wheels), one per muted paint colour — a side-view open-cockpit racer: cylindrical body shading + upper-left key light, baked bottom AO + edge AO, hood specular streak, top rim-light, a lit cockpit rim with a dark seat recess the driver friend rides in, a windscreen glass lip, a door roundel, a warm headlamp and a soft contact shadow | `.rc-car-body` |
| `wheel.png` | one baked wheel: dark rubber tyre with subtle tread, brushed-alloy rim, five-spoke hub + centre cap, baked top-left key light + outer AO. Spins via CSS `rotate` while driving | `.rc-wheel` (front + rear) |
| `ground.png` | the receding road surface: a muted-slate asphalt band (grain + aggregate flecks + a subtle camber) between two textured grass verges, with baked cream edge lines. Stretched onto a `rotateX` perspective plane so its straight edges become the CONVERGING lane lines to the horizon | `.rc-road` |
| `dash.png` | one muted-amber centre lane dash + gap on transparent; a `repeat-y` tile translated toward the viewer on the perspective plane = the streaming "moving road stripes" | `.rc-road-dashes` |

The muted paint RGBs baked into `car-*.png` match the garage swatch colours in
`src/games/CarRace.tsx` (`PAINTS`), so a chosen swatch always drives the matching
car. The sum, the answer choices and the environment name are **CSS text** — the
only text in the scene, kept sharp + readable on purpose.
