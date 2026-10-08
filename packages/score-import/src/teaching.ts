import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { staffStep, type Letter } from '../../music-core/src/staffGeometry'

export type TeachingNote = { key: string; step: number; midi: number | null; accidental: string; duration: string; dots: number; staff: number; voice: number; tied: boolean }
export type TeachingFrame = { position: number; measure: number; notes: TeachingNote[] }
const letters: Record<number, Letter> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' }
const accidentals: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' }

/** Reuse OSMD's parsed pitch, voice, duration and tie model; do not reparse MusicXML. */
export function teachingFrames(display: OpenSheetMusicDisplay, instrumentIndex: number): TeachingFrame[] {
  display.cursor.reset()
  const iterator = display.cursor.Iterator.clone()
  const instrument = display.Sheet.Instruments[instrumentIndex]
  const voices = new Map<object, number>()
  const frames: TeachingFrame[] = []
  let position = 0
  while (!iterator.EndReached) {
    if (position > 60000) throw new Error('Слишком много позиций в партитуре.')
    const notes: TeachingNote[] = []
    for (const entry of iterator.CurrentVoiceEntries ?? []) {
      if (!voices.has(entry.ParentVoice)) voices.set(entry.ParentVoice, voices.size)
      for (const note of entry.Notes) {
        if (note.ParentStaff.ParentInstrument !== instrument || !note.PrintObject || note.IsCueNote || note.IsGraceNote) continue
        const rest = note.isRest()
        const pitch = note.Pitch
        const midi = rest ? null : pitch.getHalfTone() + 12
        const alter = rest ? 0 : pitch.AccidentalHalfTones
        const letter = rest ? 'B' : letters[pitch.FundamentalNote]
        const octave = rest ? 4 : Math.floor((midi! - alter) / 12) - 1
        const duration = rest && note.IsWholeMeasureRest ? 'w' : ({ 4: '128', 5: '64', 6: '32', 7: '16', 8: '8', 9: 'q', 10: 'h', 11: 'w', 12: '1/2' } as Record<number, string>)[note.NoteTypeXml] ?? 'q'
        notes.push({ key: `${letter.toLowerCase()}/${octave}`, step: staffStep(letter, octave), midi, accidental: rest ? '' : alter === 0 ? pitch.Accidental === 3 ? 'n' : '' : accidentals[alter] ?? '', duration, dots: note.DotsXml || 0, staff: note.ParentStaff.Id, voice: voices.get(entry.ParentVoice)!, tied: Boolean(note.NoteTie && note.NoteTie.StartNote !== note) })
      }
    }
    if (notes.length) frames.push({ position, measure: iterator.CurrentMeasure.MeasureNumber, notes })
    iterator.moveToNext(); position++
  }
  return frames
}
