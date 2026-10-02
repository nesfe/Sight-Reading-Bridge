import { t } from "../../../packages/i18n/src"
import { Check } from 'lucide-react'
import type { Lesson } from '../../../packages/curriculum/src'
import { recognitionPlan } from '../../../packages/curriculum/src/recognition'
import { midiToPitch, staffStep } from '../../../packages/music-core/src/staffGeometry'
import { noteName } from '../../../packages/notation-renderer/src/geometry'
import { summarizePitches, type Attempt } from '../../../packages/scoring-engine/src'
import { noteCount } from './format'

export function LessonBlocks({ lesson, cursor }: { lesson: Lesson; cursor?: number }) {
  const blocks = recognitionPlan(lesson.min, lesson.max, lesson.hands === 'alternating')
  return <ol className="lesson-blocks" aria-label={t("Блоки занятия")}>{blocks.map((block, index) => {
    const complete = cursor !== undefined && cursor >= block.start + block.count
    const active = cursor !== undefined && cursor >= block.start && !complete
    const done = Math.max(0, Math.min(block.count, (cursor ?? 0) - block.start))
    return <li key={block.id} className={complete ? 'complete' : active ? 'active' : ''} aria-current={active ? 'step' : undefined}>
      <span className="block-number">{complete ? <Check size={15}/> : index + 1}</span>
      <span className="block-title">{t(block.title)}<small>{cursor === undefined ? noteCount(block.count) : `${done} / ${block.count}`}</small></span>
      {cursor !== undefined && <progress aria-label={t(block.title)} max={block.count} value={done}/>}
    </li>
  })}</ol>
}

function pitchName(midi: number) {
  const pitch = midiToPitch(midi)
  return pitch ? noteName(staffStep(pitch.letter, pitch.octave)) : String(midi)
}

export function PitchResults({ attempts }: { attempts: Attempt[] }) {
  const pitches = summarizePitches(attempts)
  const difficult = pitches.filter(pitch => pitch.accuracy < 0.9 || (pitch.reactionMs ?? 0) > 1500)
  return <section className="pitch-results" aria-label={t("Результаты по нотам")}>
    <h3>{t("Каждая нота")}</h3>
    <div className="history-table"><table><thead><tr><th>{t("Нота")}</th><th>{t("Предъявлений")}</th><th>{t("С первого раза")}</th><th>{t("Ошибок")}</th><th>{t("Реакция")}</th></tr></thead>
      <tbody>{pitches.map(pitch => <tr key={pitch.midi}><td>{pitchName(pitch.midi)}</td><td>{pitch.seen}</td><td>{pitch.firstTry} / {pitch.seen}</td><td className={pitch.errors ? 'wrong-text' : undefined}>{pitch.errors}</td><td>{pitch.reactionMs === null ? '—' : `${Math.round(pitch.reactionMs)} ${t('мс')}`}</td></tr>)}</tbody></table></div>
    {difficult.length > 0 && <p className="review-pitches">{t("Для повторения:")} {difficult.map(pitch => pitchName(pitch.midi)).join(', ')}</p>}
  </section>
}
