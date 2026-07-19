# Illustrated backdrop library — licenses

Every backdrop in this folder is derived from **CC0 / public-domain** source art only.
CC0 requires no attribution; the sources are credited here anyway (good manners) and to
document provenance. **No CC-BY assets are used** — nothing here needs an attribution notice.

All files were resized/cropped, saturation-reduced ~10–30 % (sensory-calm "muted" rule),
and re-encoded as JPEG q80 (each ≤ 150 KB). Processing script: kept out of the repo
(scratchpad `imgwork/build.js`); it composes from the CC0 element PNGs listed below.

## Sources

| Source pack | Author | License | URL |
|---|---|---|---|
| Background Elements Remastered | Kenney | CC0 1.0 | https://kenney.nl/assets/background-elements-remastered |
| Background Elements | Kenney | CC0 1.0 | https://kenney.nl/assets/background-elements |
| Foliage Sprites | Kenney | CC0 1.0 | https://kenney.nl/assets/foliage-sprites |
| Kitchen Background (4 styles) | Joseph Crown (jcrown41) | CC0 (Public Domain) | https://opengameart.org/content/kitchen-background-4-styles |

CC0 deed: https://creativecommons.org/publicdomain/zero/1.0/

## Files

| File | Scene | Built from | Source pack |
|---|---|---|---|
| `meadow.jpg` | outdoor meadow (feed animals) | `backgroundColorGrass.png`, toned | Kenney · Background Elements Remastered |
| `forest.jpg` | pine forest | `backgroundColorForest.png`, toned | Kenney · Background Elements Remastered |
| `autumn.jpg` | warm autumn woods | `backgroundColorFall.png`, toned | Kenney · Background Elements Remastered |
| `desert-dusk.jpg` | soft desert / dunes | `backgroundColorDesert.png`, toned | Kenney · Background Elements Remastered |
| `dream-forest.jpg` | pale dreamy forest (calm) | `backgroundForest.png` (soft monochrome) | Kenney · Background Elements Remastered |
| `hills-dusk.jpg` | rolling hills at dusk | composed: `Elements/mountains.png` + `hillsLarge.png` + `hills.png` + `cloud3/cloud5.png` on a dusk sky gradient | Kenney · Background Elements Remastered |
| `night-sky.jpg` | calm twilight (calming games) | composed: `moonFull.png` + `cloud1/cloud5.png` + `hillsLarge.png` on a twilight gradient | Kenney · Background Elements Remastered |
| `town.jpg` | little town street | composed: `house1/house2/houseAlt1/houseSmall1.png` + `tree/treePine.png` + `cloud1/cloud3.png` + `hillsLarge.png` on a day-sky gradient | Kenney · Background Elements Remastered |
| `party-garden.jpg` | festive garden (party) | composed: `bush1/bush2.png` + `tree/treePine/treeSmall_green1.png` + `fence.png` + drawn bunting on a warm sky gradient | Kenney · Background Elements Remastered |
| `bakery.jpg` | cozy bakery kitchen | `kitchen Background.png`, cropped to the oven/cabinets + warm wash | jcrown41 · Kitchen Background |
| `shop-interior.jpg` | warm shop interior | `kitchen Background Lite.png`, cropped to cabinets/counter + warm wash | jcrown41 · Kitchen Background |
| `wooden-playroom.jpg` | warm wooden playroom (coin sort) | drawn from scratch in-project (node-canvas script: panelled wall, window light, shelf with books/plant/blocks/ball, wainscot, plank floor) — no third-party art | original (this repo) · CC0-equivalent |
| `pool.jpg` | calm pool from a slight angle (pop friends) | drawn from scratch in-project (`scripts/gen-pop-art.mjs`: aqua water, tiled floor with grout converging to a far edge, baked caustics, warm stone coping far+near, top light + vignette, ~18 % desaturated) — no third-party art | original (this repo) · CC0-equivalent |
| `parrot-corner.jpg` | warm room corner (parrot toy) | drawn from scratch in-project (`scripts/gen-parrot-art.mjs`: olive back wall, soft window-light glow, blurred tropical leaves, receding wood floor with converging planks + vignette) — no third-party art | original (this repo) · CC0-equivalent |
| `icecream-parlour.jpg` | warm gelateria back wall (ice-cream game) | drawn from scratch in-project (`scripts/gen-icecream-art.mjs`: cream wall, soft arched daylight window, a shelf of muted pastel tubs blurred to recede, warm floor with gentle perspective, ~14 % desaturated + vignette) — no third-party art | original (this repo) · CC0-equivalent |
| `laugh-stage.jpg` | cozy comedy stage / puppet theatre (laugh toy) | drawn from scratch in-project (`scripts/gen-laugh-art.mjs`: muted rosewood back wall, scalloped gold valance with tassels, two velvet side drapes with soft folds + tie-back cords, warm baked spotlight, receding wood-plank floor with converging seams + grain, vignette) — no third-party art | original (this repo) · CC0-equivalent |
| `sorting-room.jpg` | calm low-contrast playroom wall (מיון / sort game) | drawn from scratch in-project (`scripts/gen-sort-art.mjs`: gentle warm vertical wash, soft off-centre window glow, quiet wainscot molding line, fine grain, corner vignette) — deliberately plain so the coloured bins pop; no third-party art | original (this repo) · CC0-equivalent |
| `art-desk.jpg` | calm art-room desk (חיבור נקודות / connect the dots) | drawn from scratch in-project (`scripts/gen-dots-art.mjs`: muted-oak wood wash with stretched-noise grain, soft plank seams, a soft top key light, a few blurred low-contrast crayons resting at the bottom, corner vignette, ~14 % desaturated) — a quiet table so the paper worksheet reads clearly; no third-party art | original (this repo) · CC0-equivalent |
| `drawnum-desk.jpg` | warm wooden school desk at a shallow angle (מציירים מספר / draw-the-number) | drawn from scratch in-project (`scripts/gen-drawnum-art.mjs`: warm wood plane, receding planks that widen toward the near edge for baked perspective, dense grain fibers, soft top-left window light, a muted wooden ruler + pencil prop, vignette) — no third-party art | original (this repo) · CC0-equivalent |
| `letterhunt-room.jpg` | calm toy corner: a muted greige wall + a warm wooden play-table in perspective (מוצאים את האות / letter hunt) | drawn from scratch in-project (`scripts/gen-letterhunt-art.mjs`: greige wall with soft window glow + wainscot line, a receding wooden table top with converging plank seams, far-edge AO, a lit near edge + front lip for depth, key light + corner vignette) — a grounded surface the baked alphabet blocks sit on; no third-party art | original (this repo) · CC0-equivalent |
| `letterdrawer-room.jpg` | calm muted nursery/playroom (אות במגירה / letter drawer) | drawn from scratch in-project (`scripts/gen-letterdrawer-art.mjs`: soft warm wall wash with muted window glow, two out-of-focus wall-art blobs, a warm receding plank floor with converging seams + wall/floor seam shadow, a soft round rug where the dresser stands, fine grain + vignette) — a quiet room so the wooden dresser pops; no third-party art | original (this repo) · CC0-equivalent |

All composed scenes use only CC0 illustrated element PNGs from the packs above; sky/ground
gradients and the party bunting are drawn as flat vector fills (no third-party art).
