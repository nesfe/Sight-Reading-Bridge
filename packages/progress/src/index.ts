import { openDB } from 'idb'
import { z } from 'zod'
import { scaffoldSchema } from '../../curriculum/src'

const attemptSchema = z.object({ index: z.number(), expected: z.number(), actual: z.number().nullable(), correct: z.boolean(), missed: z.boolean(), reactionMs: z.number().nullable(), timingMs: z.number().nullable(), releaseMs: z.number().optional(), at: z.number() })
export const recordSchema = z.object({
  id: z.string(), lessonId: z.string(), seed: z.number(), created: z.number(),
  completed: z.boolean(), demo: z.boolean(), repeat: z.number(), tempo: z.number(), horizon: z.number(),
  elapsed: z.number(), scaffold: scaffoldSchema, attempts: z.array(attemptSchema),
})
export type Record = z.infer<typeof recordSchema>
const database = () => openDB('sight-reading-bridge', 1, { upgrade(db) { db.createObjectStore('sessions', { keyPath: 'id' }) } })
let queue: Promise<void> = Promise.resolve()
export function save(record: Record) {
  const next = recordSchema.parse(record)
  const write = queue.catch(() => {}).then(async () => { const db = await database(); await db.put('sessions', next); db.close() })
  queue = write
  return write
}
export async function read(): Promise<Record[]> { const db = await database(); const rows = await db.getAll('sessions'); db.close(); return rows.flatMap(row => { const parsed = recordSchema.safeParse(row); return parsed.success ? [parsed.data] : [] }).sort((a, b) => b.created - a.created) }
export async function importRecords(text: string) { const records = z.array(recordSchema).max(10000).parse(JSON.parse(text)); const db = await database(); const tx = db.transaction('sessions', 'readwrite'); for (const record of records) await tx.store.put(record); await tx.done; db.close() }
