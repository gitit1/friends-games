# Place-value (עשרות ואחדות) material sprites — licenses

All files here are **original art generated in-project** by the node/puppeteer
bake script `scripts/gen-placevalue-art.mjs` (offscreen `<canvas>` — analytic
shading, value-noise wood grain + felt weave, baked lighting/AO, no third-party
assets). CC0 / public domain — no attribution required.

| File | What it is | Used by |
|---|---|---|
| `ten-rod.png` | a base-ten TENS ROD of ten unit segments: muted slate-blue stained wood, front + right side faces (real thickness) + top cap for 3D, per-segment groove AO + top-lip highlight (reads as ten joined unit cubes), baked top-left key light, vertical grain, soft contact shadow at the foot | `.pv-rod` background |
| `unit-cube.png` | a single ONES unit cube: warm honey wood, 3/4 view (top + two side faces), grain + bevel highlights + a baked contact shadow (alpha silhouette) | `.pv-cube` background |
| `mat.png` | the FELT work-mat the tokens rest on: a receding perspective trapezoid (pseudo-3D floor), woven cross-hatch texture, far-edge AO, near light pool, stitched border and a front bevel thickness so it grounds as a real object | `.pv-mat` background |

The room behind the mat reuses the shared CC0 backdrop
`public/art/bg/wooden-playroom.jpg` (see `public/art/bg/LICENSES.md`).
