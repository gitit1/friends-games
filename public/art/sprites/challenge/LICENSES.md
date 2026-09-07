# Math-challenge (אתגר חשבון) material sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-challenge-art.mjs` — seeded value-noise grain, analytic
bevel/AO shading, baked key light + contact shadow, no third-party assets). No
attribution required (CC0).

| File | What it is | Used by |
|---|---|---|
| `slate.png` | the QUESTION CARD: a carved warm-wood FRAME (grain, raised bevel with top-left key light + inner-lip AO) around a recessed muted chalk-slate panel (soft chalk-dust cloud noise, a faint diagonal sheen, an edge vignette + AO lip). The equation is drawn in crisp CSS chalk text on the slate | `.chal-card` background |
| `tile.png` | the ANSWER TILE: a raised, bevelled CREAM flashcard block — fine paper tooth, a warm top-left key light, baked edge AO, and a shallow recessed face panel the numeral engraves into | `.chal-tile` background |
| `desk.jpg` | the DESK: a warm walnut top in gentle perspective (grain converging to the far end, plank seams, soft knots, a lit centre pool) plus a thick bevelled front edge with AO. Grounds the friends + props the slate — gives the scene real depth | `.chal-scene` desk layer |

One blank `slate.png` serves every question and one `tile.png` serves every
answer number: the digits are drawn crisply in CSS *on top* of the baked
surfaces (readability stays vector) — chalk-white on the slate, engraved dark on
the cream tile.
