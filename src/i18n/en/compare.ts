import type { DocBlock, DocPage, DocRun } from './docs.ts'
import { numberWord } from '../../lib/words.ts'
import { IPHONE_OS, IPHONE_PRICE, LICENCE_PRICE, PLATFORM, TRIAL_DAYS } from '../../site.ts'

/** A page that sets Devot beside another notes app, from facts that app's own pages state. */
export interface ComparePage extends DocPage {
  /** The other app, as its makers write its name. */
  other: string
  /** ISO date its facts were last checked against the sources the page lists. */
  checked: string
  /** The same date as the page shows it. */
  checkedLabel: string
  /** The pages the other app's facts come from, all on its makers' own sites or its store listing. */
  sources: { text: string; href: string }[]
}

const CHECKED = '2026-11-17'
const CHECKED_LABEL = 'Facts checked 17 November 2026'

const text = (...runs: DocRun[]): DocBlock => ({ kind: 'text', runs })
const list = (...items: DocRun[][]): DocBlock => ({ kind: 'list', items })
const table = (other: string, rows: [string, string, string][]): DocBlock => ({
  kind: 'table',
  caption: `Devot and ${other} side by side`,
  head: ['', 'Devot', other],
  rows: rows.map((row) => row.map((cell) => [cell])),
})

const devot = {
  price: `A ${numberWord(TRIAL_DAYS)}-day trial, then ${LICENCE_PRICE} once on the Mac or ${IPHONE_PRICE} once on the iPhone; either unlocks both`,
  sync: 'Included, end-to-end encrypted, through your own iCloud or a relay you deploy',
  storage:
    'A database on your device, with an optional folder of Markdown files kept in step both ways',
  platforms: `Mac (${PLATFORM.os}, ${PLATFORM.processor}) and iPhone (${IPHONE_OS})`,
  account: 'None',
  source: 'Public, under FSL-1.1-MIT',
}

const sourcesSection = (page: {
  sources: ComparePage['sources']
}): DocPage['sections'][number] => ({
  id: 'sources',
  title: 'Sources',
  blocks: [
    text(
      `Facts about other apps come from their makers' pages, read on 17 November 2026; prices are in US dollars and may differ by country. Devot's own facts are checked against its source.`,
    ),
    list(...page.sources.map((source) => [source])),
  ],
})

const asked = (items: [string, string][]): DocPage['sections'][number] => ({
  id: 'questions',
  title: 'Questions',
  blocks: [
    {
      kind: 'faq',
      items: items.map(([question, answer]) => ({ question, answer: [answer] })),
    },
  ],
})

const moving: DocPage['sections'][number] = {
  id: 'move',
  title: 'Bring your notes',
  blocks: [
    text(
      'Devot imports Markdown files, a Markdown folder with its images, HTML, a Notion Markdown export and Bear TextBundles. ',
      { text: 'Import and export', href: '/docs/import-export' },
      ' lists what each brings over. Export always works, so you can leave as easily.',
    ),
  ],
}

const obsidianSources = [
  { text: 'Obsidian pricing', href: 'https://obsidian.md/pricing' },
  { text: 'Obsidian licence', href: 'https://obsidian.md/license' },
  { text: 'Obsidian home page', href: 'https://obsidian.md/' },
  { text: 'Download and install Obsidian', href: 'https://obsidian.md/help/install' },
]

