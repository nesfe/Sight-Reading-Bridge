import { expect, it } from 'vitest'
import { decode } from './index'
it('decodes all channels and note-on velocity zero as release', () => {
  expect(decode(new Uint8Array([0x9f, 60, 100]), 10, 12)).toMatchObject({ type: 'on', midi: 60, at: 10, receivedAt: 12 })
  expect(decode(new Uint8Array([0x90, 60, 0]), 10, 12)?.type).toBe('off')
  expect(decode(new Uint8Array([0x80, 60, 44]), 10, 12)?.type).toBe('off')
})
it('does not interpret pedals, clocks or incomplete data as note attacks', () => {
  expect(decode(new Uint8Array([0xb0, 64, 127]), 0, 0)).toBeNull()
  expect(decode(new Uint8Array([0xf8]), 0, 0)).toBeNull()
})
