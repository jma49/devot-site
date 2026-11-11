import { expect, it } from 'vitest'
import { INDEXNOW_KEY, indexNowPayload, sitemapUrls } from '../../src/lib/indexnow.ts'
import { SITE_URL } from '../../src/site.ts'
import { readRepoFile } from '../support/source-files.ts'

it('serves the key at the site root, as IndexNow checks it', () => {
  expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/)
  expect(readRepoFile(`public/${INDEXNOW_KEY}.txt`).trim()).toBe(INDEXNOW_KEY)
})

it('reads the addresses of a sitemap in order', () => {
  const xml =
    '<urlset><url><loc>https://devot.online/</loc></url><url><loc>https://devot.online/docs</loc></url></urlset>'
  expect(sitemapUrls(xml)).toEqual(['https://devot.online/', 'https://devot.online/docs'])
})

it('submits only the site own pages, with the key and where to find it', () => {
  expect(
    indexNowPayload(['https://devot.online/', 'https://devot.online/blog', 'https://example.com/']),
  ).toEqual({
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: `https://devot.online/${INDEXNOW_KEY}.txt`,
    urlList: ['https://devot.online/', 'https://devot.online/blog'],
  })
})
