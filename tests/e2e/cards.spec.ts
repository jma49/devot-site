import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { media } from '../../src/media.ts'
import { expect, test } from './fixtures.ts'

const desktop = { width: 1440, height: 900 }
const phone = { width: 390, height: 844 }

type Rect = { x: number; y: number; width: number; height: number }

const cards = (page: Page) => page.locator('#cards .card')
const box = async (locator: Locator) => {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('E_NO_BOX: element is not rendered')
  return rect
}
const scrollIntoMiddle = (locator: Locator) =>
  locator.evaluate((element) => element.scrollIntoView({ block: 'center' }))
const revealAll = async (page: Page) => {
  const count = await cards(page).count()
  for (let i = 0; i < count; i++) {
    await scrollIntoMiddle(cards(page).nth(i))
    await expect(cards(page).nth(i)).toHaveAttribute('data-revealed', '')
  }
  await expect
    .poll(() => cards(page).evaluateAll((all) => all.map((c) => getComputedStyle(c).opacity)))
    .toEqual(Array(count).fill('1'))
}
const isPlaying = (video: Locator) =>
  video.evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2 && v.currentTime > 0)

test.describe('feature cards at 1440', () => {
  test.use({ viewport: desktop })

  test('shows the heading and six cards in rows that alternate wide and narrow', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 2, name: en.cards.label })).toBeVisible()
    await expect(page.getByRole('region', { name: en.cards.label, exact: true })).toHaveAttribute(
      'id',
      'cards',
    )
    await expect(cards(page)).toHaveCount(6)

    const rects = await Promise.all((await cards(page).all()).map(box))
    const rows = [rects.slice(0, 2), rects.slice(2, 4), rects.slice(4, 6)]
    const shapes = rows.map((row) => row.map((rect) => (rect.width > 560 ? 'wide' : 'narrow')))
    expect(shapes).toEqual([
      ['wide', 'narrow'],
      ['narrow', 'wide'],
      ['wide', 'narrow'],
    ])
    for (const row of rows) {
      const [a, b] = row as [Rect, Rect]
      expect(Math.abs(a.y - b.y)).toBeLessThan(1)
      expect(Math.abs(a.height - b.height)).toBeLessThan(1)
      expect(b.x - (a.x + a.width)).toBeCloseTo(20, 0)
      const wide = Math.max(a.width, b.width)
      const narrow = Math.min(a.width, b.width)
      expect(wide / narrow).toBeGreaterThan(1.4)
      expect(wide / narrow).toBeLessThan(1.6)
    }
    const [first, , third] = rects as Rect[]
    expect(third!.y - (first!.y + first!.height)).toBeCloseTo(20, 0)

    const card = cards(page).first()
    await expect(card).toHaveCSS('border-top-width', '1px')
    expect(
      parseFloat(await card.evaluate((c) => getComputedStyle(c).borderTopLeftRadius)),
    ).toBeGreaterThanOrEqual(12)
  })

  test('gives each card a pill label, a heading, one sentence and media anchored to its bottom', async ({
    page,
  }) => {
    await page.goto('/')
    await revealAll(page)

    for (const card of await cards(page).all()) {
      const slot = (await card.getAttribute('data-slot')) as keyof typeof en.cards.items
      const copy = en.cards.items[slot]
      const label = card.locator('.card-label')
      await expect(label).toHaveText(copy.label)
      expect(await label.evaluate((l) => l.tagName)).toBe('P')
      await expect(label).toHaveCSS('text-transform', 'uppercase')
      await expect(label).toHaveCSS('font-size', '12px')
      expect(
        parseFloat(await label.evaluate((l) => getComputedStyle(l).letterSpacing)),
      ).toBeCloseTo(0.96, 1)

      const heading = card.getByRole('heading')
      await expect(heading).toHaveCount(1)
      await expect(heading).toHaveText(copy.title)
      expect(await heading.evaluate((h) => h.tagName)).toBe('H3')
      expect(
        parseFloat(await heading.evaluate((h) => getComputedStyle(h).fontSize)),
      ).toBeGreaterThanOrEqual(17)
      const [labelBox, headingBox] = await Promise.all([box(label), box(heading)])
      expect(labelBox.y + labelBox.height, `${slot}: label above heading`).toBeLessThanOrEqual(
        headingBox.y,
      )

      if ('keys' in copy) {
        const kbd = card.locator('.card-keys kbd')
        await expect(kbd).toHaveAttribute('aria-hidden', 'true')
        await expect(card.locator('.card-keys')).toHaveText(new RegExp(copy.keys.spoken))
        expect(await kbd.evaluate((k) => k.textContent?.trim()), `${slot} draws its keys`).toBe('')
        // Each symbol draws something, all of it inside the box its svg shows.
        const drawn = await kbd.locator('svg > use').evaluateAll((uses) =>
          uses.map((use) => {
            const shape = (use as SVGUseElement).getBBox()
            const shown = (use.parentElement as unknown as SVGSVGElement).viewBox.baseVal
            return (
              shape.width > 0 &&
              shape.x >= shown.x &&
              shape.y >= shown.y &&
              shape.x + shape.width <= shown.x + shown.width &&
              shape.y + shape.height <= shown.y + shown.height
            )
          }),
        )
        expect(drawn, `${slot}: one whole symbol per glyph`).toEqual(
          [...copy.keys.glyphs].map(() => true),
        )
      }

      const lines = await card.locator('.card-body').evaluate((body) => {
        const perLine = new Map<number, number>()
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
        const range = document.createRange()
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (let i = 0; i < (node.textContent ?? '').length; i++) {
            range.setStart(node, i)
            range.setEnd(node, i + 1)
            const line = Math.round(range.getBoundingClientRect().bottom)
            perLine.set(line, (perLine.get(line) ?? 0) + 1)
          }
        }
        return [...perLine.values()]
      })
      expect(Math.max(...lines), `${slot}: longest line`).toBeGreaterThanOrEqual(40)
      expect(Math.max(...lines), `${slot}: longest line`).toBeLessThanOrEqual(60)

      const cardBox = await box(card)
      const area = await box(card.locator('.card-media'))
      const frame = await box(card.locator('.card-window'))
      expect(Math.abs(area.y + area.height - (cardBox.y + cardBox.height))).toBeLessThan(2)
      expect(frame.y + frame.height, `${slot} is cut by the card edge`).toBeGreaterThan(
        cardBox.y + cardBox.height,
      )
      const cutAtLeft = media[slot].edges.includes('right')
      const overhang = cutAtLeft
        ? cardBox.x - frame.x
        : frame.x + frame.width - (cardBox.x + cardBox.width)
      expect(overhang, `${slot} is cut by the card's side`).toBeGreaterThanOrEqual(-1)

      const crop = card.locator('.card-crop')
      expect(await crop.evaluate((c) => getComputedStyle(c).maskImage)).toContain('gradient')
      const window = card.locator('.card-window')
      expect(await window.evaluate((w) => getComputedStyle(w).boxShadow)).not.toBe('none')
      await expect(card.locator('.card-window .clip')).toHaveCount(1)
    }
  })

  test('rounds only the window corners its clip shows and draws no controls of its own', async ({
    page,
  }) => {
    await page.goto('/')
    for (const slot of ['card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6'] as const) {
      const { edges } = media[slot]
      const window = page.locator(`#cards .card[data-slot="${slot}"] .card-window`)
      const radii = await window.evaluate((w) => {
        const style = getComputedStyle(w)
        return [parseFloat(style.borderTopLeftRadius), parseFloat(style.borderTopRightRadius)]
      })
      const [left = 0, right = 0] = radii
      expect(left >= 12, `${slot} top-left`).toBe(edges.includes('left'))
      expect(right >= 12, `${slot} top-right`).toBe(edges.includes('right'))
    }
    await expect(page.locator('#cards .card-window svg, #cards .card-lights')).toHaveCount(0)
  })

  test('plays a clip only while it is on screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const video = cards(page).nth(1).locator('video[data-clip]')
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)

    await scrollIntoMiddle(cards(page).nth(1))
    await expect.poll(() => isPlaying(video), { timeout: 10_000 }).toBe(true)

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
  })

  test('reveals the cards row by row as they scroll in', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const [first, second, third] = [0, 1, 2].map((i) => cards(page).nth(i))
    expect(await first!.evaluate((c) => getComputedStyle(c).opacity)).toBe('0')

    await page.evaluate(() => {
      const grid = document.querySelector('#cards .cards-grid') as HTMLElement
      window.scrollTo(
        0,
        window.scrollY + grid.getBoundingClientRect().top - window.innerHeight + 140,
      )
    })

    await expect(first!).toHaveAttribute('data-revealed', '')
    await expect(second!).toHaveAttribute('data-revealed', '')
    expect(await third!.getAttribute('data-revealed')).toBeNull()
    const delays = await Promise.all(
      [first!, second!].map((card) =>
        card.evaluate((c) => getComputedStyle(c).getPropertyValue('--site-reveal-delay').trim()),
      ),
    )
    const [lead, next] = delays.map((delay) => parseFloat(delay)) as [number, number]
    expect(next - lead).toBe(50)
    const duration = await first!.evaluate((c) => getComputedStyle(c).transitionDuration)
    expect(duration.split(', ').map(parseFloat)).toContain(0.4)
  })

  test('moves the media with the scroll, in both directions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'))
    test.skip(!supported, 'this engine has no scroll-driven animations')

    const crop = cards(page).nth(2).locator('.card-crop')
    const offsetAt = async (y: number) => {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      await page.evaluate(() => new Promise(requestAnimationFrame))
      return crop.evaluate((c) => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42)
    }
    const top = await crop.evaluate((c) => c.getBoundingClientRect().top + window.scrollY)
    const entering = await offsetAt(top - desktop.height + 40)
    const settled = await offsetAt(top - desktop.height / 2)
    const back = await offsetAt(top - desktop.height + 40)

    expect(entering).toBeGreaterThan(8)
    expect(settled).toBeLessThan(entering)
    expect(back).toBeCloseTo(entering, 0)
  })

  test('answers a pointer with a border and surface shift of 200 ms at most', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await revealAll(page)
    const card = cards(page).nth(1)
    await scrollIntoMiddle(card)
    const look = () =>
      card.evaluate((c) => {
        const style = getComputedStyle(c)
        return [style.borderTopColor, style.backgroundColor]
      })
    const rest = await look()
    const durations = await card.evaluate((c) => {
      const style = getComputedStyle(c)
      const names = style.transitionProperty.split(', ')
      const times = style.transitionDuration.split(', ').map(parseFloat)
      return Object.fromEntries(names.map((name, i) => [name, times[i % times.length]]))
    })
    expect(durations['border-color']).toBeLessThanOrEqual(0.2)
    expect(durations['background-color']).toBeLessThanOrEqual(0.2)

    await card.hover()

    await expect
      .poll(async () => {
        const [border, surface] = await look()
        return [border === rest[0], surface === rest[1]]
      })
      .toEqual([false, false])
  })

  test('lifts the window on hover without moving anything around it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await revealAll(page)
    const card = cards(page).nth(3)
    await scrollIntoMiddle(card)
    const before = await Promise.all([box(card), box(cards(page).nth(2)), box(cards(page).nth(4))])
    const lift = () =>
      card
        .locator('.card-window')
        .evaluate((w) => new DOMMatrixReadOnly(getComputedStyle(w).transform).m42)

    await card.hover()

    await expect.poll(lift).toBeLessThan(-2)
    const after = await Promise.all([box(card), box(cards(page).nth(2)), box(cards(page).nth(4))])
    expect(after).toEqual(before)
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`passes an accessibility scan in the ${colorScheme} appearance`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
      await page.goto('/')
      await revealAll(page)

      const visibleWells = await page
        .locator('#cards .card-well')
        .evaluateAll((wells) =>
          wells
            .filter((well) => getComputedStyle(well).display !== 'none')
            .map((well) => well.getAttribute('data-appearance-preview')),
        )
      expect(new Set(visibleWells)).toEqual(new Set([colorScheme]))

      const scan = await new AxeBuilder({ page })
        .include('#cards')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze()
      expect(scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)).toEqual([])
    })
  }
})

