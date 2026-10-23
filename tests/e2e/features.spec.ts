import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { ACTIVE_LINE } from '../../src/scripts/features.ts'
import { expect, test } from './fixtures.ts'

const { items, listLabel } = en.features
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const line = DESKTOP.height * ACTIVE_LINE

const list = (page: Page) => page.getByRole('navigation', { name: listLabel })
const listItems = (page: Page) => list(page).getByRole('listitem')
const button = (page: Page, index: number) => listItems(page).nth(index).getByRole('button')
const block = (page: Page, index: number) => page.locator('[data-feature]').nth(index)
const well = (page: Page, index: number) => block(page, index).locator('[data-feature-well]')
const current = (page: Page) =>
  listItems(page)
    .getByRole('button')
    .evaluateAll((buttons) => buttons.findIndex((b) => b.getAttribute('aria-current') === 'true'))
const wellTop = (page: Page, index: number) =>
  well(page, index).evaluate((element) => element.getBoundingClientRect().top)

/** Scrolls so the top of a feature's media sits `y` px below the top of the viewport. */
async function placeWell(page: Page, index: number, y: number): Promise<void> {
  await page.evaluate(
    ([i, at]) => {
      const target = document.querySelectorAll('[data-feature-well]')[i as number] as HTMLElement
      window.scrollTo(0, window.scrollY + target.getBoundingClientRect().top - (at as number))
    },
    [index, y],
  )
}

async function violations(page: Page): Promise<string[]> {
  const scan = await new AxeBuilder({ page })
    .include('#write')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  return scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)
}

test.describe('beside the media, at 1440', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
  })

  test('names every item after its feature and points it at its media', async ({ page }) => {
    await expect(listItems(page)).toHaveCount(items.length)
    for (const [index, item] of items.entries()) {
      await expect(button(page, index)).toHaveAccessibleName(`${item.name}: ${item.title}`)
      await expect(button(page, index)).toHaveAttribute('aria-controls', `feature-${item.slot}`)
      await expect(block(page, index)).toHaveAttribute('id', `feature-${item.slot}`)
      await expect(block(page, index).locator(`video[data-clip="${item.slot}"]`)).toHaveCount(1)
    }
    await expect(page.locator('.feature-copy').first()).toBeHidden()
  })

  test('keeps the list in place while the media scrolls past', async ({ page }) => {
    await placeWell(page, 0, 120)
    const listTop = () => list(page).evaluate((nav) => nav.getBoundingClientRect().top)
    const pinned = await listTop()

    await placeWell(page, 1, line)
    expect(await listTop()).toBeCloseTo(pinned, 0)
    await placeWell(page, 2, line)
    expect(await listTop()).toBeCloseTo(pinned, 0)
    expect(pinned).toBeCloseTo(Math.max(96, DESKTOP.height * 0.2), 0)
  })

  test('marks the item whose media crossed the line, scrolling down and back up', async ({
    page,
  }) => {
    await expect.poll(() => current(page)).toBe(0)

    for (const [index, at, expected] of [
      [1, line + 40, 0],
      [1, line - 40, 1],
      [2, line - 40, 2],
      [2, line + 40, 1],
      [1, line + 40, 0],
    ] as const) {
      await placeWell(page, index, at)
      await expect.poll(() => current(page), `media ${index} at ${at}px`).toBe(expected)
    }
  })

  test('expands the active description and folds the others', async ({ page }) => {
    const heights = () =>
      listItems(page)
        .locator('.feature-detail')
        .evaluateAll((details) => details.map((d) => d.getBoundingClientRect().height))

    await placeWell(page, 1, line - 40)

    await expect
      .poll(async () => (await heights()).map((h) => h > 40))
      .toEqual([false, true, false])
    await expect.poll(async () => (await heights())[0]).toBe(0)
  })

  test('fills the rail with the scroll, both ways', async ({ page }) => {
    const progress = (index: number) =>
      listItems(page)
        .nth(index)
        .evaluate((li) => Number(getComputedStyle(li).getPropertyValue('--feature-progress')))

    await placeWell(page, 0, line - 100)
    await expect.poll(() => progress(0)).toBeGreaterThan(0)
    const early = await progress(0)
    await placeWell(page, 0, line - 300)
    await expect.poll(() => progress(0)).toBeGreaterThan(early)
    await placeWell(page, 0, line - 100)

    await expect.poll(() => progress(0)).toBeCloseTo(early, 2)
    expect(await progress(2)).toBe(0)
  })

  test('scrolls to the media of a clicked item and makes it current', async ({ page }) => {
    await placeWell(page, 0, 120)

    await button(page, 2).click()

    await expect.poll(() => current(page)).toBe(2)
    await expect.poll(() => wellTop(page, 2)).toBeLessThan(line)
    await expect.poll(() => wellTop(page, 2)).toBeGreaterThan(0)
  })

  test('answers Enter and Space like a click', async ({ page }) => {
    await placeWell(page, 0, 120)

    await button(page, 1).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => current(page)).toBe(1)
    await expect.poll(() => wellTop(page, 1)).toBeLessThan(line)

    await button(page, 2).focus()
    await page.keyboard.press('Space')
    await expect.poll(() => current(page)).toBe(2)
    await expect.poll(() => wellTop(page, 2)).toBeLessThan(line)
  })

  test('brings the media in with a fade and a slight scale', async ({ page }) => {
    const state = () =>
      well(page, 1).evaluate((element) => {
        const style = getComputedStyle(element)
        return { opacity: Number(style.opacity), scale: new DOMMatrix(style.transform).a }
      })
    await placeWell(page, 1, DESKTOP.height + 120)
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    )
    expect(await state()).toEqual({ opacity: 0, scale: expect.closeTo(0.97, 3) })

    await placeWell(page, 1, line)

    await expect.poll(state).toEqual({ opacity: 1, scale: 1 })
  })

  test('drifts the window inside its well with the scroll, both ways', async ({ page }) => {
    test.skip(
      !(await page.evaluate(() => CSS.supports('animation-timeline: view()'))),
      'no view timelines',
    )
    const shift = () =>
      block(page, 1)
        .locator('.feature-stage')
        .evaluate((stage) => new DOMMatrix(getComputedStyle(stage).transform).m42)

    await placeWell(page, 1, DESKTOP.height - 100)
    const low = await shift()
    await placeWell(page, 1, 0)
    await expect.poll(shift).toBeLessThan(low - 10)
    await placeWell(page, 1, DESKTOP.height - 100)

    await expect.poll(shift).toBeCloseTo(low, 0)
  })
})

