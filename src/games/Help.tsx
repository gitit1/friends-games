import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import Friend from '../components/Friend'
import { friendName } from '../friends'
import { useT } from '../i18n'
import { playTap, playPop, playSuccess, unlockAudio } from '../audio'
import { speak } from '../speech'
import { playClip } from '../voice'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import type { GameProps } from './registry'

// "מבקשים עזרה" — a calm, NO-FAIL Functional-Communication-Training game.
//   A friend hits a gentle snag (a jar won't open, a puzzle piece is stuck…) and
//   shows RISING frustration as a soft green→yellow Zones ring — never a meltdown.
//   Two big pictogram cards appear: עזרה ✋ and הפסקה 🛑. Both are ALWAYS correct:
//     • עזרה → the friend says "אני צריך עזרה בבקשה", a helper walks in at once and
//              the problem visibly resolves — the request WORKS, instantly, every time.
//     • הפסקה → the friend says "אני צריך הפסקה", goes to a cosy cushion, breathes
//              two slow cycles, returns calm, and then solves it himself.
//   Then a MIRROR round: the child's own avatar-friend faces a snag and the child
//   taps the card for himself. Cumulative difficulty (קל/בינוני/קשה/אלוף).

type SnagKind = 'jar' | 'puzzle' | 'shoe' | 'tower' | 'shelf'
type Phase = 'snag' | 'chooseWho' | 'helping' | 'break' | 'solved'
type Via = 'help' | 'break' | null

// cumulative difficulty (house rule: each level serves its snags + all below).
const LEVEL_SNAGS: SnagKind[][] = [['jar', 'puzzle'], ['shoe'], ['tower'], ['shelf']]
const SNAG_POOLS = LEVEL_SNAGS.map((_, i) => LEVEL_SNAGS.slice(0, i + 1).flat())
const ROUND_COUNT = [2, 4, 5, 6] // last round of each session is the mirror round
const TRY_ALONE = [false, false, true, true] // קשה/אלוף: the friend first tries alone
const CHOOSE_WHO = [false, false, false, true] // אלוף: 2-step — pick WHO to ask

type Round = {
  snag: SnagKind
  owner: number // friend index facing the snag (mirror round → the child's avatar)
  helper: number // the friend who comes to help
  whoOptions: number[] | null // אלוף: two candidate helpers to choose between
  isMirror: boolean
  tryAlone: boolean
}

function pickSnag(pool: SnagKind[], not?: SnagKind): SnagKind {
  const opts = pool.filter((s) => s !== not)
  return opts[Math.floor(Math.random() * opts.length)] ?? pool[0]
}

function buildSession(level: number, me: number): Round[] {
  const pool = SNAG_POOLS[level]
  const count = ROUND_COUNT[level]
  const rounds: Round[] = []
  let prev: SnagKind | undefined
  for (let i = 0; i < count; i++) {
    const isMirror = i === count - 1
    const snag = pickSnag(pool, prev)
    prev = snag
    const owner = isMirror ? me : me + 1 + i
    const helper = owner + 3
    rounds.push({
      snag,
      owner,
      helper,
      whoOptions: CHOOSE_WHO[level] ? [helper, owner + 6] : null,
      isMirror,
      tryAlone: TRY_ALONE[level],
    })
  }
  return rounds
}

