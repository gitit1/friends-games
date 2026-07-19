import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { FRIEND_NATURAL, friendKindForIndex } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPop, playSuccess, playNudge, playTap, unlockAudio } from '../audio'
import { randFriendIndex } from '../level'
import { randInt } from './util'
import { useGameLevel } from '../gameLevel'
import { useT } from '../i18n'

// Shop till: a friend buys an item that costs a number of coins; Assaf drops that
// many coins in the till (a big running count) and rings it up. Numbers practice.
// No timer, no fail — a wrong amount just nudges gently.
//
// MATERIALS (commercial-quality pass): the register, the cash drawer, the money
// coins, the counter wood and the goods on it are all BAKED sprites (milled
// metal / plastic / paper / glass / baked / fruit), not CSS gradients — matching
// the coin-sort material bar. The counter is a pseudo-3D block (lit top surface +
// shadowed front face) so the props sit ON a real surface.
//
// SCENE (grounded, not floating): a little grocery counter — a shelf strip of muted
// goods behind, a warm hanging lamp, the wooden COUNTER in the foreground. The
// friend stands behind the counter (feet occluded = grounded), the item sits ON the
// counter with its price on an attached tag, and the register is the tap target with
// the coin drawer in front. A couple of friends wait in a small, far queue (static).
//
// DIFFICULTY (shared header star control): the price range grows with the level
// (bigger numbers = more coins to count) — קל stays as gentle as before, אלוף is a
// real no-fail challenge. Cumulative, per-game, persists.
const ART = `${import.meta.env.BASE_URL}art/sprites/shop/`
// the baked grocery products (distinct materials); the customer buys one at a time
const GOODS = ['apple', 'milk', 'juice', 'jam', 'can', 'bread', 'cookie', 'cheese'] as const
const scaleFor = (idx: number, h: number) => h / FRIEND_NATURAL[friendKindForIndex(idx)].h
// muted silhouette goods on the back shelf (static ambience, one light source)
const SHELF = ['🫙', '🥫', '🧴', '🍯', '🧃', '🫙', '🥫', '🧴']

// price range per level (cumulative): קל gentle 1–4 · בינוני 1–6 · קשה 2–8 · אלוף 3–9
const LEVEL_TIERS = [0, 1, 2, 3]
const PRICE_MIN = [1, 1, 2, 3]
const PRICE_MAX = [4, 6, 8, 9]
const rollPrice = (lvl: number) => randInt(PRICE_MIN[lvl] ?? 1, PRICE_MAX[lvl] ?? 5)

