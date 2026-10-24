import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import sharp from 'sharp'
import { en } from '../../src/i18n/en.ts'
import { PAUSE_ATTRIBUTE, PAUSE_KEY } from '../../src/scripts/pause.ts'
import { animationsDone, frames } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

const toggle = (page: Page) => page.getByRole('button', { name: en.chrome.pause, exact: true })
const hero = (page: Page) => page.locator('[data-hero]')
const heroClip = (page: Page) => page.locator('video[data-clip="hero"]')
const isPlaying = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), PAUSE_KEY)
/** Every clip's state: paused or not, and where it stands. */
const clipStates = (page: Page) =>
  page.locator('video[data-clip]').evaluateAll((videos) =>
    videos.map((v) => ({
      paused: (v as HTMLVideoElement).paused,
      time: (v as HTMLVideoElement).currentTime,
    })),
  )
/** The play state of the drifting CSS layers under the hero's backdrop. */
const driftStates = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a instanceof CSSAnimation && a.animationName.startsWith('aurora-sway'))
      .map((a) => a.playState),
  )

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`pause toggle at ${viewport.width}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
    })

    test('is one labelled toggle in the header bar, 24 px or larger, not pressed', async ({
      page,
    }) => {
      await page.goto('/')

      await expect(toggle(page)).toHaveCount(1)
      await expect(toggle(page)).toBeVisible()
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
      expect(await toggle(page).evaluate((button) => !!button.closest('[data-menu-scope]'))).toBe(
        true,
      )
      const box = await toggle(page).boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(24)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    })

    test('is reached by keyboard before anything in the page content', async ({
      page,
      browserName,
    }) => {
      // WebKit, as Safari by default, moves Tab between text fields only; Option-Tab reaches all.
      const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
      await page.goto('/')
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')

      let reached = false
      for (let step = 0; step < 12 && !reached; step++) {
        await page.keyboard.press(tab)
        const where = await page.evaluate(() => {
          const active = document.activeElement
          return {
            toggle: active?.hasAttribute('data-motion-toggle') ?? false,
            inMain: !!active?.closest('main'),
          }
        })
        expect(where.inMain, `step ${step}`).toBe(false)
        reached = where.toggle
      }
      expect(reached).toBe(true)
      await expect(toggle(page)).toBeFocused()
      await expect(toggle(page)).toHaveCSS('outline-style', 'solid')

      await page.keyboard.press('Space')
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Enter')
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
    })

    test('stops every clip and the backdrop at once, and starts them again', async ({ page }) => {
      await page.goto('/')
      await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')

      await toggle(page).click()

      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('html')).toHaveAttribute(PAUSE_ATTRIBUTE, '')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      const paused = await clipStates(page)
      expect(paused.every((clip) => clip.paused)).toBe(true)
      expect((await driftStates(page)).filter((state) => state === 'running')).toEqual([])
      await frames(page, 10)
      expect(await clipStates(page)).toEqual(paused)
      expect(await stored(page)).toBe('true')

      await toggle(page).click()

      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
      await expect(page.locator('html')).not.toHaveAttribute(PAUSE_ATTRIBUTE)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
      expect(await stored(page)).toBe('false')
    })

    test('remembers the pause on the next visit: nothing loads or plays', async ({ page }) => {
      await page.goto('/')
      await toggle(page).click()
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')

      await page.reload()

      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      await animationsDone(page, '#hero')
      expect((await driftStates(page)).filter((state) => state === 'running')).toEqual([])
      const clip = heroClip(page)
      expect(await clip.evaluate((v: HTMLVideoElement) => [v.paused, v.currentSrc])).toEqual([
        true,
        '',
      ])
    })

    test('holds the CSS drift still before the backdrop script starts', async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), PAUSE_KEY)
      // A module that never finishes evaluating keeps the backdrop from starting, without the
      // console error an aborted request would log.
      await page.route('**/hero-backdrop.*.js', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: 'await new Promise(() => {})' }),
      )
      await page.goto('/')

      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
      await expect(hero(page)).not.toHaveAttribute('data-backdrop-state', /.*/)
      expect((await driftStates(page)).filter((state) => state === 'running')).toEqual([])
    })

    test('gives each clip its own play button while paused', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('.clip-control')).toHaveCount(0)

      await toggle(page).click()

      const slots = await page.locator('video[data-clip]').count()
      await expect(page.locator('.clip-control')).toHaveCount(slots)
      const button = page.locator('.clip-control[data-for="card-2"]')
      await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect
        .poll(() => isPlaying(page.locator('video[data-clip="card-2"]')), { timeout: 10_000 })
        .toBe(true)

      await toggle(page).click()
      await expect(page.locator('.clip-control')).toHaveCount(0)
    })
  })
}

test.describe('with reduced motion', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('shows the toggle and reaches it by keyboard, and adds no play buttons', async ({
    page,
    browserName,
  }) => {
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
    await page.goto('/')
    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)

    await expect(toggle(page)).toBeVisible()
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.clip-control')).toHaveCount(0)
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press(tab)
      if (await toggle(page).evaluate((button) => button === document.activeElement)) break
    }
    await expect(toggle(page)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('stops every clip where it is, remembers it on the next visit, and plays again', async ({
    page,
  }) => {
    await page.goto('/')
    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)

    await toggle(page).click()

    await expect(page.locator('html')).toHaveAttribute(PAUSE_ATTRIBUTE, '')
    await expect(hero(page)).not.toHaveAttribute('data-backdrop-state', 'running')
    const paused = await clipStates(page)
    expect(paused.every((clip) => clip.paused)).toBe(true)
    await frames(page, 10)
    expect(await clipStates(page)).toEqual(paused)
    expect(await stored(page)).toBe('true')

    await page.reload()

    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', /./)
    await expect(hero(page)).not.toHaveAttribute('data-backdrop-state', 'running')
    expect(
      await heroClip(page).evaluate((v: HTMLVideoElement) => [v.paused, v.currentSrc]),
    ).toEqual([true, ''])

    await toggle(page).click()

    await expect.poll(() => isPlaying(heroClip(page)), { timeout: 10_000 }).toBe(true)
    expect(await stored(page)).toBe('false')
  })
})

for (const colorScheme of ['light', 'dark'] as const) {
  for (const viewport of [DESKTOP, PHONE]) {
    test(`passes an accessibility scan while paused, ${colorScheme} at ${viewport.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
      await page.goto('/')
      await toggle(page).click()
      await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
      await animationsDone(page)

      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze()
      expect(scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)).toEqual([])
    })
  }
}

