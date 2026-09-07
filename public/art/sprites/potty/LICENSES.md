# Potty-training material sprites — licenses

All files here are **original art generated in-project** by a node-canvas bake
script (`scripts/gen-potty-art.mjs`) — analytic gradients, baked lighting/AO
and seeded material grain, no third-party assets. **CC0 / no attribution
required.** Muted, sensory-calm, one consistent top-left key light.

| File | What it is | Used by |
|---|---|---|
| `potty-toilet.png` | one coherent baked porcelain toilet body: cistern tank + recessed flush button + lid + seat ring + pedestal base, with baked bevels, crevice AO, a cylindrical shade on the base, and a shaded bowl "well" the CSS pee/poop/kid-seat overlays sit inside | `.pt-body` background (inside `.potty-toilet`) |
| `potty-sink.png` | a small basin + faucet: porcelain basin with a rim well and taper-shaded body, a muted metal spout with a highlight cap, baked contact shadow | `.potty-sink` background |

The room itself (`bg/potty-room.jpg`, see `public/art/bg/LICENSES.md`) is baked
by the same script: a muted blue-greige wall with a soft window glow, above a
bathroom floor tile in perspective (grout lines converging toward the back
wall, baked AO at the wall/floor seam), served via `SceneBackdrop`.

Dynamic overlays (the yellow pee puddle, the 💩 emoji, the coral kid-seat
reducer ring) stay as small CSS elements positioned over the baked bowl well,
since they change per game state — only the static toilet/sink *bodies* are
baked material.
