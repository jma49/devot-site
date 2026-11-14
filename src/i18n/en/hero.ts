const titleLines: readonly string[] = ['Your notes stay on your Mac', 'and iPhone,']
/** The words that close the last line, in the accent ink. */
const titleAccent = 'in your hands.'

/** A run of the install note: words, or words the page keeps on one line. */
export type NoteText = string | { unbroken: string }

export const heroCopy = {
  hero: {
    title: [...titleLines, titleAccent].join(' '),
    titleLines,
    titleAccent,
    lead: 'Local-first Markdown notes for Mac and iPhone. Write offline and without an account, then sync through your own iCloud.',
  },
  /** The first-launch note under the hero's and the closing section's download buttons. */
  install: {
    note: [
      'Signed and ',
      { unbroken: 'notarised by Apple' },
      ', so it opens like any Mac app.',
    ] satisfies NoteText[],
    link: 'Install steps',
  },
}
