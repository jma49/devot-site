import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { LegalPage } from '../../src/i18n/en/legal.ts'
import { FOOTER_GROUPS, LEGAL_LINKS, SUPPORT_PATH } from '../../src/lib/links.ts'
import { DEVICES_URL, PRIVACY_EMAIL } from '../../src/site.ts'

const page = en.support
const legalText = (copy: LegalPage) =>
  copy.sections
    .flatMap((section) => [
      section.title,
      ...section.paragraphs.map((runs) =>
        runs.map((run) => (typeof run === 'string' ? run : run.text)).join(''),
      ),
    ])
    .join('\n')
const linksOf = (copy: LegalPage) =>
  copy.sections
    .flatMap((section) => section.paragraphs.flat())
    .flatMap((run) => (typeof run === 'string' ? [] : [run.link]))

describe('the support page', () => {
  it('has a title, a description and its sections in order', () => {
    expect(page.title).toBe('Devot: support')
    expect(page.description.length).toBeGreaterThan(40)
    expect(page.sections.map((section) => section.title)).toEqual([
      'Getting help',
      'Restoring purchases on iPhone',
      'Using a Mac licence key on iPhone',
      'Getting a Mac key from an iPhone purchase',
      'Device seats',
      'Refunds',
      'Questions',
    ])
  })

  it('names the controls as the app labels them', () => {
    const text = legalText(page)
    for (const label of [
      'Restore Purchases',
      'Enter License Key',
      'Get a Mac License Key',
      'Copy Key',
      'Request a Refund',
      'Settings > License > Add License',
    ]) {
      expect(text).toContain(label)
    }
  })

  it('offers the issue tracker and the one contact address', () => {
    expect(legalText(page)).toContain(PRIVACY_EMAIL)
    expect(linksOf(page)).toEqual(
      expect.arrayContaining(['issues', 'privacyEmail', 'devices', 'appleRefund', 'refunds']),
    )
    expect(LEGAL_LINKS.devices).toBe(DEVICES_URL)
    expect(DEVICES_URL).toBe('https://licence.devot.online/devices')
    expect(LEGAL_LINKS.appleRefund).toBe('https://reportaproblem.apple.com')
  })

  it('warns never to post a licence key', () => {
    expect(legalText(page)).toMatch(/Never post your licence key/)
  })

  it('is served at /support and listed in the footer', () => {
    expect(SUPPORT_PATH).toBe('/support')
    const community = FOOTER_GROUPS.find((group) => group.id === 'community')
    expect(community?.links).toContainEqual({ id: 'support', href: '/support' })
    expect(en.footer.groups.community.links.support).toBe('Support')
  })
})
