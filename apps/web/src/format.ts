const russianPlural = new Intl.PluralRules('ru')
export function noteCount(count: number) {
  const form = russianPlural.select(count)
  return `${count} ${form === 'one' ? 'нота' : form === 'few' ? 'ноты' : 'нот'}`
}
