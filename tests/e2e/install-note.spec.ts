import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { INSTALL_URL } from '../../src/lib/links.ts'
import { animationsDone, scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const SECTIONS = { hero: '#hero', closing: '#download' } as const

const note = (page: Page, section: string) => page.locator(`${section} .install-note`)
const button = (page: Page, section: string) =>
  page.locator(section).getByRole('link', { name: en.download.label })

test('links the install steps in Devot’s README', () => {
  expect(INSTALL_URL).toBe('https://github.com/jma49/devot#download')
})

for (const [name, section] of Object.entries(SECTIONS)) {
  test.describe(`install note under the ${name} download button`, () => {
    for (const viewport of [DESKTOP, PHONE]) {
      test(`says how to open Devot the first time, under the button, at ${viewport.width} px`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto('/')
        await scrollToY(
          page,
          await page
            .locator(section)
            .evaluate((element) => element.getBoundingClientRect().top + window.scrollY),
        )

        const text = note(page, section)
        const words = en.install.note.map((run) => (typeof run === 'string' ? run : run.unbroken))
        await expect(text).toHaveText(`${words.join('')} ${en.install.link}`)
        await expect(text.locator('.install-note__unbroken')).toHaveText('right-click')
        await expect(text.locator('.install-note__unbroken')).toHaveCSS('white-space', 'nowrap')
        const link = text.getByRole('link', { name: en.install.link })
        await expect(link).toHaveAttribute('href', INSTALL_URL)
        expect(await link.evaluate((a) => getComputedStyle(a).textDecorationLine)).toContain(
          'underline',
        )

        const cta = await button(page, section).boundingBox()
        const box = await text.boundingBox()
        expect(cta && box).toBeTruthy()
        expect(box!.y).toBeGreaterThan(cta!.y + cta!.height)
        expect(Math.abs(box!.x + box!.width / 2 - (cta!.x + cta!.width / 2))).toBeLessThan(2)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      })
    }

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`passes an accessibility scan in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
        await page.goto('/')
        const scan = await new AxeBuilder({ page })
          .include(`${section} .install-note`)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze()
        expect(scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)).toEqual([])
      })
    }
  })
}

test('keeps the hero note and most of the window above the fold at 1440 x 900', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await animationsDone(page, '#hero')

  await expect(note(page, '#hero')).toBeInViewport({ ratio: 1 })
  const frame = await page.locator('.hero-frame').boundingBox()
  expect((DESKTOP.height - (frame?.y ?? DESKTOP.height)) / (frame?.height ?? 1)).toBeGreaterThan(
    0.55,
  )
})
