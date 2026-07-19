# Pop-friends material sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-pop-art.mjs` — analytic shading + seeded micro-texture, no
third-party assets). No attribution required (CC0-equivalent).

| File | What it is | Used by |
|---|---|---|
| `bubble.png` | one neutral glossy-sphere material: a crisp top-left specular hotspot + soft upper sheen (gloss), a broad form shadow swelling to the lower-right rim (volume), baked bottom AO, a thin Fresnel rim light along the lower edge (soap-bubble translucency), a faint cool iridescence sliver and micro surface texture. Drawn as a mostly-transparent OVERLAY so the friend's identity colour shows through. | `.pop-blob` background (over a `var(--c)` fill) |

Tinting: every friend-bubble keeps its identity colour via a CSS `var(--c)` fill
UNDER the baked overlay (gently pulled toward a cool water-white for sensory
calm). No blend-mode, no filter — one sprite serves every friend, and only
transform/opacity ever animate (perf budget preserved). Key light is baked
upper-LEFT (physical — it does not mirror in RTL/LTR).
