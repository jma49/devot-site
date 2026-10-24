import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { FOOTER_GROUPS, INSTALL_URL, RELEASES_URL, STORAGE_DOC_URL } from '../../src/lib/links.ts'
import { DOWNLOAD_URL, REPO_URL } from '../../src/site.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y)
const scrollSettled = async (page: Page, y: number) => {
  await scrollTo(page, y)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}
const scrollToBottom = (page: Page) =>
  page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
const docTop = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => element.getBoundingClientRect().top + window.scrollY)
const timelines = (page: Page) => page.evaluate(() => CSS.supports('animation-timeline: view()'))
const shiftX = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)
const shiftY = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42)
const variable = (page: Page, selector: string, name: string) =>
  page
    .locator(selector)
    .evaluate((element, prop) => getComputedStyle(element).getPropertyValue(prop).trim(), name)

async function violations(page: Page, selector: string): Promise<string[]> {
  const scan = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  return scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)
}

test.describe('local-first section at desktop width', () => {
  test.use({ viewport: DESKTOP })

  test('says where the notes live, with a heading, a lede, facts, a paragraph and a link', async ({
    page,
  }) => {
    await page.goto('/')
    const section = page.locator('#local-first')

    await expect(section.getByRole('heading', { level: 2 })).toHaveText(en.privacy.title)
    await expect(section.getByText(en.privacy.lede)).toBeVisible()
    await expect(section.getByText(en.privacy.body)).toBeVisible()
    await expect(section.getByRole('link', { name: en.privacy.link })).toHaveAttribute(
      'href',
      STORAGE_DOC_URL,
    )
    const chips = section.locator('.local__chip')
    await expect(chips).toHaveCount(en.privacy.facts.rows.flat().length)
    expect(await chips.count()).toBeGreaterThanOrEqual(5)
    await expect(section.getByRole('group', { name: en.privacy.facts.label })).toBeVisible()
  })

  test('puts the facts between the two parts of the heading', async ({ page }) => {
    await page.goto('/')

    const [title, strip, lede] = await Promise.all(
      ['.local__title', '.local__strip', '.local__lede'].map((selector) =>
        page.locator(selector).evaluate((element) => element.getBoundingClientRect().top),
      ),
    )
    expect(title).toBeLessThan(strip as number)
    expect(strip).toBeLessThan(lede as number)
  })

  test('keeps the facts out of the tab order: only the link and the disclosure take focus', async ({
    page,
  }) => {
    await page.goto('/')

    const stops = await page
      .locator('#local-first')
      .locator('a[href], button, summary, input, select, textarea, [tabindex]')
      .evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase()))
    expect(stops).toEqual(['a', 'summary'])
  })

  test('draws the frame line around a dove that interrupts it', async ({ page }) => {
    await page.goto('/')

    const frame = await page.locator('.local__frame').boundingBox()
    const mark = await page.locator('.local__mark').boundingBox()
    expect(mark).not.toBeNull()
    expect(frame).not.toBeNull()
    const centre = (mark?.x ?? 0) + (mark?.width ?? 0) / 2
    expect(centre).toBeCloseTo((frame?.x ?? 0) + (frame?.width ?? 0) / 2, 0)
    expect((mark?.y ?? 0) + (mark?.height ?? 0) / 2).toBeCloseTo(frame?.y ?? 0, 0)
    const line = await page
      .locator('.local__frame')
      .evaluate((element) => getComputedStyle(element, '::before').maskComposite)
    expect(line).toContain('exclude')
  })

  test.describe('with motion', () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
    })

    test('drifts the rows against each other as the page scrolls, 0.1 to 0.25 px per px, both ways', async ({
      page,
    }) => {
      await page.goto('/')
      test.skip(!(await timelines(page)), 'no view timelines')
      const rowTop = await docTop(page, '.local__row')
      const start = rowTop - DESKTOP.height + 100
      const row = (n: number) => `.local__row:nth-child(${n})`

      const shifts = () => Promise.all([1, 2, 3].map((n) => shiftX(page, row(n))))

      await scrollSettled(page, start)
      const before = await shifts()
      await scrollSettled(page, start + 300)
      const after = await shifts()

      const slopes = after.map((value, index) => (value - (before[index] ?? 0)) / 300)
      for (const [index, slope] of slopes.entries()) {
        const direction = index === 1 ? -1 : 1
        expect(slope * direction, `row ${index + 1}`).toBeGreaterThan(0.1)
        expect(slope * direction, `row ${index + 1}`).toBeLessThan(0.25)
      }

      await scrollSettled(page, start)
      const back = await shifts()
      for (const [index, value] of back.entries()) expect(value).toBeCloseTo(before[index] ?? 0, 0)
    })

    test('moves the rows by transform alone, on a view timeline', async ({ page }) => {
      await page.goto('/')
      test.skip(!(await timelines(page)), 'no view timelines')

      const animated = await page.locator('.local__row').evaluateAll((rows) =>
        rows.map((row) =>
          row.getAnimations().map((animation) => ({
            timeline: animation.timeline?.constructor.name,
            properties: [
              ...new Set(
                (animation.effect as KeyframeEffect)
                  .getKeyframes()
                  .flatMap((frame) => Object.keys(frame))
                  .filter(
                    (key) => !['offset', 'easing', 'composite', 'computedOffset'].includes(key),
                  ),
              ),
            ],
          })),
        ),
      )
      expect(animated).toHaveLength(en.privacy.facts.rows.length)
      for (const rows of animated) {
        expect(rows).toEqual([{ timeline: 'ViewTimeline', properties: ['transform'] }])
      }
    })

    test('reveals the heading, the facts, the lede, the paragraph and the link in that order, 50 ms apart', async ({
      page,
    }) => {
      await page.goto('/')
      await scrollTo(page, (await docTop(page, '#local-first')) - 60)

      const parts = [
        '.local__title',
        '.local__strip',
        '.local__lede',
        '.local__body',
        '.local__actions',
      ]
      for (const part of parts)
        await expect(page.locator(part)).toHaveAttribute('data-revealed', '')
      const delays = await Promise.all(
        parts.map((part) => variable(page, part, '--site-reveal-delay')),
      )
      expect(delays).toEqual(['0ms', '50ms', '100ms', '150ms', '200ms'])
      const durations = await Promise.all(
        parts.map((part) =>
          page.locator(part).evaluate((element) => getComputedStyle(element).transitionDuration),
        ),
      )
      expect(new Set(durations.flatMap((value) => value.split(', ')))).toEqual(new Set(['0.4s']))
    })

    test('nudges the arrow of the link within 200 to 300 ms on hover', async ({ page }) => {
      await page.goto('/')
      await scrollTo(page, (await docTop(page, '#local-first')) + 200)
      const link = page.getByRole('link', { name: en.privacy.link })
      const arrow = page.locator('.local__arrow')

      const seconds = await arrow.evaluate((element) =>
        parseFloat(getComputedStyle(element).transitionDuration),
      )
      expect(seconds).toBeGreaterThanOrEqual(0.2)
      expect(seconds).toBeLessThanOrEqual(0.3)
      expect(await arrow.evaluate((element) => getComputedStyle(element).translate)).toBe('none')
      await link.hover()

      await expect
        .poll(() => arrow.evaluate((element) => getComputedStyle(element).translate))
        .not.toBe('none')
    })
  })

  test('lists what goes over the network in a disclosure that opens from the keyboard', async ({
    page,
  }) => {
    await page.goto('/')
    const details = page.locator('.local__network')
    const summary = details.getByText(en.privacy.network.summary)

    await expect(details).not.toHaveAttribute('open', '')
    await summary.focus()
    await page.keyboard.press('Enter')

    await expect(details).toHaveAttribute('open', '')
    for (const item of en.privacy.network.items) {
      await expect(details.getByText(item.term, { exact: true })).toBeVisible()
      await expect(details.getByText(item.text, { exact: true })).toBeVisible()
    }
    await expect(details.getByText(en.privacy.network.footnote)).toBeVisible()
    await page.keyboard.press('Space')
    await expect(details).not.toHaveAttribute('open', '')
  })

  test('shows static, wrapped facts and everything at once under reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const rowTop = await docTop(page, '.local__row')
    await scrollTo(page, rowTop - 300)

    for (const row of await page.locator('.local__row').all()) {
      await expect(row).toHaveCSS('transform', 'none')
      await expect.poll(() => row.evaluate((element) => element.getAnimations().length)).toBe(0)
      const [rowBox, stripBox] = await Promise.all([
        row.boundingBox(),
        page.locator('.local__strip').boundingBox(),
      ])
      expect(rowBox?.width).toBeLessThanOrEqual((stripBox?.width ?? 0) + 1)
    }
    for (const element of await page.locator('#local-first [data-reveal]').all()) {
      await expect(element).toHaveAttribute('data-revealed', '')
      await expect(element).toHaveCSS('opacity', '1')
      await expect(element).toHaveCSS('transform', 'none')
    }
    const glow = await page.evaluate(
      () => getComputedStyle(document.querySelector('.local') as Element, '::before').animationName,
    )
    expect(glow).toBe('none')
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`passes an accessibility scan in ${colorScheme} with the disclosure open`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto('/')
      await page.locator('.local__network summary').click()

      expect(await violations(page, '#local-first')).toEqual([])
    })
  }
})

