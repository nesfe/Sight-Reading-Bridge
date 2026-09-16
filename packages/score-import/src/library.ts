import { openDB } from 'idb'
import { z } from 'zod'

const scoreSchema = z.object({ id: z.string(), title: z.string(), filename: z.string(), xml: z.string(), created: z.number() })
export type LibraryScore = z.infer<typeof scoreSchema>
const database = () => openDB('sight-reading-bridge-library', 1, { upgrade(db) { db.createObjectStore('scores', { keyPath: 'id' }) } })
export async function listScores(): Promise<LibraryScore[]> {
  const db = await database()
  try { return (await db.getAll('scores')).flatMap(row => { const result = scoreSchema.safeParse(row); return result.success ? [result.data] : [] }).sort((a, b) => b.created - a.created) }
  finally { db.close() }
}
export async function saveScore(score: LibraryScore) {
  const db = await database()
  try { await db.put('scores', scoreSchema.parse(score)) } finally { db.close() }
}
export async function deleteScore(id: string) {
  const db = await database()
  try { await db.delete('scores', id) } finally { db.close() }
}
