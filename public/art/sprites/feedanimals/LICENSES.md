# FeedAnimals baked art — licenses

All images in this folder and the `feed-*` / `bg-meadow` files under
`public/art/bg/` are **original, procedurally generated** by
`scripts/gen-feedanimals-art.mjs` (HTML `<canvas>` drawing rendered headlessly).
No third-party assets, stock, fonts, or AI image models were used.

**License: CC0 1.0 (public domain dedication).** Free to use, modify, redistribute.

| file | what | size |
| --- | --- | --- |
| `food-bone.png` | dog treat — baked ivory bone, speckle texture + AO | ~26 KB |
| `food-fish.png` | cat treat — muted salmon fish, scales + gill + eye | ~12 KB |
| `food-carrot.png` | rabbit treat — orange carrot, ridges + leafy top | ~11 KB |
| `food-seed.png` | parrot treat — muted sunflower, textured seed centre | ~26 KB |
| `bowl-back.png` | ceramic bowl body + interior AO + back rim | ~31 KB |
| `bowl-front.png` | ceramic bowl near lip (occludes treat bottoms) | ~5 KB |
| `board.png` | wooden feeding board in perspective, grain + bevel | ~43 KB |
| `../bg/bg-meadow.jpg` | muted meadow backdrop, layered hills + grass | ~15 KB |

Palette is deliberately muted (sensory-calm: no neon, no pure saturated red).
Regenerate with: `node scripts/gen-feedanimals-art.mjs` (needs `puppeteer`).
