# "גדול או קטן?" (bigger/smaller) material sprites — licenses

All files here are **original art generated in-project** (a node-canvas bake
script — `scripts/gen-bigsmall-art.mjs`, seeded value-noise materials + analytic
shading, no third-party assets). No attribution required (CC0).

The scene is a real **balance scale**: the bigger number is heavier, so its pan
dips — a language-free magnitude cue (the balance-scale metaphor is the
strongest research-backed way to show "which is bigger" to a pre-symbolic child).

| File | What it is | Used by |
|---|---|---|
| `scale-post.png` | turned walnut fulcrum stand, 3/4 view: weighted round base with lathe rings, tapered grained column, brass saddle + pivot pin. Baked top-left key light, right-side shade, floor contact shadow | `.bs-post` |
| `scale-beam.png` | the balance arm — a rounded walnut bar (grain + top sheen + underside AO), a brass pivot boss dead-centre, a brass eyelet at each end for the pan cords. Symmetric → mirrors cleanly. transform-origin = centre | `.bs-beam` |
| `scale-pan.png` | a shallow brass dish on three cords meeting a hanger ring: brushed concentric rings, rim highlight, inner AO, underside shadow. Neutral warm-brass luminance — a friend stands in it | `.bs-pan` |
| `number-tile.png` | a carved square wooden plaque with a routed recessed centre panel (the crisp CSS number sits on top), bevel + grain + groove AO + key light. **NEUTRAL** luminance so a CSS colour wash tints it to the friend's identity colour | `.bs-tile`, `.bs-cue-tile` |
| `stage-rug.png` | a receding round woven rug (perspective floor) the scale stands on: muted sage, concentric woven bands + sparse weave stitches, far-edge AO, near light pool, stitched border. Grounds the diorama + gives depth | `.bs-rug` |

Tinting: the number tiles keep each friend's identity colour via a CSS
`mix-blend-mode: color` wash (`--c`) over the baked neutral luminance — the
carved texture survives the tint, and ONE sprite serves all tiers.
