# Help ("מבקשים עזרה") material sprites — licenses

All files here (and `bg/help-room.jpg`) are **original art generated in-project**
by a node-canvas bake script (`scripts/gen-help-art.mjs`) — analytic gradients,
baked lighting/AO and seeded matte speckle grain, no third-party assets. **CC0 /
no attribution required.** This game is used when the child may already be
frustrated (a friend hits a snag and asks for help or a break), so the palette is
deliberately soothing: muted sage/sand/terracotta, no neon, no saturated red, one
consistent soft top-left key light, zero added motion beyond what already exists.

| File | What it is | Used by |
|---|---|---|
| `bg/help-room.jpg` | the calm play-corner scene: a muted sage/greige wall above a warm wooden floor receding in gentle perspective (converging plank seams, far-edge AO, a soft baked window-light pool, a lit near edge) | `.help-scene` background, via `SceneBackdrop` |
| `help-card-ask.png` | the עזרה pictogram card: a chunky rounded tile, raised bevel rim (light top-left / shade bottom-right), matte speckle grain, baked contact shadow, muted sage tint baked into the material | `.help-card-help` background |
| `help-card-break.png` | the הפסקה pictogram card: same baked tile treatment, muted warm-sand tint | `.help-card-break` background |
| `help-cushion.png` | a cosy bolster cushion: soft rounded form, dashed seam piping, fabric speckle grain, a baked AO groove down the centre crease and a baked contact shadow, muted dusty-terracotta | `.help-cushion` background (replaces the plain 🛋️ emoji) |

The emoji (✋ / 🛑) and Hebrew labels overlay the card sprites as crisp CSS text/
emoji, unchanged from the original pictogram-card design — only the card's own
material (previously a flat CSS gradient) is now baked art.
