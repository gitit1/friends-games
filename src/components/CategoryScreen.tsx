import { gamesInCategory, type Category } from '../games/registry'
import { playTap, unlockAudio } from '../audio'
import { stopSpeech } from '../speech'
import { useT } from '../i18n'
import MuteButton from './MuteButton'
import CalmButton from './CalmButton'

type Props = {
  category: Category
  onPick: (id: string) => void
  onExit: () => void
}

// The games inside one category. Reuses the game-screen frame so it feels like
// any other screen, with the big "home" button.
export default function CategoryScreen({ category, onPick, onExit }: Props) {
  const { t } = useT()
  function tap() {
    unlockAudio()
    stopSpeech()
    playTap()
  }
  const games = gamesInCategory(category.id)
  const catTitle = t(`cat.${category.id}`)

  return (
    <div className="game-screen">
      <header className="game-top-bar">
        {/* round icon buttons in a row above the title — same as the home page */}
        <div className="game-controls">
          <button
            className="control-btn"
            onClick={() => {
              tap()
              onExit()
            }}
            aria-label={t('nav.home.aria')}
          >
            <span aria-hidden="true">🏠</span>
          </button>
          <MuteButton />
          <CalmButton />
        </div>
        <h1 className="game-title">
          <span aria-hidden="true">{category.emoji}</span> {catTitle}
        </h1>
      </header>
      <main className="game-body">
        <nav className="game-grid" aria-label={catTitle}>
          {games.map((game, i) => (
            <button
              key={game.id}
              className="game-card"
              style={{ background: game.color, animationDelay: `${i * 0.05}s` }}
              onClick={() => {
                tap()
                onPick(game.id)
              }}
            >
              <span className="game-card-emoji" aria-hidden="true">
                {game.emoji}
              </span>
              <span className="game-card-title">{t(`game.${game.id}`)}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  )
}
