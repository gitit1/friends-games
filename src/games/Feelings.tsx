import { useEffect, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'
import { playTap, playPop, playSuccess, playNudge, unlockAudio } from '../audio'
import { speak } from '../speech'
import { getSettings } from '../settings'
import { levelForTier } from '../difficulty'
import type { GameProps } from './registry'

// "איך אני מרגיש?" — a calm, NO-FAIL emotions game (Zones of Regulation):
//   1. IDENTIFY  — a big face shows a feeling; tap its name (wrong = gentle nudge).
//   2. HOW BIG   — rate the feeling 1–5 on a growing scale (any answer is right).
//   3. TOOLBOX   — pick a calming tool (breathing flower / balloon / bubbles).
//   4. BREATHE   — a slow 4s-in / 5s-out guide animation; breathe along.
//   5. CALM      — the face relaxes to green, praise + a star. Then another feeling.
// Muted Zones colors only (sensory-sensitive child): green/blue/yellow/red, no neon.

type Emotion = 'happy' | 'sad' | 'angry' | 'scared' | 'calm'
type Phase = 'identify' | 'size' | 'tool' | 'breathe' | 'calm'
type Tool = 'flower' | 'balloon' | 'bubbles'

const INK = '#4b3b3d'
const ZONE: Record<Emotion, { color: string; soft: string; k: string }> = {
  happy: { color: '#7fb69a', soft: '#eaf4ef', k: 'feel.zone.green' },
  calm: { color: '#7fb69a', soft: '#eaf4ef', k: 'feel.zone.green' },
  sad: { color: '#7f9ec4', soft: '#eaf0f7', k: 'feel.zone.blue' },
  scared: { color: '#d9c07f', soft: '#f8f3e3', k: 'feel.zone.yellow' },
  angry: { color: '#c98a8a', soft: '#f7ebea', k: 'feel.zone.red' },
}
const EMOJI: Record<Emotion, string> = { happy: '😊', sad: '😢', angry: '😠', scared: '😨', calm: '😌' }
const TOOL_EMOJI: Record<Tool, string> = { flower: '🌸', balloon: '🎈', bubbles: '🫧' }

// cumulative difficulty pools (game rule: each level serves its items + all below)
const LEVEL_EMOTIONS: Emotion[][] = [['happy', 'sad'], ['angry'], ['scared'], ['calm']]
const POOLS = LEVEL_EMOTIONS.map((_, i) => LEVEL_EMOTIONS.slice(0, i + 1).flat())

function pick(pool: Emotion[], not?: Emotion): Emotion {
  const opts = pool.filter((e) => e !== not)
  return opts[Math.floor(Math.random() * opts.length)] ?? pool[0]
}

// the big feeling face — same warm hand-drawn style as the potty kid
function EmotionFace({ emo }: { emo: Emotion }) {
  const s = { stroke: INK, strokeWidth: 2.8, strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg className="fe-svg" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="70" cy="70" r="55" fill="#f1c69f" stroke={INK} strokeWidth="2.8" />
      {emo === 'scared' ? (
        <g>
          {/* wide startled eyes */}
          <circle cx="52" cy="62" r="10" fill="#fff" stroke={INK} strokeWidth="2.4" />
          <circle cx="88" cy="62" r="10" fill="#fff" stroke={INK} strokeWidth="2.4" />
          <circle cx="52" cy="63" r="4" fill="#3a2e30" />
          <circle cx="88" cy="63" r="4" fill="#3a2e30" />
          <path d="M40 44 Q 50 38 60 44" {...s} />
          <path d="M80 44 Q 90 38 100 44" {...s} />
          <ellipse cx="70" cy="96" rx="8" ry="11" fill="#7a5a5e" />
        </g>
      ) : emo === 'calm' ? (
        <g>
          {/* softly closed eyes + gentle smile */}
          <path d="M44 62 Q 52 69 60 62" {...s} />
          <path d="M80 62 Q 88 69 96 62" {...s} />
          <path d="M52 88 Q 70 98 88 88" {...s} strokeWidth={3.4} />
        </g>
      ) : (
        <g>
          <circle cx="52" cy="62" r="5.2" fill="#3a2e30" />
          <circle cx="88" cy="62" r="5.2" fill="#3a2e30" />
          <circle cx="50.2" cy="60" r="1.9" fill="#fff" />
          <circle cx="86.2" cy="60" r="1.9" fill="#fff" />
          {emo === 'happy' && <path d="M46 84 Q 70 104 94 84" {...s} strokeWidth={4} />}
          {emo === 'sad' && (
            <g>
              <path d="M42 52 Q 50 46 58 47" {...s} />
              <path d="M98 52 Q 90 46 82 47" {...s} />
              <path d="M50 94 Q 70 80 90 94" {...s} strokeWidth={4} />
              <path d="M94 74 q 5 8 0 12 q -5 -4 0 -12" fill="#8fb8d8" stroke="none" />
            </g>
          )}
          {emo === 'angry' && (
            <g>
              <path d="M40 46 Q 50 50 58 55" {...s} />
              <path d="M100 46 Q 90 50 82 55" {...s} />
              <path d="M52 92 Q 70 85 88 92" {...s} strokeWidth={4} />
            </g>
          )}
        </g>
      )}
      {(emo === 'happy' || emo === 'calm') && (
        <g>
          <ellipse cx="42" cy="76" rx="7" ry="4.5" fill="#eaa1a8" opacity="0.55" />
          <ellipse cx="98" cy="76" rx="7" ry="4.5" fill="#eaa1a8" opacity="0.55" />
        </g>
      )}
    </svg>
  )
}

export default function Feelings({ onExit }: GameProps) {
  const { t } = useT()
  const pool = POOLS[levelForTier([0, 1, 2, 3], getSettings().difficulty)]
  const [emo, setEmo] = useState<Emotion>(() => pick(pool))
  const [phase, setPhase] = useState<Phase>('identify')
  const [dimmed, setDimmed] = useState<Emotion[]>([])
  const [tool, setTool] = useState<Tool>('flower')
  const [cue, setCue] = useState<'in' | 'out'>('in')
  const [canDone, setCanDone] = useState(false)
  const [stars, setStars] = useState(0)

  const zone = ZONE[emo]
  const isGreen = emo === 'happy' || emo === 'calm'
  const shown: Emotion = phase === 'calm' ? 'calm' : emo

  // speak each phase's guidance once
  useEffect(() => {
    if (phase === 'identify') speak(t('feel.q'))
    else if (phase === 'size') speak(t('feel.howbig'))
    else if (phase === 'tool') speak(t('feel.pick'))
    else if (phase === 'breathe') speak(t('feel.breathe.say'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // the slow breathing cycle: ~4s in, ~5s out (matches the 9s CSS animation)
  useEffect(() => {
    if (phase !== 'breathe') return
    setCanDone(false)
    setCue('in')
    const start = Date.now()
    const iv = window.setInterval(() => {
      const el = (Date.now() - start) / 1000
      setCue(el % 9 < 4 ? 'in' : 'out')
      if (el >= 9.2) setCanDone(true)
    }, 250)
    return () => clearInterval(iv)
  }, [phase])

  const tap = () => {
    unlockAudio()
    playTap()
  }

  function answer(e: Emotion) {
    unlockAudio()
    if (e === emo) {
      playPop()
      speak(`${t(`feel.${emo}`)}. ${t(zone.k)}`)
      window.setTimeout(() => setPhase('size'), 900)
    } else {
      playNudge()
      setDimmed((d) => (d.includes(e) ? d : [...d, e]))
    }
  }
  function pickSize(n: number) {
    tap()
    speak(t(`feel.size.${n}`))
    window.setTimeout(() => setPhase(isGreen ? 'calm' : 'tool'), 800)
    if (isGreen) finishSoon()
  }
  function pickTool(x: Tool) {
    tap()
    setTool(x)
    speak(t(`feel.tool.${x}`))
    window.setTimeout(() => setPhase('breathe'), 700)
  }
  function doneBreathing() {
    tap()
    setPhase('calm')
    finishSoon()
  }
  function finishSoon() {
    window.setTimeout(() => {
      playSuccess()
      speak(t(isGreen ? 'feel.calm.stay' : 'feel.calm.now'))
      setStars((n) => n + 1)
    }, 350)
  }
  function nextRound() {
    tap()
    setEmo((prev) => pick(pool, prev))
    setDimmed([])
    setPhase('identify')
  }

  const bubble =
    phase === 'identify'
      ? t('feel.q')
      : phase === 'size'
        ? t('feel.howbig')
        : phase === 'tool'
          ? t('feel.pick')
          : phase === 'breathe'
            ? t(cue === 'in' ? 'feel.in' : 'feel.out')
            : t(isGreen ? 'feel.calm.stay' : 'feel.calm.now')

  return (
    <GameShell title={t('game.feelings')} emoji="💚" onExit={onExit}>
      <Confetti active={phase === 'calm'} />
      <span className="score-pill" aria-label={t('bs.score', { n: stars })}>
        ⭐ {stars}
      </span>

      <div className={`fe-stage fe-ph-${phase}`} data-emo={emo} style={{ background: zone.soft }}>
        <p className="fe-bubble" key={phase + cue}>{bubble}</p>

        {phase === 'breathe' ? (
          <div className="fe-breathe-box">
            <span className={`fe-tool-fig fe-cue-${cue}`} aria-hidden="true">
              {TOOL_EMOJI[tool]}
            </span>
          </div>
        ) : (
          <div
            className="fe-ring"
            style={{ borderColor: phase === 'calm' ? ZONE.calm.color : zone.color }}
          >
            <EmotionFace emo={shown} />
          </div>
        )}
      </div>

      <div className="fe-actions">
        {phase === 'identify' && (
          <div className="fe-opts">
            {pool.map((e) => (
              <button
                key={e}
                data-emo={e}
                className={`fe-opt${dimmed.includes(e) ? ' dim' : ''}`}
                onClick={() => answer(e)}
              >
                <span className="fe-opt-emoji">{EMOJI[e]}</span>
                <span>{t(`feel.${e}`)}</span>
              </button>
            ))}
          </div>
        )}
        {phase === 'size' && (
          <div className="fe-sizes">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="fe-size" onClick={() => pickSize(n)} aria-label={t(`feel.size.${n}`)}>
                <span
                  className="fe-size-dot"
                  style={{ width: 12 + n * 9, height: 12 + n * 9, background: zone.color }}
                />
              </button>
            ))}
          </div>
        )}
        {phase === 'tool' && (
          <div className="fe-tools">
            {(['flower', 'balloon', 'bubbles'] as Tool[]).map((x) => (
              <button key={x} className="fe-tool" data-tool={x} onClick={() => pickTool(x)}>
                <span className="fe-tool-emoji">{TOOL_EMOJI[x]}</span>
                <span>{t(`feel.tool.${x}`)}</span>
              </button>
            ))}
          </div>
        )}
        {phase === 'breathe' && canDone && (
          <button className="big-button fe-go" onClick={doneBreathing}>
            💚 {t('feel.done')}
          </button>
        )}
        {phase === 'calm' && (
          <button className="big-button fe-go" onClick={nextRound}>
            ✨ {t('feel.again')}
          </button>
        )}
      </div>
    </GameShell>
  )
}
