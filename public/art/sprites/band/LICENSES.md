# Band (#61 להקת החברים) material sprites — licenses

All files here (plus `public/art/bg/band-stage.jpg`) are **original art
generated in-project** by a node-canvas bake script
(`scripts/gen-band-art.mjs`) — analytic gradients, baked lighting/AO and seeded
material grain, no third-party assets. **CC0 / no attribution required.**
Muted evening palette, one consistent light source per surface, no neon.

| File | What it is | Used by |
|---|---|---|
| `chip.png` | a small wooden coaster tile with a recessed felt inset well: baked top-left key light, edge bevel and a soft contact shadow — the instrument-drawer tile a friend + emoji sit on | `.band-chip` background |
| `../../bg/band-stage.jpg` | the evening show backdrop: a deep indigo curtain wall (soft organic fold shading) + a receding wooden stage floor in true perspective (converging plank seams, far-edge AO, warm centre spotlight pool) | `.band-stage` back layer via `<SceneBackdrop>` |

The CSS beat-reactive spotlight pulse, spotlight-sweep wave and curtain-fall
animation stay in `app.css` — those are motion/state, not material, and
correctly excluded from the bake per the "real art, not CSS" doctrine (CSS is
for layout/text/animation only).
