import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
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

/** Waits until no transition runs in the section, so nothing is caught mid-change. */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const section = document.querySelector('#write')
        return document
          .getAnimations()
          .filter(
            (animation) =>
              animation instanceof CSSTransition &&
              animation.playState === 'running' &&
              animation.effect instanceof KeyframeEffect &&
              animation.effect.target instanceof Element &&
              section?.contains(animation.effect.target),
          ).length
      }),
    )
    .toBe(0)
}

/** The WCAG contrast of an element's text against the page, with colours resolved by the browser. */
const contrastOnPage = (locator: Locator) =>
  locator.evaluate((element) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const rgb = (colour: string) => {
      context!.clearRect(0, 0, 1, 1)
      context!.fillStyle = colour
      context!.fillRect(0, 0, 1, 1)
      return [...context!.getImageData(0, 0, 1, 1).data.slice(0, 3)]
    }
    const luminance = (colour: string) => {
      const [r = 0, g = 0, b = 0] = rgb(colour).map((value) => {
        const c = value / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const text = luminance(getComputedStyle(element).color)
    const page = luminance(getComputedStyle(document.body).backgroundColor)
    return (Math.max(text, page) + 0.05) / (Math.min(text, page) + 0.05)
  })

for (const width of [390, 800, 1024, 1440]) {
  test(`sets each line of the section heading on a line of its own at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const lines = page.locator('.features-title-line')
    await expect(lines).toHaveCount(en.features.titleLines.length)
    const heights = await lines.evaluateAll((spans) =>
      spans.map(
        (span) =>
          span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight),
      ),
    )
    for (const height of heights) expect(height).toBeLessThan(1.5)
  })
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

  test('slides one marker to the active item and spans it once the list settles', async ({
    page,
  }) => {
    const marker = page.locator('[data-features-marker]')
    const frame = () =>
      marker.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const nav = element.parentElement!.getBoundingClientRect()
        return { top: Math.round(rect.top - nav.top), height: Math.round(rect.height) }
      })
    const itemFrame = (index: number) =>
      listItems(page)
        .nth(index)
        .evaluate((item) => {
          const nav = item.closest('nav')!.getBoundingClientRect()
          const rect = item.getBoundingClientRect()
          return { top: Math.round(rect.top - nav.top) + 4, height: Math.round(rect.height) - 8 }
        })
    await expect(marker).toHaveCSS('transition-property', /transform/)
    const duration = parseFloat(
      await marker.evaluate((m) => getComputedStyle(m).transitionDuration),
    )
    expect(duration).toBeGreaterThanOrEqual(0.25)
    expect(duration).toBeLessThanOrEqual(0.35)

    for (const index of [1, 2, 0]) {
      await placeWell(page, index, line - 40)
      await expect.poll(() => current(page)).toBe(index)
      await settled(page)
      const [at, item] = await Promise.all([frame(), itemFrame(index)])
      expect(Math.abs(at.top - item.top), `marker top at item ${index}`).toBeLessThanOrEqual(1)
      expect(
        Math.abs(at.height - item.height),
        `marker height at item ${index}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  test('answers a pointer over an inactive item and keeps it readable', async ({ page }) => {
    await placeWell(page, 0, line - 40)
    await expect.poll(() => current(page)).toBe(0)
    await settled(page)
    const title = listItems(page).nth(2).locator('.feature-title')
    const rest = await title.evaluate((element) => getComputedStyle(element).color)
    expect(await contrastOnPage(title)).toBeGreaterThanOrEqual(4.5)

    await button(page, 2).hover()

    await expect
      .poll(() => title.evaluate((element) => getComputedStyle(element).color))
      .not.toBe(rest)
  })

  test('gives the media at least 60 % of the container', async ({ page }) => {
    await placeWell(page, 0, 120)
    await expect(well(page, 0)).toHaveAttribute('data-revealed', '')
    await settled(page)
    const [container, media] = await Promise.all([
      page.locator('.features-body').boundingBox(),
      block(page, 0).locator('.feature-window').boundingBox(),
    ])
    expect((media?.width ?? 0) / (container?.width ?? 1)).toBeGreaterThanOrEqual(0.6)
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

  test('moves the marker at once', async ({ page }) => {
    const marker = page.locator('[data-features-marker]')
    const durations = await marker.evaluate((m) => getComputedStyle(m).transitionDuration)
    expect(durations.split(', ').every((d) => parseFloat(d) < 0.001)).toBe(true)
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
      await expect
        .poll(() =>
          page.locator('#write [data-reveal]').evaluateAll((all) =>
            all
              .filter((element) => {
                const rect = element.getBoundingClientRect()
                return rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
              })
              .every((element) => element.hasAttribute('data-revealed')),
          ),
        )
        .toBe(true)
      await settled(page)

      for (const index of [0, 2]) {
        const title = listItems(page).nth(index).locator('.feature-title')
        expect(await contrastOnPage(title), `inactive item ${index}`).toBeGreaterThanOrEqual(4.5)
      }
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
