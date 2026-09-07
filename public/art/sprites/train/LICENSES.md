# Number-train material sprites — licenses

All files here are **original art generated in-project** (a dependency-free
node baker — seeded value-noise materials, analytic key light + edge ambient
occlusion, SDF anti-aliasing; no third-party assets, Node built-ins only).
No attribution required (CC0-equivalent).

Palette is deliberately muted/warm (sensory rule): a wooden-toy-train look —
teal-metal boiler, brass hoops, warm painted-wood cab + wagons, terracotta
station roof. Baked at ~2–2.6× display size for crispness.

| File | What it is | Used by |
|---|---|---|
| `engine.png` | the locomotive BODY (no wheels): shaded teal boiler cylinder with a baked cylindrical highlight, brass hoops + steam dome, dark-metal funnel + smokebox with baked AO, warm-wood cab with a glass window, warm headlamp, cow-catcher, contact shadow | `.tr-engine-body` |
| `wagon.png` | a numbered wagon BODY (no wheels): warm painted-wood plank car, plank grooves, roof cap, and a RECESSED empty cream number plate (the digit stays crisp CSS text on top) | `.tr-car-body` |
| `wheel.png` | one baked wheel: dark tyre ring, steel rim with baked key light, six brass spokes + brass hub, outer AO. Spins via CSS `rotate` while driving | `.tr-wheel` (engine + wagons) |
| `rail.png` | a steel rail strip (railhead highlight, dark web, foot lift, micro-pitting + length-wise specular glints) — stretched across the scene | `.tr-rail` |
| `sleeper.png` | one wooden sleeper/tie + transparent gap (grain, bevel, baked AO); a `repeat-x` tile whose period matches `TIE_NEAR_PERIOD`/`TIE_FAR_PERIOD` | `.tr-ties` |
| `ballast.png` | the gravel track bed (layered value-noise pebbles, warm-gray muted, top-edge lift) — laid as the ground surface | `.tr-ground` |
| `numtile.png` | a warm cream wood button face for the number pool (baked grain + AO); the digit stays crisp CSS text | `.tr-num` |
| `station.png` | the station house: baked plaster walls, terracotta tiled roof (courses + staggered joints), arched wood door, two glass windows with muntins, a gable clock, stone platform, contact shadow | `.tr-station-house img` |

The crisp station number/sign and every car digit are **CSS text** over the
baked plates — the only text in the scene, kept sharp + readable on purpose.
