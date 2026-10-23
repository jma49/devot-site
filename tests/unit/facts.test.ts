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
import { devotSource, readDevotFiles, FactSourceError } from '../../scripts/facts/source.ts'
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
  'README.md': `3. The first time, right-click Devot. Builds are ad-hoc signed and not notarised, so macOS asks once.
- \`[[\` note links with a link index; each note lists the notes that link to it.
The folder is written by Devot and never read back: edit notes in Devot.
devot-mcp runs from a checkout of this repository (requirements in \`docs/development.md\`).
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

  const withCopy = (change: (copy: Messages) => void): Messages => {
    const copy = structuredClone({ ...en, footer: { ...en.footer, copyright: undefined } })
    change(copy as unknown as Messages)
    return { ...copy, footer: { ...copy.footer, copyright: en.footer.copyright } } as Messages
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

  it('E_FACT_STALE when the page stops saying what a check expects', () => {
    const copy = withCopy((c) => {
      c.closing.installNote = 'Download, open and start writing.'
    })
    expect(codes(checkFacts(devot(), copy))).toEqual(['E_FACT_STALE'])
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
    const files = await readDevotFiles({ kind: 'checkout', dir }, async () => '')
    expect([...files]).toEqual([['LICENSE', 'MIT License\n']])
  })

  it('downloads the listed files at the pinned commit', async () => {
    const urls: string[] = []
    const files = await readDevotFiles({ kind: 'github', commit: 'c'.repeat(40) }, async (url) => {
      urls.push(url)
      return `body of ${url.split('/').pop()}`
    })
    expect(urls).toHaveLength(DEVOT_FILES.length)
    expect(urls[0]).toMatch(/^https:\/\/raw\.githubusercontent\.com\/jma49\/devot\/c{40}\//)
    expect(files.get('LICENSE')).toBe('body of LICENSE')
  })

  it('fails with E_FACT_FETCH when a download fails', async () => {
    const failing = readDevotFiles({ kind: 'github', commit: 'c'.repeat(40) }, async () => {
      throw new Error('HTTP 503')
    })
    await expect(failing).rejects.toThrow(FactSourceError)
    await expect(failing).rejects.toThrow(/^E_FACT_FETCH .*HTTP 503/)
  })
})
