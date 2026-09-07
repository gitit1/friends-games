# Rhythm Blocks (#62 מכונת הקצב) material sprites — licenses

All files here (plus `public/art/bg/rhythm-stage.jpg`) are **original art
generated in-project** by a node-canvas bake script
(`scripts/gen-rhythm-art.mjs`) — analytic gradients, baked lighting/AO and
seeded material grain, no third-party assets. **CC0 / no attribution
required.** Muted evening palette matching the shared musicians-decade stage
tones, no neon.

| File | What it is | Used by |
|---|---|---|
| `block.png` | a neutral warm-grey rounded cube: baked top-left dome sheen, bottom-right AO, a raised bevel rim and a soft drop shadow so it sits proud of the tray | `.rb-block-btn` and `.rb-slot.is-filled` background, tinted per colour via a `mix-blend-mode: color` CSS wash (same tinting pattern as `calc-key.png`) so the baked shading survives every hue |
| `slot.png` | a shallow carved recess in dark wood: inner top/left AO, a bottom-right lift and a crisp recess edge, so an empty track cell reads as a real groove instead of a flat dark rectangle | `.rb-slot` background |
| `../../bg/rhythm-stage.jpg` | Dabi's evening backdrop: a muted indigo wall with a soft violet glow + a receding wooden floor in true perspective (converging plank seams, far-edge AO, warm centre spot) | `.rb-stage` back layer via `<SceneBackdrop>` |

The CSS playhead glide, slot-lit glow, loop-lock flash and Dabi's on-beat bob
stay in `app.css`/JS — those are motion/state driven by the audio clock, not
material, and correctly excluded from the bake per the "real art, not CSS"
doctrine.
