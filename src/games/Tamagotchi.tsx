import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import { friendCount, randFriendIndex } from '../level'
import Friend from '../components/Friend'
import Stepper from '../components/Stepper'
import { friendMaxDim, FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import AnimalArt, { ANIMAL_KINDS, ANIMAL_NAMES, ANIMAL_NATURAL, animalMaxDim, type AnimalKind } from '../components/AnimalArt'
import type { GameProps } from './registry'
import { playFriend, playMunch, playNudge, playPop, playSuccess, playTap, startPurr, stopPurr, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendName, friendSay } from '../friends'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'
import { getSettings, useSettings } from '../settings'
import { getPetReaction, getIdleReaction } from './pet/reactions/petReactionEngine'
import { pickMessage } from './pet/reactions/reactionMessages'
import { emptyHistory, recordAction } from './pet/reactions/reactionHistory'
import { getPersonality } from './pet/reactions/personality'
import type { PetAction, PetAnimationKey, PetInteractionHistory, PetReaction } from './pet/reactions/reactionTypes'
import { Choreo, isCancelled } from './pet/choreo'

// foods in the fridge — tapping one says its (Hebrew) name and the friend eats it.
// `key` drives the i18n label shown on screen; `name` is the spoken Hebrew.
const FOODS: { key: string; name: string; emoji: string }[] = [
  { key: 'banana', name: 'בננה', emoji: '🍌' },
  { key: 'apple', name: 'תפוח', emoji: '🍎' },
  { key: 'fish', name: 'דג', emoji: '🐟' },
  { key: 'hotdog', name: 'נקניקייה', emoji: '🌭' },
  { key: 'burger', name: 'המבורגר', emoji: '🍔' },
  { key: 'cucumber', name: 'מלפפון', emoji: '🥒' },
  { key: 'tomato', name: 'עגבנייה', emoji: '🍅' },
  { key: 'rice', name: 'קערת אורז', emoji: '🍚' },
  { key: 'chicken', name: 'עוף', emoji: '🍗' },
  { key: 'meat', name: 'בשר', emoji: '🥩' },
  { key: 'cheese', name: 'פרוסה עם גבינה', emoji: '🧀' },
  { key: 'carrot', name: 'גזר', emoji: '🥕' },
  { key: 'omelette', name: 'חביתה', emoji: '🍳' },
  { key: 'toast', name: 'טוסט', emoji: '🥪' },
  { key: 'bamba', name: 'במבה', emoji: '🥜' },
  { key: 'chocolate', name: 'שוקולד', emoji: '🍫' },
]

// every meal is now eaten at the dining-room table (the pet carries the food there
// and sets it down), so there's no per-food spot anymore.

// crumb fly-out directions + little reaction emojis for the eating "movie"
const CRUMBS = [
  { x: '-36px', y: '-24px' },
  { x: '32px', y: '-30px' },
  { x: '-42px', y: '12px' },
  { x: '40px', y: '8px' },
  { x: '-6px', y: '-46px' },
  { x: '16px', y: '34px' },
]
const HEARTS = ['❤️', '⭐', '😋']

// dirt stains that show on the pet as it gets dirty (more of them the lower `clean`)
const STAIN_SPOTS = [
  { x: 42, y: 62, r: 22 },
  { x: 63, y: 48, r: 16 },
  { x: 31, y: 45, r: 14 },
]

// reaction visual effects → little emoji bursts that float off the pet
const EFFECT_EMOJI: Record<string, string[]> = {
  hearts: ['❤️', '💖', '💗'],
  sparkles: ['✨', '⭐', '🌟'],
  bubbles: ['🫧', '🫧', '✨'],
  sleepy_z: ['💤', '😴', '💤'],
  crumbs: ['🍪', '✨', '🍪'],
  water_droplets: ['💧', '💦', '💧'],
  tiny_confetti: ['🎉', '🎊', '⭐'],
  sad_cloud: ['☁️', '💧'],
  dirt_smudge: ['💨', '🟤'],
  glow: ['✨', '🌟'],
}
// current emotion → a face badge on the pet (only the "notable" feelings show)
const EXPR_FACE: Record<string, string> = {
  very_happy: '😄', happy: '😊', relieved: '😌', playful: '😜', surprised: '😮',
  sad: '😢', soft_sad: '🥺', tired: '😪', sleepy: '😴', hungry: '😋', thirsty: '😛',
  annoyed: '😒', shy: '☺️',
}
// only a hungry / thirsty REQUEST still shows the floating badge — every other
// feeling is now carried on the pet's own face (mouth + brows), see EXPR_MOOD.
const BADGE_EXPR = new Set(['hungry', 'thirsty'])
// current expression → which of the 3 mouth states the character's OWN face shows
const EXPR_MOOD: Record<string, 'smile' | 'neutral' | 'frown'> = {
  very_happy: 'smile', happy: 'smile', relieved: 'smile', playful: 'smile', surprised: 'smile',
  neutral: 'neutral', hungry: 'neutral', thirsty: 'neutral', tired: 'neutral', sleepy: 'neutral', shy: 'neutral',
  sad: 'frown', soft_sad: 'frown', annoyed: 'frown',
}
// The reaction engine returns a named `animation` (19 keys) that used to be discarded.
// Map each to a one-shot CSS class on the pet-body layer (see .pet-anim.anim-* in
// app.css). Calm amplitudes throughout (≤1.06 scale, one overshoot). Unmapped keys
// (idle) simply fall through to no one-shot. `shy_turn` ALSO flips the --face layer.
const ANIM_CLASS: Partial<Record<PetAnimationKey, string>> = {
  eat: 'eat', fast_eat: 'fast-eat', slow_eat: 'slow-eat',
  drink: 'drink', drink_happy: 'drink-happy',
  excited_jump: 'excited-jump', happy_bounce: 'happy-bounce', excited_walk: 'excited-walk',
  cuddle: 'cuddle', shy_turn: 'shy-turn', small_smile: 'small-smile',
  tired_try_play: 'tired-try', bath_bubbles: 'bath-bubbles',
  curl_sleep: 'curl-sleep', nap: 'nap', refuse_sleep: 'refuse-sleep',
  gentle_refuse: 'gentle-refuse', curious: 'curious', wake_up: 'wake-up',
}
// species-appropriate idle micro-moves (one at a time, slow, never looping):
// friends have no ears/tail, so they get body-level moves; animals add ear + tail.
const MICRO_FRIEND = ['glance', 'weight', 'nod']
const MICRO_ANIMAL = ['glance', 'weight', 'ear', 'tail']
// reaction sound key → an existing audio cue (kept gentle for the child)
const SOUND_FN: Record<string, () => void> = {
  happy_chime: playSuccess,
  eat_crunch: playMunch,
  drink_sip: playMunch,
  bath_bubbles: playPop,
  sleepy_yawn: playNudge,
  sad_tiny: playNudge,
  refuse_soft: playNudge,
  success_pop: playPop,
}

// drinks in the fridge
const DRINKS: { key: string; name: string; emoji: string }[] = [
  { key: 'water', name: 'מים', emoji: '🍼' }, // a water bottle, not a drop
  { key: 'choco', name: 'שוקו', emoji: '🧋' },
  { key: 'soda', name: 'שתייה מוגזת', emoji: '🥤' },
  { key: 'juice', name: 'מיץ', emoji: '🧃' },
]
// spilled-drop directions (fall down and out)
const DROPS = [
  { x: '-16px', y: '42px' },
  { x: '12px', y: '48px' },
  { x: '-2px', y: '54px' },
  { x: '20px', y: '34px' },
]

// "play" picks one of these at random — each is its own little scene
const PLAYS: { kind: string; label: string }[] = [
  { kind: 'ball', label: 'משחק בכדור' },
  { kind: 'tv', label: 'רואה טלוויזיה' },
  { kind: 'computer', label: 'משחק במחשב' },
  { kind: 'book', label: 'קורא ספר' },
  { kind: 'lego', label: 'בונה לגו' },
]

// "My friend" — a gentle Tamagotchi-style virtual pet. Pick a number to raise,
// then feed / water / play / walk / potty + clean 💩 / dress up. Stats drop
// slowly but the friend NEVER dies — it just gets sad and you cheer it up. The
// pet (and its outfit) is saved so the child returns to the same friend.
const KEY = 'assaf-friends:pet:v1'

// baked material art for the cozy home + care props (public/art/sprites/pet, see
// its LICENSES.md — original in-project bake, gen-pet-art.mjs). One warm room
// backdrop with real perspective + four grounded props, all with baked lighting/AO.
const PET_SPR = import.meta.env.BASE_URL + 'art/sprites/pet/'

type Slot = 'hat' | 'face' | 'body' | 'held'
type Outfit = Partial<Record<Slot, string>>
type Pet = {
  friend: number
  /** when set, the pet is a real ANIMAL (not one of the 100 friends) */
  species?: AnimalKind
  hunger: number
  thirst: number
  happy: number
  clean: number
  energy: number // physical tiredness (0 = exhausted)
  loneliness: number // emotional: rises when ignored
  boredom: number // emotional: rises without play
  trust: number // grows with consistent care
  poop: boolean
  outfit: Outfit
  history: PetInteractionHistory
  ts: number
  /** when you first met this friend — drives the "days together" counter */
  born?: number
  /** the pet's given name (defaults to the friend / animal name) */
  name?: string
  /** life stage: 0 = baby, 1 = child, 2 = grown. Only ever goes UP (no pressure). */
  stage?: number
  /** progress toward the next stage (counts care actions) */
  growth?: number
  /** false while it's still an egg waiting to hatch */
  hatched?: boolean
}

// how many cares it takes to grow from baby→child, then child→grown
const GROW_STEPS = [8, 14]
const STAGE_SCALE = [0.62, 0.8, 1] // baby is small, grows to full size
function defaultName(friend: number, species?: AnimalKind) {
  return species ? ANIMAL_NAMES[species] : friendName(friend)
}

const SLOTS: { key: Slot; label: string; items: string[] }[] = [
  { key: 'hat', label: 'כובע', items: ['🎩', '👑', '🎀', '🧢', '🎓', '👒', '🤠', '🍄', '⭐', '🎉', '🌸', '🪅'] },
  { key: 'face', label: 'משקפיים', items: ['🕶️', '👓', '🥽'] },
  { key: 'body', label: 'בגד', items: ['👕', '👗', '🦺', '🧥', '👔', '🎽', '🩱', '🥋'] },
  { key: 'held', label: 'חפץ', items: ['🎈', '🍭', '🧸', '🌷', '🪁', '⚽', '🍦', '📚', '🎸'] },
]

const clamp = (v: number) => Math.max(0, Math.min(100, v))

function freshPet(friend: number, species?: AnimalKind): Pet {
  return {
    friend, species, hunger: 80, thirst: 80, happy: 85, clean: 100, energy: 80,
    loneliness: 10, boredom: 15, trust: 50, poop: false, outfit: {}, history: emptyHistory(), ts: Date.now(), born: Date.now(),
    name: defaultName(friend, species), stage: 0, growth: 0, hatched: false, // starts as an egg → hatches → baby → grows
  }
}

function load(): Pet | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    // older saves may lack the new fields → fill sensible defaults (migration)
    const p = JSON.parse(raw) as Partial<Pet> & { friend: number; ts?: number }
    const mins = Math.min(90, (Date.now() - (p.ts ?? Date.now())) / 60000)
    // gentle care = the friend is always fine: no "you were away" decay at all
    const d = getSettings().petCareMode === 'gentle' ? 0 : Math.round(mins)
    return {
      friend: p.friend,
      species: p.species,
      hunger: clamp((p.hunger ?? 80) - d),
      thirst: clamp((p.thirst ?? 80) - d),
      happy: clamp((p.happy ?? 85) - Math.round(d * 0.6)),
      clean: clamp((p.clean ?? 100) - Math.round(d * 0.6)),
      energy: clamp((p.energy ?? 80) - Math.round(d * 0.5)),
      loneliness: clamp((p.loneliness ?? 10) + d), // missed you while away
      boredom: clamp((p.boredom ?? 15) + Math.round(d * 0.7)),
      trust: clamp(p.trust ?? 50),
      poop: p.poop ?? false,
      outfit: p.outfit ?? {},
      history: p.history ?? emptyHistory(),
      ts: Date.now(),
      born: p.born ?? p.ts ?? Date.now(),
      // existing saved pets are already hatched + grown (migration)
      name: p.name ?? defaultName(p.friend, p.species),
      stage: p.stage ?? 2,
      growth: p.growth ?? 0,
      hatched: p.hatched ?? true,
    }
  } catch {
    return null
  }
}

