import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import IconButton from '../components/IconButton'
import Stepper from '../components/Stepper'
import SceneBackdrop from '../components/SceneBackdrop'
import FriendArt, { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playNudge, playRise, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendName, friendSay } from '../friends'
import { numberWord, randInt } from './util'
import { speakNumber } from '../voice'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'
import { friendCount } from '../level'
import { useGameLevel } from '../gameLevel'

// Difficulty — wired through the shared header control exactly like CoinSort.
// A friend's DOT COUNT equals its number (index+1): every friend is literally
// built from that many bumps, and one dot sits on each bump. So a difficulty
// tier is just a band of friend numbers — קל reveals a small friend (few dots,
// small numbers, as gentle as the easy end has always been), אלוף a big one
// (many dots — a real challenge, never a near-auto-win). Cumulative, no-fail,
// and clamped to the parent's number ceiling (friendCount()).
const LEVEL_TIERS = [0, 1, 2, 3]
const DOT_BANDS: [number, number][] = [
  [3, 6], //   0 קל
  [6, 10], //  1 בינוני
  [10, 15], // 2 קשה
  [15, 24], // 3 אלוף
]
const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
function bandRange(level: number) {
  const top = Math.max(1, friendCount() - 1) // highest available friend index
  const [minD, maxD] = DOT_BANDS[level] ?? DOT_BANDS[0]
  const lo = clampN(minD - 1, 1, top) // skip the trivial 1-dot friend
  const hi = clampN(maxD - 1, lo, top)
  return { lo, hi }
}
const pickInBand = (level: number) => {
  const { lo, hi } = bandRange(level)
  return randInt(lo, hi)
}
const stepInBand = (index: number, dir: number, level: number) => {
  const { lo, hi } = bandRange(level)
  const span = hi - lo + 1
  return lo + ((((index - lo + dir) % span) + span) % span)
}

