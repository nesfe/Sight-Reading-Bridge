import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Expand, Minimize, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react'
import { t } from '../../../packages/i18n/src'
import { practiceView } from './practiceView'

export function PracticeControls() {
  const state = useSyncExternalStore(practiceView.subscribe, practiceView.getSnapshot)
  const options = useRef<HTMLDetailsElement>(null)
  useEffect(() => { if (state.error && options.current) options.current.open = true }, [state.error])
  useEffect(() => practiceView.initialize(), [])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && state.focused && !state.fullscreen) void practiceView.leave() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [state.focused, state.fullscreen])
  const focusLabel = t(state.focused ? 'Выйти из режима тренировки' : 'Режим тренировки')
  const fullLabel = t(state.fullscreen ? 'Выйти из полного экрана' : 'На весь экран')
  return <div className="practice-controls">
    {state.available && <button className="icon-button" title={focusLabel} aria-label={focusLabel} aria-pressed={state.focused} onClick={() => { if (state.focused) void practiceView.leave(); else void practiceView.begin() }}>{state.focused ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button>}
    <button className="icon-button" disabled={state.pending} title={fullLabel} aria-label={fullLabel} onClick={() => void practiceView.toggleFullscreen()}>{state.fullscreen ? <Minimize size={18}/> : <Expand size={18}/>}</button>
    <details className="practice-options" ref={options}><summary title={t('Настройки экрана')} aria-label={t('Настройки экрана')}><Settings2 size={18}/></summary><div><label><input type="checkbox" role="switch" checked={state.automatic} onChange={event => practiceView.setAutomatic(event.target.checked)}/>{t('Полный экран при начале занятия')}</label>{state.error && <p role="alert">{t(state.error)}</p>}</div></details>
  </div>
}
