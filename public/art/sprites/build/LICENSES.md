# Build-a-number material sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-build-art.mjs` — seeded value-noise wood grain, analytic
bevel/AO shading, no third-party assets). No attribution required (CC0).

| File | What it is | Used by |
|---|---|---|
| `tile-wood.png` | a wooden NUMBER TILE / block (Montessori/SumBlox flavour): vertical maple grain, per-region tone jitter, a soft knot, a raised bevelled rim (baked top-left key light + bottom-right AO) and a recessed inner face panel the numeral engraves into | `.build-tile` background |
| `op-puck.png` | a small round carved-maple OPERATOR knob: domed face, radial/swirl grain, bevelled rim, baked key light + AO, a shallow recessed centre for the symbol | `.build-puck` background |
| `bench.jpg` | the WORKBENCH: a warm varnished plank in gentle perspective — a receding top surface (grain converging to the far end, plank seams, a lit centre pool) plus a thick bevelled front edge with AO. Gives the scene depth + grounds the tiles/friends | `.build-stage` background |

One blank `tile-wood.png` serves every number 1–100 and one `op-puck.png` serves
`+ − × ÷ =`: the digit / symbol is drawn crisply in CSS *on top* of the baked
block (readability stays vector), engraved with a light-above / dark-below text
shadow so it reads as pressed into the wood.
