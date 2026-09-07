import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import GameShell from '../components/GameShell'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playFriend, playNudge, playSuccess, playWin, unlockAudio } from '../audio'
import { speak, stopSpeech } from '../speech'
import { friendSay } from '../friends'
import { numberWord, randInt, shuffle } from './util'
import { screenScale, useViewport } from '../useViewport'
import { useT } from '../i18n'
import { numberMax } from '../level'
import { useGameLevel } from '../gameLevel'

// "Missing friend in the sequence" — a run of friends follows a rule (counting,
// jumps, times-tables, doubling) with one gap; pick the friend that completes
// it. The 💡 hint pop-up TEACHES: in the bottom work area it builds the first
// equation element-by-element (friend + friend = ✨friend), then for each next
// term ONLY the changing operand swaps (the constant operand, the operator and
// the = stay put); every finished equation flies UP and stacks in a list; the
// missing term shows `???`. Slow + spoken. No timer; wrong = gentle nudge.
//
// COMMERCIAL-QUALITY LAYER (presentation only — the round/frame logic below is
// frozen): the row now stands on a BAKED wooden shelf (perspective + depth), each
// friend grounded on a baked podium with its number engraved on the nameplate;
// the gap is a baked empty socket; answers sit in a baked tray. A calm SceneBackdrop
// sits behind. Difficulty is the shared top-bar star control (useGameLevel). No
// rAF / no per-frame allocation — the only motion is a CSS shelf sheen, frozen
// under both reduced-motion paths. So the heap stays flat.
const LEN = 4

type SeqType = 'add' | 'mult' | 'geo'
type Round = { terms: number[]; gapPos: number; type: SeqType; step: number; choices: number[] }
type Op = '+' | '−' | '×'
type Frame = { left: number; op: Op; right: number; result: number; target: number; missing: boolean }
type Bottom = { leftVal: number | null; op: Op | null; rightVal: number | null; eq: boolean; res: number | '?' | null }

// canonical tiers: 0 קל · 1 רגיל(≈בינוני) · 2 קשה · 3 אתגר(≈אלוף) — chosen from the
// top-bar star control. Cumulative: קל = a plain +1 run; each level adds a rule.
const LEVEL_TIERS = [0, 1, 2, 3]
const OPW: Record<Op, string> = { '+': 'ועוד', '−': 'פחות', '×': 'כפול' }
// slow, comfortable pacing (ms)
const ENTER = 750 // gap between elements entering (first equation)
const SWAP = 1600 // pause showing the swapped operand (later equations)
const HOLD = 1100 // how long the result shows before flying up
const RISE = 1900 // after the equation flies up, before the next term

function buildTerms(type: SeqType, start: number, step: number): number[] {
  return Array.from({ length: LEN }, (_, i) =>
    type === 'geo' ? start * step ** i : type === 'mult' ? (i + 1) * step : start + i * step,
  )
}

type Config = { type: SeqType; start: number; step: number }

// Constructive generation — pick parameters straight from the ranges that GUARANTEE
// a valid round (every term in [1, numberMax()], distinct, and — for arithmetic —
// a first-equation constant that also fits). No rejection sampling / allocation
// storm: each helper returns a ready round or null if this level can't fit `step`.
function addConfig(step: number): Config | null {
  const N = numberMax()
  if (4 * Math.abs(step) > N) return null // the 💡 hint equations wouldn't fit (4·|step| ≤ N)
  let lo: number, hi: number
  if (step > 0) {
    lo = step + 1 // c = start − step ≥ 1
    hi = N - 3 * step // top term = start + 3·step ≤ N
  } else {
    const a = -step
    lo = 3 * a + 1 // bottom term = start − 3a ≥ 1
    hi = N - a // c = start + a ≤ N
  }
  if (lo > hi) return null
  return { type: 'add', start: randInt(lo, hi), step }
}

function addConfigAny(steps: number[]): Config | null {
  for (const s of shuffle(steps.slice())) {
    const c = addConfig(s)
    if (c) return c
  }
  return null
}

function multConfig(): Config | null {
  const maxN = Math.floor(numberMax() / LEN)
  if (maxN < 2) return null
  const n = randInt(2, maxN) // terms n, 2n, 3n, 4n — all ≤ numberMax()
  return { type: 'mult', start: n, step: n }
}

function geoConfig(): Config | null {
  const N = numberMax()
  const starts = [1, 2].filter((s) => 8 * s <= N) // terms s, 2s, 4s, 8s ≤ N
  if (!starts.length) return null
  return { type: 'geo', start: starts[randInt(0, starts.length - 1)], step: 2 }
}

