import { expect, it, vi } from 'vitest'
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { ScoreDisplayController } from './model'
import { ScoreFollower } from './follow'

it('does not update or measure the score cursor on held notes or repeated errors', () => {
  const cursor = { reset: vi.fn(), show: vi.fn(), hide: vi.fn(), next: vi.fn(), Iterator: { EndReached: false }, cursorElement: { closest: vi.fn(() => null) } }
  const controller = new ScoreDisplayController({ cursor } as unknown as OpenSheetMusicDisplay)
  const follower = new ScoreFollower([{ pitches: [60], position: 0, measure: 1 }, { pitches: [62], position: 3, measure: 1 }])
  controller.move(follower)
  for (let i = 0; i < 100; i++) controller.move(follower)
  expect(cursor.show).toHaveBeenCalledTimes(1)
  expect(cursor.cursorElement.closest).not.toHaveBeenCalled()
  controller.hide()
  controller.hide()
  expect(cursor.hide).toHaveBeenCalledTimes(1)
  controller.move(follower)
  expect(cursor.show).toHaveBeenCalledTimes(2)
})
