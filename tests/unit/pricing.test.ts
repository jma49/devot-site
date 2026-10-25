import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { LegalPage } from '../../src/i18n/en/legal.ts'
import { LEGAL_LINKS, REFUNDS_PATH, TERMS_PATH, footerLinks } from '../../src/lib/links.ts'
import {
  BUY_URL,
  ISSUES_URL,
  LICENCE_PRICE,
  REFUND_DAYS,
  REPO_URL,
  RESEND_URL,
} from '../../src/site.ts'
import { catalogStrings } from '../support/copy-policy.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/
const legalText = (page: LegalPage) =>
  page.sections
    .flatMap((section) => [section.title, ...section.paragraphs.flat()])
    .map((run) => (typeof run === 'string' ? run : run.text))
    .join(' ')

it('sells through the licence service: Buy opens /buy and a lost key goes to the resend form', () => {
  expect(BUY_URL).toBe('https://licence.devot.online/buy')
  expect(RESEND_URL).toBe('https://licence.devot.online/resend')
  expect(ISSUES_URL).toBe(`${REPO_URL}/issues`)
})

it('states the price and the refund window in one place each', () => {
  expect(LICENCE_PRICE).toBe('US$29.90')
  expect(REFUND_DAYS).toBe(30)
  const elsewhere = filesUnder('src')
    .filter((file) => file !== 'src/site.ts' && /\.(ts|astro|css)$/.test(file))
    .filter((file) => /29[.,]90|\b30[- ]days?\b/i.test(readRepoFile(file)))
  expect(elsewhere).toEqual([])
})

describe('the pricing section', () => {
  const copy = en.pricing

  it('says what is free and what a licence unlocks, with the price', () => {
    expect(copy.lead).toMatch(/free/i)
    expect(copy.lead).toMatch(/sync and AI/)
    expect(copy.licence.price).toBe(LICENCE_PRICE)
    expect(copy.licence.terms).toMatch(/one payment, tax included/i)
  })

  it('covers sync, AI, every future version and all devices', () => {
    const items = copy.licence.items.join(' ')
    expect(items).toMatch(/end-to-end encrypted sync/i)
    expect(items).toMatch(/relay you deploy/i)
    expect(items).toMatch(/your own provider/i)
    expect(items).toMatch(/every future version/i)
    expect(items).toMatch(/all your devices/i)
  })

  it('names the refund window beside the Buy button', () => {
    expect(copy.licence.buy).toBe('Buy a licence')
    expect(copy.licence.refund).toContain(`${REFUND_DAYS}-day refund`)
  })

  it('offers the terms, the refund policy and a way back to a lost key', () => {
    expect(copy.links.terms).toBe(en.terms.heading)
    expect(copy.links.refunds).toBe(en.refunds.heading)
    expect(copy.links.lostKey).toBe('Lost your licence key?')
  })
})

describe.each([
  ['terms', () => en.terms],
  ['refunds', () => en.refunds],
] as const)('the %s page', (_, page) => {
  it('has a title, a description, and sections each with a heading and text', () => {
    const copy = page()
    expect(copy.title).toMatch(/^Devot: /)
    expect(copy.description.length).toBeGreaterThan(40)
    expect(copy.sections.length).toBeGreaterThanOrEqual(3)
    for (const section of copy.sections) {
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.paragraphs.length, section.title).toBeGreaterThan(0)
    }
  })

  it('links only to destinations the site knows', () => {
    const links = page()
      .sections.flatMap((section) => section.paragraphs.flat())
      .flatMap((run) => (typeof run === 'string' ? [] : [run.link]))
    for (const link of links) expect(Object.keys(LEGAL_LINKS)).toContain(link)
  })

  it('states the refund window and that a refund revokes the licence', () => {
    const text = legalText(page())
    expect(text).toContain(`${REFUND_DAYS} days`)
    expect(text).toMatch(/revoke/i)
  })
})

it('sets out the sale in the terms: payments, the key, coverage, source, support, warranty', () => {
  const text = legalText(en.terms)
  expect(text).toContain(LICENCE_PRICE)
  expect(text).toMatch(/Stripe Managed Payments/)
  expect(text).toMatch(/merchant of record/)
  expect(text).toMatch(/Settings > Licence/)
  expect(text).toMatch(/every future version/i)
  expect(text).toMatch(/all your devices/i)
  expect(text).toMatch(/FSL-1\.1-MIT/)
  expect(text).toMatch(/reply to your licence email/i)
  expect(text).toMatch(/warranty/i)
})

it('links each legal destination to its page or service', () => {
  expect(LEGAL_LINKS).toEqual({
    terms: TERMS_PATH,
    refunds: REFUNDS_PATH,
    resend: RESEND_URL,
    issues: ISSUES_URL,
  })
  expect(TERMS_PATH).toBe('/terms')
  expect(REFUNDS_PATH).toBe('/refunds')
})

it('links the footer to Pricing, the terms and the refund policy', () => {
  const hrefs = footerLinks().map(({ href }) => href)
  expect(hrefs).toContain('/#pricing')
  expect(hrefs).toContain(TERMS_PATH)
  expect(hrefs).toContain(REFUNDS_PATH)
})

it('gives no email address anywhere in the copy', () => {
  const addresses = [...catalogStrings(en, [2026])].filter((text) => EMAIL.test(text))
  expect(addresses).toEqual([])
})

it('promises nothing Devot has not shipped', () => {
  const claims = [...catalogStrings(en, [2026])].filter((text) =>
    /\biPhone\b|\biPad\b|\biOS\b|semantic search/i.test(text),
  )
  expect(claims).toEqual([])
})
