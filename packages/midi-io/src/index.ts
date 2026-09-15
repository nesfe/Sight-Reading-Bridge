export type NoteEvent = { type: 'on' | 'off'; midi: number; velocity: number; at: number; receivedAt: number }
export type MidiState = { status: 'idle' | 'connecting' | 'ready' | 'error'; message: string; devices: { id: string; name: string }[]; selected: string; last: number | null }

export function decode(data: Uint8Array, at: number, receivedAt: number): NoteEvent | null {
  if (data.length < 3) return null
  const [status, midi, velocity] = data, command = status & 0xf0
  if (command !== 0x90 && command !== 0x80) return null
  return { type: command === 0x80 || velocity === 0 ? 'off' : 'on', midi, velocity, at, receivedAt }
}

class MidiInputService {
  private access: MIDIAccess | null = null
  private input: MIDIInput | null = null
  private listeners = new Set<() => void>()
  private events = new Set<(event: NoteEvent) => void>()
  private disconnected = new Set<() => void>()
  private state: MidiState = { status: 'idle', message: 'Инструмент не подключён', devices: [], selected: '', last: null }
  readonly dispatchSamples: number[] = []
  readonly frameSamples: number[] = []
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getSnapshot = () => this.state
  onNote(fn: (event: NoteEvent) => void) { this.events.add(fn); return () => { this.events.delete(fn) } }
  onDisconnect(fn: () => void) { this.disconnected.add(fn); return () => { this.disconnected.delete(fn) } }
  private publish(update: Partial<MidiState>) { this.state = { ...this.state, ...update }; this.listeners.forEach(fn => fn()) }
  async connect() {
    if (this.state.status === 'connecting') return
    if (!window.isSecureContext || !navigator.requestMIDIAccess) {
      this.publish({ status: 'error', message: window.isSecureContext ? 'Web MIDI недоступен. Откройте в Chrome или desktop-приложении.' : 'Для MIDI требуется HTTPS.' }); return
    }
    this.publish({ status: 'connecting', message: 'Ожидание разрешения MIDI' })
    try {
      this.access ??= await navigator.requestMIDIAccess({ sysex: false })
      this.access.onstatechange = () => this.refresh()
      this.refresh()
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      this.publish({ status: 'error', message: denied ? 'Доступ к MIDI не разрешён. Проверьте разрешения сайта.' : 'Не удалось открыть системный MIDI. Проверьте устройство и доступ к нему в системе.' })
    }
  }
  private refresh() {
    const devices = [...(this.access?.inputs.values() ?? [])].filter(input => input.state === 'connected').map(input => ({ id: input.id, name: input.name ?? 'MIDI' }))
    this.publish({ devices })
    if (this.input && !devices.some(d => d.id === this.input?.id)) {
      this.input.onmidimessage = null; this.input = null
      this.disconnected.forEach(fn => fn())
    }
    if (!this.input) {
      const candidate = devices.find(d => d.id === this.state.selected) ?? devices.find(d => /kawai|ca701/i.test(d.name)) ?? devices[0]
      if (candidate) this.select(candidate.id)
      else this.publish({ status: 'idle', message: 'USB-MIDI устройство не найдено', selected: '' })
    }
  }
  select(id: string) {
    if (this.input?.id === id) return
    if (this.input) { this.input.onmidimessage = null; this.disconnected.forEach(fn => fn()); void this.input.close() }
    this.input = this.access?.inputs.get(id) ?? null
    if (!this.input) return
    this.input.onmidimessage = event => {
      const receivedAt = performance.now()
      if (!event.data) return
      const timestamp = event.timeStamp > 0 && event.timeStamp <= receivedAt ? event.timeStamp : receivedAt
      const note = decode(event.data, timestamp, receivedAt)
      if (!note) return
      // Feedback listeners run immediately, before UI status and persistence work.
      this.events.forEach(fn => fn(note))
      if (note.type === 'on') {
        this.dispatchSamples.push(receivedAt - timestamp)
        if (this.dispatchSamples.length > 256) this.dispatchSamples.shift()
        requestAnimationFrame(() => {
          this.frameSamples.push(performance.now() - timestamp)
          if (this.frameSamples.length > 256) this.frameSamples.shift()
        })
        this.publish({ last: note.midi })
      }
    }
    this.publish({ selected: id, status: 'ready', message: this.input.name ?? 'MIDI' })
  }
}
export const midi = new MidiInputService()
