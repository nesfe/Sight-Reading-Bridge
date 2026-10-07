const INTRO_KEY = 'srb-staff-intro-v1'
export function hasSeenIntro() {
  try { return localStorage.getItem(INTRO_KEY) === 'seen' } catch { return false }
}
export function rememberIntro() {
  try { localStorage.setItem(INTRO_KEY, 'seen') } catch { /* Keep the introduction usable without storage. */ }
}
