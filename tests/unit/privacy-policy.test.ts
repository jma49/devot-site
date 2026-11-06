import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { LegalPage } from '../../src/i18n/en/legal.ts'
import { FOOTER_GROUPS, LEGAL_LINKS, MCP_PRIVACY_PATH, PRIVACY_PATH } from '../../src/lib/links.ts'
import { PRIVACY_EMAIL } from '../../src/site.ts'

const page = en.privacyPolicy
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

describe('the privacy policy', () => {
  it('has a title, a description and its sections in order', () => {
    expect(page.title).toBe('Devot: privacy policy')
    expect(page.description.length).toBeGreaterThan(40)
    expect(page.sections.map((section) => section.title)).toEqual([
      'Summary',
      'Your notes',
      'Sync',
      'AI',
      'Purchases and licences',
      'Crash reports',
      'Other connections',
      'What Devot does not do',
      'Your choices',
      'Changes',
      'Contact',
    ])
    for (const section of page.sections) expect(section.paragraphs.length).toBeGreaterThan(0)
  })

  it('carries its own effective date', () => {
    expect(page.updated).toBe('Effective 6 November 2026')
  })

  it('states where notes go and what Devot never does', () => {
    const text = legalText(page)
    expect(text).toMatch(/stay on your devices unless you turn on sync/)
    expect(text).toMatch(/end-to-end encrypted/)
    expect(text).toMatch(/never a title, a note, a name or the key/)
    expect(text).toMatch(/no accounts, no ads and no tracking/)
    expect(text).toMatch(/does not sell or share your data/)
  })

  it('says AI and crash reports send nothing until the user turns them on', () => {
    const text = legalText(page)
    expect(text).toMatch(/AI features are off until you add a key/)
    expect(text).toMatch(/only when you use an AI feature/)
    expect(text).toMatch(/Crash reports are off until you turn on Send Crash Reports/)
    expect(text).toMatch(/never note text/)
  })

  it('says what the licence service keeps, and for how long', () => {
    const text = legalText(page)
    expect(text).toMatch(/never your name, email address or payment details/)
    expect(text).toMatch(/does not store the address itself/)
    expect(text).toMatch(/as long as the licence exists/)
    expect(text).toMatch(/keyed hash for that hour/)
  })

  it('links to the connector policy and the contact address', () => {
    expect(linksOf(page)).toEqual(['mcpPrivacy', 'privacyEmail'])
    expect(LEGAL_LINKS.mcpPrivacy).toBe(MCP_PRIVACY_PATH)
    expect(legalText(page)).toContain(`Questions about this policy: ${PRIVACY_EMAIL}.`)
  })

  it('names no other note app', () => {
    expect(legalText(page)).not.toMatch(/obsidian|notion|bear|evernote|apple notes/i)
  })

  it('is served at /privacy and listed in the footer legal group', () => {
    expect(PRIVACY_PATH).toBe('/privacy')
    const legal = FOOTER_GROUPS.find((group) => group.id === 'legal')
    expect(legal?.links).toContainEqual({ id: 'privacy', href: '/privacy' })
    expect(en.footer.groups.legal.links.privacy).toBe('Privacy policy')
  })
})