test.describe('local-first section on a tablet', () => {
  test.use({ viewport: { width: 900, height: 800 } })

  test('lays the facts out in the frame and runs no drift below 1000 px', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await scrollTo(page, (await docTop(page, '.local__strip')) - 100)

    const frame = await page.locator('.local__frame').boundingBox()
    for (const chip of await page.locator('.local__chip').all()) {
      const box = await chip.boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(frame?.x ?? 0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        (frame?.x ?? 0) + (frame?.width ?? 0),
      )
    }
    for (const row of await page.locator('.local__row').all()) {
      await expect.poll(() => row.evaluate((element) => element.getAnimations().length)).toBe(0)
    }
  })
})

test.describe('local-first section on a phone', () => {
  test.use({ viewport: PHONE })

  test('wraps every fact inside the screen and runs no drift', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await scrollTo(page, (await docTop(page, '.local__strip')) - 100)

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width,
    )
    for (const chip of await page.locator('.local__chip').all()) {
      const box = await chip.boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(PHONE.width)
    }
    for (const row of await page.locator('.local__row').all()) {
      await expect.poll(() => row.evaluate((element) => element.getAnimations().length)).toBe(0)
      await expect(row).toHaveCSS('transform', 'none')
    }
  })

  test('keeps the link and the disclosure at least 44 px tall', async ({ page }) => {
    await page.goto('/')

    for (const target of [
      page.getByRole('link', { name: en.privacy.link }),
      page.locator('.local__network summary'),
    ]) {
      const box = await target.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('closing call to action', () => {
  test.use({ viewport: DESKTOP })

  test('asks for the download with the requirements, the source and the releases', async ({
    page,
  }) => {
    await page.goto('/')
    const section = page.locator('#download')

    await expect(section.getByRole('heading', { level: 2 })).toHaveText(en.closing.title.join(' '))
    const cta = section.getByRole('link', { name: en.download.label })
    await expect(cta).toHaveAttribute('href', DOWNLOAD_URL)
    await expect(cta).toHaveAccessibleDescription(en.download.requirements)
    await expect(section.getByText(en.download.requirements)).toBeVisible()
    await expect(section.getByRole('link', { name: en.closing.links.source })).toHaveAttribute(
      'href',
      REPO_URL,
    )
    await expect(section.getByRole('link', { name: en.closing.links.releases })).toHaveAttribute(
      'href',
      RELEASES_URL,
    )
    await expect(section.getByRole('link', { name: en.install.link })).toHaveAttribute(
      'href',
      INSTALL_URL,
    )
    await expect(section.getByText(en.closing.installNote)).toBeVisible()
  })

  test('sets its title in the hero’s display tier, so the page ends as it began', async ({
    page,
  }) => {
    await page.goto('/')
    const type = (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const style = getComputedStyle(element)
        return [style.fontSize, style.fontWeight, style.letterSpacing, style.lineHeight]
      })

    expect(await type('#download h2')).toEqual(await type('#hero h1'))
  })

  test('brings the gradient back, in the scheme of the page', async ({ page }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await page.goto('/')
      const shown = await page.locator('.closing__glow').evaluateAll((glows) =>
        glows
          .filter((glow) => getComputedStyle(glow).display !== 'none')
          .map((glow) => ({
            appearance: glow.getAttribute('data-appearance-preview'),
            image: getComputedStyle(glow).backgroundImage,
          })),
      )
      expect(shown).toHaveLength(1)
      expect(shown[0]?.appearance).toBe(colorScheme)
      expect(shown[0]?.image.match(/linear-gradient/g)).toHaveLength(2)
    }
  })

  test.describe('with motion', () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
    })

    test('moves the gradient against the scroll, both ways', async ({ page }) => {
      await page.goto('/')
      test.skip(!(await timelines(page)), 'no view timelines')
      const glow = '.closing__glow[data-appearance-preview="light"]'
      const top = await docTop(page, '#download')

      await scrollSettled(page, top - DESKTOP.height + 50)
      const early = await shiftY(page, glow)
      await scrollSettled(page, top + 100)
      const late = await shiftY(page, glow)
      await scrollSettled(page, top - DESKTOP.height + 50)

      expect(early).toBeLessThan(late - 40)
      expect(await shiftY(page, glow)).toBeCloseTo(early, 0)
    })

    test('reveals the lines, the lead, the button, the links and the note in order', async ({
      page,
    }) => {
      await page.goto('/')
      await scrollTo(page, await docTop(page, '#download'))

      const parts = [
        '.closing__mark',
        '.closing__line:nth-child(1)',
        '.closing__line:nth-child(2)',
        '.closing__lead',
        '.closing__action',
        '.closing__links',
        '.closing__note',
      ]
      for (const part of parts)
        await expect(page.locator(part)).toHaveAttribute('data-revealed', '')
      const delays = await Promise.all(
        parts.map((part) => variable(page, part, '--site-reveal-delay')),
      )
      expect(delays).toEqual(['0ms', '50ms', '100ms', '150ms', '200ms', '250ms', '300ms'])
    })

    test('grows the button to 1.02 and lifts its shadow on hover, in 220 to 420 ms', async ({
      page,
    }) => {
      await page.goto('/')
      await scrollTo(page, await docTop(page, '#download'))
      const cta = page.locator('.closing__cta')
      await expect(page.locator('.closing__action')).toHaveAttribute('data-revealed', '')
      const rest = await cta.evaluate((element) => getComputedStyle(element).boxShadow)

      const seconds = await cta.evaluate((element) =>
        getComputedStyle(element)
          .transitionDuration.split(',')
          .map((value) => parseFloat(value)),
      )
      for (const value of seconds) {
        expect(value).toBeGreaterThanOrEqual(0.22)
        expect(value).toBeLessThanOrEqual(0.42)
      }
      await cta.hover()

      await expect
        .poll(() => cta.evaluate((element) => parseFloat(getComputedStyle(element).scale)))
        .toBeCloseTo(1.02, 2)
      expect(await cta.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(rest)
    })
  })

  test('holds the button still under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await scrollTo(page, await docTop(page, '#download'))
    const cta = page.locator('.closing__cta')

    await cta.hover()

    await expect(cta).toHaveCSS('scale', 'none')
    for (const element of await page.locator('#download [data-reveal]').all()) {
      await expect(element).toHaveAttribute('data-revealed', '')
      await expect(element).toHaveCSS('opacity', '1')
    }
    expect(
      await page
        .locator('.closing__glow')
        .first()
        .evaluate((element) => element.getAnimations().length),
    ).toBe(0)
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`passes an accessibility scan in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto('/')

      expect(await violations(page, '#download')).toEqual([])
    })
  }
})

test.describe('closing call to action on a phone', () => {
  test.use({ viewport: PHONE })

  test('fits the screen, with a button 44 px tall and a full-width tap target', async ({
    page,
  }) => {
    await page.goto('/')
    await scrollTo(page, await docTop(page, '#download'))

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width,
    )
    const box = await page.locator('.closing__cta').boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(PHONE.width)
    for (const link of await page.locator('.closing__links a').all()) {
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('footer', () => {
  test.use({ viewport: DESKTOP })

  test('has four labelled link groups of real links, the brand and a copyright line', async ({
    page,
  }) => {
    await page.goto('/')
    const footer = page.getByRole('contentinfo')

    await expect(footer.getByRole('navigation', { name: en.footer.label })).toBeVisible()
    for (const group of FOOTER_GROUPS) {
      const copy = en.footer.groups[group.id]
      const list = footer.getByRole('list', { name: copy.title })
      const labels: Record<string, string> = copy.links
      await expect(list.getByRole('link')).toHaveCount(group.links.length)
      for (const link of group.links) {
        await expect(
          list.getByRole('link', { name: labels[link.id], exact: true }),
        ).toHaveAttribute('href', link.href)
      }
    }
    await expect(footer.getByText(en.footer.copyright(new Date().getFullYear()))).toBeVisible()
    await expect(footer.getByText(en.footer.tagline)).toBeVisible()
    await expect(footer.getByRole('link', { name: en.footer.backToTop })).toHaveAttribute(
      'href',
      '/#hero',
    )
    await expect(footer.getByRole('link', { name: en.siteName, exact: true })).toHaveAttribute(
      'href',
      '/',
    )
  })

  test('points every in-page link at a section that exists', async ({ page }) => {
    await page.goto('/')

    const anchors = await page
      .getByRole('contentinfo')
      .locator('a[href^="/#"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')?.slice(1) ?? ''))
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) await expect(page.locator(anchor)).toHaveCount(1)
  })

  test('names its groups in the label tier: uppercase, 12 px semibold, tracked 0.08em', async ({
    page,
  }) => {
    await page.goto('/')

    const label = page.locator('.site-footer__label').first()
    await expect(label).toHaveCSS('font-size', '12px')
    await expect(label).toHaveCSS('font-weight', '600')
    await expect(label).toHaveCSS('letter-spacing', '0.96px')
    await expect(label).toHaveCSS('text-transform', 'uppercase')
    const family = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).fontFamily)
    expect(await family('.site-footer__label')).toBe(await family('body'))
  })

  test('sets the brand in the card heading tier', async ({ page }) => {
    await page.goto('/')
    const type = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element)
          return [style.fontSize, style.fontWeight, style.letterSpacing]
        })

    expect(await type('.site-footer__logo')).toEqual(await type('#cards h3'))
  })

  test('shifts a link to the text colour within 200 ms on hover', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const link = page
      .getByRole('contentinfo')
      .getByRole('link', { name: en.footer.groups.legal.links.licence })
    const colour = () => link.evaluate((element) => getComputedStyle(element).color)

    const rest = await colour()
    expect(
      await link.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration)),
    ).toBeCloseTo(0.2, 2)
    await link.hover()

    await expect.poll(colour).not.toBe(rest)
  })

  test('reveals the brand and the groups 50 ms apart and leaves the bottom row alone', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await scrollToBottom(page)

    const parts = [
      '.site-footer__brand',
      ...FOOTER_GROUPS.map(
        (group) => `.site-footer__group:nth-child(${FOOTER_GROUPS.indexOf(group) + 1})`,
      ),
    ]
    for (const part of parts) await expect(page.locator(part)).toHaveAttribute('data-revealed', '')
    const delays = await Promise.all(
      parts.map((part) => variable(page, part, '--site-reveal-delay')),
    )
    expect(delays).toEqual(['0ms', '50ms', '100ms', '150ms', '200ms'])
    await expect(page.locator('.site-footer__bottom')).not.toHaveAttribute('data-reveal', /.*/)
    await expect(page.locator('.site-footer__bottom')).toHaveCSS('opacity', '1')
  })

  test('shows everything at once under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    for (const element of await page.locator('.site-footer [data-reveal]').all()) {
      await expect(element).toHaveAttribute('data-revealed', '')
      await expect(element).toHaveCSS('opacity', '1')
    }
  })

  test('closes the 404 page too', async ({ page, problems }) => {
    const response = await page.goto('/no/such/page')

    expect(response?.status()).toBe(404)
    await expect(
      page
        .getByRole('contentinfo')
        .getByRole('link', { name: en.footer.groups.legal.links.security }),
    ).toBeVisible()
    await expect(page.locator('.site-footer [data-reveal]')).toHaveCount(0)
    const own = problems.findIndex((p) => p.includes('status of 404'))
    if (own >= 0) problems.splice(own, 1)
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`passes an accessibility scan in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto('/')

      expect(await violations(page, 'footer')).toEqual([])
    })
  }
})

