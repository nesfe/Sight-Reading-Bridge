import { getLocale, t } from '../../../packages/i18n/src'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, Download, FileMusic, FileUp, Minus, Music2, Pause, Play, Plus, RotateCcw, Rows3, Trash2, Usb } from 'lucide-react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { readScoreFile, validateScore } from '../../../packages/score-import/src/files'
import { deleteScore, listScores, saveScore, type LibraryScore } from '../../../packages/score-import/src/library'
import { ScoreFollower } from '../../../packages/score-import/src/follow'
import { ScoreDisplayController } from '../../../packages/score-import/src/model'
import { midi } from '../../../packages/midi-io/src'
import { teachingFrames, type TeachingFrame } from '../../../packages/score-import/src/teaching'
import { RepertoireVertical } from '../../../packages/notation-renderer/src/RepertoireVertical'
import type { CourseRecord } from '../../../packages/repertoire/progress'
import { practiceView } from './practiceView'

const message = (error: unknown) => error instanceof Error ? error.message : 'Не удалось открыть партитуру.'

export default function Library() {
  const [scores, setScores] = useState<LibraryScore[]>([])
  const [selected, setSelected] = useState<LibraryScore | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { void listScores().then(setScores).catch(() => setError('Хранилище библиотеки недоступно.')) }, [])
  async function importFile(file: File) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const content = await readScoreFile(file)
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content.xml))
      const id = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      const score = { ...content, id, filename: file.name, created: Date.now() }
      await saveScore(score)
      setScores(await listScores()); setSelected(score)
    } catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  async function remove(score: LibraryScore) {
    if (!window.confirm(t('Удалить «{{title}}» из библиотеки?', { title: score.title }))) return
    try { await deleteScore(score.id); setScores(await listScores()) } catch { setError('Не удалось удалить партитуру.') }
  }
  return <section className="library-view" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void importFile(file) }}>
    <div className="section-heading"><div className="library-heading">{selected && <button className="icon-button" title={t("К библиотеке")} aria-label={t("К библиотеке")} onClick={() => setSelected(null)}><ArrowLeft size={19}/></button>}<h2>{selected ? selected.title : t("Мои партитуры")}</h2></div><button className="primary" disabled={busy} onClick={() => input.current?.click()}><FileUp size={18}/>{busy ? t("Импорт…") : t("Импорт нот")}</button></div>
    <input ref={input} type="file" aria-label={t("Файл партитуры")} hidden accept=".musicxml,.xml,.mxl" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file) }}/>
    {error && <p role="alert" className="notice error">{t(error)}</p>}
    {selected ? <ScoreDocument key={selected.id} score={selected}/> : <>
      <div className="library-formats"><span>MusicXML · .musicxml · .xml · .mxl</span><span>{t("Локальная библиотека · до 10 МБ на файл")}</span></div>
      {scores.length ? <div className="score-list">{scores.map(score => <div className="score-list-row" key={score.id}><FileMusic size={23}/><button className="score-open" onClick={() => setSelected(score)}><strong>{score.title}</strong><span>{score.filename}</span></button><time>{new Date(score.created).toLocaleDateString(getLocale())}</time><button className="icon-button" aria-label={t('Удалить {{title}}', { title: score.title })} title={t("Удалить партитуру")} onClick={() => void remove(score)}><Trash2 size={17}/></button></div>)}</div> : <div className="empty-state"><FileMusic size={36}/><h3>{t("Библиотека пуста")}</h3><button onClick={() => input.current?.click()}><FileUp size={17}/> {t("Импорт нот")}</button></div>}
    </>}
  </section>
}

