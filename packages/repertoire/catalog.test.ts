import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import catalog from './catalog.json'
import { loadPiece, repertoire, pieceTitle } from './index'
import { coursePassed, courseRecord } from './progress'
import { setLocale } from '../i18n/src'

describe('licensed repertoire collection', () => {
  it('ships 31 distinct pinned and unmodified MusicXML scores', () => {
    expect(repertoire).toHaveLength(31)
    expect(new Set(repertoire.map(piece => piece.id)).size).toBe(31)
    for (const piece of catalog) {
      const xml = readFileSync(new URL(`./scores/${piece.id}.musicxml`, import.meta.url), 'utf8')
      expect(createHash('sha256').update(xml).digest('hex')).toBe(piece.sha256)
      expect(xml).toContain('<score-partwise')
      expect(xml).toContain('<rights>')
      expect(piece.sourceUrl).toMatch(/^https:\/\//)
      expect(piece.licence).toMatch(/MIT|CC0/)
    }
  })
  it('has a real single-melody opening, two-hand pieces, and separately labeled challenges', async () => {
    expect(repertoire.filter(piece => piece.module === 1).every(piece => piece.leadSheet)).toBe(true)
    expect(repertoire.filter(piece => piece.module === 5)).toHaveLength(3)
    expect(repertoire.filter(piece => piece.module > 1).every(piece => piece.facts.bars.left > 0)).toBe(true)
    for (const piece of repertoire) { expect(await loadPiece(piece.id)).toContain('<score-partwise'); setLocale('en'); expect(pieceTitle(piece)).not.toMatch(/[А-Яа-я]/); setLocale('ru'); expect(pieceTitle(piece).length).toBeGreaterThan(3) }
    setLocale('en')
  })
  it('does not award completion for demos, other hands, or low accuracy', () => {
    const record = courseRecord.parse({ id: '1', piece: 'test', hand: 'both', view: 'vertical', errors: 0, groups: 100, created: 1, demo: false })
    expect(coursePassed([record], 'test', 'both')).toBe(true)
    expect(coursePassed([{ ...record, demo: true }], 'test', 'both')).toBe(false)
    expect(coursePassed([{ ...record, errors: 20 }], 'test', 'both')).toBe(false)
    expect(coursePassed([record], 'test', 'right')).toBe(false)
  })
})
