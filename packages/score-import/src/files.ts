import { Unzip, UnzipInflate, strFromU8 } from 'fflate'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_EXPANDED_BYTES = 32 * 1024 * 1024

export function unpackMxl(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > MAX_FILE_BYTES) throw new Error('Файл превышает 10 МБ.')
  const files = new Map<string, Uint8Array>()
  const names = new Set<string>()
  let entries = 0
  let failure: Error | undefined
  const unzip = new Unzip(file => {
    if (++entries > 256 || names.has(file.name) || file.name.startsWith('/') || file.name.includes('\\') || file.name.split('/').includes('..')) {
      failure = new Error('Некорректная структура MXL.')
      return
    }
    names.add(file.name)
    if ((file.originalSize ?? 0) > MAX_EXPANDED_BYTES) { failure = new Error('Распакованный MXL превышает 32 МБ.'); return }
    const chunks: Uint8Array[] = []
    let length = 0
    file.ondata = (error, chunk, final) => {
      if (error) { failure = error; return }
      if (failure) return
      expanded += chunk.length
      if (expanded > MAX_EXPANDED_BYTES) { failure = new Error('Распакованный MXL превышает 32 МБ.'); file.terminate(); return }
      chunks.push(chunk); length += chunk.length
      if (final) {
        const content = new Uint8Array(length)
        let offset = 0
        for (const part of chunks) { content.set(part, offset); offset += part.length }
        files.set(file.name, content)
      }
    }
    file.start()
  })
  let expanded = 0
  unzip.register(UnzipInflate)
  for (let offset = 0; offset < bytes.length; offset += 65536) {
    unzip.push(bytes.subarray(offset, offset + 65536), offset + 65536 >= bytes.length)
    if (failure) throw failure
  }
  if (!files.has('META-INF/container.xml')) throw new Error('В MXL отсутствует META-INF/container.xml.')
  return files
}

function xmlDocument(text: string): Document {
  if (/<!ENTITY/i.test(text)) throw new Error('XML с объявлениями ENTITY не поддерживается.')
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('Повреждённый XML: проверьте экспорт из нотного редактора.')
  if (document.doctype) document.removeChild(document.doctype)
  return document
}

export function validateScore(xml: string): Document {
  const document = xmlDocument(xml)
  if (document.documentElement.localName !== 'score-partwise') {
    throw new Error(document.documentElement.localName === 'score-timewise'
      ? 'MusicXML timewise пока не поддерживается. Экспортируйте MusicXML partwise из нотного редактора.'
      : 'Это не партитура MusicXML. PDF, MIDI и файлы редакторов напрямую не поддерживаются.')
  }
  if (!document.querySelector('part-list') || !document.querySelector('part > measure')) throw new Error('В MusicXML отсутствуют партии или такты.')
  if (document.querySelectorAll('note').length > 30000 || document.querySelectorAll('measure').length > 4000) throw new Error('Партитура слишком большая: максимум 30 000 нот и 4 000 тактов по всем партиям.')
  // Embedded/external artwork is not part of notation and must never trigger network access.
  document.querySelectorAll('credit-image, image, link, bookmark').forEach(node => node.remove())
  return document
}

export async function readScoreFile(file: File): Promise<{ xml: string; title: string }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Файл превышает 10 МБ.')
  if (!/\.(musicxml|xml|mxl)$/i.test(file.name)) throw new Error('Выберите MusicXML (.musicxml, .xml) или сжатый MusicXML (.mxl).')
  let xml: string
  if (/\.mxl$/i.test(file.name)) {
    const files = unpackMxl(new Uint8Array(await file.arrayBuffer()))
    const manifest = xmlDocument(strFromU8(files.get('META-INF/container.xml')!))
    const roots = [...manifest.getElementsByTagNameNS('*', 'rootfile')]
    const root = roots.find(node => node.getAttribute('media-type') === 'application/vnd.recordare.musicxml+xml') ?? roots[0]
    const path = root?.getAttribute('full-path')
    if (!path || !files.has(path)) throw new Error('Основная партитура, указанная в MXL, не найдена.')
    xml = strFromU8(files.get(path)!)
  } else xml = await file.text()
  const document = validateScore(xml)
  const title = document.querySelector('work-title')?.textContent?.trim() || document.querySelector('movement-title')?.textContent?.trim() || file.name.replace(/\.(musicxml|xml|mxl)$/i, '')
  return { xml: new XMLSerializer().serializeToString(document), title }
}
