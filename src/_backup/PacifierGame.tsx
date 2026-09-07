import RewardJourney, { type RewardJourneyConfig } from '../components/RewardJourney'
import type { GameProps } from './registry'

const CONFIG: RewardJourneyConfig = {
  title: 'ביי ביי מוצץ',
  emoji: '👋',
  storageKey: 'assaf-games:reward:pacifier',
  story: [
    { emoji: '😊', text: 'אסף גדל! אנחנו גדולים עכשיו' },
    { emoji: '👶', text: 'המוצץ הוא בשביל תינוקות קטנים' },
    { emoji: '🧸', text: 'במקום מוצץ — מחבקים דובי' },
    { emoji: '☀️', text: 'ביום משחקים בלי מוצץ' },
    { emoji: '⭐', text: 'כל יום בלי מוצץ — עוד כוכב' },
    { emoji: '🌟', text: 'ביי ביי מוצץ — כל הכבוד!' },
  ],
  doneLabel: '👋 הייתי בלי מוצץ!',
  donePraise: ['כל הכבוד אסף!', 'איזה ילד גדול!', 'יופי! עוד כוכב!', 'מצוין!'],
  goal: 7,
  celebrate: 'וואו אסף! מילאת את כל הכוכבים! אתה ילד גדול!',
}

export default function PacifierGame({ onExit }: GameProps) {
  return <RewardJourney config={CONFIG} onExit={onExit} />
}