// ── the snag props — simple, calm SVGs that visibly "resolve" when `solved` ──
const INK = '#4b3b3d'
function Snag({ kind, solved }: { kind: SnagKind; solved: boolean }) {
  const st = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const T = (on: string, off: string) => ({ transform: solved ? on : off, transition: 'transform 0.5s ease' })
  return (
    <span className={`help-snag ${solved ? 'is-solved' : ''}`}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {kind === 'jar' && (
          <g>
            <rect x="28" y="40" width="44" height="48" rx="11" fill="#cfe6df" {...st} />
            <rect x="35" y="56" width="30" height="20" rx="4" fill="#eef6f2" {...st} strokeWidth={2} />
            <g style={T('translateY(-18px)', 'none')}>
              <rect x="25" y="30" width="50" height="15" rx="6" fill="#d9b36b" {...st} />
            </g>
          </g>
        )}
        {kind === 'puzzle' && (
          <g>
            <rect x="20" y="24" width="60" height="52" rx="8" fill="#9cc3b4" {...st} />
            <rect x="41" y="43" width="22" height="22" rx="3" fill="#eaf2ee" {...st} strokeWidth={2} strokeDasharray="4 4" />
            <g style={T('none', 'translate(9px, 34px)')}>
              <rect x="41" y="43" width="22" height="22" rx="3" fill="#d9b36b" {...st} />
              <circle cx="52" cy="41" r="4.5" fill="#d9b36b" {...st} strokeWidth={2} />
            </g>
          </g>
        )}
        {kind === 'shoe' && (
          <g>
            <path d="M16 72 Q 18 54 40 54 L 58 54 Q 80 54 86 70 Q 88 76 81 78 L 21 78 Q 14 78 16 72 Z" fill="#a9c4de" {...st} />
            <path d="M40 56 Q 50 64 60 57" fill="none" {...st} strokeWidth={2.4} />
            {solved ? (
              <g>
                <circle cx="44" cy="46" r="7.5" fill="none" {...st} strokeWidth={2.6} />
                <circle cx="58" cy="46" r="7.5" fill="none" {...st} strokeWidth={2.6} />
                <circle cx="51" cy="47" r="3.4" fill="#d9b36b" {...st} strokeWidth={2} />
              </g>
            ) : (
              <g fill="none" {...st} strokeWidth={2.6}>
                <path d="M45 54 Q 39 42 47 34" />
                <path d="M55 54 Q 61 42 53 34" />
              </g>
            )}
          </g>
        )}
        {kind === 'tower' && (
          <g>
            <rect x="35" y="70" width="30" height="16" rx="3" fill="#c9a978" {...st} />
            <rect x="35" y="54" width="30" height="16" rx="3" fill="#a9c4de" {...st} />
            <rect x="35" y="38" width="30" height="16" rx="3" fill="#9cc3b4" {...st} />
            <g style={{ transformOrigin: '50px 30px', transform: solved ? 'none' : 'translate(16px,-4px) rotate(20deg)', transition: 'transform 0.5s ease' }}>
              <rect x="35" y="22" width="30" height="16" rx="3" fill="#d9a3a3" {...st} />
            </g>
          </g>
        )}
        {kind === 'shelf' && (
          <g>
            <rect x="14" y="28" width="72" height="8" rx="2" fill="#c9a978" {...st} strokeWidth={2.5} />
            <rect x="20" y="36" width="6" height="9" rx="2" fill="#c9a978" {...st} strokeWidth={2.5} />
            <rect x="74" y="36" width="6" height="9" rx="2" fill="#c9a978" {...st} strokeWidth={2.5} />
            <g style={T('translateY(46px)', 'none')}>
              <circle cx="43" cy="12" r="4" fill="#c69a6d" {...st} strokeWidth={2.2} />
              <circle cx="57" cy="12" r="4" fill="#c69a6d" {...st} strokeWidth={2.2} />
              <circle cx="50" cy="19" r="11" fill="#c69a6d" {...st} />
              <circle cx="46" cy="17" r="1.6" fill={INK} />
              <circle cx="54" cy="17" r="1.6" fill={INK} />
              <path d="M46 23 Q 50 26 54 23" fill="none" {...st} strokeWidth={2} />
            </g>
          </g>
        )}
      </svg>
      {solved && <span className="help-sparkle" aria-hidden="true">✨</span>}
    </span>
  )
}

