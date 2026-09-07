import { useEffect, useRef, useState, type CSSProperties } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import {
  playNudge,
  playSuccess,
  playTap,
  unlockAudio,
  playCouple,
  playWhistle,
  playChuff,
  playStationBell,
} from '../audio'
import { stopSpeech } from '../speech'
import { speakNumber, playClip } from '../voice'
import { randInt, shuffle, prefersReducedMotion } from './util'
import { numberMax, randFriendIndex } from '../level'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'

// Number train — a JOURNEY to stations.
//   BUILD: tap the number cars in the round's sequence order → each couples with a
//     rolling clank-wave and its number is spoken.
//   DRIVE: the finished train drives (wheels spin, rods pump, calm steam, parallax
//     scenery slides past) toward a station — a real rAF drive that docks the
//     station house beside the train.
//   ARRIVE: a friend boards (waves, steps in) with a soft whistle + bell.
//   2–4 stations (grows with tier) = trip complete → calm celebration + sticker.
// No timer, no fail. A wrong number just nudges gently.
//
// MATERIALS (commercial-quality pass): the locomotive, wagons, wheels, rails,
// sleepers, ballast and station house are all BAKED sprite art (real material
// texture + baked key light + ambient occlusion) — see public/art/sprites/train.
// Only crisp TEXT (car digits, the station sign) and layout/animation stay CSS.
// DIFFICULTY is driven by the shared HEADER star control (useGameLevel), not an
// in-body chip row.

const SPR = import.meta.env.BASE_URL + 'art/sprites/train/'

// four canonical tiers, each its own header star option (קל · בינוני · קשה · אלוף)
const LEVEL_TIERS = [0, 1, 2, 3]
// stations per tier — the trip grows longer as it gets harder
const STATIONS_FOR_TIER = [2, 3, 4, 4]
// the highest car number each tier may reach (also clamped to the parent's level)
const CAP_FOR_TIER = [5, 10, 12, 12]

type Scene = {
  key: string
  bg: string
  skyTop: string
  skyBot: string
  hill: string
  hillBack: string
  ground: string
  items: string[]
}
// muted, calm backdrops (illustrated far landscape + a matching sky/hill tint)
const SCENES: Scene[] = [
  { key: 'meadow', bg: 'meadow.jpg', skyTop: '#c7e6ef', skyBot: '#eaf5ec', hill: '#9cc59a', hillBack: '#bcd9b6', ground: '#c19a6b', items: ['🌳', '🌼', '🌾', '🐄', '🌳'] },
  { key: 'forest', bg: 'forest.jpg', skyTop: '#bfe0ea', skyBot: '#dcefdc', hill: '#7fae84', hillBack: '#a6c9a2', ground: '#b98f66', items: ['🌲', '🌲', '🍄', '🦌', '🌲'] },
  { key: 'seaside', bg: 'meadow.jpg', skyTop: '#bfe3ef', skyBot: '#e6f4f2', hill: '#9fc6c0', hillBack: '#c4dfd8', ground: '#d8c194', items: ['🌴', '⛵', '🐚', '🌴'] },
  { key: 'town', bg: 'town.jpg', skyTop: '#c9dff0', skyBot: '#e8eef4', hill: '#a7b6c4', hillBack: '#c5ced8', ground: '#b0a892', items: ['🏠', '🏢', '🌳', '🏠'] },
]

function makeSceneSeq(n: number): Scene[] {
  const s = shuffle(SCENES)
  return Array.from({ length: n }, (_, i) => s[i % s.length])
}

