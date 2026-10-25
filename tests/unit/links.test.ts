import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import {
  FOOTER_GROUPS,
  INSTALL_URL,
  RELEASES_URL,
  STORAGE_DOC_URL,
  footerLinks,
} from '../../src/lib/links.ts'
import { DOWNLOAD_URL, REPO_URL } from '../../src/site.ts'

it('offers four footer groups: product, resources, community and legal', () => {
  expect(FOOTER_GROUPS.map((group) => group.id)).toEqual([
    'product',
    'resources',
    'community',
    'legal',
  ])
  for (const group of FOOTER_GROUPS) expect(group.links.length).toBeGreaterThanOrEqual(3)
})

it('links only to this site or to the Devot repository over https', () => {
  for (const { href } of footerLinks()) {
    if (href.startsWith('/')) continue
    expect(new RegExp(`^${REPO_URL}([/#]|$)`).test(href), href).toBe(true)
    expect(new URL(href).protocol).toBe('https:')
  }
})

it('anchors to the sections the page has', () => {
  const anchors = footerLinks()
    .map(({ href }) => href)
    .filter((href) => href.startsWith('/#'))
  expect(anchors.toSorted()).toEqual([
    '/#cards',
    '/#download',
    '/#local-first',
    '/#pricing',
    '/#write',
  ])
})

it('lists no destination twice', () => {
  const hrefs = footerLinks().map(({ href }) => href)
  expect(hrefs.filter((href, index) => hrefs.indexOf(href) !== index)).toEqual([])
})

it('labels every link in the catalog, and the catalog labels no link that is missing', () => {
  for (const group of FOOTER_GROUPS) {
    const copy = en.footer.groups[group.id]
    expect(copy.title.length, group.id).toBeGreaterThan(0)
    expect(Object.keys(copy.links).toSorted(), group.id).toEqual(
      group.links.map((link) => link.id).toSorted(),
    )
  }
  expect(Object.keys(en.footer.groups).toSorted()).toEqual(
    FOOTER_GROUPS.map((group) => group.id).toSorted(),
  )
})

it('derives the named destinations from the repository', () => {
  expect(RELEASES_URL).toBe(`${REPO_URL}/releases`)
  expect(INSTALL_URL).toBe(`${REPO_URL}#download`)
  expect(STORAGE_DOC_URL).toBe(`${REPO_URL}/blob/main/docs/architecture.md#app-data-folder`)
  expect(DOWNLOAD_URL.startsWith(RELEASES_URL)).toBe(true)
})

it('points the legal group at the licence, the terms of sale, the refunds and security', () => {
  const legal = FOOTER_GROUPS.find((group) => group.id === 'legal')?.links.map((l) => l.href)
  expect(legal).toContain(`${REPO_URL}/blob/main/LICENSE`)
  expect(legal).toContain('/terms')
  expect(legal).toContain('/refunds')
  expect(legal).toContain(`${REPO_URL}/security/policy`)
})
