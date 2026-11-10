import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { jsonLd, structuredData } from '../../src/lib/structured-data.ts'
import {
  DOWNLOAD_URL,
  LICENCE_AMOUNT,
  LICENCE_CURRENCY,
  LICENCE_PRICE,
  OG_IMAGE,
  PLATFORM,
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
  expect(app?.operatingSystem).toBe(PLATFORM.os)
  expect(app?.processorRequirements).toBe(PLATFORM.processor)
  expect(en.download.requirements).toContain(PLATFORM.os)
  expect(en.download.requirements).toContain(PLATFORM.processor)
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
