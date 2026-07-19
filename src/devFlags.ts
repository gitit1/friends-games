// Developer-only flags, controlled by the .env / .env.local files (Vite VITE_*).
// These are evaluated at startup; restart the dev server after editing .env*.

/**
 * Touch / kiosk lock. When on, the app blocks the browser's default touch
 * behaviour (focus stealing, text selection, zoom, scroll, ghost clicks) while
 * keeping buttons working. See src/useTouchLock.ts for what it actually does.
 *
 * Gated on `import.meta.env.DEV` as well as the flag, so it is ONLY ever active
 * in `npm run dev` — a production build (`vite build`) always leaves it off,
 * no matter what .env says. Toggle it via VITE_TOUCH_LOCK in .env.
 */
export const TOUCH_LOCK = import.meta.env.DEV && import.meta.env.VITE_TOUCH_LOCK === 'true'

/**
 * The 3D friend gallery (Three.js) is a heavy dev-only toy. Only available in dev
 * mode — in production the button is hidden and the Three.js chunk is never
 * loaded (its lazy import is only reached behind this flag), so it costs nothing.
 */
export const SHOW_3D = import.meta.env.DEV

/**
 * Dev: UNLOCK every swallow-game level, so you can jump straight into any level to
 * test it. ON by default whenever running `npm run dev`; a production build always
 * keeps normal progression. To test the real locked progression in dev, set
 * `VITE_LOCK_LEVELS=true` in .env.local.
 */
export const UNLOCK_ALL_LEVELS = import.meta.env.DEV && import.meta.env.VITE_LOCK_LEVELS !== 'true'
