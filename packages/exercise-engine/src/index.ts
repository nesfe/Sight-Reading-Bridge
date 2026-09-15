import type { Lesson } from '../../curriculum/src'

export type ExerciseNote = { id: string; step: number; beat: number; beats: number; chunk: number; pattern: string }
export function generate(lesson: Lesson, seed: number): ExerciseNote[] {
  let state = seed >>> 0
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
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
