import { describe, expect, it } from 'vitest'
import { lessons } from '../../curriculum/src'
import { stepToPitch } from '../../music-core/src/staffGeometry'
import { Session } from './session'
import { generate } from './index'
const notes = generate(lessons[0], 42).slice(0, 3)
const pitch = (i: number) => stepToPitch(notes[i].step).midi
describe('recognition session', () => {
  it('does not score before explicit start and first visible frame', () => {
    const s = new Session(notes, false, 60)
    s.noteOn(pitch(0), 100); s.noteOff(pitch(0), 101)
    s.start(200); s.noteOn(pitch(0), 201); s.noteOff(pitch(0), 202)
    expect(s.state.attempts).toHaveLength(0)
    s.markShown(220); s.noteOn(pitch(0), 820)
    expect(s.state.attempts[0].reactionMs).toBe(600)
  })
  it('counts black-key errors, stays on target, and advances once on release', () => {
    const s = new Session(notes, false, 60); s.start(0); s.markShown(10)
    s.noteOn(61, 100); s.noteOff(61, 110)
    expect(s.state.attempts[0].correct).toBe(false); expect(s.state.cursor).toBe(0)
    s.noteOn(pitch(0), 500); s.noteOn(pitch(0), 510)
    expect(s.state.attempts).toHaveLength(2); expect(s.state.cursor).toBe(0)
    s.noteOff(pitch(0), 600); s.noteOff(pitch(0), 610)
    expect(s.state.cursor).toBe(1)
  })
  it('finishes a finite exercise, ignoring additional presses', () => {
    const s = new Session(notes, false, 60); s.start(0)
    for (let i = 0; i < notes.length; i++) { s.markShown(i * 1000); s.noteOn(pitch(i), i * 1000 + 300); s.noteOff(pitch(i), i * 1000 + 500) }
    expect(s.state.status).toBe('completed')
    s.noteOn(60, 5000); expect(s.state.attempts).toHaveLength(3)
  })
  it('recovers from disconnect while a correct key is held without double-scoring', () => {
    const s = new Session(notes, false, 60); s.start(0); s.markShown(1); s.noteOn(pitch(0), 500); s.pause(600); s.resume(9000)
    expect(s.state.cursor).toBe(1); expect(s.state.attempts).toHaveLength(1); expect(s.state.held).toEqual([])
    s.markShown(9010); s.noteOn(pitch(1), 9310)
    expect(s.state.attempts[1].reactionMs).toBe(300)
  })
})
describe('timed reading', () => {
  it('counts every missed note and ends without looping', () => {
    const s = new Session(notes, true, 60); s.start(0); s.tick(10000)
    expect(s.state.status).toBe('completed'); expect(s.state.attempts.filter(a => a.missed)).toHaveLength(3)
    s.tick(20000); expect(s.state.attempts).toHaveLength(3)
  })
  it('measures onset and release independently', () => {
    const s = new Session(notes, true, 60); s.start(100)
    s.noteOn(pitch(0), 4125); s.noteOff(pitch(0), 5150)
    expect(s.state.attempts[0]).toMatchObject({ correct: true, timingMs: 25, reactionMs: null, releaseMs: 50 })
  })
  it('does not move musical time through a pause', () => {
    const s = new Session(notes, true, 60); s.start(0); s.pause(2000); s.resume(10000)
    s.noteOn(pitch(0), 12000)
    expect(s.state.attempts[0]).toMatchObject({ correct: true, timingMs: 0 })
  })
})
describe('curriculum generator', () => {
  it.each(lessons)('keeps $id in range and reproducible with fresh seeds', lesson => {
    const a = generate(lesson, 12), b = generate(lesson, 13)
    expect(a).toEqual(generate(lesson, 12)); expect(a.map(n => n.step)).not.toEqual(b.map(n => n.step))
    expect(a).toHaveLength(lesson.count)
    expect(a.every(n => n.step >= lesson.min && n.step <= lesson.max)).toBe(true)
  })
})
