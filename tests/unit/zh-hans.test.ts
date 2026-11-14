import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { zhHans } from '../../src/i18n/zh-Hans.ts'
import { IPHONE_PRICE, LICENCE_PRICE, PRIVACY_EMAIL } from '../../src/site.ts'

// The namespaces the Chinese pages show; the docs, blog and legal pages stay English.
const TRANSLATED = [
  'download',
  'meta',
  'notFound',
  'chrome',
  'hero',
  'install',
  'whatsNew',
  'iphone',
  'features',
  'cards',
  'privacy',
  'closing',
  'footer',
  'pricing',
  'legal',
  'support',
  'media',
  'demo',
  'clipControl',
] as const

// Text that reads the same in both languages: names, keys, codes and prices.
const SAME = new Set([
  'iPhone',
  'GitHub',
  'AI',
  'Pro',
  'book:',
  'tag:',
  'status:',
  '[[',
  '{{date}}',
  '{{title}}',
  '⇧⌘D',
  '⇥',
  '⌘K',
  '⌥⌘Y',
  '⌘T',
  'write',
  'organise',
  'find',
  'active',
  'on_hold',
  'completed',
  'dropped',
  'none',
  LICENCE_PRICE,
  IPHONE_PRICE,
  PRIVACY_EMAIL,
])

function leaves(value: unknown, path: string, out: Map<string, string>): Map<string, string> {
  if (typeof value === 'string') out.set(path, value)
  else if (typeof value === 'function') leaves(value('Name', 1, 2), `${path}()`, out)
  else if (value !== null && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) leaves(child, `${path}.${key}`, out)
  return out
}

describe('the Simplified Chinese catalog', () => {
  it('translates every text of the pages it covers', () => {
    const untranslated = TRANSLATED.flatMap((namespace) => {
      const chinese = leaves(zhHans[namespace], namespace, new Map())
      return [...leaves(en[namespace], namespace, new Map())]
        .filter(([path, text]) => chinese.get(path) === text && !SAME.has(text))
        .filter(([path]) => !path.endsWith('.link') && path !== 'footer.copyright()')
        .map(([path]) => path)
    })
    expect(untranslated).toEqual([])
  })

  it('has the shape of the English one, run for run', () => {
    for (const namespace of TRANSLATED) {
      expect([...leaves(zhHans[namespace], namespace, new Map()).keys()]).toEqual([
        ...leaves(en[namespace], namespace, new Map()).keys(),
      ])
    }
  })

  it('keeps the English of the pages it does not cover', () => {
    expect(zhHans.docs).toBe(en.docs)
    expect(zhHans.blog).toBe(en.blog)
    expect(zhHans.terms).toBe(en.terms)
  })

  it('names its own language for the switch on the English pages', () => {
    expect(en.chrome.language.name).toBe('English')
    expect(zhHans.chrome.language.name).not.toBe('English')
  })
})
