import { expect, it, vi } from 'vitest'
import { decode, midi } from './index'
it('decodes all channels and note-on velocity zero as release', () => {
  expect(decode(new Uint8Array([0x9f, 60, 100]), 10, 12)).toMatchObject({ type: 'on', midi: 60, at: 10, receivedAt: 12 })
  expect(decode(new Uint8Array([0x90, 60, 0]), 10, 12)?.type).toBe('off')
  expect(decode(new Uint8Array([0x80, 60, 44]), 10, 12)?.type).toBe('off')
})
it('does not interpret pedals, clocks or incomplete data as note attacks', () => {
  expect(decode(new Uint8Array([0xb0, 64, 127]), 0, 0)).toBeNull()
  expect(decode(new Uint8Array([0xf8]), 0, 0)).toBeNull()
})

it('dispatches notes synchronously without changing the connection snapshot', async () => {
  const input = { id: 'test', name: 'USB Piano', state: 'connected', onmidimessage: null as ((event: { data: Uint8Array; timeStamp: number }) => void) | null }
  vi.stubGlobal('window', { isSecureContext: true })
  vi.stubGlobal('navigator', { requestMIDIAccess: async () => ({ inputs: new Map([['test', input]]) }) })
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  const events: number[] = []
  const off = midi.onNote(event => events.push(event.midi))
  try {
    await midi.connect()
    const connection = midi.getConnectionSnapshot()
    input.onmidimessage!({ data: new Uint8Array([0x90, 60, 100]), timeStamp: performance.now() })
    expect(events).toEqual([60])
    expect(midi.getSnapshot().last).toBe(60)
    expect(midi.getConnectionSnapshot()).toBe(connection)
    expect(connection.status).toBe('ready')
  } finally { off(); vi.unstubAllGlobals() }
})
