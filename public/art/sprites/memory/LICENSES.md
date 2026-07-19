# Memory game — baked material art

All files in this folder are **original works** created for this project,
procedurally baked with `@napi-rs/canvas` (seeded value-noise grain + analytic
baked lighting/AO). No third-party assets are used.

- `card-back.png` — the face-down card: dusty-teal card stock, soft stipple, an
  inset frame line and a centred turquoise-friend emblem, with baked emboss, a
  top-left bevel, bottom-right AO and a soft drop shadow.
- `card-face.png` — the face-up card: warm ivory stock with a recessed mat window
  that hosts the friend, plus inner AO, a laminated sheen streak, bevel and a
  baked drop shadow.
- `table-felt.jpg` — the card-table surface: muted sage felt with baked fibre
  grain, a warm centre light pool and a soft edge vignette.

Regenerate with:

    npm i --no-save @napi-rs/canvas && node scripts/gen-memory-art.mjs

## License

Released to the **public domain** under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
