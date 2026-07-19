# Coin-sort material sprites — licenses

All files here are **original art generated in-project** (a node-canvas bake
script — seeded value-noise materials, analytic shading, no third-party
assets). No attribution required.

| File | What it is | Used by |
|---|---|---|
| `wood-board.jpg` | baked wood table material: grain fibers (value noise), per-plank tone jitter, knots with rings, plank grooves, varnish sheen, edge bevel/vignette | `.cs-board` background |
| `lane-carved.png` | a lane routed into the board: dark rough interior grain, baked AO (top lip + walls), warm bottom lift, routed edge; alpha rounded corners | `.style-stack .cs-tube` background |
| `coin-metal.png` | complete milled-metal token (opaque, neutral warm-gray luminance): brushed face rings, reeded rim ticks, embossed number plate, baked key light + underside shading, micro-grain, edge AO | `.cs-coin` background |
| `coin-chip.png` | the same token seen at a shallow angle: milled elliptical face + a real cylindrical side with vertical reeding + baked contact shadow (alpha silhouette) | `.cs-chip` background + mask |
| `tube-glass.png` | glass sheen with rim THICKNESS: double lip lines at the opening, inner-wall edges, highlight streaks, wall shadows — mostly transparent, laid in front of the coins | `.cs-tube::before` |

Tinting: every coin/chip keeps its friend's identity colour via a CSS
`mix-blend-mode: color` wash (`--c`) over the baked luminance — the texture
survives the tint, and ONE sprite serves all 100 tiers.
