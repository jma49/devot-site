import type { Messages } from '../i18n/en.ts'
import type { BlogPost } from '../i18n/en/blog.ts'
import { blogPath } from './links.ts'
import {
  DOWNLOAD_URL,
  LICENCE_AMOUNT,
  LICENCE_CURRENCY,
  OG_IMAGE,
  PLATFORM,
  SITE_URL,
} from '../site.ts'

/** The home page's schema.org description of Devot, from the facts the page itself shows. */
export function structuredData(t: Messages) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: t.siteName,
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
      { '@type': 'WebSite', name: t.siteName, url: SITE_URL },
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
