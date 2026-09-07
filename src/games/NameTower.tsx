import { useMemo, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import Friend from '../components/Friend'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendMaxDim } from '../components/FriendArt'
import { BASE_LETTERS, LETTER_BY_CH, LETTER_NAME, letterNameClip } from './LetterTalk'
import { friendName, friendSay } from '../friends'
import { useT } from '../i18n'
import { playPop, playClap, playSuccess, unlockAudio } from '../audio'
import { speak } from '../speech'
import { playClip } from '../voice'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import { screenScale, useViewport } from '../useViewport'
import type { GameProps } from './registry'

// "מגדל השם שלי" — build a name, letter by letter, as a tower of blocks. A ghost
// tower (dashed outlines, bottom-up = first letter at the BOTTOM) shows the goal;
// below sits a tray of googly letter-blocks (the shared LetterGuy). Tap the next
// needed letter → the block flies up in a gentle arc, settles with a bounce, and
// its NAME is spoken. Distractor taps only wiggle (errorless — no penalty). When
// the tower is whole the name is spoken warmly ("אָסָף!"), the tower gives one
// proud wiggle, a calm celebration plays, and — if the name is a friend's — that
// friend pops up and claps.
//
// Hebrew note: the name READS right-to-left but the tower BUILDS bottom-up, so the
// finished-so-far name is shown horizontally (RTL) above the tower as each block
// lands — reading order stays correct while the stack grows upward.

type NameDef = { text: string; say: string; friend?: number }

// Cumulative tiers (game rule): קל = 2–3 letters · בינוני = + 4-letter names ·
// קשה = + 5-letter-and-up. אלוף is special: the child picks any friend and builds
// THEIR name (handled below). Friend-linked names make the celebration extra warm.
const EASY: NameDef[] = [
  { text: 'אסף', say: 'אָסָף' }, // his own name — always first
  { text: 'שיר', say: 'שִׁיר', friend: 48 },
  { text: 'זיו', say: 'זִיו', friend: 59 },
  { text: 'דנה', say: 'דָּנָה', friend: 49 },
  { text: 'נטי', say: 'נָטִי', friend: 57 },
  { text: 'טל', say: 'טַל' },
  { text: 'גל', say: 'גַּל' },
  { text: 'רון', say: 'רוֹן' },
  { text: 'נעם', say: 'נֹעַם' },
]
const MED: NameDef[] = [
  { text: 'לולו', say: 'לוּלוּ', friend: 0 },
  { text: 'בובי', say: 'בּוּבִּי', friend: 2 },
  { text: 'גוגו', say: 'גוּגוּ', friend: 3 },
  { text: 'דובי', say: 'דּוּבִּי', friend: 4 },
  { text: 'נוני', say: 'נוּנִי', friend: 5 },
  { text: 'רומי', say: 'רוֹמִי', friend: 20 },
  { text: 'רוני', say: 'רוֹנִי', friend: 16 },
  { text: 'מומו', say: 'מוֹמוֹ', friend: 12 },
  { text: 'מאיה', say: 'מָאיָה', friend: 99 },
  { text: 'נועה', say: 'נֹעָה' },
]
const HARD: NameDef[] = [
  { text: 'ליאור', say: 'לִיאוֹר' },
  { text: 'יונתן', say: 'יוֹנָתָן' },
  { text: 'הודיה', say: 'הוֹדִיָּה' },
  { text: 'שירלי', say: 'שִׁירְלִי' },
  { text: 'אביחי', say: 'אֲבִיחַי' },
  { text: 'אביגיל', say: 'אֲבִיגַיִל' },
]
const TIERS: NameDef[][] = [EASY, MED, HARD]
const POOLS = TIERS.map((_, i) => TIERS.slice(0, i + 1).flat())

// Recorded clips exist only for the non-friend "family" names (friend-linked
// names like לולו/שיר already have a full INTRO sentence recorded, but not an
// isolated one-word clip — see docs/plan-2026-07/voice-lines-needed.md § "מגדל
// השם שלי"). Friend names keep falling back to browser TTS here until they get
// a dedicated word clip too.
const FAMILY_NAME_CLIP: Record<string, string> = {
  'אָסָף': 'name-asaf', 'טַל': 'name-tal', 'גַּל': 'name-gal', 'רוֹן': 'name-ron', 'נֹעַם': 'name-noam',
  'נֹעָה': 'name-noa',
  'לִיאוֹר': 'name-lior', 'יוֹנָתָן': 'name-yonatan', 'הוֹדִיָּה': 'name-hodaya',
  'שִׁירְלִי': 'name-shirli', 'אֲבִיחַי': 'name-avichai', 'אֲבִיגַיִל': 'name-avigail',
}
function sayName(text: string) {
  const id = FAMILY_NAME_CLIP[text]
  if (id) playClip(id, text)
  else speak(text)
}

