import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { frames, scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

// Axe cannot rate text over a gradient, an image or a backdrop filter, so these tests hide the text,
// capture what lies under it and compare that with the text's colour.

// WebKit's page capture adds a style element, which the policy would refuse and log.
test.use({ bypassCSP: true })

interface Line {
  label: string
  x: number
  y: number
  width: number
  height: number
  /** The WCAG relative luminance of the line's text colour. */
  luminance: number
}

/** Every line of text inside each labelled selector, with its colour as the browser resolves it. */
const textLines = (page: Page, targets: Record<string, string>) =>
  page.evaluate((entries) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const luminance = (colour: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = colour
      context.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0] = [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)].map(
        (channel) => {
          const c = channel / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        },
      )
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const found: Line[] = []
    for (const [label, selector] of Object.entries(entries)) {
      for (const root of document.querySelectorAll(selector)) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement
          if (!parent || !node.textContent?.trim()) continue
          const colour = luminance(getComputedStyle(parent).color)
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const { x, y, width, height } of range.getClientRects()) {
            if (width > 0 && height > 0)
              found.push({ label, x, y, width, height, luminance: colour })
          }
        }
      }
    }
    return found
  }, targets)

/** Makes the text inside each selector transparent, with no transition to wait for. */
const hideText = (page: Page, selectors: string[]) =>
  page.evaluate((list) => {
    for (const root of document.querySelectorAll<HTMLElement>(list.join(','))) {
      for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        element.style.setProperty('transition', 'none', 'important')
        element.style.setProperty('color', 'transparent', 'important')
      }
    }
  }, selectors)

/** Shows the text again at once: with its colour transition back, a read could land mid-fade. */
const showText = (page: Page, selectors: string[]) =>
  page.evaluate((list) => {
    for (const root of document.querySelectorAll<HTMLElement>(list.join(','))) {
      for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        element.style.removeProperty('color')
      }
    }
  }, selectors)

const linear = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * The lowest contrast per label between each line's text colour and the mean luminance of the
 * screen under it, taken in cells as wide as the line is tall so a bright patch is not averaged away.
 */
async function lowestContrast(page: Page, lines: Line[]): Promise<Record<string, number>> {
  const viewport = page.viewportSize()!
  const clipX = Math.max(0, Math.floor(Math.min(...lines.map(({ x }) => x))))
  const clipY = Math.max(0, Math.floor(Math.min(...lines.map(({ y }) => y))))
  const clip = {
    x: clipX,
    y: clipY,
    width:
      Math.min(viewport.width, Math.ceil(Math.max(...lines.map((l) => l.x + l.width)))) - clipX,
    height:
      Math.min(viewport.height, Math.ceil(Math.max(...lines.map((l) => l.y + l.height)))) - clipY,
  }
  const { data, info } = await sharp(
    await page.screenshot({ clip, scale: 'css', caret: 'initial' }),
  )
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const lowest: Record<string, number> = {}
  for (const line of lines) {
    const top = Math.max(0, Math.ceil(line.y - clip.y))
    const bottom = Math.min(info.height, Math.floor(line.y - clip.y + line.height))
    const end = Math.min(info.width, line.x - clip.x + line.width)
    for (let left = Math.max(0, line.x - clip.x); left < end; left += line.height) {
      let sum = 0
      let count = 0
      for (let y = top; y < bottom; y++) {
        for (let x = Math.ceil(left); x < Math.min(end, left + line.height); x++) {
          const at = (y * info.width + x) * 3
          sum +=
            0.2126 * linear(data[at]!) +
            0.7152 * linear(data[at + 1]!) +
            0.0722 * linear(data[at + 2]!)
          count++
        }
      }
      if (count === 0) continue
      const back = sum / count
      const ratio =
        (Math.max(back, line.luminance) + 0.05) / (Math.min(back, line.luminance) + 0.05)
      lowest[line.label] = Math.min(lowest[line.label] ?? Infinity, ratio)
    }
  }
  return lowest
}

const merge = (into: Record<string, number>, from: Record<string, number>) => {
  for (const [label, ratio] of Object.entries(from)) {
    into[label] = Math.min(into[label] ?? Infinity, ratio)
  }
}

const HERO_TEXT = {
  lead: '.hero-lead',
  requirements: '.hero-requirements',
  'install note': '#hero .install-note',
}

/** Stops each band of the CSS aurora at a fraction of its sway: Sage's first, then Tide's. */
const holdAurora = (page: Page, sage: number, tide: number) =>
  page.evaluate(
    ([a, b]) => {
      for (const animation of document.getAnimations()) {
        if (!(animation instanceof CSSAnimation)) continue
        const at = { 'aurora-sway-a': a, 'aurora-sway-b': b }[animation.animationName]
        if (at === undefined) continue
        animation.pause()
        animation.currentTime = at * Number(animation.effect?.getTiming().duration)
      }
    },
    [sage, tide],
  )

const PHASES = [0, 0.25, 0.5, 0.75, 1]

for (const colorScheme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`hero text stays at 4.5:1 over the CSS aurora, ${colorScheme}, ${viewport.width}`, async ({
      page,
    }) => {
      test.slow()
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      // A module that never finishes keeps the WebGL backdrop from starting, without a console error.
      await page.route('**/hero-backdrop.*.js', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: 'await new Promise(() => {})' }),
      )
      await page.goto('/')
      await page.locator('#hero .install-note').scrollIntoViewIfNeeded()
      const lines = await textLines(page, HERO_TEXT)
      await hideText(page, Object.values(HERO_TEXT))

      const lowest: Record<string, number> = {}
      for (const sage of PHASES) {
        for (const tide of PHASES) {
          await holdAurora(page, sage, tide)
          await frames(page)
          merge(lowest, await lowestContrast(page, lines))
        }
      }
      expect(Object.keys(lowest).sort()).toEqual(Object.keys(HERO_TEXT).sort())
      for (const [label, ratio] of Object.entries(lowest)) {
        expect(ratio, label).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
}

test.describe('the glass bar over the page, dark, at 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })

  test('keeps its links at 4.5:1 while the light theme card passes under it', async ({ page }) => {
    test.slow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const nav = { links: '.nav .nav-link' }
    const { top, bottom } = await page.evaluate(() => {
      const box = document
        .querySelector('.card-swatches')!
        .closest('.card')!
        .getBoundingClientRect()
      return { top: window.scrollY + box.top, bottom: window.scrollY + box.bottom }
    })

    const lowest: Record<string, number> = {}
    for (let y = top - 240; y < bottom; y += 80) {
      await showText(page, Object.values(nav))
      await scrollToY(page, y)
      await page.waitForSelector('[data-scrolled]')
      const lines = await textLines(page, nav)
      await hideText(page, Object.values(nav))
      await frames(page)
      const seen = await lowestContrast(page, lines)
      for (const [label, ratio] of Object.entries(seen)) {
        expect.soft(ratio, `${label} at ${y}`).toBeGreaterThanOrEqual(4.5)
      }
      merge(lowest, seen)
    }
    expect(Object.keys(lowest)).toEqual(['links'])
  })
})
