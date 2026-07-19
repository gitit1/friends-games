import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, gamesInCategory, type CategoryId } from '../games/registry'
import Friend from './Friend'
import { FRIEND_NATURAL, friendKindForIndex } from './FriendArt'
import SettingsPanel from './SettingsPanel'
import FullscreenButton from './FullscreenButton'
import MuteButton from './MuteButton'
import CalmButton from './CalmButton'
import { rosterCount } from '../level'
import { playTap, unlockAudio } from '../audio'
import { stopSpeech } from '../speech'
import { useT } from '../i18n'
import { useSettings } from '../settings'
import { SHOW_3D } from '../devFlags'

// 3 distinct random friends to greet on the home card (fresh each visit)
function pickThree(): number[] {
  const all = Array.from({ length: rosterCount() }, (_, i) => i)
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, 3).sort((a, b) => a - b)
}

type HomeScreenProps = {
  // open a special screen: 'meet' (meet the friends) or 'gallery'
  onOpen: (id: string) => void
  // open a category's game list
  onOpenCategory: (id: CategoryId) => void
}

export default function HomeScreen({ onOpen, onOpenCategory }: HomeScreenProps) {
  const { t } = useT()
  const { eveningMode } = useSettings()
  const [featured] = useState<number[]>(pickThree)

  // size the greeting friends DYNAMICALLY to the card they sit in: fill ~74% of
  // its height, but never wider than ~17% of it (so 2-on-a-side + 1 always fit)
  const cardRef = useRef<HTMLButtonElement>(null)
  const [card, setCard] = useState({ w: 480, h: 100 })
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const measure = () => setCard({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const friendScale = (i: number) => {
    const nat = FRIEND_NATURAL[friendKindForIndex(i)]
    return Math.min((card.h * 0.74) / nat.h, (card.w * 0.17) / nat.w)
  }
  function tap() {
    unlockAudio()
    stopSpeech()
    playTap()
  }
  function open(id: string) {
    tap()
    onOpen(id)
  }
  function openCategory(id: CategoryId) {
    tap()
    onOpenCategory(id)
  }

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="home-controls">
          {SHOW_3D && (
            <button className="gallery-button" aria-label="אזור בדיקות" onClick={() => open('test')}>
              🧪
            </button>
          )}
          <MuteButton className="fullscreen-button" />
          <CalmButton className="fullscreen-button calm-btn" />
          <FullscreenButton />
          <SettingsPanel />
        </div>
        <h1 className="home-title">
          <span aria-hidden="true">🌟</span> {t('app.title')}
          {eveningMode && (
            <span className="evening-chip" aria-label={t('home.evening.chip')}>
              🌙
            </span>
          )}
        </h1>
      </header>

      {/* Featured: meet the friends */}
      <button className="featured-card" ref={cardRef} onClick={() => open('meet')}>
        {/* 2 friends on the start side, 1 on the end side (auto-flips RTL↔LTR) */}
        <span className="friend-cluster" aria-hidden="true">
          <Friend index={featured[0]} scale={friendScale(featured[0])} showNumber={false} lively />
          <Friend index={featured[1]} scale={friendScale(featured[1])} showNumber={false} lively />
        </span>
        <span className="featured-text">
          <span className="featured-title">{t('home.meet.title')}</span>
          <span className="featured-sub">{t('home.meet.sub')}</span>
        </span>
        <span className="friend-cluster" aria-hidden="true">
          <Friend index={featured[2]} scale={friendScale(featured[2])} showNumber={false} lively />
        </span>
      </button>

      {/* Category cubes — tap one to see its games */}
      <nav className="category-grid" aria-label={t('home.categories')}>
        {CATEGORIES.map((category) => {
          if (gamesInCategory(category.id).length === 0) return null
          return (
            <button
              key={category.id}
              className="category-card"
              style={{ background: category.color }}
              onClick={() => openCategory(category.id)}
            >
              <span className="category-cover" aria-hidden="true">
                <span className="category-cover-emoji">{category.emoji}</span>
              </span>
              <span className="category-title">{t(`cat.${category.id}`)}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