// The mini-roster the child picks from at the אלוף tier (a warm mix of the
// original friends + a couple of short-named ones).
const PICKER_FRIENDS = [0, 2, 3, 4, 5, 8, 9, 12, 16, 20, 48, 59]

const glyphs = (name: string) => [...name] // Hebrew letters are single code points

// The tower is built from BAKED wooden toy alphabet blocks (3/4 view, real bevel,
// grain, baked light/AO — public/art/sprites/nametower/block-*.png). The Hebrew
// letter itself stays crisp CSS TEXT engraved on the block's cream plate, so it is
// razor-legible at any size and one sprite per tint serves every letter.
const NT_ART = import.meta.env.BASE_URL + 'art/sprites/nametower/'
const NT_TINTS = ['maple', 'sage', 'blue', 'clay', 'mustard', 'rose'] as const
// each letter keeps the same wood tint every time → a consistent little block
const tintFor = (ch: string) => NT_TINTS[(ch.codePointAt(0) ?? 0) % NT_TINTS.length]

function BlockLetter({ ch }: { ch: string }) {
  return (
    <span className="nt-cube" style={{ backgroundImage: `url("${NT_ART}block-${tintFor(ch)}.png")` }}>
      <span className="nt-glyph" dir="rtl">{ch}</span>
    </span>
  )
}

function randOf<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)]
}
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Tray = the name's distinct letters + 1–2 distractors (letters not in the name).
function makeTray(name: string): string[] {
  const unique = [...new Set(glyphs(name))]
  const distractCount = unique.length <= 3 ? 2 : 1
  const options = BASE_LETTERS.map((l) => l.ch).filter((c) => !unique.includes(c))
  const tray = unique.slice()
  let guard = 0
  while (tray.length < unique.length + distractCount && guard++ < 200) {
    const c = randOf(options)
    if (!tray.includes(c)) tray.push(c)
  }
  return shuffle(tray)
}

