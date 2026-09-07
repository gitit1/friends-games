# "החבר שלי" (pet) material art — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-pet-art.mjs` — analytic shading + seeded micro-texture, no
third-party assets). No attribution required (CC0-equivalent).

| File | What it is | Used by |
|---|---|---|
| `room.jpg` | the cozy room the pet lives in, seen at a slight angle: a warm muted wall with a soft window light-spill, a real wood-framed **window** (glass sky + distant hill + muntins + sill), a wall **shelf** with a little plant + book, and a **wood-plank floor whose seams converge** toward a vanishing point (a real camera angle → depth), a wall→floor AO seam + skirting, top light + vignette. | `.ps-room-art` (home back plane) |
| `rug.png` | a soft woven oval **rug** (foreshortened), the pet's grounding spot: concentric weave, cream stitched border, pile speckle, top sheen + far-edge AO. | `.ps-rug-art` (under the pet) |
| `bed.png` | a plush round **pet bed** — a slate-blue bolster with tuft segments, a dished warm-cream cushion (centre AO where the pet sits), a top-left highlight and a soft contact shadow. | `.ps-bed-art` (left corner) |
| `bowl.png` | a ceramic **food bowl**, 3/4 view — cream body with left light / right shade, a painted muted-teal accent band, an interior AO cavity holding a little muted-brown kibble mound, rim light + contact shadow. | `.ps-bowl-art` (home) + `.ps-dish-bowl` (cushion meal) |
| `ball.png` | a soft **toy ball** — muted coral + cream curved panels, a broad top-left specular sheen, a form shadow to the lower-right, a thin Fresnel rim and a baked contact shadow. | `.ps-ball-art` (right corner) |

Palette is the GDD's cozy set, desaturated ~15% for sensory calm (no neon, no
constant animation — every sprite is static; only opacity fades with the living
room when the pet crosses to another room). Key light is baked upper-LEFT
(physical — it does NOT mirror in RTL/LTR, same rule as the friends). The friend
itself stays our FriendArt character, grounded on `.ps-shadow` (a contact shadow).
Total ≈ 257 KB.
