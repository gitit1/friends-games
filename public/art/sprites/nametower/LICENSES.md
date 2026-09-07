# Name-tower material sprites — licenses

All files here are **original art generated in-project** (the @napi-rs/canvas bake
script `scripts/gen-nametower-art.mjs` — seeded value-noise wood grain, analytic
bevel/AO shading + baked contact shadows, no third-party assets). No attribution
required (CC0). Muted, sensory-calm palette matched to `public/art/bg/wooden-playroom.jpg`.

| File | What it is | Used by |
|---|---|---|
| `block-maple.png` | a wooden TOY ALPHABET BLOCK in gentle 3/4 view (natural maple): lit TOP + shaded RIGHT faces receding up-right, sanded bevelled edges, wood grain + soft knots, baked top-left key light / bottom-right AO, a soft baked CONTACT SHADOW, and a recessed CREAM letter PLATE (engraved groove) the Hebrew letter sits on | `.nt-cube` background |
| `block-sage.png` | same block, muted sage-green paint tint | `.nt-cube` background |
| `block-blue.png` | same block, dusty-blue paint tint | `.nt-cube` background |
| `block-clay.png` | same block, soft terracotta paint tint | `.nt-cube` background |
| `block-mustard.png` | same block, warm mustard paint tint | `.nt-cube` background |
| `block-rose.png` | same block, dusty-rose paint tint | `.nt-cube` background |
| `shelf.png` | a warm maple SHELF plank in gentle perspective — receding top surface (grain converging far, plank seams, lit centre pool) + a thick bevelled front lip with AO. Grounds the tower + the celebrating friend on a real surface | `.nt-shelf` |

One blank block sprite per tint serves EVERY letter: the Hebrew letter is drawn
crisply in CSS *on top* of the baked cream plate (readability stays vector,
razor-legible), engraved with a light-above / dark-below text shadow so it reads
as pressed into the wood. Each letter keeps the same tint every time, so every
letter is a consistent little block.