// "Connect the dots" — numbered dots sit on a friend's bumps. Tap them in order
// 1→N: a crayon line is drawn and each bump lights up, until the whole friend is
// revealed on the paper worksheet. Counting practice + drawing. The dot positions
// are MEASURED from the rendered friend, so no per-friend setup — this logic is
// frozen; the upgrade is the MATERIALS (paper / crayon / desk) + difficulty.
export default function ConnectDots({ onExit }: GameProps) {
  const { t } = useT()
  const [level] = useGameLevel('dots', LEVEL_TIERS)
  const [index, setIndex] = useState(() => pickInBand(level))
  const [connected, setConnected] = useState(0)
  const [wrong, setWrong] = useState(false)
  const [centers, setCenters] = useState<{ x: number; y: number }[]>([])

  const [win, setWin] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 360,
    h: typeof window !== 'undefined' ? window.innerHeight : 700,
  }))
  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const boardRef = useRef<HTMLDivElement>(null)
  const friendRef = useRef<HTMLDivElement>(null)

  const kind = friendKindForIndex(index)
  const nat = FRIEND_NATURAL[kind]
  // leave breathing room on the paper sheet around the friend (padding + tape)
  const s = Math.min((win.w * 0.78) / nat.w, (win.h * 0.42) / nat.h, 2.4)
  const total = centers.length
  const done = total > 0 && connected >= total

  // measure each bump's centre (in board pixels) once the friend has rendered,
  // and whenever the friend or the screen size changes
  useLayoutEffect(() => {
    const fr = friendRef.current
    const bd = boardRef.current
    if (!fr || !bd) return
    const br = bd.getBoundingClientRect()
    const bumps = fr.querySelectorAll('.bump, .lobe')
    const cs = Array.from(bumps).map((b) => {
      const r = (b as HTMLElement).getBoundingClientRect()
      return { x: r.left + r.width / 2 - br.left, y: r.top + r.height / 2 - br.top }
    })
    setCenters(cs)
  }, [index, s])

  // switching difficulty from the header deals a fresh friend in the new band
  // (skip the first render — the initial friend is already picked above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setIndex(pickInBand(level))
    setConnected(0)
    setWrong(false)
    playRise(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function goTo(next: number) {
    setIndex(next)
    setConnected(0)
    setWrong(false)
    playRise(0)
  }

  function tapDot(n: number) {
    if (done) return
    unlockAudio()
    if (n === connected + 1) {
      setConnected(n)
      if (n >= total) {
        playWin()
        speak(`${numberWord(total)}! ${friendSay(index)}`)
      } else {
        playRise(n - 1) // climbing note per dot → the count sings as the friend appears
        speakNumber(n)
      }
    } else {
      setWrong(true)
      playNudge()
      window.setTimeout(() => setWrong(false), 450)
    }
  }

  function undo() {
    if (connected === 0) return
    playTap()
    setConnected((c) => Math.max(0, c - 1))
  }

  const linePoints = centers
    .slice(0, connected)
    .map((c) => `${c.x},${c.y}`)
    .join(' ')

  return (
    <GameShell
      title={t('game.dots')}
      emoji="✏️"
      onExit={onExit}
      canvasLayout
      levels={{ gameId: 'dots', tiers: LEVEL_TIERS }}
    >
      <Confetti active={done} />
      <div className="color-screen">
        <Stepper
          label={`${friendName(index)} · ${index + 1}`}
          onPrev={() => goTo(stepInBand(index, -1, level))}
          onNext={() => goTo(stepInBand(index, +1, level))}
        />

        {/* the art-room desk the worksheet rests on (baked calm backdrop) */}
        <div className="dots-stage">
          <SceneBackdrop src="art-desk.jpg" position="center 74%" scrim="soft" />

          {/* the paper worksheet — real baked fibre, grounded with a soft shadow + tape */}
          <div className={`dots-sheet ${done ? 'is-done' : ''}`}>
            <span className="dots-tape tl" aria-hidden="true" />
            <span className="dots-tape br" aria-hidden="true" />

            <div
              className={`dots-board ${wrong ? 'is-wrong' : ''} ${done ? 'is-done' : ''}`}
              ref={boardRef}
              style={{ width: nat.w * s, height: nat.h * s }}
            >
              <div
                className="dots-friend"
                ref={friendRef}
                style={{ width: nat.w, transform: `scale(${s})`, transformOrigin: 'top left', textAlign: 'center' }}
              >
                <FriendArt kind={kind} litUnits={connected} showHalo={false} />
              </div>

              <div className={`dots-overlay ${done ? 'is-hidden' : ''}`}>
                <svg className="dots-svg" width={nat.w * s} height={nat.h * s} aria-hidden="true">
                  <defs>
                    {/* crayon roughen — a gentle hand-drawn wobble, NOT a ruler-straight CSS line */}
                    <filter id="dots-crayon" x="-15%" y="-15%" width="130%" height="130%">
                      <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.028 0.045"
                        numOctaves="2"
                        seed="7"
                        result="noise"
                      />
                      <feDisplacementMap
                        in="SourceGraphic"
                        in2="noise"
                        scale="3.4"
                        xChannelSelector="R"
                        yChannelSelector="G"
                      />
                    </filter>
                  </defs>
                  {connected > 1 && (
                    <>
                      <polyline className="dots-line-halo" points={linePoints} />
                      <polyline className="dots-line" points={linePoints} filter="url(#dots-crayon)" />
                    </>
                  )}
                </svg>

                {centers.map((c, i) => {
                  const n = i + 1
                  const state = n <= connected ? 'is-done' : n === connected + 1 ? 'is-next' : 'is-pending'
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`dot ${state}`}
                      style={{ left: c.x, top: c.y }}
                      onClick={() => tapDot(n)}
                      aria-label={t('dots.dotAria', { n })}
                    >
                      {n <= connected ? '' : n}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="color-actions">
          <IconButton icon="↩️" label={t('dots.back')} onClick={undo} disabled={connected === 0} />
          <IconButton icon="🔄" label={t('dots.restart')} onClick={() => goTo(index)} />
          <IconButton icon="🎲" label={t('color.new')} onClick={() => goTo(pickInBand(level))} />
        </div>
      </div>
    </GameShell>
  )
}