export default function NameTower({ onExit }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const level = levelForTier([0, 1, 2, 3], getSettings().difficulty)
  const pickMode = level === 3
  const pool = POOLS[Math.min(level, 2)]

  // one initial name → both states derive from it (no double-random mismatch)
  const initial = useMemo(() => (pickMode ? null : randOf(pool)), [])
  const [name, setName] = useState<NameDef | null>(initial)
  const [tray, setTray] = useState<string[]>(() => (initial ? makeTray(initial.text) : []))
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [wiggle, setWiggle] = useState<string | null>(null) // a distractor being tapped
  const [built, setBuilt] = useState(0) // towers finished (the score pill)
  const advanceRef = useRef<number | null>(null) // pending auto-advance after a finish

  const letters = name ? glyphs(name.text) : []
  const nextCh = letters[step]

  function load(def: NameDef) {
    setName(def)
    setTray(makeTray(def.text))
    setStep(0)
    setDone(false)
    setWiggle(null)
  }

  function nextName() {
    unlockAudio()
    if (advanceRef.current) {
      window.clearTimeout(advanceRef.current)
      advanceRef.current = null
    }
    if (pickMode) {
      // back to the friend picker
      setName(null)
      setDone(false)
      setStep(0)
      return
    }
    let d = randOf(pool)
    while (pool.length > 1 && d === name) d = randOf(pool)
    load(d)
  }

  function pickFriend(i: number) {
    unlockAudio()
    load({ text: friendName(i), say: friendSay(i), friend: i })
  }

  function tapBlock(ch: string) {
    if (done || !name) return
    unlockAudio()
    if (ch !== nextCh) {
      // errorless: a gentle wiggle, nothing else
      setWiggle(ch)
      window.setTimeout(() => setWiggle((w) => (w === ch ? null : w)), 460)
      return
    }
    playPop()
    const l = LETTER_BY_CH[ch] // the letter's NAME as the block settles
    if (l) playClip(letterNameClip(l), l.name)
    else speak(LETTER_NAME[ch] ?? ch)
    const next = step + 1
    setStep(next)
    if (next >= letters.length) {
      // tower complete → warm celebration
      setDone(true)
      setBuilt((b) => b + 1)
      window.setTimeout(() => {
        sayName(name.say)
        playClap()
        playSuccess()
      }, 520)
      // admire the finished tower, then flow on (a new name, or back to the picker)
      advanceRef.current = window.setTimeout(() => {
        advanceRef.current = null
        nextName()
      }, 4200)
    }
  }

  // celebration friend size (only when the finished name is a friend's)
  const friendIx = name?.friend
  const friendScale =
    friendIx != null ? Math.min(112 * screenScale(vp.w), vp.w * 0.32) / friendMaxDim(friendIx) : 1

  return (
    <GameShell title={t('game.nametower')} emoji="🏗️" onExit={onExit}>
      <Confetti active={done} calm />

      <div className="score-pill" aria-label={t('nt.score', { n: built })}>
        <span aria-hidden="true">🏗️</span> {built}
      </div>

      {pickMode && !name ? (
        // אלוף — the child picks whose name to build
        <div className="center-body nt-picker">
          <SceneBackdrop src="wooden-playroom.jpg" position="center 32%" scrim="strong" />
          <p className="nt-hint">{t('nt.pick')}</p>
          <div className="nt-picker-grid">
            {PICKER_FRIENDS.map((i) => (
              <button key={i} className="nt-pick-friend" onClick={() => pickFriend(i)} aria-label={friendName(i)}>
                {/* compact colour-blob in the picker grid (audit: "small images in
                    picker") — the child picks by the NAME shown below each, so the
                    picker↔tower transition no longer rebuilds 12 full friends. */}
                <Friend index={i} scale={64 / friendMaxDim(i)} showNumber={false} compact />
                <span className="nt-pick-name" dir="rtl">{friendName(i)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="center-body nt-wrap">
          <p className="nt-hint">{done ? ' ' : t('nt.hint')}</p>

          {/* the name so far, read RTL above the tower (built letters solid, rest dashed) */}
          <div className="nt-name" dir="rtl" aria-hidden="true">
            {letters.map((ch, i) => (
              <span key={i} className={`nt-name-ch${i < step ? ' is-set' : ''}`}>
                {i < step ? ch : '־'}
              </span>
            ))}
          </div>

          {/* the playroom scene: a baked backdrop + a warm wooden SHELF the tower
              stands on. The tower is column-reverse so the FIRST letter sits at the
              bottom and the stack grows upward, grounded on the shelf. */}
          <div className="nt-scene">
            <SceneBackdrop src="wooden-playroom.jpg" position="center 30%" scrim="soft" />
            <div className={`nt-tower${done ? ' is-proud' : ''}`}>
              {letters.map((ch, i) => (
                <span className="nt-slot" key={i}>
                  {i < step ? (
                    <span className={`nt-block${i === step - 1 ? ' is-new' : ''}`}>
                      <BlockLetter ch={ch} />
                    </span>
                  ) : (
                    <span className="nt-ghost" aria-hidden="true" />
                  )}
                </span>
              ))}
            </div>

            {/* the celebrating friend (only for friend names) — grounded on the shelf */}
            {done && friendIx != null && (
              <div className="nt-friend">
                <Friend index={friendIx} scale={friendScale} showNumber={false} lively bouncing />
              </div>
            )}

            <img className="nt-shelf" src={NT_ART + 'shelf.png'} alt="" aria-hidden="true" draggable={false} />
          </div>

          {/* the tray of letter blocks to choose from */}
          {!done && (
            <div className="nt-tray">
              {tray.map((ch, i) => (
                <button
                  key={`${ch}-${i}`}
                  className={`nt-tile${wiggle === ch ? ' is-wiggle' : ''}`}
                  onClick={() => tapBlock(ch)}
                  aria-label={LETTER_NAME[ch] ?? ch}
                >
                  <BlockLetter ch={ch} />
                </button>
              ))}
            </div>
          )}

          <div className="nt-controls">
            <button
              className="nt-hear btn-utility"
              onClick={() => {
                unlockAudio()
                if (!name) return
                if (step > 0) speak(letters.slice(0, step).join(''))
                else sayName(name.say)
              }}
              aria-label={t('bs.replay')}
            >
              🔊
            </button>
            <button className="btn-primary nt-next" onClick={nextName}>
              {pickMode ? t('nt.another') : t('nt.new')}
            </button>
          </div>
        </div>
      )}
    </GameShell>
  )
}
