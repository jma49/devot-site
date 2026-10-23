import type { Page } from '@playwright/test'
import { PAUSE_KEY } from '../../src/scripts/pause.ts'
import { steady } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

// The header bar and the download pill stay fixed over the page, so whatever the keyboard focuses
// in the page, focus ring and all, must scroll clear of them from either direction (WCAG 2.4.11).

interface Focused {
  name: string
  inHeader: boolean
  /** In main or the footer; the skip link is drawn over the bar on purpose. */
  inPage: boolean
  /** Marked `data-walk-end`: the last stop of a walk. */
  end: boolean
  covered: number
}

const focused = (page: Page) =>
  page.evaluate((): Focused | null => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || active === document.body) return null
    const style = getComputedStyle(active)
    const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
    const rect = active.getBoundingClientRect()
    const box = {
      top: rect.top - ring,
      right: rect.right + ring,
      bottom: rect.bottom + ring,
      left: rect.left - ring,
    }
    const chrome = [
      ...document.querySelectorAll('[data-site-header] .bar, [data-download-pill][data-shown]'),
    ].filter((element) => !element.contains(active))
    const covered = Math.max(
      0,
      ...chrome.map((element) => {
        const over = element.getBoundingClientRect()
        const width = Math.min(box.right, over.right) - Math.max(box.left, over.left)
        const height = Math.min(box.bottom, over.bottom) - Math.max(box.top, over.top)
        return Math.max(0, width) * Math.max(0, height)
      }),
    )
    const label = active.getAttribute('aria-label') ?? active.textContent ?? ''
    return {
      name: `${active.tagName.toLowerCase()}.${active.className} "${label.trim().slice(0, 40)}"`,
      inHeader: !!active.closest('[data-site-header]'),
      inPage: !!active.closest('main, footer'),
      end: active.hasAttribute('data-walk-end'),
      covered: Math.round(covered),
    }
  })

/** Presses `key` until `done`, and lists every stop in the page that the chrome covers. */
async function walk(page: Page, key: string, done: (stop: Focused | null) => boolean) {
  const visited: string[] = []
  const covered: string[] = []
  for (let step = 0; step < 200; step++) {
    await page.keyboard.press(key)
    const stop = await steady(page, () => focused(page))
    if (stop?.inPage) {
      visited.push(stop.name)
      if (stop.covered > 0) covered.push(`${stop.name}: ${stop.covered} px²`)
    }
    if (done(stop)) return { visited, covered }
  }
  throw new Error(`E_FOCUS_WALK no end after 200 presses of ${key}`)
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test.describe(`keyboard focus at ${viewport.width}, animations paused`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), PAUSE_KEY)
      await page.goto('/')
      await expect(page.locator('[data-features-ready]')).toHaveCount(1)
      await expect(page.locator('.clip-control')).not.toHaveCount(0)
    })

    test('stops clear of the header bar going back up the page', async ({ page, browserName }) => {
      // WebKit, as Safari by default, moves Tab between text fields only; Option-Tab reaches all.
      const back = browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab'
      await page.locator('.site-footer a').last().focus()

      const { visited, covered } = await walk(page, back, (stop) => stop?.inHeader === true)

      expect(visited.some((name) => name.includes('closing__cta'))).toBe(true)
      expect(visited.filter((name) => name.includes('clip-control')).length).toBeGreaterThan(5)
      expect(covered).toEqual([])
    })

    test('leaves room above for a control that is still rising into place', async ({ page }) => {
      // Pressed in quick succession, focus can reach a control before it is revealed: the browser
      // scrolls it to the padding, then it rises by the reveal offset, focus ring and all.
      const cta = page.locator('.closing__cta')
      await cta.focus()
      const room = await cta.evaluate((button) => {
        const root = getComputedStyle(document.documentElement)
        const style = getComputedStyle(button)
        const bar = document.querySelector('[data-site-header] .bar')?.getBoundingClientRect()
        return (
          parseFloat(root.scrollPaddingTop) -
          parseFloat(root.getPropertyValue('--site-reveal-rise')) -
          parseFloat(style.outlineWidth) -
          parseFloat(style.outlineOffset) -
          (bar?.bottom ?? Infinity)
        )
      })
      expect(room).toBeGreaterThanOrEqual(0)
    })

    test('stops clear of the header bar and the download pill going down the page', async ({
      page,
      browserName,
    }) => {
      const forward = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
      const last = page.locator('.site-footer a').last()
      await last.evaluate((link) => link.setAttribute('data-walk-end', ''))

      const { visited, covered } = await walk(page, forward, (stop) => stop?.end === true)

      expect(visited.some((name) => name.includes('closing__cta'))).toBe(true)
      expect(covered).toEqual([])
    })
  })
}
