import { useEffect, useRef } from 'react'
import { Renderer, Stave, StaveNote, TickContext, StaveConnector, Clef, Glyph } from 'vexflow'
import type { Scaffold } from '../../curriculum/src'
import type { ExerciseNote } from '../../exercise-engine/src'
import { Session } from '../../exercise-engine/src/session'
import { BASS_LINE_STEPS, TREBLE_LINE_STEPS, stepToPitch, whiteKeyCenterX, whiteKeyLeftX } from '../../music-core/src/staffGeometry'

import { keyboard, noteName, staffLineWidth, staffLineColor } from './geometry'
const steps = Array.from({ length: 21 }, (_, i) => i - 10)

export function PianoKeyboard({ held, hint, onDown, onUp }: { held: number[]; hint?: number; onDown: (midi: number) => void; onUp: (midi: number) => void }) {
  const events = (midi: number) => ({
    role: 'button', tabIndex: 0, 'aria-label': `Клавиша MIDI ${midi}`, 'data-midi': midi,
    onPointerDown: (e: React.PointerEvent<SVGRectElement>) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); onDown(midi) },
    onPointerUp: () => onUp(midi), onPointerCancel: () => onUp(midi), onLostPointerCapture: () => onUp(midi),
    onKeyDown: (e: React.KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); onDown(midi) } },
    onKeyUp: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onUp(midi) },
  })
  return <g className="piano-keys">
    {steps.map(step => { const p = stepToPitch(step); return <g key={step}>
      <rect {...events(p.midi)} x={whiteKeyLeftX(step, keyboard)} y="370" width="36" height="96" rx="3" className={`white-key ${held.includes(p.midi) ? 'pressed' : ''} ${hint === step ? 'hint' : ''}`} />
      {p.letter === 'C' && <text className="key-name" x={whiteKeyCenterX(step, keyboard)} y="451">C{p.octave}</text>}
    </g> })}
    {steps.filter(step => ['C', 'D', 'F', 'G', 'A'].includes(stepToPitch(step).letter) && step < keyboard.maxStep).map(step => {
      const midi = stepToPitch(step).midi + 1
      return <rect key={midi} {...events(midi)} x={whiteKeyLeftX(step, keyboard) + 25} y="370" width="22" height="57" rx="2" className={`black-key ${held.includes(midi) ? 'pressed' : ''}`} />
    })}
  </g>
}