function pickChoices(missing: number, terms: number[], count: number): number[] {
  const visible = new Set(terms)
  const set = new Set<number>([missing])
  let guard = 0
  while (set.size < count + 1 && guard < 300) {
    guard++
    const d = missing + randInt(1, 3) * (randInt(0, 1) === 0 ? -1 : 1)
    if (d >= 1 && d <= numberMax() && !visible.has(d)) set.add(d)
  }
  for (let n = 1; n <= numberMax() && set.size < count + 1; n++) if (n === missing || !visible.has(n)) set.add(n)
  return shuffle([...set])
}

function genRound(level: number): Round {
  let cfg: Config | null = null
  if (level === 0) {
    cfg = addConfig(1)
  } else if (level === 1) {
    cfg = addConfigAny([1, -1, 2, -2])
  } else if (level === 2) {
    for (const kind of shuffle([0, 1, 2])) {
      cfg = kind === 0 ? addConfigAny([2, 3, -2, -3]) : kind === 1 ? multConfig() : geoConfig()
      if (cfg) break
    }
  } else {
    cfg = randInt(0, 2) === 2 ? (geoConfig() ?? multConfig()) : (multConfig() ?? geoConfig())
  }
  if (!cfg) {
    // ultimate fallback — a simple +1 run (valid for any numberMax ≥ 4)
    const N = numberMax()
    cfg = { type: 'add', start: randInt(2, Math.max(2, N - 3)), step: 1 }
  }
  const terms = buildTerms(cfg.type, cfg.start, cfg.step)
  const gapPos = randInt(1, LEN - 1)
  return {
    terms,
    gapPos,
    type: cfg.type,
    step: cfg.step,
    choices: pickChoices(terms[gapPos], terms, level === 3 ? 3 : 2),
  }
}

function buildFrames(r: Round): Frame[] {
  const g = r.gapPos
  if (r.type === 'mult') {
    const n = r.step
    return Array.from({ length: LEN }, (_, t) => ({
      left: t + 1,
      op: '×' as Op,
      right: n,
      result: (t + 1) * n,
      target: t,
      missing: t === g,
    }))
  }
  if (r.type === 'geo') {
    const frames: Frame[] = []
    for (let i = 1; i <= g; i++)
      frames.push({ left: r.terms[i - 1], op: '×', right: r.step, result: r.terms[i], target: i, missing: i === g })
    return frames
  }
  const c = r.terms[0] - r.step
  const op: Op = r.step >= 0 ? '+' : '−'
  const ad = Math.abs(r.step)
  return Array.from({ length: LEN }, (_, t) => ({
    left: c,
    op,
    right: (t + 1) * ad,
    result: r.terms[t],
    target: t,
    missing: t === g,
  }))
}

function NumFig({ v, px }: { v: number; px: number }) {
  return (
    <span className="eq-num">
      <b className="eq-digit">{v}</b>
      <Friend index={v - 1} scale={px / friendMaxDim(v - 1)} showNumber={false} />
    </span>
  )
}

// small figure used in the accumulated list
function SmallNum({ v }: { v: number }) {
  return (
    <span className="hint-snum">
      <Friend index={v - 1} scale={42 / friendMaxDim(v - 1)} showNumber={false} />
      <b>{v}</b>
    </span>
  )
}

const EMPTY_BOTTOM: Bottom = { leftVal: null, op: null, rightVal: null, eq: false, res: null }

