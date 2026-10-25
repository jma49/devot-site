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
  TRIAL_DAYS,
} from '../../src/site.ts'
import { numberWord } from '../../src/lib/words.ts'
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

it('states the price, the refund window and the trial length in one place each', () => {
  expect(LICENCE_PRICE).toBe('US$29.90')
  expect(REFUND_DAYS).toBe(30)
  expect(TRIAL_DAYS).toBe(3)
  const elsewhere = filesUnder('src')
    .filter((file) => file !== 'src/site.ts' && /\.(ts|astro|css)$/.test(file))
    .filter((file) =>
      /29[.,]90|\b30[- ]days?\b|\b(3|three)[- ]days?\b|\b72[- ]hours?\b/i.test(readRepoFile(file)),
    )
  expect(elsewhere).toEqual([])
})

const trialWord = numberWord(TRIAL_DAYS)
const READ_ONLY = [
  /read-only/,
  /read, search, copy and export/,
  /not create or edit/,
  /sync and AI stop/,
]

describe('the pricing section', () => {
  const copy = en.pricing

  it('offers the trial with everything included, then the licence', () => {
    expect(copy.title.join(' ').toLowerCase()).toContain(`${trialWord} days`)
    expect(copy.title.join(' ')).toMatch(/pay once/i)
    expect(copy.trial.price.toLowerCase()).toBe(`${trialWord} days`)
    expect(copy.trial.terms).toMatch(/free trial/)
    expect(copy.trial.terms).toMatch(/everything included/)
    expect(copy.trial.terms).toMatch(/first time you open Devot/)
    const trial = copy.trial.items.join(' ')
    expect(trial).toMatch(/writing/i)
    expect(trial).toMatch(/end-to-end encrypted sync, through a relay you deploy/i)
    expect(trial).toMatch(/AI with keys from your own provider/)
  })

  it('says plainly what happens when the trial ends: read-only, nothing deleted', () => {
    expect(copy.after.title).toBe('When the trial ends')
    for (const fact of READ_ONLY) expect(copy.after.body).toMatch(fact)
    expect(copy.after.body).toMatch(/Nothing is deleted, and export always works/)
  })

  it('prices the licence once, for everything, on every device and version', () => {
    expect(copy.licence.price).toBe(LICENCE_PRICE)
    expect(copy.licence.terms).toMatch(/one payment, tax included/i)
    expect(copy.licence.terms).toMatch(/no subscription, no renewal/i)
    const items = copy.licence.items.join(' ')
    expect(items).toMatch(/everything in the trial, for good/i)
    expect(items).toMatch(/every future version/i)
    expect(items).toMatch(/all your devices/i)
  })

  it('names Stripe Managed Payments, a merchant of record service, as the processor', () => {
    expect(copy.delivery).toMatch(/processed by Stripe through Stripe Managed Payments/)
    expect(copy.delivery).toMatch(/merchant of record/)
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

it('names the trial wherever the site used to call Devot free', () => {
  const trial = `${trialWord}-day free trial`
  expect(en.chrome.downloadNote.toLowerCase()).toBe(trial)
  expect(en.meta.description.toLowerCase()).toContain(trial)
  expect(en.closing.lead.toLowerCase()).toContain(trial)
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

it('sets out the sale in the terms: trial, payments, the key, coverage, source, support, warranty', () => {
  const text = legalText(en.terms)
  expect(text).toContain(`${trialWord}-day free trial`)
  for (const fact of READ_ONLY) expect(text).toMatch(fact)
  expect(text).toMatch(/Nothing is deleted/)
  expect(text).toMatch(/A licence unlocks everything in Devot/)
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

it('returns Devot to read-only after a refund or a chargeback, in both pages', () => {
  for (const page of [en.terms, en.refunds]) {
    expect(legalText(page)).toMatch(/revokes the licence, and Devot goes back to read-only/)
  }
  for (const fact of READ_ONLY) expect(legalText(en.refunds)).toMatch(fact)
  expect(legalText(en.refunds)).toMatch(/chargeback decided in your favour/)
})

it('describes the checkout as Stripe does: Link as the merchant of record, LINK.COM* on the statement', () => {
  const text = legalText(en.terms)
  expect(text).toMatch(/Link as the merchant of record/)
  expect(text).toMatch(/“Sold through Link”/)
  expect(text).toContain('LINK.COM*')
  expect(text).toMatch(/Receipts and refund notices come from Link/)
})

it('says each thing in the terms once and adds no terms beyond the facts of the sale', () => {
  const text = legalText(en.terms)
  expect(text.match(/every future version/gi)).toHaveLength(1)
  expect(text.match(/subscription/gi)).toHaveLength(1)
  expect(text).toMatch(/relay you deploy/)
  expect(text).not.toMatch(/person who buys|hosted relay|who it is for/i)
})

it('names one source licence everywhere, FSL-1.1-MIT, and never calls Devot open source', () => {
  const strings = [...catalogStrings(en, [2026])]
  expect(strings.filter((text) => /\bMIT\b/.test(text.replaceAll('FSL-1.1-MIT', '')))).toEqual([])
  expect(strings.filter((text) => /open[ -]source/i.test(text))).toEqual([])
  expect(en.footer.licence).toContain('FSL-1.1-MIT')
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
