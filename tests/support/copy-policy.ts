import { tags } from './html.ts'

const LABEL_ATTRIBUTES = ['alt', 'title', 'aria-label', 'aria-description', 'placeholder']
const LABEL_LITERALS = new RegExp(`\\b(${LABEL_ATTRIBUTES.join('|')})\\s*=\\s*(["'])(.*?)\\2`, 'g')
/** Meta tags whose content search results and link previews show. */
const COPY_META = new Set([
  'description',
  'og:title',
  'og:description',
  'og:site_name',
  'og:image:alt',
  'twitter:title',
  'twitter:description',
])
const LETTER = /\p{L}/u

/** Text an .astro template writes out literally instead of taking from src/i18n. */
export function inlineCopy(astro: string): string[] {
  const { markup, literals } = splitExpressions(
    astro
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
      .replace(/<!--[\s\S]*?-->/g, ''),
  )
  const meta = tags(markup, 'meta')
    .filter(({ attrs }) => isCopyMeta(attrs) && LETTER.test(attrs.get('content') ?? ''))
    .map(({ attrs }) => `content="${attrs.get('content')}"`)
  const labels = [...markup.matchAll(LABEL_LITERALS)]
    .filter((match) => LETTER.test(match[3] ?? ''))
    .map((match) => match[0])
  const text = markup
    .replace(/<[^>]*>/g, '\n')
    .replace(/&[a-z]+;|&#\w+;/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => LETTER.test(line))
  return [...meta, ...labels, ...literals, ...text]
}

/** Every piece of text a built page shows or hands to search results and link previews. */
export function pageCopy(html: string): string[] {
  const page = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  const attributes = tags(page).flatMap(({ name, attrs }) => [
    ...LABEL_ATTRIBUTES.map((attr) => attrs.get(attr)),
    name === 'meta' && isCopyMeta(attrs) ? attrs.get('content') : undefined,
  ])
  const text = page.replace(/<[^>]*>/g, '\n').split('\n')
  return [...attributes, ...text]
    .map((value) => decodeEntities(value ?? '').trim())
    .filter((value) => LETTER.test(value))
}

/** Every string in a message catalog, trimmed; functions are called with `args`. */
export function catalogStrings(catalog: unknown, args: unknown[]): Set<string> {
  const strings = new Set<string>()
  const walk = (value: unknown): void => {
    if (typeof value === 'string') strings.add(value.trim())
    else if (typeof value === 'function') walk((value as (...a: unknown[]) => unknown)(...args))
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(catalog)
  return strings
}

function isCopyMeta(attrs: Map<string, string>): boolean {
  return COPY_META.has(attrs.get('name') ?? attrs.get('property') ?? '')
}

/**
 * The template without its `{…}` expressions, plus the text-position expressions that are only a
 * string or template literal with words in it. `{' '}` and attribute values stay allowed.
 */
function splitExpressions(markup: string): { markup: string; literals: string[] } {
  let out = ''
  let expression = ''
  let depth = 0
  let inAttribute = false
  const literals: string[] = []
  for (const char of markup) {
    if (char === '{') {
      if (depth === 0) {
        expression = ''
        inAttribute = /=\s*$/.test(out)
      } else expression += char
      depth++
    } else if (char === '}' && depth > 0) {
      depth--
      if (depth > 0) expression += char
      else if (!inAttribute && isCopyLiteral(expression)) literals.push(`{${expression}}`)
    } else if (depth > 0) expression += char
    else out += char
  }
  return { markup: out, literals }
}

function isCopyLiteral(expression: string): boolean {
  const literal = /^\s*(['"`])([\s\S]*)\1\s*$/.exec(expression)
  return literal !== null && LETTER.test((literal[2] ?? '').replace(/\$\{[^}]*\}/g, ''))
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '©',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(parseInt(name.slice(2), 16))
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10))
    return ENTITIES[name.toLowerCase()] ?? entity
  })
}
