import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import Stepper from '../components/Stepper'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import Confetti from '../components/Confetti'
import { playHonk, playNudge, playSuccess, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendName } from '../friends'
import { numberChoices, randInt, shuffle } from './util'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'
import { friendCount, randFriendIndex, opEnabled, numberMax } from '../level'

// "Garage + race" — build a car (driver friend + paint), then race by solving
// number questions. Every correct answer drives YOU forward; a wrong answer just
// nudges gently and never advances (NO fail, no rival to lose to). A race is 15
// correct answers; the environment changes every 5.
//
// MATERIALS (commercial-quality pass): the car (per paint colour), its wheels and
// the whole receding ROAD (asphalt + grass verge + converging edge lines) are all
// BAKED sprite art (real material texture + baked key light + AO + contact
// shadow) — see public/art/sprites/race. Only crisp TEXT (the sum, the choices)
// and layout/animation stay CSS. DEPTH: the road is a rotateX perspective plane
// that recedes to the horizon with converging lanes and streaming lane dashes.
// DIFFICULTY is driven by the shared HEADER star control (useGameLevel), not the
// old in-body chip row. The loved DRIVE ANIMATION is kept and enriched: the car
// bobs, its baked wheels spin, and the baked dashes stream toward it.

const SPR = import.meta.env.BASE_URL + 'art/sprites/race/'

// four canonical tiers, each its own header star option (קל · בינוני · קשה · אלוף)
const LEVEL_TIERS = [0, 1, 2, 3]
const WIN = 15 // correct answers to finish a race
const SEGMENT = 5 // environment changes every 5 correct answers

// muted paint palette — the sprite name is the baked car file (gen-race-art.mjs
// bakes one car per colour, so the swatch and the driven car always match).
const PAINTS: { swatch: string; sprite: string }[] = [
  { swatch: '#c65a4e', sprite: 'car-red' },
  { swatch: '#d08a4c', sprite: 'car-orange' },
  { swatch: '#cbb24e', sprite: 'car-yellow' },
  { swatch: '#6fa86a', sprite: 'car-green' },
  { swatch: '#5b86b0', sprite: 'car-blue' },
  { swatch: '#6d6bb0', sprite: 'car-indigo' },
  { swatch: '#c079a0', sprite: 'car-pink' },
  { swatch: '#3f4a5a', sprite: 'car-graphite' },
]

type Env = { key: string; bg: string; skyTop: string; skyBot: string; dark?: boolean; rainbow?: boolean }
// muted illustrated landscapes (real CC0 art from public/art/bg), one per scene
const ENVIRONMENTS: Env[] = [
  { key: 'forest', bg: 'forest.jpg', skyTop: '#bcd9e6', skyBot: '#dcecdf' },
  { key: 'desert', bg: 'desert-dusk.jpg', skyTop: '#e7c9a0', skyBot: '#f1e2c6' },
  { key: 'city', bg: 'town.jpg', skyTop: '#c9dbe8', skyBot: '#e6edf2' },
  { key: 'night', bg: 'night-sky.jpg', skyTop: '#28344c', skyBot: '#3c4c68', dark: true },
  { key: 'mountains', bg: 'hills-dusk.jpg', skyTop: '#c7d4e0', skyBot: '#e3ecec' },
  { key: 'rainbow', bg: 'party-garden.jpg', skyTop: '#cfe0ef', skyBot: '#e7eff5', rainbow: true },
]

function makeProblem(level: number) {
  const nMax = numberMax()
  const addMax = Math.min(nMax, level === 0 ? 5 : level === 1 ? 9 : 12)
  let text: string
  let ans: number
  const canMul = opEnabled('mul') && level >= 2
  if (canMul && Math.random() < (level >= 3 ? 0.75 : 0.5)) {
    const cap = level >= 3 ? 9 : 5
    const a = randInt(2, level >= 3 ? 6 : cap)
    const b = randInt(2, cap)
    if (level >= 3 && opEnabled('add') && Math.random() < 0.4) {
      const c = randInt(1, 9)
      text = `${a} × ${b} + ${c}`
      ans = a * b + c
    } else if (level >= 3 && opEnabled('sub') && a * b > 3 && Math.random() < 0.4) {
      const c = randInt(1, Math.min(9, a * b - 1))
      text = `${a} × ${b} − ${c}`
      ans = a * b - c
    } else {
      text = `${a} × ${b}`
      ans = a * b
    }
  } else {
    const a = randInt(2, addMax)
    const b = randInt(1, addMax)
    if (opEnabled('sub') && (!opEnabled('add') || Math.random() < 0.5) && a >= b) {
      text = `${a} − ${b}`
      ans = a - b
    } else {
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      text = `${lo} + ${hi}`
      ans = lo + hi
    }
  }
  const spread = level === 0 ? 4 : 6
  return { text, ans, choices: numberChoices(ans, 3, Math.max(0, ans - spread), ans + spread) }
}

