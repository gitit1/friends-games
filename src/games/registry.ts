import { lazy, type ComponentType } from 'react'
import MemoryGame from './MemoryGame'
import SkipCount from './SkipCount'
import PlaceValue from './PlaceValue'
import MissingNumber from './MissingNumber'
import CatchFriend from './CatchFriend'
import CalcFriends from './CalcFriends'
import CarRace from './CarRace'
import PopFriends from './PopFriends'
import BigSmall from './BigSmall'
import SeqGame from './SeqGame'
import QtyMatch from './QtyMatch'
import MathChallenge from './MathChallenge'
import WhoGame from './WhoGame'
import PianoFriends from './PianoFriends'
import Tamagotchi from './Tamagotchi'
import ColorFriends from './ColorFriends'
import ConnectDots from './ConnectDots'
import RollDice from './RollDice'
import DrawBoard from './DrawBoard'
import ColorByNumber from './ColorByNumber'
import DrawNumber from './DrawNumber'
import SortByColor from './SortByColor'
import WhichFriend from './WhichFriend'
import LetterTalk from './LetterTalk'
import Syllables from './Syllables'
import LetterBus from './LetterBus'
import NameTower from './NameTower'
import LetterHunt from './LetterHunt'
import TraceHe from './TraceHe'
import SoundWheel from './SoundWheel'
import LetterDrawer from './LetterDrawer'
import BuildNumber from './BuildNumber'
import PatternGame from './PatternGame'
import BasketGame from './BasketGame'
import GoalGame from './GoalGame'
import HockeyGame from './HockeyGame'
import BowlingGame from './BowlingGame'
import DanceGame from './DanceGame'
import LaughGame from './LaughGame'
import ParrotGame from './ParrotGame'
import IceCreamGame from './IceCreamGame'
import FeedAnimals from './FeedAnimals'
import CakeMaker from './CakeMaker'
import Garden from './Garden'
import ShopGame from './ShopGame'
import NumberTrain from './NumberTrain'
import BubblePopGame from './BubblePopGame'
import SpellWord from './SpellWord'
import FirstLetter from './FirstLetter'
import RhymeMachine from './RhymeMachine'
import BlendSounds from './BlendSounds'
import EnglishCount from './EnglishCount'
import TraceLetter from './TraceLetter'
import SortShelf from './sortshelf/SortShelf'
import PottyTraining from './PottyTraining'
import Feelings from './Feelings'
import Schedule from './Schedule'
import Help from './Help'
import CoinSort from './CoinSort'
import BandGame from './BandGame'
import RhythmBlocks from './RhythmBlocks'
// The hole game is real 3D (three.js) — lazy-loaded so three.js stays out of the
// main bundle and only loads when this game is opened.
const HoleGame = lazy(() => import('./HoleGame3D')) as unknown as ComponentType<GameProps>

// Every game gets a callback to return to the home screen.
export type GameProps = {
  onExit: () => void
  // when opened from a friend's world, that friend's index (so e.g. the dance
  // game shows THAT friend dancing)
  friend?: number
}

// Home-screen sections. Games are grouped so the home screen stays tidy as the
// roster of games grows. Empty categories are simply not shown.
export type CategoryId =
  | 'numbers'
  | 'thinking'
  | 'fun'
  | 'music'
  | 'create'
  | 'letters'
  | 'sports'
  | 'english'
  | 'growup'

