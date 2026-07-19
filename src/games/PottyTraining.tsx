import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import KidArt, { type KidGender, type Removing } from '../components/KidArt'
import Friend from '../components/Friend'
import { friendName } from '../friends'
import { useT } from '../i18n'
import { playTap, playSuccess, playPop, playNudge, unlockAudio } from '../audio'
import { speak } from '../speech'
import { playClip } from '../voice'
import type { GameProps } from './registry'

// Potty-training — a calm, NO-FAIL, errorless routine shown STEP BY STEP so a
// child sees each real moment: the camera zooms in while the pants slide off,
// then (when weaning) the diaper, leg by leg. Then the toilet: sit, or a boy
// stands and aims; the pee/poop clearly comes out; flush; wash hands; celebrate.
// Accidents in the pants are gentle ("no big deal"). Stars only ever go up.

type Char = 'boy' | 'girl' | 'friend'
type Need = 'pee' | 'poop'
// 'signal' — the interoception body-check step: the character stands calmly, the
// lower belly glows, and the child taps it ("מה הגוף אומר?") BEFORE the walk to
// the toilet. It sits between the calm intro/weaning and 'wait' (go-to-toilet).
type Step = 'intro' | 'signal' | 'wait' | 'walk' | 'atToilet' | 'go' | 'went' | 'flush' | 'wash' | 'cheer' | 'accident'

// "סיפור מרגיע" — a calm, first-person read-aloud story played BEFORE practice.
// First-person, descriptive, no-fail (Social Stories method). Each card: a soft
// emoji + a Hebrew line that is read aloud. The child taps through at their pace.
const STORY: { emoji: string; k: string }[] = [
  { emoji: '🧒', k: 'potty.story.s1' },
  { emoji: '💡', k: 'potty.story.s2' },
  { emoji: '👖', k: 'potty.story.s3' },
  { emoji: '🚽', k: 'potty.story.s4' },
  { emoji: '💧', k: 'potty.story.s5' },
  { emoji: '🧻', k: 'potty.story.s6' },
  { emoji: '👖', k: 'potty.story.s7' },
  { emoji: '🌊', k: 'potty.story.s8' },
  { emoji: '🧼', k: 'potty.story.s9' },
  { emoji: '🎉', k: 'potty.story.s10' },
]

