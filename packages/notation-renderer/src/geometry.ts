import { stepToPitch } from '../../music-core/src/staffGeometry'
export const keyboard = { minStep: -10, maxStep: 10, keyWidth: 36, left: 40 }
// Adjacent line centres are two diatonic steps apart. At full support,
// one line band and one empty space each occupy exactly one step.
export function staffLineWidth(stepWidth: number, support: number) {
  return 1 + (stepWidth - 1) * Math.max(0, Math.min(1, support))
}
export function staffLineColor(bass: boolean, color: number, support: number) {
  const band = `color-mix(in srgb, ${bass ? '#cec4d8' : '#b8d4cb'} ${color * 100}%, #cbd0d3)`
  return `color-mix(in srgb, ${band} ${support * 100}%, #41494d)`
}
export const noteName = (step: number) => { const pitch = stepToPitch(step); return `${({ C: 'До', D: 'Ре', E: 'Ми', F: 'Фа', G: 'Соль', A: 'Ля', B: 'Си' })[pitch.letter]} · ${pitch.letter}${pitch.octave}` }
