import { openDB } from 'idb'
import { z } from 'zod'

export const courseRecord = z.object({ id: z.string(), piece: z.string(), hand: z.enum(['right', 'left', 'both']), view: z.enum(['vertical', 'bands', 'standard']), errors: z.number().int().nonnegative(), groups: z.number().int().positive(), created: z.number(), demo: z.boolean() })
export type CourseRecord = z.infer<typeof courseRecord>
const database = () => openDB('sight-reading-bridge-repertoire', 1, { upgrade(db) { db.createObjectStore('attempts', { keyPath: 'id' }) } })
export async function saveCourseRecord(record: CourseRecord) {
  const db = await database()
  try { await db.put('attempts', courseRecord.parse(record)) } finally { db.close() }
}
export async function readCourseRecords(): Promise<CourseRecord[]> {
  const db = await database()
  try { return (await db.getAll('attempts')).flatMap(row => { const result = courseRecord.safeParse(row); return result.success ? [result.data] : [] }).sort((a, b) => b.created - a.created) } finally { db.close() }
}
export function coursePassed(records: CourseRecord[], piece: string, hand: CourseRecord['hand']) {
  return records.some(record => record.piece === piece && record.hand === hand && !record.demo && record.groups / (record.groups + record.errors) >= 0.9)
}