export default function SeqGame({ onExit }: GameProps) {
  // per-game difficulty from the shared header star control (opens at the parent's
  // global setting mapped through the tiers, then the child's choice sticks).
  const [level] = useGameLevel('sequence', LEVEL_TIERS)
  const [round, setRound] = useState<Round>(() => genRound(level))
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const [solved, setSolved] = useState(false)
  const [poked, setPoked] = useState<number | null>(null)
  const [hintOpen, setHintOpen] = useState(false)
  const [bottom, setBottom] = useState<Bottom>(EMPTY_BOTTOM)
  const [history, setHistory] = useState<Frame[]>([])
  const [done, setDone] = useState(false)
  const [party, setParty] = useState(false) // confetti every 5th in a row
  const timers = useRef<number[]>([])

  const { t } = useT()
  const vp = useViewport()
  const missing = round.terms[round.gapPos]
  // memoised so switching props (score/hint) doesn't re-alloc the frames array
  const frames = useMemo(() => buildFrames(round), [round])
  const changing: 'left' | 'right' = round.type === 'add' ? 'right' : 'left'
  const f = screenScale(vp.w)
  const seqScale = (n: number) => (56 * f) / friendMaxDim(n - 1)
  const choiceScale = (n: number) => (58 * f) / friendMaxDim(n - 1)
  const podW = Math.round(84 * f)
  // podW drives the podium's aspect-ratio height, so the friend's feet + the
  // nameplate can be grounded to it in CSS (calc on --pw).
  const tileStyle = { width: podW, '--pw': `${podW}px` } as CSSProperties

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  useEffect(() => {
    speak('איזה חבר חסר?')
  }, [round])

  function next(lvl = level) {
    clearTimers()
    setHintOpen(false)
    setBottom(EMPTY_BOTTOM)
    setHistory([])
    setDone(false)
    setRound(genRound(lvl))
    setSolved(false)
    setWrong(null)
  }

  // switching difficulty from the header deals a fresh round at the new level
  // (skip the first render — the initial round is already generated above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    next(level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function sayFriend(n: number) {
    unlockAudio()
    playFriend(n - 1)
    speak(`${numberWord(n)}. ${friendSay(n - 1)}`)
    setPoked(n)
    window.setTimeout(() => setPoked(null), 550)
  }

  function speakFrame(f: Frame) {
    const w = OPW[f.op]
    if (f.missing) speak(`${numberWord(f.left)} ${w} ${numberWord(f.right)}?`)
    else speak(`${numberWord(f.left)} ${w} ${numberWord(f.right)} שווה ${numberWord(f.result)}`)
  }

  function openHint() {
    unlockAudio()
    stopSpeech()
    clearTimers()
    setHintOpen(true)
    setBottom(EMPTY_BOTTOM)
    setHistory([])
    setDone(false)

    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    let t = 300
    frames.forEach((fr, k) => {
      if (k === 0) {
        // build the first equation element by element
        at(t, () => setBottom((b) => ({ ...b, leftVal: fr.left })))
        t += ENTER
        at(t, () => setBottom((b) => ({ ...b, op: fr.op })))
        t += ENTER
        at(t, () => setBottom((b) => ({ ...b, rightVal: fr.right })))
        t += ENTER
        at(t, () => setBottom((b) => ({ ...b, eq: true })))
        t += ENTER
        at(t, () => {
          setBottom((b) => ({ ...b, res: fr.missing ? '?' : fr.result }))
          speakFrame(fr)
        })
        t += HOLD
      } else {
        // only the changing operand swaps; constant + op + = stay (slow, so the
        // swap is clearly seen)
        at(t, () =>
          setBottom((b) => ({
            ...b,
            res: null,
            leftVal: changing === 'left' ? fr.left : b.leftVal,
            rightVal: changing === 'right' ? fr.right : b.rightVal,
          })),
        )
        t += SWAP
        at(t, () => {
          setBottom((b) => ({ ...b, res: fr.missing ? '?' : fr.result }))
          speakFrame(fr)
        })
        t += HOLD
      }
      // the finished equation flies up to the list, and the result clears below
      at(t, () => {
        setHistory((h) => [...h, fr])
        setBottom((b) => ({ ...b, res: null }))
      })
      t += RISE
    })
    // once the last equation has risen, hide the work area so all the
    // equations are seen together in the list
    at(t, () => setDone(true))
  }

  function closeHint() {
    clearTimers()
    stopSpeech()
    setHintOpen(false)
  }

  function pick(n: number) {
    if (solved) return
    unlockAudio()
    if (n === missing) {
      setSolved(true)
      const ns = score + 1
      setScore(ns)
      if (ns % 5 === 0) {
        playWin()
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
      } else playSuccess()
      speak(`${numberWord(missing)}. ${friendSay(missing - 1)}`)
      window.setTimeout(() => next(), 1200)
    } else {
      setWrong(n)
      playNudge()
      window.setTimeout(() => setWrong(null), 450)
    }
  }

  // one sequence position — a friend grounded on a baked podium (number engraved
  // on the nameplate), or the baked empty socket at the gap.
  function Tile({ num, i }: { num: number; i: number }) {
    const isGap = i === round.gapPos && !solved
    if (isGap) {
      return (
        <span className="seq-tile" style={tileStyle}>
          <span className="seq-podium seq-socket" aria-hidden="true" />
          <span className="seq-plate seq-plate-empty">?</span>
        </span>
      )
    }
    return (
      <button
        className="seq-tile"
        style={tileStyle}
        onClick={() => sayFriend(num)}
        aria-label={t('bs.friendAria', { n: num })}
      >
        <span className="seq-podium" aria-hidden="true" />
        <span className="seq-stand">
          <Friend
            index={num - 1}
            scale={seqScale(num)}
            showNumber={false}
            bouncing={poked === num || (i === round.gapPos && solved)}
          />
        </span>
        <span className="seq-plate">{num}</span>
      </button>
    )
  }

  return (
    <GameShell
      title={t('game.sequence')}
      emoji="🧩"
      onExit={onExit}
      levels={{ gameId: 'sequence', tiers: LEVEL_TIERS }}
    >
      <Confetti active={party} />
      <div className="seq-head">
        <span className="seq-score" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>
      </div>

      {/* the sequence stands on a baked wooden shelf, behind it a calm room */}
      <div className="seq-stage">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 30%" scrim="soft" />
        <span className="seq-shelf" aria-hidden="true" />
        {/* calm ambient: a slow, barely-there light sheen across the shelf.
            CSS-only (no JS/rAF), frozen under both reduced-motion paths. */}
        <span className="seq-ambient" aria-hidden="true">
          <span className="seq-sheen" />
        </span>
        <div className="seq-row">
          {round.terms.map((num, i) => (
            <Tile key={i} num={num} i={i} />
          ))}
        </div>
      </div>

      <div className="seq-tools">
        <button className="pill" onClick={() => speak('איזה חבר חסר?')}>
          🔊 {t('bs.replay')}
        </button>
        <button className="pill" onClick={openHint}>
          💡 {t('seq.hint')}
        </button>
      </div>

      {/* answers sit in a baked wooden tray — "pick one from here" */}
      <div className="seq-tray-wrap">
        <span className="seq-tray" aria-hidden="true" />
        <div className="seq-choices">
          {round.choices.map((n) => (
            <button
              key={n}
              className={`seq-tile seq-choice ${wrong === n ? 'is-wrong' : ''}`}
              style={tileStyle}
              onClick={() => pick(n)}
              disabled={solved}
              aria-label={t('bs.friendAria', { n })}
            >
              <span className="seq-podium" aria-hidden="true" />
              <span className="seq-stand">
                <Friend index={n - 1} scale={choiceScale(n)} showNumber={false} />
              </span>
              <span className="seq-plate">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {hintOpen && (
        <div className="hint-overlay" onClick={closeHint}>
          <div className="hint-card" onClick={(e) => e.stopPropagation()}>
            <button className="hint-close" onClick={closeHint} aria-label={t('seq.close')}>
              ✕
            </button>

            {/* top: equations that finished, flying up and stacking */}
            <div className="hint-list" dir="ltr">
              {history.map((fr, i) => (
                <div className="hint-eq" key={i}>
                  <SmallNum v={fr.left} />
                  <span className="hint-eq-op">{fr.op}</span>
                  <SmallNum v={fr.right} />
                  <span className="hint-eq-op">=</span>
                  {fr.missing ? <span className="hint-eq-q">???</span> : <SmallNum v={fr.result} />}
                </div>
              ))}
            </div>

            {/* bottom work area — hidden once every equation has risen, so the
                full list of equations is seen together */}
            {!done && (
              <>
                <div className="hint-divider" />
                <div className="hint-work">
                  <div className="eq-row" dir="ltr">
                    {bottom.leftVal != null && <NumFig key={`L${bottom.leftVal}`} v={bottom.leftVal} px={60} />}
                    {bottom.op && (
                      <span className="eq-sym" key="op">
                        {bottom.op}
                      </span>
                    )}
                    {bottom.rightVal != null && <NumFig key={`R${bottom.rightVal}`} v={bottom.rightVal} px={60} />}
                    {bottom.eq && (
                      <span className="eq-sym" key="eq">
                        =
                      </span>
                    )}
                    {bottom.res === '?' && (
                      <span className="eq-sym eq-q" key="resq">
                        ???
                      </span>
                    )}
                    {typeof bottom.res === 'number' && (
                      <span className="eq-res" key={`res${bottom.res}`}>
                        <NumFig v={bottom.res} px={60} />
                        <span className="eq-spark" aria-hidden="true">
                          ✨
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            <button className="pill hint-replay" onClick={openHint}>
              ↻ {t('seq.again')}
            </button>
          </div>
        </div>
      )}
    </GameShell>
  )
}
