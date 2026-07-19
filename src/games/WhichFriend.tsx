import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { randFriendIndex } from '../level'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playNudge, playSuccess, playWin, playTap, unlockAudio } from '../audio'
import { speak } from '../speech'
import { FRIENDS, friendName, friendSay } from '../friends'
import { shuffle } from './util'
import { speakNumber } from '../voice'
import { screenScale, useViewport } from '../useViewport'
import { useGameLevel } from '../gameLevel'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'

// "איזה חבר?" — a Hebrew letter is shown and spoken; tap the friend whose NAME
// starts with it. Teaches letter↔sound through friends the child knows. No timer;
// a wrong pick gives a gentle nudge.
//
// Commercial-quality pass: the prompt letter now sits carved into a BAKED wooden
// alphabet TILE, the choices are BAKED wooden CARDS the friends stand on, and the
// whole row is grounded on a BAKED wooden TABLE in perspective over an illustrated
// playroom backdrop (public/art/sprites/letter + art/bg). CSS keeps only layout,
// the crisp Hebrew LETTER TEXT (readability is sacred), and gentle transform-only
// motion. The proven mechanic + voice logic are UNCHANGED — only the scene,
// materials, depth, feel and the new header difficulty are added.
const LETTER_NAMES: Record<string, string> = {
  א: 'אָלֶף', ב: 'בֵּית', ג: 'גִּימֶל', ד: 'דָּלֶת', ה: 'הֵא', ו: 'וָו', ז: 'זַיִן',
  ח: 'חֵית', ט: 'טֵית', י: 'יוּד', כ: 'כָּף', ל: 'לָמֶד', מ: 'מֵם', נ: 'נוּן',
  ס: 'סָמֶךְ', ע: 'עַיִן', פ: 'פֵּא', צ: 'צָדִי', ק: 'קוּף', ר: 'רֵישׁ', ש: 'שִׁין', ת: 'תָּו',
}

// Letters that look ALIKE — the harder tiers pull decoy friends whose initial is
// visually close to the target, so telling ד from ר / ה from ח becomes the real
// task. (Purely how DECOYS are chosen — the target letter, its answer and the
// voice are untouched.)
const SIMILAR: Record<string, string[]> = {
  א: ['ע', 'צ'], ב: ['כ', 'נ', 'פ'], ג: ['נ', 'ז'], ד: ['ר', 'ה', 'ח'],
  ה: ['ח', 'ת', 'ד', 'ר'], ו: ['ז', 'ר', 'י', 'נ'], ז: ['ו', 'ר', 'ג', 'נ'],
  ח: ['ה', 'ת', 'ק'], ט: ['מ', 'ס', 'ע'], י: ['ו', 'ז'], כ: ['ב', 'נ', 'פ'],
  ל: ['ר', 'ן'], מ: ['ט', 'ס'], נ: ['ג', 'כ', 'ב', 'ז'], ס: ['ם', 'ט', 'ע', 'מ'],
  ע: ['צ', 'ס', 'ט', 'ש'], פ: ['ב', 'כ'], צ: ['ע', 'ש'], ק: ['ח', 'ה', 'ר'],
  ר: ['ד', 'ה', 'ז', 'ל'], ש: ['ע', 'ק', 'צ'], ת: ['ה', 'ח', 'ם'],
}

// per-game difficulty (header star) — cumulative, no-fail. קל stays the roomy 3
// choices it always was; each tier adds a choice and (from קשה) prefers
// closer-looking-letter decoys, so אלוף is a real 6-way "which ד vs ר" challenge.
const LEVEL_TIERS = [0, 1, 2, 3] // קל · בינוני · קשה · אלוף
const OPTIONS_PER_LEVEL = [3, 4, 5, 6]
const FRIEND_PX = [78, 70, 60, 52] // friends shrink a touch as the row grows
const CAP_FRAC = [0.24, 0.2, 0.17, 0.15] // …and never overflow a narrow phone

