# מספר וכמות ("party invitations") scene material sprites — licenses

All files here are **original art generated in-project** by the node/puppeteer
bake script `scripts/gen-quantity-art.mjs` (offscreen `<canvas>` — analytic
shading, value-noise wood grain + speckle, baked upper-left key light and AO, no
third-party assets). CC0 / public domain — no attribution required. Muted /
sensory-calm palette to match the scene.

| File | What it is | Used by |
|---|---|---|
| `garland.png` | a cloth flag bunting strip: a gently-slung rope with draped triangular flags in the four scene colours (yellow · sky-blue · warm · rose), each top-lit with a soft central fold shadow and hemmed edge so it reads as fabric, not CSS triangles | `.qty-garland` background |
| `sign.png` | the hanging request board: a warm wooden plank with vertical grain, a bevelled lit top-left edge / shaded bottom-right, rounded corners and two rope holes. The number/emoji is layered on top in crisp CSS, so this is board only | `.qty-sign-board` background |
| `table.png` | the round party table's draped cream tablecloth top: an ellipse of soft fabric (top-lit dome, radiating drape folds, floor-length skirt with a warm wood rim) plus a soft contact shadow. Occludes the seated guests' feet = grounded | `.qty-table-top` background |
| `floor.png` | the receding warm-wood plank floor: perspective plank seams fanning toward a horizon, horizontal grain, far-edge AO where it meets the wall, and a soft near light pool (real material + real depth) | `.qty-floor` background |
