import type { Locator, Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { APP_STORE_URL } from '../../src/site.ts'
import { scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const desktop = { width: 1440, height: 900 }
const narrow = { width: 390, height: 844 }

const root = (page: Page) => page.locator('html')
const hero = (page: Page) => page.locator('[data-hero]')
const heroClip = (page: Page) => page.locator('video[data-clip="hero"]')
const phone = (page: Page) => page.locator('[data-hero-phone]')
const isPlaying = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2)
const source = (video: Locator) => video.evaluate((v: HTMLVideoElement) => v.currentSrc)
const pageColour = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)

// The home page is one night under one sky, whatever the reader's scheme.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`the home page at night, on a ${colorScheme} system`, () => {
    test.use({ viewport: desktop, colorScheme })

    test('wears the dark appearance from its root, and keeps it down the page', async ({
      page,
      browser,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await expect(root(page)).toHaveAttribute('data-scope', 'dark')
      await expect(root(page)).toHaveAttribute('data-appearance-preview', 'dark')
      await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1)
      await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark')

      // The page colour of a dark system, which a light system gets here too.
      const dark = await browser.newPage({ colorScheme: 'dark' })
      await dark.goto('/')
      const night = await pageColour(dark)
      await dark.close()
      expect(await pageColour(page)).toBe(night)

      // Its parts move by transform, which must not count as the page moving under the reader.
      await expect(hero(page)).toHaveCSS('overflow-anchor', 'none')
      await scrollToY(page, 0.6 * desktop.height)
      await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
      await expect(root(page)).toHaveAttribute('data-scope', 'dark')
      expect(await pageColour(page)).toBe(night)
    })

    test('shows the dark recordings and the dark doves', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
      expect(await source(heroClip(page))).toMatch(/\/media\/hero\/hero-dark\.(webm|mp4)$/)
      await expect(page.locator('.hero-frame video')).toHaveCount(1)
      const mark = await page
        .locator('.site-header .brand-mark')
        .evaluate((element) => getComputedStyle(element).backgroundImage)
      expect(mark).toMatch(/\/dove-small-dark\.[\w-]+\.svg"?\)$/)

      const card = page.locator('video[data-clip="card-1"]')
      await card.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await expect.poll(() => source(card), { timeout: 10_000 }).toMatch(/card-1-dark\./)
    })

    test('plays the iPhone beside the window whenever the hero clip plays', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
      await expect.poll(() => isPlaying(phone(page)), { timeout: 10_000 }).toBe(true)
      expect(await source(phone(page))).toMatch(/\/_astro\/p2-read-dark\.[\w-]+\.mp4$/)

      // Past the hero the clip rests, and the phone with it.
      await page.locator('#cards').evaluate((section) => section.scrollIntoView())
      await expect.poll(() => heroClip(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
      await expect.poll(() => phone(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    })

    test('keeps one sky behind the whole page, out of the way', async ({ page }) => {
      await page.goto('/')
      const sky = page.locator('.page-sky')
      await expect(sky).toHaveCSS('position', 'fixed')
      await expect(sky).toHaveCSS('pointer-events', 'none')
      await expect(sky).toHaveAttribute('aria-hidden', 'true')

      // Fixed under the scrolling page, the sky is put together again on every scrolled frame:
      // an opacity on the whole of it or a filter inside it doubles that frame where no GPU
      // draws it. A veil of the page colour dims it instead.
      await expect(sky).toHaveCSS('opacity', '1')
      const drawn = await sky.evaluate((element) => {
        const parts = [element, ...element.querySelectorAll('*')]
        const styles = parts.flatMap((part) => [
          getComputedStyle(part),
          getComputedStyle(part, '::before'),
          getComputedStyle(part, '::after'),
        ])
        return {
          filters: styles.map((style) => style.filter).filter((filter) => filter !== 'none'),
          veil: getComputedStyle(element, '::after').backgroundColor,
        }
      })
      expect(drawn.filters).toEqual([])
      expect(drawn.veil).not.toBe('rgba(0, 0, 0, 0)')

      // Its bands thin out on both sides: the hero's tight lower edge would draw a line across
      // a section.
      const shape = (band: string) =>
        page
          .locator(band)
          .first()
          .evaluate((element) => getComputedStyle(element).getPropertyValue('--aurora-band-shape'))
      expect(await shape('.page-sky [data-aurora="dark"] .aurora-band')).not.toBe(
        await shape('.hero [data-aurora="dark"] .aurora-band'),
      )

      await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
      expect(await sky.boundingBox()).toEqual({
        x: 0,
        y: 0,
        width: desktop.width,
        height: desktop.height,
      })
    })

    // At a phone's width, where the aurora is the CSS one whatever draws the page.
    test('lets that sky drift, slower than the hero’s, and rest with the pause', async ({
      page,
    }) => {
      await page.setViewportSize(narrow)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await expect(root(page)).not.toHaveAttribute('data-aurora-still')
      const sky = page.locator('.page-sky')
      const drift = () =>
        sky.evaluate((element) =>
          [...element.querySelectorAll('.aurora-band')]
            .filter((band) => (band as HTMLElement).offsetParent !== null)
            .flatMap((band) => band.getAnimations())
            .map((animation) => ({
              state: animation.playState,
              seconds: Number(animation.effect?.getTiming().duration) / 1000,
            })),
        )
      const moving = await drift()
      expect(moving).toHaveLength(2)
      for (const { state, seconds } of moving) {
        expect(state).toBe('running')
        expect(seconds).toBeGreaterThanOrEqual(20)
      }

      await page
        .locator('[data-motion-toggle]')
        .first()
        .evaluate((toggle: HTMLElement) => toggle.click())
      await expect(root(page)).toHaveAttribute('data-animations-paused', '')
      expect((await drift()).map(({ state }) => state)).toEqual(['paused', 'paused'])
    })

    test('shows Devot for iPhone one click from the hero, on two phones, with the App Store link', async ({
      page,
    }) => {
      await page.goto('/')
      await page.locator('#hero').getByRole('link', { name: en.download.iphone }).click()
      const section = page.locator('#iphone')
      await expect(section).toBeInViewport()
      await expect(section.getByRole('heading', { level: 2 })).toHaveText(en.iphone.title.join(' '))
      await expect(section.getByRole('link', { name: en.download.appStore })).toHaveAttribute(
        'href',
        APP_STORE_URL,
      )

      const screens = section.locator('.iphone__device img')
      await expect(screens).toHaveCount(2)
      for (const screen of await screens.all()) {
        await screen.scrollIntoViewIfNeeded()
        await expect
          .poll(() => screen.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
          .toBeGreaterThan(0)
        expect(await screen.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/-dark\./)
      }
    })
  })
}

test('leaves the other pages to the reader’s scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/docs')
  await expect(root(page)).not.toHaveAttribute('data-scope', /.*/)
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2)
  await expect(page.locator('.page-sky')).toHaveCount(0)
})
