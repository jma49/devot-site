/** A run of card copy: plain words, or a placeholder the page sets as code. */
export type CardText = string | { code: string }

export interface CardCopy {
  label: string
  body: readonly CardText[]
  /** The key that opens the feature, as the Mac draws it and as a screen reader should say it. */
  keys?: { glyphs: string; spoken: string }
}

export const cardsCopy = {
  cards: {
    label: 'Small details, close at hand',
    lead: 'The tools you reach for every day, a keystroke or a click away and out of sight the rest of the time.',
    items: {
      'card-1': {
        label: 'Themes',
        body: [
          'Tint the window with Dawn, Tide, Sage or Ember, four gradient themes that come in light and dark and can follow your Mac.',
        ],
      },
      'card-2': {
        label: 'Focus Mode',
        body: [
          'One keystroke hides the sidebar and the note list, so only the note you are writing stays on screen.',
        ],
        keys: { glyphs: '⇧⌘D', spoken: 'Shortcut: Shift Command D' },
      },
      'card-3': {
        label: 'Revision History',
        body: [
          'Devot keeps a version whenever you pause typing, shows what changed since, and lets you restore any of them.',
        ],
        keys: { glyphs: '⌥⌘Y', spoken: 'Shortcut: Option Command Y' },
      },
      'card-4': {
        label: 'Command palette',
        body: [
          'Type a few letters to find any command, notebook, tag or note, and change any shortcut to the keys you prefer.',
        ],
        keys: { glyphs: '⌘K', spoken: 'Shortcut: Command K' },
      },
      'card-5': {
        label: 'Tables',
        body: [
          'Tab moves between cells and shortcuts add, move and align rows and columns, so a Markdown table stays tidy as it grows.',
        ],
        keys: { glyphs: '⇥', spoken: 'Next cell: Tab' },
      },
      'card-6': {
        label: 'Templates',
        body: [
          'Start a note from a template that sets its notebook, tags and status, and fills in placeholders such as ',
          { code: '{{date}}' },
          ' and ',
          { code: '{{title}}' },
          '.',
        ],
        keys: { glyphs: '⌘T', spoken: 'Shortcut: Command T' },
      },
    } satisfies Record<`card-${1 | 2 | 3 | 4 | 5 | 6}`, CardCopy>,
  },
}
