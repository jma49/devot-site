import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en, type Messages } from '../../src/i18n/en.ts'
import type { FeatureText } from '../../src/i18n/en/features.ts'
import {
  checkFacts,
  DEVOT_FILES,
  shortcutGlyphs,
  shortcutSpoken,
  type FactCode,
} from '../../scripts/facts/check.ts'
import { annotate, factsReport } from '../../scripts/facts/report.ts'
import {
  devotSource,
  FetchFailure,
  readDevotFiles,
  FactSourceError,
  type Retry,
} from '../../scripts/facts/source.ts'
import { tempDir } from '../support/temp-dirs.ts'

// A Devot that backs every claim the page makes, cut down to the lines the check reads.
const DEVOT: Record<string, string> = {
  'src/renderer/src/commands/registry.ts': `export const COMMANDS = [
  {
    id: 'palette.open',
    label: 'command.palette',
    keys: ['Mod+K'],
    palette: false,
  },
  { id: 'note.newFromTemplate', label: 'command.newFromTemplate', keys: ['Mod+T'] },
  { id: 'note.history', label: 'noteMenu.history', keys: ['Mod+Alt+Y'] },
  { id: 'view.focus', label: 'mode.focus', group: 'view', scope: 'window', keys: ['Mod+Shift+D'] },
  { id: 'view.sort', label: 'command.sort', keys: [] },
  { id: 'table.nextCell', label: 'command.tableNextCell', keys: ['Tab'], palette: false },
]
`,
  'src/core/search.ts': `//   -anything              excludes what the clause matches
const QUALIFIERS = new Map<string, SearchField>([
  ['title', 'title'],
  ['book', 'book'],
  ['tag', 'tag'],
  ['status', 'status'],
])
`,
  'src/core/storage.ts': `export const NOTE_STATUSES = ['none', 'active', 'on_hold', 'completed', 'dropped'] as const\n`,
  'src/core/revisions.ts': `// Versions are local to this device: they are not synced, and carry no HLC.
export const REVISION_PAUSE_MS = 60_000
export const REVISION_EVERY_MS = 10 * 60_000
const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY
    if (age < DAY) return
    const bucket = age < WEEK ? \`h\${Math.floor(revision.at / HOUR)}\` : \`d\${dayOf(revision.at)}\`
`,
  'src/core/templates.ts': `const DATE_FORMATS: Readonly<Record<string, string>> = {
  date: 'YYYY-MM-DD',
  time: 'HH:mm',
}
    if (name === 'title' && format === undefined && context.title !== undefined) {
`,
  'src/renderer/src/i18n/en.ts': `export const en = {
  'status.none': 'No Status',
  'status.active': 'Active',
  'status.on_hold': 'On Hold',
  'status.completed': 'Completed',
  'status.dropped': 'Dropped',
  'noteMenu.history': 'Revision History\\u2026',
  'mode.focus': 'Focus Mode',
  'noteInfo.backlinks': 'Linked to this note',
  'sidebar.templates': 'Templates',
  'command.palette':
    'Command Palette',
  'appearanceSettings.themeIvory': 'Ivory',
  'appearanceSettings.themeDawn': 'Dawn',
  'appearanceSettings.themeTide': 'Tide',
  'appearanceSettings.themeSage': 'Sage',
  'appearanceSettings.themeEmber': 'Ember',
}
`,
  'design/tokens/backdrops.tokens.json': JSON.stringify({
    $description: 'The gradient themes.',
    backdrop: Object.fromEntries([
      ['$type', 'gradient'],
      ...['dawn', 'tide', 'sage', 'ember'].map((name) => [name, { light: {}, dark: {} }]),
    ]),
  }),
  'src-tauri/src/updates.rs': `const FEED_BASE: &str = "https://github.com/jma49/devot/releases/download/updater";
const FIRST_CHECK: Duration = Duration::from_secs(30);
const CHECK_EVERY: Duration = Duration::from_secs(24 * 60 * 60);
/// Betas ship several times a day.
const CHECK_EVERY_BETA: Duration = Duration::from_secs(60 * 60);
`,
  LICENSE:
    'MIT License\n\nCopyright (c) 2026 jma49\n\nPermission is hereby granted, free of charge.\n',
  'src-tauri/tauri.conf.json': JSON.stringify({
    productName: 'Devot',
    bundle: { macOS: { minimumSystemVersion: '26.0' } },
  }),
  '.github/workflows/release.yml': `          cp "$dmg" "out/Devot_\${VERSION}_aarch64.dmg"
          cp "$bundle/macos/Devot.app.tar.gz" "out/Devot_\${VERSION}_aarch64.app.tar.gz"
`,
  'README.md': `## Download
3. The first time, right-click Devot in Applications and choose Open, then Open again. Builds are ad-hoc signed and not notarised, so macOS asks once.
- \`[[\` note links with a link index; each note lists the notes that link to it.
The folder is written by Devot and never read back: edit notes in Devot.
## Claude and other MCP clients (devot-mcp)
devot-mcp runs from a checkout of this repository (requirements in \`docs/development.md\`).
## Contributing
`,
}

