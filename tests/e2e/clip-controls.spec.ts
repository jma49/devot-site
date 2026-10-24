import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { media, type SlotName } from '../../src/media.ts'
import { PAUSE_KEY } from '../../src/scripts/pause.ts'
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
const playingFile = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => new URL(v.currentSrc).pathname)
/** The files of a slot's variant for a scheme, at desktop widths. */
const filesFor = (slot: SlotName, scheme: 'light' | 'dark') => {
  const variant = media[slot].variants.find((each) => each.scheme === scheme && !each.phone)
  return [variant?.webm, variant?.mp4]
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`adds no play buttons and leaves the clips looping (${reducedMotion})`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({ reducedMotion })
    await page.goto('/')
    await expect(page.locator('[data-features-ready]')).toHaveCount(1)
    await expect.poll(() => isPlaying(clip(page, 'hero')), { timeout: 10_000 }).toBe(true)
    await expect(controls(page)).toHaveCount(0)
    for (const video of await page.locator('video[data-clip]').all()) {
      expect(await video.evaluate((v: HTMLVideoElement) => v.loop)).toBe(true)
    }
  })
}

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`with animations paused and reduced motion, at ${viewport.width}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), PAUSE_KEY)
      await page.goto('/')
      await expect(page.locator('[data-features-ready]')).toHaveCount(1)
    })

    test('gives every clip a play button of at least 24 px, named for its clip', async ({
      page,
    }) => {
      const slots = await page
        .locator('video[data-clip]')
        .evaluateAll((videos) =>
          videos.map((v) => (v as HTMLVideoElement).dataset.clip as SlotName),
        )
      await expect(controls(page)).toHaveCount(slots.length)
      const names = new Set<string>()
      for (const slot of slots) {
        const button = control(page, slot)
        const name = en.clipControl.named(media[slot].alt)
        expect(name.startsWith(en.clipControl.label), slot).toBe(true)
        names.add(name)
        await expect(button).toHaveAccessibleName(name)
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
      expect(names.size).toBe(slots.length)
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

test.describe('when the motion preference changes', () => {
  test.use({ viewport: DESKTOP })

  test('keeps the clips playing and adds no buttons', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await expect.poll(() => isPlaying(clip(page, 'hero')), { timeout: 10_000 }).toBe(true)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const at = await clip(page, 'hero').evaluate((v: HTMLVideoElement) => v.currentTime)
    await expect
      .poll(() => clip(page, 'hero').evaluate((v: HTMLVideoElement) => v.currentTime))
      .not.toBe(at)
    expect(await isPlaying(clip(page, 'hero'))).toBe(true)
    await expect(controls(page)).toHaveCount(0)
  })
})

/**
 * Refuses play() as a browser that blocks autoplay does (Low Power Mode, a site setting), except
 * from a click. Playwright runs evaluate() as a user gesture in Chromium, so the stub asks for a
 * click in progress rather than for user activation.
 */
const refuseAutoplay = (page: Page) =>
  page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const event = window.event
      return event?.isTrusted && event.type === 'click'
        ? play.call(this)
        : Promise.reject(new DOMException('play() needs a gesture', 'NotAllowedError'))
    }
  })

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`when the browser refuses to start the clips (${reducedMotion})`, () => {
    test.use({ viewport: DESKTOP })

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion })
      await refuseAutoplay(page)
      await page.goto('/')
    })

    test('gives each clip it refused a named play button, which starts it looping', async ({
      page,
    }) => {
      const hero = control(page, 'hero')
      await expect(hero).toBeVisible()
      await expect(hero).toHaveAccessibleName(en.clipControl.named(media.hero.alt))
      await expect(hero).not.toHaveAttribute('aria-pressed')
      await expect(control(page, 'card-2')).toHaveCount(0)

      await centre(page.locator('#cards .card[data-slot="card-2"]'))
      const button = control(page, 'card-2')
      await expect(button).toBeVisible()
      await button.click()

      await expect.poll(() => isPlaying(clip(page, 'card-2')), { timeout: 10_000 }).toBe(true)
      expect(await clip(page, 'card-2').evaluate((v: HTMLVideoElement) => v.loop)).toBe(true)
      await expect(button).toHaveCount(0)
      await expect(hero).toHaveCount(1)
    })

    test('answers the keyboard, and gives way to the buttons of the pause', async ({ page }) => {
      const hero = control(page, 'hero')
      await hero.focus()
      await page.keyboard.press('Enter')
      await expect.poll(() => isPlaying(clip(page, 'hero')), { timeout: 10_000 }).toBe(true)
      await expect(hero).toHaveCount(0)

      await page.getByRole('button', { name: en.chrome.pause, exact: true }).click()

      const slots = await page.locator('video[data-clip]').count()
      await expect(controls(page)).toHaveCount(slots)
      await expect(control(page, 'hero')).toHaveAttribute('aria-pressed', 'false')
    })
  })
}

test.describe('with animations paused', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
    await page.addInitScript((key) => localStorage.setItem(key, 'true'), PAUSE_KEY)
    await page.goto('/')
    await expect(page.locator('[data-features-ready]')).toHaveCount(1)
  })

  test('plays the files for the scheme in use when the scheme changed since the last play', async ({
    page,
  }) => {
    const video = clip(page, 'card-2')
    const button = control(page, 'card-2')
    await centre(button)
    await button.click()
    await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)
    expect(filesFor('card-2', 'light')).toContain(await playingFile(video))
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await page.emulateMedia({ colorScheme: 'dark' })
    await button.click()

    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)
    expect(filesFor('card-2', 'dark')).toContain(await playingFile(video))
  })

  test('moves a playing clip to the files for a new scheme and keeps it playing', async ({
    page,
  }) => {
    const video = clip(page, 'card-2')
    const button = control(page, 'card-2')
    await centre(button)
    await button.click()
    await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)

    await page.emulateMedia({ colorScheme: 'dark' })

    await expect
      .poll(async () => filesFor('card-2', 'dark').includes(await playingFile(video)))
      .toBe(true)
    await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes an accessibility scan with the buttons, in the ${colorScheme} appearance`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.addInitScript((key) => localStorage.setItem(key, 'true'), PAUSE_KEY)
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
