// ─────────────────────────────────────────────────────────────────────────────
// SceneBackdrop — the standard illustrated back layer for a game scene.
//
// It renders ONE static illustrated image (from the CC0 library in
// public/art/bg/, see LICENSES.md) as the far back plane of a scene box,
// replacing a flat CSS back-wall gradient. Zero animation, one <img>, lazy
// decode, no parallax — the calm/perf rules are law.
//
// USAGE — drop it as the FIRST child of a `position: relative; overflow: hidden`
// scene box; the existing mid/foreground CSS layers (floor, counter, props,
// friend) sit on top because the backdrop pins itself to z-index 0:
//
//   <div className="feed-scene">            // relative + overflow:hidden already
//     <SceneBackdrop src="meadow.jpg" position="center 38%" scrim="soft" />
//     …existing floor / counter / actor layers…
//   </div>
//
// Props:
//   src         file name inside public/art/bg  (e.g. "meadow.jpg")
//   position    object-position of the image (tune what's visible), default "center"
//   fit         "cover" (default) | "contain"
//   scrim       legibility veil over the image: "none" | "soft" (default) |
//               "strong" | "top" | "bottom". Keeps friends/text readable.
//   silhouette  optional far silhouette PNG (alpha) laid along the bottom of the
//               box, in front of the image but behind everything else (e.g. a soft
//               crowd line). File name inside public/art/bg.
//   className   extra classes on the wrapper.
//
// Evening mode: nothing to do here. The app shell dims the whole `.game-screen`
// via `.evening-mode .game-screen { filter: … }`, so this backdrop is dimmed with
// the rest of the scene automatically — we deliberately DON'T add our own filter
// so we never fight the shell.
// ─────────────────────────────────────────────────────────────────────────────
const ART_BASE = import.meta.env.BASE_URL + 'art/bg/'

type Scrim = 'none' | 'soft' | 'strong' | 'top' | 'bottom'

export interface SceneBackdropProps {
  src: string
  position?: string
  fit?: 'cover' | 'contain'
  scrim?: Scrim
  silhouette?: string
  className?: string
}

export default function SceneBackdrop({
  src,
  position = 'center',
  fit = 'cover',
  scrim = 'soft',
  silhouette,
  className = '',
}: SceneBackdropProps) {
  return (
    <div className={`scene-backdrop ${className}`.trim()} aria-hidden="true">
      <img
        className="scene-backdrop-img"
        src={ART_BASE + src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ objectFit: fit, objectPosition: position }}
      />
      {silhouette && (
        <img
          className="scene-backdrop-sil"
          src={ART_BASE + silhouette}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      {scrim !== 'none' && <span className={`scene-backdrop-scrim scrim-${scrim}`} />}
    </div>
  )
}
