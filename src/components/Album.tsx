import { useEffect, useState } from 'react'
import GameShell from './GameShell'
import Friend from './Friend'
import { FRIEND_KINDS, FRIEND_NATURAL } from './FriendArt'
import { FRIENDS, friendName, friendNumber, friendColorName } from '../friends'
import { rosterCount } from '../level'
import { useMetFriends } from '../friendsMet'
import { WORLDS, WORLD_PROP_CATALOG, type WorldId } from '../games/hole/world'
import { useDiscoveries, hasDiscovered } from '../games/hole/discoveries'
import { playTap, playFriend, unlockAudio } from '../audio'
import { useT, dirFor } from '../i18n'

const PER_PAGE = 10
// tab order: friends first, then the six swallow-game worlds (RTL: friends reads
// rightmost, matching the app's Hebrew-first reading order)
type TabId = 'friends' | WorldId
const TABS: TabId[] = ['friends', ...WORLDS.map((w) => w.id)]
const TAB_EMOJI: Record<TabId, string> = { friends: '🧑‍🤝‍🧑', candy: '🍬', city: '🏙️', beach: '🏖️', space: '🚀', farm: '🐮', underwater: '🐠' }

// The ALBUM — a self-paced sticker book. "חברים" is the friends cast you've MET
// in the swallow game; the six world tabs are per-world DISCOVERY pages — every
// prop kind you've swallowed at least once in that world, from candy to the deep
// sea. Undiscovered = a faint silhouette (like the friends page); discovered =
// full colour + its Hebrew/English name. Nothing here is ever lost (see
// friendsMet.ts / discoveries.ts) — a calm "collect them all at your own pace"
// loop, and a reason to replay old levels for the prop kinds you missed.
export default function Album({ onExit }: { onExit: () => void }) {
  const { t, lang } = useT()
  const [tab, setTab] = useState<TabId>('friends')

  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 360))
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <GameShell title={t('album.title')} emoji="📖" onExit={onExit}>
      <div className="album-tabs" dir={dirFor(lang)}>
        {TABS.map((id) => (
          <button key={id} className={`pill album-tab ${tab === id ? 'pill-active' : ''}`} onClick={() => { playTap(); setTab(id) }}>
            <span aria-hidden="true">{TAB_EMOJI[id]}</span> {t(id === 'friends' ? 'album.tab.friends' : `album.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'friends' ? <FriendsPage vw={vw} /> : <WorldPage worldId={tab} />}
    </GameShell>
  )
}

// ---- "חברים" page: the friends sticker book (unchanged from before the album
// grew world tabs) ------------------------------------------------------------
function FriendsPage({ vw }: { vw: number }) {
  const { t } = useT()
  const total = rosterCount()
  const groups = Math.ceil(total / PER_PAGE)
  const [group, setGroup] = useState(0)
  const start = group * PER_PAGE
  const end = Math.min(start + PER_PAGE, total)

  const metList = useMetFriends()
  const metSet = new Set(metList)
  const collected = metList.filter((i) => i < total).length
  const [sel, setSel] = useState<number | null>(null) // tapped friend → detail card

  // size so the widest friend in this decade is ~30% of the row → ≥3 per row
  const rowW = Math.min(vw - 16, 560)
  const decadeMaxW = Math.max(...FRIENDS.slice(start, end).map((_, j) => FRIEND_NATURAL[FRIEND_KINDS[start + j]].w))
  const scale = (rowW * 0.3) / decadeMaxW

  return (
    <>
      <div className="album-meter">
        <span className="album-count" dir="ltr">{collected} / {total}</span>
        <span className="album-bar"><span className="album-fill" style={{ width: `${(collected / Math.max(1, total)) * 100}%` }} /></span>
      </div>

      {groups > 1 && (
        <div className="meet-decades" dir="ltr">
          {Array.from({ length: groups }, (_, g) => {
            const s = g * PER_PAGE
            const e = Math.min(s + PER_PAGE, total)
            return (
              <button key={g} className={`pill meet-decade ${g === group ? 'pill-active' : ''}`} onClick={() => { playTap(); setGroup(g) }}>
                {s + 1}–{e}
              </button>
            )
          })}
        </div>
      )}

      <p className="meet-intro">{t('album.intro')}</p>

      <div className="meet-grid">
        {FRIENDS.slice(start, end).map((friend, j) => {
          const i = start + j
          const got = metSet.has(i)
          if (got) {
            return (
              <button className="album-card got" key={friend.name} style={{ animationDelay: `${j * 0.04}s` }} onClick={() => { unlockAudio(); playFriend(i); setSel(i) }}>
                <Friend index={i} scale={scale} showNumber={false} />
                <span className="meet-name">{friend.name}</span>
              </button>
            )
          }
          return (
            <div className="album-card locked" key={friend.name} style={{ animationDelay: `${j * 0.04}s` }}>
              <span className="album-slot" aria-hidden="true">
                <span className="album-silhouette"><Friend index={i} scale={scale} showNumber={false} /></span>
                <span className="album-q">?</span>
              </span>
              <span className="meet-name">?</span>
            </div>
          )
        })}
      </div>

      {/* a met friend's card: name, number, colour — tap to hear it, tap out to close */}
      {sel != null && (
        <div className="album-detail" onClick={() => setSel(null)}>
          <div className="album-detail-card" onClick={(e) => e.stopPropagation()}>
            <button className="album-detail-x" onClick={() => setSel(null)} aria-label="✕">✕</button>
            <button className="album-detail-friend" onClick={() => { unlockAudio(); playFriend(sel) }} aria-label={friendName(sel)}>
              <Friend index={sel} scale={scale * 1.7} showNumber={false} />
            </button>
            <h3 className="album-detail-name">{friendName(sel)}</h3>
            <p className="album-detail-meta" dir="rtl">{t('album.number')} {friendNumber(sel)} · {friendColorName(sel)}</p>
          </div>
        </div>
      )}
    </>
  )
}

// ---- a per-world DISCOVERY page: every prop kind that world can spawn, one
// sticker per kind — undiscovered ones stay a dark silhouette (mirrors the
// friends page exactly), discovered ones show their real emoji + kid-clear name.
function WorldPage({ worldId }: { worldId: WorldId }) {
  const { t } = useT()
  useDiscoveries() // subscribe so a fresh discovery (made earlier this session) re-renders this page
  const catalog = WORLD_PROP_CATALOG[worldId]
  const collected = catalog.filter((e) => hasDiscovered(worldId, e.kind)).length
  const total = catalog.length

  return (
    <>
      <div className="album-meter">
        <span className="album-count" dir="ltr">{collected} / {total}</span>
        <span className="album-bar"><span className="album-fill" style={{ width: `${(collected / Math.max(1, total)) * 100}%` }} /></span>
      </div>

      <p className="meet-intro">{t('album.prop.intro')}</p>

      <div className="meet-grid">
        {catalog.map((entry, j) => {
          const got = hasDiscovered(worldId, entry.kind)
          const name = t(`hole.prop.${entry.kind}`)
          if (got) {
            return (
              <div className="album-card got" key={entry.kind} style={{ animationDelay: `${j * 0.04}s` }}>
                <span className="album-emoji" aria-hidden="true">{entry.emoji}</span>
                <span className="meet-name">{name}</span>
              </div>
            )
          }
          return (
            <div className="album-card locked" key={entry.kind} style={{ animationDelay: `${j * 0.04}s` }}>
              <span className="album-slot" aria-hidden="true">
                <span className="album-silhouette album-emoji">{entry.emoji}</span>
                <span className="album-q">?</span>
              </span>
              <span className="meet-name">?</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
