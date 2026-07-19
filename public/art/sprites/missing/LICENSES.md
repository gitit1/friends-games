# Missing-number material sprites — licenses

All files here are **original art generated in-project** by a node-canvas bake
script (`scripts/gen-missing-art.mjs` — analytic wood shading, seeded grain +
speckle, baked key light / AO, no third-party assets). No attribution required
(CC0).

| File | What it is | Used by |
|---|---|---|
| `tile-wood.png` | a raised wooden number tile: warm-oak grain, speckle, baked top-left key light + bottom-right AO, a raised edge bevel and a routed recessed inner panel where the friend + number sit | `.miss-tile` background |
| `tile-slot.png` | the same tile with a deep dark routed SOCKET instead of the panel (strong inner top/left AO, warm bottom lift, lit near lip) — reads as an empty slot waiting for the missing tile | `.miss-tile.is-slot` background |
| `tray-wood.png` | a wooden SHELF in perspective (receding trapezoid top face, converging plank seams, far-edge AO, front-bevel thickness + near-edge highlight) that the tiles rest on — grounds the friends and gives the scene depth | `.miss-shelf` background |

The number is drawn as crisp CSS text engraved into the baked recessed panel
(readability is sacred); each friend keeps its identity colour via its own art
plus a short underline in `--c`. One tile sprite serves all 100 friends.