// the animal pets reuse the friends' holder/scale wrappers + walk/eat rigs
function AnimalFigure({ kind, scale, walking, eating, stage, lively, mood }: { kind: AnimalKind; scale: number; walking?: boolean; eating?: boolean; stage?: number; lively?: boolean; mood?: 'smile' | 'neutral' | 'frown' }) {
  const nat = ANIMAL_NATURAL[kind]
  return (
    <span className="friend-holder" style={{ width: nat.w * scale, height: nat.h * scale }}>
      <span className="friend-scale" style={{ width: nat.w, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <AnimalArt kind={kind} walking={walking} eating={eating} stage={stage} lively={lively} mood={mood} />
      </span>
    </span>
  )
}

function AnimalDressed({ kind, px, walking, eating, stage, lively, mood }: { kind: AnimalKind; px: number; walking?: boolean; eating?: boolean; stage?: number; lively?: boolean; mood?: 'smile' | 'neutral' | 'frown' }) {
  return (
    <span className={`pet-figure ${eating ? 'is-eating' : ''}`} style={{ fontSize: `${px}px` }}>
      <AnimalFigure kind={kind} scale={px / animalMaxDim(kind)} walking={walking} eating={eating} stage={stage} lively={lively} mood={mood} />
    </span>
  )
}

function FriendDressed({
  index,
  px,
  outfit,
  bouncing,
  eating,
  walking,
  action,
  baby,
  lively,
  mood,
}: {
  index: number
  px: number
  outfit: Outfit
  bouncing?: boolean
  eating?: boolean
  walking?: boolean
  action?: 'five' | 'hug' | 'kiss' | null
  baby?: boolean
  lively?: boolean
  mood?: 'smile' | 'neutral' | 'frown'
}) {
  return (
    <span className={`pet-figure ${eating ? 'is-eating' : ''}`} style={{ fontSize: `${px}px` }}>
      <Friend
        index={index}
        scale={px / friendMaxDim(index)}
        showNumber={false}
        bouncing={bouncing}
        eating={eating}
        outfit={outfit}
        walking={walking}
        action={action}
        baby={baby}
        lively={lively}
        mood={mood}
      />
    </span>
  )
}

// the little "play" scenes — each activity is its own set
// the pet figure inside a play scene — an animal if the pet is one, else the friend
function PetSceneFig({ friend, species, outfit, px }: { friend: number; species?: AnimalKind; outfit: Outfit; px: number }) {
  return species ? <AnimalDressed kind={species} px={px} /> : <FriendDressed index={friend} px={px} outfit={outfit} />
}

function PlayScene({ kind, friend, species, outfit, buddy }: { kind: string; friend: number; species?: AnimalKind; outfit: Outfit; buddy: number }) {
  if (kind === 'ball') {
    return (
      <div className="scene scene-ball">
        <span className="scene-fig">
          <PetSceneFig friend={friend} species={species} outfit={outfit} px={88} />
        </span>
        <span className="play-ball" aria-hidden="true">
          ⚽
        </span>
        <span className="scene-fig">
          <FriendDressed index={buddy} px={88} outfit={{}} />
        </span>
      </div>
    )
  }
  if (kind === 'tv') {
    return (
      <div className="scene scene-room">
        <span className="seat-side">
          <span className="couch" aria-hidden="true" />
          <span className="scene-fig seated">
            <PetSceneFig friend={friend} species={species} outfit={outfit} px={92} />
          </span>
        </span>
        <span className="tv-set" aria-hidden="true">
          <span className="tv-screen">
            <span className="tv-star">⭐</span>
          </span>
          <span className="tv-stand" />
        </span>
      </div>
    )
  }
  if (kind === 'computer') {
    return (
      <div className="scene scene-room">
        <span className="seat-side">
          <span className="chair" aria-hidden="true" />
          <span className="scene-fig seated">
            <PetSceneFig friend={friend} species={species} outfit={outfit} px={86} />
          </span>
        </span>
        <span className="deskset" aria-hidden="true">
          <span className="monitor">
            <span className="tv-star">✨</span>
          </span>
          <span className="desktop" />
        </span>
      </div>
    )
  }
  if (kind === 'book') {
    return (
      <div className="scene">
        <span className="seat-side wide">
          <span className="couch" aria-hidden="true" />
          <span className="scene-fig seated mid">
            <PetSceneFig friend={friend} species={species} outfit={outfit} px={92} />
          </span>
          <span className="book" aria-hidden="true">
            📖
          </span>
        </span>
      </div>
    )
  }
  // lego — a tower builds up on a rug
  return (
    <div className="scene scene-lego">
      <span className="scene-fig">
        <PetSceneFig friend={friend} species={species} outfit={outfit} px={100} />
      </span>
      <span className="tower" aria-hidden="true">
        <span className="brick b1" />
        <span className="brick b2" />
        <span className="brick b3" />
        <span className="brick b4" />
        <span className="rug" />
      </span>
    </div>
  )
}

export default function Tamagotchi({ onExit }: GameProps) {
  const { t } = useT()
  const [pet, setPet] = useState<Pet | null>(load)
  const vp = useViewport()
  // size the pet to FIT the room by BOTH width and height, so tall friends (1–10
  // like piko/moki) aren't cut off and every friend sits at a proportional size
  const roomH = Math.max(vp.h * 0.38, 240)
  const fitPet = (i: number) => {
    const nat = FRIEND_NATURAL[friendKindForIndex(i)]
    // fit BOTH the room width and a safe slice of its height, so the pet is fully
    // visible and centred (never spilling past the canvas) on any screen
    return Math.min((Math.min(vp.w, 440) * 0.46) / nat.w, (roomH * 0.38) / nat.h, 1.8)
  }
  // same fit, for an animal pet (its own natural box)
  const fitAnimal = (kind: AnimalKind) => {
    const nat = ANIMAL_NATURAL[kind]
    return Math.min((Math.min(vp.w, 440) * 0.46) / nat.w, (roomH * 0.38) / nat.h, 1.8)
  }
  const [choosing, setChoosing] = useState(() => pet === null)
  const [pick, setPick] = useState(0)
  const [pickMode, setPickMode] = useState<'friend' | 'animal'>('friend')
  const [pickAnimal, setPickAnimal] = useState(0) // index into ANIMAL_KINDS
  const [warmth, setWarmth] = useState(0) // taps to hatch the egg
  const [naming, setNaming] = useState(false) // the naming step right after hatching
  const [nameInput, setNameInput] = useState('')
  const [wardrobe, setWardrobe] = useState(false)
  const [fridge, setFridge] = useState(false)
  const [kitchen, setKitchen] = useState(false) // walked to the kitchen, fridge in view
  const [fridgeOpen, setFridgeOpen] = useState(false) // fridge doors swung open
  const [eatSetting, setEatSetting] = useState<'table' | 'cushion' | 'standing' | null>(null)
  // NOTE: 'facewash' (soap sink-scrub) is intentionally DORMANT — the art + soap-rise CSS
  // are kept for a future hand-washing / sink scene, but nothing sets it today.
  const [bathroom, setBathroom] = useState<null | 'shower' | 'facewash' | 'toilet'>(null)
  const [bar, setBar] = useState(false)
  const [eatFood, setEatFood] = useState<string | null>(null)
  const [mode, setMode] = useState<'eat' | 'drink'>('eat')
  const [bite, setBite] = useState(0)
  const [poof, setPoof] = useState(false)
  const [playing, setPlaying] = useState<{ kind: string; label: string } | null>(null)
  const [buddy, setBuddy] = useState(0)
  const [scene, setScene] = useState<'home' | 'walk'>('home')
  const [walking, setWalking] = useState(false) // legs march during any locomotion (to the fridge, back to the table, outside)
  const [petX, setPetX] = useState(0) // how far across the room the pet has strolled (px on .pet-stage)
  const [walkMs, setWalkMs] = useState(700) // how long that stroll takes
  const [face, setFace] = useState(1) // which way the pet faces: 1 = right (out to a room), -1 = left (returning home)
  const [held, setHeld] = useState<string | null>(null) // food carried in the hand on the walk back from the fridge
  const [sleeping, setSleeping] = useState(false) // in the bedroom (bed + dim lights)
  const [lyingDown, setLyingDown] = useState(false) // actually lying on the bed
  const [walkPhase, setWalkPhase] = useState(0) // which outdoor scene during a walk (0=park, 1=pond, 2=meadow)
  const [atDoor, setAtDoor] = useState(false) // walking out through the front door
  const [steppingOut, setSteppingOut] = useState(false) // fading through the doorway (exit only, not re-entry)
  const [awayFromHouse, setAwayFromHouse] = useState(false) // on a walk, away from home → the house recedes off-screen
  const [dining, setDining] = useState(false) // crossed from the kitchen to the dining room to eat
  const [placing, setPlacing] = useState(false) // setting the food down on the dining table
  const [fx, setFx] = useState<{ emoji: string; id: number } | null>(null)
  const [burst, setBurst] = useState<{ id: number; bits: { e: string; x: number; y: number; d: number }[] } | null>(null)
  const [bounce, setBounce] = useState(false)
  const [gesture, setGesture] = useState<'five' | 'hug' | 'kiss' | null>(null) // a one-shot hug/high-five the friend actually performs
  const liveSettings = useSettings() // so a care-mode change updates the look live
  // ── reaction-engine driven UI state ──
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null)
  const [posture, setPosture] = useState('neutral')
  const [expression, setExpression] = useState('happy')
  const [highlight, setHighlight] = useState<PetAction | null>(null)
  // idle micro-life (the reaction one-shot below is driven imperatively, no re-render)
  const [micro, setMicro] = useState<{ type: string; id: number } | null>(null)
  const [petting, setPetting] = useState(false) // being stroked right now (soft eyes + disables idle)
  const [dip, setDip] = useState(false) // brief anticipation crouch before an action
  const bubbleTimer = useRef<number | undefined>(undefined)
  const hiTimer = useRef<number | undefined>(undefined)
  const lastBubbleAt = useRef(0)
  const lastReactAt = useRef(0) // when the last reaction anim fired → micro-life waits for it to settle
  const dressTouched = useRef(false) // the outfit was changed while the wardrobe was open → react on close
  // one cancellable timeline for every "movie" (walk→eat, go to bed…). resetScenes()
  // aborts it so a new action never collides with the tail of the previous one.
  const choreoRef = useRef(new Choreo())
  const roomRef = useRef<HTMLDivElement>(null) // to write --pet-lean / --pet-eye imperatively while petting
  const stageRef = useRef<HTMLSpanElement>(null) // .pet-stage → await its real walk transition
  const animRef = useRef<HTMLSpanElement>(null) // .pet-anim → the one-shot reaction-animation layer
  const animCls = useRef<string | null>(null) // the anim class currently on it
  useEffect(() => {
    const choreo = choreoRef.current
    const strokeState = stroke.current
    return () => {
      choreo.abort()
      stopPurr()
      window.clearTimeout(pettingOff.current)
      if (strokeState.raf) cancelAnimationFrame(strokeState.raf)
    }
  }, [])
  // fire the engine's named animation as a one-shot on the pet-body layer. Done
  // imperatively (class remove → reflow → add) so the SAME anim replays and the
  // pet's SVG never remounts (no walk/blink hitch), while it rides on the breath.
  function playAnim(key?: PetAnimationKey) {
    const cls = key ? ANIM_CLASS[key] : undefined
    const el = animRef.current
    if (!cls || !el) return
    lastReactAt.current = Date.now()
    if (animCls.current) el.classList.remove(`anim-${animCls.current}`)
    void el.offsetWidth // force reflow so re-adding the class restarts the animation
    el.classList.add(`anim-${cls}`)
    animCls.current = cls
  }

  // show a short speech bubble near the pet (and say it aloud); auto-hides
  function showBubble(text: string, speakIt = true) {
    if (!text) return
    window.clearTimeout(bubbleTimer.current)
    setBubble({ text, id: Date.now() })
    lastBubbleAt.current = Date.now()
    if (speakIt) speak(text)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 3600)
  }
  // briefly glow a suggested next action button
  function suggest(action: PetAction | null) {
    window.clearTimeout(hiTimer.current)
    setHighlight(action)
    if (action) hiTimer.current = window.setTimeout(() => setHighlight(null), 5000)
  }

  // build the engine context from the CURRENT pet — used both to APPLY a reaction
  // (react) and to PEEK at the outcome before playing a movie (the feed/water pre-check)
  function reactionFor(action: PetAction, food?: string): PetReaction | null {
    if (!pet) return null
    return getPetReaction({
      action,
      stats: { hunger: pet.hunger, thirst: pet.thirst, happy: pet.happy, clean: pet.clean, energy: pet.energy },
      mood: { happiness: pet.happy, loneliness: pet.loneliness, boredom: pet.boredom, excitement: 50, trust: pet.trust },
      personality: getPersonality(pet.friend),
      history: pet.history,
      now: Date.now(),
      poop: pet.poop,
      food,
    })
  }

  // THE central dispatcher: ask the engine for a context-aware reaction, apply
  // its stat/mood/poop changes, record history, and drive bubble/posture/glow.
  function react(action: PetAction, food?: string, opts?: { silent?: boolean }): PetReaction | null {
    if (!pet) return null
    const now = Date.now()
    let reaction = reactionFor(action, food)
    if (!reaction) return null
    // gentle care mode: needs never decay, so hunger/thirst pin at full and every feed/
    // water would come back a refusal ("I'm already full") forever. In gentle mode the
    // child's feeding routine must always work → upgrade that fullness-refusal to a warm,
    // ordinary meal/drink instead of a rejection.
    if (getSettings().petCareMode === 'gentle' && reaction.outcome === 'refusal' && (action === 'feed' || action === 'water')) {
      reaction = {
        ...reaction, outcome: 'success', expression: 'happy', posture: 'neutral',
        speechKey: action === 'feed' ? 'feed.normal' : 'drink.normal',
        sound: action === 'feed' ? 'eat_crunch' : 'drink_sip',
        statChanges: { happy: 4 }, highlightAction: undefined,
      }
    }
    // a refusal ("I'm full", "already clean") is NOT care — it shouldn't grow the pet
    // or bump the "times cared for" counter (see recordAction).
    const cares = reaction.outcome !== 'refusal'
    setPet((p) => {
      if (!p) return p
      const n = { ...p }
      const s = reaction.statChanges ?? {}
      if (s.hunger) n.hunger = clamp(p.hunger + s.hunger)
      if (s.thirst) n.thirst = clamp(p.thirst + s.thirst)
      if (s.happy) n.happy = clamp(p.happy + s.happy)
      if (s.clean) n.clean = clamp(p.clean + s.clean)
      if (s.energy) n.energy = clamp(p.energy + s.energy)
      const m = reaction.moodChange ?? {} // happiness lives in `happy`; skip it here
      if (m.loneliness) n.loneliness = clamp(p.loneliness + m.loneliness)
      if (m.boredom) n.boredom = clamp(p.boredom + m.boredom)
      if (m.trust) n.trust = clamp(p.trust + m.trust)
      if (reaction.setPoop !== undefined) n.poop = reaction.setPoop
      n.history = recordAction(p.history, action, reaction.outcome, now)
      // growing up: each REAL care nudges the friend toward its next life stage (never
      // down, and refusals don't count).
      const st = p.stage ?? 2
      if (cares && st < 2) {
        const g = (p.growth ?? 0) + 1
        if (g >= GROW_STEPS[st]) {
          n.stage = st + 1
          n.growth = 0
        } else {
          n.growth = g
        }
      }
      return n
    })
    // celebrate a growth spurt (predicted from the current value — growth +1 per care)
    const curStage = pet.stage ?? 2
    if (cares && curStage < 2 && (pet.growth ?? 0) + 1 >= GROW_STEPS[curStage]) {
      window.setTimeout(() => {
        playSuccess()
        showFx('🎉')
        showBubble(t('pet.grew'))
      }, 750)
    }
    setPosture(reaction.posture ?? 'neutral')
    setExpression(reaction.expression ?? 'happy')
    // consume the engine's named animation → a calm one-shot on the pet body
    playAnim(reaction.animation)
    // shy_turn genuinely turns away, using the existing facing (--face) layer, then back
    if (reaction.animation === 'shy_turn') {
      setFace(-1)
      window.setTimeout(() => setFace(1), 750)
    }
    showBurst(reaction.visualEffects)
    if (!opts?.silent && reaction.sound) SOUND_FN[reaction.sound]?.()
    showBubble(pickMessage(reaction.speechKey, getSettings().lang as 'he' | 'en'))
    suggest(reaction.highlightAction ?? reaction.followUpSuggestion ?? null)
    return reaction
  }

  // save whenever the pet changes
  useEffect(() => {
    if (pet) localStorage.setItem(KEY, JSON.stringify({ ...pet, ts: Date.now() }))
  }, [pet])

  // gentle decay (never below 0; the friend never dies — it just needs you).
  // In the "gentle" care mode the needs never decay at all — the friend is always
  // fine (calm + autism-friendly); only "regular" mode lets them drop over time.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (getSettings().petCareMode === 'gentle') return
      setPet((p) =>
        p
          ? {
              ...p,
              hunger: clamp(p.hunger - 2),
              thirst: clamp(p.thirst - 2),
              happy: clamp(p.happy - 1),
              clean: clamp(p.clean - 2), // gets dirty over time → a stain shows
              energy: clamp(p.energy - 1),
              loneliness: clamp(p.loneliness + 2),
              boredom: clamp(p.boredom + 2),
            }
          : p,
      )
    }, 15000)
    return () => window.clearInterval(id)
  }, [])

  // ── idle behaviour: "alive even when you do nothing" ──
  // refs so the single idle interval always sees the latest state without
  // resetting itself on every change.
  const petRef = useRef(pet)
  petRef.current = pet
  const busyRef = useRef(false)
  busyRef.current = !!(playing || eatFood || fridge || bar || wardrobe || choosing || kitchen || eatSetting || bathroom || sleeping || dining || placing || petting || scene === 'walk')
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = petRef.current
      if (!p || busyRef.current) return
      const canSpeak = Date.now() - lastBubbleAt.current > 28000
      const idle = getIdleReaction({
        stats: { hunger: p.hunger, thirst: p.thirst, happy: p.happy, clean: p.clean, energy: p.energy },
        mood: { happiness: p.happy, loneliness: p.loneliness, boredom: p.boredom, excitement: 50, trust: p.trust },
        poop: p.poop,
        canSpeak,
      })
      setPosture(idle.posture)
      setExpression(idle.expression)
      if (idle.visualEffects) showBurst(idle.visualEffects)
      if (idle.highlightAction) suggest(idle.highlightAction)
      if (idle.speechKey) showBubble(pickMessage(idle.speechKey, getSettings().lang as 'he' | 'en'))
    }, 6500)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── idle micro-life: "alive even when standing still" ──
  // every 8–14s the pet does exactly ONE small, slow thing: a glance, a weight
  // shift, an ear/crest twitch, or a tail sway. Never two at once, never while a
  // scene/reaction is playing, and disabled entirely under reduced motion.
  useEffect(() => {
    let stopped = false
    let timer = 0
    const tick = () => {
      if (stopped) return
      const p = petRef.current
      const rm = getSettings().reduceMotion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      const now = Date.now()
      const quiet = !busyRef.current && now - lastReactAt.current > 1600 && now - lastBubbleAt.current > 1400
      if (p && !rm && quiet) {
        const pool = p.species ? MICRO_ANIMAL : MICRO_FRIEND
        const type = pool[Math.floor(Math.random() * pool.length)]
        setMicro((m) => ({ type, id: (m?.id ?? 0) + 1 }))
        window.setTimeout(() => setMicro((m) => (m && m.type === type ? null : m)), 2600)
      }
      schedule()
    }
    const schedule = () => {
      timer = window.setTimeout(tick, 8000 + Math.random() * 6000) // 8–14s
    }
    schedule()
    return () => { stopped = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showFx(emoji: string) {
    setFx((prev) => ({ emoji, id: (prev?.id ?? 0) + 1 })) // updater form → no stale id from closure
    window.setTimeout(() => setFx((f) => (f && f.emoji === emoji ? null : f)), 900)
  }

  // little emoji burst floating off the pet, driven by a reaction's visualEffects
  function showBurst(keys?: string[]) {
    if (!keys || !keys.length) return
    const bits: { e: string; x: number; y: number; d: number }[] = []
    let i = 0
    for (const k of keys) {
      const set = EFFECT_EMOJI[k]
      if (!set) continue
      for (let j = 0; j < 3; j++) {
        bits.push({ e: set[j % set.length], x: 18 + ((i * 23 + j * 13) % 64), y: 22 + ((i * 17 + j * 29) % 48), d: ((i + j) % 4) * 90 })
        i++
      }
    }
    if (!bits.length) return
    setBurst((b) => ({ id: (b?.id ?? 0) + 1, bits }))
    window.setTimeout(() => setBurst((b) => (b ? null : b)), 1150)
  }

  function choose(friend: number) {
    unlockAudio()
    playSuccess()
    setPet(freshPet(friend))
    setChoosing(false)
    speak(`${friendSay(friend)}! החבר שלי`)
  }

  function chooseAnimal(kind: AnimalKind) {
    unlockAudio()
    playSuccess()
    setPet(freshPet(0, kind))
    setChoosing(false)
    speak(`${ANIMAL_NAMES[kind]}! החיה שלי`)
  }

  const HATCH_TAPS = 6
  // warm/pet the egg — every tap warms it a bit; on the last one it hatches
  function warmEgg() {
    unlockAudio()
    playTap()
    setWarmth((w) => {
      const n = w + 1
      if (n >= HATCH_TAPS) {
        playSuccess()
        speak('🐣')
        window.setTimeout(() => setNaming(true), 1000) // shows the baby, then we name it
      } else {
        playNudge()
      }
      return n
    })
  }
  // confirm the chosen name → the egg is officially hatched, the game begins
  function confirmName() {
    if (!pet) return
    const nm = nameInput.trim() || defaultName(pet.friend, pet.species)
    unlockAudio()
    playSuccess()
    setPet((p) => (p ? { ...p, hatched: true, name: nm, stage: 0, growth: 0 } : p))
    setNaming(false)
    setWarmth(0)
    setNameInput('')
    speak(nm)
  }

  function pokePet() {
    if (!pet) return
    if (stroke.current.stroked) { stroke.current.stroked = false; return } // a stroke, not a tap → no name-bounce
    if (busyRef.current) return // mid-action: a tap shouldn't interrupt the scene
    unlockAudio()
    if (pet.species) {
      playTap()
    } else {
      playFriend(pet.friend)
    }
    speak(pet.name || defaultName(pet.friend, pet.species)) // says its given name
    setBounce(true)
    window.setTimeout(() => setBounce(false), 550)
  }

  // ── touch-petting: stroke the pet slowly and it leans into your hand, its eyes
  // soften half-closed, a heart rises now and then, and a soft purr plays. 100%
  // child-driven motion — nothing happens unless the finger is moving gently. Fast,
  // frantic strokes are simply ineffective (no penalty). Everything stops within
  // ~300ms of the finger lifting. Two CSS vars (--pet-lean, --pet-eye) are written
  // imperatively from a rAF loop so stroking never triggers a React re-render.
  const stroke = useRef({
    active: false, raf: 0, lastX: 0, lastY: 0, lastT: 0,
    lean: 0, targetLean: 0, eye: 0, targetEye: 0, acc: 0, lastHeart: 0, stroked: false, calm: false,
  })
  const pettingOff = useRef<number | undefined>(undefined)
  function strokeLoop() {
    const s = stroke.current
    const el = roomRef.current
    s.lean += (s.targetLean - s.lean) * 0.22
    s.eye += (s.targetEye - s.eye) * 0.16
    if (el) {
      el.style.setProperty('--pet-lean', `${s.lean.toFixed(2)}deg`)
      el.style.setProperty('--pet-eye', s.eye.toFixed(3))
    }
    if (s.active || Math.abs(s.lean) > 0.04 || s.eye > 0.01) {
      s.raf = requestAnimationFrame(strokeLoop)
    } else {
      s.raf = 0
      if (el) { el.style.setProperty('--pet-lean', '0deg'); el.style.setProperty('--pet-eye', '0') }
    }
  }
  function onPetDown(e: React.PointerEvent) {
    if (!pet || busyRef.current) return
    unlockAudio()
    window.clearTimeout(pettingOff.current)
    const s = stroke.current
    s.active = true
    s.lastX = e.clientX; s.lastY = e.clientY; s.lastT = e.timeStamp || performance.now()
    s.acc = 0; s.stroked = false
    // calm-motion: keep the lean/soft-eyes gentler (reduced amplitude, not frozen)
    s.calm = getSettings().reduceMotion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // NOTE: petting mode turns on only once the finger actually STROKES (in onPetMove),
    // so a plain tap (down→up, no move) still pokes the pet by name as before.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* older browsers */ }
  }
  function onPetMove(e: React.PointerEvent) {
    const s = stroke.current
    if (!s.active) return
    const now = e.timeStamp || performance.now()
    const dt = Math.max(1, now - s.lastT)
    const dx = e.clientX - s.lastX
    const dy = e.clientY - s.lastY
    s.lastX = e.clientX; s.lastY = e.clientY; s.lastT = now
    const dist = Math.hypot(dx, dy)
    if (dist < 0.4) return
    if (dist / dt > 1.4) return // frantic swipe → ineffective (no lean, no purr, no penalty)
    s.acc = Math.min(80, s.acc + dist)
    const amp = s.calm ? 0.55 : 1 // reduced-motion → gentler lean + softer eye close
    s.targetLean = Math.max(-3, Math.min(3, dx * 0.4)) * amp // lean ≤3° toward the stroke
    s.targetEye = Math.min(1, s.acc / 55) * amp // eyelids soften as the stroking settles in
    if (!s.stroked) setPetting(true) // first real stroke → enter petting mode (soft eyes, no idle)
    s.stroked = true
    startPurr()
    if (s.acc > 14 && now - s.lastHeart > 2000) { s.lastHeart = now; showFx('❤️') } // ≤1 heart / ~2s
    if (!s.raf) s.raf = requestAnimationFrame(strokeLoop)
  }
  function endStroke() {
    const s = stroke.current
    if (!s.active) return
    s.active = false
    s.targetLean = 0
    s.targetEye = 0
    s.acc = 0
    stopPurr()
    if (!s.raf) s.raf = requestAnimationFrame(strokeLoop)
    // keep eyes soft (blink paused) through the ~300ms settle, then let life resume
    window.clearTimeout(pettingOff.current)
    pettingOff.current = window.setTimeout(() => setPetting(false), 340)
  }

  // before starting ANY action, wipe whatever scene was on, so two scenes can never
  // overlap (e.g. the shower's water lingering on while it walks to the fridge).
  // Aborting the choreo cancels every pending step of the previous movie cleanly
  // (its awaits reject and the scene function bails) — no mid-air snaps.
  function resetScenes() {
    choreoRef.current.abort()
    setDip(false)
    setKitchen(false)
    setFridgeOpen(false)
    setFridge(false)
    setEatSetting(null)
    setBathroom(null)
    setBar(false)
    setEatFood(null)
    setHeld(null)
    setPoof(false)
    setBite(0)
    setPlaying(null)
    setScene('home')
    setWalking(false)
    setPetX(0)
    setFace(1) // face forward/right again by default
    setSleeping(false)
    setLyingDown(false)
    setWalkPhase(0)
    setAtDoor(false)
    setSteppingOut(false)
    setAwayFromHouse(false)
    setDining(false)
    setPlacing(false)
    setGesture(null)
  }

  // drinks live in the fridge too — so the friend strolls to the kitchen, opens it,
  // and the drinks shelf appears (same journey as food)
  async function openBar() {
    if (!pet || kitchen) return
    unlockAudio()
    playTap()
    resetScenes()
    const c = choreoRef.current
    setKitchen(true)
    setWalking(true)
    setWalkMs(2700)
    try {
      await c.step(2700); setWalking(false) // arrived in the kitchen
      await c.step(200) // soft stop
      setFridgeOpen(true); playPop() // the fridge appears + opens
      await c.step(650); setBar(true) // the drinks shelf appears
    } catch (e) { if (!isCancelled(e)) throw e }
  }

  // walk / clean / sleep / hug all go through the reaction engine. Each is now a
  // readable async timeline (walk → soft stop → tiny anticipation → action → settle),
  // cancelled cleanly if the child taps another action mid-movie.
  async function act(type: 'walk' | 'clean' | 'sleep' | 'hug') {
    if (!pet) return
    unlockAudio()
    playTap()
    resetScenes()
    const c = choreoRef.current
    // cleaning → the bathroom: the pet walks UNDER the showerhead (already there),
    // and only THEN does the water turn on — and it keeps pouring for a clear few
    // seconds, never a quick flicker that's gone before the pet arrives.
    if (type === 'clean') {
      setBathroom('shower') // always a real shower — the running water is the satisfying part
      setWalking(true) // pads over to the bathroom (legs march while it slides in)
      try {
        await c.step(2400); setWalking(false) // arrived under the showerhead
        await c.step(200) // soft stop
        setDip(true); await c.step(140); setDip(false) // a little crouch before the scrub
        react('clean'); playSuccess() // water on + reaction
        await c.step(2500) // a clear few seconds of water
        setBathroom(null); setWalking(true); setFace(-1) // water off → WALKS back (faces left)
        await c.step(2300); setWalking(false); setFace(1) // home, faces forward
      } catch (e) { if (!isCancelled(e)) throw e }
      return
    }
    // sleep → the bedroom: the bed slides in, the friend walks over, LIES DOWN on it,
    // the lights go dim with floating Zzz, then it wakes up and gets back up
    if (type === 'sleep') {
      setSleeping(true) // the bedroom slides in + lights dim
      setWalking(true) // crosses the house to the bedroom (legs march)
      try {
        await c.step(2000); setWalking(false) // arrived → the bed appears
        await c.step(400); setLyingDown(true) // climbs in + lies down
        await c.step(200); react('sleep') // curl_sleep / nap reaction
        await c.step(3800); setLyingDown(false) // wakes up, sits up
        await c.step(600); setSleeping(false); setWalking(true); setFace(-1) // out of bed → back
        await c.step(2300); setWalking(false); setFace(1) // home, faces forward
      } catch (e) { if (!isCancelled(e)) throw e }
      return
    }
    if (type === 'walk') {
      const r = react('walk')
      if (r && (r.outcome === 'request' || r.outcome === 'refusal')) return // didn't feel like it
      const phase = Math.floor(Math.random() * 3) // ONE random outing: park / pond / meadow
      const dx = Math.round(Math.min(vp.w, 440) * 0.38)
      // 1) walk to the front door (it stays PUT); the panel swings open and you see
      //    the OUTDOORS through it, then the pet steps through
      setAtDoor(true)
      setSteppingOut(true) // fades through the doorway on the way OUT only
      setWalking(true)
      setWalkMs(1700)
      setPetX(dx) // strolls right, up to the door
      try {
        // wait for the real stroll-to-the-door transition to finish (falls back to a timer)
        await c.transitionEnd(stageRef.current, 1900)
        // 2) cut to OUTSIDE: it's standing right in front of its own house
        setAtDoor(false); setSteppingOut(false); setPetX(0); setScene('walk'); setWalkPhase(phase); showFx('🌳')
        await c.step(900); setAwayFromHouse(true) // 3) walks away → the house recedes
        await c.step(2100); setAwayFromHouse(false) // 4) turns back → the house returns
        await c.step(1800); setScene('home'); setAwayFromHouse(false); setAtDoor(true); setFace(-1) // 5) reaches home, steps in
        await c.step(1500); setAtDoor(false); setWalking(false); setWalkPhase(0); setFace(1) // inside, stops, faces forward
      } catch (e) { if (!isCancelled(e)) throw e }
      return
    }
    // hug: the friend actually performs the hug (arms wrap + lean) — not just an emoji
    setGesture('hug')
    react('hug') // the engine plays the right sound + reaction (cuddle / shy_turn)
    showFx('🤗')
    try { await c.step(1500); setGesture(null) } catch (e) { if (!isCancelled(e)) throw e }
  }

  // שירותים → the bathroom: the friend goes and sits on the toilet for a moment. Routed
  // through the reaction engine so the potty rule fires — relief + clears any mess when
  // it needed to go (potty.go), or a gentle "לא צריך עכשיו" when it didn't (potty.no).
  async function potty() {
    if (!pet) return
    unlockAudio()
    playTap()
    resetScenes()
    const c = choreoRef.current
    setBathroom('toilet') // the bathroom slides in
    setWalking(true) // walk over to the bathroom
    try {
      await c.step(2200); setWalking(false) // arrives, sits
      await c.step(120); react('potty') // soft settle → engine reaction
      await c.step(1500); setBathroom(null); setWalking(true); setFace(-1) // WALKS back (faces left)
      await c.step(2300); setWalking(false); setFace(1) // arrived back home, faces forward
    } catch (e) { if (!isCancelled(e)) throw e }
  }

  function setItem(slot: Slot, item: string) {
    unlockAudio()
    playTap()
    dressTouched.current = true
    setPet((p) => (p ? { ...p, outfit: { ...p.outfit, [slot]: p.outfit[slot] === item ? undefined : item } } : p))
  }

  // close the wardrobe — if the child changed the outfit, the friend reacts to its new
  // look (routes through the engine so the personality-flavoured dress line fires).
  function closeWardrobe() {
    setWardrobe(false)
    if (dressTouched.current) {
      dressTouched.current = false
      react('dress')
    }
  }

  // tapping "feed" → the friend WALKS to the kitchen, the fridge swings open, then
  // the food pop-up appears (a real little sequence, not an instant menu)
  async function goFeed() {
    if (!pet || kitchen) return
    unlockAudio()
    playTap()
    resetScenes()
    const c = choreoRef.current
    setKitchen(true) // the kitchen scrolls in (the pet marches in place, the world moves)
    setWalking(true)
    setWalkMs(2700)
    try {
      await c.step(2700); setWalking(false) // arrived in the kitchen
      await c.step(200) // soft stop
      setFridgeOpen(true); playPop() // the fridge appears + opens
      await c.step(650); setFridge(true) // the food shelves appear
    } catch (e) { if (!isCancelled(e)) throw e }
  }

  // pick a food from the fridge → the friend walks to the right spot for that dish
  // (table / standing / cushion), says its name, then hops 3× eating it ("נם נם נם")
  async function eat(food: { key: string; name: string; emoji: string }) {
    unlockAudio()
    playTap()
    // pre-check (regular mode): a genuinely FULL pet shouldn't be marched to the table
    // and only THEN told it's full — show the gentle "שבע" bubble up front, skip the movie.
    // (In gentle mode react() upgrades that refusal to a happy meal, so we never bail here.)
    const pre = reactionFor('feed', food.key)
    if (pre && pre.outcome === 'refusal' && getSettings().petCareMode !== 'gentle') {
      react('feed', food.key) // shows the gentle "אני כבר שבע" bubble — no eating movie
      setFridge(false)
      setFridgeOpen(false)
      return
    }
    // begin the dining "movie" on a fresh timeline (cancels the goFeed tail cleanly)
    choreoRef.current.abort()
    const c = choreoRef.current
    setFace(1) // walking rightward on to the dining room
    setFridge(false)
    setFridgeOpen(false)
    setKitchen(false) // leave the kitchen…
    setDining(true) // …and cross to the DINING ROOM (the world scrolls on to it)
    setEatSetting('table')
    setMode('eat')
    setPlaying(null)
    speak(getSettings().lang === 'en' ? t(`pet.food.${food.key}`) : food.name)
    setBite(0)
    setPoof(false)
    setHeld(food.emoji) // takes the food OUT of the fridge — carries it in its hand
    setWalking(true) // marches on to the dining room, food in hand
    setWalkMs(2500)
    try {
      await c.step(2500); setWalking(false) // arrived at the dining room
      await c.step(120) // soft stop
      setDip(true); await c.step(150) // bends down (anticipation) …
      setPlacing(true)
      await c.step(320); setDip(false); setHeld(null); setPlacing(false); setEatFood(food.emoji) // … sets it on the table
      await c.step(500) // settle before the first bite
      speak('נם נם נם')
      for (let k = 0; k < 3; k++) { await c.step(800); playMunch(); setBite(k + 1) } // unhurried bites
      await c.step(600); setPoof(true); playPop()
      await c.step(600)
      setEatFood(null); setPoof(false); setBite(0); setEatSetting(null)
      setDining(false) // done — leaves the dining room
      setWalking(true); setFace(-1) // …and WALKS back to the living room (faces left)
      react('feed', food.key, { silent: true })
      // in REGULAR mode a meal sometimes leaves a mess later → enables the potty/clean
      // routine (never in gentle mode, which stays simple + always-clean)
      if (getSettings().petCareMode !== 'gentle' && Math.random() < 0.3) {
        setPet((p) => (p ? { ...p, poop: true } : p))
      }
      await c.step(2300); setWalking(false); setFace(1) // arrived back home, faces forward
    } catch (e) { if (!isCancelled(e)) throw e }
  }

  // pick a drink → say its name, then the friend gulps it (drops spill), then a
  // happy line ("אין על מים!" only for water)
  async function drink(d: { key: string; name: string; emoji: string }) {
    unlockAudio()
    playTap()
    // pre-check (regular mode): don't march a not-thirsty pet to the table to then
    // refuse — show the gentle bubble up front. (Gentle mode always enjoys its drink.)
    const pre = reactionFor('water', d.key)
    if (pre && pre.outcome === 'refusal' && getSettings().petCareMode !== 'gentle') {
      react('water', d.key) // gentle "אני לא צמא עכשיו" bubble — no drinking movie
      setBar(false)
      setFridgeOpen(false)
      return
    }
    choreoRef.current.abort()
    const c = choreoRef.current
    setFace(1) // walking rightward on to the dining room
    setBar(false)
    setFridgeOpen(false)
    setKitchen(false)
    setDining(true) // drink in the dining room too — same place as eating, so it's consistent
    setMode('drink')
    setPlaying(null)
    speak(getSettings().lang === 'en' ? t(`pet.drink.${d.key}`) : d.name)
    setBite(0)
    setPoof(false)
    setHeld(d.emoji) // takes the bottle/cup/carton and carries it back
    setWalking(true)
    setWalkMs(2500)
    setPetX(0)
    try {
      await c.step(2500); setWalking(false) // arrived
      await c.step(120) // soft stop
      setDip(true); await c.step(150); setDip(false) // raises the vessel (anticipation)
      setHeld(null); setEatFood(d.emoji) // …to the mouth and drinks
      for (let k = 0; k < 3; k++) { await c.step(800); playMunch(); setBite(k + 1) } // gulps
      await c.step(600); setPoof(true); playPop()
      await c.step(500)
      setEatFood(null); setPoof(false); setBite(0)
      setDining(false) // leaves the dining room…
      setWalking(true); setFace(-1) // …and WALKS back to the living room (faces left)
      react('water', d.key, { silent: true })
      await c.step(2300); setWalking(false); setFace(1) // arrived back home, faces forward
    } catch (e) { if (!isCancelled(e)) throw e }
  }

  // play = a random one of 5 little activities (ball / computer / book / TV / lego)
  async function play() {
    if (!pet) return
    unlockAudio()
    playTap()
    resetScenes()
    const c = choreoRef.current
    // an animal plays fetch with a friend (its natural game); friends do any activity
    const a = pet.species ? PLAYS.find((p) => p.kind === 'ball')! : PLAYS[Math.floor(Math.random() * PLAYS.length)]
    if (a.kind === 'ball') {
      let b = randFriendIndex()
      if (b === pet.friend) b = (b + 1) % friendCount()
      setBuddy(b)
    }
    setPlaying(a)
    playSuccess()
    speak(`${a.label}!`)
    try {
      await c.step(4000)
      setPlaying(null)
      react('play') // context-aware reaction (excited / tired / "thirsty now"…)
    } catch (e) { if (!isCancelled(e)) throw e }
  }

  // ---- pick-a-pet screen: a friend, or a real animal ----
  if (choosing || !pet) {
    const aKind = ANIMAL_KINDS[pickAnimal]
    return (
      <GameShell title={t('game.pet')} emoji="🐣" onExit={onExit}>
        <p className="pet-pick-title">{t('pet.pickTitle')}</p>
        <div className="pet-pick-tabs">
          <button className={`pet-pick-tab ${pickMode === 'friend' ? 'is-on' : ''}`} onClick={() => setPickMode('friend')}>
            🙂 {t('pet.pickFriend')}
          </button>
          <button className={`pet-pick-tab ${pickMode === 'animal' ? 'is-on' : ''}`} onClick={() => setPickMode('animal')}>
            🐶 {t('pet.pickAnimal')}
          </button>
        </div>
        {pickMode === 'friend' ? (
          <>
            <Stepper
              label={
                <span className="pet-pick-figure">
                  <Friend index={pick} scale={fitPet(pick)} showNumber={false} />
                </span>
              }
              onPrev={() => setPick((p) => (p + friendCount() - 1) % friendCount())}
              onNext={() => setPick((p) => (p + 1) % friendCount())}
            />
            <p className="pet-pick-name">
              {friendName(pick)} · {pick + 1}
            </p>
            <div className="counting-next">
              <button className="big-button" onClick={() => choose(pick)}>
                🎉 {t('pet.pickBtn')}
              </button>
            </div>
          </>
        ) : (
          <>
            <Stepper
              label={
                <span className="pet-pick-figure">
                  <AnimalFigure kind={aKind} scale={fitAnimal(aKind)} />
                </span>
              }
              onPrev={() => setPickAnimal((p) => (p + ANIMAL_KINDS.length - 1) % ANIMAL_KINDS.length)}
              onNext={() => setPickAnimal((p) => (p + 1) % ANIMAL_KINDS.length)}
            />
            <p className="pet-pick-name">{ANIMAL_NAMES[aKind]}</p>
            <div className="counting-next">
              <button className="big-button" onClick={() => chooseAnimal(aKind)}>
                🎉 {t('pet.pickBtn')}
              </button>
            </div>
          </>
        )}
      </GameShell>
    )
  }

  // freshly chosen → it arrives as an EGG you warm until it hatches, then you name it
  if (pet && !pet.hatched) {
    const isAnimal = !!pet.species
    if (naming) {
      const babyScale = (isAnimal ? fitAnimal(pet.species as AnimalKind) : fitPet(pet.friend)) * STAGE_SCALE[0]
      return (
        <GameShell title={t('game.pet')} emoji="🐣" onExit={onExit}>
          <p className="pet-pick-title">{t('pet.name.title')}</p>
          <div className="pet-pick-figure hatch-baby">
            {isAnimal ? (
              <AnimalFigure kind={pet.species as AnimalKind} scale={babyScale} stage={0} />
            ) : (
              <Friend index={pet.friend} scale={babyScale} showNumber={false} baby />
            )}
          </div>
          <input
            className="pet-name-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={defaultName(pet.friend, pet.species)}
            maxLength={12}
            aria-label={t('pet.name.title')}
          />
          <div className="counting-next">
            <button className="big-button" onClick={confirmName}>
              🎉 {t('pet.name.btn')}
            </button>
          </div>
        </GameShell>
      )
    }
    return (
      <GameShell title={t('game.pet')} emoji="🥚" onExit={onExit}>
        <p className="pet-pick-title">{t('pet.egg.warm')}</p>
        <div className="egg-stage">
          <span className="egg-nest" aria-hidden="true" />
          <button
            key={warmth}
            className={`egg crack-${Math.min(warmth, HATCH_TAPS)} ${warmth >= HATCH_TAPS ? 'is-hatching' : ''}`}
            onClick={warmEgg}
            aria-label={t('pet.egg.warm')}
          >
            <span className="egg-shell" />
            <span className="egg-crack" aria-hidden="true" />
            <span className="egg-heart" aria-hidden="true">💗</span>
          </button>
        </div>
        <p className="egg-hint">{t('pet.egg.hint')}</p>
        <div className="egg-bar" aria-hidden="true">
          <span style={{ width: `${(Math.min(warmth, HATCH_TAPS) / HATCH_TAPS) * 100}%` }} />
        </div>
      </GameShell>
    )
  }

  const meters = [
    { key: 'hunger', emoji: '🍎', label: 'רעב', value: pet.hunger },
    { key: 'thirst', emoji: '💧', label: 'צמא', value: pet.thirst },
    { key: 'happy', emoji: '😊', label: 'שמח', value: pet.happy },
    { key: 'energy', emoji: '⚡', label: 'אנרגיה', value: pet.energy },
    { key: 'clean', emoji: '🧼', label: 'נקי', value: pet.clean },
  ]
  // in gentle care mode the friend never looks sad (no grey/sad-face neglect state)
  const sad = liveSettings.petCareMode === 'regular' && meters.some((m) => m.value < 25)
  // the emotion the character wears on its OWN face (mouth + brows). Neglect always
  // frowns; otherwise the current expression maps to smile / neutral / soft-frown.
  const faceMood: 'smile' | 'neutral' | 'frown' = sad ? 'frown' : (EXPR_MOOD[expression] ?? 'smile')
  // friendly counters that only ever go UP (numbers are play, never a score)
  const daysTogether = Math.floor((Date.now() - (pet.born ?? pet.ts)) / 86400000) + 1
  const careCount = pet.history?.totalCareCount ?? 0
  // the pet is either an animal or one of the 100 friends — its size + name + render differ
  const isAnimal = !!pet.species
  const stage = pet.stage ?? 2 // 0 baby · 1 child · 2 grown — scales the size up as it grows
  const petPx = Math.round(
    (isAnimal
      ? fitAnimal(pet.species as AnimalKind) * animalMaxDim(pet.species as AnimalKind)
      : fitPet(pet.friend) * friendMaxDim(pet.friend)) * STAGE_SCALE[stage],
  )
  const petLabel = isAnimal ? ANIMAL_NAMES[pet.species as AnimalKind] : friendName(pet.friend)
  // dirtier → more stains on the body (replaces the old poop)
  const stainCount = pet.clean < 22 ? 3 : pet.clean < 40 ? 2 : pet.clean < 58 ? 1 : 0
  // time of day → the room's window sky + wall mood (a modern-pet-game touch)
  const hour = new Date().getHours()
  const timeOfDay = hour >= 20 || hour < 6 ? 'night' : hour >= 17 ? 'sunset' : 'day'

  type ActType = 'feed' | 'water' | 'play' | 'walk' | 'sleep' | 'hug' | 'potty' | 'clean' | 'dress'
  const actions: { type: ActType; emoji: string }[] = [
    { type: 'feed', emoji: '🍎' },
    { type: 'water', emoji: '🍼' },
    { type: 'play', emoji: '🎾' },
    { type: 'walk', emoji: '🚶' },
    { type: 'sleep', emoji: '😴' },
    { type: 'hug', emoji: '🤗' },
    { type: 'potty', emoji: '🚽' },
    { type: 'clean', emoji: '🧽' },
    // animals aren't dressed up — only the friends get the wardrobe
    ...(isAnimal ? [] : [{ type: 'dress' as ActType, emoji: '👕' }]),
  ]

  const STAGE_EMOJI = ['🐣', '🌟', '👑']
  return (
    <GameShell title={t('game.pet')} emoji="🐣" onExit={onExit}>
      {/* the pet's NAME + life stage */}
      <p className="pet-name-line">
        {pet.name || defaultName(pet.friend, pet.species)}
        <span className="pet-stage-badge">
          {STAGE_EMOJI[stage]} {t(`pet.stage.${stage}`)}
        </span>
      </p>
      <div className="pet-meters">
        {meters.map((m) => (
          <span className="pet-meter" key={m.key}>
            <span className="pet-meter-emoji" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pet-bar">
              <span
                className="pet-bar-fill"
                style={{ width: `${m.value}%`, background: m.value < 30 ? '#f87171' : m.value < 60 ? '#fbbf24' : '#4ade80' }}
              />
            </span>
            <span className="pet-meter-num">{m.value}</span>
          </span>
        ))}
      </div>

      {/* friendly counters — numbers that only go UP (days together, times cared for) */}
      <div className="pet-counters">
        <span className="pet-count">
          <span className="pet-count-num">{daysTogether}</span> {t('pet.count.days')}
        </span>
        <span className="pet-count">
          <span className="pet-count-num">{careCount}</span> {t('pet.count.care')}
        </span>
        {stage < 2 && (
          <span className="pet-count">
            <span className="pet-count-num">{(pet.growth ?? 0)}</span>/{GROW_STEPS[stage]} {t('pet.count.grow')}
          </span>
        )}
      </div>

      <div
        ref={roomRef}
        className={`pet-room tod-${timeOfDay} pose-${posture} expr-${expression} ${scene === 'walk' ? `is-walk walk-${walkPhase}` : ''} ${atDoor ? 'at-door' : ''} ${steppingOut ? 'stepping-out' : ''} ${awayFromHouse ? 'away-house' : ''} ${
          kitchen ? 'kmode' : ''
        } ${kitchen ? 'is-kitchen' : ''} ${dining ? 'dining' : ''} ${placing ? 'is-placing' : ''} ${eatSetting || eatFood ? 'emode' : ''} ${walking ? 'is-striding' : ''} ${fridgeOpen ? 'fridge-open' : ''} ${eatSetting ? `eat-${eatSetting}` : ''} ${
          bathroom ? `bmode bath-${bathroom}` : ''
        } ${sleeping ? 'is-sleep' : ''} ${lyingDown ? 'pose-sleep' : ''} ${playing ? 'is-playing' : ''} ${sad ? 'is-sad' : ''} ${petting ? 'is-petting' : ''} ${dip ? 'is-dip' : ''} ${micro ? `micro-${micro.type}` : ''}`}
      >
        {/* illustrated 2D room behind the pet */}
        <div className="pet-scene" aria-hidden="true">
          {/* the floor is CONTINUOUS — it stays put while the rooms scroll past, so
              walking to the kitchen/bathroom/bed reads as crossing the house */}
          <span className="ps-floor" />
          <span className="ps-shadow" />
          {/* the living room — slides OUT to the left when the pet heads to another room */}
          <span className="ps-living">
            {/* the cozy room itself is now BAKED material art (warm wall, a real
                wood-framed window + sill, a wall shelf with a plant, and a
                wood-plank floor whose seams converge — a real camera angle, giving
                the corner depth). Replaces the old flat CSS wall/window/shelf. */}
            <img className="ps-room-art" src={PET_SPR + 'room.jpg'} alt="" aria-hidden="true" />
            {/* baked CARE PROPS, grounded on the floor around the pet: a woven rug
                (its spot), a plush pet bed, a ceramic food bowl and a soft toy ball */}
            <img className="ps-rug-art" src={PET_SPR + 'rug.png'} alt="" aria-hidden="true" />
            <img className="ps-bed-art" src={PET_SPR + 'bed.png'} alt="" aria-hidden="true" />
            <img className="ps-bowl-art" src={PET_SPR + 'bowl.png'} alt="" aria-hidden="true" />
            <img className="ps-ball-art" src={PET_SPR + 'ball.png'} alt="" aria-hidden="true" />
            {/* the front door — the pet walks to it; the panel swings open and you
                see the OUTDOORS through the doorway, then it steps out */}
            <span className="ps-door">
              <span className="door-out" />
              <span className="door-panel">
                <span className="door-knob" />
              </span>
            </span>
          </span>
          {/* kitchen ↔ dining room — a horizontal strip the world scrolls along:
              the pet crosses to the kitchen (gets food), then on to the dining room
              (a permanent table) to sit and eat. */}
          <span className="ps-kddining">
            <span className="ps-kitchen">
              <span className="kupper" />
              <span className="ktiles" />
              <span className="kcounter" />
              <span className="kcab" />
              <span className="kstove">
                <span className="pot" />
              </span>
              <span className="ksink">
                <span className="faucet" />
              </span>
              {/* the fridge is a FIXTURE of the kitchen — it scrolls in WITH the
                  room (already there on arrival); only its door is an effect */}
              <span className="ps-fridge">
                <span className="fbody" />
                <span className="fglow" />
                <span className="fdoor" />
              </span>
            </span>
            {/* the dining room — its own wall + window; the pet sits at the
                foreground table (.ps-table) to eat, set down on arrival */}
            <span className="ps-dining">
              <span className="d-window" />
              <span className="d-pic">🖼️</span>
              <span className="d-rug" />
            </span>
          </span>
          {/* the bathroom scenery — replaces the room while cleaning / on the toilet */}
          <span className="ps-bathroom">
            <span className="bmirror" />
            <span className="bsink" />
            <span className="bshower">
              <span className="head" />
            </span>
            {/* the toilet is a FIXTURE of the bathroom — it scrolls in WITH the
                room (shown only for the potty action, not the shower) */}
            <span className="ps-toilet">
              <span className="tank" />
              <span className="seat" />
              <span className="base" />
            </span>
          </span>
          {/* cushion the pet can sit on (the fridge now lives inside the kitchen) */}
          <span className="ps-cushion" />
          {/* the bedroom it crosses to at bedtime — the bed is a FIXTURE inside it,
              so it scrolls in WITH the room (already there on arrival) */}
          <span className="ps-bedroom">
            <span className="ps-bed">
              <span className="bed-frame" />
              <span className="bed-mattress" />
              <span className="bed-pillow" />
              <span className="bed-blanket" />
            </span>
          </span>
          {/* the outdoors — layered PARALLAX (far hills slow · trees mid · near
              bushes fast) so the walk feels like real travel, plus scenes that
              go by: park → pond → meadow */}
          <span className="ps-outdoor">
            <span className="osun" />
            <span className="ocloud a" />
            <span className="ocloud b" />
            {/* the pet's own HOUSE — so when it steps out, you see the home it
                came from (and walks back into it) */}
            <span className="ohouse">
              <span className="oh-roof" />
              <span className="oh-wall" />
              <span className="oh-win" />
              <span className="oh-door" />
            </span>
            <span className="ohills" />
            <span className="otrees" />
            <span className="obushes" />
            <span className="opond" />
            <span className="oflowers" />
            <span className="obird">🐦</span>
            <span className="obutterfly">🦋</span>
          </span>
        </div>
        {/* the pet stands on a FIXED room floor line (a % of the room HEIGHT, so it
            never drifts up on wider screens) */}
        <div className="pet-floor">
        {playing ? (
          <PlayScene kind={playing.kind} friend={pet.friend} species={pet.species} outfit={pet.outfit} buddy={buddy} />
        ) : (
        <button
          className="pet-tap"
          onClick={pokePet}
          aria-label={petLabel}
          onPointerDown={onPetDown}
          onPointerMove={onPetMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onLostPointerCapture={endStroke}
        >
          {/* transform-layer stack: each wrapper owns ONE transform (traversal X /
              facing mirror / posture) so they compose instead of overwriting */}
          <span ref={stageRef} className="pet-stage" style={{ ['--walk-x']: `${petX}px`, ['--walk-ms']: `${walkMs}ms`, ['--face']: face } as React.CSSProperties}>
            <span className="pet-facing">
              <span className="pet-body">
                {/* one-shot reaction-animation layer (from the engine's `reaction.animation`);
                    the class is toggled imperatively (see playAnim). Rides on the breath. */}
                <span ref={animRef} className="pet-anim">
                {isAnimal ? (
                  <AnimalDressed kind={pet.species as AnimalKind} px={petPx} walking={walking || scene === 'walk'} eating={!!eatFood} stage={stage} lively mood={faceMood} />
                ) : (
                  // takes its clothes/accessories OFF for a bath or for bed
                  <FriendDressed index={pet.friend} px={petPx} outfit={bathroom || sleeping ? {} : pet.outfit} bouncing={bounce} eating={!!eatFood} walking={walking || scene === 'walk'} action={gesture} baby={stage === 0} lively mood={faceMood} />
                )}
                </span>
                {held && (
                  <span
                    className="pet-hold"
                    aria-hidden="true"
                    style={{ fontSize: `${Math.round(petPx * 0.42)}px` }}
                  >
                    {held}
                  </span>
                )}
                {/* dirt + soap live ON the body, inside the moving figure, so they
                    travel with the pet (and don't get left behind on the screen) */}
                {stainCount > 0 && !bathroom && !eatFood &&
                  STAIN_SPOTS.slice(0, stainCount).map((s, i) => (
                    <span
                      className="pet-stain"
                      key={i}
                      style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.r}%` }}
                      aria-hidden="true"
                    />
                  ))}
                {/* dormant: no code path sets bathroom='facewash' today (kept for a future sink scene) */}
                {bathroom === 'facewash' && (
                  <span className="pet-soap" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
            </span>
          </span>
          {/* food at the mouth for snacks (standing) / rice (cushion) / drinks; a
              sit-down meal at the TABLE is shown on the table instead (below) */}
          {eatFood && !(mode === 'eat' && eatSetting === 'table') && (
          <>
            <span
              key={poof ? 'poof' : `s-${bite}`}
              className={
                poof
                  ? `pet-eat-food is-poof ${mode === 'eat' ? 'b3' : ''}`
                  : mode === 'eat'
                    ? `pet-eat-food chomp ${bite > 0 ? `b${bite}` : ''}`
                    : 'pet-eat-food gulp'
              }
              aria-hidden="true"
            >
              {eatFood}
            </span>
            {!poof && bite > 0 && (
              <span className="eat-burst" key={`burst-${bite}`} aria-hidden="true">
                {(mode === 'eat' ? CRUMBS : DROPS).map((c, i) => (
                  <span
                    className={mode === 'eat' ? 'crumb' : 'drop'}
                    key={i}
                    style={{ '--tx': c.x, '--ty': c.y } as React.CSSProperties}
                  >
                    {mode === 'eat' ? eatFood : '💧'}
                  </span>
                ))}
              </span>
            )}
            {!poof && bite > 0 && (
              <span className="eat-heart" key={`heart-${bite}`} aria-hidden="true">
                {HEARTS[(bite - 1) % HEARTS.length]}
              </span>
            )}
            {poof && (
              <span className="pet-poof" aria-hidden="true">
                💨
              </span>
            )}
          </>
          )}
        </button>
        )}
        </div>
        {/* furniture IN FRONT of the pet: the meal table, and the bowl + chopsticks */}
        <span className="ps-table" aria-hidden="true">
          <span className="ttop" />
          <span className="tleg a" />
          <span className="tleg b" />
          <span className="tplate" />
          {/* the sit-down meal sits ON the plate and is eaten away bite by bite */}
          {mode === 'eat' && eatSetting === 'table' && eatFood && !poof && (
            <span className="ps-meal" style={{ transform: `translate(-50%, -100%) scale(${[1, 0.72, 0.42, 0.12][Math.min(bite, 3)]})` }}>
              {eatFood}
            </span>
          )}
          {mode === 'eat' && eatSetting === 'table' && eatFood && !poof && bite > 0 && (
            <span className="ps-meal-heart" key={`th-${bite}`}>{HEARTS[(bite - 1) % HEARTS.length]}</span>
          )}
          {mode === 'eat' && eatSetting === 'table' && poof && <span className="ps-meal-poof">💨</span>}
        </span>
        <span className="ps-dish" aria-hidden="true">
          <img className="ps-dish-bowl" src={PET_SPR + 'bowl.png'} alt="" />
        </span>
        {/* shower water — in FRONT of the pet so it pours over it */}
        <span className="ps-rain" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        {/* the quilt is in FRONT of the pet, tucking its lower body into bed */}
        <span className="ps-quilt" aria-hidden="true" />
        {/* floating Zzz over the sleeping pet */}
        <span className="ps-zzz" aria-hidden="true">
          <i>z</i>
          <i>z</i>
          <i>z</i>
        </span>
        {/* the floating badge now ONLY signals a hungry / thirsty REQUEST (or the
            neglect sad-face); every other feeling lives on the pet's own face */}
        {!playing && !eatFood && (BADGE_EXPR.has(expression) || sad) && (
          <span className="pet-mood" key={sad ? 'sad' : expression} aria-hidden="true">
            {sad ? '😢' : EXPR_FACE[expression]}
          </span>
        )}
        {fx && (
          <span className="pet-fx" key={`fx-${fx.id}`} aria-hidden="true">
            {fx.emoji}
          </span>
        )}
        {burst && !playing && (
          <span className="pet-burst" key={`burst-${burst.id}`} aria-hidden="true">
            {burst.bits.map((b, i) => (
              <span
                className="pet-burst-bit"
                key={i}
                style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.d}ms` }}
              >
                {b.e}
              </span>
            ))}
          </span>
        )}
        {bubble && !playing && (
          <span className="pet-bubble" key={bubble.id} dir="auto">
            {bubble.text}
          </span>
        )}
      </div>

      <div className="pet-actions">
        {actions.map((a) => (
          <button
            key={a.type}
            className={`pet-action ${highlight === a.type ? 'is-suggested' : ''}`}
            onClick={() =>
              a.type === 'dress'
                ? (unlockAudio(), playTap(), (dressTouched.current = false), setWardrobe(true))
                : a.type === 'feed'
                  ? goFeed()
                  : a.type === 'water'
                    ? openBar()
                    : a.type === 'play'
                      ? play()
                      : a.type === 'potty'
                        ? potty()
                        : act(a.type as 'walk' | 'clean' | 'sleep' | 'hug')
            }
          >
            <span className="pet-action-emoji" aria-hidden="true">
              {a.emoji}
            </span>
            <span className="pet-action-label">{t(`pet.act.${a.type}`)}</span>
          </button>
        ))}
        <button className="pet-action pet-action-new" onClick={() => setChoosing(true)}>
          <span className="pet-action-emoji" aria-hidden="true">
            🔄
          </span>
          <span className="pet-action-label">{t('pet.newFriend')}</span>
        </button>
      </div>

      {wardrobe && (
        <div className="ward-overlay" onClick={closeWardrobe}>
          <div className="ward-card" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close" onClick={closeWardrobe} aria-label={t('seq.close')}>
              ✕
            </button>
            <h3 className="ward-title">👗 {t('pet.wardrobe')}</h3>
            <div className="ward-rail" aria-hidden="true" />
            <div className="ward-preview">
              <FriendDressed index={pet.friend} px={130} outfit={pet.outfit} />
            </div>
            <div className="ward-slots">
              {SLOTS.map((s) => (
                <div className="ward-slot" key={s.key}>
                  <span className="ward-slot-label">{t(`pet.slot.${s.key}`)}</span>
                  <div className="ward-items">
                    <button
                      className={`ward-item ${!pet.outfit[s.key] ? 'is-on' : ''}`}
                      onClick={() => { dressTouched.current = true; setPet((p) => (p ? { ...p, outfit: { ...p.outfit, [s.key]: undefined } } : p)) }}
                      aria-label={t('pet.none')}
                    >
                      ✖
                    </button>
                    {s.items.map((item) => (
                      <button
                        key={item}
                        className={`ward-item ${pet.outfit[s.key] === item ? 'is-on' : ''}`}
                        onClick={() => setItem(s.key, item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {fridge && (
        <div className="fridge-overlay" onClick={() => setFridge(false)}>
          <div className="fridge-card" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close" onClick={() => setFridge(false)} aria-label={t('seq.close')}>
              ✕
            </button>
            <h3 className="fridge-title">{t('pet.fridgeTitle')}</h3>
            <div className="fridge-grid">
              {FOODS.map((f) => (
                <button key={f.key} className="fridge-item" onClick={() => eat(f)} aria-label={t(`pet.food.${f.key}`)}>
                  <span className="fridge-emoji" aria-hidden="true">
                    {f.emoji}
                  </span>
                  <span className="fridge-name">{t(`pet.food.${f.key}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {bar && (
        <div className="fridge-overlay" onClick={() => setBar(false)}>
          <div className="fridge-card" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close" onClick={() => setBar(false)} aria-label={t('seq.close')}>
              ✕
            </button>
            <h3 className="fridge-title">{t('pet.barTitle')}</h3>
            <div className="fridge-grid">
              {DRINKS.map((d) => (
                <button key={d.key} className="fridge-item" onClick={() => drink(d)} aria-label={t(`pet.drink.${d.key}`)}>
                  <span className="fridge-emoji" aria-hidden="true">
                    {d.emoji}
                  </span>
                  <span className="fridge-name">{t(`pet.drink.${d.key}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </GameShell>
  )
}
