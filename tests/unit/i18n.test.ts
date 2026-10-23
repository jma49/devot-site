import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { cardsCopy } from '../../src/i18n/en/cards.ts'
import { chromeCopy } from '../../src/i18n/en/chrome.ts'
import { featuresCopy } from '../../src/i18n/en/features.ts'
import { heroCopy } from '../../src/i18n/en/hero.ts'
import { mediaCopy } from '../../src/i18n/en/media.ts'
import { privacyCopy } from '../../src/i18n/en/privacy.ts'
import { filesUnder } from '../support/source-files.ts'

const namespaces = { chromeCopy, heroCopy, featuresCopy, cardsCopy, privacyCopy, mediaCopy }

it('gives every package its own namespace file, so copy edits never share a file', () => {
  const files = filesUnder('src/i18n/en').map((file) => file.replace('src/i18n/en/', ''))
  expect(files.toSorted()).toEqual(
    ['cards.ts', 'chrome.ts', 'features.ts', 'hero.ts', 'media.ts', 'privacy.ts'].toSorted(),
  )
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
  expect(en.hero.title).toBe('Local-first Markdown notes for macOS.')
  expect(en.download.label).toBe('Download for macOS')
  expect(en.meta.title).toBe('Devot: local-first Markdown notes for macOS')
  expect(en.notFound.heading).toBe('Page not found')
  expect(en.footer.copyright(2026)).toBe('© 2026 Devot')
})
