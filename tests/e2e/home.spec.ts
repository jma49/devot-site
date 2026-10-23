import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { themeColors } from '../../src/lib/theme-color.ts'
import { DOWNLOAD_URL } from '../../src/site.ts'
import { readRepoFile } from '../support/source-files.ts'
import { expect, test } from './fixtures.ts'

const tokensCss = readRepoFile('src/theme/tokens.css')
const surface = themeColors(tokensCss)
const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss)?.[1]?.trim()
const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

test('shows the heading, the landmarks and the download link', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(en.meta.title)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.hero.title)
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()
  const download = page.getByRole('link', { name: en.download.label })
  await expect(download).toHaveAttribute('href', DOWNLOAD_URL)
  await expect(download).toHaveAccessibleDescription(en.download.requirements)
  await expect(page.getByText(en.download.requirements)).toBeVisible()
})

test('reports a CSP violation, so a clean run means the page obeys the policy', async ({
  page,
  problems,
}) => {
  await page.goto('/')

  await page.evaluate(() => {
    const script = document.createElement('script')
    script.textContent = 'document.title = "ran"'
    document.head.append(script)
  })

  await expect.poll(() => problems.join('\n')).toContain('CSP violation: script-src')
  await expect(page).toHaveTitle(en.meta.title)
  problems.length = 0
})

async function violations(page: Page): Promise<string[]> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  return scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} appearance`, () => {
    test.use({ colorScheme })

    test("uses devot's page surface and passes an accessibility scan", async ({ page }) => {
      await page.goto('/')

      await expect(page.locator('body')).toHaveCSS('background-color', rgb(surface[colorScheme]))
      expect(await violations(page)).toEqual([])
    })

    test('draws the focus ring from the focus tokens', async ({ page }) => {
      await page.goto('/')
      const download = page.getByRole('link', { name: en.download.label })

      await download.focus()

      const ring = await page.evaluate(() => {
        const probe = document.createElement('span')
        probe.style.setProperty('color', 'var(--color-focus-ring)')
        document.body.append(probe)
        const color = getComputedStyle(probe).color
        probe.remove()
        return color
      })
      await expect(download).toBeFocused()
      await expect(download).toHaveCSS('outline-style', 'solid')
      await expect(download).toHaveCSS('outline-width', token('size-focus-ring') ?? 'missing')
      await expect(download).toHaveCSS('outline-color', ring)
    })

    test('answers an unknown path with the 404 page and status 404', async ({ page, problems }) => {
      const response = await page.goto('/no/such/page')

      expect(response?.status()).toBe(404)
      await expect(page).toHaveTitle(en.notFound.title)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.notFound.heading)
      await expect(page.getByRole('link', { name: en.notFound.home })).toHaveAttribute('href', '/')
      await expect(page.locator('body')).toHaveCSS('background-color', rgb(surface[colorScheme]))
      expect(await violations(page)).toEqual([])
      // The browser logs the page's own 404 status once; any further failure is a real problem.
      const own = problems.findIndex((p) => p.includes('status of 404'))
      if (own >= 0) problems.splice(own, 1)
    })
  })
}

test.describe('motion', () => {
  const transitionSeconds = (page: Page) =>
    page
      .getByRole('link', { name: en.download.label })
      .evaluate((link) => parseFloat(getComputedStyle(link).transitionDuration))

  test("animates hover colour by default, on devot's hover curve", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    expect(await transitionSeconds(page)).toBeGreaterThanOrEqual(0.1)
    await expect(page.getByRole('link', { name: en.download.label })).toHaveCSS(
      'transition-timing-function',
      token('motion-easing-out') ?? 'missing',
    )
  })

  test('drops transitions when the system asks for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    expect(await transitionSeconds(page)).toBeLessThan(0.001)
  })
})
