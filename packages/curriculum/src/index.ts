import { z } from 'zod'

export const scaffoldSchema = z.object({
  A: z.number().min(0).max(1), B: z.number().min(0).max(1),
  C: z.number().min(0).max(1), D: z.number().min(0).max(1),
  E: z.literal(0), F: z.number().min(0).max(1), G: z.number().min(0).max(1),
})
export type Scaffold = z.infer<typeof scaffoldSchema>
export const lessonSchema = z.object({
  id: z.string(), title: z.string(), stage: z.number(), group: z.string(),
  kind: z.enum(['flash', 'patterns', 'etude', 'ahead']),
  hands: z.enum(['right', 'left', 'alternating']),
  min: z.number().int(), max: z.number().int(), count: z.number().int().positive(),
  tempo: z.number().min(30).max(120), horizon: z.number().min(0).max(2),
  scaffold: scaffoldSchema, accuracy: z.number().min(0).max(1),
})
export type Lesson = z.infer<typeof lessonSchema>
const supported: Scaffold = { A: 1, B: 1, C: 1, D: 1, E: 0, F: 0, G: 0 }
const bare: Scaffold = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 1 }
export const lessons: Lesson[] = z.array(lessonSchema).parse([
  { id: 'recognition-right', title: 'Узнавание: правая рука', group: '01 · Узнавание', stage: 1, kind: 'flash', hands: 'right', min: 0, max: 6, count: 12, tempo: 50, horizon: 0, scaffold: supported, accuracy: .9 },
  { id: 'recognition-left', title: 'Узнавание: левая рука', group: '01 · Узнавание', stage: 1, kind: 'flash', hands: 'left', min: -7, max: 0, count: 12, tempo: 50, horizon: 0, scaffold: supported, accuracy: .9 },
  { id: 'recognition-paper', title: 'Ноты без подписей', group: '01 · Узнавание', stage: 1, kind: 'flash', hands: 'alternating', min: -7, max: 7, count: 12, tempo: 50, horizon: 0, scaffold: bare, accuracy: .9 },
  { id: 'patterns-steps', title: 'Шаги и повторы', group: '02 · Паттерны', stage: 3, kind: 'patterns', hands: 'right', min: 0, max: 7, count: 18, tempo: 50, horizon: 0, scaffold: { ...supported, B: 0 }, accuracy: .9 },
  { id: 'patterns-triads', title: 'Терции и трезвучия', group: '02 · Паттерны', stage: 3, kind: 'patterns', hands: 'left', min: -7, max: 0, count: 18, tempo: 50, horizon: 0, scaffold: { ...bare, C: .4 }, accuracy: .9 },
  { id: 'alternating', title: 'Из руки в руку', group: '02 · Паттерны', stage: 4, kind: 'patterns', hands: 'alternating', min: -7, max: 7, count: 18, tempo: 50, horizon: 0, scaffold: { ...supported, B: 0 }, accuracy: .9 },
  { id: 'etude-vertical', title: 'Этюд для глаз', group: '03 · Новое чтение', stage: 5, kind: 'etude', hands: 'alternating', min: -7, max: 7, count: 16, tempo: 50, horizon: 0, scaffold: { ...supported, B: 0, C: .3 }, accuracy: .95 },
  { id: 'etude-paper', title: 'Этюд в обычной записи', group: '03 · Новое чтение', stage: 5, kind: 'etude', hands: 'alternating', min: -7, max: 7, count: 16, tempo: 50, horizon: 0, scaffold: bare, accuracy: .9 },
  { id: 'ahead-one', title: 'На одну ноту вперёд', group: '04 · Опережающее чтение', stage: 6, kind: 'ahead', hands: 'right', min: 0, max: 7, count: 16, tempo: 45, horizon: 1, scaffold: { ...bare, A: 1 }, accuracy: .9 },
  { id: 'ahead-two', title: 'На две ноты вперёд', group: '04 · Опережающее чтение', stage: 6, kind: 'ahead', hands: 'alternating', min: -7, max: 7, count: 16, tempo: 45, horizon: 2, scaffold: bare, accuracy: .9 },
])
