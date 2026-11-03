import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { LegalPage } from '../../src/i18n/en/legal.ts'
import { FOOTER_GROUPS, LEGAL_LINKS, MCP_PRIVACY_PATH } from '../../src/lib/links.ts'
import { PRIVACY_EMAIL } from '../../src/site.ts'

const page = en.mcpPrivacy
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

describe('the AI tools privacy page', () => {
  it('has a title, a description and the policy sections in order', () => {
    expect(page.title).toMatch(/^Devot: /)
    expect(page.description.length).toBeGreaterThan(40)
    expect(page.sections.map((section) => section.title)).toEqual([
      'Scope',
      'Summary',
      'How it works',
      'Data collection',
      'Usage and storage',
      'Third-party sharing',
      'Data retention',
      'Changes',
      'Contact',
    ])
    for (const section of page.sections) expect(section.paragraphs.length).toBeGreaterThan(0)
  })

  it('turns the usage list into paragraphs that start with their labels', () => {
    const usage = page.sections.find((section) => section.title === 'Usage and storage')
    const starts = usage?.paragraphs.map((runs) => String(runs[0]).split(' ')[0])
    expect(starts).toEqual(['The', 'Reads', 'Writes', 'Authorship:', 'Logs:', 'The'])
  })

  it('states what the connector reaches and what it sends', () => {
    const text = legalText(page)
    expect(text).toMatch(/sends nothing to Devot/)
    expect(text).toMatch(/makes no network requests/)
    expect(text).toMatch(/Allow AI Access/)
    expect(text).toMatch(/cannot permanently delete a note/)
    expect(text).toMatch(/codes and IDs, never note content/)
    expect(text).toMatch(/does not sell your data/i)
  })

  it('links to the contact address and to the AI provider privacy policy', () => {
    expect(linksOf(page)).toEqual(['anthropicPrivacy', 'privacyEmail'])
    expect(LEGAL_LINKS.anthropicPrivacy).toBe('https://www.anthropic.com/legal/privacy')
    expect(LEGAL_LINKS.privacyEmail).toBe(`mailto:${PRIVACY_EMAIL}`)
    expect(legalText(page)).toContain(`Questions about this policy: ${PRIVACY_EMAIL}.`)
  })

  it('writes the address once, in site.ts', () => {
    expect(PRIVACY_EMAIL).toBe('privacy@devot.online')
    const copy = JSON.stringify(page).split(PRIVACY_EMAIL).length - 1
    expect(copy).toBe(1)
  })

  it('names no other note app', () => {
    expect(legalText(page)).not.toMatch(/obsidian|notion|bear|evernote|apple notes/i)
  })

  it('is served at /mcp-privacy and listed in the footer legal group', () => {
    expect(MCP_PRIVACY_PATH).toBe('/mcp-privacy')
    const legal = FOOTER_GROUPS.find((group) => group.id === 'legal')
    expect(legal?.links).toContainEqual({ id: 'mcpPrivacy', href: '/mcp-privacy' })
    expect(en.footer.groups.legal.links.mcpPrivacy).toBe('AI tools privacy')
  })
})
