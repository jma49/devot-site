import { readRepoFile } from './source-files.ts'

/** `detach` lists the `! Name` lines, which drop a default header or one set by a broader rule. */
export type HeaderRule = {
  pattern: string
  headers: [name: string, value: string][]
  detach: string[]
}

/** Parses a Cloudflare `_headers` file: a URL pattern line, then indented `Name: value` lines. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [], detach: [] })
      continue
    }
    const rule = rules.at(-1)
    if (!rule) throw new Error(`E_HEADERS_SYNTAX header before any URL pattern: ${line.trim()}`)
    const entry = line.trim()
    if (entry.startsWith('!')) {
      rule.detach.push(entry.slice(1).trim())
      continue
    }
    const colon = entry.indexOf(':')
    if (colon < 1) throw new Error(`E_HEADERS_SYNTAX not a header line: ${entry}`)
    rule.headers.push([entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()])
  }
  return rules
}

export function siteCsp(text = readRepoFile('public/_headers')): string {
  const values = parseHeaders(text).flatMap(({ headers }) =>
    headers.filter(([name]) => name.toLowerCase() === 'content-security-policy').map(([, v]) => v),
  )
  if (values.length !== 1)
    throw new Error(`E_HEADERS_CSP expected one policy, found ${values.length}`)
  return values[0] as string
}

export function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name as string, sources]),
  )
}

/**
 * Whether a CSP source list lets a page at `base` load `url`. Covers the source forms public/_headers
 * uses: 'self' and https host sources, with an optional path.
 */
export function allows(sources: string[], url: string, base: string): boolean {
  const target = new URL(url, base)
  return sources.some((source) => {
    if (source === "'self'") return target.origin === new URL(base).origin
    if (!source.startsWith('https://')) return false
    const allowed = new URL(source)
    if (target.protocol !== 'https:' || target.host !== allowed.host) return false
    return allowed.pathname.endsWith('/')
      ? target.pathname.startsWith(allowed.pathname)
      : target.pathname === allowed.pathname
  })
}
