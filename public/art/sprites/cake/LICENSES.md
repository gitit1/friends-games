# Cake-maker material sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-cake-art.mjs` — analytic shading + seeded value-noise
texture, no third-party assets). No attribution required (CC0-equivalent).

| File | What it is | Used by |
|---|---|---|
| `layer-vanilla.png` / `layer-choc.png` / `layer-straw.png` / `layer-lemon.png` | a SPONGE tier drawn as a shallow cylinder seen slightly from above (a camera angle = depth): a lit CREAM filling lip along the top (the frosting between layers), a sponge BODY with cross-section curvature shading + dense crumb texture, a scalloped cream OOZE at the front bottom seam and bottom AO. Muted, per-flavour crumb palettes. | `.cake-layer[data-flavor]` + `.cake-tub-layer[data-flavor]` backgrounds |
| `crown.png` | a soft ivory FROSTING dome that caps the top tier — a matte upper-left catch-light, soft cream lumps, a scalloped drip skirt and bottom AO. | `.cake-crown` + `.ic-frosting` backgrounds |
| `cherry.png` | a glossy muted-red cherry sphere with a small upper-left specular + a curved brown stem. | `.cake-cherry` + `.ic-cherry` backgrounds |
| `strawberry.png` | a rounded-cone berry with baked seed dimples (pale pips in shaded pits), curvature shading and a green calyx. | `.cake-straw` + `.ic-strawberry` backgrounds |
| `candle.png` | a spiral-striped waxy candle cylinder with a wick and a soft baked teardrop flame (muted amber). A gentle CSS glow flicker (transform/opacity only, frozen under reduced-motion) sits on top at runtime. | `.cake-candle` + `.ic-candle` backgrounds |
| `sprinkles.png` | a scattered band of little baked sprinkle capsules (muted rainbow), each domed with a tiny top catch-light. | `.cake-sprinkles` + `.ic-sprinkles` backgrounds |
| `plate.png` | a ceramic CAKE STAND at a camera angle: an elliptical lit ceramic top, a rim, a stem + base foot, and a baked contact shadow → grounds the cake (depth doctrine). | `.cake-plate` background |

Key light is baked upper-LEFT (physical — it does NOT mirror in RTL/LTR, same
rule as the friends). Muted / appetising-but-calm palette (sensory rule). Only
transform/opacity ever animate (perf budget preserved). The far back wall of the
scene is `public/art/bg/bakery.jpg`.
