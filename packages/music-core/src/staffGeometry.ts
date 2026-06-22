export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

export type Pitch = {
  letter: Letter
  octave: number
  midi: number
}

export type KeyboardGeometry = {
  minStep: number
  maxStep: number
  keyWidth: number
  left: number
}

export const LETTER_INDEX: Record<Letter, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
}

export const INDEX_LETTER: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

export function staffStep(letter: Letter, octave: number): number {
  return (octave - 4) * 7 + LETTER_INDEX[letter]
}

export function isLine(step: number): boolean {
  return step % 2 === 0
}

export function stepToPitch(step: number): Pitch {
  const normalized = ((step % 7) + 7) % 7
  const octave = 4 + Math.floor((step - normalized) / 7)
  const letter = INDEX_LETTER[normalized]
  return {
    letter,
    octave,
    midi: pitchToMidi(letter, octave),
  }
}

export function pitchToMidi(letter: Letter, octave: number): number {
  const semitone: Record<Letter, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }
  return (octave + 1) * 12 + semitone[letter]
}

export function midiToPitch(midi: number): Pitch | null {
  const pitchClass = midi % 12
  const map: Partial<Record<number, Letter>> = {
    0: 'C',
    2: 'D',
    4: 'E',
    5: 'F',
    7: 'G',
    9: 'A',
    11: 'B',
  }
  const letter = map[pitchClass]
  if (!letter) return null
  return { letter, octave: Math.floor(midi / 12) - 1, midi }
}

export function whiteKeyCenterX(step: number, geometry: KeyboardGeometry): number {
  return geometry.left + (step - geometry.minStep) * geometry.keyWidth + geometry.keyWidth / 2
}

export function whiteKeyLeftX(step: number, geometry: KeyboardGeometry): number {
  return geometry.left + (step - geometry.minStep) * geometry.keyWidth
}

export const TREBLE_LINE_STEPS = [2, 4, 6, 8, 10]
export const BASS_LINE_STEPS = [-10, -8, -6, -4, -2]
export const GRAND_STAFF_LINE_STEPS = [...BASS_LINE_STEPS, 0, ...TREBLE_LINE_STEPS]
