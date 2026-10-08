import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, FileMusic, Search } from 'lucide-react'
import { t } from '../../../packages/i18n/src'
import { loadPiece, pieceTitle, repertoire, type RepertoirePiece } from '../../../packages/repertoire'
import { coursePassed, readCourseRecords, saveCourseRecord, type CourseRecord } from '../../../packages/repertoire/progress'
import { ScoreDocument } from './Library'

const modules = ['Все разделы', '01 · Одна мелодия', '02 · Первые пьесы двумя руками', '03 · Мелодия и сопровождение', '04 · Характер и координация', '05 · Дополнительный вызов']

export default function Repertoire() {
  const [selected, setSelected] = useState<string | null>(null)
  const [module, setModule] = useState(0)
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<CourseRecord[]>([])
  const [error, setError] = useState('')
  const refresh = useCallback(() => { void readCourseRecords().then(setRecords).catch(() => setError('Не удалось прочитать прогресс курса.')) }, [])
  useEffect(refresh, [refresh])
  const piece = repertoire.find(item => item.id === selected)
  const passed = (item: RepertoirePiece) => coursePassed(records, item.id, item.leadSheet ? 'right' : 'both')
  const complete = repertoire.filter(passed).length
  const visible = repertoire.filter(item => (!module || item.module === module) && `${pieceTitle(item)} ${item.composer} ${item.work}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="repertoire-course">
    {error && <p role="alert" className="notice error">{t(error)}</p>}
    {piece ? <>
      <div className="course-piece-heading"><button className="icon-button" title={t('К курсу')} aria-label={t('К курсу')} onClick={() => { setSelected(null); refresh() }}><ArrowLeft size={20}/></button><div><span className="eyebrow">{t(modules[piece.module])} · {piece.number} / {repertoire.length}</span><h2>{pieceTitle(piece)}</h2><span className="muted">{piece.composer}</span></div></div>
      <PiecePractice key={piece.id} piece={piece} onSaved={refresh}/>
      <div className="course-navigation"><button disabled={piece.number === 1} onClick={() => setSelected(repertoire[piece.number - 2].id)}><ArrowLeft size={17}/>{t('Предыдущая пьеса')}</button><button disabled={piece.number === repertoire.length} onClick={() => setSelected(repertoire[piece.number].id)}>{t('Следующая пьеса')}<ArrowRight size={17}/></button></div>
    </> : <>
      <div className="course-summary"><div><span className="eyebrow">ADVANCED · {t('ПОСЛЕ ТРЕНАЖЁРА')}</span><h2>{t('От упражнений к музыке')}</h2><p>{t('31 пьеса · одна и две руки · пять разделов')}</p></div><div className="course-total"><strong>{complete} / {repertoire.length}</strong><span>{t('Пройдено на MIDI')}</span><progress max={repertoire.length} value={complete}/></div></div>
      <div className="course-filters"><label className="course-search"><Search size={17}/><input type="search" aria-label={t('Найти пьесу')} placeholder={t('Название или композитор')} value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label={t('Раздел курса')} value={module} onChange={event => setModule(Number(event.target.value))}>{modules.map((name, index) => <option key={name} value={index}>{t(name)}</option>)}</select></div>
      {!visible.length && <p className="notice">{t('Пьесы не найдены.')}</p>}
      {modules.slice(1).map((name, index) => {
        const items = visible.filter(item => item.module === index + 1)
        return items.length > 0 && <section className="course-module" key={name}><h3>{t(name)}</h3>{items.map(item => <button className="course-piece-row" key={item.id} onClick={() => setSelected(item.id)}>
          <span className="course-piece-number">{passed(item) ? <Check size={19}/> : String(item.number).padStart(2, '0')}</span><span className="course-piece-title"><strong>{pieceTitle(item)}</strong><small>{item.composer}</small></span><span className="course-piece-format">{item.leadSheet ? t('Одна мелодия') : t('Две руки')} · {item.facts.bars.both} {t('тактов')}</span><ArrowRight size={17}/>
        </button>)}</section>
      })}
      <details className="course-source"><summary>{t('О курсе и источниках')}</summary><p>{t('Основной маршрут ориентирован на первые годы обучения, но не является утверждённой программой музыкальной школы. Последние три пьесы сложнее и необязательны. Advanced означает продолжение тренажёра, а не профессиональный уровень.')}</p><p>{t('Источник нотного набора — открытая коллекция dacapo. Сохранены сведения об изданиях и лицензиях. Тема «Оды к радости» дана в переложении, «К Элизе» — раздел A; одноголосные песни не содержат выписанной левой руки.')}</p><a href="https://github.com/ya-luotao/dacapo/tree/9d22701fb714ed6b3b4e8118f6337965bc54e1a9/scripts/pieces" target="_blank" rel="noreferrer">dacapo <ExternalLink size={14}/></a><p>{t('Зачёт: полный проход с точностью высоты не ниже 90%, MIDI, правая рука для одноголосных мелодий или обе руки для фортепианных пьес. Ритм, педаль и выразительность не оцениваются. Повторы не разворачиваются. Пробные проходы не засчитываются.')}</p></details>
    </>}
  </section>
}

function PiecePractice({ piece, onSaved }: { piece: RepertoirePiece; onSaved: () => void }) {
  const [xml, setXml] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CourseRecord | null>(null)
  useEffect(() => { let active = true; void loadPiece(piece.id).then(content => { if (active) setXml(content) }).catch(() => { if (active) setError('Не удалось открыть пьесу.') }); return () => { active = false } }, [piece.id])
  const complete = useCallback((data: Omit<CourseRecord, 'id' | 'piece' | 'created'>) => {
    const record = { ...data, piece: piece.id, id: crypto.randomUUID(), created: Date.now() }
    setResult(record)
    void saveCourseRecord(record).then(onSaved).catch(() => setError('Результат курса не сохранён.'))
  }, [piece.id, onSaved])
  return <>
    {error && <p role="alert" className="notice error">{t(error)}</p>}
    {result && <div className="course-result" role="status"><Check size={18}/><span>{t('Полный проход завершён')} · {Math.round(result.groups / (result.groups + result.errors) * 100)}% · {t(result.hand === 'both' ? 'Обе руки' : result.hand === 'right' ? 'Правая рука' : 'Левая рука')}{result.demo ? ` · ${t('Пробный режим')}` : ''}</span></div>}
    {xml ? <ScoreDocument score={{ id: piece.id, xml, title: pieceTitle(piece), filename: `${piece.id}.musicxml`, created: 0 }} course={{ solo: Boolean(piece.leadSheet), onComplete: complete }}/> : !error && <p role="status">{t('Подготовка партитуры…')}</p>}
    <details className="course-source"><summary><FileMusic size={15}/>{t('Издание и лицензия')}</summary><p>{piece.work}</p><p>{piece.source}</p><p>{t('Нотный набор')}: {piece.encoder} · {piece.licence}</p><div className="actions"><a href={piece.sourceUrl} target="_blank" rel="noreferrer">{t('Источник')} <ExternalLink size={14}/></a><a href="./REPERTOIRE-NOTICES.txt" download><Download size={14}/>{t('Лицензии сборника')}</a></div></details>
  </>
}