const devot = (changes: Record<string, (text: string) => string | undefined> = {}) =>
  new Map(
    Object.entries(DEVOT).flatMap(([path, text]) => {
      const changed = changes[path] ? changes[path](text) : text
      return changed === undefined ? [] : [[path, changed] as const]
    }),
  )

const codes = (problems: { code: FactCode }[]) => [...new Set(problems.map(({ code }) => code))]

describe('checkFacts', () => {
  it('finds nothing wrong when Devot backs every claim on the page', () => {
    expect(checkFacts(devot(), en)).toEqual([])
  })

  it('reads only the files it lists, so a checkout and a download see the same thing', () => {
    expect(Object.keys(DEVOT).toSorted()).toEqual([...DEVOT_FILES].toSorted())
  })

  const replace = (from: string | RegExp, to: string) => (text: string) => {
    const next = text.replace(from, to)
    if (next === text) throw new Error(`fixture has no ${String(from)}`)
    return next
  }

  it.each<[FactCode, string, (text: string) => string | undefined]>([
    [
      'E_FACT_SHORTCUT',
      'src/renderer/src/commands/registry.ts',
      replace("keys: ['Mod+Shift+D']", "keys: ['Mod+Shift+F']"),
    ],
    [
      'E_FACT_SHORTCUT',
      'src/renderer/src/commands/registry.ts',
      replace("{ id: 'note.history', label: 'noteMenu.history', keys: ['Mod+Alt+Y'] },", ''),
    ],
    ['E_FACT_OPERATOR', 'src/core/search.ts', replace("['book', 'book'],", '')],
    ['E_FACT_OPERATOR', 'src/core/search.ts', replace('-anything', 'anything')],
    ['E_FACT_STATUS', 'src/renderer/src/i18n/en.ts', replace("'On Hold'", "'Paused'")],
    ['E_FACT_STATUS', 'src/core/storage.ts', replace("'dropped'", "'dropped', 'waiting'")],
    [
      'E_FACT_THEME',
      'src/renderer/src/i18n/en.ts',
      replace("themeSage': 'Sage'", "themeSage': 'Moss'"),
    ],
    [
      'E_FACT_THEME',
      'design/tokens/backdrops.tokens.json',
      replace(
        '"ember":{"light":{},"dark":{}}',
        '"ember":{"light":{},"dark":{}},"dusk":{"light":{}}',
      ),
    ],
    [
      'E_FACT_LABEL',
      'src/renderer/src/i18n/en.ts',
      replace("'Linked to this note'", "'Backlinks'"),
    ],
    ['E_FACT_LABEL', 'src/renderer/src/i18n/en.ts', replace("'Focus Mode'", "'Zen Mode'")],
    ['E_FACT_LINKS', 'README.md', replace('`[[` note links', 'Note links')],
    ['E_FACT_PLACEHOLDER', 'src/core/templates.ts', replace("date: 'YYYY-MM-DD',", '')],
    ['E_FACT_UPDATES', 'src-tauri/src/updates.rs', replace('from_secs(30)', 'from_secs(60)')],
    ['E_FACT_UPDATES', 'src-tauri/src/updates.rs', replace('24 * 60 * 60', '7 * 24 * 60 * 60')],
    [
      'E_FACT_UPDATES',
      'src-tauri/src/updates.rs',
      replace('from_secs(60 * 60)', 'from_secs(4 * 60 * 60)'),
    ],
    [
      'E_FACT_UPDATES',
      'src-tauri/src/updates.rs',
      replace('https://github.com/', 'https://updates.example/'),
    ],
    ['E_FACT_LICENCE', 'LICENSE', replace('MIT License', 'Apache License')],
    ['E_FACT_LICENCE', 'LICENSE', replace('2026 jma49', '2026 Someone Else')],
    ['E_FACT_PLATFORM', 'src-tauri/tauri.conf.json', replace('"26.0"', '"27.0"')],
    ['E_FACT_RELEASE', '.github/workflows/release.yml', replace('_aarch64.dmg', '_universal.dmg')],
    [
      'E_FACT_RELEASE',
      '.github/workflows/release.yml',
      (text) => `${text}          cp "$x64" "out/Devot_\${VERSION}_x86_64.dmg"\n`,
    ],
    ['E_FACT_SIGNING', 'README.md', replace('ad-hoc signed and not notarised', 'notarised')],
    ['E_FACT_SIGNING', 'README.md', replace('so macOS asks once', 'so macOS warns you')],
    [
      'E_FACT_SIGNING',
      'README.md',
      replace('right-click Devot in Applications and choose Open', 'open Devot'),
    ],
    ['E_FACT_ANCHOR', 'README.md', replace('## Download', '## Get Devot')],
    ['E_FACT_ANCHOR', 'README.md', replace('## Contributing', '## Helping out')],
    [
      'E_FACT_REVISIONS',
      'src/core/revisions.ts',
      replace('PAUSE_MS = 60_000', 'PAUSE_MS = 120_000'),
    ],
    [
      'E_FACT_REVISIONS',
      'src/core/revisions.ts',
      replace('age < DAY) return', 'age < HOUR) return'),
    ],
    ['E_FACT_REVISIONS', 'src/core/revisions.ts', replace('WEEK = 7 * DAY', 'WEEK = 30 * DAY')],
    [
      'E_FACT_REVISIONS',
      'src/core/revisions.ts',
      replace('`h${Math.floor(revision.at / HOUR)}`', '`d${dayOf(revision.at)}`'),
    ],
    [
      'E_FACT_REVISIONS',
      'src/core/revisions.ts',
      replace('`d${dayOf(revision.at)}`', '`w${Math.floor(revision.at / WEEK)}`'),
    ],
    [
      'E_FACT_REVISIONS',
      'src/core/revisions.ts',
      replace('local to this device', 'synced to every device'),
    ],
    ['E_FACT_MIRROR', 'README.md', replace('never read back', 'read back')],
    ['E_FACT_MCP', 'README.md', replace('runs from a checkout', 'ships inside the app')],
    ['E_FACT_SOURCE', 'src/core/search.ts', () => undefined],
  ])('%s when %s no longer backs the page', (code, path, change) => {
    const problems = checkFacts(devot({ [path]: change }), en)
    expect(codes(problems)).toEqual([code])
    for (const problem of problems) {
      expect(problem.message.startsWith(`${code} `), problem.message).toBe(true)
    }
  })

  // structuredClone refuses the catalog's message functions, so they are shared, not copied.
  const cloneCopy = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(cloneCopy)
    if (value === null || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneCopy(item)]))
  }
  const withCopy = (change: (copy: Messages) => void): Messages => {
    const copy = cloneCopy(en) as Messages
    change(copy)
    return copy
  }

  it('E_FACT_SHORTCUT when a card shows keys the check cannot trace to a command', () => {
    const copy = withCopy((c) => {
      ;(c.cards.items['card-1'] as { keys?: unknown }).keys = { glyphs: '⌘J', spoken: 'Command J' }
    })
    const problems = checkFacts(devot(), copy)
    expect(problems.map(({ message }) => message)).toEqual([
      expect.stringMatching(/^E_FACT_SHORTCUT card-1 /),
    ])
  })

  it('E_FACT_SHORTCUT when a card says the keys in other words than it draws them', () => {
    const copy = withCopy((c) => {
      c.cards.items['card-2'].keys = { glyphs: '⇧⌘D', spoken: 'Shortcut: Command D' }
    })
    expect(codes(checkFacts(devot(), copy))).toEqual(['E_FACT_SHORTCUT'])
  })

  it('E_FACT_OPERATOR when the page names a search operator Devot does not have', () => {
    const copy = withCopy((c) => {
      const find = c.features.items.find((item) => item.slot === 'find')
      ;(find?.body as FeatureText[] | undefined)?.push({ code: 'folder:' })
    })
    expect(codes(checkFacts(devot(), copy))).toEqual(['E_FACT_OPERATOR'])
  })

  it.each<[string, (copy: Messages) => void, FactCode[]]>([
    [
      'the closing install note',
      (c) => (c.closing.installNote = 'Download, open and write.'),
      ['E_FACT_STALE'],
    ],
    [
      'the note under the download buttons',
      (c) => (c.install.note = ['Download, open and write.']),
      ['E_FACT_STALE'],
    ],
    [
      'the Revision History card',
      (c) => (c.cards.items['card-5'].body = ['Devot keeps notes.']),
      ['E_FACT_STALE', 'E_FACT_REVISIONS'],
    ],
  ])('E_FACT_STALE when %s stops saying what a check expects', (_, change, expected) => {
    expect(codes(checkFacts(devot(), withCopy(change)))).toEqual(expected)
  })

  it('E_FACT_REVISIONS when the card promises more than compaction keeps', () => {
    const copy = withCopy((c) => {
      c.cards.items['card-5'].body = [
        'Devot saves a version when you pause typing for a minute and keeps every one for a day, then hourly for a month, then daily.',
      ]
    })
    expect(checkFacts(devot(), copy).map(({ message }) => message)).toEqual([
      expect.stringMatching(/^E_FACT_REVISIONS .*"then hourly for a week"/),
    ])
  })

  it('reports no missing file for the downloads that could not be reached', () => {
    const files = devot({ LICENSE: () => undefined })
    expect(checkFacts(files, en, ['LICENSE'])).toEqual([])
    expect(codes(checkFacts(files, en))).toEqual(['E_FACT_SOURCE'])
  })
})

