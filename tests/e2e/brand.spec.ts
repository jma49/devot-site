import { expect, test } from './fixtures.ts'

const MARKS = [
  ['.site-header .brand-mark', null, 'small'],
  ['.download-pill .pill-mark', null, 'small'],
  ['.local__mark', '::after', 'small'],
  ['.closing__mark', null, 'full'],
  ['.site-footer__mark', null, 'small'],
] as const

// The home page wears the night in either scheme, so its doves are the dark ones.
for (const scheme of ['light', 'dark'] as const) {
  test(`draws the dove in its dark ink wherever the home page shows it, on a ${scheme} system`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')

    for (const [selector, pseudo, cut] of MARKS) {
      const file = new RegExp(`/dove${cut === 'small' ? '-small' : ''}-dark\\.[\\w-]+\\.svg"?\\)$`)
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

for (const scheme of ['light', 'dark'] as const) {
  test(`draws the header dove in its own ${scheme} ink on a page that follows the system`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/docs')
    const image = await page
      .locator('.site-header .brand-mark')
      .evaluate((element) => getComputedStyle(element).backgroundImage)
    expect(image).toMatch(
      new RegExp(`/dove-small${scheme === 'dark' ? '-dark' : ''}\\.[\\w-]+\\.svg"?\\)$`),
    )
  })
}
