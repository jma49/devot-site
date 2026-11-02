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
    note: [
      'Signed and ',
      { unbroken: 'notarised by Apple' },
      ': open the dmg and drag Devot to Applications.',
    ] satisfies NoteText[],
    link: 'Install steps',
  },
}
