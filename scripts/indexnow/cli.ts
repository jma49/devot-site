import { INDEXNOW_ENDPOINT, indexNowPayload, sitemapUrls } from '../../src/lib/indexnow.ts'
import { SITE_URL } from '../../src/site.ts'

// Run after a deploy: tells IndexNow engines (Bing, Yandex and others) about every page in the
// live sitemap, so new pages are crawled within hours instead of waiting to be found.
async function text(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`E_INDEXNOW_FETCH ${response.status} ${url}`)
  return response.text()
}

const index = await text(new URL('sitemap-index.xml', SITE_URL).href)
const parts = await Promise.all(sitemapUrls(index).map(text))
const payload = indexNowPayload(parts.flatMap(sitemapUrls))
const response = await fetch(INDEXNOW_ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
})
console.log(`IndexNow ${response.status}: ${payload.urlList.length} URLs`)
if (response.status >= 300) process.exitCode = 1