function pickEnvs() {
  return shuffle(ENVIRONMENTS).slice(0, 3)
}

// The baked car: a painted body sprite (per colour) + two baked wheels that spin
// while driving, with the driver friend riding in the cockpit. `he` mirrors the
// whole vehicle (Hebrew drives leading-edge-first) while the friend stays upright.
const Car = memo(function Car({
  sprite,
  driver,
  he,
  scale = 1,
}: {
  sprite: string
  driver: number
  he: boolean
  scale?: number
}) {
  return (
    <span className="rc-car-rig" style={{ '--car-scale': scale } as CSSProperties}>
      <span className={`rc-car-vehicle ${he ? 'flip' : ''}`}>
        <img className="rc-car-body" src={SPR + sprite + '.png'} alt="" draggable={false} />
        <span className="rc-wheel rear" aria-hidden="true" />
        <span className="rc-wheel front" aria-hidden="true" />
      </span>
      <span className="rc-car-driver" style={{ left: he ? '56.9%' : '43.1%' }}>
        <Friend index={driver} scale={(42 * scale) / friendMaxDim(driver)} showNumber={false} lively />
      </span>
    </span>
  )
})

export default function CarRace({ onExit }: GameProps) {
  const { t, lang } = useT()
  const he = lang === 'he'
  // difficulty comes from the shared HEADER star control via the per-game store
  const [level] = useGameLevel('race', LEVEL_TIERS)

  const [phase, setPhase] = useState<'garage' | 'race'>('garage')
  const [driver, setDriver] = useState(() => randFriendIndex())
  const [paint, setPaint] = useState(0)

  const [correct, setCorrect] = useState(0)
  const [envSeq, setEnvSeq] = useState<Env[]>(pickEnvs)
  const [problem, setProblem] = useState(() => makeProblem(level))
  const [wrong, setWrong] = useState<number | null>(null)
  const [won, setWon] = useState(false)
  // two friends cheer at the finish once you win
  const [cheerers, setCheerers] = useState<[number, number]>(() => [randFriendIndex(), randFriendIndex()])

  const env = envSeq[Math.min(envSeq.length - 1, Math.floor(correct / SEGMENT))]
  const playerProg = correct / WIN
  const sprite = PAINTS[paint].sprite

  function beginRace() {
    setEnvSeq(pickEnvs())
    setCorrect(0)
    setWon(false)
    setCheerers([randFriendIndex(), randFriendIndex()])
    setProblem(makeProblem(level))
    setWrong(null)
  }

  function startRace() {
    unlockAudio()
    playTap()
    beginRace()
    setPhase('race')
  }

  function raceAgain() {
    playTap()
    beginRace()
  }

  // react to a difficulty change from the shared header star control: restart the
  // race cleanly for the new tier (same behaviour the old in-body chips had).
  const levelRef = useRef(level)
  useEffect(() => {
    if (levelRef.current === level) return
    levelRef.current = level
    if (phase === 'race') beginRace()
    else setProblem(makeProblem(level))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, phase])

  useEffect(() => () => void 0, [])

  function answer(choice: number) {
    if (won) return
    unlockAudio()
    if (choice !== problem.ans) {
      // NO fail — just a gentle nudge; the car simply doesn't advance
      setWrong(choice)
      playNudge()
      window.setTimeout(() => setWrong(null), 450)
      return
    }
    const nc = correct + 1
    setCorrect(nc)
    if (nc >= WIN) {
      setWon(true)
      playWin()
      playHonk()
      speak(he ? 'ניצחת!' : 'You won!')
      return
    }
    playSuccess()
    setProblem(makeProblem(level))
  }

  const levels = { gameId: 'race', tiers: LEVEL_TIERS }

  if (phase === 'garage') {
    return (
      <GameShell title={t('race.garage')} emoji="🏎️" onExit={onExit} levels={levels}>
        <div className="garage">
          <p className="garage-title">{t('race.build')} 🔧</p>
          <div className="garage-preview">
            <Car sprite={sprite} driver={driver} he={he} scale={1.5} />
          </div>

          <Stepper
            label={`${t('race.driver')}: ${friendName(driver)}`}
            onPrev={() => setDriver((d) => (d + friendCount() - 1) % friendCount())}
            onNext={() => setDriver((d) => (d + 1) % friendCount())}
          />

          <div className="garage-colors">
            {PAINTS.map((p, i) => (
              <button
                key={p.sprite}
                className={`color-swatch ${paint === i ? 'is-active' : ''}`}
                style={{ background: p.swatch }}
                onClick={() => {
                  playTap()
                  setPaint(i)
                }}
                aria-label={t('race.colorAria')}
              />
            ))}
          </div>

          <button className="big-button" onClick={startRace}>
            🏁 {t('race.go')}
          </button>
        </div>
      </GameShell>
    )
  }

  return (
    <GameShell title={t('game.race')} emoji="🏎️" onExit={onExit} levels={levels}>
      <Confetti active={won} calm />
      <div className="race">
        <div className="race-top">
          <button className="pill" onClick={() => setPhase('garage')}>
            🔧 {t('race.garageBtn')}
          </button>
          <span className="race-count">✅ {correct} / {WIN}</span>
        </div>

        {/* progress toward the finish flag — mirrored for Hebrew */}
        <div className={`race-progress ${he ? 'he' : ''}`} aria-hidden="true">
          <span className="race-pin player" style={{ [he ? 'right' : 'left']: `${6 + playerProg * 82}%` } as CSSProperties}>
            🏎️
          </span>
          <span className="race-flag">🏁</span>
        </div>

        {/* the driving scene — baked perspective road + baked car */}
        <div
          className={`rc-scene ${he ? 'he' : 'en'} ${env.dark ? 'is-dark' : ''}`}
          style={{ '--sky-top': env.skyTop, '--sky-bot': env.skyBot } as CSSProperties}
        >
          <SceneBackdrop src={env.bg} position="center 32%" scrim="soft" className="rc-backdrop" />
          <span className="env-name">{t(`race.env.${env.key}`)}</span>
          {env.rainbow && (
            <span className="rc-rainbow" aria-hidden="true">
              🌈
            </span>
          )}

          {/* receding road plane (asphalt + grass verge + converging edges) with
              streaming baked lane dashes = the loved "moving road stripes" */}
          <div className="rc-road-wrap" aria-hidden="true">
            <div className="rc-road">
              <div className="rc-road-dashes" />
            </div>
          </div>

          {/* the finish line slides in as you approach the end */}
          <div className={`rc-finish ${playerProg >= 0.8 ? 'near' : ''}`} aria-hidden="true" />

          {/* two friends cheer from the grass verge once you win (grounded, waving) */}
          {won && (
            <>
              <span className="rc-cheer left">
                <Friend index={cheerers[0]} scale={40 / friendMaxDim(cheerers[0])} showNumber={false} waving lively />
              </span>
              <span className="rc-cheer right">
                <Friend index={cheerers[1]} scale={40 / friendMaxDim(cheerers[1])} showNumber={false} waving lively />
              </span>
            </>
          )}

          {/* the hero car — bobs + baked wheels spin while driving (the kept drive) */}
          <span className={`rc-car ${won ? 'is-win' : 'driving'}`}>
            <Car sprite={sprite} driver={driver} he={he} />
          </span>
        </div>

        {won ? (
          <div className="race-result">
            <p className="race-result-text">{t('race.win')}</p>
            <div className="race-result-btns">
              <button className="big-button" onClick={raceAgain}>
                🔁 {t('race.again')}
              </button>
              <button className="pill" onClick={() => setPhase('garage')}>
                🔧 {t('race.garageBtn')}
              </button>
            </div>
          </div>
        ) : (
          <div className="race-q">
            <span className="race-expr" dir="ltr">
              {problem.text} =
            </span>
            <div className="race-choices">
              {problem.choices.map((n) => (
                <button key={n} className={`race-choice ${wrong === n ? 'is-wrong' : ''}`} onClick={() => answer(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameShell>
  )
}
