import { useState } from 'react'
import { updateSettings, useSettings, type Ops } from '../settings'
import { DIFFICULTY_TIERS } from '../difficulty'
import { setLang, useT } from '../i18n'
import { LANGS } from '../i18n/types'
import { hasHebrewVoice, speak } from '../speech'
import { playTap, unlockAudio } from '../audio'

// the number-range choices and the four arithmetic operations
const RANGES = [5, 10, 20, 50, 100]
const OP_LIST: { key: keyof Ops; sym: string }[] = [
  { key: 'add', sym: '➕' },
  { key: 'sub', sym: '➖' },
  { key: 'mul', sym: '✖️' },
  { key: 'div', sym: '➗' },
]
// the three Hebrew address-form (לשון פנייה) choices
const ADDRESS_MODES = ['plural', 'boy', 'girl'] as const

// quick presets that set range + operations + difficulty together
type Preset = { key: string; emoji: string; maxNumber: number; ops: Ops; difficulty: number }
const PRESETS: Preset[] = [
  { key: 'kinder', emoji: '🧸', maxNumber: 10, ops: { add: true, sub: true, mul: false, div: false }, difficulty: 0 },
  { key: 'grade1', emoji: '🎒', maxNumber: 20, ops: { add: true, sub: true, mul: false, div: false }, difficulty: 1 },
  { key: 'grade23', emoji: '📘', maxNumber: 50, ops: { add: true, sub: true, mul: true, div: false }, difficulty: 2 },
  { key: 'assaf', emoji: '⭐', maxNumber: 100, ops: { add: true, sub: true, mul: true, div: true }, difficulty: 3 },
]

