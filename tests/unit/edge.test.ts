import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { zhHans } from '../../src/i18n/zh-Hans.ts'

const ids = (copy: typeof en) => copy.edge.items.map((item) => item.id)

it('leads with encrypted sync, then search by meaning, reviewed AI edits and the source', () => {
  expect(ids(en)).toEqual(['sync', 'meaning', 'review', 'source'])
  expect(ids(zhHans)).toEqual(ids(en))
})

it('names the edge in the hero lead and the home description, in both languages', () => {
  for (const words of [en.hero.lead, en.meta.description]) {
    expect(words).toMatch(/encrypted sync/i)
    expect(words).toMatch(/search by meaning/i)
  }
  for (const words of [zhHans.hero.lead, zhHans.meta.description]) {
    expect(words).toContain(zhHans.edge.items[0]!.title.slice(0, 7))
  }
})

it('gives the licence the pricing names and the cipher the privacy page names', () => {
  expect(en.edge.items.at(-1)!.body).toContain('FSL-1.1-MIT')
  expect(en.privacy.facts.rows.flat().join(' ')).toContain('FSL-1.1-MIT')
  expect(en.edge.items[0]!.body).toContain('AES-256-GCM')
})
