# Parrot toy material sprites — licenses

All files here are **original art generated in-project** by a node-canvas / headless-
Chromium bake script (`scripts/gen-parrot-art.mjs`) — analytic soft lighting, baked
feather texture + ambient occlusion, no third-party assets. No attribution required.

The parrot is baked as FOUR registered layers sharing one 300x420 coordinate space,
so the app rigs it (flutter / beak-open / blink / bob) with transform + opacity only
while every pixel stays real illustration — never a CSS shape.

| File | What it is | Used by |
|---|---|---|
| `parrot-body.png` | the resting bird: feathered sage body, warm cream chest, teal-tipped tail, gripping feet, feathered head with a glossy catch-lit eye and a hooked amber upper beak; baked top-left key light + underside AO + contact shadow | `.parrot-l-body` |
| `parrot-wing.png` | the near wing only — green coverts, a muted-coral leading edge and teal-tipped flight feathers; hinged at the shoulder to flutter | `.parrot-l-wing` |
| `parrot-beak.png` | the lower mandible only — rests flush closed, rotates down (revealing the baked throat shadow) to "talk" | `.parrot-l-beak` |
| `parrot-blink.png` | a feather-coloured eyelid with a soft lash line — opacity fades in to blink | `.parrot-l-blink` |
| `perch.png` | a baked wooden perch branch (bark grain, top highlight, underside AO) the parrot grips | `.parrot-branch` |

The scene backdrop `art/bg/parrot-corner.jpg` (warm room wall, blurred tropical
leaves, window light, receding wood floor) is baked by the same script — see
`art/bg/LICENSES.md`.
