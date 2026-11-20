export interface EdgeItem {
  /** The id of its block on the page. */
  id: 'sync' | 'meaning' | 'review' | 'source'
  name: string
  title: string
  body: string
}

export const edgeCopy = {
  edge: {
    label: 'What sets Devot apart',
    lead: 'Four things that come with the one licence, with nothing to subscribe to and nothing to trust blindly.',
    items: [
      {
        id: 'sync',
        name: 'Sync',
        title: 'End-to-end encrypted sync, no subscription.',
        body: 'Each note is sealed with AES-256-GCM on your device before it leaves, then travels through your own iCloud or a relay you deploy. Neither can read it, and the licence you buy once covers sync for good.',
      },
      {
        id: 'meaning',
        name: 'Search',
        title: 'Search by meaning, on your device.',
        body: 'Related by Meaning finds notes that say what you searched for in other words. A language model built into the system reads them on your device, in seven languages, so it works offline and no note leaves for it.',
      },
      {
        id: 'review',
        name: 'AI',
        title: 'AI edits you review change by change.',
        body: 'Edit with AI shows its proposal as a diff and applies only the changes you tick. When an AI tool writes over MCP, Devot marks what it changed and lets you keep or undo each edit. Bring a key from your own provider.',
      },
      {
        id: 'source',
        name: 'Source',
        title: 'Source you can read and build.',
        body: 'Every line of Devot is public under FSL-1.1-MIT. Check how your notes are stored and encrypted, or build the app yourself.',
      },
    ] satisfies EdgeItem[],
  },
}
