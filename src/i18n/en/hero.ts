const titleLines = ['Your notes stay on your Mac and iPhone,', 'in your hands.'] as const

/** A run of the install note: words, or words the page keeps on one line. */
export type NoteText = string | { unbroken: string }

export const heroCopy = {
  hero: {
    title: titleLines.join(' '),
    titleLines,
    lead: "Local-first Markdown notes for Mac and iPhone. Write, organise and find everything offline and without an account, and sync through your own iCloud, sealed with Devot's key.",
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
