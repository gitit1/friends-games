# Bowling material sprites — licenses

All files here are **original art generated in-project** (a node-canvas bake
script, `scripts/gen-bowling-art.mjs` — seeded value-noise materials, analytic
shading, no third-party assets). No attribution required. CC0.

| File | What it is | Used by |
|---|---|---|
| `lane.jpg` | baked varnished-maple bowling lane in perspective: 39 converging boards with lengthwise value-noise grain fibers, per-board tone jitter + seam grooves, ring knots, a centre varnish sheen, recessed gutters with a lit inner lip, the lighter far pin-deck shelf, a contrasting navy foul line, the 7 dovetail aiming arrows, approach guide dots, a muted arena wall + crowd silhouette on the horizon, and baked overhead-light pools + corner vignette (AO). | `.bowl-lane` background |
| `ball.png` | baked glossy resin ball: a shaded sphere (Lambert + Blinn-Phong specular highlight, rim/fresnel darkening, environment sheen) with three recessed finger holes (inner AO + lip highlight); transparent, anti-aliased silhouette. Spins via the element's rotate transform. | `.bowl-ball` background |
| `pin.png` | baked classic ten-pin: a muted-ivory necked body (domed crown, pinched neck, full belly, tapered base) from a dense profile, TWO muted-red neck bands, baked CYLINDRICAL shading (solid-of-rotation normals, key light upper-left), a soft gloss streak, rim + neck + base ambient occlusion, and a light material grain; transparent, anti-aliased silhouette whose BOTTOM edge is the pin's base (so the DOM topples it about its feet). Each pin wears a compact friend face + number bead on the belly (CSS decal). | `.bowl-pin-body` background |

Regenerate: `npm i --no-save @napi-rs/canvas && node scripts/gen-bowling-art.mjs`
(the canvas dep is not kept permanently).
