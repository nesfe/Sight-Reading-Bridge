import type { ExerciseNote } from './index'
import type { Attempt } from '../../scoring-engine/src'
import { stepToPitch } from '../../music-core/src/staffGeometry'

export type Status = 'ready' | 'running' | 'paused' | 'completed'
export type SessionState = { status: Status; cursor: number; elapsed: number; attempts: Attempt[]; feedback: 'none' | 'correct' | 'wrong'; held: number[] }
export class Session {
  state: SessionState = { status: 'ready', cursor: 0, elapsed: 0, attempts: [], feedback: 'none', held: [] }
  private listeners = new Set<() => void>()
  private clock = 0
  private shownAt: number | null = null
  private accepted: number | null = null
  private held = new Set<number>()
  private releaseTargets = new Map<number, { index: number; end: number }>()
  readonly notes: ExerciseNote[]
  readonly timed: boolean
  readonly tempo: number
  constructor(notes: ExerciseNote[], timed: boolean, tempo: number) { this.notes = notes; this.timed = timed; this.tempo = tempo }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private emit(update: Partial<SessionState>) { this.state = { ...this.state, ...update }; this.listeners.forEach(fn => fn()) }
  start(now: number) {
    if (this.state.status !== 'ready') return
    this.clock = now; this.shownAt = null
    this.emit({ status: 'running' })
  }
  markShown(now: number) { if (this.shownAt === null && this.state.status === 'running') this.shownAt = now }
  pause(now: number) {
    if (this.state.status !== 'running') return
    this.tick(now)
    if (this.state.status === 'running') this.emit({ status: 'paused', held: [], elapsed: now - this.clock })
    this.held.clear(); this.releaseTargets.clear()
  }
  resume(now: number) {
    if (this.state.status !== 'paused') return
    this.clock = now - this.state.elapsed; this.shownAt = null
    // A correct note awaiting release must not require a second scored attack after disconnect.
    if (this.accepted !== null) { this.accepted = null; this.advance() }
    if (this.state.cursor < this.notes.length || this.timed) this.emit({ status: 'running', feedback: 'none' })
  }
  tick(now: number) {
    if (this.state.status !== 'running') return
    const elapsed = now - this.clock
    if (this.timed) {
      let cursor = this.state.cursor
      const attempts = [...this.state.attempts]
      while (cursor < this.notes.length && elapsed > this.onset(cursor) + this.window) {
        attempts.push({ index: cursor, expected: stepToPitch(this.notes[cursor].step).midi, actual: null, correct: false, missed: true, reactionMs: null, timingMs: null, at: elapsed })
        cursor++
      }
      const finished = cursor === this.notes.length && elapsed >= this.onset(this.notes.length - 1) + this.beatMs
      if (cursor !== this.state.cursor || finished) this.emit({ elapsed, cursor, attempts, ...(finished ? { status: 'completed' as const } : {}) })
    }
  }
  elapsedAt(now: number) { return this.state.status === 'running' ? now - this.clock : this.state.elapsed }
  get beatMs() { return 60000 / this.tempo }
  get window() { return Math.min(300, this.beatMs * .4) }
  onset(index: number) { return this.notes[index].beat * this.beatMs }
  noteOn(midi: number, now: number) {
    if (this.held.has(midi)) return
    this.held.add(midi)
    this.emit({ held: [...this.held] })
    if (this.state.status !== 'running' || this.accepted !== null || this.state.cursor >= this.notes.length) return
    this.tick(now)
    if (this.state.cursor >= this.notes.length) return
    if (!this.timed && this.shownAt === null) return
    const index = this.state.cursor, expected = stepToPitch(this.notes[index].step).midi
    const timingMs = this.timed ? now - this.clock - this.onset(index) : null
    // Ignore the count-in, but count extra attacks once performance starts.
    if (this.timed && now - this.clock < this.onset(0) - this.window) return
    const correct = expected === midi && (timingMs === null || Math.abs(timingMs) <= this.window)
    const attempt: Attempt = { index, expected, actual: midi, correct, missed: false,
      reactionMs: this.timed ? null : Math.max(0, now - (this.shownAt ?? now)), timingMs, at: now - this.clock }
    this.emit({ elapsed: now - this.clock, attempts: [...this.state.attempts, attempt], feedback: correct ? 'correct' : 'wrong' })
    if (correct) {
      if (this.timed) {
        this.releaseTargets.set(midi, { index: this.state.attempts.length - 1, end: this.onset(index) + this.notes[index].beats * this.beatMs })
        this.advance()
      } else this.accepted = midi
    }
  }
  noteOff(midi: number, now: number) {
    this.held.delete(midi)
    const release = this.releaseTargets.get(midi)
    if (release && this.state.status === 'running') {
      const attempts = this.state.attempts.map((a, i) => i === release.index ? { ...a, releaseMs: now - this.clock - release.end } : a)
      this.releaseTargets.delete(midi); this.emit({ attempts })
    }
    this.emit({ held: [...this.held] })
    if (this.state.status === 'running' && this.accepted === midi) { this.accepted = null; this.advance() }
  }
  private advance() {
    const cursor = this.state.cursor + 1
    this.shownAt = null
    this.emit({ cursor, ...(!this.timed && cursor === this.notes.length ? { status: 'completed' as const } : {}) })
  }
}