describe('factsReport', () => {
  it('passes with one warning naming the skipped checks when GitHub cannot be reached', () => {
    const report = factsReport({ files: new Map(), unreachable: [...DEVOT_FILES] }, en)
    expect(report.errors).toEqual([])
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]).toMatch(/^W_FACT_UNREACHABLE /)
    expect(report.warnings[0]).toContain('E_FACT_SHORTCUT')
    expect(report.warnings[0]).toContain('E_FACT_REVISIONS')
    expect(report.warnings[0]).toContain('LICENSE')
  })

  it('still fails on a real mismatch in the files it could read', () => {
    const files = devot({
      LICENSE: (text) => text.replace('MIT License', 'Apache License'),
      'src/core/search.ts': () => undefined,
    })
    const report = factsReport({ files, unreachable: ['src/core/search.ts'] }, en)
    expect(report.errors).toEqual([expect.stringMatching(/^E_FACT_LICENCE /)])
    expect(report.warnings).toEqual([
      expect.stringMatching(/^W_FACT_UNREACHABLE .*E_FACT_OPERATOR/),
    ])
    expect(report.warnings[0]).not.toContain('E_FACT_LICENCE')
  })

  it('has nothing to say when every file arrived and every fact holds', () => {
    expect(factsReport({ files: devot(), unreachable: [] }, en)).toEqual({
      errors: [],
      warnings: [],
    })
  })

  it('turns a warning into a GitHub Actions annotation in CI only', () => {
    expect(annotate('W_FACT_UNREACHABLE x', { GITHUB_ACTIONS: 'true' })).toBe(
      '::warning title=pnpm facts::W_FACT_UNREACHABLE x',
    )
    expect(annotate('W_FACT_UNREACHABLE x', {})).toBe('W_FACT_UNREACHABLE x')
  })
})

