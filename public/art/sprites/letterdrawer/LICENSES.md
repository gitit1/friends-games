# אות במגירה (letter drawer) — sprite art

All files in this folder are **original works** baked procedurally by
`scripts/gen-letterdrawer-art.mjs` using `@napi-rs/canvas` (seeded value-noise
grain + analytic baked lighting/AO). No third-party assets are used.

Released to the public domain under **CC0 1.0**
(https://creativecommons.org/publicdomain/zero/1.0/).

| file | what it is |
| --- | --- |
| `cabinet.png` | the wooden chest-of-drawers carcass (3/4 view): lit receding top slab + front bevel, framed body, right side-panel sliver, dark recessed drawer well, base plinth + tapered feet, baked grounded contact shadow. |
| `drawer-face.png` | one closed wooden drawer front (grain, top-light/bottom-AO bevels, soft inset label panel). Stretched per drawer. |
| `knob.png` | a turned wooden knob (domed key light, AO, cast shadow). Two overlaid per drawer. |
| `drawer-open.png` | the open-drawer interior seen from 3/4 above (wooden floor, shaded inner walls, baked interior AO shadow, lit front rim). |

Companion room backdrop: `public/art/bg/letterdrawer-room.jpg` (see that
folder's `LICENSES.md`).
