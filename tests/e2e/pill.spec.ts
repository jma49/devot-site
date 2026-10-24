import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { animationsDone, scrollToY, steady } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const pill = (page: Page) => page.locator('[data-download-pill]')
/** Every 200 px of scroll, as the acceptance for the corner pill asks. */
const STEP = 200
const LIMIT = 0.05

/**
 * Where the pill is drawn and, for each clip on screen, the share of its visible part (inside the
 * window and every ancestor that clips it) the pill covers.
 */
const coverage = (page: Page) =>
  page.evaluate(() => {
    type Box = { left: number; top: number; right: number; bottom: number }
    const meet = (a: Box, b: Box): Box | null => {
      const box = {
        left: Math.max(a.left, b.left),
        top: Math.max(a.top, b.top),
        right: Math.min(a.right, b.right),
        bottom: Math.min(a.bottom, b.bottom),
      }
      return box.right > box.left && box.bottom > box.top ? box : null
    }
    const area = (box: Box) => (box.right - box.left) * (box.bottom - box.top)
    const element = document.querySelector('[data-download-pill]')!
    const style = getComputedStyle(element)
    const shown = style.visibility === 'visible' && Number(style.opacity) > 0
    const pillBox = element.getBoundingClientRect()
    const view = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    const clips = [...document.querySelectorAll<HTMLVideoElement>('video[data-clip]')].flatMap(
      (video) => {
        let visible: Box | null = meet(video.getBoundingClientRect(), view)
        for (let at = video.parentElement; at && visible && at !== document.body;) {
          const { overflowX, overflowY } = getComputedStyle(at)
          if (overflowX !== 'visible' || overflowY !== 'visible') {
            visible = meet(visible, at.getBoundingClientRect())
          }
          at = at.parentElement
        }
        if (!visible) return []
        const covered = meet(visible, pillBox)
        return [{ slot: video.dataset['clip'], share: covered ? area(covered) / area(visible) : 0 }]
      },
    )
    return { shown, box: pillBox.toJSON() as Box & { width: number; height: number }, clips }
  })

/** Scrolls, then waits for the clips' eased movement, the reveals and the pill to settle. */
async function settleAt(page: Page, y: number) {
  await scrollToY(page, y)
  await steady(
    page,
    () =>
      page.evaluate(() => [
        document.querySelector('[data-download-pill]')?.getAttributeNames().sort(),
        [...document.querySelectorAll('video[data-clip]')].map((video) =>
          Math.round(video.getBoundingClientRect().top),
        ),
      ]),
    { frames: 6 },
  )
  await animationsDone(page)
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
]) {
  test.describe(`corner pill at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
    })

    test('rests compact in the bottom-right corner, with the download button', async ({ page }) => {
      await settleAt(page, viewport.height * 0.8)
      await expect(pill(page)).toBeVisible()
      const { box } = await coverage(page)

      expect(box.width).toBeLessThanOrEqual(240)
      expect(box.height).toBeLessThanOrEqual(56)
      expect(viewport.width - box.right).toBeGreaterThanOrEqual(8)
      expect(viewport.width - box.right).toBeLessThanOrEqual(40)
      expect(viewport.height - box.bottom).toBeGreaterThanOrEqual(8)
      expect(viewport.height - box.bottom).toBeLessThanOrEqual(40)
      const button = pill(page).getByRole('link', { name: en.download.label })
      await expect(button).toBeVisible()
      await expect(button).toHaveAccessibleDescription(en.chrome.downloadNote)
    })

    test('covers under 5 % of any clip on screen, sampled every 200 px, and still shows', async ({
      page,
    }) => {
      test.slow()
      const end = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      )
      let due = 0
      let shown = 0
      for (let y = 0; y <= end; y += STEP) {
        await settleAt(page, y)
        const state = await coverage(page)
        const wanted = await pill(page).evaluate(
          (element) => element.hasAttribute('data-shown') || element.hasAttribute('data-aside'),
        )
        if (wanted) due++
        if (!state.shown) continue
        shown++
        for (const clip of state.clips) {
          expect(clip.share, `${clip.slot} at ${y}`).toBeLessThan(LIMIT)
        }
      }
      expect(due).toBeGreaterThan(10)
      expect(shown / due).toBeGreaterThanOrEqual(0.6)
    })
  })
}

test.describe('corner pill at 1440 x 900, as a card comes in under it', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('steps aside and comes back once the card is in view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const top = await page.evaluate(() => {
      const card = document.querySelector('#cards .card[data-slot="card-2"] video')!
      return window.scrollY + card.getBoundingClientRect().top
    })

    await settleAt(page, top - 900 + 60)
    await expect(pill(page)).toHaveAttribute('data-aside', '')
    await expect(pill(page)).toBeHidden()
    expect(await pill(page).evaluate((element) => getComputedStyle(element).translate)).not.toBe(
      '0px',
    )

    await settleAt(page, top - 300)
    await expect(pill(page)).not.toHaveAttribute('data-aside')
    await expect(pill(page)).toBeVisible()
  })
})

test.describe('bottom bar on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('stays centred at the foot of the screen, over clips too', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const top = await page.evaluate(() => {
      const card = document.querySelector('#cards .card[data-slot="card-2"] video')!
      return window.scrollY + card.getBoundingClientRect().top
    })

    await settleAt(page, top - 844 + 60)

    await expect(pill(page)).toBeVisible()
    await expect(pill(page)).not.toHaveAttribute('data-aside')
    const { box } = await coverage(page)
    expect(Math.abs(box.left - (390 - box.right))).toBeLessThanOrEqual(2)
  })
})
