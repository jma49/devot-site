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
    'Devot and Obsidian side by side: price, sync, where your notes live, platforms and source code, with a source for every fact about Obsidian.',
  heading: 'Devot and Obsidian compared',
  intro:
    'Both keep Markdown notes on your own device and work offline. Obsidian is free and runs everywhere, with paid sync; Devot is a Mac and iPhone app you pay for once, with encrypted sync and AI access included.',
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
    'Devot and Bear side by side: price, subscription or one-time purchase, sync, encryption and platforms, with a source for every fact about Bear.',
  heading: 'Devot and Bear compared',
  intro:
    'Both are Markdown notes apps for Apple devices that need no account. Bear Pro is a subscription that adds sync; Devot is paid for once, and sync is end-to-end encrypted.',
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
  title: 'Devot vs Apple Notes: when to use a Markdown notes app · Devot',
  description:
    'Devot and Apple Notes side by side: Markdown, sync, price and what each is for, with a source for every fact about Apple Notes.',
  heading: 'Devot and Apple Notes compared',
  intro:
    'Apple Notes comes free with every Mac and iPhone and is hard to beat for quick notes. Devot is for notes you write in Markdown and keep for years, with statuses, revision history, plugins and AI access you control.',
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
          ['You draw or scan documents into notes, or share notes with others.'],
        ),
      ],
    },
    moving,
    sourcesSection({ sources: appleNotesSources }),
  ],
}

const notionSources = [{ text: 'Notion pricing', href: 'https://www.notion.com/pricing' }]

const notion: ComparePage = {
  slug: 'notion',
  other: 'Notion',
  title: 'Devot vs Notion: local notes or a cloud workspace · Devot',
  description:
    'Devot and Notion side by side: where your notes live, accounts, offline use, price and databases, with a source for every fact about Notion.',
  heading: 'Devot and Notion compared',
  intro:
    'Notion is a cloud workspace for teams, with pages and databases. Devot is a personal Markdown notes app that keeps everything on your device, needs no account and works fully offline.',
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
    sourcesSection({ sources: notionSources }),
  ],
}

export const compareCopy = {
  compare: {
    index: {
      title: 'Devot: how it compares with other notes apps',
      description:
        'How Devot compares with Obsidian, Bear, Apple Notes and Notion on price, sync, privacy and platforms, each fact with its source.',
      heading: 'Compare',
      intro:
        'Devot beside other notes apps, fairly: what each does better, from facts their makers publish.',
      listLabel: 'Comparisons',
    },
    allComparisons: 'All comparisons',
    pages: [obsidian, bear, appleNotes, notion] satisfies ComparePage[],
  },
}
