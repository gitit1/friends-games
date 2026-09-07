import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPop, playSuccess, playMunch, playTap, unlockAudio } from '../audio'
import { randFriendIndex } from '../level'
import { useT } from '../i18n'

// Cake maker: a free, creative builder — stack cake layers, add frosting and
// decorations (candles, cherry, strawberry, sprinkles), then TAP THE FRIEND to
// give it (a little party). No timer, no fail — pure creating.
//
// A FREE-PLAY creative toy (no order/recipe goal) → no header difficulty control,
// same as draw / parrot / pet. The build/decorate LOGIC is frozen; this screen's
// upgrade is all MATERIALS: every sponge tier, the frosting crown, the toppings
// and the cake stand are REAL baked sprites (public/art/sprites/cake/, baked
// crumb/curvature/AO), not CSS shapes — and the cake sits on a grounded, camera-
// angled stand with a baked contact shadow (depth).
const LAYERS = [
  { key: 'vanilla' },
  { key: 'choc' },
  { key: 'straw' },
  { key: 'lemon' },
] as const
const DECOR = ['frosting', 'cherry', 'candle', 'strawberry', 'sprinkles'] as const
type Decor = (typeof DECOR)[number]
const MAX_LAYERS = 5
const scaleFor = (idx: number, h: number) => h / FRIEND_NATURAL[friendKindForIndex(idx)].h

export default function CakeMaker({ onExit, friend }: GameProps) {
  const { t, tAddr } = useT()
  const [layers, setLayers] = useState<number[]>([])
  const [decor, setDecor] = useState<Decor[]>([])
  const [customer, setCustomer] = useState(() => friend ?? randFriendIndex())
  const [happy, setHappy] = useState(false)
  const [made, setMade] = useState(0)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  function addLayer(i: number) {
    if (happy || layers.length >= MAX_LAYERS) return
    unlockAudio()
    playPop()
    setLayers((l) => [...l, i])
  }
  function toggleDecor(k: Decor) {
    if (happy || !layers.length) return
    unlockAudio()
    playPop()
    setDecor((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]))
  }
  function undo() {
    if (happy) return
    playTap()
    if (decor.length) setDecor((d) => d.slice(0, -1))
    else if (layers.length) setLayers((l) => l.slice(0, -1))
  }
  function give() {
    if (happy || !layers.length) return
    unlockAudio()
    playSuccess()
    setHappy(true)
    setMade((n) => n + 1)
    timers.current.push(window.setTimeout(() => playMunch(), 400))
    timers.current.push(
      window.setTimeout(() => {
        setHappy(false)
        setLayers([])
        setDecor([])
        setCustomer(randFriendIndex())
      }, 1800),
    )
  }
  const has = (k: Decor) => decor.includes(k)

  return (
    <GameShell title={t('game.cake')} emoji="🎂" onExit={onExit}>
      <div className="cake-screen center-body">
        <span className="score-pill" aria-hidden="true">🎂 {made}</span>

        {/* cozy bakery back plane (baked CC0) behind the making stage */}
        <div className="cake-scene">
          <SceneBackdrop src="bakery.jpg" position="center 44%" scrim="soft" />
          <div className="cake-stage">
            {/* tap the friend to give the cake */}
            <button className={`cake-friend ${happy ? 'happy' : ''}`} onClick={give} aria-label={tAddr('cake.give')}>
              <Friend index={customer} scale={scaleFor(customer, 92)} lively bouncing={happy} />
            </button>

            {/* the cake being built — real baked sponge tiers on a grounded stand */}
            <div className="cake">
              {happy && <span className="cake-party" aria-hidden="true">🎉</span>}
              <div className="cake-build">
                <div className={`cake-stack ${has('frosting') ? 'frosted' : ''}`}>
                  {layers.length > 0 && (
                    <>
                      {/* toppings + crown, pinned over the top tier */}
                      <span className="cake-toppers" aria-hidden="true">
                        {has('candle') && (
                          <span className="cake-candles">
                            <i className="cake-candle" />
                            <i className="cake-candle" />
                            <i className="cake-candle" />
                          </span>
                        )}
                        <span className="cake-fruits">
                          {has('strawberry') && <span className="cake-top cake-straw" />}
                          {has('cherry') && <span className="cake-top cake-cherry" />}
                        </span>
                      </span>
                      {has('frosting') && <span className="cake-crown" aria-hidden="true" />}
                      {has('sprinkles') && <span className="cake-sprinkles" aria-hidden="true" />}
                    </>
                  )}
                  {layers
                    .map((f, i) => ({ f, i }))
                    .reverse()
                    .map(({ f, i }) => (
                      <span
                        key={i}
                        className="cake-layer"
                        data-flavor={LAYERS[f].key}
                        aria-hidden="true"
                      />
                    ))}
                  {layers.length === 0 && <span className="cake-empty" aria-hidden="true" />}
                </div>
                <span className="cake-plate" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* the cake-layer flavours — real baked sponge thumbnails */}
        <div className="cake-row">
          {LAYERS.map((l) => (
            <button key={l.key} className="cake-tub" onClick={() => addLayer(LAYERS.indexOf(l))} aria-label={l.key}>
              <span className="cake-tub-layer" data-flavor={l.key} aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* decorations — real baked topping thumbnails */}
        <div className="cake-decor-bar">
          {DECOR.map((k) => (
            <button
              key={k}
              className={`cake-decor-btn ${has(k) ? 'on' : ''}`}
              onClick={() => toggleDecor(k)}
              disabled={!layers.length}
              aria-label={t(`cake.${k}`)}
            >
              <span className={`cake-decor-ic ic-${k}`} aria-hidden="true" />
              <span className="cake-decor-name">{t(`cake.${k}`)}</span>
            </button>
          ))}
        </div>

        <div className="cake-actions">
          <button className="dance-ctrl" onClick={undo} disabled={happy || (!layers.length && !decor.length)} aria-label={t('ice.undo')}>
            <span aria-hidden="true">↩️</span>
          </button>
          <span className="cake-hint">{layers.length ? `👆 ${tAddr('cake.give')}` : tAddr('cake.hint')}</span>
        </div>
      </div>
    </GameShell>
  )
}
