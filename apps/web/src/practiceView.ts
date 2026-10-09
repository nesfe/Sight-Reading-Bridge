declare global {
  interface Window {
    sightReadingBridge?: {
      getVersion: () => Promise<string>;
      getFullscreen: () => Promise<boolean>;
      setFullscreen: (value: boolean) => Promise<boolean>;
      onFullscreen: (callback: (value: boolean) => void) => () => void;
    };
  }
}

const preference = 'srb-auto-fullscreen'
const initialAuto = () => { try { return localStorage.getItem(preference) === 'true' } catch { return false } }
let state = { focused: false, fullscreen: false, automatic: initialAuto(), available: false, pending: false, error: '' }
let owned = false
let exiting = false
let transition = Promise.resolve()
const listeners = new Set<() => void>()
const pauses = new Set<() => void>()
const publish = (update: Partial<typeof state>) => { state = { ...state, ...update }; listeners.forEach(fn => fn()) }
const pause = () => pauses.forEach(fn => fn())
function changed(fullscreen: boolean) {
  const left = state.fullscreen && !fullscreen
  publish({ fullscreen })
  if (left && !exiting) { owned = false; pause(); publish({ focused: false }) }
}
async function applyFullscreen(value: boolean) {
  publish({ pending: true })
  try {
    if (window.sightReadingBridge) changed(await window.sightReadingBridge.setFullscreen(value))
    else {
      if (value && !document.fullscreenElement) await document.documentElement.requestFullscreen()
      else if (!value && document.fullscreenElement) await document.exitFullscreen()
      changed(Boolean(document.fullscreenElement))
    }
    if (state.fullscreen !== value) throw new Error('Fullscreen transition was not completed')
    publish({ error: '' })
  } catch { owned = false; publish({ error: 'Полный экран недоступен. Режим тренировки остаётся в окне.' }) }
  finally { publish({ pending: false }) }
}
function setFullscreen(value: boolean) {
  transition = transition.then(() => applyFullscreen(value))
  return transition
}

export const practiceView = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
  getSnapshot: () => state,
  initialize() {
    const bridge = window.sightReadingBridge
    if (bridge) { void bridge.getFullscreen().then(changed).catch(() => {}); return bridge.onFullscreen(changed) }
    const update = () => changed(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  },
  registerPause(fn: () => void) {
    pauses.add(fn); publish({ available: true })
    return () => {
      pauses.delete(fn)
      queueMicrotask(() => { if (!pauses.size) { publish({ available: false }); void practiceView.end() } })
    }
  },
  setAutomatic(value: boolean) {
    try { localStorage.setItem(preference, String(value)) } catch { /* Keep the session preference when storage is blocked. */ }
    publish({ automatic: value })
  },
  async begin() {
    publish({ focused: true })
    if (state.automatic && !state.fullscreen) { owned = true; await setFullscreen(true) }
    return state.focused
  },
  async end() {
    publish({ focused: false })
    if (owned) { owned = false; exiting = true; try { await setFullscreen(false) } finally { exiting = false } }
  },
  async leave() { pause(); await practiceView.end() },
  async toggleFullscreen() {
    if (state.pending) return
    pause(); owned = false
    if (state.available && !state.fullscreen) publish({ focused: true })
    await setFullscreen(!state.fullscreen)
  },
}