type Round = { target: number; options: number[]; letter: string }
function newRound(level: number): Round {
  const target = randFriendIndex()
  const letter = FRIENDS[target].name[0]
  const nDecoys = OPTIONS_PER_LEVEL[level] - 1
  // decoys: any friend that is NOT the target and does NOT start with the same
  // letter (so there is exactly one right answer) — same invariant as before.
  const pool = FRIENDS.map((_, i) => i).filter((i) => i !== target && FRIENDS[i].name[0] !== letter)
  let decoys: number[]
  if (level >= 2) {
    const sim = new Set(SIMILAR[letter] ?? [])
    const near = shuffle(pool.filter((i) => sim.has(FRIENDS[i].name[0])))
    const far = shuffle(pool.filter((i) => !sim.has(FRIENDS[i].name[0])))
    decoys = [...near, ...far].slice(0, nDecoys) // closer-looking letters first
  } else {
    decoys = shuffle(pool).slice(0, nDecoys)
  }
  const options = shuffle([target, ...decoys])
  return { target, options, letter }
}

export default function WhichFriend({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game).
  const [level] = useGameLevel('letter', LEVEL_TIERS)
  const [round, setRound] = useState<Round>(() => newRound(level))
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const [solved, setSolved] = useState(false)
  const [party, setParty] = useState(false)

  const letterName = LETTER_NAMES[round.letter] ?? round.letter

  useEffect(() => {
    speak(letterName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  // switching difficulty from the header deals a fresh round at the new width
  // (skip the first render — the initial round is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    setSolved(false)
    setWrong(null)
    setRound(newRound(level))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function pick(i: number) {
    if (solved) return
    unlockAudio()
    if (i === round.target) {
      setSolved(true)
      const ns = score + 1
      setScore(ns)
      if (ns % 5 === 0) {
        playWin()
        speakNumber(ns) // calm milestone: announce the running count
        setParty(true)
        window.setTimeout(() => setParty(false), 2500)
      } else {
        playSuccess()
        speak(`${letterName}! ${friendSay(round.target)}`)
      }
      window.setTimeout(() => {
        setRound(newRound(level))
        setSolved(false)
      }, 1300)
    } else {
      setWrong(i)
      playNudge()
      window.setTimeout(() => setWrong(null), 450)
    }
  }

  const friendPx = FRIEND_PX[level]
  const capFrac = CAP_FRAC[level]

  return (
    <GameShell title={t('game.letter')} emoji="🔤" onExit={onExit} levels={{ gameId: 'letter', tiers: LEVEL_TIERS }}>
      <Confetti active={party} />
      <div className="which-head">
        <span className="score-pill" aria-label={t('bs.score', { n: score })}>
          ⭐ {score}
        </span>
      </div>

      <div className="center-body">
        <p className="which-q">{t('which.q')}</p>

        {/* the hero: the target letter carved into a BAKED wooden alphabet tile
            (crisp CSS letter over the engraved panel) + a tap-to-hear button */}
        <div className="which-prompt">
          <span className="which-tile">
            <span className="which-letter" aria-hidden="true">
              {round.letter}
            </span>
          </span>
          <button className="pill which-say" onClick={() => { playTap(); speak(letterName) }} aria-label={t('bs.replay')}>
            🔊
          </button>
        </div>

        {/* the choices, grounded on a BAKED wooden table in perspective over the
            illustrated playroom backdrop — real depth, not a flat CSS row */}
        <div className={`which-scene lvl-${level}`}>
          <SceneBackdrop src="wooden-playroom.jpg" position="center 32%" scrim="soft" />
          <span className="which-tray" aria-hidden="true" />
          <div className="which-options">
            {round.options.map((i, n) => (
              <div
                key={i}
                className={`which-opt ${wrong === i ? 'is-wrong' : ''} ${solved && i === round.target ? 'is-win' : ''}`}
                style={{ '--i': n } as React.CSSProperties}
              >
                <button className="which-pick" onClick={() => pick(i)} disabled={solved} aria-label={friendName(i)}>
                  <span className="which-friend">
                    <Friend
                      index={i}
                      scale={Math.min(friendPx * screenScale(vp.w), vp.w * capFrac) / friendMaxDim(i)}
                      showNumber={false}
                      bouncing={solved && i === round.target}
                    />
                  </span>
                  <span className="which-name">{friendName(i)}</span>
                </button>
                <button
                  className="which-hear"
                  onClick={() => {
                    unlockAudio()
                    speak(friendSay(i))
                  }}
                  aria-label={t('which.hear', { name: friendName(i) })}
                >
                  🔊
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  )
}
