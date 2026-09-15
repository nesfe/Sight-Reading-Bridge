import { describe, expect, it } from 'vitest'
import { keyboard, staffLineWidth } from './geometry'
import { BASS_LINE_STEPS, TREBLE_LINE_STEPS, whiteKeyCenterX, whiteKeyLeftX } from '../../music-core/src/staffGeometry'

describe('elementary staff bands', () => {
  it('makes line bands and empty spaces exactly one white key wide', () => {
    for (const staff of [BASS_LINE_STEPS, TREBLE_LINE_STEPS]) {
      staff.slice(1).forEach((step, index) => {
        const distance = Math.abs(whiteKeyCenterX(step, keyboard) - whiteKeyCenterX(staff[index], keyboard))
        const width = staffLineWidth(keyboard.keyWidth, 1)
        expect(distance - width).toBe(width)
        expect(width).toBe(keyboard.keyWidth)
        expect(whiteKeyCenterX(step, keyboard) - width / 2).toBe(whiteKeyLeftX(step, keyboard))
      })
    }
  })
  it('fades line width independently of the fixed pitch coordinates', () => {
    expect(staffLineWidth(36, 0)).toBe(1)
    expect(staffLineWidth(36, .5)).toBe(18.5)
    expect(staffLineWidth(5, 1)).toBe(5)
    expect(staffLineWidth(5, 0)).toBe(1)
  })
})
