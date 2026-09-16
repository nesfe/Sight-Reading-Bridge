import type { Scaffold } from './index'

export type Presentation = 'vertical' | 'horizontal' | 'standard'
export function presentationOf(scaffold: Scaffold): Presentation {
  return scaffold.A > 0 ? 'vertical' : scaffold.D > 0 ? 'horizontal' : 'standard'
}
export function selectPresentation(scaffold: Scaffold, view: Presentation): Scaffold {
  if (view === 'standard') return { ...scaffold, A: 0, B: 0, C: 0, D: 0, F: 0, G: 1 }
  return { ...scaffold, A: view === 'vertical' ? 1 : 0, C: 1, D: 1 }
}
