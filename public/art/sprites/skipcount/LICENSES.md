# Skip-count material sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-skipcount-art.mjs` — seeded value-noise materials, analytic
dome shading, baked lighting/AO/contact-shadow, no third-party assets). CC0 /
public-domain equivalent. No attribution required.

| File | What it is | Used by |
|---|---|---|
| `stone.png` | a warm river STEPPING STONE at a shallow oblique view: lit elliptical top face (value-noise grit + baked pits), a short darker cylindrical side (its thickness), baked top-left key light, edge AO, a lit rim arc, and a soft baked contact shadow. Neutral warm-gray so the friend's identity colour always pops. | `.hop-stone` background — ONE sprite scaled by perspective for every stone on the number-line path; "visited / current / goal" are CSS washes over this baked stone, so the texture always survives |

The meadow the path crosses is the shared illustrated `SceneBackdrop`
(`public/art/bg/meadow.jpg`, see that folder's LICENSES.md) — no extra bake.