const obsidian: ComparePage = {
  slug: 'obsidian',
  other: 'Obsidian',
  title: 'Devot vs Obsidian: local Markdown notes compared · Devot',
  description:
    'An Obsidian alternative on Mac and iPhone: price, sync, where notes live, platforms and source, with a source for every Obsidian fact.',
  heading: 'Devot and Obsidian compared',
  intro:
    'Pick Obsidian if you want a free app on Windows, Linux and Android, or a large catalogue of community plugins. Pick Devot if you want encrypted sync included on Mac and iPhone, an MCP server and public source.',
  summary: 'Free and everywhere, or paid once with sync included.',
  checked: CHECKED,
  checkedLabel: CHECKED_LABEL,
  sources: obsidianSources,
  sections: [
    {
      id: 'glance',
      title: 'At a glance',
      blocks: [
        table('Obsidian', [
          ['Price', devot.price, 'Free for personal and commercial use'],
          [
            'Sync',
            devot.sync,
            'Obsidian Sync, end-to-end encrypted: US$4 a user a month billed yearly, or US$5 monthly',
          ],
          [
            'Where notes live',
            devot.storage,
            'Plain-text Markdown files in a folder on your device',
          ],
          ['Platforms', devot.platforms, 'Windows, macOS, Linux, Android, iPhone and iPad'],
          ['Source code', devot.source, 'Not public'],
        ]),
      ],
    },
    {
      id: 'devot',
      title: 'When Devot fits',
      blocks: [
        list(
          [
            'You want sync without a subscription: Devot syncs end-to-end encrypted through your own iCloud or relay, at no extra cost.',
          ],
          [
            'You use Claude Code, Codex or another MCP client: Devot has an MCP server built in, and each notebook decides whether AI tools may read it.',
          ],
          [
            'You want to read the source, or build the app yourself: every feature works in a build from source.',
          ],
          [
            'You work on a Mac and an iPhone and want one app shaped for them, with statuses, revision history and fast search.',
          ],
        ),
      ],
    },
    {
      id: 'other',
      title: 'When Obsidian fits',
      blocks: [
        list(
          ['You use Windows, Linux or Android: Devot runs only on the Mac and the iPhone.'],
          ['You want to pay nothing and do not need sync, or already sync a folder another way.'],
          [
            'You rely on a large catalogue of community plugins and themes; Devot has a smaller set of sandboxed plugins.',
          ],
        ),
      ],
    },
    moving,
    asked([
      [
        'Is Obsidian free?',
        'Obsidian is free for personal and commercial use. Obsidian Sync is separate: US$4 a user a month billed yearly, or US$5 monthly. Devot includes end-to-end encrypted sync through your own iCloud or a relay you deploy.',
      ],
      [
        'Where does Obsidian run that Devot does not?',
        `Obsidian runs on Windows, macOS, Linux, Android, iPhone and iPad. Devot runs on Mac (${PLATFORM.os}, ${PLATFORM.processor}) and iPhone (${IPHONE_OS}).`,
      ],
      [
        'Can I bring an Obsidian vault into Devot?',
        'Devot imports Markdown files and a Markdown folder with its images. Export always works, so you can leave as easily.',
      ],
    ]),
    sourcesSection({ sources: obsidianSources }),
  ],
}

const bearSources = [
  {
    text: 'Bear in the App Store',
    href: 'https://apps.apple.com/us/app/bear-markdown-notes-journal/id1016366447',
  },
]

