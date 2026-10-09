import { getLocale, subscribeLocale, t } from '../../../packages/i18n/src'
import { LanguageControl } from './LanguageControl'
import { StaffIntro } from './StaffIntro'
import { hasSeenIntro, rememberIntro } from './introState'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Download, FileMusic, FileUp, History, Keyboard, LayoutList, Pause, Piano, Play, RotateCcw, Settings, Usb } from 'lucide-react'
import { lessons, type Lesson, type Scaffold } from '../../../packages/curriculum/src'
import { recognitionPlan } from '../../../packages/curriculum/src/recognition'
import { generate } from '../../../packages/exercise-engine/src'
import { Session } from '../../../packages/exercise-engine/src/session'
import { midi } from '../../../packages/midi-io/src'
import { Score } from '../../../packages/notation-renderer/src/Score'
import { PresentationControl } from '../../../packages/notation-renderer/src/PresentationControl'
import { noteName } from '../../../packages/notation-renderer/src/geometry'
import { adapt, hasFullCoverage, median, summarize } from '../../../packages/scoring-engine/src'
import { importRecords, read, save, type Record as ProgressRecord } from '../../../packages/progress/src'
import './App.css'
import { LessonBlocks, PitchResults } from './RecognitionProgress'
import { noteCount } from './format'
import { practiceView } from './practiceView'
const Library = lazy(() => import('./Library'))
const Repertoire = lazy(() => import('./Repertoire'))

type Run = { id: string; created: number; seed: number; repeat: number; lesson: Lesson; scaffold: Scaffold; demo: boolean; session: Session }
const percent = (value: number | null) => value === null ? '—' : `${Math.round(value * 100)}%`
const ms = (value: number | null) => value === null ? '—' : `${Math.round(value)} ${t('мс')}`
const handName = { right: 'Правая рука', left: 'Левая рука', alternating: 'Руки по очереди' }

