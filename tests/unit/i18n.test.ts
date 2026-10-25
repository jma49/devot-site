import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { NoteText } from '../../src/i18n/en/hero.ts'
import { filesUnder } from '../support/source-files.ts'

const modules: Record<string, Record<string, unknown>> = import.meta.glob(
  '../../src/i18n/en/*.ts',
  {
    eager: true,
  },
)
const namespaces = Object.fromEntries(
  Object.entries(modules).flatMap(([file, exports]) =>
    Object.entries(exports).map(([name, copy]) => [`${file}#${name}`, copy as object]),
  ),
)

it('loads every namespace file in src/i18n/en', () => {
  expect(Object.keys(modules)).toHaveLength(filesUnder('src/i18n/en').length)
  expect(Object.keys(namespaces).length).toBeGreaterThanOrEqual(6)
})

it('has no top-level key in two places, so one namespace cannot hide another', () => {
  const keys = ['siteName', 'download', ...Object.values(namespaces).flatMap(Object.keys)]
  expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([])
})

it('puts every namespace into the catalog', () => {
  for (const [name, copy] of Object.entries(namespaces)) {
    for (const [key, value] of Object.entries(copy)) {
      expect(en[key as keyof typeof en], `${name}.${key}`).toBe(value)
    }
  }
})

it('keeps the copy the page already used', () => {
  expect(en.hero.title).toBe('Your notes stay on your Mac, in your hands.')
  expect(en.download.label).toBe('Download for macOS')
  expect(en.meta.title).toBe('Devot: local-first Markdown notes for macOS')
  expect(en.notFound.heading).toBe('Page not found')
})

const noteText = (runs: readonly NoteText[]) =>
  runs.map((run) => (typeof run === 'string' ? run : run.unbroken)).join('')

it('says in plain words, beside each download button, how to open Devot the first time', () => {
  expect(noteText(en.install.note)).toBe(
    'Not notarised yet: the first time, right-click Devot and choose Open.',
  )
  expect(en.install.note).toContainEqual({ unbroken: 'right-click' })
  expect(en.install.link).toBe('Install steps')
  expect(en.closing.installNote).toMatch(/^Signed ad hoc, not notarised\b/)
  expect(en.closing.installNote).not.toMatch(/right-click/i)
})

it('promises an earlier version, not every version', () => {
  expect(en.cards.items['card-5'].title).toBe('Go back to an earlier version.')
})

it('names the copyright holder the licence names', () => {
  expect(en.footer.copyright(2026)).toBe('© 2026 devot.online')
})

it('labels the navigation the way the footer does', () => {
  expect(en.chrome.nav.write).toBe(en.footer.groups.product.links.features)
  expect(en.chrome.nav.cards).toBe(en.footer.groups.product.links.cards)
})
