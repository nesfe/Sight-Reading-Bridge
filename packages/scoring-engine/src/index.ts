import type { Scaffold } from '../../curriculum/src'

export type Attempt = {
  index: number; expected: number; actual: number | null;
  correct: boolean; missed: boolean; reactionMs: number | null;
  timingMs: number | null; releaseMs?: number; at: number;
}
export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2
}
export function summarize(attempts: Attempt[]) {
  const correct = attempts.filter(a => a.correct)
  const errors = attempts.filter(a => !a.correct && !a.missed).length
  const missed = attempts.filter(a => a.missed).length
  return { correct: correct.length, errors, missed,
    accuracy: attempts.length ? correct.length / attempts.length : null,
    reactionMs: median(correct.flatMap(a => a.reactionMs === null ? [] : [a.reactionMs])),
    timingMs: median(correct.flatMap(a => a.timingMs === null ? [] : [Math.abs(a.timingMs)])),
    releaseMs: median(correct.flatMap(a => a.releaseMs === undefined ? [] : [Math.abs(a.releaseMs)])),
  }
}

// A single completed sample can change one support. Orientation is always explicit.
export function adapt(scaffold: Scaffold, attempts: Attempt[], required: number): { scaffold: Scaffold; message: string } {
  const score = summarize(attempts)
  if (attempts.length < 12 || score.accuracy === null) return { scaffold, message: 'Недостаточно данных для изменения подсказок.' }
  const names = { B: 'Подписи нот', C: 'Цвет', D: 'Опоры стана', F: 'Подсветка клавиш' }
  if (score.accuracy >= required && (score.reactionMs === null || score.reactionMs < 1500)) {
    const axis = (['B', 'C', 'D', 'F'] as const).find(key => scaffold[key] > 0)
    if (axis) return { scaffold: { ...scaffold, [axis]: Math.max(0, scaffold[axis] - .25) }, message: `${names[axis]}: поддержка уменьшена на следующую попытку.` }
  }
  if (score.accuracy < .75 && scaffold.B < 1) return { scaffold: { ...scaffold, B: Math.min(1, scaffold.B + .25) }, message: 'Подписи нот усилены на следующую попытку.' }
  return { scaffold, message: 'Подсказки сохранены. Следующая попытка будет на том же уровне.' }
}
