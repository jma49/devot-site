import { expect, test } from './fixtures.ts'

const MARKS = ['.site-header .brand-mark', '.download-pill .pill-mark', '.site-footer__mark']

for (const scheme of ['light', 'dark'] as const) {
  test(`draws the dove in its own ${scheme} ink in the header, pill and footer`, async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    const file = scheme === 'dark' ? /\/dove-dark\.[\w-]+\.svg"?\)$/ : /\/dove\.[\w-]+\.svg"?\)$/

    for (const selector of MARKS) {
      const look = await page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element)
        return { image: style.backgroundImage, mask: style.maskImage }
      })
      expect(look.image, selector).toMatch(file)
      expect(look.mask, selector).toBe('none')

      const url = /url\("?([^")]+)"?\)/.exec(look.image)?.[1] ?? ''
      const response = await request.get(url)
      expect(response.status(), url).toBe(200)
      expect(await response.text(), url).toContain('fill="url(#devot-ink)"')
    }
  })
}
