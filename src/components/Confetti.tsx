// A reusable burst of confetti that rains over the WHOLE app (fixed, full-screen,
// never blocks taps). Render <Confetti active={done} /> in any game — when `active`
// turns true it falls once. Deterministic per-index variety (no re-render jitter),
// and it's automatically calmed away by the global reduce-motion rule.
//
// `calm` = a sensory-safe variant: few, low-opacity star-dust specks drifting slowly
// down (no dense burst, no flash) — for children who find full confetti stimulating.
const COLORS = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb7185', '#4ade80']
const STAR_COLORS = ['#fde68a', '#c7d2fe', '#bae6fd', '#e9d5ff', '#fbcfe8']
const PIECES = 42
const CALM_PIECES = 16

export default function Confetti({
  active,
  calm = false,
  pieces,
}: {
  active: boolean
  calm?: boolean
  /** Cap the burst's particle count (fewer promoted layers → lighter under CPU
   *  throttle). Defaults to the full 42 (16 for calm). */
  pieces?: number
}) {
  if (!active) return null
  const n = pieces ?? (calm ? CALM_PIECES : PIECES)
  return (
    <div className={`confetti${calm ? ' stardust' : ''}`} aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => {
        const left = (i * (calm ? 617 : 829)) % 100 // spread across the width
        const delay = ((i * 53) % (calm ? 90 : 70)) / 100
        const dur = calm ? 4.6 + ((i * 31) % 14) / 10 : 2.1 + ((i * 31) % 13) / 10 // calm: slow drift
        return (
          <span
            key={i}
            className={`confetti-piece${calm ? ' calm' : ''}`}
            style={{
              left: `${left}%`,
              ...(calm
                ? { color: STAR_COLORS[i % STAR_COLORS.length] }
                : { background: COLORS[i % COLORS.length], borderRadius: i % 3 === 0 ? '50%' : '2px' }),
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          >
            {calm ? '✦' : null}
          </span>
        )
      })}
    </div>
  )
}