describe('shortcut names', () => {
  it('draws keys in the order the Mac menus use', () => {
    expect(shortcutGlyphs('Mod+Shift+D')).toBe('⇧⌘D')
    expect(shortcutGlyphs('Mod+Alt+Y')).toBe('⌥⌘Y')
    expect(shortcutGlyphs('Mod+Ctrl+F')).toBe('⌃⌘F')
    expect(shortcutGlyphs('Tab')).toBe('⇥')
  })

  it('says keys in the same order, in words', () => {
    expect(shortcutSpoken('Mod+Shift+D')).toBe('Shift Command D')
    expect(shortcutSpoken('Mod+Alt+Y')).toBe('Option Command Y')
    expect(shortcutSpoken('Tab')).toBe('Tab')
  })
})

describe('devotSource', () => {
  const SHA = 'c'.repeat(40)
  const site = () => {
    const root = tempDir('facts-site-')
    writeFileSync(join(root, 'devot.pin.json'), JSON.stringify({ commit: SHA }))
    return root
  }

  it('reads the checkout DEVOT_CHECKOUT names', () => {
    expect(devotSource({ DEVOT_CHECKOUT: '/src/devot' }, site())).toEqual({
      kind: 'checkout',
      dir: '/src/devot',
    })
  })

  it('reads the pinned commit from the media cache when the capture has cloned it', () => {
    const root = site()
    const dir = join(root, '.cache/media/devot', SHA)
    mkdirSync(dir, { recursive: true })
    expect(devotSource({}, root)).toEqual({ kind: 'checkout', dir, commit: SHA })
  })

  it('downloads the pinned commit otherwise', () => {
    expect(devotSource({}, site())).toEqual({ kind: 'github', commit: SHA })
  })

  it('fails with E_FACT_PIN when the pin is not a commit', () => {
    const root = tempDir('facts-site-')
    writeFileSync(join(root, 'devot.pin.json'), '{"commit": "main"}')
    expect(() => devotSource({}, root)).toThrow(/^E_FACT_PIN /)
  })
})