// Build the ordered car sequence for a round, per tier (cumulative). Always
// returns a valid run of ≥3 numbers within the tier cap.
function makeConsist(level: number): number[] {
  const cap = Math.max(4, Math.min(CAP_FOR_TIER[level], numberMax()))
  const asc = (start: number, len: number) => Array.from({ length: len }, (_, i) => start + i)
  const fallback = () => asc(1, Math.min(cap, randInt(4, 5)))

  if (level === 0) return asc(1, Math.min(cap, randInt(4, 5)))
  if (level === 1) return asc(1, Math.min(cap, randInt(4, 6)))

  if (level === 2) {
    // continue-from-N, or skip-count by 2 (2,4,6,…)
    if (Math.random() < 0.5) {
      const len = randInt(4, 5)
      const start = randInt(2, Math.max(2, cap - len + 1))
      return asc(start, len)
    }
    const maxLen = Math.floor((cap - 2) / 2) + 1
    const len = Math.min(randInt(4, 5), maxLen)
    return len >= 3 ? Array.from({ length: len }, (_, i) => 2 + i * 2) : fallback()
  }

  // level 3 (אלוף) — mixed, including descending
  const roll = Math.random()
  if (roll < 0.34) {
    // descending run
    const len = randInt(4, 5)
    const top = randInt(len + 1, cap)
    return Array.from({ length: len }, (_, i) => top - i)
  }
  if (roll < 0.67) {
    // skip-count by 2 or 3
    const step = Math.random() < 0.5 ? 2 : 3
    const maxLen = Math.floor((cap - step) / step) + 1
    const len = Math.min(randInt(4, 5), maxLen)
    return len >= 3 ? Array.from({ length: len }, (_, i) => step + i * step) : fallback()
  }
  // continue-from-N ascending
  const len = randInt(4, 5)
  const start = randInt(2, Math.max(2, cap - len + 1))
  return asc(start, len)
}

const START_PCT = 6
function dotLeft(i: number, total: number): number {
  if (total <= 1) return 54
  return 16 + i * (78 / (total - 1))
}

// The world moves past a FIXED train. Every world layer (scenery, hills, ground
// ties, and the station house) is driven by one shared rAF that decelerates to a
// stop, so the station belongs to the world: it approaches with the scenery and
// they all halt together at the platform mark beside the train. px of travel per
// layer over one leg — foreground (station/near-ground) fastest, hills slowest.
const WORLD = {
  station: 240, // foreground: slides in from the forward edge to the platform mark
  scenery: 190, // mid-ground parallax
  hills: 66, // distant parallax
  tieNear: 540, // near sleepers (wrapped by their pattern period → seamless)
  tieFar: 320, // far sleepers
}
const TIE_NEAR_PERIOD = 26 // must match the .tr-ties.near sleeper tile period
const TIE_FAR_PERIOD = 15 // must match the .tr-ties.far sleeper tile period

// one baked spinning wheel (tyre + rim + brass hub + spokes). Positioned by CSS
// class over the baked body; spins as a whole while driving.
function Wheel({ cls }: { cls: string }) {
  return <span className={`tr-wheel ${cls}`} aria-hidden="true" />
}

// The locomotive — a baked wooden-toy engine BODY (metal boiler, brass hoops,
// wood cab, glass, headlamp, cow-catcher) with three baked wheels + a coupling
// rod that spin/pump while driving, and calm steam puffs from the funnel.
function TrainEngine() {
  return (
    <div className="tr-engine">
      <span className="tr-steam s1" aria-hidden="true" />
      <span className="tr-steam s2" aria-hidden="true" />
      <span className="tr-steam s3" aria-hidden="true" />
      <img className="tr-engine-body" src={SPR + 'engine.png'} alt="" draggable={false} />
      <Wheel cls="we-front" />
      <Wheel cls="we-driver" />
      <Wheel cls="we-rear" />
      <span className="tr-rod" aria-hidden="true" />
    </div>
  )
}

// A numbered wagon — a baked painted-wood wagon BODY with a recessed cream plate;
// the digit is crisp CSS text on top. `ci` = distance from the coupling end, so
// the clank-wave rolls car-by-car toward the engine.
function TrainCar({ value, ci }: { value: number; ci: number }) {
  return (
    <span className="tr-car" style={{ '--ci': ci } as CSSProperties}>
      <span className="tr-car-body">
        <img className="tr-car-img" src={SPR + 'wagon.png'} alt="" draggable={false} />
        <Wheel cls="wc-front" />
        <Wheel cls="wc-rear" />
        <span className="tr-car-num">{value}</span>
      </span>
    </span>
  )
}

// A baked station house (plaster walls, tiled roof, wood door, glass windows,
// gable clock, stone platform) with a crisp CSS sign above it.
function StationHouse({ label }: { label: string }) {
  return (
    <div className="tr-station-house">
      <img className="tr-station-img" src={SPR + 'station.png'} alt="" draggable={false} />
      <span className="tr-sign">{label}</span>
    </div>
  )
}

type Phase = 'build' | 'driving' | 'arrived' | 'complete'

