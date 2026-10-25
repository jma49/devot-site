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

export interface TextRun {
  text: string
  whole: boolean
}

/** Splits text so a template can keep each hyphenated word, such as "read-only", on one line. */
export const hyphenRuns = (text: string): TextRun[] => {
  const runs: TextRun[] = []
  let from = 0
  for (const match of text.matchAll(/\p{L}+(?:-\p{L}+)+/gu)) {
    if (match.index > from) runs.push({ text: text.slice(from, match.index), whole: false })
    runs.push({ text: match[0], whole: true })
    from = match.index + match[0].length
  }
  if (from < text.length) runs.push({ text: text.slice(from), whole: false })
  return runs
}
