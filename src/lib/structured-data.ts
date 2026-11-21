import type { Messages } from '../i18n/en.ts'
import type { BlogPost } from '../i18n/en/blog.ts'
import type { ComparePage } from '../i18n/en/compare.ts'
import type { DocPage, DocRun } from '../i18n/en/docs.ts'
import type { LegalRun } from '../i18n/en/legal.ts'
import { localised, type Locale } from '../i18n/index.ts'
import {
  BLOG_PATH,
  blogPath,
  COMPARE_PATH,
  comparePath,
  DOCS_PATH,
  docPath,
  SUPPORT_PATH,
} from './links.ts'
import {
  IPHONE_AMOUNT,
  IPHONE_OS,
  DOWNLOAD_URL,
  LICENCE_AMOUNT,
  LICENCE_CURRENCY,
  OG_IMAGE,
  PLATFORM,
  PLUGIN_REPO_URL,
  REPO_URL,
  SITE_URL,
} from '../site.ts'

const ORGANIZATION_ID = `${SITE_URL}#organization`
/** The square icon search engines may show beside the site's name. */
export const LOGO_PATH = '/favicon-192.png'

const APP_ID = `${SITE_URL}#app`
const WEBSITE_ID = `${SITE_URL}#website`
const absolute = (path: string) => new URL(path, SITE_URL).href
const nodes = <T extends unknown[]>(...items: T): T => items

/** The words a reader sees in a run, without its link. */
export function plainRuns(runs: readonly (DocRun | LegalRun)[]): string {
  return runs
    .map((run) => (typeof run === 'string' ? run : 'text' in run ? run.text : run.code))
    .join('')
}

type FaqQuestion = { name: string; answer: readonly (DocRun | LegalRun)[] }

/** A schema.org `FAQPage` node, without `@context`, so it can sit in a graph. */
export function faqNode(locale: Locale, url: string, questions: readonly FaqQuestion[]) {
  return {
    '@type': 'FAQPage' as const,
    url,
    inLanguage: locale,
    mainEntity: questions.map((question) => ({
      '@type': 'Question' as const,
      name: question.name,
      acceptedAnswer: { '@type': 'Answer' as const, text: plainRuns(question.answer) },
    })),
  }
}

/** The support page's questions, as a schema.org `FAQPage` in that language. */
export function supportData(t: Messages, locale: Locale) {
  const questions = t.support.sections.flatMap((section) => section.questions ?? [])
  return {
    '@context': 'https://schema.org',
    ...faqNode(locale, absolute(localised(SUPPORT_PATH, locale)), questions),
  }
}

const compareQuestions = (page: ComparePage): FaqQuestion[] =>
  page.sections.flatMap((section) =>
    section.blocks.flatMap((block) =>
      block.kind === 'faq'
        ? block.items.map((item) => ({ name: item.question, answer: item.answer }))
        : [],
    ),
  )

/** The home page's schema.org description of Devot, from the facts the page itself shows. */
export function structuredData(t: Messages, locale: Locale = 'en') {
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
        sameAs: [REPO_URL, PLUGIN_REPO_URL],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': APP_ID,
        name: t.siteName,
        alternateName: t.siteAlternateNames,
        sameAs: [REPO_URL],
        publisher,
        description: t.meta.description,
        url: SITE_URL,
        image: new URL(OG_IMAGE.path, SITE_URL).href,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: `${PLATFORM.os}, ${IPHONE_OS}`,
        processorRequirements: PLATFORM.processor,
        downloadUrl: DOWNLOAD_URL,
        featureList: [
          ...t.features.items.map((item) => item.title),
          ...Object.values(t.cards.items).map((card) => card.label),
        ],
        offers: [
          {
            '@type': 'Offer',
            name: t.pricing.licence.name,
            price: LICENCE_AMOUNT,
            priceCurrency: LICENCE_CURRENCY,
            url: new URL('/#pricing', SITE_URL).href,
          },
          {
            '@type': 'Offer',
            name: `${t.siteName} Pro`,
            price: IPHONE_AMOUNT,
            priceCurrency: LICENCE_CURRENCY,
            url: new URL('/#pricing', SITE_URL).href,
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: t.siteName,
        alternateName: t.siteAlternateNames,
        url: SITE_URL,
        inLanguage: ['en', 'zh-Hans'] satisfies Locale[],
        publisher,
      },
      {
        '@type': 'WebPage',
        name: t.meta.title,
        description: t.meta.description,
        url: absolute(localised('/', locale)),
        inLanguage: locale,
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': APP_ID },
      },
    ],
  }
}

/** The trail from the home page to a page, as schema.org `BreadcrumbList`; the last step is the page. */
export function breadcrumbs(t: Messages, steps: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: t.siteName, path: '/' }, ...steps].map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absolute(step.path),
    })),
  }
}

/** A docs page as schema.org `TechArticle`, with its place under the docs index. */
export function techArticle(t: Messages, page: DocPage) {
  const url = absolute(docPath(page.slug))
  return {
    '@context': 'https://schema.org',
    '@graph': nodes(
      {
        '@type': 'TechArticle',
        headline: page.heading,
        description: page.description,
        url,
        mainEntityOfPage: url,
        inLanguage: 'en',
        about: { '@id': APP_ID },
        publisher: { '@id': ORGANIZATION_ID },
      },
      breadcrumbs(t, [
        { name: t.docs.index.heading, path: DOCS_PATH },
        { name: page.heading, path: docPath(page.slug) },
      ]),
    ),
  }
}

/** A comparison page as a schema.org `Article` about Devot, dated by when its facts were checked. */
export function comparison(t: Messages, page: ComparePage) {
  const url = absolute(comparePath(page.slug))
  return {
    '@context': 'https://schema.org',
    '@graph': nodes(
      {
        '@type': 'Article',
        headline: page.heading,
        description: page.description,
        dateModified: page.checked,
        url,
        mainEntityOfPage: url,
        inLanguage: 'en',
        about: { '@id': APP_ID },
        publisher: { '@id': ORGANIZATION_ID },
      },
      breadcrumbs(t, [
        { name: t.compare.index.heading, path: COMPARE_PATH },
        { name: page.heading, path: comparePath(page.slug) },
      ]),
      faqNode('en', url, compareQuestions(page)),
    ),
  }
}

/** A post's schema.org `BlogPosting`, published by the site itself, with its place under the blog. */
export function blogPosting(t: Messages, post: BlogPost) {
  const url = absolute(blogPath(post.slug))
  const organization = { '@type': 'Organization', name: t.siteName, url: SITE_URL }
  return {
    '@context': 'https://schema.org',
    '@graph': nodes(
      {
        '@type': 'BlogPosting',
        headline: post.heading,
        description: post.description,
        datePublished: post.published,
        dateModified: post.published,
        url,
        mainEntityOfPage: url,
        inLanguage: 'en',
        image: absolute(OG_IMAGE.path),
        author: organization,
        publisher: organization,
      },
      breadcrumbs(t, [
        { name: t.blog.index.heading, path: BLOG_PATH },
        { name: post.heading, path: blogPath(post.slug) },
      ]),
    ),
  }
}

/** JSON for a `<script type="application/ld+json">` body; `<` is escaped so no text can end the element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}
