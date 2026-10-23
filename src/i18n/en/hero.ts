const titleLines = ['Your notes stay on your Mac,', 'in your hands.'] as const

/** A run of the install note: words, or words the page keeps on one line. */
export type NoteText = string | { unbroken: string }

export const heroCopy = {
  hero: {
    title: titleLines.join(' '),
    titleLines,
    lead: 'Local-first Markdown notes for macOS. Write, organise and find everything in one Mac window, offline and without an account.',
  },
  /** The first-launch note under the hero's and the closing section's download buttons. */
  install: {
    // Broken after its hyphen, "right-click" reads as two words.
    note: [
      'Not notarised yet: the first time, ',
      { unbroken: 'right-click' },
      ' Devot and choose Open.',
    ] satisfies NoteText[],
    link: 'Install steps',
  },
}
