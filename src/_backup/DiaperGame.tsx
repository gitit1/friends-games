import RewardJourney, { type RewardJourneyConfig } from '../components/RewardJourney'
import type { GameProps } from './registry'

const CONFIG: RewardJourneyConfig = {
  title: 'ביי ביי טיטול',
  emoji: '🚽',
  storageKey: 'assaf-games:reward:diaper',
  story: [
    { emoji: '👦', text: 'אסף גדל! אנחנו ילד גדול' },
    { emoji: '🚽', text: 'כשבא פיפי — הולכים לשירותים' },
    { emoji: '👖', text: 'מורידים את המכנסיים לבד' },
    { emoji: '💧', text: 'עושים פיפי בשירותים' },
    { emoji: '🧼', text: 'שוטפים ידיים יפה' },
    { emoji: '🌟', text: 'אין יותר טיטול — כל הכבוד!' },
  ],
  doneLabel: '🚽 הלכתי לשירותים!',
  donePraise: ['כל הכבוד אסף!', 'איזה ילד גדול!', 'יופי! עוד כוכב!', 'מצוין!'],
  goal: 7,
  celebrate: 'וואו אסף! מילאת את כל הכוכבים! אתה אלוף השירותים!',
}

export default function DiaperGame({ onExit }: GameProps) {
  return <RewardJourney config={CONFIG} onExit={onExit} />
}
