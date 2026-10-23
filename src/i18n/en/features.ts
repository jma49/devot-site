/** A run of a feature's text: plain words, or `code` set in the monospaced face. */
export type FeatureText = string | { code: string }

export interface FeatureItem {
  /** The media slot it shows, and the id of its block on the page. */
  slot: 'write' | 'organise' | 'find'
  name: string
  title: string
  body: FeatureText[]
}

const titleLines = ['Write it down.', 'Keep it in order.', 'Find it again.']

export const featuresCopy = {
  features: {
    titleLines,
    /** The section's name: its heading, read as one line. */
    label: titleLines.join(' '),
    lead: 'Three things a notes app has to get right, in one calm window on your Mac.',
    listLabel: 'Features',
    items: [
      {
        slot: 'write',
        name: 'Write',
        title: 'Markdown on one side, the finished page on the other.',
        body: [
          'Type plain Markdown and the live preview keeps pace, scrolling with you. Code is highlighted, and maths and Mermaid diagrams render as you write. Focus Mode hides the sidebar and the list, leaving only the note.',
        ],
      },
      {
        slot: 'organise',
        name: 'Organise',
        title: 'Every note in its place, and you know where it stands.',
        body: [
          'Nest notebooks inside notebooks, each with its own icon, and give your tags colours. Mark a note Active, On Hold, Completed or Dropped, or leave it without one: the list shows each status, and the sidebar filters by it.',
        ],
      },
      {
        slot: 'find',
        name: 'Find and connect',
        title: 'Any note, a few keystrokes away.',
        body: [
          'Search every word, then narrow it down with ',
          { code: 'book:' },
          ', ',
          { code: 'tag:' },
          ' or ',
          { code: 'status:' },
          ', or rule things out with a minus. Type ',
          { code: '[[' },
          ' to link one note to another, and the other note lists it under “Linked to this note”.',
        ],
      },
    ] satisfies FeatureItem[],
  },
}
