import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Confetti from '../components/Confetti'
import type { GameProps } from './registry'
import { playNudge, playPop, playWin, unlockAudio } from '../audio'
import { randInt, shuffle } from './util'
import { useGameLevel } from '../gameLevel'
import { dirFor, useT } from '../i18n'

// "מה בא אחר כך?" — a repeating bead pattern on a wooden bead-board with the last
// bead missing; the child completes it from a tray of loose beads. The beads, the
// rail they rest on, the empty socket and the choice tray are all BAKED sprite art
// (glossy orbs + real wood, see public/art/sprites/pattern/). Errorless: a wrong
// tap just nudges (no penalty, no lose state), the right one pops the bead into
// place and cheers.
//
// FROZEN LOGIC: the mechanic is unchanged — a unit of coloured beads repeats, the
// last position is hidden, pick the bead that completes it. What's new here is the
// baked material, the grounded board, and the header difficulty control that grows
// the pattern complexity (AB → ABC/ABB → ABCD) and the number of distractors.

const HUES = ['coral', 'amber', 'honey', 'sage', 'sky', 'lilac'] as const
type Hue = (typeof HUES)[number]

// canonical difficulty tiers this game exposes through the shared header control:
// קל · בינוני · קשה · אלוף  (see src/difficulty.ts / useGameLevel)
const LEVEL_TIERS = [0, 1, 2, 3]

// A "unit" is one repeat of the pattern, written as letter-indices (0=A,1=B,…).
// The generator maps those letters onto a shuffled set of distinct bead hues.
const TEMPLATES: Record<string, number[]> = {
  AB: [0, 1],
  ABC: [0, 1, 2],
  ABB: [0, 1, 1],
  AAB: [0, 0, 1],
  ABCB: [0, 1, 2, 1],
  ABCD: [0, 1, 2, 3],
}
// which unit shapes each tier may roll (cumulative — harder tiers keep the earlier
// shapes and add more complex ones). אלוף drops the trivial pure-AB so it is never
// a near-auto-win, and always mixes in an extra distractor.
const TIER_UNITS: string[][] = [
  ['AB'], // קל — simple AB, as easy as before
  ['AB', 'ABC'], // בינוני
  ['AB', 'ABC', 'ABB', 'AAB'], // קשה — patterns with a repeated element
  ['ABC', 'ABB', 'AAB', 'ABCB', 'ABCD'], // אלוף — full complex set, a real challenge
]
const TIER_DISTRACTORS = [0, 1, 1, 2]

type Puzzle = { seq: Hue[]; answer: Hue; choices: Hue[] }

function makePuzzle(level: number): Puzzle {
  const shapes = TIER_UNITS[level] ?? TIER_UNITS[0]
  const shape = shapes[randInt(0, shapes.length - 1)]
  const template = TEMPLATES[shape]
  const pool = shuffle([...HUES])
  const unit = template.map((i) => pool[i]) // letters → distinct hues
  const L = unit.length

  // A compact, uniform row of 6 cells (5 visible beads + the missing slot) at every
  // level — the market-recommended "4–6 items", short enough to read on one line in
  // both directions. The unit repeats and the LAST bead is hidden (frozen mechanic);
  // 5 visible beads always show at least one full unit (max unit length here is 4),
  // so the answer is inferable. Difficulty grows through pattern complexity and the
  // number of distractors, not through a longer row.
  const N = 6
  const seq: Hue[] = Array.from({ length: N }, (_, i) => unit[i % L])
  const answer = seq[N - 1]

  // choices = every distinct hue in the pattern (so the answer is always offered)
  // + a few unused-hue distractors, capped so the tray never exceeds 5 beads.
  const distinctHues = [...new Set(unit)]
  const want = Math.max(0, Math.min(TIER_DISTRACTORS[level] ?? 0, 5 - distinctHues.length))
  const distractors = pool.filter((h) => !distinctHues.includes(h)).slice(0, want)
  const choices = shuffle([...distinctHues, ...distractors])
  return { seq, answer, choices }
}

export default function PatternGame({ onExit }: GameProps) {
  const { t, lang } = useT()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('pattern', LEVEL_TIERS)
  const [puz, setPuz] = useState<Puzzle>(() => makePuzzle(level))
  const [solved, setSolved] = useState(false)
  const [wrong, setWrong] = useState<Hue | null>(null)
  const timers = useRef<number[]>([])
  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => clear, [])

  // switching difficulty from the header deals a fresh pattern at the new level
  // (skip the very first render — the initial puzzle is already made above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    clear()
    setSolved(false)
    setWrong(null)
    setPuz(makePuzzle(level))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function pick(choice: Hue) {
    if (solved) return
    unlockAudio()
    if (choice === puz.answer) {
      setSolved(true)
      setWrong(null)
      playWin()
    } else {
      setWrong(choice)
      playNudge()
      timers.current.push(window.setTimeout(() => setWrong(null), 450))
    }
  }
  function next() {
    clear()
    setSolved(false)
    setWrong(null)
    setPuz(makePuzzle(level))
    playPop()
  }

  const last = puz.seq.length - 1

  return (
    <GameShell
      title={t('game.pattern')}
      emoji="🔵"
      onExit={onExit}
      levels={{ gameId: 'pattern', tiers: LEVEL_TIERS }}
    >
      <Confetti active={solved} />
      <div className="pat-stage center-body">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 32%" scrim="soft" />
        <p className="pat-q">{t('pat.q')}</p>

        {/* he: the sequence reads right→left, so the ? socket (last in DOM order)
            lands on the LEFT edge — the reading "end". en: left→right, socket on
            the right. Same DOM order either way; the container's dir flips which
            edge is the end, keeping "what comes next" unambiguous in both. */}
        <div className="pat-track">
          <div className="pat-seq" dir={dirFor(lang)} key={puz.seq.join('-')}>
            {puz.seq.map((hue, i) =>
              i === last ? (
                <span
                  key={i}
                  className={`pat-cell ${solved ? 'pat-bead is-filled' : 'is-socket'}`}
                  data-hue={solved ? puz.answer : undefined}
                  aria-hidden="true"
                />
              ) : (
                <span key={i} className="pat-cell pat-bead" data-hue={hue} aria-hidden="true" />
              ),
            )}
          </div>
        </div>

        {!solved ? (
          <div className="pat-tray">
            <div className="pat-choices">
              {puz.choices.map((hue) => (
                <button
                  key={hue}
                  className={`pat-cell pat-bead pat-choice ${wrong === hue ? 'is-wrong' : ''}`}
                  data-hue={hue}
                  onClick={() => pick(hue)}
                  aria-label={t(`pat.hue.${hue}`)}
                />
              ))}
            </div>
          </div>
        ) : (
          <button className="big-button pat-new" onClick={next}>
            🎲 {t('pat.new')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
