import { describe, expect, it } from 'vitest'
import { lessons } from '../../curriculum/src'
import { recognitionPlan } from '../../curriculum/src/recognition'
import { stepToPitch } from '../../music-core/src/staffGeometry'
import { generate } from './index'
import { Session } from './session'

describe('recognition material coverage', () => {
  it.each(lessons.filter(lesson => lesson.kind === 'flash'))('$id repeatedly presents every pitch in every block, regardless of seed', lesson => {
    const pitches = Array.from({ length: lesson.max - lesson.min + 1 }, (_, i) => lesson.min + i)
    for (let seed = 0; seed < 50; seed++) {
      const notes = generate(lesson, seed)
      expect(notes.length).toBe(lesson.count)
      expect(notes.length).toBeGreaterThan(100)
      for (const pitch of pitches) expect(notes.filter(note => note.step === pitch).length).toBeGreaterThanOrEqual(lesson.hands === 'alternating' ? 8 : 15)
      for (const block of recognitionPlan(lesson.min, lesson.max, lesson.hands === 'alternating')) {
        const material = notes.slice(block.start, block.start + block.count)
        expect([...new Set(material.map(note => note.step))].sort((a, b) => a - b)).toEqual(pitches)
        expect(material.every(note => note.block === block.id)).toBe(true)
        if (block.id === 'mixed' || block.id === 'check') {
          for (let start = 0; start < material.length; start += pitches.length) {
            expect(material.slice(start, start + pitches.length).map(note => note.step).sort((a, b) => a - b)).toEqual(pitches)
          }
          expect(material.every((note, i) => i === 0 || note.step !== material[i - 1].step)).toBe(true)
        }
      }
    }
  })
  it('starts both hands at middle C and moves one staff position at a time in the map', () => {
    for (const lesson of lessons.slice(0, 2)) {
      const map = generate(lesson, 1).filter(note => note.block === 'map')
      expect(map[0].step).toBe(0)
      expect(map.every((note, i) => i === 0 || Math.abs(note.step - map[i - 1].step) <= 1)).toBe(true)
    }
  })
})

describe('recognition block breaks', () => {
  const material = generate(lessons[0], 12)
  const notes = [material[27], material[28], material[29]]
  it('waits at a block boundary, excludes rest time, clears keys and resumes without skipping', () => {
    const s = new Session(notes, false, 60)
    s.start(0); s.markShown(10)
    const first = stepToPitch(notes[0].step).midi, next = stepToPitch(notes[1].step).midi
    s.noteOn(first, 500); s.noteOff(first, 700)
    expect(s.state).toMatchObject({ status: 'break', cursor: 1, elapsed: 700 })
    s.noteOn(next, 5000); s.tick(6000)
    expect(s.state.attempts).toHaveLength(1)
    s.resume(10000); s.markShown(10010); s.noteOn(next, 10310); s.noteOff(next, 10500)
    expect(s.state).toMatchObject({ status: 'running', cursor: 2, elapsed: 1200 })
    expect(s.state.attempts[1].reactionMs).toBe(300)
    s.markShown(10600); const last = stepToPitch(notes[2].step).midi
    s.noteOn(last, 11000); s.noteOff(last, 11100)
    expect(s.state.status).toBe('completed')
  })
  it('keeps the boundary break when disconnect happens before the final release', () => {
    const s = new Session(notes, false, 60)
    s.start(0); s.markShown(10); s.noteOn(stepToPitch(notes[0].step).midi, 500)
    s.pause(600); s.resume(10000)
    expect(s.state).toMatchObject({ status: 'break', cursor: 1, held: [] })
    expect(s.state.attempts).toHaveLength(1)
    s.resume(11000)
    expect(s.state.status).toBe('running')
  })
  it('has exactly three breaks during a complete four-block lesson', () => {
    const s = new Session(material, false, 60)
    let breaks = 0
    s.start(0)
    for (let i = 0; i < material.length; i++) {
      if (s.state.status === 'break') { breaks++; s.resume(i * 1000) }
      s.markShown(i * 1000 + 10)
      const pitch = stepToPitch(material[i].step).midi
      s.noteOn(pitch, i * 1000 + 300); s.noteOff(pitch, i * 1000 + 500)
    }
    expect(breaks).toBe(3)
    expect(s.state.status).toBe('completed')
    expect(s.state.attempts).toHaveLength(material.length)
  })
})
