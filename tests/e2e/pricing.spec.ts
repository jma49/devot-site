import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { BUY_URL, LICENCE_PRICE, RESEND_URL } from '../../src/site.ts'
import { animationsDone, scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }

async function violations(page: Page, selector?: string): Promise<string[]> {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
  ])
  const scan = await (selector ? builder.include(selector) : builder).analyze()
  return scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)
}

async function openPricing(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#pricing')
  await animationsDone(page)
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [size, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`pricing, ${colorScheme}, ${size}`, () => {
      test.use({ colorScheme, viewport })

      test('shows the plans, the price and a Buy button for the licence service', async ({
        page,
      }) => {
        await openPricing(page)
        const section = page.getByRole('region', { name: en.pricing.label, exact: true })

        await expect(section.getByRole('heading', { level: 2 })).toBeVisible()
        await expect(section.getByText(LICENCE_PRICE, { exact: true })).toBeVisible()
        const buy = section.getByRole('link', { name: en.pricing.licence.buy })
        await expect(buy).toHaveAttribute('href', BUY_URL)
        await expect(buy).toHaveAccessibleDescription(en.pricing.licence.refund)
        await expect(section.getByRole('link', { name: en.pricing.links.terms })).toHaveAttribute(
          'href',
          '/terms',
        )
        await expect(section.getByRole('link', { name: en.pricing.links.refunds })).toHaveAttribute(
          'href',
          '/refunds',
        )
        await expect(section.getByRole('link', { name: en.pricing.links.lostKey })).toHaveAttribute(
          'href',
          RESEND_URL,
        )
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
        expect(await violations(page, '#pricing')).toEqual([])
      })

      test('lays the plans side by side on wide screens and stacks them on phones', async ({
        page,
      }) => {
        await openPricing(page)
        const [free, licence] = await Promise.all(
          ['.pricing__plan--free', '.pricing__plan--licence'].map((selector) =>
            page.locator(selector).boundingBox(),
          ),
        )
        if (size === 'desktop') expect(licence?.y).toBe(free?.y)
        else expect(licence?.y).toBeGreaterThan((free?.y ?? 0) + (free?.height ?? 0) - 1)
      })

      for (const [path, copy] of [
        ['/terms', en.terms],
        ['/refunds', en.refunds],
      ] as const) {
        test(`serves ${path} with its heading, sections and a scan without findings`, async ({
          page,
        }) => {
          await page.emulateMedia({ reducedMotion: 'reduce' })
          await page.goto(path)
          await animationsDone(page)

          await expect(page).toHaveTitle(copy.title)
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.heading)
          await expect(page.getByRole('heading', { level: 2 })).toHaveCount(copy.sections.length)
          await expect(page.getByRole('link', { name: en.legal.backToPricing })).toHaveAttribute(
            'href',
            '/#pricing',
          )
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
            viewport.width,
          )
          expect(await violations(page)).toEqual([])
        })
      }
    })
  }
}

test('opens the terms from the pricing section', async ({ page }) => {
  await openPricing(page)
  await page
    .getByRole('region', { name: en.pricing.label, exact: true })
    .getByRole('link', { name: en.pricing.links.terms })
    .click()

  await expect(page).toHaveURL(/\/terms$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.terms.heading)
})

test('hides the download pill once the pricing section, with its own buttons, comes into view', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORTS.phone)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const pill = page.locator('[data-download-pill]')

  await scrollToY(page, 1200)
  await expect(pill).toBeVisible()
  const top = await page
    .locator('#pricing')
    .evaluate((element) => element.getBoundingClientRect().top + window.scrollY)
  await scrollToY(page, top - VIEWPORTS.phone.height / 2)
  await expect(pill).toBeHidden()
})
