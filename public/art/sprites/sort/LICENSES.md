# Sort ("מיון") material sprites — licenses

All files here are **original art generated in-project** (a node-canvas bake
script — `scripts/gen-sort-art.mjs` — seeded value-noise materials, analytic
baked lighting/AO, no third-party assets). Public-domain (CC0). No attribution
required.

| File | What it is | Used by |
|---|---|---|
| `bucket.png` | a **woven wicker basket** bin seen slightly from above: an over-under basket weave (horizontal reeds crossing vertical stakes, each reed lit like a little cylinder) on a truncated-cone body, a rolled reed rim, a dark AO'd inner opening, key light top-left + side/base ambient occlusion, seeded grain and a baked contact shadow. Neutral warm-grey luminance | `.sort-basket` background + `::before` colour-wash mask |
| `ball.png` | a glossy sortable SPHERE: top-left specular, radial body shading, bottom AO, seeded grain. Neutral-grey luminance | `.sort-blob` background + `::before` colour-wash |
| `mat.jpg` | the wooden TABLE the baskets rest on: muted warm **planks** with visible seams, directional vertical grain and a couple of soft knots, receding slightly (shaded far edge, lit near lip), a soft warm centre light pool and side vignette | `.sort-surface` background |

Tinting: each basket/ball is washed to its sort colour with a CSS
`mix-blend-mode: color` layer over the baked grey luminance (the basket's wash is
`mask`ed to the basket silhouette so the contact shadow stays neutral). The baked
weave + lighting survive the tint, and ONE sprite serves every colour and
difficulty tier — the weave contrast is kept gentle so the tinted colour still
reads as one clear colour.

The calm playroom backdrop (`../../bg/sorting-room.jpg`) is baked by the same
script; see `public/art/bg/LICENSES.md`.