export function Score({ session, scaffold, kind, horizon, cursor, held, onDown, onUp }: {
  session: Session; scaffold: Scaffold; kind: string; horizon: number; cursor: number; held: number[];
  onDown: (midi: number) => void; onUp: (midi: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null)
  const horizontal = scaffold.A === 0
  const notes = session.notes
  const visible = (note: ExerciseNote, index: number) => session.timed || (kind === 'patterns' ? note.chunk === notes[Math.min(cursor, notes.length - 1)].chunk : index === cursor)
  useEffect(() => {
    const div = root.current
    if (!div || horizontal || !notes[cursor]) return
    const svg = div.querySelector('svg')
    if (!svg) return
    const centerCurrent = () => {
      const matrix = svg.getScreenCTM()
      if (!matrix || svg.clientWidth <= div.clientWidth) return
      const point = svg.createSVGPoint()
      point.x = whiteKeyCenterX(notes[cursor].step, keyboard)
      div.scrollLeft += point.matrixTransform(matrix).x - div.getBoundingClientRect().left - div.clientWidth / 2
    }
    centerCurrent()
    const observer = new ResizeObserver(centerCurrent)
    observer.observe(div)
    return () => observer.disconnect()
  }, [cursor, horizontal, notes])
  useEffect(() => {
    if (!session.timed) return
    let frame = 0
    const animate = () => {
      const elapsed = session.elapsedAt(performance.now()), beat = session.beatMs
      root.current?.querySelectorAll<SVGGElement>('[data-note-index]').forEach(group => {
        const index = Number(group.dataset.noteIndex), distance = (session.onset(index) - elapsed) / beat
        const covered = kind === 'ahead' && distance <= horizon && distance >= -.5
        const hide = covered || distance < -.5 || distance > (horizontal ? 8 : 4.4)
        group.style.visibility = hide ? 'hidden' : 'visible'
        group.setAttribute('transform', horizontal ? `translate(${160 + distance * 72 - (160 + index * 72)},0)` : `translate(0,${330 - distance * 62})`)
      })
      const count = root.current?.querySelector('[data-count-in]')
      if (count) count.textContent = session.state.status === 'running' && elapsed < session.onset(0) ? String(Math.ceil((session.onset(0) - elapsed) / beat)) : ''
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [session, kind, horizon, horizontal])

  return <div ref={root} className="score-scroll" aria-label={horizontal ? 'Горизонтальный большой нотный стан' : 'Повёрнутый большой нотный стан'}>
    {horizontal ? <Horizontal notes={notes.filter(visible)} allNotes={notes} cursor={cursor} scaffold={scaffold} timed={session.timed} horizon={kind === 'ahead' ? horizon : 0} /> :
      <svg className="score" viewBox="0 0 836 480">
        {[...BASS_LINE_STEPS, ...TREBLE_LINE_STEPS].map(step => <g key={step}>
          <line data-staff-step={step} x1={whiteKeyCenterX(step, keyboard)} x2={whiteKeyCenterX(step, keyboard)} y1="45" y2="370" className="staff-line" style={{ strokeWidth: staffLineWidth(keyboard.keyWidth, scaffold.D), stroke: staffLineColor(step < 0, scaffold.C, scaffold.D) }} />
          {scaffold.D > 0 && <text opacity={scaffold.D} className="line-number" x={whiteKeyCenterX(step, keyboard)} y="29">{Math.abs(step) / 2}</text>}
        </g>)}
        {scaffold.D > 0 && <text opacity={scaffold.D} className="line-number middle-c" x={whiteKeyCenterX(0, keyboard)} y="29">0</text>}
        <text className="zone-label" x="90" y="17">Басовый ключ</text><text className="zone-label" x="545" y="17">Скрипичный ключ</text>
        <VerticalClefs />
        {notes.map((note, index) => visible(note, index) && <g data-note-index={index} key={note.id} style={session.timed ? { visibility: 'hidden' } : undefined} transform={`translate(0,${session.timed ? 330 - note.beat * 62 : kind === 'patterns' ? 140 + index % 3 * 70 : 230})`}>
          <ellipse data-note-step={note.step} cx={whiteKeyCenterX(note.step, keyboard)} cy="0" rx="9" ry="13" fill={index < cursor ? '#178464' : `color-mix(in srgb, ${note.step % 2 === 0 ? '#c95843' : '#207e90'} ${scaffold.C * 100}%, #1e2329)`} />
          {note.step === 0 && <line data-ledger-step="0" className="ledger-line" x1={whiteKeyCenterX(0, keyboard)} x2={whiteKeyCenterX(0, keyboard)} y1="-18" y2="18" />}
          {session.timed && scaffold.G > 0 && <line opacity={scaffold.G} className="note-stem" x1={whiteKeyCenterX(note.step, keyboard)} x2={whiteKeyCenterX(note.step, keyboard) + 40} y1="-11" y2="-11" />}
          {scaffold.B > 0 && <text className="note-label" textAnchor="middle" opacity={scaffold.B} x={whiteKeyCenterX(note.step, keyboard)} y="36">{noteName(note.step)}</text>}
        </g>)}
        {session.timed && <line className="focus-line" x1="30" x2="806" y1="330" y2="330" />}
        {kind === 'ahead' && <rect className="curtain" x="30" y={330 - horizon * 62} width="776" height={horizon * 62} />}
        <text data-count-in className="count-in" x="418" y="180" />
        <PianoKeyboard held={held} hint={scaffold.F > 0 && kind !== 'ahead' ? notes[cursor]?.step : undefined} onDown={onDown} onUp={onUp} />
      </svg>}
    {horizontal && <svg className="score keyboard-only" viewBox="0 360 836 120"><PianoKeyboard held={held} onDown={onDown} onUp={onUp} /></svg>}
  </div>
}

function Horizontal({ notes, allNotes, cursor, scaffold, timed, horizon }: { notes: ExerciseNote[]; allNotes: ExerciseNote[]; cursor: number; scaffold: Scaffold; timed: boolean; horizon: number }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const div = container.current
    if (!div) return
    div.replaceChildren()
    const renderer = new Renderer(div, Renderer.Backends.SVG)
    renderer.resize(836, 335)
    const ctx = renderer.getContext()
    const top = new Stave(35, 30, 770).addClef('treble')
    const bottom = new Stave(35, 180, 770).addClef('bass')
    top.setStyle({ lineWidth: staffLineWidth(5, scaffold.D), strokeStyle: staffLineColor(false, scaffold.C, scaffold.D) }).setContext(ctx).draw()
    bottom.setStyle({ lineWidth: staffLineWidth(5, scaffold.D), strokeStyle: staffLineColor(true, scaffold.C, scaffold.D) }).setContext(ctx).draw()
    new StaveConnector(top, bottom).setType(StaveConnector.type.BRACE).setContext(ctx).draw()
    notes.forEach((note, visibleIndex) => {
      const index = allNotes.indexOf(note), pitch = stepToPitch(note.step), clef = note.step < 0 ? 'bass' : 'treble'
      const staveNote = new StaveNote({ clef, keys: [`${pitch.letter.toLowerCase()}/${pitch.octave}`], duration: 'q' })
      // Self-paced pitch exercises carry no rhythmic value, regardless of presentation.
      staveNote.getStem()?.setVisibility(timed)
      const x = timed ? 160 + index * 72 : 210 + visibleIndex * 165
      new TickContext().addTickable(staveNote).preFormat().setX(x - 35)
      staveNote.setStave(clef === 'bass' ? bottom : top).setContext(ctx)
      const color = index < cursor ? '#178464' : `color-mix(in srgb, ${note.step % 2 === 0 ? '#c95843' : '#207e90'} ${scaffold.C * 100}%, #1e2329)`
      staveNote.setStyle({ fillStyle: color, strokeStyle: color })
      const group = ctx.openGroup('score-note')
      group?.setAttribute('data-note-index', String(index))
      if (timed && group) group.style.visibility = 'hidden'
      staveNote.draw()
      if (scaffold.B > 0) { ctx.setFont('sans-serif', 12, '').fillText(noteName(note.step), x, clef === 'bass' ? 310 : 160) }
      ctx.closeGroup()
    })
    const svg = div.querySelector('svg')!
    svg.setAttribute('viewBox', '0 0 836 335'); svg.removeAttribute('width'); svg.removeAttribute('height'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Скрипичный и басовый ключи')
    if (timed) {
      const count = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      Object.entries({ 'data-count-in': '', x: '418', y: '180', class: 'count-in' }).forEach(([k,v]) => count.setAttribute(k,v)); svg.append(count)
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      Object.entries({ x1: '160', x2: '160', y1: '30', y2: '305', class: 'focus-line' }).forEach(([k,v]) => line.setAttribute(k,v)); svg.append(line)
      if (horizon) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        Object.entries({ x: '160', y: '30', width: String(horizon * 72), height: '275', class: 'curtain' }).forEach(([k,v]) => rect.setAttribute(k,v)); svg.append(rect)
      }
    }
  }, [notes, allNotes, cursor, scaffold, timed, horizon])
  return <div className="standard-score" ref={container} />
}

function VerticalClefs() {
  const group = useRef<SVGGElement>(null)
  useEffect(() => {
    if (!group.current) return
    group.current.replaceChildren()
    for (const [type, step] of [['treble', 4], ['bass', -4]] as const) {
      const div = document.createElement('div')
      const renderer = new Renderer(div, Renderer.Backends.SVG)
      Glyph.renderGlyph(renderer.getContext(), 0, 0, 32, Clef.types[type].code)
      const clef = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      clef.setAttribute('transform', `translate(${whiteKeyCenterX(step, keyboard)},58) rotate(90)`)
      clef.setAttribute('aria-label', type === 'treble' ? 'Скрипичный ключ' : 'Басовый ключ')
      div.querySelectorAll('path').forEach(path => clef.append(path))
      group.current.append(clef)
    }
  }, [])
  return <g ref={group} className="vertical-clefs" />
}
