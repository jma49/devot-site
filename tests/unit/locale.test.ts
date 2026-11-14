import { describe, expect, it } from 'vitest'
import { alternates, localeOf, localised, translated } from '../../src/i18n/index.ts'

describe('localeOf', () => {
  it('reads Simplified Chinese from the /zh pages and English from the rest', () => {
    expect(localeOf('/zh')).toBe('zh-Hans')
    expect(localeOf('/zh.html')).toBe('zh-Hans')
    expect(localeOf('/zh/support')).toBe('zh-Hans')
    expect(localeOf('/zh/support.html')).toBe('zh-Hans')
    expect(localeOf('/')).toBe('en')
    expect(localeOf('/support')).toBe('en')
    expect(localeOf('/zhuyin')).toBe('en')
  })
})

describe('localised', () => {
  it('points the translated pages and the home sections at their Chinese pages', () => {
    expect(localised('/', 'zh-Hans')).toBe('/zh')
    expect(localised('/#pricing', 'zh-Hans')).toBe('/zh#pricing')
    expect(localised('/support', 'zh-Hans')).toBe('/zh/support')
  })

  it('leaves pages without a translation, other sites and English links as they are', () => {
    expect(localised('/terms', 'zh-Hans')).toBe('/terms')
    expect(localised('/docs/install', 'zh-Hans')).toBe('/docs/install')
    expect(localised('https://github.com/jma49/devot', 'zh-Hans')).toBe(
      'https://github.com/jma49/devot',
    )
    expect(localised('mailto:a@b.c', 'zh-Hans')).toBe('mailto:a@b.c')
    expect(localised('/#pricing', 'en')).toBe('/#pricing')
  })
})

describe('alternates', () => {
  it('names each language of a translated page, English as the default', () => {
    expect(alternates('/zh/support')).toEqual([
      { locale: 'en', path: '/support' },
      { locale: 'zh-Hans', path: '/zh/support' },
    ])
    expect(alternates('/')).toEqual([
      { locale: 'en', path: '/' },
      { locale: 'zh-Hans', path: '/zh' },
    ])
  })

  it('has none for a page in English only', () => {
    expect(alternates('/terms')).toEqual([])
    expect(translated('/terms')).toBe(false)
    expect(translated('/support.html')).toBe(true)
  })
})
