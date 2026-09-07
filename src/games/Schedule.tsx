import { useEffect, useState } from 'react'
import GameShell from '../components/GameShell'
import Confetti from '../components/Confetti'
import { useT } from '../i18n'
import { playTap, playPop, playSuccess, unlockAudio } from '../audio'
import { playClip } from '../voice'
import type { GameProps } from './registry'

// "סדר יום" — a calm, NO-FAIL visual daily schedule (TEACCH / Choiceworks model).
// A ROUTINE AID, not a win/lose game: a horizontal strip of activity cards that
// progresses RIGHT-TO-LEFT (RTL). The current card glows; tapping it marks it
// done (it settles into the "בוצע" pocket with a soft chime) and the next card
// lights up. Tapping any other card just wiggles + speaks its name (never an error).
// Modes: full-day strip (Morning / Evening presets) · First-Then (2 big cards).
// Parents (behind a small "להורים" button) toggle steps on/off, reorder them,
// pick the First-Then pair, and set an optional per-card visual timer. Everything
// persists to localStorage. Deferred (noted in the plan): photos + parent voice.

type CardId =
  | 'wake' | 'toilet' | 'handwash' | 'brush' | 'dress' | 'breakfast' | 'snack'
  | 'drink' | 'bag' | 'shoes' | 'play' | 'kindergarten' | 'rest'
  | 'dinner' | 'bath' | 'pajamas' | 'story' | 'bed'
type RoutineId = 'morning' | 'evening'
type Mode = 'strip' | 'ft'

// Simple, bold, ARASAAC-like icons. Each is paired with a spoken Hebrew label so
// a non-reading child never depends on the text.
const EMOJI: Record<CardId, string> = {
  wake: '☀️', toilet: '🚽', handwash: '🧼', brush: '🪥', dress: '👕',
  breakfast: '🥣', snack: '🍎', drink: '💧', bag: '🎒', shoes: '👟',
  play: '🧩', kindergarten: '🏫', rest: '😴',
  dinner: '🍽️', bath: '🛁', pajamas: '🌙', story: '📖', bed: '🛏️',
}

// The full palette a parent can pick from (in a sensible day order).
const CATALOG: CardId[] = [
  'wake', 'toilet', 'handwash', 'brush', 'dress', 'breakfast', 'snack', 'drink',
  'bag', 'shoes', 'play', 'kindergarten', 'rest',
  'dinner', 'bath', 'pajamas', 'story', 'bed',
]

// Preset routines (exactly as designed in ROADMAP §4.3).
const PRESETS: Record<RoutineId, CardId[]> = {
  morning: ['wake', 'toilet', 'brush', 'dress', 'breakfast', 'bag', 'shoes'],
  evening: ['dinner', 'bath', 'pajamas', 'brush', 'toilet', 'story', 'bed'],
}

type Persisted = {
  morning: CardId[]
  evening: CardId[]
  timerMin: number // 0 = off · else 2 / 5 / 10
  ftFirst: CardId
  ftThen: CardId
}
const KEY = 'assaf-friends:schedule:v1'
const DEFAULTS: Persisted = {
  morning: PRESETS.morning,
  evening: PRESETS.evening,
  timerMin: 0,
  ftFirst: 'dress',
  ftThen: 'play',
}
function loadCfg(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw)
    // keep only ids we still know about, so an old save never injects a bad card
    const clean = (a: unknown, fb: CardId[]): CardId[] => {
      const arr = Array.isArray(a) ? (a as CardId[]).filter((c) => CATALOG.includes(c)) : []
      return arr.length ? arr : fb
    }
    const oneOf = (v: unknown, fb: CardId): CardId => (CATALOG.includes(v as CardId) ? (v as CardId) : fb)
    return {
      morning: clean(saved.morning, DEFAULTS.morning),
      evening: clean(saved.evening, DEFAULTS.evening),
      timerMin: [0, 2, 5, 10].includes(saved.timerMin) ? saved.timerMin : 0,
      ftFirst: oneOf(saved.ftFirst, DEFAULTS.ftFirst),
      ftThen: oneOf(saved.ftThen, DEFAULTS.ftThen),
    }
  } catch {
    return DEFAULTS
  }
}
function saveCfg(cfg: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg))
  } catch {
    // storage disabled (private mode): settings just won't persist. No crash.
  }
}

