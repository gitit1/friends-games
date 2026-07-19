# Air-hockey material sprites — licenses

All files here are **original art generated in-project** (a pure Node + `zlib`
PNG-encoder bake script — seeded value-noise materials, analytic shading, baked
lighting/AO, no third-party assets). No attribution required. Total 277KB
(budget 400KB).

| File | What it is | Used by |
|---|---|---|
| `table.png` | the whole rink in perspective, baked as one raster: a muted arena floor + a receding trapezoid playfield of glossy steel-blue laminate (brushed value-noise grain, broad blemish, baked overhead-lamp sheen band + soft gloss diagonal), converging raised rails (lit top bevel + inner AO), a foreshortened far goal recess with fine net threads, and baked ice-rink markings — red centre line, squashed centre faceoff circle + spot, two near faceoff spots, two blue lines, a far goal crease, plus a soft crowd-silhouette horizon band | `.hockey-rink` background |
| `puck.png` | a real beveled charcoal disc: top-lit radial body, darkened rim bevel + top light lip, a milled groove ring, micro-grain, an upper-left specular, and a soft baked contact shadow (alpha) | `.hockey-puck2` |
| `mallet.png` | the player's striker (calm teal): a shaded flange disc + a raised central knob with its own dome AO + plastic specular, a ring groove between them, a lit rim lip, and a baked contact shadow | `.hockey-mallet` (player) |
| `mallet-def.png` | the defender's striker — the same milled striker in a muted plum, so the two pushers read apart at a glance | `.hockey-mallet.def` (defender, קשה+) |
| `post.png` | a small rounded rink bumper cap — muted-blue rail material, lit left, soft shadow | goal-narrowing posts (בינוני+) |

The rink's trapezoid geometry (FAR_Y / NEAR_Y / FAR_HALF / NEAR_HALF and the
`persp` compression) is baked to the SAME fractions the runtime projection in
`src/games/HockeyGame.tsx` uses, so the puck/paddles ride the surface and bounce
exactly at the drawn rails at every depth. The sprite is stretched to the rink
box with `background-size: 100% 100%`, so those fractions line up at any size.
