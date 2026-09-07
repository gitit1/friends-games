import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import AnimalArt, { ANIMAL_KINDS, ANIMAL_NATURAL, type AnimalKind } from '../components/AnimalArt'
import type { GameProps } from './registry'
import { playPop, playSuccess, playMunch, playNudge, playTap, unlockAudio } from '../audio'
import { speakNumber } from '../voice'
import { randInt } from './util'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'

// Feed the animals: an animal asks for a NUMBER of treats (its own food), the
// child taps to drop that many into the bowl, then feeds it. A running count is
// shown the whole time (numbers practice). No timer, no fail — a wrong count just
// gets a gentle nudge so he can fix it.
//
// COMMERCIAL-QUALITY UPGRADE: the food, bowl, feeding board and meadow backdrop
// are all BAKED raster art (real texture + soft baked lighting/AO), laid out as a
// pseudo-3D diorama — meadow (far) · animal grounded on grass (mid) · wooden
// board + bowl (near) — so the scene has real depth, not flat CSS. A shared
// header difficulty control grows the counting range and thins the hint from
// קל → אלוף, always no-fail. The proven counting mechanic itself is unchanged.

const SPR = '/art/sprites/feedanimals/'
const FOOD_SPR: Record<AnimalKind, string> = {
  dog: SPR + 'food-bone.png',
  cat: SPR + 'food-fish.png',
  rabbit: SPR + 'food-carrot.png',
  parrot: SPR + 'food-seed.png',
}

// three-then-champ difficulty, mapped onto the canonical tiers (labels reuse the
// shared diff.* keys: 0 קל / 1 בינוני / 2 קשה / 3 אלוף). Cumulative: קל is small
// counts with the strongest hint; אלוף is the largest counts with the number ONLY
// (the child must produce it without pictured food). Always no-fail.
const LEVEL_TIERS = [0, 1, 2, 3]
type Hint = 'full' | 'count' | 'number'
const TIER_CFG: { min: number; max: number; hint: Hint }[] = [
  { min: 1, max: 3, hint: 'full' }, // קל — tiny counts, number + pictured food + target slots in the bowl
  { min: 1, max: 5, hint: 'count' }, // בינוני — number + pictured food (count them yourself into the bowl)
  { min: 2, max: 7, hint: 'count' }, // קשה — bigger range, still pictured-food hint
  { min: 3, max: 9, hint: 'number' }, // אלוף — number only, no pictured food
]
const BOWL_CAP = 9

// reward beat: a correct feed plays out as feed → EAT (the animal leans to the
// bowl and munches) → HEART (a small heart floats up) → next round. `ask` is the
// resting state where the child counts treats into the bowl.
type Phase = 'ask' | 'eat' | 'heart'

