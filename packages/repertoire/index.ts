import source from './catalog.json'
import { getLocale } from '../i18n/src'

// Course order is independent of the source collection's browsing order.
const order = [
  'trad-twinkle-twinkle', 'trad-frere-jacques', 'lyte-row-your-boat', 'trad-amazing-grace', 'pierpont-jingle-bells', 'foster-oh-susanna', 'trad-auld-lang-syne', 'trad-swing-low',
  'turk-aller-anfang', 'turk-muntere-knabe', 'turk-hans-ohne-sorgen', 'turk-matt-und-krank', 'beethoven-ode-to-joy', 'beyer-kinderlied', 'czerny-op599-no11',
  'turk-bey-der-wiege', 'beyer-abendlied', 'beyer-op101-no66', 'schumann-melodie', 'petzold-minuet-in-g', 'petzold-minuet-in-g-minor',
  'schumann-soldiers-march', 'bach-musette-in-d', 'burgmuller-candeur', 'tchaikovsky-old-french-song', 'tchaikovsky-morning-prayer', 'burgmuller-arabesque', 'beethoven-fur-elise',
  'satie-gymnopedie-1', 'chopin-prelude-in-c-minor', 'bach-prelude-in-c',
]
const titles: Record<string, [string, string]> = {
  'trad-twinkle-twinkle': ['Мерцай, звёздочка', 'Twinkle, Twinkle, Little Star'],
  'trad-frere-jacques': ['Братец Яков', 'Frère Jacques'],
  'lyte-row-your-boat': ['Греби, греби на лодочке', 'Row Your Boat'],
  'trad-amazing-grace': ['О, благодать', 'Amazing Grace'],
  'pierpont-jingle-bells': ['Бубенцы', 'Jingle Bells'],
  'foster-oh-susanna': ['О, Сюзанна', 'Oh! Susanna'],
  'trad-auld-lang-syne': ['Старое доброе время', 'Auld Lang Syne'],
  'trad-swing-low': ['Swing Low, Sweet Chariot', 'Swing Low, Sweet Chariot'],
  'turk-aller-anfang': ['Всякое начало трудно', 'All Beginnings Are Difficult'],
  'turk-muntere-knabe': ['Весёлый мальчик', 'The Cheerful Boy'],
  'turk-hans-ohne-sorgen': ['Беззаботный Ганс', 'Carefree Hans'],
  'turk-matt-und-krank': ['Я так устал и болен', 'I Am So Tired and Ill'],
  'beethoven-ode-to-joy': ['Ода к радости · тема, переложение', 'Ode to Joy · theme, arrangement'],
  'beyer-kinderlied': ['Детская песенка · соч. 101 № 24', 'Children’s Song · Op. 101 No. 24'],
  'czerny-op599-no11': ['Этюд · соч. 599 № 11', 'Study · Op. 599 No. 11'],
  'turk-bey-der-wiege': ['У колыбели', 'At the Cradle'],
  'beyer-abendlied': ['Вечерняя песня · соч. 101 № 58', 'Evening Song · Op. 101 No. 58'],
  'beyer-op101-no66': ['Этюд · соч. 101 № 66', 'Study · Op. 101 No. 66'],
  'schumann-melodie': ['Мелодия · соч. 68 № 1', 'Melody · Op. 68 No. 1'],
  'petzold-minuet-in-g': ['Менуэт соль мажор', 'Minuet in G Major'],
  'petzold-minuet-in-g-minor': ['Менуэт соль минор', 'Minuet in G Minor'],
  'schumann-soldiers-march': ['Солдатский марш', 'Soldiers’ March'],
  'bach-musette-in-d': ['Мюзет ре мажор', 'Musette in D Major'],
  'burgmuller-candeur': ['Искренность', 'La Candeur'],
  'tchaikovsky-old-french-song': ['Старинная французская песенка', 'Old French Song'],
  'tchaikovsky-morning-prayer': ['Утренняя молитва', 'Morning Prayer'],
  'burgmuller-arabesque': ['Арабеска', 'Arabesque'],
  'beethoven-fur-elise': ['К Элизе · раздел A', 'Für Elise · A section'],
  'satie-gymnopedie-1': ['Гимнопедия № 1', 'Gymnopédie No. 1'],
  'chopin-prelude-in-c-minor': ['Прелюдия до минор · соч. 28 № 20', 'Prelude in C Minor · Op. 28 No. 20'],
  'bach-prelude-in-c': ['Прелюдия до мажор · BWV 846', 'Prelude in C Major · BWV 846'],
}
export const repertoire = order.map((id, index) => ({ ...source.find(piece => piece.id === id)!, module: index < 8 ? 1 : index < 15 ? 2 : index < 21 ? 3 : index < 28 ? 4 : 5, number: index + 1 }))
export type RepertoirePiece = typeof repertoire[number]
export const pieceTitle = (piece: RepertoirePiece) => titles[piece.id]?.[getLocale() === 'ru' ? 0 : 1] ?? piece.work
const files = import.meta.glob<string>('./scores/*.musicxml', { query: '?raw', import: 'default' })
export async function loadPiece(id: string) {
  const load = files[`./scores/${id}.musicxml`]
  if (!load || !order.includes(id)) throw new Error('Пьеса не найдена.')
  return load()
}
