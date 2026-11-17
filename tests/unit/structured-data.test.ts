import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { zhHans } from '../../src/i18n/zh-Hans.ts'
import { DOCS_PATH, docPath } from '../../src/lib/links.ts'
import { jsonLd, LOGO_PATH, structuredData, techArticle } from '../../src/lib/structured-data.ts'
import {
  IPHONE_OS,
  DOWNLOAD_URL,
  LICENCE_AMOUNT,
  LICENCE_CURRENCY,
  LICENCE_PRICE,
  OG_IMAGE,
  PLATFORM,
  REPO_URL,
  SITE_URL,
} from '../../src/site.ts'

const graph = structuredData(en)['@graph']
const app = graph.find((node) => node['@type'] === 'SoftwareApplication')
const site = graph.find((node) => node['@type'] === 'WebSite')

it('describes Devot as a macOS productivity app with the page description', () => {
  expect(structuredData(en)['@context']).toBe('https://schema.org')
  expect(app).toMatchObject({
    name: en.siteName,
    description: en.meta.description,
    url: SITE_URL,
    applicationCategory: 'ProductivityApplication',
    downloadUrl: DOWNLOAD_URL,
    image: new URL(OG_IMAGE.path, SITE_URL).href,
  })
})

it('states the platform the download requirements name, however the copy words them', () => {
  expect(app?.operatingSystem).toBe(`${PLATFORM.os}, ${IPHONE_OS}`)
  expect(app?.processorRequirements).toBe(PLATFORM.processor)
  expect(en.download.requirements).toContain(PLATFORM.os)
  expect(en.download.requirements).toContain(PLATFORM.processor)
  expect(en.download.requirements).toContain(IPHONE_OS)
})

it('describes each home page in its own language, at its own address', () => {
  for (const [locale, t, url] of [
    ['en', en, SITE_URL],
    ['zh-Hans', zhHans, `${SITE_URL}zh`],
  ] as const) {
    const page = structuredData(t, locale)['@graph'].find((node) => node['@type'] === 'WebPage')
    expect(page).toMatchObject({ url, inLanguage: locale, name: t.meta.title })
  }
})

it('places every docs page under the docs index as a TechArticle', () => {
  for (const page of en.docs.pages) {
    const url = new URL(docPath(page.slug), SITE_URL).href
    const [article, trail] = techArticle(en, page)['@graph']
    expect(article).toMatchObject({ '@type': 'TechArticle', headline: page.heading, url })
    expect(trail?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: en.siteName, item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: en.docs.index.heading,
        item: new URL(DOCS_PATH, SITE_URL).href,
      },
      { '@type': 'ListItem', position: 3, name: page.heading, item: url },
    ])
  }
})

it('offers the licence at the price the pricing section shows', () => {
  expect(app?.offers).toEqual({
    '@type': 'Offer',
    price: LICENCE_AMOUNT,
    priceCurrency: LICENCE_CURRENCY,
    url: new URL('/#pricing', SITE_URL).href,
  })
  expect(LICENCE_PRICE).toBe(`US$${LICENCE_AMOUNT}`)
  expect(LICENCE_CURRENCY).toBe('USD')
})

it('claims no ratings or reviews the site does not have', () => {
  expect(app).not.toHaveProperty('aggregateRating')
  expect(app).not.toHaveProperty('review')
})

it('names the website', () => {
  expect(site).toMatchObject({ name: en.siteName, url: SITE_URL })
})

it('serialises to JSON that cannot close its script element', () => {
  const text = jsonLd({ note: '</script><script>alert(1)</script>' })
  expect(text).not.toContain('<')
  expect(JSON.parse(text)).toEqual({ note: '</script><script>alert(1)</script>' })
})

it('names Devot as the organisation behind the app and the site, tied to its repository', () => {
  const organization = graph.find((node) => node['@type'] === 'Organization')
  expect(organization).toMatchObject({
    name: en.siteName,
    url: SITE_URL,
    logo: new URL(LOGO_PATH, SITE_URL).href,
    sameAs: [REPO_URL],
  })
  const id = organization?.['@id']
  expect(id).toBe(`${SITE_URL}#organization`)
  expect(app).toMatchObject({ publisher: { '@id': id } })
  expect(site).toMatchObject({ publisher: { '@id': id } })
})
