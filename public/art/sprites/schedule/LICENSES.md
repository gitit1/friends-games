# Schedule (סדר יום) material sprites — licenses

All files here are **original art generated in-project** by a node-canvas bake
script (`scripts/gen-schedule-art.mjs`) — analytic gradients, baked lighting/AO
and seeded paper/wood grain, no third-party assets. **CC0 / no attribution
required.** Muted, sensory-calm, one consistent top-left key light.

| File | What it is | Used by |
|---|---|---|
| `card-base.png` | one neutral laminated routine-card tile: warm cream cardstock, baked bevel (light top/left, shade bottom/right), subtle paper-fibre grain, a shallow "content window" recess with its own AO ring where the emoji sits, a baked punch-hole detail, and a baked contact shadow so the card sits proud of the shelf | `.sch-card` background (incl. `.sch-card.big` in First-Then mode, scaled up) |

Tinting: one card sprite serves every state. `.sch-card.current` and
`.sch-card.done` set a muted `background-color` painted onto the sprite with
`background-blend-mode: color` (current = teal, done = warm sand), so the
baked bevel/AO/grain survives the wash — same "one baked sprite, many tints"
pattern as `calc-key.png`. `.sch-card.upcoming` is the neutral bake at
slightly reduced opacity, no tint.

The shelf/tray surface the card strip sits in (`shelf-rail.jpg`, a warm oak
rail in shallow perspective) is baked by the same script but lives in
`public/art/bg/` per the SceneBackdrop convention — see that folder's
`LICENSES.md`.