test.describe('footer on a phone', () => {
  test.use({ viewport: PHONE })

  test('stacks the brand over two columns of links and fits the screen', async ({ page }) => {
    await page.goto('/')
    await scrollToBottom(page)

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width,
    )
    const groups = await page.locator('.site-footer__group').evaluateAll((elements) =>
      elements.map((element) => ({
        x: (element as HTMLElement).offsetLeft,
        y: (element as HTMLElement).offsetTop,
      })),
    )
    expect(new Set(groups.map((group) => group.x)).size).toBe(2)
    expect(new Set(groups.map((group) => group.y)).size).toBe(2)
    const brand = await page.locator('.site-footer__brand').boundingBox()
    expect(brand?.y).toBeLessThan((await page.locator('.site-footer__nav').boundingBox())?.y ?? 0)
  })
})

test.describe('skip link', () => {
  test.use({ viewport: DESKTOP })

  test('is the first stop of the tab order', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit tabs to links only with Option+Tab')
    await page.goto('/')

    await page.keyboard.press('Tab')

    await expect(page.getByRole('link', { name: en.chrome.skipLink })).toBeFocused()
  })

  test('hides above the page, shows on focus and moves focus to the main content', async ({
    page,
  }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: en.chrome.skipLink })
    expect((await link.boundingBox())?.y).toBeLessThan(0)

    await link.focus()

    await expect(link).toBeFocused()
    await expect(link).toHaveAttribute('href', '#main')
    await expect.poll(async () => (await link.boundingBox())?.y ?? -1000).toBeGreaterThanOrEqual(0)
    await expect(link).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
    expect(new URL(page.url()).hash).toBe('#main')
  })

  test('is there on the 404 page, which has a main of its own', async ({ page, problems }) => {
    await page.goto('/no/such/page')

    await expect(page.getByRole('link', { name: en.chrome.skipLink })).toHaveAttribute(
      'href',
      '#main',
    )
    await expect(page.locator('main#main')).toHaveCount(1)
    const own = problems.findIndex((p) => p.includes('status of 404'))
    if (own >= 0) problems.splice(own, 1)
  })
})
