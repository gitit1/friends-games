# Piano material sprites — licenses

All files here are **original art generated in-project** by a node-canvas bake
script (`scripts/gen-piano-art.mjs`) — analytic gradients, baked lighting/AO/gloss
and seeded matte micro-grain, no third-party assets. **CC0 / no attribution
required.** Muted, sensory-calm, ONE consistent top-left key light (matches the
concert-hall stage spotlight and the friends' baked light).

| File | What it is | Used by |
|---|---|---|
| `piano-white.png` | one glossy IVORY key seen slightly from above: warm ivory top face, baked top-left key light, a gentle center gloss, a thin right-edge seam shadow (the gap between keys) and a bevelled lit FRONT LIP with AO underneath — a solid physical key, not a flat box | `.gh-key` background |
| `piano-white-press.png` | the pressed white key: surface dimmed, a baked top AO (the key tilted down, back in shadow) and the front lip collapsed so it reads SUNK | `.gh-key:active` / `.is-hit` background |
| `piano-black.png` | one raised EBONY key: dark body, a glossy top-left highlight streak, a lit front cap (the tip that catches light) and a baked drop shadow so it sits proud of the whites | `.piano-black-key` background (decorative) |
| `piano-black-press.png` | the pressed black key: dimmed, streak killed, cap darkened (kept for completeness / future interactive blacks) | — |
| `piano-fascia.png` | the piano's wooden nameboard / key-slip rail: warm muted wood, baked top-left light wash, soft woodgrain, a front bevel highlight and a muted-maroon FELT strip along the bottom the keys emerge from | `.piano-fascia` background |

Key press is a CSS `translateY` + a collapsing drop-shadow **plus** a swap to the
baked pressed sprite — the keys themselves are always baked material art, never a
CSS gradient. The target key's glow is a static (non-looping) gold ring, per the
sensory-calm rule.
