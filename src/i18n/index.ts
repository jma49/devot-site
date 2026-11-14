import { en, type Messages } from './en.ts'
import { pagePath } from '../lib/page-path.ts'
import { zhHans } from './zh-Hans.ts'

export const LOCALES = { en, 'zh-Hans': zhHans } satisfies Record<string, Messages>

export type Locale = keyof typeof LOCALES

const PREFIX: Record<Locale, string> = { en: '', 'zh-Hans': '/zh' }

/** The English paths of the pages that have every language; the rest stay English. */
const TRANSLATED = ['/', '/support']

export function messages(locale: Locale = 'en'): Messages {
  return LOCALES[locale]
}

/** The language a page at `pathname` is written in. */
export function localeOf(pathname: string): Locale {
  return /^\/zh(?:\/|$)/.test(pagePath(pathname)) ? 'zh-Hans' : 'en'
}

function englishPath(pathname: string): string {
  const path = pagePath(pathname)
  const locale = localeOf(path)
  return locale === 'en' ? path : path.slice(PREFIX[locale].length) || '/'
}

const withPrefix = (path: string, locale: Locale) =>
  path === '/' ? PREFIX[locale] || '/' : `${PREFIX[locale]}${path}`

export function translated(pathname: string): boolean {
  return TRANSLATED.includes(englishPath(pathname))
}

/** `href` as a page in `locale` links it: to that language's page where there is one. */
export function localised(href: string, locale: Locale): string {
  if (locale === 'en' || !href.startsWith('/')) return href
  const [path = '/', fragment] = href.split('#')
  if (!translated(path)) return href
  const target = withPrefix(path, locale)
  return fragment === undefined ? target : `${target}#${fragment}`
}

/** The same page in every language, for `hreflang` links and the language switch. */
export function alternates(pathname: string): { locale: Locale; path: string }[] {
  if (!translated(pathname)) return []
  const path = englishPath(pathname)
  return (Object.keys(LOCALES) as Locale[]).map((locale) => ({
    locale,
    path: withPrefix(path, locale),
  }))
}
