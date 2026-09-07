import { useEffect, useState } from 'react'
import GameShell from './GameShell'
import Friend from './Friend'
import { FRIEND_KINDS, FRIEND_NATURAL } from './FriendArt'
import { FRIENDS } from '../friends'
import { DECADES } from '../decades'
import { rosterCount } from '../level'
import { playTap, unlockAudio } from '../audio'
import { dirFor, useT } from '../i18n'

const PER_PAGE = 10
// widest friend in the whole cast — used to size them all so the biggest reaches
// ~90% of the screen width (the smaller numbers stay proportionally smaller, so
// the "bigger number = bigger friend" staircase is kept).
const MAX_W = Math.max(...FRIEND_KINDS.map((k) => FRIEND_NATURAL[k].w))

// Not a game — "meet the cast". The roster grows toward 100, so instead of one
// long wall of friends we chunk them into groups of ten. A number-range selector
// shows one decade at a time (Assaf reads numbers, so he picks a range himself),
// which keeps the page roomy and uncluttered no matter how big the cast gets.
// The group buttons are derived from FRIENDS.length, so adding the next ten
// friends makes a new button appear on its own. Tap any friend to enter its WORLD.
export default function MeetFriends({ onExit, onOpen }: { onExit: () => void; onOpen: (index: number) => void }) {
  const { t, lang } = useT()
  const total = rosterCount() // capped to the level only if the parent opted in
  const groups = Math.ceil(total / PER_PAGE)
  const [group, setGroup] = useState(0)
  const start = group * PER_PAGE
  const end = Math.min(start + PER_PAGE, total)

  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 360))
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Friend SIZE is capped at a 560px reference (biggest friend ≈ 90% of it) so
  // nobody balloons on a wide screen; the grid itself widens responsively (CSS)
  // so on bigger screens the friends just wrap to fill more per row.
  const baseScale = (0.9 * Math.min(vw - 16, 560)) / MAX_W
  // …but in the high decades the friends are so big they go one-per-row → a very
  // long scroll. So also cap the scale so the WIDEST friend in the current decade
  // is ≤ ~45% of the row, guaranteeing at least two per row. The within-decade
  // staircase is preserved (all share one scale); it just plateaus at the top.
  const gridMax = vw >= 1024 ? 960 : vw >= 640 ? 760 : 560 // keep in sync with .meet-grid CSS
  const rowW = Math.min(vw - 16, gridMax)
  const decadeMaxW = Math.max(...FRIENDS.slice(start, end).map((_, j) => FRIEND_NATURAL[FRIEND_KINDS[start + j]].w))
  const scale = Math.min(baseScale, (rowW * 0.45) / decadeMaxW)

  return (
    <GameShell title={t('home.meet.title')} emoji="⭐" onExit={onExit}>
      {groups > 1 && (
        <>
          {/* he: RTL so the ranges read in Hebrew scan order — 1–10 rightmost,
              11–20 next, … flowing right to left. en: LTR, 1–10 leftmost. */}
          <div className="meet-decades" dir={dirFor(lang)}>
            {Array.from({ length: groups }, (_, g) => {
              const s = g * PER_PAGE
              const e = Math.min(s + PER_PAGE, total)
              const decade = DECADES[Math.min(g, DECADES.length - 1)]
              const decadeName = t(`decade.${Math.min(g, DECADES.length - 1)}`)
              return (
                <button
                  key={g}
                  className={`pill meet-decade ${g === group ? 'pill-active' : ''}`}
                  onClick={() => {
                    playTap()
                    setGroup(g)
                  }}
                  aria-label={`${s + 1}–${e} · ${decadeName}`}
                >
                  {decade.emoji} {s + 1}–{e}
                </button>
              )
            })}
          </div>
          {/* the selected decade's name — identity, not a control (no tap target) */}
          <p className="meet-decade-name">{t(`decade.${Math.min(group, DECADES.length - 1)}`)}</p>
        </>
      )}

      <p className="meet-intro">{t('meet.intro')}</p>

      <div className="meet-grid">
        {FRIENDS.slice(start, end).map((friend, j) => {
          const i = start + j
          return (
            <button
              className="meet-friend"
              key={friend.name}
              style={{ animationDelay: `${j * 0.04}s` }}
              onClick={() => {
                unlockAudio()
                playTap()
                onOpen(i)
              }}
              aria-label={friend.name}
            >
              <Friend index={i} scale={scale} showNumber={false} />
              <span className="meet-name">{friend.name}</span>
            </button>
          )
        })}
      </div>
    </GameShell>
  )
}