export type Category = {
  id: CategoryId
  title: string
  emoji: string
  // Background gradient for the category cube on the home screen.
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 'numbers', title: 'מספרים', emoji: '🔢', color: 'linear-gradient(160deg, #8b8de8, #655dc4)' },
  { id: 'thinking', title: 'חשיבה', emoji: '🧠', color: 'linear-gradient(160deg, #3dc970, #268d4d)' },
  { id: 'fun', title: 'כיף', emoji: '🎉', color: 'linear-gradient(160deg, #e68848, #d05189)' },
  // the musicians decade (games 61–70) — a calm indigo "soft-evening stage" hue
  { id: 'music', title: 'מוזיקה', emoji: '🎵', color: 'linear-gradient(160deg, #7c83e0, #4338ca)' },
  { id: 'create', title: 'יצירה', emoji: '🎨', color: 'linear-gradient(160deg, #e7c747, #e172a9)' },
  { id: 'letters', title: 'אותיות', emoji: '🔤', color: 'linear-gradient(160deg, #b780eb, #9365e0)' },
  { id: 'sports', title: 'ספורט', emoji: '🏀', color: 'linear-gradient(160deg, #eba46a, #df7036)' },
  { id: 'english', title: 'אנגלית', emoji: '🔠', color: 'linear-gradient(160deg, #38aadd, #655dc4)' },
  { id: 'growup', title: 'גדלים', emoji: '🌟', color: 'linear-gradient(160deg, #5eead4, #0d9488)' },
]

export type GameDef = {
  id: string
  title: string
  emoji: string
  // Background gradient for the game card.
  color: string
  category: CategoryId
  Component: ComponentType<GameProps>
  // When true, the game is kept registered (so its #/game/<id> route still works
  // for testing) but hidden from the home/category screens — used while a game is
  // still being built and shouldn't be shown to the child yet.
  hidden?: boolean
}

