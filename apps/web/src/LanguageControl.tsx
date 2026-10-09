import { Languages } from 'lucide-react'
import { getLocale, setLocale, t } from '../../../packages/i18n/src'
import { PracticeControls } from './PracticeControls'

export function LanguageControl() {
  const locale = getLocale()
  return <div className="language-bar">
    <PracticeControls/>
    <div className="language-label"><Languages size={17} aria-hidden="true"/><span>{t('Язык')}</span></div>
    <div className="language-options" role="group" aria-label="Language / Язык">
      <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>English</button>
      <button type="button" lang="ru" aria-pressed={locale === 'ru'} onClick={() => setLocale('ru')}>Русский</button>
    </div>
  </div>
}
