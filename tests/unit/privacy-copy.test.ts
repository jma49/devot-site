import { expect, it } from 'vitest'
import { catalogStrings } from '../support/copy-policy.ts'
import { en } from '../../src/i18n/en.ts'

const claims = { privacy: en.privacy, closing: en.closing, footer: en.footer }
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

it('states at least five facts about where notes live, in three rows', () => {
  const rows = en.privacy.facts.rows
  expect(rows).toHaveLength(3)
  expect(rows.flat().length).toBeGreaterThanOrEqual(5)
})

it('keeps each fact short enough for a chip, and says no fact twice', () => {
  const facts = en.privacy.facts.rows.flat()
  for (const fact of facts) expect(fact.length, fact).toBeLessThanOrEqual(40)
  expect(facts.filter((fact, index) => facts.indexOf(fact) !== index)).toEqual([])
})

it('keeps the rows close in length, so the drift moves all of them alike', () => {
  const widths = en.privacy.facts.rows.map((row) => row.join('').length)
  expect(Math.max(...widths) / Math.min(...widths)).toBeLessThan(1.5)
})

it('names every outbound connection, each with a term and a sentence', () => {
  const items = en.privacy.network.items
  expect(items.map((item) => item.term)).toEqual([
    'Update checks',
    'Link titles',
    'Embeds and web images',
    'Crash reports',
    'Sync',
    'AI',
  ])
  for (const item of items) expect(words(item.text), item.term).toBeLessThanOrEqual(30)
})

it('says sync goes end-to-end encrypted through your relay and AI to your own provider', () => {
  const text = (term: string) => en.privacy.network.items.find((item) => item.term === term)?.text
  expect(text('Sync')).toMatch(/end-to-end encrypted/)
  expect(text('Sync')).toMatch(/relay you deploy/)
  expect(text('AI')).toMatch(/provider whose key you added/)
  expect(text('AI')).toMatch(/only when you use/)
})

it('names every way note text leaves the Mac in the footnote, sync and AI included', () => {
  for (const way of [/export/, /mirror/, /sync/, /AI provider/, /MCP client/])
    expect(en.privacy.network.footnote).toMatch(way)
})

it('promises plain files only with the Markdown mirror, which Devot writes but never reads', () => {
  expect(en.privacy.lede).toMatch(/mirror/i)
  expect(en.privacy.body).toMatch(/mirror/i)
  expect(en.privacy.body).toMatch(/never reads/i)
})

it('keeps the paragraph beside the heading short', () => {
  expect(words(en.privacy.body)).toBeLessThanOrEqual(55)
})

it('makes no claim the app cannot prove', () => {
  const unprovable =
    /\b(telemetry|tracking|trackers|100\s?%|zero|military|unhackable|never leaves|nothing leaves|always private|completely private)\b/i
  const offenders = [...catalogStrings(claims, [2026])].filter((text) => unprovable.test(text))
  expect(offenders).toEqual([])
})

it('keeps the closing call to action to what the download page offers', () => {
  expect(en.closing.title).toEqual(['Write on your Mac.', 'Keep what you write.'])
  expect(en.download.requirements).toBe('macOS 26+ · Apple Silicon')
})
