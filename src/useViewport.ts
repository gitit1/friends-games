import { useEffect, useState } from 'react'
import { FRIEND_NATURAL, friendKindForIndex } from './components/FriendArt'

// Shared viewport helpers so every game can size its elements to the screen.
// The app is mobile-first: on a phone things are as designed; on a wide screen
// they grow to fill the space instead of sitting tiny in the middle.

export function useViewport() {
  const [vp, setVp] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 360,
    h: typeof window !== 'undefined' ? window.innerHeight : 700,
  }))
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

// A gentle "grow on bigger screens" multiplier (1 on a phone, up to `max` on a
// wide screen) — for nudging fixed px sizes up on desktop without going giant.
export function screenScale(vw: number, max = 1.6) {
  return Math.min(max, Math.max(1, vw / 440))
}

// Scale a single friend to fill a fraction of the viewport (so it's big on a
// desktop and still fits a phone). Returns the `scale` prop for <Friend>.
export function fitScale(index: number, vp: { w: number; h: number }, wFrac: number, hFrac: number, max = 3) {
  const nat = FRIEND_NATURAL[friendKindForIndex(index)]
  return Math.min((vp.w * wFrac) / nat.w, (vp.h * hFrac) / nat.h, max)
}
