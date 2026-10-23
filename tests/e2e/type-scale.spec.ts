import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

/** Each colour as the browser resolves it to sRGB, then its WCAG relative luminance. */
const luminances = (page: Page, colours: Record<string, string>) =>
  page.evaluate((entries) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const probe = document.createElement('span')
    document.body.append(probe)
    const out: Record<string, number> = {}
    for (const [name, value] of Object.entries(entries)) {
      probe.style.setProperty('color', value)
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = getComputedStyle(probe).color
      context.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0] = [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)].map(
        (channel) => {
          const c = channel / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        },
      )
      out[name] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    probe.remove()
    return out
  }, colours)

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

for (const colorScheme of ['light', 'dark'] as const) {
  test(`keeps the secondary and tertiary text tiers apart and readable, ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme })
    await page.goto('/')
    const l = await luminances(page, {
      primary: 'var(--site-color-text)',
      secondary: 'var(--site-color-text-muted)',
      tertiary: 'var(--site-color-text-faint)',
      page: 'var(--site-color-page)',
      card: 'var(--color-surface-list)',
    })
    for (const tier of ['secondary', 'tertiary'] as const) {
      for (const surface of ['page', 'card'] as const) {
        expect(contrast(l[tier]!, l[surface]!), `${tier} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    expect(contrast(l['secondary']!, l['tertiary']!), 'secondary against tertiary').toBeGreaterThan(
      1.5,
    )
    expect(contrast(l['primary']!, l['secondary']!), 'primary against secondary').toBeGreaterThan(
      1.5,
    )
  })
}

test('sets every section heading in one tier and every card heading in another', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const type = (selector: string) =>
    page.locator(selector).evaluateAll((all) =>
      all.map((element) => {
        const style = getComputedStyle(element)
        return `${style.fontSize} ${style.fontWeight}`
      }),
    )
  const sections = await type('#write h2, #cards h2, #local-first h2')
  expect(sections.length).toBeGreaterThanOrEqual(3)
  expect(new Set(sections).size).toBe(1)
  const cards = await type('#cards h3, .features-list .feature-title, .status-demo-heading')
  expect(new Set(cards).size).toBe(1)
  expect(parseFloat(cards[0] ?? '0')).toBeGreaterThanOrEqual(17)
  expect(parseFloat(cards[0] ?? '0')).toBeLessThan(parseFloat(sections[0] ?? '0') / 1.5)
})