export default function App() {
  useSyncExternalStore(subscribeLocale, getLocale)
  const practice = useSyncExternalStore(practiceView.subscribe, practiceView.getSnapshot)
  const [view, setView] = useState<'lessons' | 'repertoire' | 'library' | 'progress' | 'device'>('lessons')
  const [lesson, setLesson] = useState(lessons[0])
  const [scaffold, setScaffold] = useState<Scaffold>(lessons[0].scaffold)
  const [tempo, setTempo] = useState(lessons[0].tempo)
  const [demo, setDemo] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [intro, setIntro] = useState<'start' | 'explore' | null>(null)
  const [introSeen, setIntroSeen] = useState(hasSeenIntro)
  const [history, setHistory] = useState<ProgressRecord[]>([])
  const [storageError, setStorageError] = useState('')
  const device = useSyncExternalStore(midi.subscribe, view === 'device' ? midi.getSnapshot : midi.getConnectionSnapshot)
  const importFile = useRef<HTMLInputElement>(null)
  function refreshHistory() { void read().then(setHistory).catch(() => setStorageError('Не удалось прочитать сохранённый прогресс.')) }
  useEffect(() => { refreshHistory() }, [])
  const choose = useCallback((next: Lesson) => { run?.session.pause(performance.now()); setRun(null); setIntro(null); setLesson(next); setScaffold(next.scaffold); setTempo(next.tempo); setView('lessons'); refreshHistory() }, [run])
  const preview = useMemo(() => new Session(generate(lesson, 1), false, tempo), [lesson, tempo])
  async function start(repeat?: Run, bypassIntro = false) {
    if (lesson.id === lessons[0].id && !repeat && !introSeen && !bypassIntro) { setIntro('start'); return }
    if (!await practiceView.begin()) return
    run?.session.pause(performance.now())
    const seed = repeat?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]
    const current = { ...lesson, tempo }
    setRun({ id: crypto.randomUUID(), created: Date.now(), seed, repeat: repeat ? repeat.repeat + 1 : 0,
      lesson: current, scaffold, demo, session: new Session(generate(current, seed), current.kind === 'ahead', tempo) })
  }
  function finishIntro() {
    rememberIntro(); setIntroSeen(true); setIntro(null)
    if (intro === 'start' && (demo || device.status === 'ready')) start(undefined, true)
  }
  function navigate(next: typeof view) { run?.session.pause(performance.now()); void practiceView.end(); setIntro(null); setView(next); refreshHistory() }
  const passed = (item: Lesson) => history.some(record => record.lessonId === item.id && record.completed && !record.demo && (item.kind !== 'flash' || hasFullCoverage(record.attempts, item.count)) && (summarize(record.attempts).accuracy ?? 0) >= item.accuracy)
  const done = lessons.filter(passed).length

  return <div className={`app-shell ${practice.focused ? 'practice-focus' : ''}`}>
    <LanguageControl/>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('lessons') }}><Piano size={30} /><span>Sight Reading<strong>Bridge</strong></span></a>
      <nav aria-label={t("Основная навигация")}>
        <button aria-label={t("Занятия")} className={view === 'lessons' ? 'selected' : ''} onClick={() => navigate('lessons')}><LayoutList size={19} /> {t("Занятия")}</button>
        <button aria-label={t('Курс Advanced')} className={view === 'repertoire' ? 'selected' : ''} onClick={() => navigate('repertoire')}><BookOpen size={19}/>{t('Курс Advanced')}</button>
        <button aria-label={t("Библиотека")} className={view === 'library' ? 'selected' : ''} onClick={() => navigate('library')}><FileMusic size={19} /> {t("Библиотека")}</button>
        <button aria-label={t("Прогресс")} className={view === 'progress' ? 'selected' : ''} onClick={() => navigate('progress')}><History size={19} /> {t("Прогресс")}</button>
        <button aria-label={t("Инструмент")} className={view === 'device' ? 'selected' : ''} onClick={() => navigate('device')}><Usb size={19} /> {t("Инструмент")}</button>
      </nav>
      <div className="course-progress"><span>{t("Взрослый маршрут")}</span><strong>{done} / {lessons.length}</strong><progress max={lessons.length} value={done} /></div>
      <div className="sidebar-bottom"><span className={`status-dot ${device.status === 'ready' ? 'connected' : ''}`} /> <span>{device.status === 'ready' ? device.message : t("USB-MIDI не подключён")}</span></div>
      <a className="download-link" href="https://github.com/nesfe/Sight-Reading-Bridge/releases/latest" target="_blank" rel="noreferrer"><Download size={16} /> {t("Приложение для компьютера")}</a>
    </aside>
    <main>
      {!intro && <header className="page-header"><div><span className="eyebrow">{t("ЧТЕНИЕ С ЛИСТА")}</span><h1>{{ lessons: t("Занятия"), repertoire: t('Курс Advanced'), library: t("Библиотека"), progress: t("Прогресс"), device: t("Инструмент") }[view]}</h1></div><span className="edition">{t("Взрослый маршрут · 01")}</span></header>}
      {storageError && <p role="alert" className="notice error">{t(storageError)}</p>}
      {view === 'library' && <Suspense fallback={<p role="status">{t("Открытие библиотеки…")}</p>}><Library/></Suspense>}
      {view === 'repertoire' && <Suspense fallback={<p role="status">{t('Подготовка партитуры…')}</p>}><Repertoire/></Suspense>}
      {view === 'lessons' && <>
        {intro ? <StaffIntro onFinish={finishIntro}/> : !run ? <div className="lesson-layout">
          <section className="lesson-list" aria-label={t("Учебный маршрут")}>{lessons.map((item, index) => <div key={item.id}>
            {(index === 0 || item.group !== lessons[index - 1].group) && <h2>{t(item.group)}</h2>}
            <button className={`lesson-row ${lesson.id === item.id ? 'active' : ''}`} onClick={() => choose(item)}><span className="lesson-number">{passed(item) ? <Check size={17} /> : String(index + 1).padStart(2, '0')}</span><span>{t(item.title)}<small>{t(handName[item.hands])} · {noteCount(item.count)}</small></span><ChevronRight size={17} /></button>
          </div>)}</section>
          <section className="lesson-detail">
            <div className="lesson-heading"><div><span className="eyebrow">{t("СТАДИЯ")} {lesson.stage}</span><h2>{t(lesson.title)}</h2></div><button className="primary start" disabled={!demo && device.status !== 'ready'} onClick={() => start()}><Play size={18}/> {t("Начать занятие")}</button></div>
            <div className="lesson-facts"><span>{t(handName[lesson.hands])}</span><span>{noteCount(lesson.count)}</span><span>{lesson.kind === 'ahead' ? t('{{notes}} вперёд', { notes: noteCount(lesson.horizon) }) : t("Без ограничения времени")}</span></div>
            {lesson.kind === 'flash' && <LessonBlocks lesson={lesson}/>}
            {lesson.id === lessons[0].id && <div className="intro-entry"><button onClick={() => setIntro('explore')}><BookOpen size={17}/>{t('Почему стан повёрнут?')}</button><span>{t('Короткое интерактивное знакомство перед первым уроком')}</span></div>}
            <div className="connection-strip"><Usb size={18}/><span>{device.status === 'ready' ? device.message : t(device.message)}</span>{device.status !== 'ready' && <button onClick={() => void midi.connect()} disabled={device.status === 'connecting'}>{t("Подключить")}</button>}</div>
            <div className="lesson-preview"><ScoreLegend scaffold={scaffold}/><Score session={preview} scaffold={scaffold} kind={lesson.kind === 'patterns' ? 'patterns' : 'flash'} horizon={0} cursor={0} held={[]} onDown={() => {}} onUp={() => {}} /></div>
            <PresentationControl scaffold={scaffold} onChange={setScaffold}/>
            <div className="setup-fields">
              {lesson.kind === 'ahead' && <label>{t("Темп, BPM")}<input type="number" min={30} max={120} value={tempo} onChange={e => setTempo(Math.max(30, Math.min(120, Number(e.target.value) || 30)))} /></label>}
            </div>
            <details className="supports"><summary><Settings size={16} /> {t("Подсказки")}</summary>{(['B', 'C', 'D', 'F'] as const).map(axis => <label key={axis}>{({ B: t("Подписи нот"), C: t("Цвет"), D: t("Толщина и номера линий"), F: t("Подсветка клавиши") })[axis]}<input type="range" min="0" max="1" step=".25" value={scaffold[axis]} disabled={lesson.kind === 'ahead' && axis === 'F'} onChange={e => setScaffold({ ...scaffold, [axis]: Number(e.target.value) })} /></label>)}</details>
            <label className="check-option"><input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} /> {t("Экранная клавиатура · пробный режим")}</label>
          </section>
        </div> : <RunPanel key={run.id} run={run} onBack={() => { run.session.pause(performance.now()); setRun(null); refreshHistory() }} onNew={() => start()} onRepeat={() => start(run)} onNext={() => choose(lessons[Math.min(lessons.length - 1, lessons.findIndex(l => l.id === lesson.id) + 1)])} onAdapt={setScaffold} onSaved={refreshHistory} />}
      </>}
      {view === 'device' && <section className="device-view"><h2>Kawai CA701</h2><p className="device-subtitle">{t("USB-MIDI · звук инструмента")}</p>
        <div className="device-status"><Usb size={28}/><span>{device.status === 'ready' ? device.message : t(device.message)}</span><button className="primary" onClick={() => void midi.connect()} disabled={device.status === 'connecting'}>{t("Подключить MIDI")}</button></div>
        {device.devices.length > 0 && <label className="device-select">{t("MIDI-вход")}<select value={device.selected} onChange={e => midi.select(e.target.value)}>{device.devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        <div className="stats"><Stat label={t("Последняя нота")} value={device.last === null ? '—' : String(device.last)} /><Stat label={t("Событие → обработчик, медиана")} value={ms(median(midi.dispatchSamples))}/><Stat label={t("Событие → кадр, медиана")} value={ms(median(midi.frameSamples))}/><Stat label={t("Измерений")} value={String(midi.frameSamples.length)} /></div>
        <p className="muted">{t("Диагностика приложения. Время от физического нажатия до USB-события сюда не входит.")}</p>
      </section>}
      {view === 'progress' && <section><div className="section-heading"><h2>{t("История занятий")}</h2><div className="actions"><button title={t("Экспорт прогресса")} aria-label={t("Экспорт прогресса")} className="icon-button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'sight-reading-bridge-progress.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}><Download size={18}/></button><button title={t("Импорт прогресса")} aria-label={t("Импорт прогресса")} className="icon-button" onClick={() => importFile.current?.click()}><FileUp size={18}/></button><input hidden ref={importFile} type="file" accept="application/json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 10_000_000) throw new Error('size'); await importRecords(await file.text()); setStorageError(''); refreshHistory() } catch { setStorageError('Файл прогресса не распознан или превышает 10 МБ.') } e.target.value = '' }} /></div></div>
        {!history.length ? <div className="empty-state"><History size={32}/><h3>{t("Завершённых занятий пока нет")}</h3><button onClick={() => navigate('lessons')}>{t("К занятиям")} <ArrowRight size={16}/></button></div> : <div className="history-table"><table><thead><tr><th>{t("Занятие")}</th><th>{t("Дата")}</th><th>{t("Попытка")}</th><th>{t("Точность")}</th><th>{t("Реакция")}</th><th>{t("Статус")}</th></tr></thead><tbody>{history.map(record => { const score = summarize(record.attempts); return <tr key={record.id}><td>{t(lessons.find(l => l.id === record.lessonId)?.title ?? record.lessonId)}</td><td>{new Date(record.created).toLocaleDateString(getLocale())}</td><td>{record.demo ? t("Пробная") : record.repeat ? t('Повтор {{number}}', { number: record.repeat }) : t("Новый текст")}</td><td>{percent(score.accuracy)}</td><td>{ms(score.reactionMs)}</td><td>{record.completed ? t("Завершено") : t("Прервано")}</td></tr> })}</tbody></table></div>}
      </section>}
    </main>
  </div>
}

