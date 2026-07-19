import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPop, playSuccess, playMunch, playNudge, playTap, unlockAudio } from '../audio'
import { randFriendIndex, friendCount } from '../level'
import { useGameLevel } from '../gameLevel'
import { randInt } from './util'
import { useT } from '../i18n'

// Ice-cream PARLOUR: Assaf scoops "flavours" (colours) onto a cone and decorates
// it with toppings — chocolate sauce, whipped cream, sprinkles, a cherry. Two
// modes:
//   FREE  — build whatever you like; tap the friend to hand it over (no button)
//   ORDER — a friend orders some scoops, build the matching cone and serve.
// No harsh fail: a wrong order just gets a gentle nudge so he can fix it.
// brighter pastel flavours (QA: the old tub icons read too dark) — each is
// painted with a lit radial gradient in CSS from this base colour
const FLAVORS = [
  { key: 'vanilla', color: '#f6e6b8' },
  { key: 'choc', color: '#a9764a' },
  { key: 'straw', color: '#f9a8cb' },
  { key: 'mint', color: '#9fe8bf' },
  { key: 'blue', color: '#a3cdf5' },
  { key: 'lemon', color: '#f8e05f' },
]
// toppings sit on top of the scoops (order = how they layer, top of cone down)
const TOPPINGS = ['cherry', 'cream', 'choc', 'sprinkles'] as const
type Topping = (typeof TOPPINGS)[number]
const MAX_SCOOPS = 5

// ORDER-MODE difficulty (the shared header <LevelButton>): only the הזמנות mode
// grows — a taller order = more scoops to match. FREE (חופשי) build is untouched
// (nothing to make harder there). קל · בינוני · קשה · אלוף.
const LEVEL_TIERS = [0, 1, 2, 3]
const ORDER_RANGE: [number, number][] = [
  [1, 2], // קל — one or two scoops
  [2, 3], // בינוני
  [2, 4], // קשה
  [3, 5], // אלוף — a real tower to read + reproduce
]
function makeOrder(level: number) {
  const [lo, hi] = ORDER_RANGE[level] ?? [2, 4]
  return Array.from({ length: randInt(lo, hi) }, () => randInt(0, FLAVORS.length - 1))
}
function nextFriend(prev: number) {
  let n = randFriendIndex()
  if (friendCount() > 1) while (n === prev) n = randFriendIndex()
  return n
}
function sameMulti(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort((x, y) => x - y)
  const sb = [...b].sort((x, y) => x - y)
  return sa.every((v, i) => v === sb[i])
}
const scaleFor = (idx: number, h: number) => h / FRIEND_NATURAL[friendKindForIndex(idx)].h

