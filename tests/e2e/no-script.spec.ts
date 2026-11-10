import { media, pinned, SLOTS } from '../../src/media.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

// Without scripts no clip can play, and Chromium gives any video its native controls; the page
// shows each clip's poster instead.
test.use({ javaScriptEnabled: false })

for (const viewport of [DESKTOP, PHONE]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`shows the hero window's poster at ${viewport.width}, ${scheme}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/')

      // The window opens on its dark recording in either scheme; the light one needs a script.
      const frame = page.locator('.hero-frame')
      const poster = frame.locator('> noscript picture img')
      const expected = pinned(media.hero, 'dark').variants.find(
        (variant) => variant.phone === viewport.width < 640,
      )
      await expect(frame.locator('> video')).toBeHidden()
      await expect(frame.locator('[data-hero-day]')).toBeHidden()
      await expect(poster).toBeVisible()
      await expect(poster).toHaveAttribute('alt', media.hero.alt)
      await expect(poster).toHaveJSProperty('complete', true)
      expect(await poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
      expect(
        new URL(await poster.evaluate((img: HTMLImageElement) => img.currentSrc)).pathname,
      ).toBe(expected?.poster)

      // Both boxes at one moment, as the window may still be easing into place.
      const gaps = await poster.evaluate((img) => {
        const fill = img.getBoundingClientRect()
        const window = img.closest('.hero-frame')?.getBoundingClientRect()
        return (['x', 'y', 'width', 'height'] as const).map((side) =>
          Math.abs(fill[side] - (window?.[side] ?? Infinity)),
        )
      })
      expect(Math.max(...gaps)).toBeLessThan(1)
    })
  }
}

test('shows a poster in place of every clip, and no video', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.goto('/')
  // Every slot's clip, and the hero's light recording beside its dark one.
  const clips = SLOTS.filter((name) => media[name].clip).length + 1
  await expect(page.locator('video[data-clip]')).toHaveCount(clips)
  for (const video of await page.locator('video[data-clip]').all()) await expect(video).toBeHidden()
  await expect(page.locator('noscript picture img')).toHaveCount(clips)
})
