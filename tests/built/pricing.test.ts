import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { BUY_URL, ISSUES_URL, LICENCE_PRICE, RESEND_URL } from '../../src/site.ts'
import { tags } from '../support/html.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

const home = readRepoFile('dist/index.html')
const terms = readRepoFile('dist/terms.html')
const refunds = readRepoFile('dist/refunds.html')
const pages = filesUnder('dist').filter((file) => file.endsWith('.html'))

const hrefs = (html: string) => tags(html, 'a').map(({ attrs }) => attrs.get('href'))
const pricing = /<section\b[^>]*\bid="pricing"[\s\S]*?<\/section>/.exec(home)?.[0] ?? ''
const header = /<header\b[\s\S]*?<\/header>/.exec(home)?.[0] ?? ''
const footer = (html: string) => /<footer\b[\s\S]*?<\/footer>/.exec(html)?.[0] ?? ''
const text = (html: string) =>
  html
    .replace(/<\/?span\b[^>]*>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
const loose = (html: string, word: string) =>
  html.replace(/<span class="site-nowrap"[^>]*>[^<]*<\/span>/g, '').split(word).length - 1

describe('the pricing section', () => {
  it('sits at #pricing with a named region and one heading', () => {
    expect(pricing).not.toBe('')
    expect(tags(pricing, 'section')[0]?.attrs.get('aria-label')).toBe(en.pricing.label)
    expect(tags(pricing, 'h2')).toHaveLength(1)
  })

  it('shows the trial, what its end does, the price and a Buy button for the licence service', () => {
    expect(text(pricing)).toContain(en.pricing.trial.price)
    expect(text(pricing)).toContain(en.pricing.after.body)
    expect(text(pricing)).toContain(LICENCE_PRICE)
    expect(hrefs(pricing)).toContain(BUY_URL)
  })

  it('never breaks read-only across two lines', () => {
    expect(loose(pricing, 'read-only')).toBe(0)
  })

  it('links the terms, the refund policy and the resend form', () => {
    expect(hrefs(pricing)).toEqual(expect.arrayContaining(['/terms', '/refunds', RESEND_URL]))
  })

  it('is in the main navigation', () => {
    expect(hrefs(header)).toContain('/#pricing')
  })
})

describe.each([
  ['terms', terms, en.terms],
  ['refunds', refunds, en.refunds],
] as const)('the %s page', (_, html, copy) => {
  it('has its own title and heading', () => {
    expect(html).toContain(`<title>${copy.title}</title>`)
    const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ''
    expect(text(heading).trim()).toBe(copy.heading)
  })

  it('never breaks read-only across two lines', () => {
    expect(text(html)).toContain('read-only')
    expect(loose(html, 'read-only')).toBe(0)
  })

  it('links back to Pricing and to the other page', () => {
    expect(hrefs(html)).toContain('/#pricing')
    expect(hrefs(html)).toEqual(expect.arrayContaining(['/terms', '/refunds']))
  })
})

it('shows the price in the terms, and links a lost key to the resend form', () => {
  expect(text(terms)).toContain(LICENCE_PRICE)
  expect(hrefs(terms)).toContain(RESEND_URL)
  expect(hrefs(terms)).toContain(ISSUES_URL)
})

it.each(pages)('%s links the terms and the refund policy from its footer', (page) => {
  expect(hrefs(footer(readRepoFile(page)))).toEqual(expect.arrayContaining(['/terms', '/refunds']))
})

it.each(pages)('%s gives no email address', (page) => {
  const html = readRepoFile(page)
  expect(html).not.toMatch(/mailto:/i)
  expect(text(html)).not.toMatch(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)
})
