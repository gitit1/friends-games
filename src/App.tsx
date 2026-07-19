import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import CategoryScreen from './components/CategoryScreen'
import MeetFriends from './components/MeetFriends'
import FriendWorld from './components/FriendWorld'
import CalmOverlay from './components/CalmOverlay'
import { GAMES, CATEGORIES } from './games/registry'
import { FRIENDS, friendName } from './friends'
import { useT } from './i18n'
import { BackContext, type BackTarget } from './nav'
import { useTouchLock } from './useTouchLock'
import { SHOW_3D } from './devFlags'
import { stopClip } from './voice'

// the gallery now shows the "pop-up depth" view (the existing 2D friend on
// parallax layers). The Three.js Friend3D experiment stays in the tree but unrouted.
const FriendDepth = lazy(() => import('./components/FriendDepth'))
const StyleLab = lazy(() => import('./components/StyleLab'))
const TestHub = lazy(() => import('./components/TestHub'))
const VoiceTest = lazy(() => import('./components/VoiceTest'))

// Tiny hash router so a refresh keeps you on the same screen and the browser
// Back button works (handy for testing). Routes:
//   #/                home (category cubes)
//   #/meet            meet the friends
//   #/gallery         3D friend (Three.js)
//   #/cat/<id>        a category's game list
//   #/game/<id>       a game
type Route =
  | { kind: 'home' }
  | { kind: 'meet' }
  | { kind: 'gallery'; id?: string }
  | { kind: 'lab' }
  | { kind: 'test' }
  | { kind: 'voicetest' }
  | { kind: 'friend'; id: string; quiet?: boolean }
  | { kind: 'cat'; id: string }
  | { kind: 'game'; id: string; from?: string }

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === '') return { kind: 'home' }
  if (h === 'meet') return { kind: 'meet' }
  if (h === 'lab') return { kind: 'lab' }
  if (h === 'test') return { kind: 'test' }
  if (h === 'voicetest') return { kind: 'voicetest' }
  if (h === 'gallery') return { kind: 'gallery' }
  const parts = h.split('/')
  const [seg, id] = parts
  if (seg === 'gallery') return { kind: 'gallery', id } // gallery/<friendIndex>
  if (seg === 'cat' && id) return { kind: 'cat', id }
  // a game can carry where it was opened from: game/<id>/f/<friendIndex>
  if (seg === 'game' && id) return { kind: 'game', id, from: parts[2] === 'f' ? parts[3] : undefined }
  // friend/<i> narrates the intro (also when paging ◀▶); friend/<i>/q is "quiet" — back from a game
  if (seg === 'friend' && id) return { kind: 'friend', id, quiet: parts[2] === 'q' }
  return { kind: 'home' }
}

function go(path: string) {
  window.location.hash = `#/${path}`
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  const shellRef = useRef<HTMLDivElement>(null)
  // dev-only touch/kiosk lock (no-op unless enabled in .env). See useTouchLock.
  useTouchLock(shellRef)

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // scroll to top when the screen changes, and cut off any playing voice clip so
  // a count/narration never bleeds across screens (friend→friend, into a game, …)
  useEffect(() => {
    window.scrollTo(0, 0)
    stopClip()
  }, [route])

  const home = () => go('')
  const { t } = useT()

  // The shared back button (in GameShell) returns one level up, not to main.
  // Default is home; routes that sit a level deeper override it below and flip
  // backIsHome to false, which makes the top bar also show a 🏠 Home button.
  let back: BackTarget = { emoji: '🏠', label: t('nav.home') }
  let backIsHome = true
  let view = <HomeScreen onOpen={(id) => go(id)} onOpenCategory={(id) => go(`cat/${id}`)} />

  if (route.kind === 'meet') {
    view = <MeetFriends onExit={home} onOpen={(i) => go(`friend/${i}`)} />
  } else if (route.kind === 'friend') {
    const i = Number(route.id)
    if (i >= 0 && i < FRIENDS.length) {
      back = { emoji: '⭐', label: t('home.meet.title') } // back to the friends list
      backIsHome = false
      view = (
        <FriendWorld
          index={i}
          quiet={route.quiet}
          onExit={() => go('meet')}
          onNavigate={(j) => go(`friend/${j}`)} // page ◀▶ → narrate the next friend's intro (not quiet)
          onPlayGame={(id) => go(`game/${id}/f/${i}`)}
        />
      )
    }
  } else if (route.kind === 'lab' && SHOW_3D) {
    view = (
      <Suspense fallback={<p className="three-loading">טוען… 🎨</p>}>
        <StyleLab onExit={() => go('test')} />
      </Suspense>
    )
  } else if (route.kind === 'test' && SHOW_3D) {
    view = (
      <Suspense fallback={<p className="three-loading">טוען… 🧪</p>}>
        <TestHub onExit={home} go={go} />
      </Suspense>
    )
  } else if (route.kind === 'voicetest' && SHOW_3D) {
    view = (
      <Suspense fallback={<p className="three-loading">טוען… 🔊</p>}>
        <VoiceTest onExit={() => go('test')} />
      </Suspense>
    )
  } else if (route.kind === 'gallery' && SHOW_3D) {
    // the gallery is opened from the test hub — like a game screen, its top bar
    // shows a back arrow (one level up, to the hub) alongside the 🏠 button
    back = { emoji: '🧪', label: 'אזור בדיקות' }
    backIsHome = false
    view = (
      <Suspense fallback={<p className="three-loading">טוען תלת מימד… 🧊</p>}>
        <FriendDepth onExit={() => go('test')} start={Number(route.id)} />
      </Suspense>
    )
  } else if (route.kind === 'game') {
    const game = GAMES.find((g) => g.id === route.id)
    if (game) {
      const fromFriend = route.from !== undefined ? Number(route.from) : NaN
      if (Number.isInteger(fromFriend) && fromFriend >= 0 && fromFriend < FRIENDS.length) {
        // opened from a friend's world → "back" returns to that friend, not the category
        back = { emoji: '⭐', label: friendName(fromFriend) }
        backIsHome = false
        view = (
          <Suspense fallback={<p className="three-loading">טוען… 🕳️</p>}>
            <game.Component onExit={() => go(`friend/${fromFriend}/q`)} friend={fromFriend} />
          </Suspense>
        )
      } else {
        const cat = CATEGORIES.find((c) => c.id === game.category)
        // back to the category this game lives in, so picking another game is one tap
        if (cat) {
          back = { emoji: cat.emoji, label: t(`cat.${cat.id}`) }
          backIsHome = false
        }
        view = (
          <Suspense fallback={<p className="three-loading">טוען… 🕳️</p>}>
            <game.Component onExit={() => go(`cat/${game.category}`)} />
          </Suspense>
        )
      }
    }
  } else if (route.kind === 'cat') {
    const category = CATEGORIES.find((c) => c.id === route.id)
    if (category) view = <CategoryScreen category={category} onPick={(id) => go(`game/${id}`)} onExit={home} />
  }

  return (
    <div className="app-shell" ref={shellRef}>
      <BackContext.Provider value={{ back, goHome: home, backIsHome }}>{view}</BackContext.Provider>
      {/* the global "רגע של רוגע" calm overlay sits ABOVE whatever screen is
          showing — a sibling, never a wrapper, so the screen/game underneath
          stays fully mounted while it's open (see calmMode.ts) */}
      <CalmOverlay />
    </div>
  )
}
