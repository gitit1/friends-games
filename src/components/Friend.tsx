import { memo, useState, type CSSProperties } from 'react'
import { playFriend, unlockAudio } from '../audio'
import { speakName } from '../speech'
import { friendColor, friendName, friendNumber, friendSay } from '../friends'
import FriendArt, { FRIEND_KINDS, FRIEND_NATURAL, type Outfit } from './FriendArt'

type Props = {
  /** 0-based position → fixed friend identity (name + number + look + voice). */
  index: number
  /** Multiplier on the friend's natural size. */
  scale?: number
  /** How many parts are "awake". If given and below the number, the friend is dimmed/asleep. */
  litUnits?: number
  /** Externally-driven jump. */
  bouncing?: boolean
  /** Externally-driven nod (a little head-dip — e.g. a piano key friend acknowledging a hit). */
  nodding?: boolean
  /** Tapping makes it jump, sound off, and say its name. */
  interactive?: boolean
  /** Show the friend's number above its head (default true). */
  showNumber?: boolean
  /** Open + chew the mouth (for the eating animation). */
  eating?: boolean
  /** Dress-up items worn on the friend (a filled slot replaces its built-in accessory). */
  outfit?: Outfit
  /** "Alive" — gentle blink (for a featured friend, not the whole grid). */
  lively?: boolean
  /** Face-borne emotion — morphs the friend's own mouth (smile / neutral / frown). */
  mood?: 'smile' | 'neutral' | 'frown'
  /** A one-shot gesture: hug / high-five / kiss (arms + pseudo-3D lean). */
  action?: 'five' | 'hug' | 'kiss' | null
  /** Looping march — legs step, arms pump, body bobs (for the pet walking). */
  walking?: boolean
  /** Raise the near arm and wave it (a friendly goodbye — pairs with `walking`). */
  waving?: boolean
  /** Baby look — a freshly-hatched little one (bigger head + big eyes). */
  baby?: boolean
  /** Crowd/compact rendering: draw a single colour-blob token (one radial-gradient
   *  body + a simple face) instead of the full bump anatomy. For scenes with many
   *  friends at once (>12) where the count — not each friend's detail — is what
   *  matters (quantity). ~4 DOM nodes instead of dozens. */
  compact?: boolean
}

// The little moves a friend can do when tapped (besides jumping).
const MOVES = ['jump', 'wiggle', 'spin', 'nod', 'tada'] as const

function Friend({
  index,
  scale = 1,
  litUnits,
  bouncing = false,
  nodding = false,
  interactive = false,
  showNumber = true,
  eating = false,
  outfit,
  lively = false,
  mood = 'smile',
  action = null,
  walking = false,
  waving = false,
  baby = false,
  compact = false,
}: Props) {
  const [move, setMove] = useState<string | null>(null)
  const kind = FRIEND_KINDS[index % FRIEND_KINDS.length]
  const n = friendNumber(index)
  const nat = FRIEND_NATURAL[kind]

  function poke() {
    unlockAudio()
    playFriend(index)
    speakName(friendSay(index))
    // a different little move each tap, so the friends feel alive (not just jump)
    const pick = MOVES[Math.floor(Math.random() * MOVES.length)]
    setMove(pick)
    window.setTimeout(() => setMove(null), 850)
  }

  const moveClass = move ? `move-${move}` : nodding ? 'move-nod' : bouncing ? 'move-jump' : ''
  const className = `friend-holder ${moveClass}`

  // Compact crowd token: a single colour-blob (one gradient body + simple face),
  // sized to a uniform square so a wall of them reads instantly and counts cleanly.
  // font-size = the token's own size so the em-based face parts scale with it.
  const dim = Math.max(nat.w, nat.h) * scale
  const holderStyle: CSSProperties = compact
    ? { width: dim, height: dim, fontSize: dim }
    : { width: nat.w * scale, height: nat.h * scale }
  const scaleStyle: CSSProperties = { width: nat.w, transform: `scale(${scale})`, transformOrigin: 'top left' }

  const inner = compact ? (
    <span className="friend-mini" style={{ '--c': friendColor(index) } as CSSProperties}>
      <span className="fm-eye l" />
      <span className="fm-eye r" />
      <span className="fm-smile" />
    </span>
  ) : (
    <span className="friend-scale" style={scaleStyle}>
      <FriendArt
        kind={kind}
        number={n}
        showHalo={showNumber}
        litUnits={litUnits}
        eating={eating}
        outfit={outfit}
        lively={lively}
        mood={mood}
        action={action}
        walking={walking}
        waving={waving}
        baby={baby}
      />
    </span>
  )

  if (interactive) {
    return (
      <button className={className} style={holderStyle} onClick={poke} aria-label={friendName(index)}>
        {inner}
      </button>
    )
  }
  return (
    <div className={className} style={holderStyle} aria-hidden="true">
      {inner}
    </div>
  )
}

// Memoized: this is THE hot component (drawn in ~36 games, dozens of nodes each).
// All props are index-derived / primitive, so a parent's score/timer/drag update
// leaves every unchanged friend untouched instead of re-rendering the whole crowd.
export default memo(Friend)
