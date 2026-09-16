export const recognitionBlocks = [
  { id: 'map', title: 'Карта нот' },
  { id: 'neighbors', title: 'Соседние позиции' },
  { id: 'mixed', title: 'Узнавание вразброс' },
  { id: 'check', title: 'Проверка' },
] as const
export type RecognitionBlock = typeof recognitionBlocks[number]['id']

export function recognitionPlan(min: number, max: number, alternating = false) {
  const pitches = max - min + 1
  const counts = alternating
    ? [2 * pitches, 2 * (pitches - 1), 3 * pitches, 2 * pitches]
    : [4 * pitches, 4 * (pitches - 1), 6 * pitches, 3 * pitches]
  let start = 0
  return recognitionBlocks.map((block, index) => {
    const result = { ...block, start, count: counts[index] }
    start += result.count
    return result
  })
}
export function recognitionCount(min: number, max: number, alternating = false) {
  return recognitionPlan(min, max, alternating).reduce((sum, block) => sum + block.count, 0)
}
