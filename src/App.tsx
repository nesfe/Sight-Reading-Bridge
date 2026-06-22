import {
  Activity,
  BarChart3,
  BookOpen,
  Eye,
  Gauge,
  GraduationCap,
  Keyboard,
  Layers,
  Music2,
  Piano,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  BASS_LINE_STEPS,
  GRAND_STAFF_LINE_STEPS,
  TREBLE_LINE_STEPS,
  isLine,
  midiToPitch,
  staffStep,
  stepToPitch,
  whiteKeyCenterX,
  whiteKeyLeftX,
} from '../packages/music-core/src/staffGeometry'
import type { KeyboardGeometry } from '../packages/music-core/src/staffGeometry'
import './App.css'

type View = 'trainer' | 'method' | 'progress'
type Axis = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
type ExerciseType = 'flash-notes' | 'eye-etudes' | 'chunk-reader' | 'ahead-reading'

type Scaffold = Record<Axis, number>

type TrainingNote = {
  id: string
  step: number
  onset: number
  duration: number
  chunk?: string
}

type Attempt = {
  correct: boolean
  latencyMs: number
  step: number
  expectedMidi: number
  actualMidi: number
  timestamp: number
}

const KEYBOARD: KeyboardGeometry = {
  minStep: staffStep('C', 2),
  maxStep: staffStep('C', 6),
  keyWidth: 34,
  left: 52,
}

const WHITE_STEPS = Array.from(
  { length: KEYBOARD.maxStep - KEYBOARD.minStep + 1 },
  (_, index) => KEYBOARD.minStep + index,
)

const DEFAULT_SCAFFOLD: Scaffold = {
  A: 1,
  B: 0.72,
  C: 0.78,
  D: 0.86,
  E: 0,
  F: 0.55,
  G: 0.5,
}

const AXIS_LABELS: Record<Axis, string> = {
  A: 'Orientation',
  B: 'Note names',
  C: 'Color',
  D: 'Staff supports',
  E: 'Images',
  F: 'Key highlight',
  G: 'Rhythm detail',
}

const EXERCISES: Record<ExerciseType, { title: string; description: string }> = {
  'flash-notes': {
    title: 'Flash Notes',
    description: 'Static recognition with latency tracking.',
  },
  'eye-etudes': {
    title: 'Eye Etudes',
    description: 'Controlled non-melodic patterns that force real reading.',
  },
  'chunk-reader': {
    title: 'Chunk Reader',
    description: 'Steps, skips, repeats, triads, and short scalar fragments.',
  },
  'ahead-reading': {
    title: 'Ahead Reading',
    description: 'Curtain mode for training eye-hand span.',
  },
}

const SOLFEGE: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Ti',
}

function buildEtude(seed = 1): TrainingNote[] {
  const pattern = [0, 2, 4, 5, 7, 3, -2, -4, -6, -3, 1, 6, 8, 10, 4, 2]
  return pattern.map((step, index) => ({
    id: `n-${seed}-${index}`,
    step,
    onset: index * 0.86 + 1.8,
    duration: index % 4 === 3 ? 0.8 : 0.54,
    chunk: index % 4 === 0 ? 'start' : index % 4 === 1 ? 'step' : index % 4 === 2 ? 'skip' : 'turn',
  }))
}

