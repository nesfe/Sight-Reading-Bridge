import { afterEach, describe, expect, it } from 'vitest'
import { detectLocale, i18n, setLocale, t } from './index'
import { en } from './en'

afterEach(() => setLocale('en'))
describe('language selection and messages', () => {
  it('prefers an explicit choice, then the first supported system language', () => {
    expect(detectLocale('ru', ['en-US'])).toBe('ru')
    expect(detectLocale('en', ['ru-RU'])).toBe('en')
    expect(detectLocale(null, ['ru-RU', 'en-US'])).toBe('ru')
    expect(detectLocale(null, ['fr-FR', 'en-GB', 'ru'])).toBe('en')
    expect(detectLocale('invalid', ['RU-ru'])).toBe('ru')
    expect(detectLocale(null, ['de-DE'])).toBe('en')
    expect(detectLocale(null, [])).toBe('en')
  })
  it('uses locale-specific plurals and interpolates values without translating user data', () => {
    setLocale('en')
    expect([1, 2, 5, 21, 115].map(count => t('noteCount', { count }))).toEqual(['1 note', '2 notes', '5 notes', '21 notes', '115 notes'])
    expect(t('Удалить {{title}}', { title: 'Моя пьеса' })).toBe('Delete Моя пьеса')
    setLocale('ru')
    expect([1, 2, 5, 21, 115].map(count => t('noteCount', { count }))).toEqual(['1 нота', '2 ноты', '5 нот', '21 нота', '115 нот'])
    expect(t('Повтор {{number}}', { number: 3 })).toBe('Повтор 3')
  })
  it('keeps placeholders intact and translates every catalog entry', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value).not.toMatch(/[А-Яа-яЁё]/)
      if (!key.startsWith('noteCount')) {
        expect(value.match(/{{\w+}}/g) ?? []).toEqual(key.match(/{{\w+}}/g) ?? [])
        expect(i18n.exists(key, { lng: 'ru' })).toBe(true)
      }
    }
  })
})
