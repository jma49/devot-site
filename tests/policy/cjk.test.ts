import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'
import { REPO, readRepoFile } from '../support/source-files.ts'

// Chinese copy lives only in its catalog, so every other file stays readable to every contributor.
const TRANSLATIONS = [/^src\/i18n\/zh-Hans\.ts$/, /^src\/i18n\/zh-Hans\//]
const CJK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|mp4|webm|mov|woff2?|ttf|otf|pdf|zip)$/i

const translation = (file: string) => TRANSLATIONS.some((pattern) => pattern.test(file))

it('keeps CJK characters out of every tracked file but the translations', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
    .split('\n')
    .filter((file) => file !== '' && !BINARY.test(file) && !translation(file))
  expect(tracked.length).toBeGreaterThan(0)
  expect(tracked.filter((file) => CJK.test(readRepoFile(file)))).toEqual([])
})

it('allows the translations and nothing beside them', () => {
  expect(translation('src/i18n/zh-Hans.ts')).toBe(true)
  expect(translation('src/i18n/zh-Hans/hero.ts')).toBe(true)
  expect(translation('src/i18n/en/hero.ts')).toBe(false)
  expect(translation('src/i18n/zh-Hans-extra.ts')).toBe(false)
  expect(translation('src/pages/zh/index.astro')).toBe(false)
})
