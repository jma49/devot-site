import { expect, it } from 'vitest'
import { pagePath } from '../../src/lib/page-path.ts'

it('serves each page at its name, the home page at the root', () => {
  expect(pagePath('/index.html')).toBe('/')
  expect(pagePath('/')).toBe('/')
  expect(pagePath('/terms.html')).toBe('/terms')
  expect(pagePath('/terms')).toBe('/terms')
})
