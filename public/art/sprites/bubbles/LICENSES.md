# Soap-bubble sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-bubbles-art.mjs` — analytic radial/conic gradients, no
third-party assets). CC0 / no attribution required.

Each is a translucent 224×224 PNG that reads as a real soap bubble: a nearly
transparent body (the friend inside shows through), a muted iridescent thin-film
sheen (cyan→green→gold→pink→violet→blue, weighted toward the lower rim like a
real gravity-drained film — never neon), a bright Fresnel rim, a crisp upper-left
specular highlight and a soft lower-right secondary highlight.

| File | What it is | Used by |
|---|---|---|
| `bubble-1.png` | soap bubble, **cool** film (blue/cyan dominant at the rim) | `.bubble` background (variant 0) |
| `bubble-2.png` | soap bubble, **warm** film (gold/pink dominant) | `.bubble` background (variant 1) |
| `bubble-3.png` | soap bubble, **mint** film (green/teal dominant) | `.bubble` background (variant 2) |
| `bubble-4.png` | soap bubble, **lilac** film (violet/rose dominant) | `.bubble` background (variant 3) |

A bubble picks one variant at spawn, so the drift shows a gentle mix of films —
all muted, translucent and calm. Total ≈287KB.
