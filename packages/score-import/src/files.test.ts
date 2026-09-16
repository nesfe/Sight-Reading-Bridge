import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { MAX_FILE_BYTES, unpackMxl } from './files'

const manifest = strToU8('<container><rootfiles><rootfile full-path="scores/piano.musicxml"/></rootfiles></container>')
describe('bounded MXL unpacking', () => {
  it('reads compressed XML without treating ZIP resources as notation', () => {
    const zip = zipSync({ 'META-INF/container.xml': manifest, 'scores/piano.musicxml': strToU8('<score-partwise/>'), 'cover.png': new Uint8Array([1, 2, 3]) })
    const files = unpackMxl(zip)
    expect([...files.keys()]).toEqual(['META-INF/container.xml', 'scores/piano.musicxml', 'cover.png'])
    expect(new TextDecoder().decode(files.get('scores/piano.musicxml'))).toBe('<score-partwise/>')
  })
  it('rejects missing manifests, traversal names, oversized input and expanded ZIPs', () => {
    expect(() => unpackMxl(zipSync({ 'score.xml': strToU8('<score-partwise/>') }))).toThrow('container.xml')
    expect(() => unpackMxl(zipSync({ '../score.xml': strToU8('bad') }))).toThrow('структура')
    expect(() => unpackMxl(new Uint8Array(MAX_FILE_BYTES + 1))).toThrow('10 МБ')
    expect(() => unpackMxl(zipSync({ 'META-INF/container.xml': manifest, 'bomb.xml': new Uint8Array(33 * 1024 * 1024) }))).toThrow('32 МБ')
  })
})