// Add a new game by dropping a component here and tagging its category.
export const GAMES: GameDef[] = [
  // ── musicians decade (61–70) flagships — shared pentatonic music engine ──
  {
    id: 'band',
    title: 'להקת החברים',
    emoji: '🎸',
    color: 'linear-gradient(160deg, #8b8de8, #f43f5e)',
    category: 'music',
    Component: BandGame,
  },
  {
    id: 'rhythmblocks',
    title: 'מכונת הקצב',
    emoji: '🥁',
    color: 'linear-gradient(160deg, #818cf8, #fb923c)',
    category: 'music',
    Component: RhythmBlocks,
  },
  {
    id: 'potty',
    title: 'גמילה מטיטול',
    emoji: '🚽',
    color: 'linear-gradient(160deg, #5eead4, #0d9488)',
    category: 'growup',
    Component: PottyTraining,
    // The pee now flows from the boy's בולבול (KidArt draws a small tasteful source +
    // the yellow stream arcs into the bowl); verified he+en, boy-aim + girl/friend-sit.
  },
  {
    id: 'feelings',
    title: 'איך אני מרגיש?',
    emoji: '💚',
    color: 'linear-gradient(160deg, #86c7b1, #4d9a86)',
    category: 'growup',
    Component: Feelings,
  },
  {
    id: 'schedule',
    title: 'סדר יום',
    emoji: '📋',
    color: 'linear-gradient(160deg, #5eead4, #0d9488)',
    category: 'growup',
    Component: Schedule,
  },
  {
    id: 'help',
    title: 'מבקשים עזרה',
    emoji: '✋',
    color: 'linear-gradient(160deg, #86c7b1, #4d9a86)',
    category: 'growup',
    Component: Help,
  },
  {
    id: 'coinsort',
    title: 'מטבעות חברים',
    emoji: '🪙',
    color: 'linear-gradient(160deg, #e9c055, #df861f)',
    category: 'numbers',
    Component: CoinSort,
  },
  {
    id: 'feedanimals',
    title: 'מאכילים חיות',
    emoji: '🐾',
    color: 'linear-gradient(160deg, #5bcba2, #17a277)',
    category: 'numbers',
    Component: FeedAnimals,
  },
  {
    id: 'cake',
    title: 'מכינים עוגה',
    emoji: '🎂',
    color: 'linear-gradient(160deg, #ec99c4, #d05189)',
    category: 'create',
    Component: CakeMaker,
  },
  {
    id: 'garden',
    title: 'גינה',
    emoji: '🌱',
    color: 'linear-gradient(160deg, #71d696, #2aae5b)',
    category: 'create',
    Component: Garden,
  },
  {
    id: 'shop',
    title: 'קופה',
    emoji: '🏪',
    color: 'linear-gradient(160deg, #a7aef0, #756edb)',
    category: 'numbers',
    Component: ShopGame,
  },
  {
    id: 'train',
    title: 'רכבת מספרים',
    emoji: '🚂',
    color: 'linear-gradient(160deg, #66c1e9, #1677ac)',
    category: 'numbers',
    Component: NumberTrain,
  },
  {
    id: 'sortshelf',
    title: 'מכולת',
    emoji: '🛒',
    color: 'linear-gradient(160deg, #e2a43d, #bd631e)',
    category: 'thinking',
    Component: SortShelf,
  },
  {
    id: 'skipcount',
    title: 'קפיצות',
    emoji: '🦘',
    color: 'linear-gradient(160deg, #a586eb, #8252ce)',
    category: 'numbers',
    Component: SkipCount,
  },
  {
    id: 'placevalue',
    title: 'עשרות ואחדות',
    emoji: '🔟',
    color: 'linear-gradient(160deg, #e172a9, #c62e6d)',
    category: 'numbers',
    Component: PlaceValue,
  },
  {
    id: 'build',
    title: 'בונים מספר',
    emoji: '🧱',
    color: 'linear-gradient(160deg, #ec99c4, #9365e0)',
    category: 'numbers',
    Component: BuildNumber,
  },
  {
    id: 'missing',
    title: 'המספר החסר',
    emoji: '❓',
    color: 'linear-gradient(160deg, #55cbbc, #20a095)',
    category: 'numbers',
    Component: MissingNumber,
  },
  {
    id: 'bigsmall',
    title: 'גדול או קטן?',
    emoji: '⚖️',
    color: 'linear-gradient(160deg, #5bcba2, #17a277)',
    category: 'numbers',
    Component: BigSmall,
  },
  {
    id: 'sequence',
    title: 'חבר חסר ברצף',
    emoji: '🧩',
    color: 'linear-gradient(160deg, #66c1e9, #1677ac)',
    category: 'numbers',
    Component: SeqGame,
  },
  {
    id: 'quantity',
    title: 'מספר וכמות',
    emoji: '🔟',
    color: 'linear-gradient(160deg, #eba46a, #ca5323)',
    category: 'numbers',
    Component: QtyMatch,
  },
  {
    id: 'calc',
    title: 'מחשבון',
    emoji: '🧮',
    color: 'linear-gradient(160deg, #2ac1b0, #1f847d)',
    category: 'numbers',
    Component: CalcFriends,
  },
  {
    id: 'race',
    title: 'מרוץ מכוניות',
    emoji: '🏎️',
    color: 'linear-gradient(160deg, #e66b80, #c6284f)',
    category: 'numbers',
    Component: CarRace,
  },
  {
    id: 'challenge',
    title: 'אתגר חשבון',
    emoji: '🎓',
    color: 'linear-gradient(160deg, #a7aef0, #756edb)',
    category: 'numbers',
    Component: MathChallenge,
  },
  {
    id: 'memory',
    title: 'זיכרון חברים',
    emoji: '🧠',
    color: 'linear-gradient(160deg, #63aad3, #2f6e98)',
    category: 'thinking',
    Component: MemoryGame,
  },
  {
    id: 'who',
    title: 'מי נעלם?',
    emoji: '🙈',
    color: 'linear-gradient(160deg, #cfabf4, #8c43cc)',
    category: 'thinking',
    Component: WhoGame,
  },
  {
    id: 'pattern',
    title: 'תבניות',
    emoji: '🔵',
    color: 'linear-gradient(160deg, #66c1e9, #8b8de8)',
    category: 'thinking',
    Component: PatternGame,
  },
  {
    id: 'sort',
    title: 'מיון',
    emoji: '🧺',
    color: 'linear-gradient(160deg, #5bcba2, #20a095)',
    category: 'thinking',
    Component: SortByColor,
  },
  {
    id: 'hole',
    title: 'בולעים הכול',
    emoji: '🕳️',
    color: 'linear-gradient(160deg, #8b8de8, #2c384b)',
    category: 'fun',
    Component: HoleGame,
  },
  {
    id: 'catch',
    title: 'תופסים חבר',
    emoji: '🎯',
    color: 'linear-gradient(160deg, #e8a62c, #ce7c58)',
    category: 'fun',
    Component: CatchFriend,
  },
  {
    id: 'pop',
    title: 'פיצוץ חברים',
    emoji: '🎈',
    color: 'linear-gradient(160deg, #e9c055, #df861f)',
    category: 'fun',
    Component: PopFriends,
  },
  {
    id: 'piano',
    title: 'פסנתר חברים',
    emoji: '🎹',
    color: 'linear-gradient(160deg, #55cbbc, #1d9dbb)',
    category: 'fun',
    Component: PianoFriends,
  },
  {
    id: 'pet',
    title: 'החבר שלי',
    emoji: '🐣',
    color: 'linear-gradient(160deg, #a9eac1, #2aae5b)',
    category: 'fun',
    Component: Tamagotchi,
  },
  {
    id: 'dice',
    title: 'מגלגלים קובייה',
    emoji: '🎲',
    color: 'linear-gradient(160deg, #f19aa6, #a15fdd)',
    category: 'fun',
    Component: RollDice,
  },
  {
    id: 'dance',
    title: 'ריקוד',
    emoji: '💃',
    color: 'linear-gradient(160deg, #ec99c4, #b780eb)',
    category: 'fun',
    Component: DanceGame,
  },
  {
    id: 'laugh',
    title: 'צחוק',
    emoji: '😂',
    color: 'linear-gradient(160deg, #e9c055, #e68848)',
    category: 'fun',
    Component: LaughGame,
  },
  {
    id: 'parrot',
    title: 'תוכי',
    emoji: '🦜',
    color: 'linear-gradient(160deg, #71d696, #1d9dbb)',
    category: 'fun',
    Component: ParrotGame,
  },
  {
    id: 'icecream',
    title: 'גלידה',
    emoji: '🍦',
    color: 'linear-gradient(160deg, #f6cae2, #cfabf4)',
    category: 'fun',
    Component: IceCreamGame,
  },
  {
    id: 'bubbles',
    title: 'בועות',
    emoji: '🫧',
    color: 'linear-gradient(160deg, #a2cfee, #cfabf4)',
    category: 'fun',
    Component: BubblePopGame,
  },
  {
    id: 'colorme',
    title: 'צובעים חבר',
    emoji: '🖌️',
    color: 'linear-gradient(160deg, #ec99c4, #c62e6d)',
    category: 'create',
    Component: ColorFriends,
  },
  {
    id: 'dots',
    title: 'חיבור נקודות',
    emoji: '✏️',
    color: 'linear-gradient(160deg, #66c1e9, #8b8de8)',
    category: 'create',
    Component: ConnectDots,
  },
  {
    id: 'draw',
    title: 'ציור חופשי',
    emoji: '🖍️',
    color: 'linear-gradient(160deg, #5bcba2, #38aadd)',
    category: 'create',
    Component: DrawBoard,
  },
  {
    id: 'paintnum',
    title: 'צביעה לפי מספר',
    emoji: '🧩',
    color: 'linear-gradient(160deg, #e9c055, #2aae5b)',
    category: 'create',
    Component: ColorByNumber,
  },
  {
    id: 'drawnum',
    title: 'מציירים מספר',
    emoji: '✍️',
    color: 'linear-gradient(160deg, #eba46a, #d05189)',
    category: 'create',
    Component: DrawNumber,
  },
  {
    id: 'letter',
    title: 'איזה חבר?',
    emoji: '🔤',
    color: 'linear-gradient(160deg, #b780eb, #8252ce)',
    category: 'letters',
    Component: WhichFriend,
  },
  {
    id: 'lettertalk',
    title: 'האות שלי מדברת',
    emoji: '🗣️',
    color: 'linear-gradient(160deg, #b780eb, #9365e0)',
    category: 'letters',
    Component: LetterTalk,
  },
  {
    id: 'syllables',
    title: 'תופסים הברות',
    emoji: '🥁',
    color: 'linear-gradient(160deg, #e6b877, #d98a4a)',
    category: 'letters',
    Component: Syllables,
  },
  {
    id: 'letterbus',
    title: 'אוטובוס האותיות',
    emoji: '🚌',
    color: 'linear-gradient(160deg, #7bc6c0, #4a97a0)',
    category: 'letters',
    Component: LetterBus,
  },
  {
    id: 'nametower',
    title: 'מגדל השם שלי',
    emoji: '🏗️',
    color: 'linear-gradient(160deg, #d7a86a, #b5783c)',
    category: 'letters',
    Component: NameTower,
  },
  {
    id: 'letterhunt',
    title: 'מוצאים את האות',
    emoji: '🔍',
    color: 'linear-gradient(160deg, #9db0e6, #6f77c8)',
    category: 'letters',
    Component: LetterHunt,
  },
  {
    id: 'tracehe',
    title: 'לצייר אות חיה',
    emoji: '✍️',
    color: 'linear-gradient(160deg, #caa6d8, #9a63b0)',
    category: 'letters',
    Component: TraceHe,
  },
  {
    id: 'soundwheel',
    title: 'גלגל הצלילים',
    emoji: '🎡',
    color: 'linear-gradient(160deg, #7bc6c0, #7e63c4)',
    category: 'letters',
    Component: SoundWheel,
  },
  {
    id: 'letterdrawer',
    title: 'אות במגירה',
    emoji: '🗄️',
    color: 'linear-gradient(160deg, #b58fd6, #8353b8)',
    category: 'letters',
    Component: LetterDrawer,
  },
  {
    id: 'basket',
    title: 'זריקה לסל',
    emoji: '🏀',
    color: 'linear-gradient(160deg, #eba46a, #df7036)',
    category: 'sports',
    Component: BasketGame,
  },
  {
    id: 'goal',
    title: 'בעיטה לשער',
    emoji: '⚽',
    color: 'linear-gradient(160deg, #71d696, #2aae5b)',
    category: 'sports',
    Component: GoalGame,
  },
  {
    id: 'hockey',
    title: 'הוקי אוויר',
    emoji: '🏒',
    color: 'linear-gradient(160deg, #66c1e9, #1677ac)',
    category: 'sports',
    Component: HockeyGame,
  },
  {
    id: 'bowling',
    title: 'באולינג',
    emoji: '🎳',
    color: 'linear-gradient(160deg, #ec99c4, #c62e6d)',
    category: 'sports',
    Component: BowlingGame,
  },
  {
    // internal id stays 'spell'; shown to the child as "אותיות חיות"
    id: 'spell',
    title: 'אותיות חיות',
    emoji: '🆎',
    color: 'linear-gradient(160deg, #38aadd, #655dc4)',
    category: 'english',
    Component: SpellWord,
  },
  {
    id: 'firstletter',
    title: 'באיזו אות?',
    emoji: '🔡',
    color: 'linear-gradient(160deg, #50ccde, #8b8de8)',
    category: 'english',
    Component: FirstLetter,
  },
  {
    id: 'rhyme',
    title: 'מכונת חרוזים',
    emoji: '🎡',
    color: 'linear-gradient(160deg, #e2a43d, #d05189)',
    category: 'english',
    Component: RhymeMachine,
  },
  {
    id: 'blend',
    title: 'להרכיב צליל',
    emoji: '🔊',
    color: 'linear-gradient(160deg, #5bcba2, #655dc4)',
    category: 'english',
    Component: BlendSounds,
  },
  {
    id: 'encount',
    title: 'ספירה באנגלית',
    emoji: '🔢',
    color: 'linear-gradient(160deg, #8b8de8, #1d9dbb)',
    category: 'english',
    Component: EnglishCount,
  },
  {
    id: 'trace',
    title: 'לצייר אות חיה',
    emoji: '✏️',
    color: 'linear-gradient(160deg, #ec99c4, #e2a43d)',
    category: 'english',
    Component: TraceLetter,
  },
]

export function gamesInCategory(category: CategoryId) {
  return GAMES.filter((game) => game.category === category && !game.hidden)
}