export function ScoreDocument({ score, course }: { score: LibraryScore; course?: { solo: boolean; onComplete: (result: Omit<CourseRecord, 'id' | 'piece' | 'created'>) => void } }) {
  const container = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState<ScoreDisplayController | null>(null)
  const [error, setError] = useState('')
  const [bands, setBands] = useState(false)
  const [vertical, setVertical] = useState(Boolean(course))
  const [frames, setFrames] = useState<TeachingFrame[]>([])
  const [demo, setDemo] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [part, setPart] = useState(0)
  const [staff, setStaff] = useState(-1)
  const [practice, setPractice] = useState<{ follower: ScoreFollower; warning: string } | null>(null)
  const practiceRef = useRef(practice)
  useEffect(() => { practiceRef.current = practice }, [practice])
  useEffect(() => {
    const host = container.current!
    const div = document.createElement('div')
    host.append(div)
    const display = new OpenSheetMusicDisplay(div, { backend: 'svg', autoResize: false, drawTitle: false, drawSubtitle: false, drawComposer: true, followCursor: false, cursorsOptions: [{ type: 0, color: '#168469', alpha: 0.22, follow: false }] })
    display.setLogLevel('error')
    display.EngravingRules.CursorIgnoreRepetitions = true
    display.EngravingRules.LedgerLineWidth = 0.16
    let cancelled = false
    void display.load(validateScore(score.xml)).then(() => {
      if (cancelled) return
      display.render()
      if (!display.Sheet.SourceMeasures.length || !div.querySelector('svg')) throw new Error('В файле нет отображаемой партитуры.')
      const controller = new ScoreDisplayController(display)
      if (course) setFrames(teachingFrames(display, 0))
      const initialStaff = course?.solo ? display.Sheet.Instruments[0].Staves[0].Id : -1
      setStaff(initialStaff)
      const result = controller.prepare(0, initialStaff)
      setPractice({ follower: new ScoreFollower(result.groups), warning: result.warning })
      setLoaded(controller)
    }).catch(error => { if (!cancelled) setError(message(error)) })
    return () => { cancelled = true; display.clear(); div.remove() }
  }, [score.xml]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loaded || !container.current) return
    const host = container.current
    if (vertical) { loaded.hide(); return }
    const render = () => {
      try {
        loaded.render(zoom, bands)
        const follower = practiceRef.current?.follower
        if (follower) loaded.move(follower)
      } catch (error) { setError(message(error)) }
    }
    render()
    let timer: ReturnType<typeof setTimeout>
    let width = host.clientWidth
    const observer = new ResizeObserver(() => {
      if (host.clientWidth === width) return
      width = host.clientWidth
      clearTimeout(timer); timer = setTimeout(render, 120)
    })
    observer.observe(host)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [loaded, bands, zoom, vertical])
  const instruments = loaded?.display.Sheet.Instruments ?? []
  const staves = instruments[part]?.Staves ?? []
  function changePart(value: number, nextStaff = -1) {
    practice?.follower.pause(); setPart(value); setStaff(nextStaff)
    if (!loaded) return
    try { const result = loaded.prepare(value, nextStaff); setPractice({ follower: new ScoreFollower(result.groups), warning: result.warning }) }
    catch (error) { setError(message(error)) }
  }
  return <>
    <div className="score-document-toolbar">
      <div className="notation-tabs" role="radiogroup" aria-label={t("Вид импортированной партитуры")}>
        {course && <button role="radio" aria-checked={vertical} onClick={() => setVertical(true)}><Rows3 size={17} style={{ transform: 'rotate(90deg)' }}/>{t('Вертикальные полосы')}</button>}
        <button role="radio" aria-checked={bands && !vertical} onClick={() => { setVertical(false); setBands(true) }}><Rows3 size={17}/> {t("Полосы")}</button><button role="radio" aria-checked={!bands && !vertical} onClick={() => { setVertical(false); setBands(false) }}><Music2 size={17}/> {t("Нотный стан")}</button></div>
      {!vertical && <div className="zoom-control"><button className="icon-button" aria-label={t("Уменьшить партитуру")} title={t("Уменьшить")} disabled={zoom <= 0.6} onClick={() => setZoom(value => Math.max(0.6, value - 0.1))}><Minus size={17}/></button><output>{Math.round(zoom * 100)}%</output><button className="icon-button" aria-label={t("Увеличить партитуру")} title={t("Увеличить")} disabled={zoom >= 1.6} onClick={() => setZoom(value => Math.min(1.6, value + 0.1))}><Plus size={17}/></button></div>}
      <button className="icon-button" title={t("Скачать MusicXML")} aria-label={t("Скачать MusicXML")} onClick={() => { const url = URL.createObjectURL(new Blob([score.xml], { type: 'application/vnd.recordare.musicxml+xml' })); const a = document.createElement('a'); a.href = url; a.download = score.filename.replace(/\.(xml|musicxml|mxl)$/i, '.musicxml'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}><Download size={17}/></button>
    </div>
    {error && <p role="alert" className="notice error">{t(error)}</p>}
    {!loaded && !error && <p role="status" className="notice">{t("Подготовка партитуры…")}</p>}
    {loaded && (course ? <div className="score-part-controls"><div className="notation-tabs" role="radiogroup" aria-label={t('Руки')}>
      {[{ value: staves[0]?.Id, label: 'Правая рука' }, { value: staves[1]?.Id, label: 'Левая рука' }, { value: -1, label: 'Обе руки' }].map(item => <button key={item.label} role="radio" aria-checked={staff === item.value} disabled={item.value === undefined || (course.solo && item.value !== staves[0]?.Id)} onClick={() => changePart(0, item.value)}>{t(item.label)}</button>)}
    </div><label className="check-option"><input type="checkbox" checked={demo} onChange={event => { practice?.follower.reset(); setDemo(event.target.checked) }}/>{t('Экранная клавиатура · пробный режим')}</label></div> : <div className="score-part-controls"><label>{t("Партия MIDI")}<select value={part} onChange={event => changePart(Number(event.target.value))}>{instruments.map((instrument, index) => <option key={index} value={index}>{instrument.Name || t('Партия {{number}}', { number: index + 1 })}</option>)}</select></label>{staves.length > 1 && <label>{t("Нотный стан")}<select value={staff} onChange={event => changePart(part, Number(event.target.value))}><option value={-1}>{t("Все станы партии")}</option>{staves.map((item, index) => <option key={item.Id} value={item.Id}>{t("Стан")} {index + 1}</option>)}</select></label>}</div>)}
    {practice && loaded && <Following key={`${part}:${staff}:${demo}`} loaded={loaded} follower={practice.follower} warning={practice.warning} demo={demo} vertical={course ? { frames, staff, staves: staves.map(item => item.Id), keyboardOnly: !vertical } : undefined} onComplete={course ? (errors, groups) => course.onComplete({ errors, groups, demo, hand: staff === -1 ? 'both' : staff === staves[0]?.Id ? 'right' : 'left', view: vertical ? 'vertical' : bands ? 'bands' : 'standard' }) : undefined}/>}
    <div className={`imported-score-scroll ${vertical ? 'course-score-hidden' : ''}`}><div className="imported-score" aria-label={t("Импортированная партитура")} ref={container}/></div>
  </>
}

function Following({ loaded, follower, warning, demo = false, vertical, onComplete }: { loaded: ScoreDisplayController; follower: ScoreFollower; warning: string; demo?: boolean; vertical?: { frames: TeachingFrame[]; staff: number; staves: number[]; keyboardOnly: boolean }; onComplete?: (errors: number, groups: number) => void }) {
  const state = useSyncExternalStore(follower.subscribe, follower.getSnapshot)
  const device = useSyncExternalStore(midi.subscribe, midi.getConnectionSnapshot)
  const completion = useRef(onComplete)
  const saved = useRef(false)
  useEffect(() => { completion.current = onComplete }, [onComplete])
  useEffect(() => practiceView.registerPause(follower.pause), [follower])
  useEffect(() => { if (state.status === 'completed' || state.status === 'ready') void practiceView.end() }, [state.status])
  useEffect(() => {
    if (state.status !== 'completed') { saved.current = false; return }
    if (!saved.current) { saved.current = true; completion.current?.(state.errors, follower.groups.length) }
  }, [state.status, state.errors, follower])
  useEffect(() => {
    const offMidi = midi.onNote(event => { if (demo) return; if (event.type === 'on') follower.noteOn(event.midi); else follower.noteOff(event.midi) })
    const offDisconnect = midi.onDisconnect(follower.pause)
    const hide = () => { if (document.hidden) follower.pause() }
    document.addEventListener('visibilitychange', hide); window.addEventListener('blur', follower.pause)
    return () => { offMidi(); offDisconnect(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('blur', follower.pause); follower.pause() }
  }, [loaded, follower, demo])
  const showCursor = !vertical || vertical.keyboardOnly
  useEffect(() => {
    if (!showCursor) { loaded.hide(); return }
    let frame = 0
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; loaded.move(follower) }) }
    schedule()
    const unsubscribe = follower.subscribe(schedule)
    return () => { unsubscribe(); cancelAnimationFrame(frame) }
  }, [loaded, follower, showCursor])
  return <div className="score-following">
    {warning && <p className="notice">{t(warning)}</p>}
    <div className="following-toolbar">
      {device.status !== 'ready' && !demo ? <button onClick={() => void midi.connect()} disabled={device.status === 'connecting'}><Usb size={17}/> {t("Подключить MIDI")}</button> : <button className="primary" disabled={!follower.groups.length || state.status === 'completed'} onClick={async () => { if (state.status === 'running') follower.pause(); else if (await practiceView.begin()) follower.start() }}>{state.status === 'running' ? <Pause size={17}/> : <Play size={17}/>} {state.status === 'running' ? t("Приостановить") : state.status === 'paused' ? t("Продолжить") : t("Начать чтение")}</button>}
      <button className="icon-button" title={t("Сначала")} aria-label={t("Сначала")} onClick={follower.reset}><RotateCcw size={17}/></button>
      <span role="status">{t(state.feedback)}</span><span className="follow-position">{state.index} / {follower.groups.length}</span>
    </div>
    <div className="session-footer"><span>{t("Высота · без оценки ритма · без повторов")}</span><span>{t("Такт")} {follower.groups[state.index]?.measure ?? follower.groups.at(-1)?.measure ?? '—'}</span><span>{t("Ошибки:")} {state.errors}</span></div>
    {vertical && (!vertical.keyboardOnly || demo) && (
      <RepertoireVertical {...vertical} position={follower.groups[state.index]?.position ?? follower.groups.at(-1)?.position ?? 0} held={state.held} onDown={note => { if (demo) follower.noteOn(note) }} onUp={note => { if (demo) follower.noteOff(note) }}/>
    )}
  </div>
}
