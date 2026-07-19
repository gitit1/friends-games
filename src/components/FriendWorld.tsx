import { useEffect, useRef, useState } from 'react'
import GameShell from './GameShell'
import Friend from './Friend'
import IconButton from './IconButton'
import { FRIEND_NATURAL, friendKindForIndex } from './FriendArt'
import { friendGame, friendName, friendNumber, friendSay, friendSpecial, friendVoice } from '../friends'
import { decadeForNumber, decadeIndexForNumber } from '../decades'
import { FACT_VIEWS } from '../facts'
import { playCount, playFriend, playSuccess, playTap, playWin, unlockAudio } from '../audio'
import { stopSpeech } from '../speech'
import { numberWord, randInt } from '../games/util'
import { playClip, stopClip } from '../voice'
import { setBuildPreset } from '../games/buildPreset'
import { rosterCount } from '../level'
import { getSettings } from '../settings'
import { useT } from '../i18n'
import { useViewport } from '../useViewport'

// A friend's own little "world": tap into it from "החברים שלי" and the friend
// introduces itself (spoken description + animation, like a tiny narrated clip),
// and you can give it a high-five / hug / kiss, or hear it count its blocks.
//
// Each friend ALSO gets its own "special" button, themed to what that number
// loves (ice cream, a ball, a dance…): the emoji, label and motion all change
// per friend. The `like` is derived from the number (index % 12). `verb` (niqqud
// infinitive) is only the fallback TTS; the order matches scripts/gen-voice.mjs
// (intro clips + like-<n> clips), so keep the two in sync.
type Like = { verb: string; emoji: string; label: string; burst: string; motion: 'jump' | 'wiggle' | 'float' }
const LIKES: Like[] = [
  { verb: 'לִקְפּוֹץ', emoji: '🦘', label: 'קפיצה', burst: '💫', motion: 'jump' },
  { verb: 'לִרְקוֹד', emoji: '💃', label: 'ריקוד', burst: '🎵', motion: 'wiggle' },
  { verb: 'לִצְחוֹק', emoji: '😂', label: 'צחוק', burst: '😄', motion: 'wiggle' },
  { verb: 'לְהִתְחַבֵּק', emoji: '🧸', label: 'חיבוק', burst: '❤️', motion: 'jump' },
  { verb: 'לָשִׁיר', emoji: '🎤', label: 'שיר', burst: '🎶', motion: 'wiggle' },
  { verb: 'לִסְפּוֹר', emoji: '🧮', label: 'ספירה', burst: '✨', motion: 'jump' },
  { verb: 'לְשַׂחֵק מַחֲבוֹאִים', emoji: '🙈', label: 'מחבואים', burst: '✨', motion: 'float' },
  { verb: 'לֶאֱכוֹל גְּלִידָה', emoji: '🍦', label: 'גלידה', burst: '🍦', motion: 'jump' },
  { verb: 'לְצַיֵּיר', emoji: '🎨', label: 'ציור', burst: '🖍️', motion: 'wiggle' },
  { verb: 'לְהָפְרִיחַ בּוּעוֹת', emoji: '🫧', label: 'בועות', burst: '🫧', motion: 'float' },
  { verb: 'לְשַׂחֵק בְּכַדּוּר', emoji: '⚽', label: 'כדור', burst: '⚽', motion: 'jump' },
  { verb: 'לְחַלֵּק נְשִׁיקוֹת', emoji: '😘', label: 'נשיקות', burst: '💋', motion: 'jump' },
  { verb: 'לְשַׂחֵק כַּדּוּרֶגֶל', emoji: '⚽', label: 'כדורגל', burst: '⚽', motion: 'jump' },
  { verb: 'לִצְבּוֹעַ', emoji: '🖍️', label: 'צביעה', burst: '🌈', motion: 'wiggle' },
  { verb: 'לְנַגֵּן', emoji: '🎹', label: 'נגינה', burst: '🎵', motion: 'wiggle' },
  // 15+ — batch 2 activities (friends 12–20). Keep this order in sync with the
  // LIKES / INVITE arrays in scripts/gen-voice.mjs and the world.like.<n> i18n keys.
  { verb: 'לְמַיֵּן', emoji: '🧺', label: 'מיון', burst: '🌈', motion: 'wiggle' }, // 15 → sort
  { verb: 'לְשַׂחֵק זִכָּרוֹן', emoji: '🧠', label: 'זיכרון', burst: '✨', motion: 'jump' }, // 16 → memory
  { verb: 'לְשַׂחֵק בְּתַבְנִיּוֹת', emoji: '🔵', label: 'תבניות', burst: '🔵', motion: 'wiggle' }, // 17 → pattern
  { verb: 'חַיּוֹת מַחְמָד', emoji: '🐣', label: 'חיית מחמד', burst: '❤️', motion: 'jump' }, // 18 → pet
  { verb: 'לְגַלְגֵּל קֻבִּיָּה', emoji: '🎲', label: 'קובייה', burst: '✨', motion: 'jump' }, // 19 → dice
  { verb: 'לִתְפּוֹס וְלָרוּץ', emoji: '🎯', label: 'תופסים', burst: '💨', motion: 'jump' }, // 20 → catch
  { verb: 'לְשַׂחֵק כַּדּוּרְסַל', emoji: '🏀', label: 'כדורסל', burst: '⭐', motion: 'jump' }, // 21 → basket
  { verb: 'אֶת הַשָּׂפָה הָעִבְרִית', emoji: '🔤', label: 'עברית', burst: '✨', motion: 'wiggle' }, // 22 → letter (Sofi loves Hebrew)
  { verb: 'לִצְבּוֹעַ לְפִי מִסְפָּרִים', emoji: '🧩', label: 'צביעה לפי מספר', burst: '🌈', motion: 'wiggle' }, // 23 → paintnum
  // 24–37 — batch 3 activities (friends 21–34, ROSTER-PLAN.md § אצווה 3). Keep in
  // sync with the world.like.<n> i18n keys (gen-voice.mjs SPECIAL/GENDER data is
  // filled in only once these friends' voices are actually recorded).
  { verb: 'לְשַׂחֵק בְּמֵרוֹץ מְכוֹנִיּוֹת', emoji: '🏎️', label: 'מרוץ מכוניות', burst: '🏁', motion: 'jump' }, // 24 → race
  { verb: 'לְשַׂחֵק בְּעֶשָׂרוֹת וְאַחֲדוֹת', emoji: '🔟', label: 'עשרות ואחדות', burst: '🔟', motion: 'wiggle' }, // 25 → placevalue
  { verb: 'לִבְנוֹת מִסְפָּר', emoji: '🧱', label: 'בונים מספר', burst: '🧱', motion: 'jump' }, // 26 → build
  { verb: 'לְחַפֵּשׂ אֶת הַמִּסְפָּר הֶחָסֵר', emoji: '❓', label: 'המספר החסר', burst: '❓', motion: 'wiggle' }, // 27 → missing
  { verb: 'לְהַשְׁווֹת גָּדוֹל אוֹ קָטָן', emoji: '⚖️', label: 'גדול או קטן', burst: '⚖️', motion: 'wiggle' }, // 28 → bigsmall
  { verb: 'לְהַשְׁלִים אֶת הֶחָבֵר הֶחָסֵר בָּרֶצֶף', emoji: '🧩', label: 'חבר חסר ברצף', burst: '🧩', motion: 'wiggle' }, // 29 → sequence
  { verb: 'לְהַתְאִים מִסְפָּר לְכַמּוּת', emoji: '🔢', label: 'מספר וכמות', burst: '🔢', motion: 'jump' }, // 30 → quantity
  { verb: 'לְשַׂחֵק בְּמַחְשְׁבוֹן', emoji: '🧮', label: 'מחשבון', burst: '➕', motion: 'wiggle' }, // 31 → calc
  { verb: 'לְנַצֵּחַ אֶת אֶתְגַּר הַחֶשְׁבּוֹן', emoji: '🎓', label: 'אתגר חשבון', burst: '⭐', motion: 'jump' }, // 32 → challenge
  { verb: 'לְפוֹצֵץ בָּלוֹנִים שֶׁל חֲבֵרִים', emoji: '🎈', label: 'פיצוץ חברים', burst: '🎈', motion: 'jump' }, // 33 → pop
  { verb: 'לְשַׂחֵק הוֹקִי אֲוִיר', emoji: '🏒', label: 'הוקי אוויר', burst: '🏒', motion: 'jump' }, // 34 → hockey
  { verb: 'לְשַׂחֵק בָּאוֹלִינְג', emoji: '🎳', label: 'באולינג', burst: '🎳', motion: 'jump' }, // 35 → bowling
  { verb: 'לְחַבֵּר נְקֻדּוֹת', emoji: '✏️', label: 'חיבור נקודות', burst: '✏️', motion: 'wiggle' }, // 36 → dots
  { verb: 'לְצַיֵּיר מִסְפָּרִים', emoji: '✍️', label: 'מציירים מספר', burst: '✍️', motion: 'wiggle' }, // 37 → drawnum
  // 38–55 — the last registry orphans, adopted one-per-friend (friends 35–52).
  // No game is left without a friend after this point.
  { verb: 'לְהַרְכִּיב צְלִילִים לְמִלִּים', emoji: '🔊', label: 'להרכיב צליל', burst: '🔊', motion: 'wiggle' }, // 38 → blend
  { verb: 'לְסַדֵּר מַדָּפִים בַּמַּכֹּלֶת', emoji: '🛒', label: 'מכולת', burst: '🛒', motion: 'wiggle' }, // 39 → sortshelf
  { verb: 'לְנַהֵג בְּרַכֶּבֶת מִסְפָּרִים', emoji: '🚂', label: 'רכבת מספרים', burst: '🚂', motion: 'jump' }, // 40 → train
  { verb: 'לְשַׂחֵק בְּאוֹתִיּוֹת חַיּוֹת', emoji: '🆎', label: 'אותיות חיות', burst: '🔤', motion: 'wiggle' }, // 41 → spell
  { verb: 'לִבְלוֹעַ הַכֹּל', emoji: '🕳️', label: 'בולעים הכול', burst: '💫', motion: 'jump' }, // 42 → hole
  { verb: 'לִמְצוֹא בְּאֵיזוֹ אוֹת מַתְחִיל', emoji: '🔡', label: 'באיזו אות', burst: '🔡', motion: 'wiggle' }, // 43 → firstletter
  { verb: 'לְמַיֵּן מַטְבְּעוֹת', emoji: '🪙', label: 'מטבעות חברים', burst: '🪙', motion: 'wiggle' }, // 44 → coinsort
  { verb: 'לְשַׂחֵק בַּקֻּפָּה', emoji: '🏪', label: 'קופה', burst: '🛍️', motion: 'wiggle' }, // 45 → shop
  { verb: 'לְתַכְנֵן אֶת סֵדֶר הַיּוֹם', emoji: '📋', label: 'סדר יום', burst: '📋', motion: 'wiggle' }, // 46 → schedule
  { verb: 'לִגְדּוֹל וּלְהִגָּמֵל מֵחִתּוּל', emoji: '🚽', label: 'גמילה מטיטול', burst: '⭐', motion: 'jump' }, // 47 → potty
  { verb: 'לְהַאֲכִיל חַיּוֹת', emoji: '🐾', label: 'מאכילים חיות', burst: '🐾', motion: 'jump' }, // 48 → feedanimals
  { verb: 'לְגַדֵּל פְּרָחִים בַּגִּנָּה', emoji: '🌱', label: 'גינה', burst: '🌸', motion: 'float' }, // 49 → garden
  { verb: 'לְחָרֵז מִלִּים', emoji: '🎡', label: 'מכונת חרוזים', burst: '🎵', motion: 'wiggle' }, // 50 → rhyme
  { verb: 'לִסְפּוֹר בְּאַנְגְּלִית', emoji: '🔢', label: 'ספירה באנגלית', burst: '🔢', motion: 'jump' }, // 51 → encount
  { verb: 'לְצַיֵּיר אוֹת חַיָּה', emoji: '✏️', label: 'לצייר אות חיה', burst: '✏️', motion: 'wiggle' }, // 52 → trace
  { verb: 'לֶאֱפוֹת עוּגָה', emoji: '🎂', label: 'מכינים עוגה', burst: '🎂', motion: 'jump' }, // 53 → cake
  { verb: 'לְבַקֵּשׁ עֶזְרָה כְּשֶׁצָּרִיךְ', emoji: '🙋', label: 'מבקשים עזרה', burst: '⭐', motion: 'wiggle' }, // 54 → help
  { verb: 'לְדַבֵּר עַל רְגָשׁוֹת', emoji: '💚', label: 'איך אני מרגיש', burst: '💚', motion: 'float' }, // 55 → feelings
]

