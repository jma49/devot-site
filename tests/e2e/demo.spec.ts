import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { STATUSES, type StatusFilter } from '../../src/scripts/demo.ts'
import { expect, test } from './fixtures.ts'

const { demo } = en
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const total = demo.notes.length
const nameOf = (filter: StatusFilter) => (filter === 'all' ? demo.all : demo.statuses[filter])
const countOf = (filter: StatusFilter) =>
  filter === 'all' ? total : demo.notes.filter(({ status }) => status === filter).length

const root = (page: Page) => page.locator('[data-status-demo]')
const filters = (page: Page) => root(page).getByRole('group', { name: demo.filtersLabel })
const filter = (page: Page, which: StatusFilter) =>
  filters(page).getByRole('button', { name: new RegExp(`^${nameOf(which)} \\d+$`) })
const list = (page: Page) => root(page).getByRole('list', { name: demo.listLabel })
const pressed = (page: Page) =>
  filters(page)
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.filter),
    )
const shownTitles = (page: Page) =>
  list(page)
    .getByRole('listitem')
    .evaluateAll((items) =>
      items
        .filter(
          (item) => getComputedStyle(item).visibility === 'visible' && !item.hasAttribute('hidden'),
        )
        .map((item) => item.querySelector('.status-demo-note-title')?.textContent),
    )
const titlesOf = (which: StatusFilter) =>
  demo.notes.filter(({ status }) => which === 'all' || status === which).map(({ title }) => title)

/** Waits until no transition runs inside the demo, so nothing is caught half faded. */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = document.querySelector('[data-status-demo]')
        return document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === 'running' &&
              animation.effect instanceof KeyframeEffect &&
              animation.effect.target instanceof Element &&
              box?.contains(animation.effect.target),
          ).length
      }),
    )
    .toBe(0)
}

async function open(page: Page): Promise<void> {
  await page.goto('/')
  await root(page).evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await expect(root(page)).toHaveAttribute('data-status-demo-ready', '')
}

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`status filter at ${viewport.width}`, () => {
    test.use({ viewport })

    test('sits in the Organise feature with All Notes and the five statuses', async ({ page }) => {
      await open(page)
      await expect(page.locator('#feature-organise [data-status-demo]')).toHaveCount(1)
      await expect(filters(page).getByRole('button')).toHaveCount(STATUSES.length + 1)
      for (const which of ['all', ...STATUSES] as const) {
        await expect(filter(page, which)).toHaveAccessibleName(`${nameOf(which)} ${countOf(which)}`)
      }
      expect(await pressed(page)).toEqual(['all'])
      expect(await shownTitles(page)).toEqual(titlesOf('all'))
    })

    test('keeps only the notes of the status picked, and all of them when picked again', async ({
      page,
    }) => {
      await open(page)
      const live = root(page).locator('[aria-live="polite"]')
      await expect(live).toHaveText('')

      for (const which of STATUSES) {
        await filter(page, which).click()
        expect(await pressed(page)).toEqual([which])
        await expect.poll(() => shownTitles(page)).toEqual(titlesOf(which))
        await expect(live).toHaveText(demo.summary(nameOf(which), countOf(which), total))
        await expect(root(page).locator('[data-demo-title]')).toHaveText(nameOf(which))
        await expect(root(page).locator('[data-demo-query]')).toHaveText(`status:${which}`)
        await expect(root(page).locator('[data-demo-search]')).toBeVisible()
      }

      await filter(page, 'none').click()
      expect(await pressed(page)).toEqual(['all'])
      await expect.poll(() => shownTitles(page)).toEqual(titlesOf('all'))
      await expect(live).toHaveText(demo.summary(demo.all, total, total))
      await expect(root(page).locator('[data-demo-search]')).toBeHidden()
    })

    test('answers Enter and Space from the keyboard', async ({ page }) => {
      await open(page)
      await filter(page, 'on_hold').focus()
      await page.keyboard.press('Enter')
      expect(await pressed(page)).toEqual(['on_hold'])

      await filter(page, 'active').focus()
      await page.keyboard.press('Space')
      expect(await pressed(page)).toEqual(['active'])
      await expect(filter(page, 'active')).toHaveCSS('outline-style', 'solid')

      await page.keyboard.press('Space')
      expect(await pressed(page)).toEqual(['all'])
    })

    test('gives every filter a target of at least 24 by 24 px', async ({ page }) => {
      await open(page)
      for (const button of await filters(page).getByRole('button').all()) {
        const box = await button.boundingBox()
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(24)
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBe(0)
    })

    test('colours each status with Devot’s status tokens', async ({ page }) => {
      await open(page)
      const tokens = {
        active: '--color-status-active-mark',
        on_hold: '--color-status-hold-mark',
        completed: '--color-status-done-mark',
        dropped: '--color-status-dropped-mark',
      } as const
      for (const [status, token] of Object.entries(tokens)) {
        const [disc, expected] = await filter(page, status as StatusFilter)
          .locator('.status-disc')
          .evaluate((circle, name) => {
            const probe = document.createElement('span')
            probe.style.setProperty('color', `var(${name})`)
            document.body.append(probe)
            const colour = getComputedStyle(probe).color
            probe.remove()
            return [getComputedStyle(circle).fill, colour]
          }, token)
        expect(disc, status).toBe(expected)
      }
      await expect(filter(page, 'none').locator('.status-ring')).toHaveCount(1)
    })
  })
}

test.describe('status filter beside the list, at 1440', () => {
  test.use({ viewport: DESKTOP })

  test('keeps the pane and the page below it in place as the filter changes', async ({ page }) => {
    await open(page)
    const geometry = () =>
      page.evaluate(() => {
        const pane = document.querySelector('.status-demo-pane')?.getBoundingClientRect()
        const next = document.querySelector('#feature-find')?.getBoundingClientRect()
        return [pane?.height, next?.top]
      })
    const before = await geometry()
    for (const which of ['dropped', 'active', 'all'] as const) {
      await filter(page, which).click()
      await settled(page)
      expect(await geometry()).toEqual(before)
    }
  })

  test('fades the notes in, and changes at once with reduced motion', async ({ page }) => {
    await open(page)
    const row = list(page).getByRole('listitem').first()
    expect(
      (await row.evaluate((r) => getComputedStyle(r).transitionDuration))
        .split(', ')
        .map(parseFloat),
    ).toContain(0.2)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await filter(page, 'completed').click()
    expect(await shownTitles(page)).toEqual(titlesOf('completed'))
    const durations = await row.evaluate((r) => getComputedStyle(r).transitionDuration)
    expect(
      durations
        .split(', ')
        .map(parseFloat)
        .every((d) => d < 0.001),
    ).toBe(true)
  })
})

test('ships its script under 2 KB', async ({ page }) => {
  await page.goto('/')
  const sources = await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((s) => (s as HTMLScriptElement).src))
  const demoScript = sources.find((src) => src.includes('StatusDemo'))
  expect(demoScript).toBeDefined()
  const body = await (await page.request.get(demoScript ?? '')).body()
  expect(body.length).toBeLessThanOrEqual(2048)
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`passes an accessibility scan with a filter on, in the ${colorScheme} appearance`, async ({
    page,
  }) => {
    for (const viewport of [DESKTOP, PHONE]) {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
      await open(page)
      await filter(page, 'on_hold').click()
      await settled(page)

      const scan = await new AxeBuilder({ page })
        .include('[data-status-demo]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze()
      expect(scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)).toEqual([])
    }
  })
}