/**
 * The WCAG luminance of a button's fill as drawn, from a patch between its edge and its glyph:
 * forced colours repaint the button without changing its computed style.
 */
async function fillLuminance(button: Locator) {
  const { data, info } = await sharp(await button.screenshot({ scale: 'css', caret: 'initial' }))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  let sum = 0
  let count = 0
  const middle = Math.round(info.height / 2)
  for (let y = middle - 3; y <= middle + 3; y++) {
    for (let x = 6; x <= 9; x++) {
      const at = (y * info.width + x) * 3
      sum +=
        0.2126 * linear(data[at]!) + 0.7152 * linear(data[at + 1]!) + 0.0722 * linear(data[at + 2]!)
      count++
    }
  }
  return sum / count
}

test.describe('in forced colours', () => {
  test.use({ viewport: DESKTOP })

  test('shows the pressed toggle in the highlight colours', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium emulates forced colours')
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'no-preference' })
    await page.goto('/')
    const button = toggle(page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    const resting = await fillLuminance(button)

    await button.click()
    await page.mouse.move(DESKTOP.width / 2, DESKTOP.height / 2)

    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => {
        const pressed = await fillLuminance(button)
        return (Math.max(pressed, resting) + 0.05) / (Math.min(pressed, resting) + 0.05)
      })
      .toBeGreaterThanOrEqual(3)
  })
})
