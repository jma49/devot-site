const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]

/** A count as copy writes it: in words up to ten, in digits above. */
export const numberWord = (count: number): string => WORDS[count] ?? String(count)

export const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
