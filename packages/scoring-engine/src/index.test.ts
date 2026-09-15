import { expect, it } from 'vitest'
import { lessons } from '../../curriculum/src'
import { adapt, summarize, type Attempt } from './index'
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