export default function Help({ onExit, friend = 0 }: GameProps) {
  const { t } = useT()
  const level = levelForTier([0, 1, 2, 3], getSettings().difficulty)
  const me = friend

  const [session, setSession] = useState<Round[]>(() => buildSession(level, me))
  const [ri, setRi] = useState(0)
  const [phase, setPhase] = useState<Phase>('snag')
  const [tried, setTried] = useState(false)
  const [cardsUp, setCardsUp] = useState(false)
  const [frustrated, setFrustrated] = useState(false)
  const [via, setVia] = useState<Via>(null)
  const [helper, setHelper] = useState(0)
  const [canReturn, setCanReturn] = useState(false)
  const [caption, setCaption] = useState('')
  const [stars, setStars] = useState(0)

  const round = session[ri]
  const last = ri === session.length - 1
  const solved = phase === 'solved'
  const calm = phase === 'solved' || phase === 'break'

  // one timer bucket so a scene's chained beats never leak into the next round
  const timers = useRef<number[]>([])
  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  function after(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms))
  }
  useEffect(() => clearTimers, [])

  // caption drives BOTH the speech bubble and the voice — text is always spoken.
  // Pass `id` when a clip is recorded for this exact line (falls back to browser
  // TTS otherwise, via playClip).
  function voice(text: string, id?: string) {
    if (id) playClip(id, text)
    else speak(text)
    setCaption(text)
  }
  const tap = () => {
    unlockAudio()
    playTap()
  }

  // ── round entry: show the snag, let frustration rise, then reveal the cards ──
  useEffect(() => {
    clearTimers()
    setPhase('snag')
    setTried(false)
    setCardsUp(false)
    setFrustrated(false)
    setVia(null)
    setCanReturn(false)
    setHelper(round.helper)

    const frustId = `help-frust-${round.snag}`
    const frust = t(`help.frust.${round.snag}`)
    if (round.isMirror) {
      const intro = t('help.mirror.intro')
      setCaption(`${intro} ${frust}`)
      playClip('help-mirror-intro', intro, () => playClip(frustId, frust))
    } else {
      voice(frust, frustId)
    }
    after(320, () => setFrustrated(true)) // the ring eases green→yellow
    if (!round.tryAlone) after(1900, revealCards)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ri, session])

  function revealCards() {
    voice(t('help.prompt'), 'help-prompt')
    setCardsUp(true)
  }

  function doTry() {
    tap()
    setTried(true)
    voice(t('help.tryalone.say'), 'help-tryalone-say')
    after(1900, revealCards)
  }

  function tapHelp() {
    clearTimers()
    tap()
    if (round.whoOptions) {
      setPhase('chooseWho')
      voice(t('help.who.q'), 'help-who-q')
    } else {
      startHelping(round.helper)
    }
  }

  function chooseHelper(idx: number) {
    clearTimers()
    tap()
    startHelping(idx)
  }

  function startHelping(h: number) {
    setHelper(h)
    setVia('help')
    setPhase('helping')
    voice(t('help.say.help'), 'help-say-help') // "אני צריך עזרה בבקשה" — the practised request
    after(1700, () => voice(t('help.helper.coming'), 'help-helper-coming'))
    after(3400, () => finish(false))
  }

  function tapBreak() {
    clearTimers()
    tap()
    setVia('break')
    setPhase('break')
    voice(t('help.say.break'), 'help-say-break') // "אני צריך הפסקה"
    after(1700, () => voice(t('help.break.breathe'), 'help-break-breathe'))
    after(7600, () => setCanReturn(true))
  }

  function doReturn() {
    clearTimers()
    tap()
    setCanReturn(false)
    voice(t('help.break.back'), 'help-break-back')
    after(1700, () => finish(true))
  }

  function finish(selfSolved: boolean) {
    playSuccess()
    playPop()
    setStars((s) => s + 1)
    setPhase('solved')
    voice(t(selfSolved ? 'help.solved.self' : 'help.solved'), selfSolved ? 'help-solved-self' : 'help-solved')
    after(1500, () => voice(t('help.cheer'), 'help-cheer'))
  }

  function next() {
    clearTimers()
    tap()
    if (last) setSession(buildSession(level, me)) // fresh session; stars only go up
    setRi((i) => (last ? 0 : i + 1))
  }

  const cheer = phase === 'solved'
  const showHelper = via === 'help' && (phase === 'helping' || phase === 'solved')
  const showCushion = via === 'break' && phase === 'break'
  const haloClass = calm ? 'is-calm' : frustrated ? 'is-frustrated' : 'is-calm'
  const breathing = phase === 'break'

  return (
    <GameShell title={t('game.help')} emoji="✋" onExit={onExit}>
      <Confetti active={solved} />
      <div className="potty-stars">
        {'⭐'.repeat(Math.min(stars, 10))}
        <span className="potty-star-num">{stars}</span>
      </div>

      <div className="center-body">
      <div className={`help-stage phase-${phase} ${round.isMirror ? 'is-mirror' : ''}`}>
        <p className="help-bubble" key={caption}>
          {caption}
        </p>

        <div className="help-scene">
          {showHelper && (
            <span className="help-helper" key={`helper-${ri}`}>
              <Friend index={helper} scale={0.46} showNumber={false} action={cheer ? 'five' : null} />
            </span>
          )}
          {showCushion && <span className="help-cushion" aria-hidden="true">🛋️</span>}

          <span className="help-owner">
            <span key={`halo-${ri}`} className={`help-halo ${haloClass} ${breathing ? 'is-breathing' : ''}`} aria-hidden="true" />
            <span className={`help-friend ${cheer ? 'is-cheer' : ''} ${breathing ? 'is-breathing' : ''}`}>
              <Friend index={round.owner} scale={0.5} showNumber={false} action={cheer ? 'hug' : null} />
            </span>
          </span>

          <span className="help-prop">
            <Snag kind={round.snag} solved={solved} />
          </span>
        </div>
      </div>

      <div className="help-actions">
        {phase === 'snag' && round.tryAlone && !tried && (
          <button className="big-button help-go" onClick={doTry}>
            💪 {t('help.tryalone.btn')}
          </button>
        )}

        {phase === 'snag' && cardsUp && (
          <div className="help-cards">
            {/* עזרה is first in the DOM → the RIGHT card in RTL Hebrew (leading) */}
            <button className="help-card help-card-help" onClick={tapHelp}>
              <span className="help-card-emoji" aria-hidden="true">✋</span>
              <span className="help-card-label">{t('help.card.help')}</span>
            </button>
            <button className="help-card help-card-break" onClick={tapBreak}>
              <span className="help-card-emoji" aria-hidden="true">🛑</span>
              <span className="help-card-label">{t('help.card.break')}</span>
            </button>
          </div>
        )}

        {phase === 'chooseWho' && round.whoOptions && (
          <div className="help-who">
            {round.whoOptions.map((idx) => (
              <button className="help-who-opt" key={idx} onClick={() => chooseHelper(idx)}>
                <span className="help-who-fig">
                  <Friend index={idx} scale={0.4} showNumber={false} />
                </span>
                <span className="help-who-name">{friendName(idx)}</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'helping' && <p className="help-hint">✨ {t('help.step')}</p>}

        {phase === 'break' &&
          (canReturn ? (
            <button className="big-button help-go" onClick={doReturn}>
              😌 {t('help.break.return')}
            </button>
          ) : (
            <p className="help-hint">🫧 {t('help.break.breathe')}</p>
          ))}

        {phase === 'solved' && (
          <button className="big-button help-go" onClick={next}>
            {last ? `✨ ${t('help.again')}` : `➡️ ${t('help.next')}`}
          </button>
        )}
      </div>
      </div>
    </GameShell>
  )
}
