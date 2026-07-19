# Catch-a-Friend scene material sprites — licenses

All files here are **original art generated in-project** (`scripts/gen-catch-art.mjs`,
a node-canvas / headless-Chromium bake — analytic shading, seeded speckle
texture, baked lighting + AO, no third-party assets). No attribution required
(CC0). Muted, sensory-calm palette.

| File | What it is | Used by |
|---|---|---|
| `lawn.jpg` | baked receding play-lawn: cool→warm grass gradient, perspective mow bands converging to a far hedge line, seeded grass-blade speckle, a soft overhead light pool, far-edge AO + gentle vignette | `.catch-floor` background (CSS-masked at the top to feather into the park backdrop) |
| `bush.png` | a soft muted topiary shrub — radial body + clustered lobes, baked top-left highlight, bottom contact AO, leaf speckle; alpha silhouette | `.catch-bush` (two, on the horizon behind the crowd — depth layering) |
| `fringe.png` | a near grass fringe strip — upward foreground blades over a dark grounding band that fades up (alpha), so it wraps the closest friends' feet | `.catch-fringe` (foreground, over feet) |

The far park back plane is the shared CC0 library image `party-garden.jpg`
(see `../../bg/LICENSES.md`), rendered via `<SceneBackdrop>`.