export default function Schedule({ onExit }: GameProps) {
  const { t, lang } = useT()
  const [cfg, setCfgState] = useState<Persisted>(loadCfg)
  const [routine, setRoutine] = useState<RoutineId>('morning')
  const [mode, setMode] = useState<Mode>('strip')
  const [doneCount, setDoneCount] = useState(0)
  const [slideIdx, setSlideIdx] = useState<number | null>(null)
  const [wiggleIdx, setWiggleIdx] = useState<number | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const [editing, setEditing] = useState(false)

  // the ordered cards for the current view
  const steps: CardId[] = mode === 'ft' ? [cfg.ftFirst, cfg.ftThen] : cfg[routine]
  const allDone = doneCount >= steps.length
  const name = (id: CardId) => t(`sch.card.${id}`)
  // "forward" in reading order: ← in RTL Hebrew, → in LTR English
  const fwd = lang === 'he' ? '←' : '→'

  function setCfg(next: Persisted) {
    setCfgState(next)
    saveCfg(next)
  }

  // Speak a short one-line guidance whenever the child lands on a fresh view.
  useEffect(() => {
    if (editing) return
    setDoneCount(0)
    setTimeUp(false)
    playClip('sch-tap-say', t('sch.tap.say'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, routine, cfg.ftFirst, cfg.ftThen])

  // Optional per-card visual timer: purely a suggestion. When it elapses we show
  // a gentle "הזמן נגמר — ממשיכים?" — NO sound, NO failure, no auto-advance.
  useEffect(() => {
    setTimeUp(false)
    if (mode !== 'strip' || cfg.timerMin <= 0 || allDone || editing) return
    const id = window.setTimeout(() => setTimeUp(true), cfg.timerMin * 60_000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, cfg.timerMin, mode, routine, allDone, editing])

  function completeCurrent(i: number) {
    unlockAudio()
    playPop() // a happy soft chime
    playClip(`sch-card-${steps[i]}`, name(steps[i]))
    setSlideIdx(i)
    setTimeUp(false)
    window.setTimeout(() => {
      setSlideIdx(null)
      const next = i + 1
      setDoneCount(next)
      if (next >= steps.length) {
        window.setTimeout(() => {
          playSuccess()
          playClip('sch-allDone-say', t('sch.allDone.say'))
        }, 250)
      }
    }, 460)
  }

  function wiggleAndSay(i: number) {
    unlockAudio()
    playTap()
    playClip(`sch-card-${steps[i]}`, name(steps[i]))
    setWiggleIdx(i)
    window.setTimeout(() => setWiggleIdx((v) => (v === i ? null : v)), 480)
  }

  function tapCard(i: number) {
    if (allDone || slideIdx !== null) return
    if (i === doneCount) completeCurrent(i)
    else wiggleAndSay(i) // done OR upcoming — gentle, never an error
  }

  function restart() {
    unlockAudio()
    playTap()
    setDoneCount(0)
    setTimeUp(false)
  }

  function switchRoutine(r: RoutineId) {
    if (mode === 'strip' && routine === r) return
    unlockAudio()
    playTap()
    setMode('strip')
    setRoutine(r)
  }
  function switchToFt() {
    if (mode === 'ft') return
    unlockAudio()
    playTap()
    setMode('ft')
  }

  // ── parent editor helpers (edit the current strip routine) ──
  function updateRoutineSteps(next: CardId[]) {
    if (mode === 'ft') return
    setCfg({ ...cfg, [routine]: next })
  }
  function moveStep(i: number, dir: -1 | 1) {
    const arr = [...cfg[routine]]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    updateRoutineSteps(arr)
  }
  function removeStep(i: number) {
    const arr = cfg[routine].filter((_, k) => k !== i)
    if (arr.length === 0) return // keep at least one card
    updateRoutineSteps(arr)
  }
  function addStep(id: CardId) {
    if (cfg[routine].includes(id)) return
    updateRoutineSteps([...cfg[routine], id])
  }

  const doneLabel = `${t('sch.done.pocket')} · ${Math.min(doneCount, steps.length)}/${steps.length}`

  return (
    <GameShell title={t('game.schedule')} emoji="📋" onExit={onExit}>
      <Confetti active={allDone} />

      {/* mode / routine chooser + parent corner */}
      <div className="sch-top">
        <div className="sch-modes">
          <button
            className={`sch-chip${mode === 'strip' && routine === 'morning' ? ' on' : ''}`}
            onClick={() => switchRoutine('morning')}
          >
            ☀️ {t('sch.routine.morning')}
          </button>
          <button
            className={`sch-chip${mode === 'strip' && routine === 'evening' ? ' on' : ''}`}
            onClick={() => switchRoutine('evening')}
          >
            🌙 {t('sch.routine.evening')}
          </button>
          <button className={`sch-chip${mode === 'ft' ? ' on' : ''}`} onClick={switchToFt}>
            🔀 {t('sch.mode.firstThen')}
          </button>
        </div>
        <button className="sch-parents" onClick={() => { unlockAudio(); playTap(); setEditing(true) }}>
          ⚙️ {t('sch.parents')}
        </button>
      </div>

      {/* the "בוצע" pocket meter */}
      <div className="sch-pocket" aria-hidden="true">
        <span className="sch-pocket-lbl">✓ {doneLabel}</span>
        <span className="sch-pocket-bar">
          <span className="sch-pocket-fill" style={{ width: `${(Math.min(doneCount, steps.length) / steps.length) * 100}%` }} />
        </span>
      </div>

      <div className="center-body">
      {mode === 'ft' ? (
        // ── First-Then: a stripped, big, minimal 2-card view ──
        <div className="sch-ft">
          {[0, 1].map((i) => {
            const id = steps[i]
            const status = i < doneCount ? 'done' : i === doneCount ? 'current' : 'upcoming'
            return (
              <div className="sch-ft-cell" key={i}>
                <div className="sch-ft-slot">
                  <span className="sch-ft-lbl">{i === 0 ? t('sch.first') : t('sch.then')}</span>
                  <button
                    className={`sch-card big ${status}${slideIdx === i ? ' sliding' : ''}${wiggleIdx === i ? ' wiggle' : ''}`}
                    onClick={() => tapCard(i)}
                  >
                    <span className="sch-card-emoji" aria-hidden="true">{EMOJI[id]}</span>
                    <span className="sch-card-name">{name(id)}</span>
                    {status === 'done' && <span className="sch-check" aria-hidden="true">✓</span>}
                  </button>
                </div>
                {i === 0 && <span className="sch-ft-arrow" aria-hidden="true">{fwd}</span>}
              </div>
            )
          })}
        </div>
      ) : (
        // ── full-day strip: scrolls horizontally (RTL) if it overflows ──
        <div className="sch-strip-wrap">
          <div className="sch-strip">
            {steps.map((id, i) => {
              const status = i < doneCount ? 'done' : i === doneCount ? 'current' : 'upcoming'
              return (
                <div className="sch-slot" key={i}>
                  <button
                    className={`sch-card ${status}${slideIdx === i ? ' sliding' : ''}${wiggleIdx === i ? ' wiggle' : ''}`}
                    onClick={() => tapCard(i)}
                  >
                    <span className="sch-card-emoji" aria-hidden="true">{EMOJI[id]}</span>
                    <span className="sch-card-name">{name(id)}</span>
                    {status === 'done' && <span className="sch-check" aria-hidden="true">✓</span>}
                  </button>
                  {/* the shrinking soft timer bar under the CURRENT card only */}
                  {status === 'current' && cfg.timerMin > 0 && (
                    <span className="sch-timer" key={`t${doneCount}`}>
                      <span
                        className="sch-timer-fill"
                        style={{ animationDuration: `${cfg.timerMin * 60}s` }}
                      />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* gentle, visual-only "time's up" nudge (no sound, no failure) */}
      {timeUp && !allDone && <p className="sch-timeup">⏳ {t('sch.timeUp')}</p>}

      {/* child-facing guidance + finale */}
      <div className="sch-foot">
        {allDone ? (
          <button className="big-button sch-again" onClick={restart}>
            🎉 {t('sch.allDone')} · {t('sch.again')}
          </button>
        ) : (
          <p className="sch-hint">👉 {t('sch.tap')}</p>
        )}
      </div>
      </div>

      {/* ── parent editor (behind the "להורים" button) ── */}
      {editing && (
        <div className="sch-editor-back" onClick={() => setEditing(false)}>
          <div className="sch-editor" onClick={(e) => e.stopPropagation()}>
            <button className="sch-editor-x" aria-label={t('sch.parents.done')} onClick={() => setEditing(false)}>
              ✕
            </button>
            <h2 className="sch-editor-title">⚙️ {t('sch.parents.title')}</h2>

            {/* steps of the CURRENT routine — reorder + remove */}
            <p className="sch-editor-sub">
              {t('sch.parents.steps')} · {routine === 'morning' ? t('sch.routine.morning') : t('sch.routine.evening')}
            </p>
            <div className="sch-editor-list">
              {cfg[routine].map((id, i) => (
                <div className="sch-editor-row" key={id}>
                  <span className="sch-editor-emoji" aria-hidden="true">{EMOJI[id]}</span>
                  <span className="sch-editor-name">{name(id)}</span>
                  <span className="sch-editor-btns">
                    <button aria-label={t('sch.parents.up')} disabled={i === 0} onClick={() => moveStep(i, -1)}>▲</button>
                    <button aria-label={t('sch.parents.down')} disabled={i === cfg[routine].length - 1} onClick={() => moveStep(i, 1)}>▼</button>
                    <button aria-label={t('sch.parents.remove')} disabled={cfg[routine].length <= 1} onClick={() => removeStep(i)}>✕</button>
                  </span>
                </div>
              ))}
            </div>

            {/* palette of cards not yet in this routine — tap to add */}
            <p className="sch-editor-sub">{t('sch.parents.add')}</p>
            <div className="sch-editor-palette">
              {CATALOG.filter((id) => !cfg[routine].includes(id)).map((id) => (
                <button key={id} className="sch-palette-chip" onClick={() => addStep(id)}>
                  <span aria-hidden="true">{EMOJI[id]}</span> {name(id)}
                </button>
              ))}
            </div>

            {/* per-card visual timer */}
            <p className="sch-editor-sub">⏳ {t('sch.parents.timer')}</p>
            <div className="sch-editor-timer">
              {[0, 2, 5, 10].map((m) => (
                <button
                  key={m}
                  className={`sch-timer-chip${cfg.timerMin === m ? ' on' : ''}`}
                  onClick={() => setCfg({ ...cfg, timerMin: m })}
                >
                  {m === 0 ? t('sch.timer.off') : t(`sch.timer.${m}`)}
                </button>
              ))}
            </div>

            {/* First-Then pair */}
            <p className="sch-editor-sub">🔀 {t('sch.mode.firstThen')}</p>
            <div className="sch-ft-pick">
              <span className="sch-ft-pick-lbl">{t('sch.parents.pickFirst')}</span>
              <div className="sch-editor-palette">
                {CATALOG.map((id) => (
                  <button
                    key={id}
                    className={`sch-palette-chip${cfg.ftFirst === id ? ' on' : ''}`}
                    onClick={() => setCfg({ ...cfg, ftFirst: id })}
                  >
                    <span aria-hidden="true">{EMOJI[id]}</span> {name(id)}
                  </button>
                ))}
              </div>
              <span className="sch-ft-pick-lbl">{t('sch.parents.pickThen')}</span>
              <div className="sch-editor-palette">
                {CATALOG.map((id) => (
                  <button
                    key={id}
                    className={`sch-palette-chip${cfg.ftThen === id ? ' on' : ''}`}
                    onClick={() => setCfg({ ...cfg, ftThen: id })}
                  >
                    <span aria-hidden="true">{EMOJI[id]}</span> {name(id)}
                  </button>
                ))}
              </div>
            </div>

            <button className="big-button sch-editor-done" onClick={() => setEditing(false)}>
              {t('sch.parents.done')}
            </button>
          </div>
        </div>
      )}
    </GameShell>
  )
}