test.describe('feature cards at 390', () => {
  test.use({ viewport: phone })

  test('stacks the cards in one column and keeps their crops', async ({ page }) => {
    await page.goto('/')
    await revealAll(page)
    const rects = await Promise.all((await cards(page).all()).map(box))
    for (const rect of rects) {
      expect(rect.x).toBeCloseTo(rects[0]!.x, 0)
      expect(rect.width).toBeCloseTo(rects[0]!.width, 0)
      expect(rect.x).toBeGreaterThanOrEqual(12)
      expect(rect.x + rect.width).toBeLessThanOrEqual(phone.width - 12)
    }
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.y).toBeGreaterThan(rects[i - 1]!.y + rects[i - 1]!.height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      phone.width,
    )
    for (const card of await cards(page).all()) {
      const cardBox = await box(card)
      const frame = await box(card.locator('.card-window'))
      expect(frame.y + frame.height).toBeGreaterThan(cardBox.y + cardBox.height)
      expect(
        await card.locator('.card-crop').evaluate((c) => getComputedStyle(c).maskImage),
      ).toContain('gradient')
    }
  })
})

test.describe('feature cards on a phone', () => {
  test.use({ viewport: phone })

  test("gives wide cards the narrow cards' media height, in their phone cut's shape", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await revealAll(page)
    const heights = await page
      .locator('#cards .card-media')
      .evaluateAll((areas) => areas.map((area) => Math.round(area.getBoundingClientRect().height)))
    expect(new Set(heights).size, `media heights ${heights.join(', ')}`).toBe(1)

    for (const card of await page.locator('#cards .card[data-shape="wide"]').all()) {
      const slot = (await card.getAttribute('data-slot')) as keyof typeof en.cards.items
      const cut = media[slot].phone!
      const video = card.locator('video[data-clip]')
      await scrollIntoMiddle(card)
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(cut.width)
      const { width, height } = await box(video)
      const file = await video.evaluate((v: HTMLVideoElement) => v.videoWidth / v.videoHeight)
      expect(width / height, slot).toBeCloseTo(cut.width / cut.height, 2)
      expect(file, slot).toBeCloseTo(cut.width / cut.height, 2)
    }
  })
})

