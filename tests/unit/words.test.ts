import { expect, it } from 'vitest'
import { capitalised, numberWord } from '../../src/lib/words.ts'

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
