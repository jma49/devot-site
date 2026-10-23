/** A run of card copy: plain words, or a placeholder the page sets as code. */
export type CardText = string | { code: string }

export interface CardCopy {
  label: string
  /** The card's heading: what the feature does for you, in a few words. */
  title: string
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
        title: 'Four gradients, light or dark.',
        body: [
          'Tint the window with Dawn, Tide, Sage or Ember, four gradient themes that come in light and dark and can follow your Mac.',
        ],
      },
      'card-2': {
        label: 'Focus Mode',
        title: 'Just the note, nothing else.',
        body: [
          'One keystroke hides the sidebar and the note list, so only the note you are writing stays on screen.',
        ],
        keys: { glyphs: '⇧⌘D', spoken: 'Shortcut: Shift Command D' },
      },
      'card-3': {
        label: 'Tables',
        title: 'Tables that keep their shape.',
        body: [
          'Tab moves between cells and shortcuts add, move and align rows and columns, so a Markdown table stays tidy as it grows.',
        ],
        keys: { glyphs: '⇥', spoken: 'Next cell: Tab' },
      },
      'card-4': {
        label: 'Command palette',
        title: 'Every command, a few keys away.',
        body: [
          'Type a few letters to find any command, notebook, tag or note, and change most shortcuts to the keys you prefer.',
        ],
        keys: { glyphs: '⌘K', spoken: 'Shortcut: Command K' },
      },
      'card-5': {
        label: 'Revision History',
        title: 'Go back to an earlier version.',
        body: [
          'Devot saves a version when you pause typing for a minute and keeps every one for a day, then hourly for a week, then daily.',
        ],
        keys: { glyphs: '⌥⌘Y', spoken: 'Shortcut: Option Command Y' },
      },
      'card-6': {
        label: 'Templates',
        title: 'Notes that start filled in.',
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