type Fx = { id: number; emoji: string; x: number }

// Visual number facts about a friend, shown in big digits (Assaf reads numbers,
// so this needs no voice). Each friend gets the handful that apply to its number;
// the ✨ button cycles through them. `big` is rendered LTR like a number line.
type Fact = { label: string; big: string }
function factsFor(n: number): Fact[] {
  const out: Fact[] = []
  if (n >= 10) {
    const tens = Math.floor(n / 10) * 10
    const ones = n % 10
    out.push(ones === 0 ? { label: 'עשרות', big: `${n / 10} × 10 = ${n}` } : { label: 'עשרות ואחדות', big: `${tens} + ${ones} = ${n}` })
  }
  if (n % 2 === 0) out.push({ label: 'זוגי', big: `${n / 2} + ${n / 2} = ${n}` })
  else if (n >= 3) out.push({ label: 'אי-זוגי', big: `${n - 1} + 1 = ${n}` })
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) {
      out.push({ label: 'כפל', big: `${d} × ${n / d} = ${n}` })
      break
    }
  }
  if (n === 1) out.push({ label: 'הראשון!', big: `1 → 2` })
  else if (n === 100) out.push({ label: 'מאה!', big: `99 → 100` })
  else if (n >= 2) out.push({ label: 'השכנים', big: `${n - 1} → ${n} → ${n + 1}` })
  return out
}

