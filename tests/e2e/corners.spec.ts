import { expect, test } from '@playwright/test'

const box = (page: import('@playwright/test').Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const { offsetLeft, offsetWidth } = element as HTMLElement
      return {
        left: offsetLeft,
        width: offsetWidth,
        radius: parseFloat(getComputedStyle(element).borderTopLeftRadius),
      }
    })

// The clips hold the real window, whose 26 pt corner has the wallpaper outside it.
test('every frame rounds past the window corner the clip holds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const hero = await box(page, '.hero-frame')
  expect(hero.radius).toBeCloseTo((27 * hero.width) / 1280, 0)
  const feature = await box(page, '.feature-window')
  expect(feature.radius).toBeCloseTo((27 * feature.width) / 672, 0)
  const card = await box(page, '.card[data-slot="card-2"] .card-window')
  expect(card.radius).toBeCloseTo((27 * card.width) / 400, 0)
})

test('a feature window sits concentric in its well', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const well = await box(page, '.feature-well')
  const window = await box(page, '.feature-window')
  const inset = window.left
  expect(well.radius).toBeCloseTo(window.radius + inset, 0)
})
