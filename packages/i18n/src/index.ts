import { createInstance } from 'i18next'
import { en } from './en'

export type Locale = 'en' | 'ru'
export const LANGUAGE_KEY = 'srb-language'

export function detectLocale(saved: string | null, languages: readonly string[]): Locale {
  if (saved === 'en' || saved === 'ru') return saved
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'en' || base === 'ru') return base
  }
  return 'en'
}

function initialLocale(): Locale {
  let saved = null
  try { saved = localStorage.getItem(LANGUAGE_KEY) } catch { /* Storage may be unavailable. */ }
  return detectLocale(saved, typeof navigator === 'undefined' ? [] : navigator.languages)
}

const ru = { ...Object.fromEntries(Object.keys(en).map(key => [key, key])),
  noteCount_one: '{{count}} нота', noteCount_few: '{{count}} ноты',
  noteCount_many: '{{count}} нот', noteCount_other: '{{count}} ноты',
}
export const i18n = createInstance()
void i18n.init({ lng: initialLocale(), fallbackLng: 'en', supportedLngs: ['en', 'ru'],
  resources: { en: { translation: en }, ru: { translation: ru } },
  keySeparator: false, nsSeparator: false, initAsync: false, interpolation: { escapeValue: false },
})
export const getLocale = (): Locale => i18n.language === 'ru' ? 'ru' : 'en'
export function t(key: string, values?: Record<string, string | number>): string {
  return i18n.t(key, values)
}
export function subscribeLocale(listener: () => void) {
  i18n.on('languageChanged', listener)
  return () => { i18n.off('languageChanged', listener) }
}
function updateDocumentLanguage() {
  if (typeof document !== 'undefined') document.documentElement.lang = getLocale()
}
i18n.on('languageChanged', updateDocumentLanguage)
updateDocumentLanguage()
export function setLocale(locale: Locale) {
  void i18n.changeLanguage(locale)
  try { localStorage.setItem(LANGUAGE_KEY, locale) } catch { /* Keep the in-memory selection. */ }
}
