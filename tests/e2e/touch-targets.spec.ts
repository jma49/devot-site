import { scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const PHONE = { width: 390, height: 844 }
const MIN = 44

test.describe('on a touch screen', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

  for (const path of ['/', '/terms/', '/refunds/', '/mcp-privacy/']) {
    test(`every control on ${path} outside running text is at least 44 by 44`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'only Chromium emulates a touch-only screen')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(path)
      const small = await page.evaluate((min) => {
        // A link inside a sentence sizes with the text, which WCAG 2.5.8 allows.
        const inText = (e: Element) =>
          getComputedStyle(e).display === 'inline' && e.parentElement?.closest('p, li, dd') !== null
        return [...document.querySelectorAll('a, button, summary, [role="button"]')]
          .filter((e) => {
            const box = e.getBoundingClientRect()
            return box.width > 0 && getComputedStyle(e).visibility !== 'hidden' && !inText(e)
          })
          .filter((e) => {
            const box = e.getBoundingClientRect()
            return box.width < min - 0.5 || box.height < min - 0.5
          })
          .map((e) => {
            const box = e.getBoundingClientRect()
            const name = (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30)
            return `${name} ${Math.round(box.width)}x${Math.round(box.height)}`
          })
      }, MIN)
      expect(small).toEqual([])
    })
  }

  test('the download pill that follows the page is at least 44 points tall', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium emulates a touch-only screen')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await scrollToY(page, 1600)
    const pill = page.locator('[data-download-pill][data-shown] .brand-button')
    await expect(pill).toBeVisible()
    expect((await pill.boundingBox())!.height).toBeGreaterThanOrEqual(MIN - 0.5)
  })
})
