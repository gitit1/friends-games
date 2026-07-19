// ─────────────────────────────────────────────────────────────────────────
// Pet choreography timeline helper.
//
// The pet's "movies" (walk to the kitchen, sit and eat, go to bed…) used to be
// open-loop chains of window.setTimeout pushed into an array and cleared by hand.
// Nothing waited for a CSS transition to actually finish, and a reset was an
// instant state snap.
//
// This tiny helper lets a scene be written as a readable async timeline:
//
//     const c = new Choreo()
//     await c.step(700)          // soft pause
//     await c.transitionEnd(el)  // wait for the slide/walk to really arrive
//     await c.step(140)          // anticipation dip
//     …
//
// Every wait is cancellable through a single AbortController, so resetScenes()
// can abort a running movie cleanly (the awaits reject with an AbortError that
// the scene swallows) — no mid-air snaps, no leaked timers.
// Pure logic — no React, no DOM ownership beyond the element passed in.
// ─────────────────────────────────────────────────────────────────────────

/** Thrown when a step/transition is cancelled. Scenes swallow it silently. */
export class Cancelled extends Error {
  constructor() {
    super('choreo:cancelled')
    this.name = 'Cancelled'
  }
}

export function isCancelled(err: unknown): boolean {
  return err instanceof Cancelled || (err instanceof DOMException && err.name === 'AbortError')
}

/** Wait `ms`, unless `signal` aborts first (then reject with Cancelled). */
export function step(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Cancelled())
    let onAbort: (() => void) | null = null
    const id = window.setTimeout(() => {
      if (onAbort) signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    onAbort = () => {
      window.clearTimeout(id)
      reject(new Cancelled())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Resolve when `el`'s next `transitionend` fires — or after `fallbackMs` if the
 * transition never fires (element off-screen, no property change, throttled tab).
 * Cancellable via `signal`. Passing a null element just falls back to the timer.
 */
export function transitionEnd(el: Element | null, fallbackMs = 1200, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Cancelled())
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      el?.removeEventListener('transitionend', onEnd)
      if (onAbort) signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    const onEnd = (e: Event) => {
      if (e.target === el) finish()
    }
    const timer = window.setTimeout(finish, fallbackMs)
    let onAbort: (() => void) | null = null
    onAbort = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      el?.removeEventListener('transitionend', onEnd)
      reject(new Cancelled())
    }
    el?.addEventListener('transitionend', onEnd)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * A cancellable timeline. `abort()` cancels every pending wait and re-arms a
 * fresh controller so the next scene starts clean.
 */
export class Choreo {
  private ctrl = new AbortController()

  /** The signal for the CURRENT run (use inside a scene if you need it raw). */
  get signal(): AbortSignal {
    return this.ctrl.signal
  }

  /** Cancel everything in flight and re-arm for the next scene. */
  abort(): void {
    this.ctrl.abort()
    this.ctrl = new AbortController()
  }

  step(ms: number): Promise<void> {
    return step(ms, this.ctrl.signal)
  }

  transitionEnd(el: Element | null, fallbackMs?: number): Promise<void> {
    return transitionEnd(el, fallbackMs, this.ctrl.signal)
  }
}