export default function PottyTraining({ onExit, friend = 0 }: GameProps) {
  const { t } = useT()
  const [char, setChar] = useState<Char | null>(null)
  const [step, setStep] = useState<Step>('intro')
  const [need, setNeed] = useState<Need>('pee')
  const [pantsOn, setPantsOn] = useState(true)
  const [diaperOn, setDiaperOn] = useState(true)
  const [removing, setRemoving] = useState<Removing>(null)
  const [stars, setStars] = useState(0)
  const [story, setStory] = useState(false)
  const [storyI, setStoryI] = useState(0)
  // the boy's stream flows for a moment and then ENDS (pee is finite) — the yellow
  // puddle in the bowl stays as the result.
  const [peeFlow, setPeeFlow] = useState(false)
  // "עצור והמשך" (Stop & Go) — an optional play-scene mode opened from the picker.
  const [stopgo, setStopgo] = useState(false)
  // body-signal step: whether the belly has been tapped yet, and whether the gentle
  // "enlarge" hint is showing (after ~6s of no tap).
  const [bellyDone, setBellyDone] = useState(false)
  const [bellyHint, setBellyHint] = useState(false)

  const isBoy = char === 'boy'
  const aiming = isBoy && need === 'pee' && (step === 'go' || step === 'went')
  const sitting = (step === 'go' || step === 'went') && !aiming
  const zoom = removing !== null // a close-up plays while a garment comes off
  const name = char === 'friend' ? friendName(friend) : char === 'girl' ? t('potty.girl') : t('potty.boy')

  const tap = () => {
    unlockAudio()
    playTap()
  }
  const say = (x: string) => speak(x)

  // body-signal step: after ~6s with no tap, the belly glow gently enlarges as a
  // no-pressure hint. No timer keeps running once the belly is tapped or we leave.
  useEffect(() => {
    if (step !== 'signal' || bellyDone) return
    setBellyHint(false)
    const id = window.setTimeout(() => setBellyHint(true), 6000)
    return () => window.clearTimeout(id)
  }, [step, bellyDone])

  // enter the interoception body-check step (glow + "מה הגוף אומר?").
  function enterSignal(speakAsk = true) {
    setBellyDone(false)
    setBellyHint(false)
    setStep('signal')
    if (speakAsk) playClip('potty-signal-ask', t('potty.signal.ask'))
  }
  // tap the glowing belly → name where the signal is felt, then continue the routine.
  function tapBelly() {
    tap()
    setBellyHint(false)
    setBellyDone(true)
    playClip(need === 'pee' ? 'potty-signal-pee' : 'potty-signal-poop', need === 'pee' ? t('potty.signal.pee') : t('potty.signal.poop'))
    window.setTimeout(() => setStep('wait'), 1700)
  }

  function choose(c: Char) {
    tap()
    setChar(c)
    setStep('intro')
    setPantsOn(true)
    setDiaperOn(true)
    setRemoving(null)
    setNeed('pee')
  }

  // ── calming story ──
  function openStory() {
    tap()
    setStory(true)
    setStoryI(0)
    say(t(STORY[0].k))
  }
  function storyGo(i: number) {
    tap()
    setStoryI(i)
    say(t(STORY[i].k))
  }
  function endStory() {
    tap()
    setStory(false)
    setStoryI(0)
  }

  // weaning: take off the PANTS first, then the diaper — each one zoomed-in and
  // sliding off step by step, so it reads as a real "let's take it off" moment.
  function removeDiaper() {
    tap()
    setRemoving('pants')
    say(t('potty.undress.pants'))
    window.setTimeout(() => {
      setPantsOn(false)
      setRemoving('diaper')
      say(t('potty.undress.diaper'))
      window.setTimeout(() => {
        setDiaperOn(false)
        setRemoving(null)
        setPantsOn(true) // into clean big-kid pants
        setNeed('pee')
        // first the "from now on we go in the toilet" payoff, then straight into the
        // body-check step (its own caption shows the ask; we don't speak over it here).
        setBellyDone(false)
        setStep('signal')
        say(t('potty.weaned.say'))
      }, 1700)
    }, 1700)
  }
  function toToilet() {
    tap()
    setStep('walk')
    window.setTimeout(() => setStep('atToilet'), 1600)
  }
  function pantsDown() {
    tap()
    setRemoving('pants')
    say(t('potty.undress.pants'))
    window.setTimeout(() => {
      setPantsOn(false)
      setRemoving(null)
      setStep('go')
      // the potty jingle at the key sit/aim moment, right before going (research item C)
      playClip('potty-jingle', t('potty.jingle'))
    }, 1700)
  }
  function doGo() {
    playPop()
    setStep('went')
    if (need === 'pee') {
      setPeeFlow(true)
      window.setTimeout(() => setPeeFlow(false), 2600) // the stream ends by itself
    }
    say(need === 'pee' ? t('potty.pee.say') : t('potty.poop.say'))
  }
  function flush() {
    tap()
    setPantsOn(true) // pull the pants back up
    setStep('wash')
  }
  function wash() {
    tap()
    setStep('cheer')
    playSuccess()
    setStars((s) => s + 1)
    say(t('potty.cheer.say'))
  }
  function next() {
    tap()
    setNeed((n) => (n === 'pee' ? 'poop' : 'pee'))
    enterSignal() // next round starts with another body-check
  }
  function oops() {
    playNudge()
    setStep('accident')
    say(t('potty.oops.say'))
  }
  function cleanUp() {
    tap()
    setPantsOn(true)
    enterSignal() // after cleaning up, gently check the body again
  }

  // ── "עצור והמשך" (Stop & Go) — optional play-scene mode ──
  if (stopgo) {
    return <StopGoScene onExit={onExit} onBack={() => setStopgo(false)} />
  }

  // ── calming story (read-aloud, before practice) ──
  if (story) {
    const s = STORY[storyI]
    const isLast = storyI === STORY.length - 1
    return (
      <GameShell title={t('potty.story.title')} emoji="📖" onExit={onExit}>
        <div className="potty-story">
          <div className="ps-card" key={storyI}>
            <span className="ps-emoji" aria-hidden="true">{s.emoji}</span>
            <p className="ps-text">{t(s.k)}</p>
          </div>
          <div className="ps-dots" aria-hidden="true">
            {STORY.map((_, i) => (
              <span key={i} className={`ps-dot${i === storyI ? ' on' : ''}${i < storyI ? ' done' : ''}`} />
            ))}
          </div>
          <div className="ps-nav">
            {isLast ? (
              <button className="big-button potty-go" onClick={endStory}>🚽 {t('potty.story.practice')}</button>
            ) : (
              <button className="big-button potty-go" onClick={() => storyGo(storyI + 1)}>
                {t('potty.story.next')}
              </button>
            )}
            {storyI > 0 && (
              <button className="ps-back" onClick={() => storyGo(storyI - 1)}>
                {t('potty.story.back')}
              </button>
            )}
          </div>
        </div>
      </GameShell>
    )
  }

  // ── character picker ──
  if (!char) {
    return (
      <GameShell title={t('game.potty')} emoji="🚽" onExit={onExit}>
        <p className="pet-pick-title">{t('potty.pick')}</p>
        <div className="potty-pick">
          <button className="potty-pick-btn" onClick={() => choose('boy')}>
            <span className="potty-pick-fig"><KidArt gender="boy" pantsOn diaperOn={false} /></span>
            <span>{t('potty.boy')}</span>
          </button>
          <button className="potty-pick-btn" onClick={() => choose('girl')}>
            <span className="potty-pick-fig"><KidArt gender="girl" pantsOn diaperOn={false} /></span>
            <span>{t('potty.girl')}</span>
          </button>
          <button className="potty-pick-btn" onClick={() => choose('friend')}>
            <span className="potty-pick-fig potty-pick-friend">
              <Friend index={friend} scale={0.5} showNumber={false} />
            </span>
            <span>{t('pet.pickFriend')}</span>
          </button>
        </div>
        <div className="potty-modes">
          <button className="potty-story-btn" onClick={openStory}>
            📖 {t('potty.story.open')}
          </button>
          <button
            className="potty-stopgo-btn"
            onClick={() => {
              tap()
              setStopgo(true)
            }}
          >
            🧱 {t('potty.mode.stopgo')}
          </button>
        </div>
      </GameShell>
    )
  }

  const figure =
    char === 'friend' ? (
      <span className="potty-friend" style={{ fontSize: 0 }}>
        <Friend index={friend} scale={0.72} showNumber={false} />
      </span>
    ) : (
      <KidArt
        gender={char as KidGender}
        pantsOn={pantsOn}
        diaperOn={diaperOn}
        removing={removing}
        bulbul={isBoy && !pantsOn && !diaperOn && removing === null}
        peeing={aiming && step === 'went' && peeFlow}
        washing={step === 'wash'}
      />
    )

  // bubble text — narrate the current micro-step
  const bubble =
    removing === 'pants'
      ? t('potty.undress.pants')
      : removing === 'diaper'
        ? t('potty.undress.diaper')
        : step === 'intro'
          ? t('potty.intro').replace('{name}', name)
          : step === 'signal'
            ? bellyDone
              ? need === 'pee'
                ? t('potty.signal.pee')
                : t('potty.signal.poop')
              : t('potty.signal.ask')
            : step === 'wait'
            ? need === 'pee'
              ? t('potty.need.pee')
              : t('potty.need.poop')
            : step === 'go'
              ? aiming
                ? t('potty.aim')
                : need === 'pee'
                  ? t('potty.sit.pee')
                  : t('potty.sit.poop')
              : step === 'cheer'
                ? t('potty.cheer')
                : step === 'accident'
                  ? t('potty.oops')
                  : ''

  return (
    <GameShell title={t('game.potty')} emoji="🚽" onExit={onExit}>
      <div className="potty-stars">
        {'⭐'.repeat(Math.min(stars, 10))}
        <span className="potty-star-num">{stars}</span>
      </div>

      <div
        className={`potty-room step-${step} ${aiming ? 'is-aiming' : ''} ${sitting ? 'is-sitting' : ''} ${
          zoom ? 'is-zoom' : ''
        } need-${need}`}
      >
        {/* the toilet — a big, clear fixture that's always there */}
        <span className="potty-toilet" aria-hidden="true">
          <span className="pt-tank" />
          <span className="pt-flush" />
          <span className="pt-lid" />
          <span className="pt-seat" />
          <span className="pt-kidseat" />
          <span className="pt-bowl" />
          <span className="pt-base" />
          {need === 'pee' ? <span className="pt-pee" /> : <span className="pt-result">💩</span>}
        </span>
        <span className="potty-sink" aria-hidden="true">
          <span className="ps-basin" />
          {step === 'wash' && <span className="ps-water" />}
        </span>

        {/* the character */}
        <span className={`potty-char ${step === 'walk' ? 'is-walking' : ''} ${char === 'friend' ? 'is-friend' : ''}`}>
          {bubble && (
            <span className="potty-bubble" key={step + need + String(removing)}>
              {bubble}
            </span>
          )}
          {step === 'accident' && <span className="potty-puddle" aria-hidden="true">💦</span>}
          {figure}
          {/* interoception: the lower belly glows softly; tapping it names the signal.
              No-fail — tapping elsewhere does nothing; after ~6s it enlarges as a hint. */}
          {step === 'signal' && !bellyDone && (
            <button
              type="button"
              className={`potty-belly${bellyHint ? ' hint' : ''}`}
              onClick={tapBelly}
              aria-label={t('potty.signal.ask')}
            />
          )}
        </span>
      </div>

      {/* the one big action button for the current step (hidden while a zoom plays) */}
      <div className="potty-actions">
        {removing && <p className="potty-hint">✨ {t('potty.step')}</p>}
        {!removing && step === 'intro' && (
          <button className="big-button potty-go" onClick={removeDiaper}>
            🧷 {t('potty.btn.removeDiaper')}
          </button>
        )}
        {!removing && step === 'wait' && (
          <>
            <button className="big-button potty-go" onClick={toToilet}>
              🚽 {t('potty.btn.toToilet')}
            </button>
            <button className="potty-oops" onClick={oops}>
              💦 {t('potty.btn.oops')}
            </button>
          </>
        )}
        {step === 'walk' && <p className="potty-hint">🚶 {t('potty.walking')}</p>}
        {!removing && step === 'atToilet' && (
          <button className="big-button potty-go" onClick={pantsDown}>
            👖 {t('potty.btn.pantsDown')}
          </button>
        )}
        {step === 'go' && <p className="potty-jingle">🎵 {t('potty.jingle')}</p>}
        {step === 'go' && (
          <button className="big-button potty-go" onClick={doGo}>
            {need === 'pee' ? `💧 ${t('potty.btn.pee')}` : `💩 ${t('potty.btn.poop')}`}
          </button>
        )}
        {step === 'went' && (
          <button className="big-button potty-go" onClick={flush}>
            🚽 {t('potty.btn.flush')}
          </button>
        )}
        {step === 'wash' && (
          <button className="big-button potty-go" onClick={wash}>
            🧼 {t('potty.btn.wash')}
          </button>
        )}
        {step === 'cheer' && (
          <button className="big-button potty-go" onClick={next}>
            🎉 {t('potty.btn.again')}
          </button>
        )}
        {step === 'accident' && (
          <button className="big-button potty-go" onClick={cleanUp}>
            🧽 {t('potty.btn.clean')}
          </button>
        )}
      </div>
    </GameShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// "עצור והמשך" (Stop & Go) — the Daniel-Tiger interruption mechanic. The child
// builds a little number tower (tap block 1, then 2, counting aloud). After the
// 2nd block the character starts a gentle potty-dance and a soft toilet button
// appears: "הגוף אומר משהו! עוצרים והולכים?". Tapping the toilet FREEZES the
// tower ("מחכים לך"), runs a SHORT toilet sequence, then the tower brightens
// ("הכול חיכה לך!") and the last block completes it — calm celebration. Ignoring
// the signal costs NOTHING: the dance keeps going and the prompt repeats once.
// ─────────────────────────────────────────────────────────────────────────────
function StopGoScene({ onExit, onBack }: { onExit: () => void; onBack: () => void }) {
  const { t } = useT()
  const [stacked, setStacked] = useState(0) // blocks placed on the tower (0..3)
  const [dance, setDance] = useState(false) // potty-dance + toilet button active
  const [phase, setPhase] = useState<'play' | 'potty' | 'resume' | 'done'>('play')
  const [pStep, setPStep] = useState<'walk' | 'sit' | 'go' | 'wash' | null>(null)

  const timers = useRef<number[]>([])
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  // greet on open; clear any pending timers on unmount (no setState after unmount)
  useEffect(() => {
    playClip('potty-sg-play', t('potty.sg.play'))
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function placeBlock() {
    unlockAudio()
    playPop()
    const n = stacked + 1
    setStacked(n)
    playClip(n === 1 ? 'potty-sg-n1' : 'potty-sg-n2', n === 1 ? t('potty.sg.n1') : t('potty.sg.n2'))
    if (n >= 2) {
      // the body signals mid-play — start the gentle dance a beat after the count
      later(() => {
        setDance(true)
        playClip('potty-sg-signal', t('potty.sg.signal'))
        // no-fail: if the child ignores it, just repeat the prompt once, softly
        later(() => {
          if (phaseRef.current === 'play') playClip('potty-sg-signal', t('potty.sg.signal'))
        }, 6000)
      }, 800)
    }
  }

  function goPotty() {
    unlockAudio()
    playTap()
    setPhase('potty')
    setPStep('walk')
    later(() => {
      setPStep('sit')
      playClip('potty-jingle', t('potty.jingle')) // the jingle at the sit/aim moment (research item C)
    }, 1500)
  }
  function sgGo() {
    playPop()
    setPStep('go')
    speak(t('potty.pee.say'))
  }
  function sgWash() {
    playTap()
    setPStep('wash')
    later(() => {
      setPStep(null)
      setPhase('resume')
      playClip('potty-sg-back', t('potty.sg.back')) // "הכול חיכה לך!"
      later(() => {
        setStacked(3) // the last block finishes the tower
        playClip('potty-sg-n3', t('potty.sg.n3'))
        later(() => {
          setPhase('done')
          playSuccess()
          playClip('potty-sg-cheer', t('potty.sg.cheer'))
        }, 1100)
      }, 1700)
    }, 1500)
  }
  function replay() {
    playTap()
    clearTimers()
    setStacked(0)
    setDance(false)
    setPStep(null)
    setPhase('play')
  }

  const frozen = phase === 'potty'
  const caption =
    phase === 'done'
      ? t('potty.sg.cheer')
      : phase === 'resume'
        ? t('potty.sg.back')
        : phase === 'potty'
          ? pStep === 'walk'
            ? t('potty.walking')
            : pStep === 'sit'
              ? t('potty.jingle')
              : pStep === 'go'
                ? t('potty.pee.say')
                : t('potty.btn.wash')
          : dance
            ? t('potty.sg.signal')
            : t('potty.sg.play')

  return (
    <GameShell title={t('potty.mode.stopgo')} emoji="🧱" onExit={onExit}>
      <div
        className={`sg-scene phase-${phase}${dance && phase === 'play' ? ' is-dancing' : ''}${
          frozen ? ' is-frozen' : ''
        }${pStep ? ` p-${pStep}` : ''}`}
      >
        <span className="sg-caption" key={caption}>
          {caption}
        </span>

        {/* the number tower — it stays exactly where it is and waits while we go */}
        <span className="sg-tower">
          {Array.from({ length: stacked }).map((_, i) => (
            <span className="sg-block" key={i}>
              {i + 1}
            </span>
          ))}
          {frozen && <span className="sg-wait-tag">⏳ {t('potty.sg.wait')}</span>}
        </span>

        {/* the toilet is only present for the short go-sequence */}
        {phase === 'potty' && (
          <span className="sg-toilet" aria-hidden="true">
            🚽{pStep === 'go' && <span className="sg-drop">💧</span>}
          </span>
        )}

        {/* the character — KidArt (has legs, so the knees-together dance reads) */}
        <span className="sg-char">
          <KidArt gender="boy" pantsOn washing={pStep === 'wash'} />
        </span>
      </div>

      <div className="potty-actions">
        {phase === 'play' && !dance && stacked < 2 && (
          <button className="big-button sg-block-btn" onClick={placeBlock} aria-label={String(stacked + 1)}>
            🧱 {stacked + 1}
          </button>
        )}
        {phase === 'play' && dance && (
          <button className="big-button potty-go" onClick={goPotty}>
            🚽 {t('potty.btn.toToilet')}
          </button>
        )}
        {phase === 'potty' && pStep === 'sit' && (
          <button className="big-button potty-go" onClick={sgGo}>
            💧 {t('potty.btn.pee')}
          </button>
        )}
        {phase === 'potty' && pStep === 'go' && (
          <button className="big-button potty-go" onClick={sgWash}>
            🚽 {t('potty.btn.flush')}
          </button>
        )}
        {phase === 'potty' && (pStep === 'walk' || pStep === 'wash') && (
          <p className="potty-hint">✨ {caption}</p>
        )}
        {phase === 'resume' && <p className="potty-hint">✨ {t('potty.sg.back')}</p>}
        {phase === 'done' && (
          <button className="big-button potty-go" onClick={replay}>
            🎉 {t('potty.btn.again')}
          </button>
        )}
        <button
          className="ps-back"
          onClick={() => {
            playTap()
            onBack()
          }}
        >
          {t('potty.story.back')}
        </button>
      </div>
    </GameShell>
  )
}
