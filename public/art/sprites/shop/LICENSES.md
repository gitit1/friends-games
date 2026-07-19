# Shop material sprites — licenses

All files here are **original art generated in-project** (a node-canvas bake
script — seeded value-noise materials, analytic shading + baked AO/contact
shadows, no third-party assets). CC0 / no attribution required. The generator
lives with the build tooling (scratch bake script, `@napi-rs/canvas`); the
sprites are pre-rendered and committed here.

| File | What it is | Material | Used by |
|---|---|---|---|
| `coin.png` | milled warm-gold money token: reeded rim ticks, brushed concentric face, embossed star, baked key light + underside AO | metal | `.shop-coin` (till drawer + price tag) and the `.shop-coinbtn` face |
| `register.png` | toy cash register: muted-teal plastic body with baked 3D shading, recessed dark LCD screen (the running count overlays it), cream keypad + one terracotta accent key, baked contact shadow | plastic | `.shop-register` |
| `drawer.png` | open cash-drawer tray seen front-above: warm metal interior with four coin wells, baked back-wall AO, a front lip + handle | metal/wood | `.shop-drawer` |
| `counter.jpg` | warm wooden counter plank material: grain fibers (value noise), per-plank tone, knots with rings, varnish sheen | wood | `.shop-counter` top + front faces |
| `prod-apple.png` | glossy red apple with stem + leaf, baked highlight | fruit | shop goods |
| `prod-milk.png` | paper milk carton, gable top, blue label + milk-drop | paper | shop goods |
| `prod-juice.png` | paper juice box with foil top, straw, orange fruit label | paper | shop goods |
| `prod-jam.png` | glass jam jar with fill, metal lid, cream label + berries | glass/metal | shop goods |
| `prod-can.png` | brushed-metal tin can, top rim ellipse, tomato label | metal | shop goods |
| `prod-bread.png` | baked loaf with crust highlight + baker's slashes | baked | shop goods |
| `prod-cookie.png` | round cookie with wobbly edge + chocolate chips | baked | shop goods |
| `prod-cheese.png` | waxy cheese wedge with holes + darker rind band | dairy | shop goods |

Total ≈ 280 KB. The coin is a single finished gold sprite (money — no per-tier
hue wash, unlike the coin-sort friend-coins).
