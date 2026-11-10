import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { llmsTxt } from '../../src/lib/llms-txt.ts'
import { DOWNLOAD_URL, LICENCE_PRICE, REPO_URL, SITE_URL } from '../../src/site.ts'

const text = llmsTxt(en)
const lines = text.split('\n')
const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1] ?? '')

it('follows the llms.txt layout: a title, a summary quote, then sections', () => {
  expect(lines[0]).toBe(`# ${en.siteName}`)
  expect(lines[1]).toBe('')
  expect(lines[2]).toBe(`> ${en.meta.description}`)
  expect(lines.filter((line) => line.startsWith('## ')).length).toBeGreaterThanOrEqual(4)
  expect(lines.filter((line) => line.startsWith('# '))).toHaveLength(1)
  expect(text.endsWith('\n')).toBe(true)
})

it('states the platform, the price and the trial as the page does', () => {
  expect(text).toContain(en.download.requirements)
  expect(text).toContain(LICENCE_PRICE)
  expect(text).toContain(en.pricing.trial.terms)
  expect(text).toContain(en.pricing.after.body)
  for (const line of en.pricing.licence.items) expect(lines).toContain(`    - ${line}`)
})

it('lists each link once', () => {
  expect(new Set(links).size).toBe(links.length)
})

it('lists every feature the page shows, code runs in backticks', () => {
  for (const item of en.features.items) expect(text).toContain(`**${item.name}:**`)
  expect(text).toContain('`book:`')
  for (const card of Object.values(en.cards.items)) expect(text).toContain(`**${card.label}:**`)
})

it('links only to absolute https addresses on this site or the Devot repository', () => {
  expect(links.length).toBeGreaterThan(5)
  for (const link of links) {
    expect(new URL(link).protocol, link).toBe('https:')
    expect(link.startsWith(SITE_URL) || link.startsWith(REPO_URL), link).toBe(true)
  }
  expect(links).toContain(DOWNLOAD_URL)
  expect(links).toContain(new URL('/mcp-privacy', SITE_URL).href)
})

it('carries no markup a reader would see as raw HTML', () => {
  expect(text).not.toMatch(/<[a-z/]/i)
})
