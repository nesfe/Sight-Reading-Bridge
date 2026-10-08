import { useEffect, useMemo, useRef } from 'react'
import { Accidental, Dot, Glyph, Renderer, Stave, StaveNote, StaveTie, TickContext } from 'vexflow'
import { t } from '../../i18n/src'
import type { TeachingFrame } from '../../score-import/src/teaching'
import { BASS_LINE_STEPS, TREBLE_LINE_STEPS, stepToPitch, whiteKeyCenterX, whiteKeyLeftX } from '../../music-core/src/staffGeometry'

export function RepertoireVertical({ frames, position, staff, staves, held, onDown, onUp, keyboardOnly = false }: {
  frames: TeachingFrame[]; position: number; staff: number; staves: number[]; held: number[]; onDown: (note: number) => void; onUp: (note: number) => void; keyboardOnly?: boolean;
}) {
  const glyphs = useRef<SVGGElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const geometry = useMemo(() => {
    const steps = frames.flatMap(frame => frame.notes.filter(note => note.midi !== null).map(note => note.step))
    return { minStep: Math.min(-10, ...steps) - 3, maxStep: Math.max(10, ...steps) + 3, keyWidth: 18, left: 32 }
  }, [frames])
  const width = (geometry.maxStep - geometry.minStep + 1) * geometry.keyWidth + 64
  const keys = Array.from({ length: geometry.maxStep - geometry.minStep + 1 }, (_, i) => geometry.minStep + i).filter(step => { const midi = stepToPitch(step).midi; return midi >= 21 && midi <= 108 })
  const index = Math.max(0, frames.findIndex(frame => frame.position >= position))
  const window = frames.slice(index).filter(frame => staff === -1 || frame.notes.some(note => note.staff === staff)).slice(0, 4)
  const scale = geometry.keyWidth / 5
  const centerY = (width - whiteKeyCenterX(0, geometry)) / scale
  useEffect(() => {
    const host = glyphs.current!
    const div = document.createElement('div')
    const renderer = new Renderer(div, Renderer.Backends.SVG)
    renderer.resize(150, width / scale)
    const context = renderer.getContext()
    const treble = new Stave(0, centerY - 90, 150)
    const bass = new Stave(0, centerY - 30, 150)
    Glyph.renderGlyph(context, 4, treble.getYForLine(3), 20, 'gClef')
    Glyph.renderGlyph(context, 4, bass.getYForLine(1), 20, 'fClef')
    const previous = new Map<string, { symbol: StaveNote; key: number }>()
    const ties: StaveTie[] = []
    for (let i = 0; i < window.length; i++) {
      const voices = new Map<string, typeof window[number]['notes']>()
      for (const note of window[i].notes) {
        if (staff !== -1 && note.staff !== staff) continue
        const id = `${note.voice}:${note.staff}:${note.duration}:${note.dots}:${note.midi === null}`
        voices.set(id, [...(voices.get(id) ?? []), note])
      }
      for (const notes of voices.values()) {
        const first = notes[0], left = first.staff === staves[1], rest = first.midi === null
        const symbol = new StaveNote({ clef: left ? 'bass' : 'treble', keys: rest ? [left ? 'd/3' : 'b/4'] : notes.map(note => note.key), duration: `${first.duration}${rest ? 'r' : ''}`, stem_direction: left ? -1 : 1, glyph_font_scale: 24 })
        symbol.setStemLength(16)
        symbol.setStemDirection(left ? -1 : 1)
        symbol.setStave(left ? bass : treble)
        symbol.getStem()?.setStyle({ lineWidth: 0.6 })
        symbol.setStyle({ fillStyle: i === 0 ? '#176e60' : '#293a3e', strokeStyle: i === 0 ? '#176e60' : '#293a3e' })
        if (!rest) notes.forEach((note, key) => { if (note.accidental) symbol.addModifier(new Accidental(note.accidental), key) })
        for (let dot = 0; dot < first.dots; dot++) Dot.buildAndAttach([symbol], { all: true })
        const tick = new TickContext().addTickable(symbol).preFormat().setX(0)
        tick.setX(28 + i * 28 - symbol.getAbsoluteX() - symbol.getGlyphWidth() / 2)
        const group = context.openGroup('course-voice')
        group.setAttribute('data-pitches', notes.map(note => note.midi ?? 'rest').join(','))
        symbol.setContext(context).draw()
        context.closeGroup()
        if (!rest) notes.forEach((note, key) => {
          const id = `${note.voice}:${note.staff}:${note.midi}`
          const from = previous.get(id)
          if (note.tied) ties.push(new StaveTie({ first_note: from?.symbol, first_indices: [from?.key ?? 0], last_note: symbol, last_indices: [key] }))
          previous.set(id, { symbol, key })
        })
      }
    }
    ties.forEach(tie => { tie.render_options.cp1 = 3; tie.render_options.cp2 = 5; tie.setContext(context).draw() })
    const svg = div.querySelector('svg')!
    host.replaceChildren(...Array.from(svg.childNodes))
    return () => host.replaceChildren()
  }, [frames, index, staff, staves[0], staves[1], width, scale, centerY]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const host = scroller.current!
    const center = () => {
      const note = frames[index]?.notes.find(note => note.midi !== null && (staff === -1 || note.staff === staff))
      const key = note && host.querySelector(`[data-midi="${note.midi}"]`)
      if (!key) return
      const target = key.getBoundingClientRect(), visible = host.getBoundingClientRect()
      if (target.left < visible.left + 24 || target.right > visible.right - 24) host.scrollLeft += target.x + target.width / 2 - visible.x - visible.width / 2
    }
    center()
    const observer = new ResizeObserver(center)
    observer.observe(host)
    return () => observer.disconnect()
  }, [frames, index, staff])
  const events = (midi: number) => ({
    role: 'button', tabIndex: 0, 'aria-label': t('Клавиша MIDI {{number}}', { number: midi }), 'data-midi': midi,
    onPointerDown: (event: React.PointerEvent<SVGRectElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onDown(midi) },
    onPointerUp: () => onUp(midi), onPointerCancel: () => onUp(midi), onLostPointerCapture: () => onUp(midi),
    onKeyDown: (event: React.KeyboardEvent) => { if (['Enter', ' '].includes(event.key) && !event.repeat) { event.preventDefault(); onDown(midi) } },
    onKeyUp: () => onUp(midi),
  })
  return <div className="repertoire-vertical-scroll" ref={scroller}><svg className="repertoire-vertical" viewBox={`0 ${keyboardOnly ? 485 : 0} ${width} ${keyboardOnly ? 100 : 585}`} style={{ minWidth: width }} aria-label={t(keyboardOnly ? 'Экранная клавиатура' : 'Вертикальная партитура')}>
    {[...BASS_LINE_STEPS, ...TREBLE_LINE_STEPS].map(step => <line key={step} data-course-band={step} x1={whiteKeyCenterX(step, geometry)} x2={whiteKeyCenterX(step, geometry)} y1="0" y2="485" stroke={step < 0 ? '#cec4d8' : '#b8d4cb'} strokeWidth={geometry.keyWidth}/>)}
    {window.map((frame, i) => <g key={frame.position}><line x1="24" x2={width - 24} y1={(28 + i * 28) * scale} y2={(28 + i * 28) * scale} stroke={i === 0 ? '#176e60' : '#e2e8e5'} strokeDasharray={i === 0 ? '4 5' : '1 5'}/><text x="4" y={(28 + i * 28) * scale - 14} fontSize="11" fill="#657579">{frame.measure}</text></g>)}
    <g ref={glyphs} transform={`matrix(0 ${scale} ${-scale} 0 ${width} 0)`}/>
    <g className="piano-keys">{keys.map(step => { const p = stepToPitch(step); return <g key={step}><rect {...events(p.midi)} x={whiteKeyLeftX(step, geometry)} y="485" width={geometry.keyWidth} height="82" rx="2" className={`white-key ${held.includes(p.midi) ? 'pressed' : ''}`}/>{p.letter === 'C' && <text className="key-name" x={whiteKeyCenterX(step, geometry)} y="556">C{p.octave}</text>}</g> })}
      {keys.filter(step => ['C', 'D', 'F', 'G', 'A'].includes(stepToPitch(step).letter) && step < geometry.maxStep).map(step => { const midi = stepToPitch(step).midi + 1; return <rect key={step} {...events(midi)} x={whiteKeyLeftX(step, geometry) + 12} y="485" width="12" height="49" rx="2" className={`black-key ${held.includes(midi) ? 'pressed' : ''}`}/> })}
    </g>
  </svg></div>
}
