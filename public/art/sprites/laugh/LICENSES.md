# Laugh (comedy-stage) sprites — licenses

All assets in this folder are **original works drawn from scratch in this repo**
(`scripts/gen-laugh-art.mjs`, an @napi-rs/canvas bake) and are released as
**CC0 1.0 (public domain)**. No third-party art is used; no attribution required.

Each sprite is baked with analytic lighting / ambient occlusion and a seeded
value-noise material grain, in a muted, sensory-calm palette (no neon).

| File | Description | Source | License |
| --- | --- | --- | --- |
| `stool.png` | round 3-leg wooden stool, top-lit with concentric wood rings + baked contact shadow | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |
| `mic.png` | retro microphone on a stand (muted chrome grille head, pole, base disc) + baked contact shadow | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |
| `glow.png` | soft warm spotlight pool (radial), overlaid on the stage and gently pulsed | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |
| `shadow.png` | soft elliptical contact shadow that grounds the friend on the floor | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |
| `burst-star.png` | gold sparkle giggle-mote (floats up on a gag) | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |
| `burst-heart.png` | soft coral heart giggle-mote | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |
| `burst-note.png` | muted musical-note giggle-mote | original (this repo, `gen-laugh-art.mjs`) | CC0 1.0 |

CC0 deed: <https://creativecommons.org/publicdomain/zero/1.0/>

## Regenerate

    npm i --no-save @napi-rs/canvas && node scripts/gen-laugh-art.mjs
