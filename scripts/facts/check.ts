import type { CardText } from '../../src/i18n/en/cards.ts'
import type { NoteText } from '../../src/i18n/en/hero.ts'
import type { Messages } from '../../src/i18n/en.ts'
import { footerLinks, INSTALL_URL } from '../../src/lib/links.ts'
import { REPO_URL } from '../../src/site.ts'

export type FactCode =
  | 'E_FACT_SOURCE'
  | 'E_FACT_STALE'
  | 'E_FACT_SHORTCUT'
  | 'E_FACT_OPERATOR'
  | 'E_FACT_LINKS'
  | 'E_FACT_LABEL'
  | 'E_FACT_STATUS'
  | 'E_FACT_THEME'
  | 'E_FACT_PLACEHOLDER'
  | 'E_FACT_UPDATES'
  | 'E_FACT_LICENCE'
  | 'E_FACT_PLATFORM'
  | 'E_FACT_RELEASE'
  | 'E_FACT_SIGNING'
  | 'E_FACT_MIRROR'
  | 'E_FACT_MCP'
  | 'E_FACT_REVISIONS'
  | 'E_FACT_ANCHOR'
  | 'E_FACT_TRIAL'

export interface FactProblem {
  code: FactCode
  message: string
}

/** Devot's files, by repository path; a file the source lacks is simply absent. */
export type DevotFiles = ReadonlyMap<string, string>

const REGISTRY = 'src/renderer/src/commands/registry.ts'
const SEARCH = 'src/core/search.ts'
const STORAGE = 'src/core/storage.ts'
const TEMPLATES = 'src/core/templates.ts'
const REVISIONS = 'src/core/revisions.ts'
const STRINGS = 'src/renderer/src/i18n/en.ts'
const BACKDROPS = 'design/tokens/backdrops.tokens.json'
const UPDATES = 'src-tauri/src/updates.rs'
const LICENSE = 'LICENSE'
const TAURI = 'src-tauri/tauri.conf.json'
const RELEASE = '.github/workflows/release.yml'
const README = 'README.md'
const TRIAL = 'src-tauri/src/licence/trial.rs'
const ENTITLEMENTS = 'src/core/entitlements.ts'

export const DEVOT_FILES = [
  REGISTRY,
  SEARCH,
  STORAGE,
  TEMPLATES,
  REVISIONS,
  STRINGS,
  BACKDROPS,
  UPDATES,
  LICENSE,
  TAURI,
  RELEASE,
  README,
  TRIAL,
  ENTITLEMENTS,
] as const

type CardSlot = keyof Messages['cards']['items']

// The registry command behind each card's keys; a card that shows keys must be listed here.
const CARD_COMMANDS: Partial<Record<CardSlot, string>> = {
  'card-2': 'view.focus',
  'card-3': 'table.nextCell',
  'card-4': 'palette.open',
  'card-5': 'note.history',
  'card-6': 'note.newFromTemplate',
}

// Card labels that name a place in the app, and the app string that names it there.
const CARD_NAMES: Partial<Record<CardSlot, string>> = {
  'card-2': 'mode.focus',
  'card-4': 'command.palette',
  'card-5': 'noteMenu.history',
  'card-6': 'sidebar.templates',
}

interface Fact {
  /** The code its mismatches carry, which names the check when it is skipped. */
  code: FactCode
  needs: readonly string[]
  check: (devot: (path: string) => string, copy: Messages) => FactProblem[]
}

const problem = (code: FactCode, message: string): FactProblem => ({
  code,
  message: `${code} ${message}`,
})

/** E_FACT_STALE when the page no longer says `phrase`: the check would vouch for nothing. */
function says(text: string, phrase: string, where: string): FactProblem[] {
  return text.includes(phrase)
    ? []
    : [problem('E_FACT_STALE', `${where} no longer says "${phrase}": update scripts/facts`)]
}

const noteText = (runs: readonly NoteText[]) =>
  runs.map((run) => (typeof run === 'string' ? run : run.unbroken)).join('')
