export type PitchGroup = { pitches: number[]; position: number; measure: number }
export type FollowState = { status: 'ready' | 'running' | 'paused' | 'completed'; index: number; errors: number; held: number[]; feedback: string }

/** Pitch-only following: every chord tone must be attacked at this position and held together. */
export class ScoreFollower {
  readonly groups: PitchGroup[]
  private listeners = new Set<() => void>()
  private attacked = new Set<number>()
  private held = new Set<number>()
  private state: FollowState = { status: 'ready', index: 0, errors: 0, held: [], feedback: 'Ожидание начала' }
  constructor(groups: PitchGroup[]) { this.groups = groups }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private emit(next: Partial<FollowState>) { this.state = { ...this.state, ...next, held: [...this.held] }; this.listeners.forEach(fn => fn()) }
  start = () => { if (!this.groups.length || this.state.status === 'completed') return; this.held.clear(); this.attacked.clear(); this.emit({ status: 'running', feedback: 'Ожидание нажатия' }) }
  pause = () => { if (this.state.status !== 'running') return; this.held.clear(); this.attacked.clear(); this.emit({ status: 'paused', feedback: 'Пауза' }) }
  reset = () => { this.held.clear(); this.attacked.clear(); this.emit({ status: 'ready', index: 0, errors: 0, feedback: 'Ожидание начала' }) }
  noteOff(midi: number) { this.held.delete(midi); this.emit({}) }
  noteOn(midi: number) {
    if (this.held.has(midi)) return
    this.held.add(midi)
    if (this.state.status !== 'running') { this.emit({}); return }
    const target = this.groups[this.state.index].pitches
    if (!target.includes(midi)) { this.emit({ errors: this.state.errors + 1, feedback: 'Другая нота' }); return }
    this.attacked.add(midi)
    if (!target.every(pitch => this.held.has(pitch) && this.attacked.has(pitch))) { this.emit({ feedback: 'Ожидание остальных нот аккорда' }); return }
    const index = this.state.index + 1
    this.attacked.clear()
    this.emit({ index, status: index === this.groups.length ? 'completed' : 'running', feedback: index === this.groups.length ? 'Партитура пройдена' : 'Верно' })
  }
}