const bear: ComparePage = {
  slug: 'bear',
  other: 'Bear',
  title: 'Devot vs Bear: Markdown notes for Mac and iPhone · Devot',
  description:
    'A Bear alternative you pay for once: price, sync, encryption and platforms, with a source for every fact about Bear.',
  heading: 'Devot and Bear compared',
  intro:
    'Pick Bear if you want Apple Watch, Apple Vision Pro, or DocX and ePub export. Pick Devot if you would rather pay once for end-to-end encrypted sync, with an MCP server and public source.',
  summary: 'A subscription for sync, or one purchase with encrypted sync.',
  checked: CHECKED,
  checkedLabel: CHECKED_LABEL,
  sources: bearSources,
  sections: [
    {
      id: 'glance',
      title: 'At a glance',
      blocks: [
        table('Bear', [
          ['Price', devot.price, 'Free app; Bear Pro is US$2.99 a month or US$29.99 a year'],
          ['Sync', devot.sync, 'Through iCloud between iPhone, iPad and Mac, with Bear Pro'],
          [
            'Encryption',
            'Sync is end-to-end encrypted',
            'Single notes can be locked with a password, with Bear Pro',
          ],
          ['Platforms', devot.platforms, 'Mac, iPhone and iPad'],
          ['Account', devot.account, 'None'],
        ]),
      ],
    },
    {
      id: 'devot',
      title: 'When Devot fits',
      blocks: [
        list(
          ['You would rather pay once than renew every year.'],
          [
            'You want your synced notes end-to-end encrypted, or synced through a relay of your own instead of iCloud.',
          ],
          ['You use AI tools over MCP: Devot has a server built in, with access set per notebook.'],
          ['You want to read the source, or build the app yourself.'],
        ),
      ],
    },
    {
      id: 'other',
      title: 'When Bear fits',
      blocks: [
        list(
          ['You want your notes on an Apple Watch or Apple Vision Pro as well.'],
          ['You need exports such as DocX or ePub.'],
          ['You want the app free on one device and no sync.'],
        ),
      ],
    },
    moving,
    asked([
      [
        'How do the prices differ?',
        `${devot.price}. Bear is a free app; Bear Pro is US$2.99 a month or US$29.99 a year, and sync needs Bear Pro.`,
      ],
      [
        'How does sync differ?',
        'Devot sync is end-to-end encrypted, through your own iCloud or a relay you deploy. Bear syncs through iCloud between iPhone, iPad and Mac, with Bear Pro. Single notes can be locked with a password, with Bear Pro.',
      ],
      [
        'When is Bear the better fit?',
        'When you want notes on an Apple Watch or Apple Vision Pro, exports such as DocX or ePub, or the app free on one device and no sync.',
      ],
    ]),
    sourcesSection({ sources: bearSources }),
  ],
}

const appleNotesSources = [
  { text: 'Notes User Guide for Mac', href: 'https://support.apple.com/guide/notes/welcome/mac' },
  {
    text: 'Import, export and print notes on Mac',
    href: 'https://support.apple.com/guide/notes/import-export-and-print-notes-not201900c07/mac',
  },
]

const appleNotes: ComparePage = {
  slug: 'apple-notes',
  other: 'Apple Notes',
  title: 'Devot vs Apple Notes: Markdown or built-in notes · Devot',
  description:
    'An Apple Notes alternative for Markdown: sync, price and what each is for, with a source for every fact about Apple Notes.',
  heading: 'Devot and Apple Notes compared',
  intro:
    'Pick Apple Notes if you want free notes already on every Mac and iPhone, including drawings in the note. Pick Devot if you want notes kept as Markdown, with statuses, revision history and encrypted sync.',
  summary: 'Free and built in, or Markdown first with more control.',
  checked: CHECKED,
  checkedLabel: CHECKED_LABEL,
  sources: appleNotesSources,
  sections: [
    {
      id: 'glance',
      title: 'At a glance',
      blocks: [
        table('Apple Notes', [
          ['Price', devot.price, 'Free, built into the Mac, iPhone and iPad'],
          [
            'Markdown',
            'Written and kept as Markdown, with a live preview',
            'Imports Markdown files, and exports or copies notes as Markdown',
          ],
          ['Sync', devot.sync, 'Through iCloud or another account, such as Google'],
          ['Platforms', devot.platforms, 'Mac, iPhone and iPad'],
          ['Source code', devot.source, 'Not public'],
        ]),
      ],
    },
    {
      id: 'devot',
      title: 'When Devot fits',
      blocks: [
        list(
          ['You write in Markdown and want it as Markdown, not converted on the way in and out.'],
          [
            'You keep notes for the long run: nested notebooks, tags, statuses, revision history and search with operators.',
          ],
          ['You want AI tools to read some notebooks and not others, over MCP.'],
          ['You want sync that is end-to-end encrypted by design.'],
        ),
      ],
    },
    {
      id: 'other',
      title: 'When Apple Notes fits',
      blocks: [
        list(
          ['You want quick notes that cost nothing and are already on every device.'],
          ['You can draw in a note.'],
        ),
      ],
    },
    moving,
    asked([
      [
        'What does Apple Notes cost?',
        `It is free, built into the Mac, iPhone and iPad. Devot: ${devot.price}.`,
      ],
      [
        'Do both keep notes as Markdown?',
        'Devot writes and keeps notes as Markdown, with a live preview. Apple Notes imports Markdown files, and exports or copies notes as Markdown.',
      ],
      [
        'How does sync differ?',
        'Devot syncs end-to-end encrypted through your own iCloud or a relay you deploy. Apple Notes syncs through iCloud or another account, such as Google.',
      ],
    ]),
    sourcesSection({ sources: appleNotesSources }),
  ],
}

