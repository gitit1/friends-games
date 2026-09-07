// Registers the offline service worker (see public/sw.js). Production only, so
// dev never caches. Updates apply on the next launch — no surprise reloads,
// which keeps things calm for a sensory-sensitive child.
export function registerSW() {
  if (!import.meta.env.PROD) {
    // DEV: a leftover production service worker (from a past build served on this
    // same address) would keep serving STALE cached assets and hide live edits.
    // Unregister any + wipe its caches so what you see is always the latest code.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {})
    }
    if (typeof caches !== 'undefined') {
      caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {})
    }
    return
  }
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is a bonus — never block the app on it */
    })
  })
}
