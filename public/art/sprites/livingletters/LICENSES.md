# Living-letters tile sprites — licenses

All files here are **original art generated in-project** by a node-canvas bake
script (`scripts/gen-livingletters-art.mjs`) — analytic gradients, baked
lighting/AO, seeded wood-grain texture, no third-party assets. **CC0 / no
attribution required.** Muted, sensory-calm palette (desaturated siblings of
the app's existing per-letter colour identity).

| File | What it is | Used by |
|---|---|---|
| `tile-0.png` … `tile-9.png` | a small painted-wooden alphabet BLOCK seen at a 3/4 angle: lit top + shaded right faces for depth, wood grain, a baked contact shadow, edge bevel, and a pair of baked glossy googly eyes (always "awake" — the tile's letter changes every round). The Latin glyph is NOT baked; it overlays as crisp CSS text centred on the block's front face. | `.ll-guy` background (via `LetterGuy.tsx`'s `tileFor()` index), shared by SpellWord, FirstLetter, RhymeMachine and BlendSounds |
| `shelf.png` | a low wooden SHELF surface in perspective — a receding top face (plank grain, converging seams, far-edge AO) + a thick lit front lip + baked contact shadow — the picture/emoji rests on it inside `.spell-scene`, over the illustrated `wooden-playroom.jpg` backdrop | `.spell-shelf` background, shared by SpellWord, FirstLetter, RhymeMachine, BlendSounds, EnglishCount and TraceLetter |

Ten tints keep each letter a consistent little character across every game
that uses `LetterGuy`, mirroring the sibling bakes `gen-lettertalk-art.mjs`
(the hero letter block in "האות שלי מדברת") and `gen-letterhunt-art.mjs`
(the alphabet blocks in "מוצאים את האות") — same toy-block family, tray scale.
