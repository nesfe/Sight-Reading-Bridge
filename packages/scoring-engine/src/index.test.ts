import { expect, it } from 'vitest'
import { lessons } from '../../curriculum/src'
import { adapt, hasFullCoverage, summarize, summarizePitches, type Attempt } from './index'
const sample: Attempt = { index: 0, expected: 60, actual: 60, correct: true, missed: false, reactionMs: 600, timingMs: null, at: 600 }
it('has no fabricated accuracy before an answer', () => expect(summarize([]).accuracy).toBeNull())
it('includes misses and wrong attacks in accuracy', () => expect(summarize([sample, { ...sample, actual: 61, correct: false }, { ...sample, actual: null, correct: false, missed: true }])).toMatchObject({ accuracy: 1/3, correct: 1, errors: 1, missed: 1 }))
it('changes only one support after sufficient evidence', () => {
  const current = lessons[0].scaffold, attempts = Array.from({ length: 12 }, () => sample)
  expect(adapt(current, attempts.slice(0, 3), .9).scaffold).toEqual(current)
  const next = adapt(current, attempts, .9).scaffold
  expect(Object.keys(current).filter(key => current[key as keyof typeof current] !== next[key as keyof typeof next])).toEqual(['B'])
})
it('preserves support when answers are accurate but slow', () => expect(adapt(lessons[0].scaffold, Array.from({ length: 12 }, () => ({ ...sample, reactionMs: 3000 })), .9).scaffold).toEqual(lessons[0].scaffold))
it('separates first-try recognition from corrected mistakes and repeated appearances', () => {
  const attempts = [{ ...sample, actual: 61, correct: false }, sample, { ...sample, index: 1, reactionMs: 1000 }, { ...sample, index: 2, expected: 62, actual: 62 }]
  expect(summarizePitches(attempts)).toEqual([
    { midi: 60, seen: 2, firstTry: 1, errors: 1, accuracy: 0.5, reactionMs: 800 },
    { midi: 62, seen: 1, firstTry: 1, errors: 0, accuracy: 1, reactionMs: 600 },
  ])
})
it('does not mark an old short session or repeated attempts as full lesson coverage', () => {
  const short = Array.from({ length: 12 }, (_, index) => ({ ...sample, index }))
  expect(hasFullCoverage(short, lessons[0].count)).toBe(false)
  expect(hasFullCoverage(Array.from({ length: 115 }, () => sample), 115)).toBe(false)
  expect(hasFullCoverage(Array.from({ length: 115 }, (_, index) => ({ ...sample, index })), 115)).toBe(true)
})
