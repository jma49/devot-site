import type { Locator, Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { STEP_DRIFT } from '../../src/scripts/hero-day.ts'
import { APP_STORE_URL } from '../../src/site.ts'
import { scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const desktop = { width: 1440, height: 900 }

const hero = (page: Page) => page.locator('[data-hero]')
const header = (page: Page) => page.locator('[data-site-header]')
const day = (page: Page) => page.locator('[data-hero-day]')
const dayClip = (page: Page) => page.locator('video[data-clip="hero-day"]')
const heroClip = (page: Page) => page.locator('video[data-clip="hero"]')
const phone = (page: Page) => page.locator('[data-hero-phone="night"]')
const phoneDay = (page: Page) => page.locator('[data-hero-phone="day"]')
const heroVar = (page: Page, name: string) =>
  hero(page).evaluate(
    (element, prop) => Number(getComputedStyle(element).getPropertyValue(prop)),
    name,
  )
const isPlaying = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2)
const time = (video: Locator) => video.evaluate((v: HTMLVideoElement) => v.currentTime)
const source = (video: Locator) => video.evaluate((v: HTMLVideoElement) => v.currentSrc)
const requested = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => v.currentSrc !== '' || !!v.querySelector('source[src]'))

test.describe('the night over the hero, on a light page', () => {
  test.use({ viewport: desktop, colorScheme: 'light' })

  test('opens under the night on the dark recording, with the light one not yet asked for', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await expect(hero(page)).toHaveAttribute('data-scope', 'dark')
    await expect(header(page)).toHaveAttribute('data-scope', 'dark')
    // Its parts move by transform, which must not count as the page moving under the reader.
    await expect(hero(page)).toHaveCSS('overflow-anchor', 'none')
    expect(await heroVar(page, '--hero-night')).toBe(1)
    expect(await heroVar(page, '--hero-daylight')).toBe(0)
    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
    expect(await source(heroClip(page))).toMatch(/\/media\/hero\/hero-dark\.(webm|mp4)$/)
    await expect(day(page)).toBeHidden()
    expect(await requested(dayClip(page))).toBe(false)
  })

  test('plays the iPhone beside the window whenever the hero clip plays', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
    await expect.poll(() => isPlaying(phone(page)), { timeout: 10_000 }).toBe(true)
    expect(await source(phone(page))).toMatch(/\/_astro\/p2-read-dark\.[\w-]+\.mp4$/)
    await expect(phoneDay(page)).toBeHidden()
    expect(await requested(phoneDay(page))).toBe(false)

    // Past the hero the clip rests, and the phone with it.
    await page.locator('#cards').evaluate((section) => section.scrollIntoView())
    await expect.poll(() => heroClip(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    await expect.poll(() => phone(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
  })

  test('gives way to the day as the page scrolls, the light recording on the moment of the dark one, and back', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)

    await scrollToY(page, 0.6 * desktop.height)
    await expect.poll(() => heroVar(page, '--hero-night')).toBe(0)
    await expect(hero(page)).not.toHaveAttribute('data-scope', /.*/)
    await expect(hero(page)).not.toHaveAttribute('data-appearance-preview', /.*/)
    await expect(header(page)).not.toHaveAttribute('data-scope', /.*/)
    await expect(day(page)).toBeVisible()
    await expect.poll(() => heroVar(page, '--hero-daylight'), { timeout: 10_000 }).toBe(1)
    expect(await source(dayClip(page))).toMatch(/\/media\/hero\/hero\.(webm|mp4)$/)
    await expect.poll(() => isPlaying(dayClip(page)), { timeout: 10_000 }).toBe(true)
    await expect
      .poll(async () => Math.abs((await time(dayClip(page))) - (await time(heroClip(page)))), {
        timeout: 10_000,
      })
      .toBeLessThan(STEP_DRIFT * 3)
    await expect(phoneDay(page)).toBeVisible()
    await expect.poll(() => isPlaying(phoneDay(page)), { timeout: 10_000 }).toBe(true)
    expect(await source(phoneDay(page))).toMatch(/\/_astro\/p2-read-light\.[\w-]+\.mp4$/)
    await expect
      .poll(async () => Math.abs((await time(phoneDay(page))) - (await time(phone(page)))), {
        timeout: 10_000,
      })
      .toBeLessThan(STEP_DRIFT * 3)

    await scrollToY(page, 0)
    await expect.poll(() => heroVar(page, '--hero-night')).toBe(1)
    expect(await heroVar(page, '--hero-daylight')).toBe(0)
    await expect(day(page)).toBeHidden()
    await expect(phoneDay(page)).toBeHidden()
    await expect(hero(page)).toHaveAttribute('data-scope', 'dark')
    await expect(header(page)).toHaveAttribute('data-scope', 'dark')
    await expect.poll(() => dayClip(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    await expect.poll(() => phoneDay(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
  })

  test('keeps the night with reduced motion, and takes it off the header after the hero', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(header(page)).toHaveAttribute('data-scope', 'dark')

    await scrollToY(page, 0.6 * desktop.height)
    expect(await heroVar(page, '--hero-night')).toBe(1)
    await expect(hero(page)).toHaveAttribute('data-scope', 'dark')
    await expect(day(page)).toBeHidden()
    expect(await requested(dayClip(page))).toBe(false)

    await scrollToY(
      page,
      await hero(page).evaluate((element) => (element as HTMLElement).offsetHeight + 200),
    )
    await expect(header(page)).not.toHaveAttribute('data-scope', /.*/)
    await expect(hero(page)).toHaveAttribute('data-scope', 'dark')
  })
})

test.describe('the night over the hero, on a dark page', () => {
  test.use({ viewport: desktop, colorScheme: 'dark' })

  test('keeps the dark recording through the scroll and never asks for the light one', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)

    await scrollToY(page, 0.6 * desktop.height)
    await expect.poll(() => heroVar(page, '--hero-night')).toBe(0)
    await expect(day(page)).toBeHidden()
    expect(await heroVar(page, '--hero-daylight')).toBe(0)
    expect(await requested(dayClip(page))).toBe(false)
    expect(await requested(phoneDay(page))).toBe(false)
    expect(await source(heroClip(page))).toMatch(/hero-dark\.(webm|mp4)$/)
  })
})

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Devot for iPhone, ${colorScheme}`, () => {
    test.use({ viewport: desktop, colorScheme })

    test('is one click from the hero, shows the app on two phones and links to the App Store', async ({
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
        expect(
          await screen.evaluate((img: HTMLImageElement) => /-dark\./.test(img.currentSrc)),
        ).toBe(colorScheme === 'dark')
      }
    })
  })
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`keeps the sky behind the whole page, still and out of the way, ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize(desktop)
    await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
    await page.goto('/')
    const sky = page.locator('.page-sky')
    await expect(sky).toHaveCSS('position', 'fixed')
    await expect(sky).toHaveCSS('pointer-events', 'none')
    await expect(sky).toHaveAttribute('aria-hidden', 'true')
    expect(
      await sky.evaluate((element) =>
        [...element.querySelectorAll('.aurora-band')].flatMap((band) => band.getAnimations()),
      ),
    ).toHaveLength(0)

    await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
    const box = await sky.boundingBox()
    expect(box).toEqual({ x: 0, y: 0, width: desktop.width, height: desktop.height })
  })
}
