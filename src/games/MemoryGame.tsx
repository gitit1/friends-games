import { memo, useCallback, useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell'
import SceneBackdrop from '../components/SceneBackdrop'
import { friendCount } from '../level'
import Friend from '../components/Friend'
import Confetti from '../components/Confetti'
import { friendMaxDim } from '../components/FriendArt'
import type { GameProps } from './registry'
import { playSuccess, playTap, playWin, unlockAudio } from '../audio'
import { speak } from '../speech'
import { friendName, friendSay, friendColor, friendNumber } from '../friends'
import { shuffle } from './util'
import { useGameLevel } from '../gameLevel'
import { useViewport } from '../useViewport'
import { useT } from '../i18n'

// Difficulty lives in the shared header control (⭐ LevelButton), wired exactly
// like CoinSort: קל · בינוני · קשה · אלוף on the canonical scale. Each tier just
// changes how many PAIRS are on the table — קל stays as easy as it always was
// (3 pairs), אלוף is a real memory challenge (10 pairs / 20 cards), no near-win.
const LEVEL_TIERS = [0, 1, 2, 3]
const PAIRS_BY_TIER = [3, 6, 8, 10]

type Card = { id: number; friend: number }

// One memory card. Memoized so flipping a card re-renders ONLY that card, not the
// whole board. BOTH faces are always mounted (the friend never unmounts) — the
// open/closed state is a pure CSS 3D flip (rotateY), so opening a card no longer
// tears down and rebuilds the friend art.
//
// Materials are BAKED sprites (public/art/sprites/memory/): the face-down face is
// card-back.png (the turquoise-friend card back) and the face-up face is
// card-face.png (an ivory card with a recessed mat window). Only the friend + the
// crisp corner number are DOM; everything textured is pre-rendered art.
const MemoryCard = memo(function MemoryCard({
  friend,
  isOpen,
  isMatched,
  friendPx,
  closedLabel,
  index,
  onFlip,
}: {
  friend: number
  isOpen: boolean
  isMatched: boolean
  friendPx: number
  closedLabel: string
  index: number
  onFlip: (index: number) => void
}) {
  // matched cards gently "nod" toward one another — alternate the tilt by index
  const nod = index % 2 ? -1 : 1
  return (
    <button
      className={`memory-card ${isOpen ? 'is-open' : ''} ${isMatched ? 'is-matched' : ''}`}
      onClick={() => onFlip(index)}
      aria-label={isOpen ? friendName(friend) : closedLabel}
      style={{ '--nod': nod } as React.CSSProperties}
    >
      <span className="memory-inner">
        <span className="memory-front" aria-hidden="true" />
        <span className="memory-back" aria-hidden="true">
          <span className="memory-friend">
            <Friend index={friend} scale={friendPx / friendMaxDim(friend)} showNumber={false} />
          </span>
          {/* crisp playing-card corner rank — the friend's number in their own
              identity colour (static, no float; the calm rule bars the looping
              halo). Logical inset so it mirrors to the correct corner in RTL/LTR. */}
          <span className="memory-num" style={{ '--c': friendColor(friend) } as React.CSSProperties}>
            {friendNumber(friend)}
          </span>
        </span>
      </span>
    </button>
  )
})

// Draw distinct friends from the cast (capped by the level so we never ask for
// more pairs than there are friends; cards auto-scale to fit any friend).
function buildDeck(pairs: number): Card[] {
  const friends = shuffle(Array.from({ length: friendCount() }, (_, i) => i)).slice(0, Math.min(pairs, friendCount()))
  const deck = friends.flatMap((friend, i) => [
    { id: i * 2, friend },
    { id: i * 2 + 1, friend },
  ])
  return shuffle(deck)
}

// Find the matching friends by color/face — when two match, that friend says hi.
export default function MemoryGame({ onExit }: GameProps) {
  const { t } = useT()
  // per-game difficulty from the shared header control (opens at the parent's
  // global setting, then the child's choice sticks per game — same as CoinSort).
  const [level] = useGameLevel('memory', LEVEL_TIERS)
  const pairs = PAIRS_BY_TIER[level]

  const [deck, setDeck] = useState<Card[]>(() => buildDeck(pairs))
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [locked, setLocked] = useState(false)

  const vp = useViewport()
  // win when every distinct friend in the (possibly capped) deck is matched
  const totalPairs = deck.length / 2
  const won = matched.length === totalPairs
  // column count by density; the board fills up to 660px so it's big on a
  // desktop, and each friend fills its (responsive) card.
  const cols = pairs <= 3 ? 3 : pairs <= 8 ? 4 : 5
  const boardW = Math.min(660, vp.w * 0.92)
  const cardSize = (boardW - (cols - 1) * 12) / cols
  const friendPx = cardSize * 0.54

  function newDeck(p: number) {
    setDeck(buildDeck(p))
    setFlipped([])
    setMatched([])
    setLocked(false)
  }
  // 🔄 reshuffle the current board (same difficulty)
  function reshuffle() {
    unlockAudio()
    playTap()
    newDeck(pairs)
  }

  // changing difficulty in the header deals a fresh board at the new level
  // (skip the first render — the initial board is already dealt above).
  const firstLevel = useRef(true)
  useEffect(() => {
    if (firstLevel.current) {
      firstLevel.current = false
      return
    }
    newDeck(PAIRS_BY_TIER[level])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Refs mirror the flip state so the click handler can stay referentially STABLE
  // (memoized cards only re-render when their own open/matched flags change).
  const flippedRef = useRef(flipped)
  const matchedRef = useRef(matched)
  const lockedRef = useRef(locked)
  const deckRef = useRef(deck)
  flippedRef.current = flipped
  matchedRef.current = matched
  lockedRef.current = locked
  deckRef.current = deck

  const handleFlip = useCallback((index: number) => {
    if (lockedRef.current || flippedRef.current.includes(index)) return
    const d = deckRef.current
    const card = d[index]
    if (matchedRef.current.includes(card.friend)) return

    unlockAudio()
    playTap()
    const next = [...flippedRef.current, index]
    setFlipped(next)

    if (next.length === 2) {
      setLocked(true)
      const [a, b] = next
      if (d[a].friend === d[b].friend) {
        const friend = d[a].friend
        const nextMatched = [...matchedRef.current, friend]
        window.setTimeout(() => {
          setMatched(nextMatched)
          setFlipped([])
          setLocked(false)
          if (nextMatched.length === d.length / 2) playWin()
          else {
            playSuccess()
            speak(friendSay(friend))
          }
        }, 600)
      } else {
        // Gentle: just flip back, no error sound or penalty.
        window.setTimeout(() => {
          setFlipped([])
          setLocked(false)
        }, 900)
      }
    }
  }, [])

  return (
    <GameShell title={t('game.memory')} emoji="🧠" onExit={onExit} levels={{ gameId: 'memory', tiers: LEVEL_TIERS }}>
      <Confetti active={won} />
      <div className="memory-controls">
        <button className="pill" onClick={reshuffle}>
          🔄 {t('mem.new')}
        </button>
      </div>

      {/* the SCENE — the card table stands in the cosy playroom. The room is the
          illustrated SceneBackdrop; the baked felt mat (.memory-table) rests on it
          and the cards rest on the felt. Static only — no parallax, no motion. */}
      <div className="memory-stage">
        <SceneBackdrop src="wooden-playroom.jpg" position="center 26%" scrim="soft" />
        <div className="memory-table">
          <div
            className={`memory-grid ${cols >= 5 ? 'is-wide-board' : ''}`}
            style={{ '--cols': cols, maxWidth: boardW } as React.CSSProperties}
          >
            {deck.map((card, index) => {
              const isMatched = matched.includes(card.friend)
              const isOpen = flipped.includes(index) || isMatched
              return (
                <MemoryCard
                  key={card.id}
                  index={index}
                  friend={card.friend}
                  isOpen={isOpen}
                  isMatched={isMatched}
                  friendPx={friendPx}
                  closedLabel={t('mem.closed')}
                  onFlip={handleFlip}
                />
              )
            })}
          </div>
        </div>
      </div>
    </GameShell>
  )
}
