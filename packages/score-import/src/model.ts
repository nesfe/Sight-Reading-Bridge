import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import type { PitchGroup, ScoreFollower } from './follow'

export class ScoreDisplayController {
  readonly display: OpenSheetMusicDisplay
  private position = 0
  constructor(display: OpenSheetMusicDisplay) { this.display = display }
  prepare(part: number, staff: number) { this.position = 0; return followGroups(this.display, part, staff) }
  render(zoom: number, bands: boolean) {
    this.display.Zoom = zoom
    this.display.EngravingRules.StaffLineWidth = bands ? 0.5 : 0.1
    this.display.EngravingRules.StaffLineColor = bands ? '#c3d5d0' : '#293a3e'
    this.display.render()
    this.position = 0
    this.display.cursor.reset()
  }
  move(follower: ScoreFollower) {
    const state = follower.getSnapshot()
    const cursor = this.display.cursor
    const target = follower.groups[state.index]?.position
    if (target === undefined || state.status === 'completed') { cursor.hide(); return }
    const changed = target !== this.position
    if (target < this.position) { cursor.reset(); this.position = 0 }
    while (this.position < target && !cursor.Iterator.EndReached) { cursor.next(); this.position++ }
    cursor.show()
    if (changed) {
      const scroller = cursor.cursorElement.closest('.imported-score-scroll')
      if (scroller) {
        const visible = scroller.getBoundingClientRect(), current = cursor.cursorElement.getBoundingClientRect()
        if (current.top < visible.top || current.bottom > visible.bottom) scroller.scrollTop += current.top - visible.top - 24
        if (current.left < visible.left || current.right > visible.right) scroller.scrollLeft += current.left - visible.left - 24
      }
    }
  }
}

export function followGroups(display: OpenSheetMusicDisplay, instrumentIndex: number, staffId: number): { groups: PitchGroup[]; warning: string } {
  display.cursor.reset()
  const iterator = display.cursor.Iterator.clone()
  const instrument = display.Sheet.Instruments[instrumentIndex]
  const groups: PitchGroup[] = []
  let position = 0
  let ornament = false
  while (!iterator.EndReached) {
    if (position > 60000) throw new Error('Слишком много позиций в партитуре.')
    const notes = (iterator.CurrentVoiceEntries ?? []).flatMap(voice => voice.Notes)
      .filter(note => note.ParentStaff.ParentInstrument === instrument && (staffId === -1 || note.ParentStaff.Id === staffId) && !note.isRest() && note.PrintObject && !note.IsCueNote)
    const pitches: number[] = []
    for (const note of notes) {
      if (note.IsGraceNote || note.TremoloStrokes || note.Arpeggio) ornament = true
      if (note.IsGraceNote || (note.NoteTie && note.NoteTie.StartNote !== note)) continue
      const pitch = note.Pitch?.getHalfTone() + 12
      if (!Number.isInteger(pitch) || pitch < 21 || pitch > 108 || note.ParentStaff.isTab || note.ParentStaff.StafflineCount !== 5) {
        return { groups: [], warning: 'Для этой партии доступен просмотр. MIDI-проверка требует обычной пятилинейной записи и высот в диапазоне A0–C8 без микротонов.' }
      }
      pitches.push(pitch)
    }
    if (pitches.length) groups.push({ pitches: [...new Set(pitches)].sort((a, b) => a - b), position, measure: iterator.CurrentMeasure.MeasureNumber })
    iterator.moveToNext(); position++
  }
  return { groups, warning: ornament ? 'Форшлаги пропускаются; арпеджио и тремоло проверяются как основные записанные ноты.' : '' }
}
