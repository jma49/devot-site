import { capitalised, numberWord } from '../../lib/words.ts'
import { TRIAL_DAYS } from '../../site.ts'

const trial = `${numberWord(TRIAL_DAYS)}-day free trial`

export const chromeCopy = {
  meta: {
    title: 'Devot: local-first Markdown notes app for Mac and iPhone',
    description: `Devot is a local-first Markdown notes app for Mac and iPhone: end-to-end encrypted sync with no subscription, search by meaning on your device, AI edits you review, plugins and themes. Offline, no account, source-available. A ${trial}, then pay once.`,
    ogLocale: 'en_US',
    imageAlt:
      'The Devot window on a soft blue gradient: notebooks, statuses and tags in the sidebar, a list of notes, and an open note.',
  },
  notFound: {
    title: 'Devot: page not found',
    description: 'There is no page at this address on devot.online.',
    heading: 'Page not found',
    body: 'The link may be out of date, or the address may have a typo.',
    home: 'Go to the home page',
  },
  chrome: {
    skipLink: 'Skip to content',
    home: 'Devot home',
    navLabel: 'Main',
    menu: 'Menu',
    pause: 'Pause animations',
    /** How this language names itself, for the switch on the other languages' pages. */
    language: { name: 'English' },
    nav: {
      write: 'Features',
      cards: 'More features',
      iphone: 'iPhone',
      localFirst: 'Local-first',
      pricing: 'Pricing',
      download: 'Download',
      source: 'GitHub',
    },
    downloadNote: capitalised(trial),
  },
}