test.describe('with reduced motion, at 1440', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
  })

  test('shows the media at once, with no scale and no drift', async ({ page }) => {
    for (const index of items.keys()) {
      await expect(well(page, index)).toHaveCSS('opacity', '1')
      await expect(well(page, index)).toHaveCSS('transform', 'none')
      await expect(block(page, index).locator('.feature-stage')).toHaveCSS('animation-name', 'none')
    }
  })

  test('switches items at once and fills only the active rail', async ({ page }) => {
    const progress = () =>
      listItems(page).evaluateAll((lis) =>
        lis.map((li) => getComputedStyle(li).getPropertyValue('--feature-progress').trim()),
      )
    await placeWell(page, 1, line - 40)

    await expect.poll(() => current(page)).toBe(1)
    await expect.poll(progress).toEqual(['0.0000', '1.0000', '0.0000'])
    await expect(listItems(page).nth(1).locator('.feature-detail')).toHaveCSS(
      'transition-duration',
      /^0\.00001s|^1e-05s/,
    )
  })

  test('jumps to the media of a chosen item without a smooth scroll', async ({ page }) => {
    await placeWell(page, 0, 120)

    await button(page, 2).click()

    expect(await wellTop(page, 2)).toBeLessThan(line)
    await expect.poll(() => current(page)).toBe(2)
  })
})

test.describe('stacked, at 390', () => {
  test.use({ viewport: PHONE })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hides the list and shows each feature as media, then its text', async ({ page }) => {
    await expect(list(page)).toBeHidden()

    for (const [index, item] of items.entries()) {
      const copy = block(page, index).locator('.feature-copy')
      const heading = copy.getByRole('heading', { level: 3 })
      await heading.scrollIntoViewIfNeeded()
      await expect(heading).toContainText(item.title)
      await expect(copy.locator('.feature-text')).toBeVisible()
      const [media, text] = await Promise.all([
        well(page, index).boundingBox(),
        heading.boundingBox(),
      ])
      expect((media?.y ?? 0) + (media?.height ?? 0)).toBeLessThanOrEqual(text?.y ?? 0)
      expect(media?.width ?? 0).toBeGreaterThan(PHONE.width - 60)
    }
  })

  test('fits the screen without sideways scrolling', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} appearance`, () => {
    test.use({ colorScheme })

    test('passes an accessibility scan beside the media, mid-scroll', async ({ page }) => {
      await page.setViewportSize(DESKTOP)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await placeWell(page, 1, line - 40)
      await expect.poll(() => current(page)).toBe(1)
      // Lets the reveal and the item change finish, so no text is caught half faded.
      await page.waitForTimeout(1000)

      expect(await violations(page)).toEqual([])
    })

    test('passes an accessibility scan stacked, with reduced motion', async ({ page }) => {
      await page.setViewportSize(PHONE)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')

      expect(await violations(page)).toEqual([])
    })
  })
}