function App() {
  const [view, setView] = useState<View>('trainer')
  const [exercise, setExercise] = useState<ExerciseType>('eye-etudes')
  const [scaffold, setScaffold] = useState<Scaffold>(DEFAULT_SCAFFOLD)
  const [now, setNow] = useState(0)
  const [running, setRunning] = useState(true)
  const [activeMidi, setActiveMidi] = useState<number | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [midiStatus, setMidiStatus] = useState(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'MIDI waiting for permission'
      : 'Web MIDI unavailable',
  )
  const startRef = useRef(0)
  const lastTargetRef = useRef<string | null>(null)

  const notes = useMemo(() => buildEtude(3), [])
  const target = useMemo(() => {
    return notes.find((note) => Math.abs(note.onset - now) < 0.44) ?? notes.find((note) => note.onset > now) ?? notes[0]
  }, [notes, now])

  const accuracy = attempts.length
    ? Math.round((attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100)
    : 100
  const averageLatency = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0) / attempts.length)
    : 0

  useEffect(() => {
    let frame = 0
    const tick = () => {
      if (running) {
        if (!startRef.current) startRef.current = performance.now()
        const elapsed = (performance.now() - startRef.current) / 1000
        setNow(elapsed % 15)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])

  useEffect(() => {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<MIDIAccess>
    }
    if (!nav.requestMIDIAccess) {
      return
    }

    let cancelled = false
    const inputs: MIDIInput[] = []
    nav
      .requestMIDIAccess()
      .then((access) => {
        if (cancelled) return
        const nextInputs = Array.from(access.inputs.values())
        if (!nextInputs.length) {
          setMidiStatus('No MIDI inputs')
          return
        }

        nextInputs.forEach((input) => {
          input.onmidimessage = (event) => {
            if (!event.data) return
            const [status, midi, velocity] = event.data
            const command = status & 0xf0
            if (command !== 0x90 || velocity === 0) return
            handleNoteInput(midi)
          }
          inputs.push(input)
        })
        setMidiStatus(nextInputs.map((input) => input.name || 'MIDI input').join(', '))
      })
      .catch(() => setMidiStatus('MIDI permission blocked'))

    return () => {
      cancelled = true
      inputs.forEach((input) => {
        input.onmidimessage = null
      })
    }
    // MIDI should bind to the currently visible target and not resubscribe on every attempt list update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id])

  function handleNoteInput(midi: number) {
    const pitch = midiToPitch(midi)
    setActiveMidi(midi)
    window.setTimeout(() => setActiveMidi(null), 160)
    if (!pitch || !target) return

    const expected = stepToPitch(target.step).midi
    const latencyMs = Math.round(Math.abs(target.onset - now) * 1000)
    setAttempts((current) => [
      ...current.slice(-119),
      {
        actualMidi: midi,
        correct: midi === expected,
        expectedMidi: expected,
        latencyMs,
        step: target.step,
        timestamp: Date.now(),
      },
    ])

    if (target.id !== lastTargetRef.current) {
      setScaffold((current) => adaptScaffold(current, midi === expected, latencyMs))
      lastTargetRef.current = target.id
    }
  }

  function resetSession() {
    startRef.current = performance.now()
    setNow(0)
    setAttempts([])
    setScaffold(DEFAULT_SCAFFOLD)
    lastTargetRef.current = null
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Piano size={24} /></div>
          <div>
            <strong>Sight Reading Bridge</strong>
            <span>Electron MIDI trainer</span>
          </div>
        </div>

        <nav className="nav">
          <button className={view === 'trainer' ? 'active' : ''} onClick={() => setView('trainer')}>
            <Music2 size={18} /> Trainer
          </button>
          <button className={view === 'method' ? 'active' : ''} onClick={() => setView('method')}>
            <BookOpen size={18} /> Method
          </button>
          <button className={view === 'progress' ? 'active' : ''} onClick={() => setView('progress')}>
            <BarChart3 size={18} /> Progress
          </button>
        </nav>

        <section className="panel midi-panel">
          <span className="eyebrow">MIDI input</span>
          <p><Keyboard size={17} /> {midiStatus}</p>
        </section>

        <section className="panel">
          <span className="eyebrow">Exercise</span>
          <div className="segmented vertical">
            {(Object.keys(EXERCISES) as ExerciseType[]).map((key) => (
              <button className={exercise === key ? 'active' : ''} key={key} onClick={() => setExercise(key)}>
                <Layers size={16} /> {EXERCISES[key].title}
              </button>
            ))}
          </div>
        </section>

        <section className="download-panel">
          <span className="eyebrow">Packaging</span>
          <p>Electron builds are produced locally into release/ and by GitHub Actions for macOS, Windows, and Linux.</p>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Method-first prototype</span>
            <h1>{view === 'trainer' ? EXERCISES[exercise].title : view === 'method' ? 'Scaffolding vector' : 'Session metrics'}</h1>
            <p>{view === 'trainer' ? EXERCISES[exercise].description : 'Independent axes replace fixed Soft Mozart-style modes.'}</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setRunning((value) => !value)} title="Play or pause">
              <Play size={19} />
            </button>
            <button className="icon-button" onClick={resetSession} title="Reset session">
              <RotateCcw size={19} />
            </button>
          </div>
        </header>

        {view === 'trainer' && (
          <div className="trainer-layout">
            <section className="practice-surface">
              <GrandStaffTrainer
                activeMidi={activeMidi}
                exercise={exercise}
                notes={notes}
                now={now}
                onVirtualKey={handleNoteInput}
                scaffold={scaffold}
                targetId={target?.id}
              />
            </section>
            <ControlRail
              accuracy={accuracy}
              averageLatency={averageLatency}
              scaffold={scaffold}
              setScaffold={setScaffold}
              total={attempts.length}
            />
          </div>
        )}

        {view === 'method' && <MethodView scaffold={scaffold} setScaffold={setScaffold} />}
        {view === 'progress' && (
          <ProgressView accuracy={accuracy} attempts={attempts} averageLatency={averageLatency} />
        )}
      </section>
    </main>
  )
}

function GrandStaffTrainer({
  activeMidi,
  exercise,
  notes,
  now,
  onVirtualKey,
  scaffold,
  targetId,
}: {
  activeMidi: number | null
  exercise: ExerciseType
  notes: TrainingNote[]
  now: number
  onVirtualKey: (midi: number) => void
  scaffold: Scaffold
  targetId?: string
}) {
  const width = KEYBOARD.left * 2 + WHITE_STEPS.length * KEYBOARD.keyWidth
  const height = 640
  const nowLineY = 504
  const pxPerSecond = 118
  const keyboardTop = 532
  const keyboardHeight = 92
  const showHorizontal = scaffold.A < 0.26

  if (showHorizontal) {
    return <HorizontalScore notes={notes} scaffold={scaffold} />
  }

  return (
    <div className="notation-stage">
      <svg className="score-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rotated grand staff aligned to piano keyboard">
        <rect className="stage-bg" x="0" y="0" width={width} height={height} rx="8" />
        <TrebleBassZones width={width} height={keyboardTop - 18} scaffold={scaffold} />

        {GRAND_STAFF_LINE_STEPS.map((step) => {
          const x = whiteKeyCenterX(step, KEYBOARD)
          return (
            <g key={step}>
              <line
                className={`staff-track ${step === 0 ? 'middle-c-track' : TREBLE_LINE_STEPS.includes(step) ? 'treble-track' : 'bass-track'}`}
                x1={x}
                x2={x}
                y1="46"
                y2={keyboardTop - 12}
              />
              {scaffold.D > 0.18 && (
                <text className="line-number" x={x} y="35">
                  {lineNumber(step)}
                </text>
              )}
            </g>
          )
        })}

        {scaffold.D > 0.35 && (
          <>
            <text className="clef-symbol treble-clef" x={whiteKeyCenterX(6, KEYBOARD) - 20} y="84">𝄞</text>
            <text className="clef-symbol bass-clef" x={whiteKeyCenterX(-6, KEYBOARD) - 18} y="84">𝄢</text>
            <text className="middle-c-label" x={whiteKeyCenterX(0, KEYBOARD) + 8} y="88">0 / Middle C</text>
          </>
        )}

        {exercise === 'ahead-reading' && (
          <rect className="reading-curtain" x="0" y={nowLineY - 88} width={width} height="76" />
        )}

        {notes.map((note) => {
          const x = whiteKeyCenterX(note.step, KEYBOARD)
          const y = nowLineY - (note.onset - now) * pxPerSecond
          const visible = y > 28 && y < keyboardTop - 14
          if (!visible) return null
          const pitch = stepToPitch(note.step)
          const isTarget = note.id === targetId
          const isLineNote = isLine(note.step)
          return (
            <g className={`falling-note ${isTarget ? 'target' : ''}`} key={note.id}>
              {note.duration > 0.58 && scaffold.G > 0.25 && (
                <line className="duration-tail" x1={x} x2={x} y1={y} y2={y - note.duration * 54} />
              )}
              {Math.abs(note.step) <= 1 && (
                <line className="ledger-line" x1={x - 21} x2={x + 21} y1={y} y2={y} />
              )}
              <ellipse
                className={`${isLineNote ? 'line-note' : 'space-note'} ${TREBLE_LINE_STEPS.includes(nearestLine(note.step)) ? 'treble-note' : 'bass-note'}`}
                cx={x}
                cy={y}
                rx="16"
                ry="11"
              />
              {scaffold.B > 0.18 && (
                <text className="note-name" x={x} y={y + 4}>
                  {pitch.letter}
                </text>
              )}
              {scaffold.B > 0.62 && (
                <text className="solfege-label" x={x} y={y + 25}>
                  {SOLFEGE[pitch.letter]}
                </text>
              )}
            </g>
          )
        })}

        <line className="now-line" x1="24" x2={width - 24} y1={nowLineY} y2={nowLineY} />
        <text className="now-label" x="30" y={nowLineY - 10}>now</text>

        <KeyboardSvg
          activeMidi={activeMidi}
          keyboardHeight={keyboardHeight}
          keyboardTop={keyboardTop}
          onVirtualKey={onVirtualKey}
          scaffold={scaffold}
          targetStep={notes.find((note) => note.id === targetId)?.step}
        />
      </svg>
    </div>
  )
}

function KeyboardSvg({
  activeMidi,
  keyboardHeight,
  keyboardTop,
  onVirtualKey,
  scaffold,
  targetStep,
}: {
  activeMidi: number | null
  keyboardHeight: number
  keyboardTop: number
  onVirtualKey: (midi: number) => void
  scaffold: Scaffold
  targetStep?: number
}) {
  const blackOffsets: Record<string, number> = {
    C: 0.72,
    D: 0.72,
    F: 0.72,
    G: 0.72,
    A: 0.72,
  }
  return (
    <g className="keyboard-svg">
      {WHITE_STEPS.map((step) => {
        const pitch = stepToPitch(step)
        const x = whiteKeyLeftX(step, KEYBOARD)
        const highlighted = scaffold.F > 0.25 && targetStep === step
        const active = activeMidi === pitch.midi
        return (
          <g key={step}>
            <rect
              className={`white-key-svg ${highlighted ? 'hint' : ''} ${active ? 'active' : ''}`}
              height={keyboardHeight}
              onClick={() => onVirtualKey(pitch.midi)}
              rx="4"
              width={KEYBOARD.keyWidth}
              x={x}
              y={keyboardTop}
            />
            {scaffold.B > 0.45 && (
              <text className="key-label" x={x + KEYBOARD.keyWidth / 2} y={keyboardTop + keyboardHeight - 13}>
                {pitch.letter}
              </text>
            )}
            {blackOffsets[pitch.letter] && step < KEYBOARD.maxStep && (
              <rect
                className="black-key-svg"
                height={keyboardHeight * 0.62}
                rx="3"
                width={KEYBOARD.keyWidth * 0.62}
                x={x + KEYBOARD.keyWidth * blackOffsets[pitch.letter]}
                y={keyboardTop}
              />
            )}
          </g>
        )
      })}
    </g>
  )
}

function HorizontalScore({ notes, scaffold }: { notes: TrainingNote[]; scaffold: Scaffold }) {
  const width = 980
  const yMiddle = 224
  const pitchY = (step: number) => yMiddle - step * 9
  return (
    <div className="notation-stage">
      <svg className="score-svg" viewBox={`0 0 ${width} 520`} role="img" aria-label="Traditional horizontal grand staff">
        <rect className="stage-bg" x="0" y="0" width={width} height="520" rx="8" />
        {TREBLE_LINE_STEPS.map((step) => (
          <line className="horizontal-staff-line treble-track" key={step} x1="90" x2={width - 60} y1={pitchY(step)} y2={pitchY(step)} />
        ))}
        {BASS_LINE_STEPS.map((step) => (
          <line className="horizontal-staff-line bass-track" key={step} x1="90" x2={width - 60} y1={pitchY(step)} y2={pitchY(step)} />
        ))}
        <line className="ledger-line" x1="88" x2={width - 58} y1={pitchY(0)} y2={pitchY(0)} />
        <text className="clef-symbol horizontal-clef" x="104" y={pitchY(6) + 34}>𝄞</text>
        <text className="clef-symbol horizontal-clef" x="106" y={pitchY(-6) + 34}>𝄢</text>
        {notes.slice(0, 10).map((note, index) => {
          const x = 180 + index * 72
          const y = pitchY(note.step)
          const pitch = stepToPitch(note.step)
          return (
            <g key={note.id}>
              {Math.abs(note.step) <= 1 && <line className="ledger-line" x1={x - 22} x2={x + 22} y1={y} y2={y} />}
              <ellipse className={`${isLine(note.step) ? 'line-note' : 'space-note'}`} cx={x} cy={y} rx="15" ry="10" />
              {scaffold.B > 0.25 && <text className="note-name" x={x} y={y + 4}>{pitch.letter}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TrebleBassZones({ width, height, scaffold }: { width: number; height: number; scaffold: Scaffold }) {
  if (scaffold.C < 0.18) return null
  return (
    <g opacity={0.12 + scaffold.C * 0.16}>
      <rect className="bass-zone" x="24" y="46" width={whiteKeyCenterX(-1, KEYBOARD) - 24} height={height - 46} />
      <rect className="treble-zone" x={whiteKeyCenterX(1, KEYBOARD)} y="46" width={width - whiteKeyCenterX(1, KEYBOARD) - 24} height={height - 46} />
    </g>
  )
}

function ControlRail({
  accuracy,
  averageLatency,
  scaffold,
  setScaffold,
  total,
}: {
  accuracy: number
  averageLatency: number
  scaffold: Scaffold
  setScaffold: Dispatch<SetStateAction<Scaffold>>
  total: number
}) {
  return (
    <aside className="control-column">
      <section className="metrics-grid">
        <Metric icon={Target} label="Accuracy" value={`${accuracy}%`} />
        <Metric icon={Gauge} label="Latency" value={averageLatency ? `${averageLatency} ms` : 'fresh'} />
        <Metric icon={Activity} label="Attempts" value={String(total)} />
      </section>
      <section className="panel">
        <span className="eyebrow">Scaffold axes</span>
        <div className="axis-list">
          {(Object.keys(scaffold) as Axis[]).map((axis) => (
            <label key={axis}>
              <span>{axis}. {AXIS_LABELS[axis]}</span>
              <input
                max="1"
                min="0"
                onChange={(event) => setScaffold((current) => ({ ...current, [axis]: Number(event.target.value) }))}
                step="0.01"
                type="range"
                value={scaffold[axis]}
              />
            </label>
          ))}
        </div>
      </section>
    </aside>
  )
}

function MethodView({ scaffold, setScaffold }: { scaffold: Scaffold; setScaffold: Dispatch<SetStateAction<Scaffold>> }) {
  return (
    <div className="method-grid">
      <section className="panel method-panel">
        <h2><SlidersHorizontal size={22} /> Independent scaffolding</h2>
        <p>
          The app no longer uses fixed numbered views as the main model. Each support axis fades independently:
          orientation, note names, color, staff supports, images, key hints, and rhythm detail.
        </p>
        <div className="axis-list wide">
          {(Object.keys(scaffold) as Axis[]).map((axis) => (
            <label key={axis}>
              <span>{axis}. {AXIS_LABELS[axis]}</span>
              <input
                max="1"
                min="0"
                onChange={(event) => setScaffold((current) => ({ ...current, [axis]: Number(event.target.value) }))}
                step="0.01"
                type="range"
                value={scaffold[axis]}
              />
            </label>
          ))}
        </div>
      </section>
      <section className="panel method-panel">
        <h2><GraduationCap size={22} /> Adult path</h2>
        <p>
          The MVP prioritizes flash recognition, eye etudes, chunk reading, and ahead-reading. Motor basics and
          child-facing story theory are intentionally not the first screen.
        </p>
      </section>
    </div>
  )
}

function ProgressView({
  accuracy,
  attempts,
  averageLatency,
}: {
  accuracy: number
  attempts: Attempt[]
  averageLatency: number
}) {
  return (
    <div className="progress-layout">
      <section className="metrics-grid wide">
        <Metric icon={Target} label="Overall accuracy" value={`${accuracy}%`} />
        <Metric icon={Gauge} label="Average latency" value={averageLatency ? `${averageLatency} ms` : 'fresh'} />
        <Metric icon={Eye} label="Eye-hand proxy" value="curtain ready" />
        <Metric icon={Activity} label="Attempts" value={String(attempts.length)} />
      </section>
      <section className="panel chart-panel">
        <h2><BarChart3 size={22} /> Recent answers</h2>
        <div className="bar-chart">
          {(attempts.length ? attempts.slice(-24) : Array.from({ length: 24 }, () => null)).map((attempt, index) => (
            <span
              className={attempt?.correct ? 'good' : attempt ? 'miss' : ''}
              key={index}
              style={{ height: attempt ? `${Math.max(16, 100 - attempt.latencyMs / 18)}%` : '16%' }}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function nearestLine(step: number) {
  return step % 2 === 0 ? step : step - 1
}

function lineNumber(step: number) {
  if (step === 0) return '0'
  if (TREBLE_LINE_STEPS.includes(step)) return String(TREBLE_LINE_STEPS.indexOf(step) + 1)
  if (BASS_LINE_STEPS.includes(step)) return String(BASS_LINE_STEPS.length - BASS_LINE_STEPS.indexOf(step))
  return ''
}

function adaptScaffold(current: Scaffold, correct: boolean, latencyMs: number): Scaffold {
  const delta = correct && latencyMs < 420 ? -0.035 : 0.045
  return {
    ...current,
    B: clamp(current.B + delta),
    F: clamp(current.F + delta),
    C: clamp(current.C + delta / 2),
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}

export default App