function AnimalFig({ kind, eating, px }: { kind: AnimalKind; eating?: boolean; px: number }) {
  const nat = ANIMAL_NATURAL[kind]
  const scale = px / Math.max(nat.w, nat.h)
  return (
    <span className="feed-fig" style={{ width: nat.w * scale, height: nat.h * scale }}>
      <span style={{ display: 'inline-block', width: nat.w, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <AnimalArt kind={kind} eating={eating} lively />
      </span>
    </span>
  )
}

export default function FeedAnimals({ onExit }: GameProps) {
  const { t } = useT()
  // difficulty comes from the shared header star control (persists per game)
  const [level] = useGameLevel('feedanimals', LEVEL_TIERS)
  const cfg = TIER_CFG[level]
  const [kind, setKind] = useState<AnimalKind>(() => ANIMAL_KINDS[randInt(0, ANIMAL_KINDS.length - 1)])
  const [want, setWant] = useState(() => randInt(cfg.min, cfg.max))
  const [bowl, setBowl] = useState(0)
  const [phase, setPhase] = useState<Phase>('ask')
  const [fed, setFed] = useState(0)
  const busy = phase !== 'ask' // the reward beat is playing — freeze input
  const timers = useRef<number[]>([])
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  function nextRound(lvl: number) {
    const c = TIER_CFG[lvl]
    setBowl(0)
    setPhase('ask')
    setKind(ANIMAL_KINDS[randInt(0, ANIMAL_KINDS.length - 1)])
    setWant(randInt(c.min, c.max))
  }

  // when the parent/child switches level from the header control, start a fresh
  // round at the new range (skip the first render — the initial round is set up
  // by the useState initialisers above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    clearTimers()
    nextRound(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function add() {
    if (busy || bowl >= BOWL_CAP) return
    unlockAudio()
    playPop()
    setBowl((b) => b + 1)
  }
  function undo() {
    if (busy || !bowl) return
    playTap()
    setBowl((b) => b - 1)
  }
  function feed() {
    if (busy || !bowl) return
    unlockAudio()
    if (bowl !== want) {
      playNudge() // gentle — count again (no fail)
      return
    }
    // correct! play the reward beat: EAT (lean + munch) → HEART → next round
    playSuccess()
    speakNumber(want) // say the count aloud (numbers practice)
    setFed((n) => n + 1)
    setPhase('eat')
    timers.current.push(window.setTimeout(() => playMunch(), 300))
    timers.current.push(window.setTimeout(() => playMunch(), 640))
    timers.current.push(window.setTimeout(() => setPhase('heart'), 1050)) // heart floats up
    timers.current.push(window.setTimeout(() => nextRound(level), 1950))
  }

  const foodSrc = FOOD_SPR[kind]
  const overfilled = bowl > want
  // target ghost slots (strongest hint, קל only): the child fills these 1-to-1
  const ghosts = cfg.hint === 'full' ? want : 0
  const cells = Math.max(bowl, ghosts)

  return (
    <GameShell title={t('game.feedanimals')} emoji="🐾" onExit={onExit} levels={{ gameId: 'feedanimals', tiers: LEVEL_TIERS }}>
      <div className="feed-screen center-body">
        <div className="feed-head">
          {/* difficulty now lives in the shared header star control (GameShell levels) */}
          <span className="feed-score" aria-hidden="true">🍽️ {fed}</span>
        </div>

        {/* the diorama: meadow (far) · animal grounded on the board beside the
            bowl (near). Fixed physical layout (animal start-side, bowl end-side)
            so the eat-lean reads the same in Hebrew and English. */}
        <div className={`feed-scene ${busy ? 'is-happy' : ''}`}>
          <div className="feed-bg" aria-hidden="true" />
          <span className="feed-cloud" aria-hidden="true" />

          <div className="feed-animal-wrap">
            <span className="feed-shadow feed-shadow-animal" aria-hidden="true" />
            <div className={`feed-animal ${phase === 'eat' ? 'eating' : ''} ${phase === 'heart' ? 'cheer' : ''}`}>
              <AnimalFig kind={kind} eating={phase === 'eat'} px={112} />
            </div>
            {/* the animal sends a heart once it has eaten */}
            {phase === 'heart' && (
              <span className="feed-heart" aria-hidden="true">
                <svg viewBox="0 0 32 29" width="36" height="33">
                  <defs>
                    <radialGradient id="feedHeartGrad" cx="38%" cy="28%" r="82%">
                      <stop offset="0%" stopColor="#f2aab0" />
                      <stop offset="52%" stopColor="#d9737b" />
                      <stop offset="100%" stopColor="#bf5a63" />
                    </radialGradient>
                  </defs>
                  <path
                    d="M16 27.5C16 27.5 2.5 19.4 2.5 10.2 2.5 5.5 6.1 2.3 10 2.3c2.9 0 4.9 1.8 6 3.9 1.1-2.1 3.1-3.9 6-3.9 3.9 0 7.5 3.2 7.5 7.9 0 9.2-13.5 17.3-13.5 17.3Z"
                    fill="url(#feedHeartGrad)"
                    stroke="rgba(150,60,66,0.35)"
                    strokeWidth="0.8"
                  />
                </svg>
              </span>
            )}
          </div>

          {/* what the animal wants — an "order" bubble pinned to the top of the
              scene so it is never clipped (RTL-neutral: centred, downward tail) */}
          <div className={`feed-bubble ${busy ? 'is-yum' : ''}`}>
            {busy ? (
              <span className="feed-yum" aria-hidden="true">😋</span>
            ) : (
              <span className="feed-want">
                <b className="feed-num">{want}</b>
                {cfg.hint !== 'number' && (
                  <span className="feed-wantfood" aria-hidden="true">
                    {Array.from({ length: want }).map((_, i) => (
                      <img key={i} className="feed-wantfood-img" src={foodSrc} alt="" />
                    ))}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* near feeding surface */}
          <img className="feed-board" src={SPR + 'board.png'} alt="" aria-hidden="true" />
          <div className="feed-bowl">
            <div className="feed-vessel">
              <img className="feed-bowl-back" src={SPR + 'bowl-back.png'} alt="" aria-hidden="true" />
              <span className="feed-treats" aria-hidden="true">
                {Array.from({ length: cells }).map((_, i) => {
                  const filled = i < bowl
                  return (
                    <span key={i} className="feed-cell">
                      {i < ghosts && !filled && <img className="feed-treat is-ghost" src={foodSrc} alt="" />}
                      {filled && <img className="feed-treat" src={foodSrc} alt="" />}
                    </span>
                  )
                })}
              </span>
              <img className="feed-bowl-front" src={SPR + 'bowl-front.png'} alt="" aria-hidden="true" />
            </div>
            <span className={`feed-count ${overfilled ? 'is-over' : ''}`} aria-hidden="true">{bowl}</span>
          </div>
        </div>

        {/* action group: the big "add one treat" tap-target sits above a tidy,
            centred confirm row (undo + feed) — physical button-v2 styling */}
        <div className="feed-controls">
          <button
            className="feed-add"
            onClick={add}
            disabled={busy || bowl >= BOWL_CAP}
            aria-label={t('feed.add')}
          >
            <img className="feed-add-food" src={foodSrc} alt="" aria-hidden="true" />
            <span className="feed-add-plus" aria-hidden="true">＋</span>
          </button>

          <div className="feed-actions">
            <button
              className="btn-utility feed-undo"
              onClick={undo}
              disabled={busy || !bowl}
              aria-label={t('ice.undo')}
            >
              <span aria-hidden="true">↩️</span>
            </button>
            <button className="btn-primary feed-go" onClick={feed} disabled={busy || !bowl}>
              {t('feed.give')} <span aria-hidden="true">🍽️</span>
            </button>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
