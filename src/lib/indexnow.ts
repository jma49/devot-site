import { SITE_URL } from '../site.ts'

/**
 * The site's IndexNow key, served as `public/<key>.txt` so search engines can check that a
 * submission comes from the site. It is public by design: it proves ownership, it grants nothing.
 */
export const INDEXNOW_KEY = '913f9e6ffba4f1ea55f4d50e33af6ccc'
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/** The `<loc>` addresses of a sitemap, in order. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')
}

/** The body IndexNow takes for a list of the site's own addresses; any other host is left out. */
export function indexNowPayload(urls: string[]) {
  const site = new URL(SITE_URL)
  return {
    host: site.host,
    key: INDEXNOW_KEY,
    keyLocation: new URL(`/${INDEXNOW_KEY}.txt`, site).href,
    urlList: urls.filter((url) => new URL(url).host === site.host),
  }
}