export default function NumberTrain({ onExit }: GameProps) {
  const { t, lang, say } = useT()
  // difficulty is driven by the shared HEADER star control (LevelButton) via the
  // per-game store; the game only READS the level and rebuilds the trip on change.
  const [level] = useGameLevel('train', LEVEL_TIERS)
  const [phase, setPhase] = useState<Phase>('build')
  const [consist, setConsist] = useState<number[]>(() => makeConsist(level))
  const [placed, setPlaced] = useState<number[]>([])
  const [choices, setChoices] = useState<number[]>(() => shuffle(consist))
  const [stationIdx, setStationIdx] = useState(0)
  const [riders, setRiders] = useState<number[]>([])
  const [boarding, setBoarding] = useState<number | null>(null)
  const [boarded, setBoarded] = useState(false)
  const [sceneSeq, setSceneSeq] = useState<Scene[]>(() => makeSceneSeq(STATIONS_FOR_TIER[level]))

  const stationsTotal = STATIONS_FOR_TIER[level]
  const scene = sceneSeq[Math.min(stationIdx, sceneSeq.length - 1)] ?? SCENES[0]
  const markerHome = stationIdx <= 0 ? START_PCT : dotLeft(stationIdx - 1, stationsTotal)

  const rafRef = useRef<number | null>(null)
  const chuffRef = useRef<number | null>(null)
  const timers = useRef<number[]>([])
  const consistRef = useRef<HTMLDivElement>(null)
  const stationElRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLSpanElement>(null)
  const sceneryRef = useRef<HTMLDivElement>(null)
  const hillsRef = useRef<HTMLDivElement>(null)
  const tiesNearRef = useRef<HTMLDivElement>(null)
  const tiesFarRef = useRef<HTMLDivElement>(null)

  // journey-map coordinate mirror: he progresses RIGHT→LEFT (reading-forward),
  // en LEFT→RIGHT. Dots/marker are positioned by `left:%`, so flip the % in he.
  const mapPct = (pct: number) => (lang === 'he' ? 100 - pct : pct)

  // Drive every world layer from one eased progress `e` (0→1). Positions are
  // signed by language so the whole world moves opposite the travel direction
  // (he travels LEFT → world slides RIGHT; en travels RIGHT → world slides LEFT)
  // and every layer comes to rest together at e=1.
  function applyWorld(e: number) {
    const he = lang === 'he'
    const set = (ref: typeof stationElRef, x: number) => {
      if (ref.current) ref.current.style.transform = `translateX(${x}px)`
    }
    // station + parallax slide from the forward edge toward their resting spot
    set(stationElRef, (he ? -1 : 1) * WORLD.station * (1 - e))
    set(sceneryRef, he ? -WORLD.scenery * (1 - e) : -WORLD.scenery * e)
    set(hillsRef, he ? -WORLD.hills * (1 - e) : -WORLD.hills * e)
    // sleepers: accumulate distance (fast→slow with e) then wrap by their period,
    // so the ground visibly slows to a stop without ever revealing a seam
    const near = (WORLD.tieNear * e) % TIE_NEAR_PERIOD
    const far = (WORLD.tieFar * e) % TIE_FAR_PERIOD
    set(tiesNearRef, he ? near : -near)
    set(tiesFarRef, he ? far : -far)
  }
  function clearWorld() {
    for (const ref of [stationElRef, sceneryRef, hillsRef, tiesNearRef, tiesFarRef]) {
      if (ref.current) ref.current.style.transform = ''
    }
  }

  function stopDrive() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (chuffRef.current) {
      window.clearInterval(chuffRef.current)
      chuffRef.current = null
    }
  }

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      stopDrive()
      stopSpeech()
    },
    [],
  )

  const dir = lang === 'he' ? 'he' : 'en'

  // a tiny imperative coupling recoil (build phase only) — no per-frame setState
  function nudgeEngine() {
    if (prefersReducedMotion()) return
    const el = consistRef.current
    if (!el) return
    const push = lang === 'he' ? 5 : -5
    el.style.transition = 'none'
    el.style.transform = `translateX(${push}px)`
    requestAnimationFrame(() => {
      if (!consistRef.current) return
      consistRef.current.style.transition = 'transform 260ms var(--ease-out-soft)'
      consistRef.current.style.transform = ''
    })
  }

  function tap(num: number) {
    if (phase !== 'build') return
    unlockAudio()
    if (num !== consist[placed.length]) {
      playNudge() // gentle — which number couples next?
      return
    }
    playCouple(num)
    speakNumber(num)
    nudgeEngine()
    const next = [...placed, num]
    setPlaced(next)
    setChoices((c) => c.filter((x) => x !== num))
    if (next.length === consist.length) {
      timers.current.push(window.setTimeout(depart, 650))
    }
  }

  function depart() {
    playWhistle()
    playClip('train-depart', say('train.depart'))
    setPhase('driving')
    if (prefersReducedMotion()) {
      timers.current.push(window.setTimeout(arrive, 1100))
      return
    }
    playChuff()
    chuffRef.current = window.setInterval(playChuff, 640)
    const DURATION = 3200
    const t0 = performance.now()
    const from = mapPct(stationIdx <= 0 ? START_PCT : dotLeft(stationIdx - 1, stationsTotal))
    const to = mapPct(dotLeft(stationIdx, stationsTotal))
    applyWorld(0) // seed the world at the leg's start (station off the forward edge)
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION)
      const e = 1 - Math.pow(1 - p, 3) // ease-out: the whole world decelerates to a stop
      applyWorld(e)
      if (markerRef.current) markerRef.current.style.left = `${from + (to - from) * e}%`
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
        stopDrive()
        arrive()
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  function arrive() {
    stopDrive()
    playStationBell()
    playWhistle()
    playClip('train-arrive', say('train.arrive'))
    const friend = randFriendIndex()
    setBoarding(friend)
    setBoarded(false)
    setPhase('arrived')
    // the friend waves, then steps in
    timers.current.push(window.setTimeout(() => setBoarded(true), 950))
    timers.current.push(
      window.setTimeout(() => {
        setRiders((r) => [...r, friend])
        setBoarding(null)
        const reached = stationIdx + 1
        setStationIdx(reached)
        if (reached >= stationsTotal) {
          setPhase('complete')
          playSuccess()
          playClip('train-tripDone', say('train.tripDone'))
        } else {
          const c = makeConsist(level)
          setConsist(c)
          setPlaced([])
          setChoices(shuffle(c))
          clearWorld()
          setPhase('build')
        }
      }, 2050),
    )
  }

  // rebuild the whole trip for a tier (used by the header level control + "again")
  function resetTrip(lvl: number) {
    stopDrive()
    setSceneSeq(makeSceneSeq(STATIONS_FOR_TIER[lvl]))
    setStationIdx(0)
    setRiders([])
    setBoarding(null)
    setBoarded(false)
    const c = makeConsist(lvl)
    setConsist(c)
    setPlaced([])
    setChoices(shuffle(c))
    clearWorld()
    if (markerRef.current) markerRef.current.style.left = `${mapPct(START_PCT)}%`
    setPhase('build')
  }

  // react to a difficulty change from the shared header star control: rebuild the
  // trip for the new tier (same tiers/behaviour as the old in-body chips).
  const levelRef = useRef(level)
  useEffect(() => {
    if (levelRef.current === level) return
    levelRef.current = level
    resetTrip(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function newTrip() {
    playTap()
    resetTrip(level)
  }

  const nextNum = consist[placed.length]

  return (
    <GameShell title={t('game.train')} emoji="🚂" onExit={onExit} levels={{ gameId: 'train', tiers: LEVEL_TIERS }}>
      <Confetti active={phase === 'complete'} calm />
      <div className="tr-screen center-body">
        <div className="tr-head">
          <span className="score-pill" aria-hidden="true">
            🚂 {Math.min(stationIdx, stationsTotal)} / {stationsTotal}
          </span>
        </div>

        {/* journey map — dots light up as stations are reached */}
        <div className="tr-map" aria-hidden="true">
          <span className="tr-map-line" />
          {Array.from({ length: stationsTotal }).map((_, i) => (
            <span
              key={i}
              className={`tr-map-dot ${i < stationIdx ? 'lit' : ''} ${i === stationIdx ? 'cur' : ''}`}
              style={{ left: `${mapPct(dotLeft(i, stationsTotal))}%` }}
            />
          ))}
          <span ref={markerRef} className={`tr-map-marker ${dir}`} style={{ left: `${mapPct(markerHome)}%` }}>
            🚂
          </span>
        </div>

        {/* the scene */}
        <div
          className={`tr-scene ${phase} ${dir}`}
          style={
            {
              '--sky-top': scene.skyTop,
              '--sky-bot': scene.skyBot,
              '--hill': scene.hill,
              '--hill-back': scene.hillBack,
              '--ground': scene.ground,
            } as CSSProperties
          }
        >
          {/* illustrated far landscape (muted, static — the farthest plane) */}
          <SceneBackdrop src={scene.bg} position="center 74%" scrim="soft" className="tr-backdrop" />

          {/* distant hills (slow parallax) */}
          <div className="tr-hills" aria-hidden="true" ref={hillsRef}>
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" width="100%" height="100%">
              <path d="M0,40 L0,26 Q16,12 34,22 Q52,32 70,18 Q86,8 100,24 L100,40 Z" fill="var(--hill-back)" opacity="0.6" />
              <path d="M100,40 L100,26 Q116,12 134,22 Q152,32 170,18 Q186,8 200,24 L200,40 Z" fill="var(--hill-back)" opacity="0.6" />
              <path d="M0,40 L0,32 Q22,22 44,30 Q66,38 88,28 Q98,24 100,30 L100,40 Z" fill="var(--hill)" opacity="0.82" />
              <path d="M100,40 L100,32 Q122,22 144,30 Q166,38 188,28 Q198,24 200,30 L200,40 Z" fill="var(--hill)" opacity="0.82" />
            </svg>
          </div>

          {/* mid-ground scenery (medium parallax) */}
          <div className="tr-scenery" aria-hidden="true" ref={sceneryRef}>
            {[...scene.items, ...scene.items].map((e, i) => (
              <span className="tr-item" key={i}>
                {e}
              </span>
            ))}
          </div>

          {/* the station house — slides in and docks beside the train (rAF) */}
          <div className="tr-station" ref={stationElRef}>
            <StationHouse label={`${t('train.station')} ${Math.min(stationIdx + 1, stationsTotal)}`} />
            {boarding != null && (
              <span className={`tr-passenger ${boarded ? 'boarded' : ''}`}>
                <Friend index={boarding} scale={40 / friendMaxDim(boarding)} showNumber={false} waving={!boarded} lively />
              </span>
            )}
          </div>

          {/* ground: baked ballast bed, converging far rail + near rail + sleepers */}
          <div className="tr-ground" aria-hidden="true">
            <div className="tr-rail far" />
            <div className="tr-ties far" ref={tiesFarRef} />
            <div className="tr-rail near" />
            <div className="tr-ties near" ref={tiesNearRef} />
          </div>

          {/* the train — scaled to always fit the scene as the consist grows */}
          <div
            className={`tr-train ${phase !== 'build' ? 'driving' : ''}`}
            style={{ transform: `translateX(-50%) scale(${consist.length <= 3 ? 1 : consist.length === 4 ? 0.92 : 0.82})` }}
          >
            {riders.length > 0 && (
              <div className="tr-riders" aria-hidden="true">
                {riders.map((f, i) => (
                  <span className="tr-rider" key={i}>
                    <Friend index={f} scale={24 / friendMaxDim(f)} showNumber={false} />
                  </span>
                ))}
              </div>
            )}
            <div className={`tr-consist ${dir}`} ref={consistRef}>
              <TrainEngine />
              <div className={`tr-cars ${dir}`} key={placed.length}>
                {placed.map((n, idx) => (
                  <TrainCar key={idx} value={n} ci={placed.length - 1 - idx} />
                ))}
                {phase === 'build' && placed.length < consist.length && (
                  <span className="tr-slot" aria-hidden="true">
                    {nextNum}
                  </span>
                )}
              </div>
            </div>
            <span className="tr-shadow" aria-hidden="true" />
          </div>
        </div>

        {/* bottom row: number pool (build) or the trip-complete panel */}
        {phase === 'build' && (
          <div className="tr-choices">
            {choices.map((n) => (
              <button key={n} className="tr-num" onClick={() => tap(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
        {phase === 'complete' && (
          <div className="tr-complete">
            <span className="tr-sticker" aria-hidden="true">
              🚂
            </span>
            <button className="big-button" onClick={newTrip}>
              🔁 {t('train.again')}
            </button>
          </div>
        )}
      </div>
    </GameShell>
  )
}
