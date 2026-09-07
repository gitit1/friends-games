# Missing-friend-in-the-sequence material sprites — licenses

All files here are **original art generated in-project** (a headless-Chromium
canvas bake — `scripts/gen-sequence-art.mjs`: analytic shading, baked lighting/AO,
value-noise wood grain, no third-party assets). CC0 / public domain — no
attribution required.

| File | What it is | Used by |
|---|---|---|
| `podium.png` | a low wooden STAGE, 3/4 view: a lit warm-honey top ellipse (the friend stands on its front edge, ≈44% of the sprite height), a curved grained front band with baked upper-left key light, and a recessed engraved NAMEPLATE (≈57% height) for the crisp CSS number. One sprite serves every row tile AND every answer. | `.seq-podium` background |
| `socket.png` | the SAME pedestal with an EMPTY recessed top — a soft shadow pit + a dashed "waiting" ring — marking the gap where a friend is missing. | `.seq-socket` background |
| `shelf.png` | the long wooden LEDGE the whole sequence rests on: a perspective (receding) top face with converging plank grooves, far-edge AO, a near light pool, and a front bevel thickness with drop shadow. The receding playfield surface. | `.seq-shelf` background |
| `tray.png` | a shallow wooden TRAY with a raised, lit front rail the answer podiums sit inside; perspective floor + inner-wall AO. "Pick one from here." | `.seq-tray` background |

Muted, sensory-calm warm-wood palette (no neon). Total ≈ 296 KB. Shelf/tray are
exported downscaled (0.66×/0.72×) to stay small; the friend number is never baked
(it varies 1–100) — it is always crisp CSS text over the baked nameplate.
