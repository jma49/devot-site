import { expect, test } from './fixtures.ts'

const MARKS = [
  ['.site-header .brand-mark', null, 'small'],
  ['.download-pill .pill-mark', null, 'small'],
  ['.local__mark', '::after', 'small'],
  ['.closing__mark', null, 'full'],
  ['.site-footer__mark', null, 'small'],
] as const

for (const scheme of ['light', 'dark'] as const) {
  test(`draws the dove in its own ${scheme} ink wherever the page shows it`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    // Past the hero, where the header no longer wears its night.
    await page.locator('#write').evaluate((section) => section.scrollIntoView())
    await expect(page.locator('[data-site-header]')).not.toHaveAttribute('data-scope', /.*/)

    for (const [selector, pseudo, cut] of MARKS) {
      const file = new RegExp(
        `/dove${cut === 'small' ? '-small' : ''}${scheme === 'dark' ? '-dark' : ''}\\.[\\w-]+\\.svg"?\\)$`,
      )
      const look = await page.locator(selector).evaluate((element, part) => {
        const style = getComputedStyle(element, part)
        return { image: style.backgroundImage, mask: style.maskImage }
      }, pseudo)
      expect(look.image, selector).toMatch(file)
      expect(look.mask, selector).toBe('none')

      const url = /url\("?([^")]+)"?\)/.exec(look.image)?.[1] ?? ''
      const response = await request.get(url)
      expect(response.status(), url).toBe(200)
      expect(await response.text(), url).toContain('fill="url(#devot-ink)"')
    }
  })
}

test('draws the header dove in its dark ink over the hero at night, on a light page too', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.locator('[data-site-header]')).toHaveAttribute('data-scope', 'dark')
  const image = await page
    .locator('.site-header .brand-mark')
    .evaluate((element) => getComputedStyle(element).backgroundImage)
  expect(image).toMatch(/\/dove-small-dark\.[\w-]+\.svg"?\)$/)
})