export default function FriendWorld({
  index,
  quiet,
  onExit,
  onNavigate,
  onPlayGame,
}: {
  index: number
  quiet?: boolean // true only when returning from a game → don't replay the intro (paging ◀▶ DOES narrate)
  onExit: () => void
  onNavigate: (index: number) => void
  onPlayGame: (gameId: string) => void
}) {
  const { t } = useT()
  const vp = useViewport()
  const n = friendNumber(index)
  const decadeIdx = decadeIndexForNumber(n)
  const decade = decadeForNumber(n)
  const total = rosterCount()
  // browse to the friend before / after this one, wrapping around the whole
  // cast so there's never a dead-end (no disabled buttons to puzzle a child).
  // Cut off any running count/narration on the spot so it doesn't bleed into the
  // next friend (the effect cleanup also does this, but stop it synchronously too).
  const leave = () => {
    clearTimers()
    stopClip()
    stopSpeech()
    setLit(undefined)
  }
  const goPrev = () => {
    leave()
    playTap()
    onNavigate((index - 1 + total) % total)
  }
  const goNext = () => {
    leave()
    playTap()
    onNavigate((index + 1) % total)
  }
  const [bounce, setBounce] = useState(false)
  const [action, setAction] = useState<'five' | 'hug' | 'kiss' | null>(null)
  const [kissFx, setKissFx] = useState(false)
  const [motion, setMotion] = useState<string | null>(null)
  const [lit, setLit] = useState<number | undefined>(undefined)
  // "who am I made of": the friend splits into two SMALLER friends that add up
  // to it (c → a + b). This is the friend's identity (passive, friend-faced),
  // distinct from the "Build a Number" GAME which composes (a + b → c).
  const [split, setSplit] = useState<{ a: number; b: number } | null>(null)
  // "what's special about me": cycles through visual number facts (index, or null)
  // visual facts ALIGNED to the recorded audio lines (so the ✨ button shows and
  // says the same fact); friends without recordings fall back to the generic set
  const facts = FACT_VIEWS[index] ?? factsFor(n)
  const [fact, setFact] = useState<number | null>(null)
  // after the special button is tapped, a "go to the matching game" CTA appears
  const [gameLink, setGameLink] = useState(false)
  const like = LIKES[friendSpecial(index)]
  const voice = friendVoice(index) // the recorded voice for this friend (shared buttons use it)
  const [fx, setFx] = useState<Fx[]>([])
  const timers = useRef<number[]>([])
  const fxId = useRef(0)

  // "living face": the pupils follow the finger/cursor. We set --gaze-x/y straight
  // on the stage DOM (no re-render per move); the friends inside inherit it, and a
  // CSS transition on the pupil makes the look smooth. Eyes re-centre when idle.
  const stageRef = useRef<HTMLDivElement>(null)
  function aimGaze(e: { clientX: number; clientY: number }) {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)))
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.42)) / (r.height / 2)))
    el.style.setProperty('--gaze-x', `${nx * 38}%`)
    el.style.setProperty('--gaze-y', `${ny * 32}%`)
  }
  function centerGaze() {
    stageRef.current?.style.setProperty('--gaze-x', '0%')
    stageRef.current?.style.setProperty('--gaze-y', '0%')
  }

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  function describe() {
    setSplit(null) // "say it again" re-assembles a split / fact friend
    setFact(null)
    setGameLink(false) // any non-special action hides the "go to the game" CTA
    // Short, exclamatory sentences = energy. No colour (many friends are multi-coloured).
    // The decade name only reaches the CHILD'S EAR when this is the fallback
    // TTS (i.e. the friend's real recorded intro clip is still missing) — once
    // a clip is recorded for this friend, playClip() plays it and this string
    // is never spoken; it's kept in sync purely so the eventual recording has
    // the line ready.
    const about = `שָׁלוֹם!! אֲנִי ${friendSay(index)}, הַמִּסְפָּר ${numberWord(n)}, מֵעֲשִׂירִיַּת ${decade.say}! אֲנִי מַמָּשׁ אוֹהֵב ${like.verb}! בּוֹאוּ לְשַׂחֵק יַחַד!`
    playClip(`intro-${index}`, about)
    setBounce(true)
    later(() => setBounce(false), 600)
  }

  // narrate on entry (and whenever you switch friend); when the friend changes
  // we also cut off the previous one's narration so they don't talk over it
  useEffect(() => {
    unlockAudio()
    setSplit(null) // a fresh friend starts whole
    setFact(null)
    setGameLink(false)
    centerGaze()
    // narrate the intro on a fresh entry from the friends list AND when paging
    // ◀▶ to another friend — only returning from a game stays quiet
    if (!quiet) {
      const id = window.setTimeout(describe, 350)
      timers.current.push(id)
    }
    return () => {
      clearTimers()
      stopClip()
      stopSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function burst(emoji: string, count = 7) {
    // cluster around the centre (the friend) so hearts/sparkles feel like they
    // come FROM the friend, not scattered across the whole width
    const items: Fx[] = Array.from({ length: count }, () => ({
      id: fxId.current++,
      emoji,
      x: 38 + Math.floor(Math.random() * 24),
    }))
    setFx((f) => [...f, ...items])
    const ids = new Set(items.map((i) => i.id))
    later(() => setFx((f) => f.filter((x) => !ids.has(x.id))), 1300)
  }

  // trigger a one-shot gesture (arms + pseudo-3D lean) on the friend
  function doAction(a: 'five' | 'hug' | 'kiss') {
    setSplit(null) // gestures act on the whole friend, so re-assemble first
    setFact(null)
    setGameLink(false) // tapping a gesture hides the "go to the game" CTA
    setAction(a)
    later(() => setAction(null), 1000)
  }
  function five() {
    unlockAudio()
    doAction('five')
    burst('🙌')
    playSuccess()
    playClip(`fx-five-${voice}`, 'כיף!')
  }
  function hug() {
    unlockAudio()
    doAction('hug')
    burst('❤️')
    playFriend(index)
    playClip(`fx-hug-${voice}`, 'חיבוק גדול!')
  }
  function kiss() {
    unlockAudio()
    doAction('kiss')
    setKissFx(true)
    later(() => setKissFx(false), 950)
    playFriend(index)
    playClip(`fx-kiss-${voice}`, 'מְמְמוּאָה! נשיקה!')
  }
  // the friend's OWN button: it does its favourite thing (themed emoji + motion)
  function special() {
    unlockAudio()
    setSplit(null)
    setFact(null)
    setMotion(like.motion)
    later(() => setMotion(null), 1000)
    burst(like.burst, 9)
    playSuccess()
    playFriend(index)
    // one of the friend's 3 recorded "special" lines, at random, in its own voice
    playClip(`special-${index}-${randInt(0, 2)}`, like.label)
    setGameLink(true) // reveal the "go to the matching game" button (if it has one)
  }
  function count() {
    unlockAudio()
    clearTimers()
    stopClip()
    setSplit(null)
    setFact(null)
    setGameLink(false)
    setLit(0)
    // Accelerate by size: small numbers stay calm (~900ms/block); bigger numbers
    // speed up so the whole count finishes in ~16s no matter how big (friend 100
    // was 90s!). Each block still lights up + chimes; once the pace gets quick we
    // drop the spoken per-block number (it would just stutter) and keep the tone.
    // The total is always announced at the end.
    const STEP = Math.max(150, Math.min(900, Math.round(16000 / n)))
    const speakEach = STEP >= 500
    for (let i = 1; i <= n; i++) {
      later(() => {
        setLit(i)
        playCount(i)
        // count in THIS friend's own voice (num-<i>-<Voice>), so e.g. טוקי counts
        // 1,2 all in Erez — not mixed with each number's own friend's voice
        if (speakEach) playClip(`num-${i}-${voice}`, numberWord(i))
      }, i * STEP)
    }
    later(() => {
      setLit(undefined)
      playWin()
      // only announce the total here when the loop DIDN'T speak it (big numbers) —
      // otherwise the last number would be said twice
      if (!speakEach) playClip(`num-${n}-${voice}`, numberWord(n))
    }, n * STEP + 500)
  }

  // "what am I made of?" — split into two friends a + b = n (a fresh split each
  // tap). 1 is indivisible, so it just gives a happy wiggle instead.
  function decompose() {
    unlockAudio()
    clearTimers()
    stopClip()
    setLit(undefined)
    setMotion(null)
    setFact(null)
    setGameLink(false)
    if (n < 2) {
      setBounce(true)
      later(() => setBounce(false), 600)
      playFriend(index)
      return
    }
    let a = randInt(1, n - 1)
    if (split && a === split.a && n > 2) a = (a % (n - 1)) + 1 // avoid repeating
    setSplit({ a, b: n - a })
    playSuccess()
  }
  // tap the friend itself — it gives a happy little jump + sparkles + says its
  // own number (in the recorded voice). Direct, immediate, no button needed.
  const PATS = ['jump', 'wiggle', 'float']
  function pat() {
    unlockAudio()
    clearTimers()
    stopClip()
    setSplit(null)
    setFact(null)
    setGameLink(false)
    setLit(undefined)
    setMotion(PATS[Math.floor(Math.random() * PATS.length)])
    later(() => setMotion(null), 900)
    burst('✨', 5)
    playFriend(index)
    playClip(`num-${n}`, numberWord(n))
  }
  // "what's special about me": show a visual fact, cycling to the next on each tap
  function showFact() {
    unlockAudio()
    clearTimers()
    stopClip()
    setSplit(null)
    setLit(undefined)
    setMotion(null)
    setGameLink(false)
    // cycle through the levels up to the child's difficulty; the VISUAL fact shown
    // and the SPOKEN clip are the SAME level, so they ALWAYS match (כפל shows × and
    // says ×, etc.). קל hears only the simplest; אלוף cycles all four. Missing clip
    // → silent fallback, so only recorded friends speak.
    const maxL = Math.min(getSettings().difficulty, facts.length - 1)
    const nextL = fact === null ? 0 : (fact + 1) % (maxL + 1)
    setFact(nextL)
    playSuccess()
    playClip(`fact-${index}-${nextL}`, '')
  }
  // bridge to the "Build a Number" game. If the current split is buildable there
  // (both parts ≤ 10), pre-load it so "build me!" literally rebuilds this friend.
  function goBuild() {
    playTap()
    if (split && split.a <= 10 && split.b <= 10) setBuildPreset({ a: split.a, b: split.b })
    onPlayGame('build')
  }

  // Size every friend to the SAME HEIGHT (a consistent character size) regardless
  // of how wide its number-shape is — normalise by natural HEIGHT, not the max
  // dimension, so לולו (1 block, square) and טוקי (2 blocks, wide) match instead of
  // לולו towering. Capped by stage width too, so a wide friend never overflows.
  const nat = FRIEND_NATURAL[friendKindForIndex(index)]
  const scale = Math.min((vp.h * 0.17) / nat.h, (vp.w * 0.8) / nat.w)
  // the two split friends share one scale (so 3 still looks smaller than 4),
  // sized so the larger one fits with both side by side AND the equation + button
  // still leave the action buttons visible
  // the two split friends share one scale, normalised by HEIGHT (like the main
  // friend) and kept SMALLER than it, so they sit under the equation without
  // overlapping it and both fit side by side
  const splitH = (idx: number) => FRIEND_NATURAL[friendKindForIndex(idx)].h
  const splitW = (idx: number) => FRIEND_NATURAL[friendKindForIndex(idx)].w
  const splitNatH = split ? Math.max(splitH(split.a - 1), splitH(split.b - 1)) : 1
  const splitNatW = split ? Math.max(splitW(split.a - 1), splitW(split.b - 1)) : 1
  const splitScale = Math.min((vp.h * 0.082) / splitNatH, (vp.w * 0.28) / splitNatW)

  return (
    <GameShell title={friendName(index)} emoji="⭐" onExit={onExit}>
      <div className="world-screen">
        {/* the friend's decade "family" — pure identity, next to nothing to tap.
            Muted tint only (color-mix keeps it subtle, never a solid fill). */}
        <p className="world-decade" style={{ '--dc': decade.color } as React.CSSProperties}>
          <span aria-hidden="true">{decade.emoji}</span> {t(`decade.${decadeIdx}`)} · {n}
        </p>
        {/* a number-line pager: ◀ (lower number) · the number we're on · ▶ (higher).
            direction:ltr (in CSS) keeps ◀ on the left and ▶ on the right so it
            reads like the number line, in both languages. */}
        <div className="world-nav">
          <IconButton icon="◀" label={t('nav.prev')} onClick={goPrev} />
          <span className="world-nav-num" aria-hidden="true">{n}</span>
          <IconButton icon="▶" label={t('nav.next')} onClick={goNext} />
        </div>

        <div
          className="world-stage"
          ref={stageRef}
          onPointerMove={aimGaze}
          onPointerLeave={centerGaze}
          onPointerUp={centerGaze}
          onPointerCancel={centerGaze}
        >
          {split ? (
            // "who am I made of": equation in big digits (he reads numbers!) + the
            // two real friends it's built from, with a bridge to build it for real
            <div className="world-split" key={`${split.a}-${split.b}`}>
              {/* the familiar addition form: parts first, then the whole
                  (1 + 1 = 2), left-to-right like any equation */}
              <div className="world-split-eq" aria-live="polite" dir="ltr">
                <span>{split.a}</span>
                <span className="wse-sym">+</span>
                <span>{split.b}</span>
                <span className="wse-sym">=</span>
                <span className="wse-whole">{n}</span>
              </div>
              <div className="world-split-friends">
                <Friend index={split.a - 1} scale={splitScale} showNumber lively />
                <span className="world-split-plus" aria-hidden="true">＋</span>
                <Friend index={split.b - 1} scale={splitScale} showNumber lively />
              </div>
              <button className="pill world-build-link" onClick={goBuild}>
                🧮 {t('world.build')}
              </button>
            </div>
          ) : fact !== null ? (
            // a visual number fact in big digits, with the friend beneath it
            <div className="world-fact" key={fact}>
              <span className="wf-label">{facts[fact].label}</span>
              <span className="wf-big" dir="ltr">{facts[fact].big}</span>
              <div className="wf-friend">
                <Friend index={index} scale={scale * 0.42} showNumber lively />
              </div>
            </div>
          ) : (
            <button
              className={`world-friend ${motion ? `motion-${motion}` : ''}`}
              onClick={pat}
              aria-label={friendName(index)}
            >
              <Friend index={index} scale={scale} showNumber bouncing={bounce} litUnits={lit} lively action={action} />
            </button>
          )}
          {kissFx && (
            <span className="world-kiss" aria-hidden="true">
              💋
            </span>
          )}
          <div className="world-fx-layer" aria-hidden="true">
            {fx.map((f) => (
              <span key={f.id} className="world-fx" style={{ left: `${f.x}%` }}>
                {f.emoji}
              </span>
            ))}
          </div>
        </div>

        <div className="world-actions">
          <button className="world-btn world-btn-special" onClick={special}>
            <span className="world-btn-emoji" aria-hidden="true">{like.emoji}</span>
            <span>{t(`world.like.${friendSpecial(index)}`)}</span>
          </button>
          <button className="world-btn" onClick={five}>
            <span className="world-btn-emoji" aria-hidden="true">✋</span>
            <span>{t('world.five')}</span>
          </button>
          <button className="world-btn" onClick={hug}>
            <span className="world-btn-emoji" aria-hidden="true">🤗</span>
            <span>{t('world.hug')}</span>
          </button>
          <button className="world-btn" onClick={kiss}>
            <span className="world-btn-emoji" aria-hidden="true">😘</span>
            <span>{t('world.kiss')}</span>
          </button>
          <button className="world-btn" onClick={count}>
            <span className="world-btn-emoji" aria-hidden="true">🔢</span>
            <span>{t('world.count')}</span>
          </button>
          {n >= 2 && (
            <button className={`world-btn ${split ? 'world-btn-on' : ''}`} onClick={decompose}>
              <span className="world-btn-emoji" aria-hidden="true">🧩</span>
              <span>{t('world.split')}</span>
            </button>
          )}
          <button className={`world-btn ${fact !== null ? 'world-btn-on' : ''}`} onClick={showFact}>
            <span className="world-btn-emoji" aria-hidden="true">✨</span>
            <span>{t('world.fact')}</span>
          </button>
          <button className="world-btn" onClick={describe}>
            <span className="world-btn-emoji" aria-hidden="true">🔊</span>
            <span>{t('world.again')}</span>
          </button>
        </div>

        {gameLink && friendGame(index) && (
          <button className="world-cta" onClick={() => { playTap(); onPlayGame(friendGame(index)!) }}>
            <span className="world-cta-emoji" aria-hidden="true">{like.emoji}</span>
            <span>{t('world.toGame')}</span>
          </button>
        )}
      </div>
    </GameShell>
  )
}
