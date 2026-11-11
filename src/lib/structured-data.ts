import type { Messages } from '../i18n/en.ts'
import type { BlogPost } from '../i18n/en/blog.ts'
import { blogPath } from './links.ts'
import {
  DOWNLOAD_URL,
  LICENCE_AMOUNT,
  LICENCE_CURRENCY,
  OG_IMAGE,
  PLATFORM,
  REPO_URL,
  SITE_URL,
} from '../site.ts'

const ORGANIZATION_ID = `${SITE_URL}#organization`
/** The square icon search engines may show beside the site's name. */
export const LOGO_PATH = '/favicon-192.png'

/** The home page's schema.org description of Devot, from the facts the page itself shows. */
export function structuredData(t: Messages) {
  const publisher = { '@id': ORGANIZATION_ID }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: t.siteName,
        url: SITE_URL,
        logo: new URL(LOGO_PATH, SITE_URL).href,
        sameAs: [REPO_URL],
      },
      {
        '@type': 'SoftwareApplication',
        name: t.siteName,
        publisher,
        description: t.meta.description,
        url: SITE_URL,
        image: new URL(OG_IMAGE.path, SITE_URL).href,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: PLATFORM.os,
        processorRequirements: PLATFORM.processor,
        downloadUrl: DOWNLOAD_URL,
        offers: {
          '@type': 'Offer',
          price: LICENCE_AMOUNT,
          priceCurrency: LICENCE_CURRENCY,
          url: new URL('/#pricing', SITE_URL).href,
        },
      },
      { '@type': 'WebSite', name: t.siteName, url: SITE_URL, publisher },
    ],
  }
}

/** A post's schema.org `BlogPosting`, published by the site itself. */
export function blogPosting(t: Messages, post: BlogPost) {
  const url = new URL(blogPath(post.slug), SITE_URL).href
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.heading,
    description: post.description,
    datePublished: post.published,
    url,
    mainEntityOfPage: url,
    image: new URL(OG_IMAGE.path, SITE_URL).href,
    author: { '@type': 'Organization', name: t.siteName, url: SITE_URL },
    publisher: { '@type': 'Organization', name: t.siteName, url: SITE_URL },
  }
}

/** JSON for a `<script type="application/ld+json">` body; `<` is escaped so no text can end the element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}
