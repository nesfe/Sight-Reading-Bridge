import type { Lesson } from '../../curriculum/src'
import { recognitionPlan, type RecognitionBlock } from '../../curriculum/src/recognition'

export type ExerciseNote = { id: string; step: number; beat: number; beats: number; chunk: number; pattern: string; block?: RecognitionBlock }
export function generate(lesson: Lesson, seed: number): ExerciseNote[] {
  let state = seed >>> 0
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
  if (lesson.kind === 'flash') return recognition(lesson, seed, random)
  const notes: ExerciseNote[] = []
  const shapes = lesson.id === 'patterns-triads' ? [[0, 2, 4], [4, 2, 0]] : [[0, 1, 2], [2, 1, 0], [0, 0, 1]]
  let shape = shapes[0], base = 0
  for (let i = 0; i < lesson.count; i++) {
    const chunk = Math.floor(i / 3)
    const left = lesson.hands === 'left' || (lesson.hands === 'alternating' && chunk % 2 === 1)
    const min = left ? lesson.min : Math.max(0, lesson.min)
    const max = left ? Math.min(0, lesson.max) : lesson.max
    if (i % 3 === 0) {
      shape = shapes[Math.floor(random() * shapes.length)]
      base = min + Math.floor(random() * Math.max(1, max - min - Math.max(...shape) + 1))
    }
    let step = lesson.kind === 'patterns' ? base + shape[i % 3] : min + Math.floor(random() * (max - min + 1))
    if (lesson.kind !== 'patterns' && notes.at(-1)?.step === step) step = step === max ? min : step + 1
    notes.push({ id: `${seed}-${i}`, step, beat: 4 + i, beats: 1, chunk,
      pattern: lesson.id === 'patterns-triads' ? 'Трезвучие' : shape[0] === shape[1] ? 'Повтор' : shape[0] < shape[2] ? 'Шаги вверх' : 'Шаги вниз' })
  }
  return notes
}

function recognition(lesson: Lesson, seed: number, random: () => number): ExerciseNote[] {
  const pitches = Array.from({ length: lesson.max - lesson.min + 1 }, (_, index) => lesson.min + index)
  const notes: ExerciseNote[] = []
  for (const block of recognitionPlan(lesson.min, lesson.max, lesson.hands === 'alternating')) {
    const sequence: number[] = []
    if (block.id === 'map') {
      for (let round = 0; sequence.length < block.count; round++) {
        const descending = lesson.hands === 'left' ? round % 2 === 0 : round % 2 === 1
        sequence.push(...(descending ? [...pitches].reverse() : pitches))
      }
    } else if (block.id === 'neighbors') {
      const pairs = pitches.slice(0, -1).flatMap(step => [step, step + 1])
      sequence.push(...pairs)
      if (block.count > pairs.length) sequence.push(...pairs.reverse())
    } else {
      // Each shuffled deck contains every pitch once; boundaries cannot repeat a pitch.
      while (sequence.length < block.count) {
        const deck = [...pitches]
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]
        }
        if (deck.length > 1 && deck[0] === (sequence.at(-1) ?? notes.at(-1)?.step)) [deck[0], deck[1]] = [deck[1], deck[0]]
        sequence.push(...deck)
      }
    }
    for (const step of sequence.slice(0, block.count)) {
      const index = notes.length
      notes.push({ id: `${seed}-${index}`, step, beat: 4 + index, beats: 1, chunk: Math.floor(index / 3), pattern: block.title, block: block.id })
    }
  }
  return notes
}
