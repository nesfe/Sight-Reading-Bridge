import { describe, expect, it } from 'vitest'
import { ScoreFollower } from './follow'

const groups = [{ pitches: [48, 60, 64], position: 0, measure: 1 }, { pitches: [60], position: 1, measure: 1 }]
describe('imported score following', () => {
  it('requires simultaneous chord tones and a fresh attack for a repeated pitch', () => {
    const run = new ScoreFollower(groups); run.start()
    run.noteOn(48); run.noteOff(48); run.noteOn(60); run.noteOn(64)
    expect(run.getSnapshot().index).toBe(0)
    run.noteOn(48)
    expect(run.getSnapshot().index).toBe(1)
    run.noteOn(60)
    expect(run.getSnapshot().index).toBe(1)
    run.noteOff(60); run.noteOn(60)
    expect(run.getSnapshot().status).toBe('completed')
  })
  it('does not advance on wrong notes or during pause and clears stuck keys', () => {
    const run = new ScoreFollower(groups); run.start(); run.noteOn(61)
    expect(run.getSnapshot().errors).toBe(1)
    run.pause(); groups[0].pitches.forEach(pitch => run.noteOn(pitch))
    expect(run.getSnapshot().index).toBe(0)
    run.start(); expect(run.getSnapshot().held).toEqual([])
    groups[0].pitches.forEach(pitch => run.noteOn(pitch))
    expect(run.getSnapshot().index).toBe(1)
    run.reset(); expect(run.getSnapshot()).toMatchObject({ status: 'ready', index: 0, errors: 0, held: [] })
  })
})
