# Calculator material sprites — licenses

All files here are **original art generated in-project** by a node-canvas bake
script (`scripts/gen-calc-art.mjs`) — analytic gradients, baked lighting/AO and
seeded matte-plastic speckle, no third-party assets. **CC0 / no attribution
required.** Muted, sensory-calm, one consistent top-left key light.

| File | What it is | Used by |
|---|---|---|
| `calc-body.png` | the chunky device shell: muted slate-teal matte plastic, real front-thickness lip + baked contact shadow (alpha), raised rim bevel (light top/left, shade bottom/right), a recessed SCREEN WELL and a sunken KEYPAD TRAY (inner AO) so it reads as a solid physical object, not a flat rectangle | `.calc-device` background |
| `calc-screen.png` | the recessed LCD glass module: dark calm glass, thin inner bezel, baked top sheen streak, faint greenish cast + corner vignette AO. Digit TEXT is drawn crisp by CSS on top | `.calc-display` background |
| `calc-key.png` | one physical domed key: rounded square, warm NEUTRAL luminance, baked top-left key light + domed sheen, bevelled raised rim, bottom-right AO, a soft baked drop shadow so it sits proud of the tray | `.calc-key` background + `::before` mask |

Tinting: one key sprite serves every function. Each `.calc-key` kind sets a muted
`--c` (cream numbers · steel-blue operators · sage `=` · dusty-coral C · amber
back); a `::before` wash paints `--c` with `mix-blend-mode: color`, masked to the
key silhouette (`calc-key.png`), so the baked dome/shading survives the tint and
only the key — not its shadow/corners — picks up colour.
