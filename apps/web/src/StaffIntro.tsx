import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, ArrowRight, Check, MoveRight, MoveUp, RotateCw, Usb } from 'lucide-react'
import { t } from '../../../packages/i18n/src'
import { midi } from '../../../packages/midi-io/src'
import { BASS_LINE_STEPS, TREBLE_LINE_STEPS, midiToPitch, staffStep, whiteKeyCenterX } from '../../../packages/music-core/src/staffGeometry'
import { PianoKeyboard, VerticalClefs } from '../../../packages/notation-renderer/src/Score'
import { keyboard, noteName, staffLineColor } from '../../../packages/notation-renderer/src/geometry'

const targets = [60, 62, 64]
const ratio = 2 / 3
const center = whiteKeyCenterX(0, keyboard) * ratio
const views = ['vertical', 'horizontal', 'standard'] as const
const viewNames = ['Вертикальные полосы', 'Горизонтальные полосы', 'Обычный нотный стан']

export function StaffIntro({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [view, setView] = useState<typeof views[number]>('horizontal')
  const [selected, setSelected] = useState(0)
  const [held, setHeld] = useState<number[]>([])
  const [found, setFound] = useState<number[]>([])
  const device = useSyncExternalStore(midi.subscribe, midi.getSnapshot)
  const heading = useRef<HTMLHeadingElement>(null)
  const interaction = useRef<{ press: (note: number) => void; release: (note: number) => void }>({ press: () => {}, release: () => {} })
  const vertical = view === 'vertical'
  const bands = step > 0 && view !== 'standard'
  function press(note: number) {
    setHeld(keys => keys.includes(note) ? keys : [...keys, note])
    const pitch = midiToPitch(note)
    if (!pitch) return
    const position = staffStep(pitch.letter, pitch.octave)
    if (position < keyboard.minStep || position > keyboard.maxStep) return
    setSelected(position)
    if (step === 1 && targets.includes(note)) setFound(notes => notes.includes(note) ? notes : [...notes, note])
  }
  function release(note: number) { setHeld(keys => keys.filter(key => key !== note)) }
  useEffect(() => { interaction.current = { press, release } })
  useEffect(() => {
    const off = midi.onNote(event => interaction.current[event.type === 'on' ? 'press' : 'release'](event.midi))
    const clear = () => setHeld([])
    const disconnect = midi.onDisconnect(clear)
    window.addEventListener('blur', clear)
    return () => { off(); disconnect(); window.removeEventListener('blur', clear) }
  }, [])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [step])
  function next() {
    setHeld([])
    setStep(step + 1)
    setView(step === 0 ? 'vertical' : 'horizontal')
  }
  const titles = ['Один звук, два направления', 'Поворот связывает ноту с клавишей', 'Опора, которую мы постепенно уберём']
  const descriptions = [
    'На обычном стане высокий звук расположен выше низкого. На фортепиано высокий звук находится правее. Это одни и те же звуки, но два разных направления.',
    'Мы повернули большой нотный стан на 90° по часовой стрелке. Теперь положение ноты совпадает с положением белой клавиши. Закрашенная полоса — линия стана, белый промежуток — место между линиями; на этом этапе они одинаковой ширины.',
    'Цель — читать обычные ноты. Сначала сохраняем цветные полосы и возвращаем стан в горизонтальное положение, затем убираем цвет и утолщение. Высота каждой ноты остаётся прежней.',
  ]
  return <section className="staff-intro" aria-label={t('Знакомство с нотным станом')}>
    <div className="intro-heading"><span className="eyebrow">{t('ПЕРЕД ПЕРВЫМ ЗАНЯТИЕМ')} · {step + 1} / 3</span><button className="intro-skip" onClick={onFinish}>{t('Пропустить вступление')}</button></div>
    <h2 ref={heading} tabIndex={-1}>{t(titles[step])}</h2>
    <p className="intro-description">{t(descriptions[step])}</p>
    <div className="intro-layout">
      <div className="intro-visual">
        <div className="intro-direction">{vertical ? <MoveRight size={18}/> : <MoveUp size={18}/>}<span>{t(vertical ? 'Выше звук — правее нота и клавиша' : 'Выше звук — выше нота')}</span></div>
        <svg className="intro-diagram" viewBox="0 0 560 520" aria-label={t('Связь нотного стана с клавиатурой')}>
          <g data-intro-staff className="intro-staff" style={{ transform: `translate(${center}px, 210px) rotate(${vertical ? 0 : -90}deg) scale(${vertical ? 1 : 0.72}) translate(${-center}px, -210px)` }}>
            {[...BASS_LINE_STEPS, ...TREBLE_LINE_STEPS].map(position => <line key={position} data-intro-line={position} x1={whiteKeyCenterX(position, keyboard) * ratio} x2={whiteKeyCenterX(position, keyboard) * ratio} y1="20" y2="440" style={{ stroke: staffLineColor(position < 0, bands ? 1 : 0, bands ? 1 : 0), strokeWidth: bands ? keyboard.keyWidth * ratio : 1.5 }}/>) }
            <g transform={`scale(${ratio})`}><VerticalClefs size={32 * keyboard.keyWidth / 5}/></g>
            <ellipse data-intro-note={selected} cx={whiteKeyCenterX(selected, keyboard) * ratio} cy="210" rx="11" ry="15" fill={bands ? selected % 2 === 0 ? '#c95843' : '#207e90' : '#253637'}/>
            {selected === 0 && <line className="ledger-line" x1={center} x2={center} y1="188" y2="232"/>}
          </g>
          <g transform={`translate(0, ${440 - 370 * ratio}) scale(${ratio})`}><PianoKeyboard held={held} hint={vertical ? selected : undefined} onDown={press} onUp={release}/></g>
        </svg>
        <output className="intro-pitch" aria-live="polite">{noteName(selected)}</output>
      </div>
      <div className="intro-interaction">
        {step === 0 && <><h3>{t('Ориентир — до первой октавы')}</h3><p>{t('До первой октавы (C4) находится между басовым и скрипичным станами. Короткая добавочная черта проходит через середину ноты.')}</p><p>{t('Нажмите белую экранную клавишу: нота покажет соответствующую высоту. Звук остаётся у вашего пианино.')}</p></>}
        {step === 1 && <><h3>{t('Попробуйте До, Ре и Ми')}</h3><p>{t('Нажмите C4, D4 и E4 на экранной клавиатуре или USB-пианино. Следите, как нота встаёт точно над соответствующей белой клавишей.')}</p><ul className="intro-targets" aria-label={t('Ноты для знакомства')}>{targets.map((note, index) => <li key={note} className={found.includes(note) ? 'complete' : ''}>{found.includes(note) ? <Check size={17}/> : <span className="intro-target-dot"/>}<span>{noteName(index)}</span><span className="sr-only">{found.includes(note) ? t('Верно') : t('Ожидание нажатия')}</span></li>)}</ul><p className="muted">{t('Это знакомство, а не проверка. Ошибки и время здесь не оцениваются.')}</p></>}
        {step === 2 && <><h3>{t('Одна нота в трёх представлениях')}</h3><div className="intro-views" role="radiogroup" aria-label={t('Представление нотного стана')}>{views.map((option, index) => <button key={option} role="radio" aria-checked={view === option} onClick={() => setView(option)}>{index + 1}. {t(viewNames[index])}</button>)}</div><p>{t('Сравните положения одной ноты. В первом уроке нет падающих нот и ограничения времени: найдите клавишу, нажмите и отпустите её.')}</p></>}
        <div className="intro-device"><span>{device.status === 'ready' ? device.message : t(device.message)}</span>{device.status !== 'ready' && <button disabled={device.status === 'connecting'} onClick={() => void midi.connect()}><Usb size={16}/>{t('Подключить MIDI')}</button>}</div>
      </div>
    </div>
    <div className="intro-footer"><button disabled={step === 0} onClick={() => { setStep(step - 1); setView(step === 1 ? 'horizontal' : 'vertical'); setHeld([]) }}><ArrowLeft size={17}/>{t('Назад')}</button><button className="primary" onClick={step < 2 ? next : onFinish}>{step === 0 ? <RotateCw size={17}/> : <ArrowRight size={17}/>} {t(step === 0 ? 'Повернуть стан' : step === 1 ? 'К обычной записи' : 'К первому занятию')}</button></div>
    <p className="intro-credit">{t('Этот подход вдохновлён Soft Mozart и методом Хайнер: показать связь ноты с клавишей и постепенно убрать визуальные опоры. Sight Reading Bridge — независимый проект в активной разработке.')}</p>
  </section>
}
