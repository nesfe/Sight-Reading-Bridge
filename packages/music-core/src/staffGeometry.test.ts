import { describe, expect, it } from 'vitest'
import {
  BASS_LINE_STEPS,
  GRAND_STAFF_LINE_STEPS,
  TREBLE_LINE_STEPS,
  isLine,
  staffStep,
  stepToPitch,
  whiteKeyCenterX,
} from './staffGeometry'

describe('staff geometry', () => {
  it('anchors middle C at zero', () => {
    expect(staffStep('C', 4)).toBe(0)
  })

  it('keeps all grand staff lines on even staff steps', () => {
    expect(GRAND_STAFF_LINE_STEPS.every(isLine)).toBe(true)
    expect(TREBLE_LINE_STEPS).toEqual([2, 4, 6, 8, 10])
    expect(BASS_LINE_STEPS).toEqual([-10, -8, -6, -4, -2])
  })

  it('maps staff steps back to pitches', () => {
    expect(stepToPitch(0)).toMatchObject({ letter: 'C', octave: 4 })
    expect(stepToPitch(10)).toMatchObject({ letter: 'F', octave: 5 })
    expect(stepToPitch(-10)).toMatchObject({ letter: 'G', octave: 2 })
  })

  it('uses one coordinate source for staff tracks and white key centers', () => {
    const geometry = { minStep: -14, maxStep: 17, keyWidth: 34, left: 40 }
    expect(whiteKeyCenterX(0, geometry)).toBe(40 + 14 * 34 + 17)
    expect(whiteKeyCenterX(7, geometry) - whiteKeyCenterX(0, geometry)).toBe(7 * 34)
  })
})
