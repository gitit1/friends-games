import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import IconButton from '../components/IconButton'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playTap, unlockAudio } from '../audio'
import { randFriendIndex, friendCount } from '../level'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'

// "Parrot": a parrot perches on the chosen friend and LISTENS. When the child
// pauses (or after 6s), it repeats what was said in a funny high parrot voice —
// like a real parrot, no record button. Everything runs inside ONE Web Audio
// context (capture + playback), which is what makes it work repeatedly on iOS
// Safari — an <audio> element or MediaRecorder there suspends the mic after one
// go. No timer, no win/lose. Needs mic permission (asked once).
const SPEAK = 0.045 // RMS above this = the child is speaking
const SILENCE = 0.025 // RMS below this = quiet
const PAUSE_MS = 650 // this much quiet after speech → repeat
const MIN_SPEECH_MS = 250 // ignore tiny blips
const MAX_UTTER_MS = 6000 // repeat on a pause OR after 6s — whichever first
const PITCH = 1.45 // parrot voice = higher & quicker

export default function ParrotGame({ onExit, friend }: GameProps) {
  const { t } = useT()
  const vp = useViewport()
  const [who, setWho] = useState(() => friend ?? randFriendIndex())
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<'off' | 'listen' | 'repeat'>('off')
  const [denied, setDenied] = useState(false)

  const acRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const nodeRef = useRef<AudioBufferSourceNode | null>(null)
  const onRef = useRef(false)
  const capturingRef = useRef(false)
  const repeatingRef = useRef(false)
  const buffersRef = useRef<Float32Array[]>([])
  const captureStartRef = useRef(0)
  const lastLoudRef = useRef(0)

  function stopAll() {
    onRef.current = false
    capturingRef.current = false
    repeatingRef.current = false
    buffersRef.current = []
    try {
      nodeRef.current?.stop()
    } catch {
      /* already stopped */
    }
    nodeRef.current = null
    const proc = procRef.current
    if (proc) {
      proc.onaudioprocess = null
      proc.disconnect()
    }
    procRef.current = null
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    acRef.current?.close().catch(() => {})
    acRef.current = null
  }
  useEffect(() => () => stopAll(), [])

  // play the captured phrase back through Web Audio (same context as the mic →
  // robust on iOS). The higher playbackRate IS the parrot voice.
  function repeatPhrase(chunks: Float32Array[]) {
    const ac = acRef.current
    if (!ac || !chunks.length) {
      repeatingRef.current = false
      if (onRef.current) setStatus('listen')
      return
    }
    let len = 0
    for (const c of chunks) len += c.length
    const data = new Float32Array(len)
    let o = 0
    for (const c of chunks) {
      data.set(c, o)
      o += c.length
    }
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    buf.copyToChannel(data, 0)
    const node = ac.createBufferSource()
    node.buffer = buf
    node.playbackRate.value = PITCH
    node.connect(ac.destination)
    nodeRef.current = node
    repeatingRef.current = true
    setStatus('repeat')
    node.onended = () => {
      repeatingRef.current = false
      nodeRef.current = null
      if (onRef.current) setStatus('listen')
    }
    node.start()
  }

  // voice-activity detection, called for every audio block from the mic
  function onAudio(input: Float32Array) {
    if (!onRef.current || repeatingRef.current) return
    let s = 0
    for (let i = 0; i < input.length; i++) s += input[i] * input[i]
    const level = Math.sqrt(s / input.length)
    const now = performance.now()
    if (!capturingRef.current) {
      if (level > SPEAK) {
        capturingRef.current = true
        captureStartRef.current = now
        lastLoudRef.current = now
        buffersRef.current = [new Float32Array(input)]
      }
    } else {
      buffersRef.current.push(new Float32Array(input))
      if (level > SILENCE) lastLoudRef.current = now
      const dur = now - captureStartRef.current
      const quiet = now - lastLoudRef.current
      if (dur > MAX_UTTER_MS || quiet > PAUSE_MS) {
        capturingRef.current = false
        const chunks = buffersRef.current
        buffersRef.current = []
        if (dur > MIN_SPEECH_MS) repeatPhrase(chunks)
      }
    }
  }

  async function start() {
    unlockAudio()
    if (!navigator.mediaDevices) {
      setDenied(true)
      return
    }
    try {
      // create the context inside the tap gesture (iOS), before any await
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ac = new AC()
      acRef.current = ac
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      await ac.resume().catch(() => {})
      const src = ac.createMediaStreamSource(stream)
      const proc = ac.createScriptProcessor(2048, 1, 1)
      const sink = ac.createGain()
      sink.gain.value = 0 // process silently — don't echo the live mic to the speakers
      proc.onaudioprocess = (e) => onAudio(e.inputBuffer.getChannelData(0))
      src.connect(proc)
      proc.connect(sink)
      sink.connect(ac.destination)
      procRef.current = proc
      onRef.current = true
      setListening(true)
      setStatus('listen')
      setDenied(false)
    } catch {
      stopAll()
      setDenied(true)
    }
  }
  function toggle() {
    playTap()
    if (listening) {
      stopAll()
      setListening(false)
      setStatus('off')
    } else {
      start()
    }
  }
  // page through the friends by number to choose who the parrot sits on
  function go(d: number) {
    playTap()
    const c = friendCount()
    setWho((who + d + c) % c)
  }

  const nat = FRIEND_NATURAL[friendKindForIndex(who)]
  const scale = Math.min((vp.h * 0.26) / nat.h, (vp.w * 0.55) / nat.w)
  const tip = denied
    ? t('parrot.denied')
    : status === 'repeat'
      ? t('parrot.repeating')
      : status === 'listen'
        ? t('parrot.listening')
        : t('parrot.tip')

  const parrotState = status === 'repeat' ? 'talk' : status === 'listen' ? 'listen' : ''

  return (
    <GameShell title={t('game.parrot')} emoji="🦜" onExit={onExit}>
      <div className="parrot-screen">
        {/* number navigation — choose which friend hosts the parrot. The friend's
            own number halo is hidden (showNumber=false) so this "22" is the only
            one on screen (it used to appear twice). */}
        <div className="world-nav">
          <IconButton icon="◀" label={t('nav.prev')} onClick={() => go(-1)} />
          <span className="world-nav-num" aria-hidden="true">
            {who + 1}
          </span>
          <IconButton icon="▶" label={t('nav.next')} onClick={() => go(1)} />
        </div>

        {/* a warm parrot corner: an ILLUSTRATED backdrop (baked room wall with soft
            tropical leaves, window light + receding wood floor) behind a wooden perch.
            The scene is CLIPPED; the friend + parrot are siblings OVER it. */}
        <div className="parrot-stage">
          <div className="parrot-scene" aria-hidden="true">
            <SceneBackdrop src="parrot-corner.jpg" position="center 44%" scrim="soft" />
          </div>

          <div className="parrot-host">
            <Friend index={who} scale={scale} lively showNumber={false} />
          </div>

          {/* the perch + the parrot — a REAL baked illustrated bird composed of four
              registered baked-art layers (body, near wing, lower beak, blink lid) so
              it can flutter its wing, sync its beak open, blink and bob using ONLY
              transform/opacity while the pixels stay illustration, never CSS shapes. */}
          <div className="parrot-perch" aria-hidden="true">
            <span className="parrot-branch" />
            <span className={`parrot ${parrotState}`}>
              <span className="parrot-actor">
                <span className="parrot-art parrot-l-body" />
                <span className="parrot-art parrot-l-wing" />
                <span className="parrot-art parrot-l-beak" />
                <span className="parrot-art parrot-l-blink" />
              </span>
            </span>
          </div>
        </div>

        <button className={`big-button parrot-listen ${listening ? 'on' : ''}`} onClick={toggle}>
          <span aria-hidden="true">{listening ? '⏹️' : '🦜'}</span> {listening ? t('parrot.stop') : t('parrot.start')}
        </button>

        <p className="parrot-tip">{tip}</p>
      </div>
    </GameShell>
  )
}
