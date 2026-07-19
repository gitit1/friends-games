# תופסים הברות (syllable drum) — baked materials

All sprites in this folder are **original works**, generated procedurally by
`scripts/gen-syllables-art.mjs` with `@napi-rs/canvas` (seeded value-noise grain
+ analytic baked lighting/AO). No third-party art or textures were used.

**License: CC0 1.0 (public domain dedication).**

| File | What it is |
| --- | --- |
| `drum.png` | The hero tap-drum — a 3/4-view tom: oak shell with staves, cream skin head with a tap-dimple, tension hoop + lugs, baked contact shadow. |
| `bead-on.png` | A glossy lit amber count-bead (one syllable drummed). |
| `socket.png` | An empty recessed dot-cup (a syllable not yet drummed). |
| `rail.png` | The slim wooden rail the count-beads rest on. |
| `panel.png` | The framed picture card: wood frame + bright cream mat (keeps the crisp CSS Hebrew word razor-legible). |
| `rug.png` | The soft oval woven mat the drum + buddy stand on (grounding / depth). |

Muted, sensory-calm palette throughout (no neon, no pure saturated hues).
Regenerate with: `node scripts/gen-syllables-art.mjs`.
