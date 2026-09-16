import { describe, expect, it } from 'vitest'
import { lessons } from './index'
import { presentationOf, selectPresentation } from './presentation'

describe('progressive notation', () => {
  it('preserves labels when rotating and offers true conventional notation', () => {
    const initial = lessons[0].scaffold
    const horizontal = selectPresentation(initial, 'horizontal')
    expect(horizontal.A).toBe(0)
    expect(horizontal.D).toBe(1)
    expect(horizontal.B).toBe(initial.B)
    const standard = selectPresentation(horizontal, 'standard')
    expect(standard).toMatchObject({ A: 0, B: 0, C: 0, D: 0, F: 0, G: 1 })
    expect(presentationOf(standard)).toBe('standard')
    expect(presentationOf(selectPresentation(standard, 'vertical'))).toBe('vertical')
  })
  it('includes unlabelled vertical and wide horizontal stages before conventional notation', () => {
    const ids = lessons.map(lesson => lesson.id)
    expect(ids.indexOf('recognition-positions')).toBeLessThan(ids.indexOf('recognition-horizontal'))
    expect(ids.indexOf('recognition-horizontal')).toBeLessThan(ids.indexOf('recognition-paper'))
  })
})
