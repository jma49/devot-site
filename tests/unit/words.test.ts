import { expect, it } from 'vitest'
import { capitalised, hyphenRuns, numberWord } from '../../src/lib/words.ts'

it('spells the small counts the copy names in words', () => {
  expect(numberWord(1)).toBe('one')
  expect(numberWord(3)).toBe('three')
  expect(numberWord(10)).toBe('ten')
})

it('writes larger or fractional counts as digits', () => {
  expect(numberWord(14)).toBe('14')
  expect(numberWord(2.5)).toBe('2.5')
})

it('capitalises the first letter only', () => {
  expect(capitalised('three-day free trial')).toBe('Three-day free trial')
  expect(capitalised('')).toBe('')
})

it('marks hyphenated words as runs to keep whole', () => {
  expect(hyphenRuns('Devot turns read-only: notes stay end-to-end encrypted.')).toEqual([
    { text: 'Devot turns ', whole: false },
    { text: 'read-only', whole: true },
    { text: ': notes stay ', whole: false },
    { text: 'end-to-end', whole: true },
    { text: ' encrypted.', whole: false },
  ])
})

it('gives text without a hyphenated word back as one run, and nothing for empty text', () => {
  expect(hyphenRuns('Nothing is deleted.')).toEqual([{ text: 'Nothing is deleted.', whole: false }])
  expect(hyphenRuns('a - b')).toEqual([{ text: 'a - b', whole: false }])
  expect(hyphenRuns('')).toEqual([])
})
