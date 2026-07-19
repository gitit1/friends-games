// A tiny one-shot hand-off: when a friend's world sends you to the "Build a
// Number" game via its "build me!" bridge, it stashes the split it was showing
// (e.g. 3 + 4) here. BuildNumber reads it ONCE on mount so it opens already set
// to that addition — so "build me" really rebuilds that friend. Cleared on read,
// so opening the game normally still starts random.
type Preset = { a: number; b: number }
let pending: Preset | null = null

export function setBuildPreset(p: Preset) {
  pending = p
}

export function takeBuildPreset(): Preset | null {
  const p = pending
  pending = null
  return p
}