describe('readDevotFiles', () => {
  it('reads the listed files a checkout has, and leaves out the ones it lacks', async () => {
    const dir = tempDir('facts-devot-')
    writeFileSync(join(dir, 'LICENSE'), 'MIT License\n')
    const read = await readDevotFiles({ kind: 'checkout', dir }, async () => '')
    expect([...read.files]).toEqual([['LICENSE', 'MIT License\n']])
    expect(read.unreachable).toEqual([])
  })

  it('downloads the listed files at the pinned commit', async () => {
    const urls: string[] = []
    const read = await readDevotFiles({ kind: 'github', commit: 'c'.repeat(40) }, async (url) => {
      urls.push(url)
      return `body of ${url.split('/').pop()}`
    })
    expect(urls).toHaveLength(DEVOT_FILES.length)
    expect(urls[0]).toMatch(/^https:\/\/raw\.githubusercontent\.com\/jma49\/devot\/c{40}\//)
    expect(read.files.get('LICENSE')).toBe('body of LICENSE')
  })

  const github = { kind: 'github', commit: 'c'.repeat(40) } as const
  const retry = (): Retry & { waits: number[] } => {
    const waits: number[] = []
    return { attempts: 4, firstDelayMs: 1000, wait: async (ms) => void waits.push(ms), waits }
  }

  it('fails at once with E_FACT_FETCH when the pinned commit lacks a file', async () => {
    let calls = 0
    const policy = retry()
    const failing = readDevotFiles(
      github,
      async () => {
        calls += 1
        throw new FetchFailure('HTTP 404', false)
      },
      policy,
    )
    await expect(failing).rejects.toThrow(FactSourceError)
    await expect(failing).rejects.toThrow(/^E_FACT_FETCH .*HTTP 404/)
    expect(policy.waits).toEqual([])
    expect(calls).toBe(DEVOT_FILES.length)
  })

  it('tries a failed download again, waiting twice as long each time', async () => {
    const policy = retry()
    let licenceTries = 0
    const read = await readDevotFiles(
      github,
      async (url) => {
        if (url.endsWith('/LICENSE') && ++licenceTries < 3) throw new FetchFailure('HTTP 503', true)
        return 'text'
      },
      policy,
    )
    expect(read.unreachable).toEqual([])
    expect(read.files.get('LICENSE')).toBe('text')
    expect(licenceTries).toBe(3)
    expect(policy.waits).toEqual([1000, 2000])
  })

  it('lists a file as unreachable after the last try when the connection keeps failing', async () => {
    const policy = retry()
    const read = await readDevotFiles(
      github,
      async (url) => {
        if (url.endsWith('/LICENSE')) throw new TypeError('fetch failed')
        return 'text'
      },
      policy,
    )
    expect(read.unreachable).toEqual(['LICENSE'])
    expect(read.files.has('LICENSE')).toBe(false)
    expect(read.files.size).toBe(DEVOT_FILES.length - 1)
    expect(policy.waits).toEqual([1000, 2000, 4000])
  })
})