const plain = (runs: readonly CardText[]) =>
  runs.map((run) => (typeof run === 'string' ? run : run.code)).join('')
const codesIn = (runs: readonly CardText[]) =>
  runs.flatMap((run) => (typeof run === 'string' ? [] : [run.code]))
const feature = (copy: Messages, slot: 'write' | 'organise' | 'find') =>
  copy.features.items.find((item) => item.slot === slot)?.body ?? []

const GLYPHS: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' }
const WORDS: Record<string, string> = {
  Ctrl: 'Control',
  Alt: 'Option',
  Shift: 'Shift',
  Mod: 'Command',
}
const NAMED_KEYS: Record<string, { glyph: string; word: string }> = {
  Tab: { glyph: '⇥', word: 'Tab' },
  Enter: { glyph: '↩', word: 'Return' },
  Escape: { glyph: '⎋', word: 'Escape' },
  Space: { glyph: 'Space', word: 'Space' },
}

function shortcutParts(shortcut: string): { modifiers: string[]; key: string } {
  const parts = shortcut.split('+')
  const key = parts.pop() ?? ''
  return { modifiers: Object.keys(GLYPHS).filter((name) => parts.includes(name)), key }
}

/** A registry shortcut (`Mod+Shift+D`) as the Mac draws it: ⌃⌥⇧⌘, then the key. */
export function shortcutGlyphs(shortcut: string): string {
  const { modifiers, key } = shortcutParts(shortcut)
  return modifiers.map((name) => GLYPHS[name]).join('') + (NAMED_KEYS[key]?.glyph ?? key)
}

/** The same shortcut in words, in the order it is drawn. */
export function shortcutSpoken(shortcut: string): string {
  const { modifiers, key } = shortcutParts(shortcut)
  return [...modifiers.map((name) => WORDS[name]), NAMED_KEYS[key]?.word ?? key].join(' ')
}

