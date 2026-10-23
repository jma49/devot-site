import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

const controls = (page: Page) => page.locator('.clip-control')
const clip = (page: Page, slot: string) => page.locator(`video[data-clip="${slot}"]`)
const control = (page: Page, slot: string) => page.locator(`.clip-control[data-for="${slot}"]`)
const centre = (locator: Locator) =>
  locator.evaluate((element) => element.scrollIntoView({ block: 'center' }))
const isPlaying = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)

test.describe('without a motion preference', () => {
  test.use({ viewport: DESKTOP })

  test('adds no play buttons and leaves the clips looping', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect(page.locator('[data-features-ready]')).toHaveCount(1)
    await expect(controls(page)).toHaveCount(0)
    for (const video of await page.locator('video[data-clip]').all()) {
      expect(await video.evaluate((v: HTMLVideoElement) => v.loop)).toBe(true)
    }
  })
})

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`with reduced motion, at ${viewport.width}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await expect(page.locator('[data-features-ready]')).toHaveCount(1)
    })

    test('gives every clip a labelled play button of at least 24 px', async ({ page }) => {
      const slots = await page
        .locator('video[data-clip]')
        .evaluateAll((videos) => videos.map((v) => (v as HTMLVideoElement).dataset.clip))
      await expect(controls(page)).toHaveCount(slots.length)
      for (const slot of slots) {
        const button = control(page, slot ?? '')
        await expect(button).toHaveAccessibleName(en.clipControl.label)
        await expect(button).toHaveAttribute('aria-pressed', 'false')
        await centre(button)
        const box = await button.boundingBox()
        expect(box?.width ?? 0, slot).toBeGreaterThanOrEqual(24)
        expect(box?.height ?? 0, slot).toBeGreaterThanOrEqual(24)
        expect(box?.x ?? -1, slot).toBeGreaterThanOrEqual(0)
        expect((box?.x ?? 0) + (box?.width ?? 0), slot).toBeLessThanOrEqual(viewport.width)
        const onTop = await button.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return hit === element || element.contains(hit)
        })
        expect(onTop, `${slot} is covered`).toBe(true)
      }
    })

    test('plays a clip once through when pressed, and stops it when pressed again', async ({
      page,
    }) => {
      const video = clip(page, 'card-2')
      const button = control(page, 'card-2')
      await centre(button)

      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)
      expect(await video.evaluate((v: HTMLVideoElement) => v.loop)).toBe(false)

      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    })

    test('lets the button go when the loop ends', async ({ page }) => {
      const video = clip(page, 'card-3')
      const button = control(page, 'card-3')
      await centre(button)
      await button.click()
      await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)
      await video.evaluate((v: HTMLVideoElement) => {
        v.currentTime = Math.max(0, v.duration - 0.3)
      })

      await expect(button).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })
      expect(await video.evaluate((v: HTMLVideoElement) => v.ended && v.paused)).toBe(true)
    })

    test('plays one clip at a time', async ({ page }) => {
      await centre(page.locator('#cards .cards-grid'))
      await control(page, 'card-2').click()
      await expect.poll(() => isPlaying(clip(page, 'card-2')), { timeout: 10_000 }).toBe(true)

      await centre(control(page, 'card-3'))
      await control(page, 'card-3').click()

      await expect(control(page, 'card-2')).toHaveAttribute('aria-pressed', 'false')
      expect(await clip(page, 'card-2').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
      await expect(control(page, 'card-3')).toHaveAttribute('aria-pressed', 'true')
    })

    test('stops a clip that scrolls out of view', async ({ page }) => {
      const button = control(page, 'card-2')
      await centre(button)
      await button.click()
      await expect.poll(() => isPlaying(clip(page, 'card-2')), { timeout: 10_000 }).toBe(true)

      await page.evaluate(() => window.scrollTo(0, 0))

      await expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(await clip(page, 'card-2').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    })

    test('answers Space from the keyboard and raises its card', async ({ page }) => {
      const button = control(page, 'card-2')
      const card = page.locator('#cards .card[data-slot="card-2"]')
      await centre(button)
      const rest = await card.evaluate((c) => getComputedStyle(c).backgroundColor)

      await button.focus()
      await page.keyboard.press('Space')

      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(button).toHaveCSS('outline-style', 'solid')
      expect(await card.evaluate((c) => getComputedStyle(c).backgroundColor)).not.toBe(rest)
    })
  })
}

test.describe('when the preference changes', () => {
  test.use({ viewport: DESKTOP })

  test('adds the buttons with reduced motion and takes them away again without it', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect(page.locator('[data-features-ready]')).toHaveCount(1)
    await expect(controls(page)).toHaveCount(0)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(controls(page)).not.toHaveCount(0)
    await centre(control(page, 'card-2'))
    await control(page, 'card-2').click()
    await expect(control(page, 'card-2')).toHaveAttribute('aria-pressed', 'true')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(controls(page)).toHaveCount(0)
    expect(await clip(page, 'card-2').evaluate((v: HTMLVideoElement) => v.loop)).toBe(true)
  })
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes an accessibility scan with the buttons, in the ${colorScheme} appearance`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(controls(page)).not.toHaveCount(0)
    await centre(control(page, 'card-2'))
    await control(page, 'card-2').click()
    await expect(control(page, 'card-2')).toHaveAttribute('aria-pressed', 'true')

    const scan = await new AxeBuilder({ page })
      .include('#cards')
      .include('#write')
      .include('#hero')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    expect(scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)).toEqual([])
  })
}
