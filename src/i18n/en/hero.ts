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
    lead: 'Local-first Markdown notes for Mac and iPhone, with no account. End-to-end encrypted sync with no subscription, search by meaning on your device, and AI edits you review change by change.',
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
