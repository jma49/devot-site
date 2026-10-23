import { AxeBuilder } from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
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

  test('gives each card a pill label, one sentence and media anchored to its bottom', async ({
    page,
  }) => {
    await page.goto('/')
    await revealAll(page)

    for (const card of await cards(page).all()) {
      const slot = (await card.getAttribute('data-slot')) as keyof typeof en.cards.items
      const copy = en.cards.items[slot]
      const label = card.getByRole('heading', { level: 3 })
      await expect(label).toHaveText(copy.label)
      await expect(label).toHaveCSS('text-transform', 'uppercase')
      await expect(label).toHaveCSS('font-size', '12px')
      expect(
        parseFloat(await label.evaluate((l) => getComputedStyle(l).letterSpacing)),
      ).toBeCloseTo(0.96, 1)

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
      const media = await box(card.locator('.card-media'))
      const frame = await box(card.locator('.card-window'))
      expect(Math.abs(media.y + media.height - (cardBox.y + cardBox.height))).toBeLessThan(2)
      expect(frame.y + frame.height, `${slot} is cut by the card edge`).toBeGreaterThan(
        cardBox.y + cardBox.height,
      )
      expect(frame.x + frame.width).toBeGreaterThanOrEqual(cardBox.x + cardBox.width - 1)

      const crop = card.locator('.card-crop')
      expect(await crop.evaluate((c) => getComputedStyle(c).maskImage)).toContain('gradient')
      const window = card.locator('.card-window')
      expect(
        parseFloat(await window.evaluate((w) => getComputedStyle(w).borderTopLeftRadius)),
      ).toBeGreaterThanOrEqual(12)
      expect(await window.evaluate((w) => getComputedStyle(w).boxShadow)).not.toBe('none')
      await expect(card.locator('.card-window .clip')).toHaveCount(1)
    }
  })

  test('draws the window controls in the frame, scaled with the clip', async ({ page }) => {
    await page.goto('/')
    const card = cards(page).first()
    await scrollIntoMiddle(card)
    const lights = card.locator('.card-lights circle')
    await expect(lights).toHaveCount(3)
    const frame = await box(card.locator('.card-window'))
    const close = await box(lights.first())
    const points = await card
      .locator('.card-lights')
      .evaluate((svg) => (svg as SVGSVGElement).viewBox.baseVal.width)
    const scale = frame.width / points
    expect(close.x - frame.x).toBeCloseTo(20.5 * scale, 0)
    expect(close.width).toBeCloseTo(13 * scale, 0)
    await expect(card.locator('.card-lights')).toHaveAttribute('aria-hidden', 'true')
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
    await page.waitForTimeout(400)
    const videos = page.locator('#cards video[data-clip]')
    expect(await videos.count()).toBeGreaterThan(0)
    for (const video of await videos.all()) {
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused && v.currentSrc === '')).toBe(
        true,
      )
      await expect(video).toHaveAttribute('poster', /-poster\.webp$/)
    }

    const card = cards(page).nth(1)
    await card.hover()
    await expect(card.locator('.card-window')).toHaveCSS('transform', 'none')
  })
})