function registryKeys(registry: string, id: string): string[] | undefined {
  const start = registry.indexOf(`id: '${id}'`)
  if (start < 0) return undefined
  const next = registry.indexOf("id: '", start + 1)
  const spec = registry.slice(start, next < 0 ? undefined : next)
  const keys = /keys:\s*\[([^\]]*)\]/.exec(spec)?.[1]
  return keys === undefined ? undefined : [...keys.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A string from Devot's English catalog, its escapes resolved. */
function appString(strings: string, key: string): string | undefined {
  const entry = new RegExp(`'${escapeRegExp(key)}':\\s*'((?:\\\\.|[^'\\\\])*)'`).exec(strings)
  return entry?.[1]
    ?.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1')
}

function rustSeconds(source: string, name: string): number | undefined {
  const value = new RegExp(`const ${name}: Duration = Duration::from_secs\\(([\\d\\s*]+)\\);`).exec(
    source,
  )?.[1]
  return value?.split('*').reduce((product, factor) => product * Number(factor.trim()), 1)
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

const TS_CONST = (name: string) => new RegExp(`const ${name}\\s*=\\s*([\\w\\s*]+?)\\s*$`, 'm')
const RUST_CONST = (name: string) => new RegExp(`const ${name}: i64 = ([\\w\\s*]+?);`)

/** A constant in milliseconds: a product of numbers and constants defined before it. */
function constMillis(
  source: string,
  name: string,
  pattern: (name: string) => RegExp,
  depth = 0,
): number | undefined {
  const value = pattern(name).exec(source)?.[1]
  if (value === undefined || depth > 4) return undefined
  return value.split('*').reduce<number | undefined>((product, factor) => {
    const term = factor.trim()
    const number = /^[\d_]+$/.test(term)
      ? Number(term.replaceAll('_', ''))
      : constMillis(source, term, pattern, depth + 1)
    return product === undefined || number === undefined ? undefined : product * number
  }, 1)
}

const tsMillis = (source: string, name: string) => constMillis(source, name, TS_CONST)

const HOUR_MS = 3_600_000
const UNITS: [string, number][] = [
  ['week', 7 * 24 * HOUR_MS],
  ['day', 24 * HOUR_MS],
  ['hour', HOUR_MS],
  ['minute', 60_000],
  ['second', 1_000],
]

/** A length of time as the page says it: "a minute", "an hour", "two weeks". */
function duration(ms: number): string {
  const [unit, size] = UNITS.find(([, length]) => ms % length === 0) ?? ['millisecond', 1]
  const count = ms / size
  if (count === 1) return `${unit === 'hour' ? 'an' : 'a'} ${unit}`
  return `${NUMBER_WORDS[count] ?? count} ${unit}s`
}

/** The anchor GitHub gives a Markdown heading. */
function headingAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const sameName = (a: string, b: string) =>
  a.replace(/(…|\.\.\.)$/, '').toLowerCase() === b.replace(/(…|\.\.\.)$/, '').toLowerCase()
const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

const FACTS: Fact[] = [
  {
    code: 'E_FACT_SHORTCUT',
    needs: [REGISTRY],
    check: (devot, copy) =>
      Object.entries(copy.cards.items).flatMap(([slot, card]) => {
        if (!('keys' in card) || card.keys === undefined) return []
        const shown = card.keys
        const command = CARD_COMMANDS[slot as CardSlot]
        if (command === undefined)
          return [
            problem(
              'E_FACT_SHORTCUT',
              `${slot} shows ${shown.glyphs} but scripts/facts names no command for it`,
            ),
          ]
        const key = registryKeys(devot(REGISTRY), command)?.[0]
        if (key === undefined)
          return [problem('E_FACT_SHORTCUT', `${slot}: ${command} has no keys in ${REGISTRY}`)]
        const problems: FactProblem[] = []
        if (shortcutGlyphs(key) !== shown.glyphs)
          problems.push(
            problem(
              'E_FACT_SHORTCUT',
              `${slot} shows ${shown.glyphs}; ${command} defaults to ${key} in ${REGISTRY}`,
            ),
          )
        if (!shown.spoken.endsWith(shortcutSpoken(key)))
          problems.push(
            problem(
              'E_FACT_SHORTCUT',
              `${slot} says "${shown.spoken}"; ${command} defaults to ${shortcutSpoken(key)}`,
            ),
          )
        return problems
      }),
  },
  {
    code: 'E_FACT_OPERATOR',
    needs: [SEARCH],
    check: (devot, copy) => {
      const search = devot(SEARCH)
      const block = /const QUALIFIERS[\s\S]*?\]\)/.exec(search)?.[0] ?? ''
      const qualifiers = new Set([...block.matchAll(/\[\s*'(\w+)'\s*,/g)].map((m) => m[1]))
      const find = feature(copy, 'find')
      const named = codesIn(find).flatMap((code) => /^(\w+):$/.exec(code)?.[1] ?? [])
      return [
        ...says(plain(find), 'with a minus', 'The Find and connect feature'),
        ...says(plain(find), 'book:', 'The Find and connect feature'),
        ...named
          .filter((name) => !qualifiers.has(name.toLowerCase()))
          .map((name) => problem('E_FACT_OPERATOR', `${name}: is not a qualifier in ${SEARCH}`)),
        ...(/-anything\s+excludes/.test(search)
          ? []
          : [problem('E_FACT_OPERATOR', `${SEARCH} no longer documents -anything as excluding`)]),
      ]
    },
  },
  {
    code: 'E_FACT_LINKS',
    needs: [README],
    check: (devot, copy) => [
      ...says(codesIn(feature(copy, 'find')).join(' '), '[[', 'The Find and connect feature'),
      ...(devot(README).includes('`[[` note links')
        ? []
        : [problem('E_FACT_LINKS', `${README} no longer lists \`[[\` note links`)]),
    ],
  },
  {
    code: 'E_FACT_LABEL',
    needs: [STRINGS],
    check: (devot, copy) => {
      const strings = devot(STRINGS)
      const backlinks = appString(strings, 'noteInfo.backlinks')
      const names = Object.entries(CARD_NAMES).flatMap(([slot, key]) => {
        const label = copy.cards.items[slot as CardSlot].label
        const app = appString(strings, key)
        return app !== undefined && sameName(label, app)
          ? []
          : [problem('E_FACT_LABEL', `${slot} is labelled "${label}"; ${key} is "${app}"`)]
      })
      const find = plain(feature(copy, 'find'))
      return [
        ...names,
        ...(backlinks !== undefined && find.includes(`“${backlinks}”`)
          ? []
          : [
              problem(
                'E_FACT_LABEL',
                `the Find and connect feature quotes no "${backlinks}" (noteInfo.backlinks)`,
              ),
            ]),
      ]
    },
  },
  {
    code: 'E_FACT_STATUS',
    needs: [STORAGE, STRINGS],
    check: (devot, copy) => {
      const ids = [
        ...(/NOTE_STATUSES\s*=\s*\[([^\]]*)\]/.exec(devot(STORAGE))?.[1]?.matchAll(/'(\w+)'/g) ??
          []),
      ].map((m) => m[1] ?? '')
      const organise = plain(feature(copy, 'organise'))
      if (!ids.includes('none'))
        return [problem('E_FACT_STATUS', `${STORAGE} has no 'none' status to leave a note without`)]
      return ids
        .filter((id) => id !== 'none')
        .flatMap((id) => {
          const label = appString(devot(STRINGS), `status.${id}`)
          return label !== undefined && organise.includes(label)
            ? []
            : [
                problem(
                  'E_FACT_STATUS',
                  `the Organise feature does not name status ${id} ("${label}")`,
                ),
              ]
        })
    },
  },
  {
    code: 'E_FACT_THEME',
    needs: [BACKDROPS, STRINGS],
    check: (devot, copy) => {
      const backdrop = (JSON.parse(devot(BACKDROPS)) as { backdrop?: Record<string, unknown> })
        .backdrop
      const themes = Object.entries(backdrop ?? {}).filter(([name]) => !name.startsWith('$'))
      const text = plain(copy.cards.items['card-1'].body)
      const count = `${NUMBER_WORDS[themes.length] ?? themes.length} gradient themes`
      return [
        ...says(text, 'light and dark', 'card-1'),
        ...(text.includes(count)
          ? []
          : [
              problem(
                'E_FACT_THEME',
                `${BACKDROPS} has ${themes.length} themes; card-1 needs "${count}"`,
              ),
            ]),
        ...themes.flatMap(([id, modes]) => {
          const name = appString(devot(STRINGS), `appearanceSettings.theme${capitalised(id)}`)
          const both =
            typeof modes === 'object' && modes !== null && 'light' in modes && 'dark' in modes
          return [
            ...(name !== undefined && text.includes(name)
              ? []
              : [problem('E_FACT_THEME', `card-1 does not name theme ${id} ("${name}")`)]),
            ...(both
              ? []
              : [problem('E_FACT_THEME', `theme ${id} lacks a light or a dark backdrop`)]),
          ]
        }),
      ]
    },
  },
  {
    code: 'E_FACT_PLACEHOLDER',
    needs: [TEMPLATES],
    check: (devot, copy) => {
      const names = codesIn(copy.cards.items['card-6'].body).flatMap(
        (code) => /^\{\{(\w+)\}\}$/.exec(code)?.[1] ?? [],
      )
      return [
        ...says(plain(copy.cards.items['card-6'].body), '{{date}}', 'card-6'),
        ...names
          .filter(
            (name) => !new RegExp(`^\\s*${name}: '|name === '${name}'`, 'm').test(devot(TEMPLATES)),
          )
          .map((name) => problem('E_FACT_PLACEHOLDER', `${TEMPLATES} does not fill {{${name}}}`)),
      ]
    },
  },
  {
    code: 'E_FACT_UPDATES',
    needs: [UPDATES],
    check: (devot, copy) => {
      const source = devot(UPDATES)
      const text = copy.privacy.network.items.map((item) => item.text).join(' ')
      const first = rustSeconds(source, 'FIRST_CHECK')
      const every = (name: string) => {
        const seconds = rustSeconds(source, name)
        return seconds === 86_400 ? 'daily' : seconds === 3_600 ? 'hourly' : `every ${seconds} s`
      }
      const feed = /const FEED_BASE: &str = "([^"]+)"/.exec(source)?.[1] ?? ''
      const expected = [
        `${first} seconds after launch`,
        `then ${every('CHECK_EVERY')}`,
        `${every('CHECK_EVERY_BETA')} for betas`,
      ]
      return [
        ...says(text, 'ask GitHub for the update feed', 'The network list'),
        ...expected
          .filter((phrase) => !text.includes(phrase))
          .map((phrase) =>
            problem('E_FACT_UPDATES', `${UPDATES} means the page should say "${phrase}"`),
          ),
        ...(feed.startsWith('https://github.com/')
          ? []
          : [problem('E_FACT_UPDATES', `${UPDATES} FEED_BASE is not on github.com: ${feed}`)]),
      ]
    },
  },
  {
    code: 'E_FACT_LICENCE',
    needs: [LICENSE],
    check: (devot, copy) => {
      const licence = devot(LICENSE)
      const name = /^## Abbreviation\s+(\S+)/m.exec(licence)?.[1]
      const [, year, holder] = /^Copyright (?:\(c\) )?(\d{4}) (.+)$/m.exec(licence) ?? []
      if (name === undefined)
        return [problem('E_FACT_LICENCE', `${LICENSE} names no licence under "## Abbreviation"`)]
      const source = copy.terms.sections.find(({ title }) => title === 'Source code')
      const naming: [string, string][] = [
        ['The footer', copy.footer.licence],
        ['The footer link', copy.footer.groups.legal.links.licence],
        ['The Local-first facts', copy.privacy.facts.rows.flat().join(' ')],
        ['The Download lead', copy.closing.lead],
        [
          'The terms of sale',
          (source?.paragraphs.flat() ?? [])
            .map((run) => (typeof run === 'string' ? run : run.text))
            .join(''),
        ],
      ]
      const stale = naming.filter(([, text]) => !text.includes(name)).map(([where]) => where)
      return [
        ...(stale.length === 0
          ? []
          : [
              problem(
                'E_FACT_LICENCE',
                `${LICENSE} is ${name}, which ${stale.join(', ')} do not name`,
              ),
            ]),
        ...(year !== undefined && copy.footer.copyright(Number(year)) === `© ${year} ${holder}`
          ? []
          : [
              problem(
                'E_FACT_LICENCE',
                `the footer says "${copy.footer.copyright(Number(year))}"; ${LICENSE} names ${holder}`,
              ),
            ]),
      ]
    },
  },
  {
    code: 'E_FACT_PLATFORM',
    needs: [TAURI],
    check: (devot, copy) => {
      const conf = JSON.parse(devot(TAURI)) as {
        bundle?: { macOS?: { minimumSystemVersion?: string } }
      }
      const minimum = conf.bundle?.macOS?.minimumSystemVersion ?? ''
      const major = minimum.split('.')[0]
      return copy.download.requirements.includes(`macOS ${major}+`)
        ? []
        : [
            problem(
              'E_FACT_PLATFORM',
              `${TAURI} needs macOS ${minimum}; the page says "${copy.download.requirements}"`,
            ),
          ]
    },
  },
  {
    code: 'E_FACT_RELEASE',
    needs: [RELEASE],
    check: (devot, copy) => {
      const archs = [...devot(RELEASE).matchAll(/Devot_\$\{[^}]*\}_(\w+)\.dmg/g)].map((m) => m[1])
      return [
        ...says(copy.download.requirements, 'Apple Silicon', 'The download requirements'),
        ...(archs.length > 0 && archs.every((arch) => arch === 'aarch64')
          ? []
          : [
              problem(
                'E_FACT_RELEASE',
                `${RELEASE} names dmg assets for ${archs.join(', ') || 'no architecture'}, not only aarch64 (Apple Silicon)`,
              ),
            ]),
      ]
    },
  },
  {
    code: 'E_FACT_SIGNING',
    needs: [README],
    check: (devot, copy) => {
      const readme = devot(README)
      const missing = (said: boolean, what: string) =>
        said ? [] : [problem('E_FACT_SIGNING', `${README} no longer says ${what}`)]
      return [
        ...says(
          copy.closing.installNote,
          'Signed ad hoc, not notarised',
          'The closing install note',
        ),
        ...says(copy.closing.installNote, 'so macOS asks once', 'The closing install note'),
        ...says(noteText(copy.install.note), 'Not notarised yet', 'The install note'),
        ...says(
          noteText(copy.install.note),
          'right-click Devot and choose Open',
          'The install note',
        ),
        ...missing(
          readme.includes('ad-hoc signed and not notarised'),
          'builds are ad-hoc signed and not notarised',
        ),
        ...missing(readme.includes('so macOS asks once'), 'macOS asks once'),
        ...missing(
          /right-click Devot\b[^.\n]*\bchoose Open\b/.test(readme),
          'to right-click Devot and choose Open the first time',
        ),
      ]
    },
  },
  {
    code: 'E_FACT_MIRROR',
    needs: [README],
    check: (devot, copy) => [
      ...says(copy.privacy.body, 'never reads them back', 'The local-first paragraph'),
      ...(devot(README).includes('never read back')
        ? []
        : [
            problem(
              'E_FACT_MIRROR',
              `${README} no longer says the mirror folder is never read back`,
            ),
          ]),
    ],
  },
  {
    code: 'E_FACT_MCP',
    needs: [README],
    check: (devot, copy) => [
      ...says(copy.footer.groups.resources.links.mcp, 'from source', 'The footer devot-mcp link'),
      ...(devot(README).includes('devot-mcp runs from a checkout')
        ? []
        : [problem('E_FACT_MCP', `${README} no longer says devot-mcp runs from a checkout`)]),
    ],
  },
  {
    code: 'E_FACT_ANCHOR',
    needs: [README],
    check: (devot) => {
      const sections = new Set(
        [...devot(README).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map((m) =>
          headingAnchor(m[1] ?? ''),
        ),
      )
      const hrefs = new Set([INSTALL_URL, ...footerLinks().map(({ href }) => href)])
      return [...hrefs]
        .filter((href) => href.startsWith(`${REPO_URL}#`))
        .filter((href) => !sections.has(href.slice(REPO_URL.length + 1)))
        .map((href) => problem('E_FACT_ANCHOR', `${href} names no section of ${README}`))
    },
  },
  {
    code: 'E_FACT_REVISIONS',
    needs: [REVISIONS],
    check: (devot, copy) => {
      const source = devot(REVISIONS)
      const text = plain(copy.cards.items['card-5'].body)
      const ms = (name: string | undefined) =>
        name === undefined ? undefined : tsMillis(source, name)
      const pause = ms('REVISION_PAUSE_MS')
      const keepAll = ms(/if \(age < (\w+)\) return\b/.exec(source)?.[1])
      const buckets =
        /age < (\w+) \? `h\$\{Math\.floor\(revision\.at \/ (\w+)\)\}` : `d\$\{dayOf\(revision\.at\)\}`/.exec(
          source,
        )
      const hourlyFor = buckets && ms(buckets[2]) === HOUR_MS ? ms(buckets[1]) : undefined
      const rules: [phrase: string | undefined, rule: string][] = [
        [
          pause === undefined ? undefined : `pause typing for ${duration(pause)}`,
          'REVISION_PAUSE_MS',
        ],
        [
          keepAll === undefined ? undefined : `every one for ${duration(keepAll)}`,
          'the age under which every version is kept',
        ],
        [
          hourlyFor === undefined ? undefined : `then hourly for ${duration(hourlyFor)}`,
          'the hourly versions',
        ],
        [buckets ? 'then daily' : undefined, 'the daily versions'],
      ]
      return [
        ...says(text, 'pause typing', 'card-5'),
        ...rules.flatMap(([phrase, rule]) => {
          if (phrase === undefined)
            return [
              problem(
                'E_FACT_REVISIONS',
                `${REVISIONS}: cannot find ${rule}; check card-5 and scripts/facts`,
              ),
            ]
          return text.includes(phrase)
            ? []
            : [problem('E_FACT_REVISIONS', `${REVISIONS} means card-5 should say "${phrase}"`)]
        }),
        ...says(
          copy.privacy.facts.rows.flat().join(' '),
          'Version history on your Mac',
          'The local-first facts',
        ),
        ...(source.includes('Versions are local to this device')
          ? []
          : [problem('E_FACT_REVISIONS', `${REVISIONS} no longer keeps versions on this device`)]),
      ]
    },
  },
  {
    code: 'E_FACT_TRIAL',
    needs: [TRIAL, ENTITLEMENTS],
    check: (devot, copy) => {
      const length = constMillis(devot(TRIAL), 'LENGTH_MS', RUST_CONST)
      const gatedList = /PLAN_GATED_FEATURES[^=]*=\s*\[([^\]]*)\]/.exec(devot(ENTITLEMENTS))?.[1]
      const gated = [...(gatedList ?? '').matchAll(/'(\w+)'/g)].map((match) => match[1])
      const terms = copy.terms.sections.find(({ title }) => title === 'The trial')
      const termsText = (terms?.paragraphs.flat() ?? [])
        .map((run) => (typeof run === 'string' ? run : run.text))
        .join(' ')
      const problems = [
        ...says(copy.pricing.after.body, 'read-only', 'The note on the trial ending'),
        ...says(termsText, 'read-only', 'The terms of sale'),
      ]
      if (length === undefined)
        return [...problems, problem('E_FACT_TRIAL', `${TRIAL}: cannot find LENGTH_MS`)]
      const spaced = duration(length)
      const hyphenated = spaced.replace(/s$/, '').replace(' ', '-')
      const lengths: [string, string, string][] = [
        ['The pricing title', copy.pricing.title.join(' ').toLowerCase(), spaced],
        ['The terms of sale', termsText, hyphenated],
      ]
      return [
        ...problems,
        ...lengths
          .filter(([, text, phrase]) => !text.includes(phrase))
          .map(([where, , phrase]) =>
            problem('E_FACT_TRIAL', `${TRIAL} means ${where} should say "${phrase}"`),
          ),
        ...['editing', 'sync', 'aiProviders']
          .filter((name) => !gated.includes(name))
          .map((name) =>
            problem(
              'E_FACT_TRIAL',
              `${ENTITLEMENTS} no longer gates ${name}, which the page says the trial and the licence unlock`,
            ),
          ),
        ...(gated.includes('localNotes')
          ? [
              problem(
                'E_FACT_TRIAL',
                `${ENTITLEMENTS} gates localNotes, which the page says stay readable after the trial`,
              ),
            ]
          : []),
      ]
    },
  },
]

/** The codes of the checks that read any of `paths`. */
export function factsReading(paths: readonly string[]): FactCode[] {
  return [
    ...new Set(
      FACTS.filter(({ needs }) => needs.some((path) => paths.includes(path))).map(
        ({ code }) => code,
      ),
    ),
  ]
}

/**
 * Every claim the page makes about Devot that Devot's own files can settle, checked against them.
 * A file listed in `unreachable` (a download that kept failing) is not reported missing; the checks
 * that read it are skipped.
 */
export function checkFacts(
  devot: DevotFiles,
  copy: Messages,
  unreachable: readonly string[] = [],
): FactProblem[] {
  const missing = DEVOT_FILES.filter((path) => !devot.has(path) && !unreachable.includes(path))
  const read = (path: string) => devot.get(path) ?? ''
  return [
    ...missing.map((path) => problem('E_FACT_SOURCE', `${path} is missing`)),
    ...FACTS.filter(({ needs }) => needs.every((path) => devot.has(path))).flatMap(({ check }) =>
      check(read, copy),
    ),
  ]
}
