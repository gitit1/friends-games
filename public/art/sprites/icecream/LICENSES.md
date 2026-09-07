# Ice-cream parlour material sprites — licenses

All files here are **original art generated in-project** (the node-canvas bake
script `scripts/gen-icecream-art.mjs` — analytic shading + seeded value-noise
texture, no third-party assets). No attribution required (CC0-equivalent).

| File | What it is | Used by |
|---|---|---|
| `scoop.png` | ONE neutral creamy ice-cream dome drawn as a mostly-transparent OVERLAY: a soft matte upper-left catch-light, dense creamy curd texture at two scales, a matte form-shadow roll, bottom AO, a rolled scoop curl, an irregular (bumpy) creamy silhouette and a soft melt lip. The flavour tint is a CSS radial `var(--fl)` fill UNDER it, so one sprite serves all six flavours. | `.ice-scoop` + `.ice-tub-scoop` backgrounds |
| `cone.png` | a toasted WAFFLE cone: a baked diamond lattice that converges toward the tip (perspective), each waffle cell domed and its grooves AO-darkened with a facet catch-light, cone cross-section curvature shading, toasted mottling and a rolled scalloped rim lip. | `.ice-cone-base` background |
| `counter.jpg` | the near marble PARLOUR counter (foreground occluder): a lit receding top lip then a tall veined front face with baked AO — the friend's feet occlude behind it, the cone stands ON it. | `.ice-counter` background |
| `tub.png` | a stainless display PAN for the flavour stand: an angled ellipse rim with metallic shading and a transparent well; the tinted flavour mound sits IN it. | `.ice-tub` background |
| `cream.png` | a soft ivory WHIPPED-CREAM swirl (matte, stacked tapering rings to a peak). | `.ice-top-cream` background |
| `sauce.png` | a glossy CHOCOLATE-SAUCE cap with drip tongues + a soft specular sweep. | `.ice-top-choc` background |

Key light is baked upper-LEFT (physical — it does NOT mirror in RTL/LTR, same
rule as the friends). Muted / appetising-but-calm palette (sensory rule). Only
transform/opacity ever animate (perf budget preserved). The far back wall of the
scene is `public/art/bg/icecream-parlour.jpg` (same bake script, see that dir's
LICENSES.md).