// A toggle row with a big, finger-friendly switch.
function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      className="settings-row"
      role="switch"
      aria-checked={value}
      onClick={() => {
        playTap()
        onChange(!value)
      }}
    >
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {hint && <span className="settings-row-hint">{hint}</span>}
      </span>
      <span className={`switch ${value ? 'switch-on' : ''}`} aria-hidden="true">
        <span className="switch-knob" />
      </span>
    </button>
  )
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const settings = useSettings()
  const { t, say } = useT()
  const voiceMissing = settings.voice && settings.lang === 'he' && !hasHebrewVoice()

  const opsSame = (a: Ops, b: Ops) => a.add === b.add && a.sub === b.sub && a.mul === b.mul && a.div === b.div
  const activePreset = PRESETS.find(
    (p) => p.maxNumber === settings.maxNumber && p.difficulty === settings.difficulty && opsSame(p.ops, settings.ops),
  )?.key
  function applyPreset(p: Preset) {
    playTap()
    updateSettings({ maxNumber: p.maxNumber, ops: { ...p.ops }, difficulty: p.difficulty })
  }
  function toggleOp(k: keyof Ops) {
    playTap()
    const next = { ...settings.ops, [k]: !settings.ops[k] }
    if (!next.add && !next.sub && !next.mul && !next.div) return // never all-off
    updateSettings({ ops: next })
  }

  return (
    <>
      <button
        className="settings-gear"
        aria-label={t('settings.title')}
        onClick={() => {
          unlockAudio()
          playTap()
          setOpen(true)
        }}
      >
        ⚙️
      </button>

      {open && (
        <div className="settings-overlay" onClick={() => setOpen(false)}>
          <div className="settings-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="settings-title">{t('settings.title')}</h2>

            {/* ---- parent level controls (range / operations / presets) ---- */}
            <div className="settings-row settings-row-static settings-row-stack">
              <span className="settings-row-text">
                <span className="settings-row-label">🎚️ {t('settings.level')}</span>
                <span className="settings-row-hint">{t('settings.level.hint')}</span>
              </span>
              <span className="settings-choice settings-choice-wide">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={`pill pill-small ${activePreset === p.key ? 'pill-active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.emoji} {t(`preset.${p.key}`)}
                  </button>
                ))}
              </span>
            </div>

            <div className="settings-row settings-row-static settings-row-stack">
              <span className="settings-row-text">
                <span className="settings-row-label">{t('settings.range')}</span>
              </span>
              <span className="settings-choice settings-choice-wide">
                {RANGES.map((n) => (
                  <button
                    key={n}
                    className={`pill pill-small ${settings.maxNumber === n ? 'pill-active' : ''}`}
                    onClick={() => {
                      playTap()
                      updateSettings({ maxNumber: n })
                    }}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>

            <div className="settings-row settings-row-static settings-row-stack">
              <span className="settings-row-text">
                <span className="settings-row-label">{t('settings.ops')}</span>
              </span>
              <span className="settings-choice settings-choice-wide">
                {OP_LIST.map((o) => (
                  <button
                    key={o.key}
                    className={`pill pill-small ${settings.ops[o.key] ? 'pill-active' : ''}`}
                    onClick={() => toggleOp(o.key)}
                    aria-pressed={settings.ops[o.key]}
                  >
                    {o.sym}
                  </button>
                ))}
              </span>
            </div>

            <Toggle
              label={t('settings.limitRoster')}
              hint={t('settings.limitRoster.hint')}
              value={settings.limitRoster}
              onChange={(next) => updateSettings({ limitRoster: next })}
            />

            <div className="settings-row settings-row-static">
              <span className="settings-row-text">
                <span className="settings-row-label">🌍 {t('settings.lang')}</span>
              </span>
              <span className="settings-choice">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    className={`pill pill-small ${settings.lang === l.id ? 'pill-active' : ''}`}
                    onClick={() => {
                      playTap()
                      setLang(l.id)
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </span>
            </div>

            <Toggle
              label={t('settings.voice')}
              hint={t('settings.voice.hint')}
              value={settings.voice}
              onChange={(next) => {
                updateSettings({ voice: next })
                if (next) speak(say('settings.hi'))
              }}
            />

            {voiceMissing && <p className="settings-warning">{t('settings.voiceMissing')}</p>}

            <Toggle
              label={t('settings.sound')}
              hint={t('settings.sound.hint')}
              value={settings.sound}
              onChange={(next) => updateSettings({ sound: next })}
            />

            <Toggle
              label={t('settings.names')}
              hint={t('settings.names.hint')}
              value={settings.sayNames}
              onChange={(next) => updateSettings({ sayNames: next })}
            />

            <Toggle
              label={t('settings.motion')}
              hint={t('settings.motion.hint')}
              value={settings.reduceMotion}
              onChange={(next) => updateSettings({ reduceMotion: next })}
            />

            <Toggle
              label={t('settings.evening')}
              hint={t('settings.evening.hint')}
              value={settings.eveningMode}
              onChange={(next) => updateSettings({ eveningMode: next })}
            />

            {/* pet care model: gentle (always fine) vs regular (needs decay) */}
            <div className="settings-row settings-row-static settings-row-stack">
              <span className="settings-row-text">
                <span className="settings-row-label">🐾 {t('settings.petcare')}</span>
                <span className="settings-row-hint">{t('settings.petcare.hint')}</span>
              </span>
              <span className="settings-choice settings-choice-wide">
                {(['gentle', 'regular'] as const).map((m) => (
                  <button
                    key={m}
                    className={`pill pill-small ${settings.petCareMode === m ? 'pill-active' : ''}`}
                    onClick={() => {
                      playTap()
                      updateSettings({ petCareMode: m })
                    }}
                  >
                    {t(`settings.petcare.${m}`)}
                  </button>
                ))}
              </span>
            </div>

            {/* address form: how the games speak to the child (Hebrew grammar only) */}
            <div className="settings-row settings-row-static settings-row-stack">
              <span className="settings-row-text">
                <span className="settings-row-label">🗨️ {t('settings.address')}</span>
                <span className="settings-row-hint">{t('settings.address.hint')}</span>
              </span>
              <span className="settings-choice settings-choice-wide">
                {ADDRESS_MODES.map((m) => (
                  <button
                    key={m}
                    className={`pill pill-small ${settings.address === m ? 'pill-active' : ''}`}
                    onClick={() => {
                      playTap()
                      updateSettings({ address: m })
                    }}
                  >
                    {t(`settings.address.${m}`)}
                  </button>
                ))}
              </span>
            </div>

            <div className="settings-row settings-row-static settings-row-stack">
              <span className="settings-row-text">
                <span className="settings-row-label">{t('settings.difficulty')}</span>
                <span className="settings-row-hint">{t('settings.difficulty.hint')}</span>
              </span>
              <span className="settings-choice settings-choice-wide">
                {DIFFICULTY_TIERS.map((_, i) => (
                  <button
                    key={i}
                    className={`pill pill-small ${settings.difficulty === i ? 'pill-active' : ''}`}
                    onClick={() => {
                      playTap()
                      updateSettings({ difficulty: i })
                    }}
                  >
                    {t(`diff.${i}`)}
                  </button>
                ))}
              </span>
            </div>

            <div className="settings-row settings-row-static">
              <span className="settings-row-text">
                <span className="settings-row-label">{t('settings.catch')}</span>
                <span className="settings-row-hint">{t('settings.catch.hint')}</span>
              </span>
              <span className="settings-choice">
                {[30, 60].map((sec) => (
                  <button
                    key={sec}
                    className={`pill pill-small ${settings.catchSeconds === sec ? 'pill-active' : ''}`}
                    onClick={() => {
                      playTap()
                      updateSettings({ catchSeconds: sec })
                    }}
                  >
                    {sec === 30 ? t('settings.catch.half') : t('settings.catch.min')}
                  </button>
                ))}
              </span>
            </div>

            <button className="big-button settings-close" onClick={() => setOpen(false)}>
              {t('settings.close')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