const notionSources = [{ text: 'Notion pricing', href: 'https://www.notion.com/pricing' }]

const notion: ComparePage = {
  slug: 'notion',
  other: 'Notion',
  title: 'Devot vs Notion: local notes or a cloud workspace · Devot',
  description:
    'A Notion alternative for notes on your device: accounts, offline use and price, with a source for every fact about Notion.',
  heading: 'Devot and Notion compared',
  intro:
    'Pick Notion if you share pages with a team, or need databases on Windows, Android or the web. Pick Devot if your notes stay on your device and you would rather pay once.',
  summary: 'A shared cloud workspace, or private notes on your device.',
  checked: CHECKED,
  checkedLabel: CHECKED_LABEL,
  sources: notionSources,
  sections: [
    {
      id: 'glance',
      title: 'At a glance',
      blocks: [
        table('Notion', [
          ['Price', devot.price, 'Free plan; Plus is US$10 a seat a month'],
          ['Where notes live', devot.storage, 'In your Notion workspace, after you sign up'],
          ['Offline', 'Every feature works offline', 'Offline use in the desktop and mobile apps'],
          ['Format', 'Markdown', 'Pages and databases, with Markdown export'],
          ['Account', devot.account, 'Sign up to start'],
        ]),
      ],
    },
    {
      id: 'devot',
      title: 'When Devot fits',
      blocks: [
        list(
          ['Your notes are personal and you want them on your device, not in a workspace.'],
          [
            'You want Markdown files too: the mirror folder keeps every note as one, for Git or other editors.',
          ],
          ['You want to pay once instead of per seat each month.'],
          ['You want AI tools to see only the notebooks you choose, through MCP on your Mac.'],
        ),
      ],
    },
    {
      id: 'other',
      title: 'When Notion fits',
      blocks: [
        list(
          ['You work with a team in shared pages.'],
          [
            "You build databases with views and relations; Devot's Note Query plugin lists notes by tag, status and dates, but is no database.",
          ],
          ['You need it on Windows, Android or the web.'],
        ),
      ],
    },
    moving,
    asked([
      [
        'Where do the notes live?',
        'Devot keeps a database on your device, with an optional folder of Markdown files kept in step both ways, and needs no account. Notion keeps pages in your workspace after you sign up.',
      ],
      [
        'What does Notion cost?',
        `Notion has a free plan; Plus is US$10 a seat a month. Devot: ${devot.price}.`,
      ],
      [
        'When is Notion the better fit?',
        "When you work with a team in shared pages, build databases with views and relations, or need Windows, Android or the web. Devot's Note Query plugin lists notes by tag, status and dates, but is no database.",
      ],
    ]),
    sourcesSection({ sources: notionSources }),
  ],
}

export const compareCopy = {
  compare: {
    index: {
      title: 'Devot: how it compares with other notes apps',
      description:
        'Devot compared with Obsidian, Bear, Apple Notes and Notion: price, sync, privacy and platforms, each fact with its source.',
      heading: 'Compare',
      intro:
        'Devot beside other notes apps, fairly: what each does better, from facts their makers publish.',
      listLabel: 'Comparisons',
    },
    allComparisons: 'All comparisons',
    pages: [obsidian, bear, appleNotes, notion] satisfies ComparePage[],
  },
}
