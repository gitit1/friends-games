import { useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import Friend from '../components/Friend'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playPop, playSuccess, playTap, unlockAudio } from '../audio'
import { randInt } from './util'
import { useT } from '../i18n'

// Garden: a calm, no-goal toy. Tap a patch of soil to plant a seed, then tap it
// again (or use the watering can) to water it — it grows seed → sprout → bud →
// flower. A counter shows how many flowers have bloomed. No timer, no fail.
//
// ART: every material the child sees is BAKED, lit art (public/art/sprites/garden/,
// see LICENSES.md) — a raised wooden planter bed in 3/4 perspective, a meadow
// SceneBackdrop, and seed/sprout/bud/bloom + tool sprites. Nothing is a flat CSS
// shape. The grow MECHANIC below is unchanged — only the look was upgraded.
const art = (n: string) => `${import.meta.env.BASE_URL}art/sprites/garden/${n}.png`
// the six baked blooms a seed can grow into (muted, sensory-calm), one per slot
const FLOWERS = ['daisy', 'sun', 'tulip', 'rose', 'cosmos', 'viola']
// which baked sprite each growth stage shows (stage 4 = a flower, picked by type)
const STAGE_SPRITE = ['', 'seed', 'sprout', 'bud']
const PLOTS = 6
const GARDENER = 3 // a calm friend tending the bed, grounded behind it (feet hidden)
type Plot = { stage: number; type: string } // stage 0 = empty soil, 4 = flower

export default function Garden({ onExit }: GameProps) {
  const { t } = useT()
  const [plots, setPlots] = useState<Plot[]>(() => Array.from({ length: PLOTS }, () => ({ stage: 0, type: 'daisy' })))

  const bloomed = plots.filter((p) => p.stage === 4).length

  function grow(p: Plot): Plot {
    if (p.stage === 0) return { stage: 1, type: FLOWERS[randInt(0, FLOWERS.length - 1)] } // plant a seed
    if (p.stage < 4) return { ...p, stage: p.stage + 1 } // water → grow
    return p // already a flower
  }

  function tap(i: number) {
    unlockAudio()
    setPlots((ps) => {
      const next = ps.map((p, j) => (j === i ? grow(p) : p))
      if (ps[i].stage === 3) playSuccess() // just bloomed
      else playPop()
      return next
    })
  }

  function waterAll() {
    unlockAudio()
    playTap()
    setPlots((ps) => ps.map((p) => (p.stage >= 1 && p.stage < 4 ? { ...p, stage: p.stage + 1 } : p)))
  }

  function plantRow() {
    unlockAudio()
    playPop()
    setPlots((ps) => ps.map((p) => (p.stage === 0 ? { stage: 1, type: FLOWERS[randInt(0, FLOWERS.length - 1)] } : p)))
  }

  // the baked sprite name for a plot at its current stage
  const plantSprite = (p: Plot) => (p.stage === 4 ? `flower-${p.type}` : STAGE_SPRITE[p.stage])

  return (
    <GameShell title={t('game.garden')} emoji="🌱" onExit={onExit}>
      <div className="garden-screen">
        <div className="garden-stage">
          {/* far back plane: a calm, muted meadow (CC0), not a CSS sky gradient */}
          <SceneBackdrop src="bg-meadow.jpg" position="center 62%" scrim="soft" />
          <span className="garden-count" aria-hidden="true">🌸 {bloomed}</span>

          {/* a friendly gardener grounded behind the bed — feet hidden by the wood,
              identity colour kept */}
          <div className="garden-friend" aria-hidden="true">
            <Friend index={GARDENER} scale={74 / friendMaxDim(GARDENER)} showNumber={false} />
          </div>

          {/* the baked raised planter bed (3/4 perspective) with the row of plots
              planted along its soil surface */}
          <div className="garden-bed" style={{ backgroundImage: `url("${art('bed')}")` }}>
            <div className="garden-row">
              {plots.map((p, i) => (
                <button key={i} className="garden-plot" onClick={() => tap(i)} aria-label={t('garden.plot')}>
                  {p.stage >= 1 && (
                    <span className="garden-plant" style={{ animationDelay: `${(i % 3) * -1.35 - 0.4}s` }}>
                      <span
                        key={p.stage === 4 ? `f-${p.type}` : p.stage}
                        className={`garden-sprite gs${p.stage}`}
                        style={{ backgroundImage: `url("${art(plantSprite(p))}")` }}
                      />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="garden-actions">
          <button className="big-button garden-plant-btn" onClick={plantRow}>
            <span className="garden-btn-icon" style={{ backgroundImage: `url("${art('packet')}")` }} aria-hidden="true" />
            {t('garden.plant')}
          </button>
          <button className="big-button garden-water-btn" onClick={waterAll}>
            <span className="garden-btn-icon" style={{ backgroundImage: `url("${art('can')}")` }} aria-hidden="true" />
            {t('garden.water')}
          </button>
        </div>
      </div>
    </GameShell>
  )
}
