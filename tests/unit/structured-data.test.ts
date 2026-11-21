import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { zhHans } from '../../src/i18n/zh-Hans.ts'
import { DOCS_PATH, docPath } from '../../src/lib/links.ts'
import { jsonLd, LOGO_PATH, structuredData, techArticle } from '../../src/lib/structured-data.ts'
import {
  IPHONE_AMOUNT,
  IPHONE_OS,
  IPHONE_PRICE,
  DOWNLOAD_URL,
  LICENCE_AMOUNT,
  LICENCE_CURRENCY,
  LICENCE_PRICE,
  OG_IMAGE,
  PLATFORM,
  PLUGIN_REPO_URL,
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

it('offers the Mac licence and Devot Pro at the prices the pricing section shows', () => {
  const url = new URL('/#pricing', SITE_URL).href
  expect(app?.offers).toEqual([
    {
      '@type': 'Offer',
      name: en.pricing.licence.name,
      price: LICENCE_AMOUNT,
      priceCurrency: LICENCE_CURRENCY,
      url,
    },
    {
      '@type': 'Offer',
      name: `${en.siteName} Pro`,
      price: IPHONE_AMOUNT,
      priceCurrency: LICENCE_CURRENCY,
      url,
    },
  ])
  expect(LICENCE_PRICE).toBe(`US$${LICENCE_AMOUNT}`)
  expect(IPHONE_PRICE).toBe(`US$${IPHONE_AMOUNT}`)
  expect(en.pricing.iphone.body).toContain('Devot Pro')
  expect(en.pricing.iphone.body).toContain(IPHONE_PRICE)
  expect(LICENCE_CURRENCY).toBe('USD')
})

it('lists the features the home page names', () => {
  expect(app?.featureList).toEqual([
    ...en.features.items.map((item) => item.title),
    ...Object.values(en.cards.items).map((card) => card.label),
  ])
})

it('claims no ratings or reviews the site does not have', () => {
  expect(app).not.toHaveProperty('aggregateRating')
  expect(app).not.toHaveProperty('review')
})

it('names the website', () => {
  expect(site).toMatchObject({ name: en.siteName, url: SITE_URL })
})

it('carries the name, the app and the notes people search Devot by in the home title and description', () => {
  for (const words of [en.meta.title, en.meta.description]) {
    expect(words).toMatch(/^Devot\b/)
    expect(words).toMatch(/\bnotes app\b/)
  }
  expect(en.siteAlternateNames).toEqual(expect.arrayContaining(['Devot app', 'Devot Notes']))
  expect(en.siteAlternateNames).toContain(new URL(SITE_URL).hostname)
})

it('names the app and the site by the words people search for it with', () => {
  expect(en.siteAlternateNames.length).toBeGreaterThan(0)
  for (const name of en.siteAlternateNames) expect(name.toLowerCase()).toContain('devot')
  expect(site).toMatchObject({ name: en.siteName, alternateName: en.siteAlternateNames })
  expect(app).toMatchObject({ alternateName: en.siteAlternateNames, sameAs: [REPO_URL] })
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
    sameAs: [REPO_URL, PLUGIN_REPO_URL],
  })
  const id = organization?.['@id']
  expect(id).toBe(`${SITE_URL}#organization`)
  expect(app).toMatchObject({ publisher: { '@id': id } })
  expect(site).toMatchObject({ publisher: { '@id': id } })
})