test.describe('feature cards with reduced motion', () => {
  test.use({ viewport: desktop })

  test('shows every card and its poster at once, with nothing moving or playing', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    for (const card of await cards(page).all()) {
      await expect(card).toHaveCSS('opacity', '1')
      await expect(card).toHaveCSS('transform', 'none')
      await expect(card.locator('.card-crop')).toHaveCSS('animation-name', 'none')
    }
    await scrollIntoMiddle(cards(page).nth(1))
    const videos = page.locator('#cards video[data-clip]')
    expect(await videos.count()).toBeGreaterThan(0)
    for (const video of await videos.all()) {
      await scrollIntoMiddle(video)
      await expect(video).toHaveAttribute('poster', /-poster\.webp$/)
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused && v.currentSrc === '')).toBe(
        true,
      )
    }

    const card = cards(page).nth(1)
    await card.hover()
    await expect(card.locator('.card-window')).toHaveCSS('transform', 'none')
  })
})

test.describe('feature cards on a touch screen', () => {
  test.use({ viewport: phone, hasTouch: true, isMobile: true })

  test('keeps its resting look when tapped', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium emulates a touch-only screen')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await revealAll(page)
    const card = cards(page).nth(1)
    await scrollIntoMiddle(card)
    const look = () =>
      card.evaluate((c) => [
        getComputedStyle(c).borderTopColor,
        getComputedStyle(c).backgroundColor,
      ])
    const rest = await look()

    await card.tap()

    expect(await look()).toEqual(rest)
  })
})