export default function ShopGame({ onExit, friend }: GameProps) {
  const { t } = useT()
  const [level] = useGameLevel('shop', LEVEL_TIERS)
  const levelRef = useRef(level)
  levelRef.current = level
  const [customer, setCustomer] = useState(() => friend ?? randFriendIndex())
  const [item, setItem] = useState(() => GOODS[randInt(0, GOODS.length - 1)])
  const [price, setPrice] = useState(() => rollPrice(levelRef.current))
  const [paid, setPaid] = useState(0)
  const [happy, setHappy] = useState(false)
  const [sold, setSold] = useState(0)
  // a small, static waiting queue at the far side (ambience only — never changes
  // mid-round, cheap: two dimmed friends drawn once behind the counter line)
  const queue = useRef<number[]>([randFriendIndex(), randFriendIndex()])
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  function addCoin() {
    if (happy || paid >= 9) return
    unlockAudio()
    playPop()
    setPaid((p) => p + 1)
  }
  function undo() {
    if (happy || !paid) return
    playTap()
    setPaid((p) => p - 1)
  }
  function sell() {
    if (happy || !paid) return
    unlockAudio()
    if (paid !== price) {
      playNudge() // gentle — count the coins again
      return
    }
    playSuccess()
    setHappy(true)
    setSold((n) => n + 1)
    timers.current.push(
      window.setTimeout(() => {
        setHappy(false)
        setPaid(0)
        setCustomer(randFriendIndex())
        setItem(GOODS[randInt(0, GOODS.length - 1)])
        setPrice(rollPrice(levelRef.current))
      }, 1700),
    )
  }

  return (
    <GameShell title={t('game.shop')} emoji="🏪" onExit={onExit} levels={{ gameId: 'shop', tiers: LEVEL_TIERS }}>
      <div className="shop-screen center-body">
        <span className="score-pill" aria-hidden="true">🛍️ {sold}</span>

        {/* ── the grounded shop counter ─────────────────────────────────── */}
        <div className={`shop-scene ${happy ? 'is-happy' : ''}`}>
          {/* illustrated back plane (CC0 warm shop interior) — replaces the flat back-wall gradient */}
          <SceneBackdrop src="shop-interior.jpg" position="center 46%" scrim="soft" />
          {/* static back layers: lamp glow + shelf of muted goods (no motion) */}
          <div className="shop-lamp" aria-hidden="true" />
          <div className="shop-shelf" aria-hidden="true">
            {SHELF.map((g, i) => (
              <span key={i} className="shop-shelf-jar">{g}</span>
            ))}
          </div>

          {/* the small far queue — static ambience */}
          <div className="shop-queue" aria-hidden="true">
            {queue.current.map((qi, i) => (
              <span key={i} className={`shop-queue-friend q${i}`}>
                <Friend index={qi} scale={scaleFor(qi, 54)} showNumber={false} />
              </span>
            ))}
          </div>

          {/* the friend at the counter */}
          <div className={`shop-friend ${happy ? 'happy' : ''}`}>
            <Friend index={customer} scale={scaleFor(customer, 96)} showNumber={false} lively bouncing={happy} />
          </div>

          {/* the wooden counter (front plane) — baked wood, lit top + shadowed front */}
          <div className="shop-counter" aria-hidden="true">
            <span className="shop-counter-top" />
          </div>

          {/* the item for sale, sitting on the counter with an attached price tag */}
          <div className="shop-goods" aria-hidden="true">
            <span className="shop-goods-shadow" />
            {happy ? (
              <span className="shop-good-sold">😍</span>
            ) : (
              <>
                <img className="shop-good" src={`${ART}prod-${item}.png`} alt="" draggable={false} />
                <span className="shop-tag">
                  <span className="shop-tag-hole" />
                  <b className="shop-tag-num">{price}</b>
                  <span className="shop-tag-coins">
                    {Array.from({ length: price }).map((_, i) => (
                      <img key={i} className="shop-tag-coin" src={`${ART}coin.png`} alt="" draggable={false} />
                    ))}
                  </span>
                </span>
              </>
            )}
          </div>

          {/* the till: a real register + its cash drawer. Coins land in the drawer;
              the running count glows on the register's screen. */}
          <div className={`shop-till ${happy ? 'is-open' : ''}`} aria-hidden="true">
            <span className="shop-register">
              <span className="shop-till-display">{paid}</span>
            </span>
            <span className="shop-drawer">
              <span className="shop-drawer-tray">
                {Array.from({ length: paid }).map((_, i) => (
                  <img key={i} className="shop-coin" style={{ ['--i' as string]: i }} src={`${ART}coin.png`} alt="" draggable={false} />
                ))}
              </span>
            </span>
          </div>
        </div>

        {/* ── the tidy control tray ─────────────────────────────────────── */}
        <div className="shop-tray">
          <button
            className="btn-utility shop-undo"
            onClick={undo}
            disabled={happy || !paid}
            aria-label={t('ice.undo')}
          >
            <span aria-hidden="true">↩️</span>
          </button>

          {/* the core "drop a coin" button — a real pressable baked gold coin */}
          <button className="shop-coinbtn" onClick={addCoin} aria-label={t('shop.coin')}>
            <span className="shop-coinbtn-plus" aria-hidden="true">＋</span>
          </button>

          <button className="btn-primary shop-sell" onClick={sell} disabled={happy || !paid}>
            {t('shop.pay')} <span aria-hidden="true">🧾</span>
          </button>
        </div>
      </div>
    </GameShell>
  )
}