function RunPanel({ run, onBack, onNew, onRepeat, onNext, onAdapt, onSaved }: { run: Run; onBack: () => void; onNew: () => void; onRepeat: () => void; onNext: () => void; onAdapt: (scaffold: Scaffold) => void; onSaved: () => void }) {
  const { session, lesson } = run
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [storageError, setStorageError] = useState('')
  const score = useMemo(() => summarize(state.attempts), [state.attempts])
  const nextSupport = useMemo(() => adapt(run.scaffold, state.attempts, lesson.accuracy), [run.scaffold, state.attempts, lesson.accuracy])
  useEffect(() => practiceView.registerPause(() => session.pause(performance.now())), [session])
  useEffect(() => { if (state.status === 'completed') void practiceView.end() }, [state.status])
  useEffect(() => {
    const start = requestAnimationFrame(now => session.start(now))
    let frame = 0
    const tick = (now: number) => { session.tick(now); frame = requestAnimationFrame(tick) }
    if (session.timed) frame = requestAnimationFrame(tick)
    const off = midi.onNote(event => { if (run.demo) return; if (event.type === 'on') session.noteOn(event.midi, event.at); else session.noteOff(event.midi, event.at) })
    const disconnect = midi.onDisconnect(() => session.pause(performance.now()))
    const pause = () => { if (document.hidden) session.pause(performance.now()) }
    const blur = () => session.pause(performance.now())
    document.addEventListener('visibilitychange', pause); window.addEventListener('blur', blur)
    return () => { cancelAnimationFrame(start); cancelAnimationFrame(frame); off(); disconnect(); document.removeEventListener('visibilitychange', pause); window.removeEventListener('blur', blur) }
  }, [run, session])
  useEffect(() => { const frame = requestAnimationFrame(now => session.markShown(now)); return () => cancelAnimationFrame(frame) }, [session, state.cursor, state.status])
  useEffect(() => {
    if (state.status === 'ready') return
    const record: ProgressRecord = { id: run.id, lessonId: lesson.id, seed: run.seed, created: run.created, completed: state.status === 'completed', demo: run.demo, repeat: run.repeat, tempo: lesson.tempo, horizon: lesson.horizon, elapsed: state.elapsed, scaffold: run.scaffold, attempts: state.attempts }
    void save(record).then(() => { if (record.completed) onSaved() }).catch(() => setStorageError('Прогресс не сохранён. Проверьте доступ к хранилищу браузера.'))
    // Persist scored changes, not held-key visual feedback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempts, state.status, run])
  useEffect(() => { if (state.status === 'completed' && !run.demo) onAdapt(adapt(run.scaffold, state.attempts, lesson.accuracy).scaffold) }, [state.status, state.attempts, run, lesson.accuracy, onAdapt])
  const last = state.attempts.at(-1)
  const current = session.notes[state.cursor]
  const paused = state.status === 'paused'
  const betweenBlocks = state.status === 'break'
  const blocks = lesson.kind === 'flash' ? recognitionPlan(lesson.min, lesson.max, lesson.hands === 'alternating') : []
  const blockIndex = blocks.findIndex(block => block.id === current?.block)
  const block = blocks[blockIndex]
  const previousBlock = blocks[blockIndex - 1]
  const blockScore = previousBlock ? summarize(state.attempts.filter(attempt => attempt.index >= previousBlock.start && attempt.index < previousBlock.start + previousBlock.count)) : null
  return <section className="run-view">
    <div className="run-toolbar"><button className="icon-button" title={t("К занятиям")} aria-label={t("К занятиям")} onClick={onBack}><ArrowLeft size={20}/></button><div><h2>{t(lesson.title)}</h2><span className="muted">{t(handName[lesson.hands])} · {run.demo ? t("Пробный режим") : run.repeat ? t("Повтор текста") : t("Новый текст")}</span></div><span className="run-position">{Math.min(state.cursor, lesson.count)} / {lesson.count}</span>{state.status !== 'completed' && !betweenBlocks && <button className="icon-button" title={paused ? t("Продолжить") : t("Пауза")} aria-label={paused ? t("Продолжить") : t("Пауза")} onClick={() => paused ? session.resume(performance.now()) : session.pause(performance.now())}>{paused ? <Play size={19}/> : <Pause size={19}/>}</button>}</div>
    <progress className="run-progress" max={lesson.count} value={state.cursor}/>
    {blocks.length > 0 && <LessonBlocks lesson={lesson} cursor={state.cursor}/>}
    {storageError && <p role="alert" className="notice error">{t(storageError)}</p>}
    {state.status === 'completed' ? <div className="result-view"><Check size={36}/><h2>{t("Занятие завершено")}</h2><div className="stats"><Stat label={t("Точность")} value={percent(score.accuracy)}/><Stat label={t("Реакция, медиана")} value={ms(score.reactionMs)}/><Stat label={t("Ошибки / пропуски")} value={`${score.errors} / ${score.missed}`}/>{session.timed && <><Stat label={t("Отклонение атаки")} value={ms(score.timingMs)}/><Stat label={t("Отклонение отпускания")} value={ms(score.releaseMs)}/></>}</div><p>{run.demo ? t("Пробная попытка. В освоение курса не засчитывается.") : t(nextSupport.message)}</p><div className="actions"><button className="primary" onClick={onNew}><Play size={17}/> {t("Новый текст")}</button><button onClick={onRepeat}><RotateCcw size={17}/> {t("Повторить")}</button><button onClick={onNext}>{t("Следующее занятие")} <ArrowRight size={17}/></button></div>{lesson.kind === 'flash' && <PitchResults attempts={state.attempts}/>}</div> : <>
      <div className="task-row"><span>{block ? `${t(block.title)} · ${state.cursor - block.start + 1} / ${block.count}` : lesson.kind === 'patterns' ? t('Фраза {{number}}', { number: (current?.chunk ?? 0) + 1 }) : lesson.kind === 'ahead' ? t('Горизонт: {{notes}}', { notes: noteCount(lesson.horizon) }) : t("Сыграйте ноту")}</span><span role="status" className={last?.correct ? 'correct-text' : last ? 'wrong-text' : 'muted'}>{betweenBlocks ? t("Перерыв между блоками") : paused ? t("Пауза") : last ? last.missed ? t("Пропуск") : last.correct ? t("Верно") : t("Другая нота") : t("Ожидание нажатия")}</span></div>
      <div className="run-score"><ScoreLegend scaffold={run.scaffold}/><Score session={session} scaffold={run.scaffold} kind={lesson.kind} horizon={lesson.horizon} cursor={state.cursor} held={state.held} onDown={note => { if (run.demo) session.noteOn(note, performance.now()) }} onUp={note => { if (run.demo) session.noteOff(note, performance.now()) }}/>{paused && <div className="pause-overlay"><Pause size={28}/><h3>{t("Пауза")}</h3><button className="primary" onClick={() => session.resume(performance.now())}><Play size={17}/> {t("Продолжить")}</button></div>}{betweenBlocks && <div className="pause-overlay block-break"><Check size={28}/><h3>{t('Блок {{number}} завершён', { number: blockIndex })}</h3><span>{t(previousBlock?.title ?? '')}</span><p>{t("Точность")} {percent(blockScore?.accuracy ?? null)} · {t('Реакция')} {ms(blockScore?.reactionMs ?? null)}</p><button className="primary" onClick={() => session.resume(performance.now())}>{t("Следующий блок")} <ArrowRight size={17}/></button><span className="muted">{t(block?.title ?? '')}</span></div>}</div>
      <div className="session-footer"><span><Keyboard size={17}/> {run.demo ? t("Экранная клавиатура") : 'USB-MIDI'}</span><span>{t("Точность")} {percent(score.accuracy)}</span><span>{t("Реакция")} {ms(score.reactionMs)}</span>{!session.timed && run.scaffold.B > 0 && current && <span>{noteName(current.step)}</span>}</div>
    </>}
  </section>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }

function ScoreLegend({ scaffold }: { scaffold: Scaffold }) {
  return <div className="score-legend"><span>G2 – F5</span>{scaffold.C > 0 && <div style={{ opacity: scaffold.C }}><span><i className="line-swatch"/>{t("На линии")}</span><span><i className="space-swatch"/>{t("В промежутке")}</span></div>}</div>
}
