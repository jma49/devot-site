import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { zhHans } from '../../src/i18n/zh-Hans.ts'
import { animationsDone } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
}
const COLUMNS = { desktop: 4, tablet: 2, phone: 1 }
const PAGES = [
  { path: '/', copy: en },
  { path: '/zh', copy: zhHans },
]

async function violations(page: Page): Promise<string[]> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .include('#edge')
    .analyze()
  return scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const size of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
    const viewport = VIEWPORTS[size]
    for (const { path, copy } of PAGES) {
      test.describe(`what sets Devot apart, ${path}, ${colorScheme}, ${size}`, () => {
        test.use({ colorScheme, viewport })

        test('names each claim, lays them out in columns and keeps every word inside its card', async ({
          page,
        }) => {
          await page.emulateMedia({ reducedMotion: 'reduce' })
          await page.goto(`${path}#edge`)
          await animationsDone(page)
          const section = page.getByRole('region', { name: copy.edge.label, exact: true })

          await expect(section).toHaveAttribute('id', 'edge')
          await expect(section.getByRole('heading', { level: 3 })).toHaveText(
            copy.edge.items.map((item) => `${item.name}${item.title}`),
          )
          for (const item of copy.edge.items)
            await expect(section.getByText(item.body, { exact: true })).toBeVisible()

          const boxes = await section.locator('.edge__item').evaluateAll((items) =>
            items.map((item) => {
              const box = item.getBoundingClientRect()
              const overflows = [...item.querySelectorAll('span, p')].some(
                (text) => text.scrollWidth > text.clientWidth + 1,
              )
              return { top: Math.round(box.top), left: box.left, right: box.right, overflows }
            }),
          )
          expect(new Set(boxes.slice(0, COLUMNS[size]).map((box) => box.top)).size).toBe(1)
          expect(new Set(boxes.map((box) => box.left)).size).toBe(COLUMNS[size])
          expect(boxes.filter((box) => box.overflows)).toEqual([])
          expect(Math.max(...boxes.map((box) => box.right))).toBeLessThanOrEqual(viewport.width)
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
            viewport.width,
          )
          expect(await violations(page)).toEqual([])
        })
      })
    }
  }
}