export default function IceCreamGame({ onExit, friend }: GameProps) {
  const { t, tAddr } = useT()
  // per-game difficulty from the shared header control (order complexity grows).
  const [level] = useGameLevel('icecream', LEVEL_TIERS)
  const [mode, setMode] = useState<'open' | 'closed'>('open')
  const [scoops, setScoops] = useState<number[]>([])
  const [toppings, setToppings] = useState<Topping[]>([])
  const [customer, setCustomer] = useState(() => friend ?? randFriendIndex())
  const [order, setOrder] = useState<number[]>(() => makeOrder(level))
  const [queue, setQueue] = useState<number[]>([])
  const [happy, setHappy] = useState(false)
  const [served, setServed] = useState(0)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => {
    const q: number[] = []
    let last = customer
    for (let i = 0; i < 3; i++) {
      last = nextFriend(last)
      q.push(last)
    }
    setQueue(q)
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addScoop(i: number) {
    if (happy || scoops.length >= MAX_SCOOPS) return
    unlockAudio()
    playPop()
    setScoops((s) => [...s, i])
  }
  function toggleTopping(kind: Topping) {
    if (happy || !scoops.length) return // need ice cream before toppings
    unlockAudio()
    playPop()
    setToppings((tp) => (tp.includes(kind) ? tp.filter((k) => k !== kind) : [...tp, kind]))
  }
  function undo() {
    if (happy) return
    playTap()
    if (toppings.length) setToppings((tp) => tp.slice(0, -1))
    else if (scoops.length) setScoops((s) => s.slice(0, -1))
  }

  function nextCustomer() {
    setQueue((q) => {
      const [next, ...rest] = q
      const nc = next ?? nextFriend(customer)
      setCustomer(nc)
      setOrder(makeOrder(level))
      const tailFrom = rest.length ? rest[rest.length - 1] : nc
      return [...rest, nextFriend(tailFrom)]
    })
  }

  // hand the cone to the friend (free mode = tap the friend; order mode = serve)
  function give(checkOrder: boolean) {
    if (happy || !scoops.length) return
    unlockAudio()
    if (checkOrder && !sameMulti(scoops, order)) {
      playNudge() // gentle — let him fix the cone
      return
    }
    playSuccess()
    setHappy(true)
    setServed((n) => n + 1)
    timers.current.push(window.setTimeout(() => playMunch(), 350))
    timers.current.push(
      window.setTimeout(() => {
        setHappy(false)
        setScoops([])
        setToppings([])
        if (mode === 'closed') nextCustomer()
        else setCustomer((c) => nextFriend(c))
      }, 1600),
    )
  }

  function switchMode(m: 'open' | 'closed') {
    if (m === mode) return
    playTap()
    clearTimers()
    setMode(m)
    setScoops([])
    setToppings([])
    setHappy(false)
    if (m === 'closed') setOrder(makeOrder(level))
  }

  // switching difficulty from the header re-issues the current order at the new
  // complexity (order mode only; skip the first render — already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    if (mode === 'closed' && !happy) setOrder(makeOrder(level))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const has = (k: Topping) => toppings.includes(k)

  return (
    <GameShell title={t('game.icecream')} emoji="🍦" onExit={onExit} levels={{ gameId: 'icecream', tiers: LEVEL_TIERS }}>
      <div className="ice-screen">
        {/* header row: mode toggle + served counter */}
        <div className="ice-modes">
          <button className={`ice-mode-btn ${mode === 'open' ? 'on' : ''}`} onClick={() => switchMode('open')}>
            🍨 {t('ice.open')}
          </button>
          <button className={`ice-mode-btn ${mode === 'closed' ? 'on' : ''}`} onClick={() => switchMode('closed')}>
            📋 {t('ice.closed')}
          </button>
          <span className="ice-score score-pill" aria-hidden="true">
            🍦 {served}
          </span>
        </div>

        {/* the PARLOUR — one grounded scene (art doctrine "scene, not emoji on
            blue"): a striped awning integrated at the top, a back wall with soft
            window light, the waiting queue, the customer standing BEHIND a marble
            counter (feet occluded = grounded), and the cone being built ON the
            counter right in front of / under the friend. No mid-screen gap. */}
        <div className="ice-parlour">
          {/* the far back plane — a baked gelateria wall, shelf of tubs, window
              light + receding floor (SceneBackdrop, calm/perf rules) */}
          <SceneBackdrop src="icecream-parlour.jpg" position="center bottom" scrim="soft" />
          <div className="ice-awning" aria-hidden="true">
            <span className="ice-sign">🍨 {t('ice.parlor')} 🍦</span>
          </div>
          <span className="ice-window" aria-hidden="true" />

          {mode === 'closed' && (
            <div className="ice-queue" aria-hidden="true">
              {queue.map((q, i) => (
                <span key={`${q}-${i}`} className="ice-q">
                  <Friend index={q} scale={scaleFor(q, 40)} showNumber={false} />
                </span>
              ))}
            </div>
          )}

          {/* the customer, standing on the parlour floor behind the counter */}
          {mode === 'open' ? (
            <button
              className={`ice-customer as-btn ${happy ? 'happy' : ''}`}
              onClick={() => give(false)}
              aria-label={tAddr('ice.give')}
            >
              <Friend index={customer} scale={scaleFor(customer, 100)} lively />
            </button>
          ) : (
            <div className={`ice-customer ${happy ? 'happy' : ''}`}>
              <Friend index={customer} scale={scaleFor(customer, 100)} lively />
            </div>
          )}

          {/* the speech bubble: what they want (closed) / prompt (open) / yum */}
          <div className="ice-bubble">
            {happy ? (
              <span className="ice-yum">😋</span>
            ) : mode === 'closed' ? (
              <span className="ice-order">
                {order.map((f, i) => (
                  <span key={i} className="ice-dot" style={{ background: FLAVORS[f].color }} />
                ))}
              </span>
            ) : (
              <span className="ice-free">{scoops.length ? tAddr('ice.give') : t('ice.free')}</span>
            )}
          </div>

          {/* the marble counter (foreground plane) that occludes the friend's feet */}
          <span className="ice-counter" aria-hidden="true" />

          {/* the cone being built, standing ON the counter in front of the friend */}
          <div className={`ice-cone ${happy ? 'served' : ''}`}>
            <div className="ice-scoops">
              {has('cherry') && <span className="ice-top-cherry" aria-hidden="true">🍒</span>}
              {has('cream') && <span className="ice-top-cream" aria-hidden="true" />}
              {has('choc') && <span className="ice-top-choc" aria-hidden="true" />}
              {has('sprinkles') && (
                <span className="ice-top-sprinkles" aria-hidden="true">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <i key={i} style={{ background: FLAVORS[i % FLAVORS.length].color }} />
                  ))}
                </span>
              )}
              {scoops
                .map((f, i) => ({ f, i }))
                .reverse()
                .map(({ f, i }) => (
                  <span key={i} className="ice-scoop" style={{ ['--fl' as string]: FLAVORS[f].color }} />
                ))}
            </div>
            <span className="ice-cone-base" aria-hidden="true" />
          </div>
        </div>

        {/* the flavour tubs — tap to scoop that flavour */}
        <div className="ice-stand">
          {FLAVORS.map((fl, i) => (
            <button key={fl.key} className="ice-tub" onClick={() => addScoop(i)} aria-label={fl.key}>
              <span className="ice-tub-scoop" style={{ ['--fl' as string]: fl.color }} />
            </button>
          ))}
        </div>

        {/* the toppings bar */}
        <div className="ice-toppings-bar">
          {TOPPINGS.map((k) => (
            <button
              key={k}
              className={`ice-top-btn ${has(k) ? 'on' : ''}`}
              onClick={() => toggleTopping(k)}
              disabled={!scoops.length}
              aria-label={t(`ice.top.${k}`)}
            >
              <span className={`ice-top-ic ic-${k}`} aria-hidden="true">
                {k === 'cherry' ? '🍒' : ''}
              </span>
              <span className="ice-top-name">{t(`ice.top.${k}`)}</span>
            </button>
          ))}
        </div>

        {/* actions */}
        <div className="ice-actions">
          <button className="dance-ctrl" onClick={undo} disabled={happy || (!scoops.length && !toppings.length)} aria-label={t('ice.undo')}>
            <span aria-hidden="true">↩️</span>
          </button>
          {mode === 'closed' ? (
            <button className="big-button ice-serve" onClick={() => give(true)} disabled={happy || !scoops.length}>
              {t('ice.serve')} 🍦
            </button>
          ) : (
            <span className="ice-hint">{scoops.length ? `👆 ${tAddr('ice.give')}` : tAddr('ice.buildHint')}</span>
          )}
        </div>
      </div>
    </GameShell>
  )
}
