import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { media, SLOTS, type Scheme } from '../../src/media.ts'
import { animationsDone } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const desktop = { width: 1440, height: 900 }
const phone = { width: 390, height: 844 }
const KB = 1024

// Every variant decodes and plays in the engine that will pick it: WebKit takes the H.264 MP4 and
// Playwright's Chromium, which has no H.264, the AV1 WebM. Loaded under the site's policy.

for (const name of SLOTS) {
  test(`${name} plays every variant at its stated size and length`, async ({
    page,
    browserName,
  }) => {
    await page.goto('/')
    for (const variant of media[name].variants) {
      const src = browserName === 'chromium' ? variant.webm : variant.mp4
      const played = await page.evaluate(async (url) => {
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.src = url
        document.body.append(video)
        await new Promise((resolve, reject) => {
          video.addEventListener('loadedmetadata', resolve, { once: true })
          video.addEventListener('error', () => reject(new Error(`E_MEDIA_DECODE ${url}`)), {
            once: true,
          })
        })
        await video.play()
        const start = video.currentTime
        await new Promise((resolve) =>
          video.addEventListener('timeupdate', resolve, { once: true }),
        )
        await new Promise((resolve) =>
          video.addEventListener('timeupdate', resolve, { once: true }),
        )
        const result = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          advanced: video.currentTime > start,
        }
        video.remove()
        return result
      }, src)
      expect([played.width, played.height], src).toEqual([variant.width, variant.height])
      expect(Math.abs(played.duration - media[name].duration), src).toBeLessThan(0.1)
      expect(played.advanced, src).toBe(true)
    }
  })
}

// The clips are calm screen recordings, so they loop with reduced motion too; only the reader's
// pause stops them.
for (const [label, viewport] of [
  ['desktop', desktop],
  ['phone', phone],
] as const) {
  test(`plays every clip in view on a loop with reduced motion, ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    for (const video of await page.locator('video[data-clip]').all()) {
      const slot = await video.getAttribute('data-clip')
      if (!(await video.isVisible())) continue
      await video.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      const time = () => video.evaluate((v: HTMLVideoElement) => v.currentTime)
      await expect.poll(time, { message: `${slot} starts`, timeout: 10_000 }).toBeGreaterThan(0)
      const at = await time()
      await expect.poll(time, { message: `${slot} advances` }).not.toBe(at)
      expect(await video.evaluate((v: HTMLVideoElement) => [v.paused, v.loop]), `${slot}`).toEqual([
        false,
        true,
      ])
    }
  })
}

/** Every clip near enough to load has its sources and its poster. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  }
  await expect
    .poll(() =>
      page
        .locator('video[data-clip]')
        .evaluateAll((videos) =>
          videos.every(
            (video) => (video as HTMLVideoElement).currentSrc && video.getAttribute('poster'),
          ),
        ),
    )
    .toBe(true)
}

const transfer = (page: Page) => {
  const sizes: Promise<number>[] = []
  const files: string[] = []
  page.on('requestfinished', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/media/')) files.push(url.pathname)
    sizes.push(request.sizes().then((size) => size.responseBodySize + size.responseHeadersSize))
  })
  return {
    files,
    total: async () => (await Promise.all(sizes)).reduce((sum, bytes) => sum + bytes, 0),
  }
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [label, viewport, firstBudget, wholeBudget] of [
    ['desktop', desktop, 1500, 4000],
    ['phone', phone, 1000, 3000],
  ] as const) {
    test(`loads only the ${scheme} ${label} files, within ${firstBudget} KB first and ${wholeBudget} KB in all`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'transfer sizes come from Chromium')
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' })
      const log = transfer(page)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const first = await log.total()
      await scrollThrough(page)
      await page.waitForLoadState('networkidle')
      const whole = await log.total()

      const dark = (file: string) => /-dark[.-]/.test(file)
      const cut = (file: string) => /-phone[.-]/.test(file)
      expect(log.files.length).toBeGreaterThan(SLOTS.length)
      expect(log.files.filter((file) => dark(file) !== (scheme === 'dark'))).toEqual([])
      const wrongCut = log.files.filter((file) => {
        const slot = file.split('/')[2] as (typeof SLOTS)[number]
        return cut(file) !== (label === 'phone' && media[slot].phone !== undefined)
      })
      expect(wrongCut).toEqual([])
      test.info().annotations.push({
        type: 'transfer',
        description: `${scheme} ${label}: ${Math.round(first / KB)} KB first, ${Math.round(whole / KB)} KB after a full scroll`,
      })
      expect(first / KB).toBeLessThanOrEqual(firstBudget)
      expect(whole / KB).toBeLessThanOrEqual(wholeBudget)
    })
  }
}

for (const scheme of ['light', 'dark'] as const) {
  for (const name of SLOTS) {
    test(`${name} ${scheme} poster shows the frame at its poster time, not the first`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'frames are read from the WebM')
      await page.goto('/')
      const variant = media[name].variants.find((v) => v.scheme === scheme && !v.phone)!
      const differences = await page.evaluate(
        async ({ webm, poster, time }) => {
          const width = 160
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d', { willReadFrequently: true })!
          const grab = (source: CanvasImageSource, w: number, h: number) => {
            canvas.width = width
            canvas.height = Math.round((width * h) / w)
            context.drawImage(source, 0, 0, canvas.width, canvas.height)
            return context.getImageData(0, 0, canvas.width, canvas.height).data
          }
          const meanDifference = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
            let sum = 0
            for (let i = 0; i < a.length; i += 4) {
              sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!)
              sum += Math.abs(a[i + 2]! - b[i + 2]!)
            }
            return sum / ((a.length / 4) * 3)
          }
          const video = document.createElement('video')
          video.muted = true
          video.src = webm
          await new Promise((resolve) =>
            video.addEventListener('loadeddata', resolve, { once: true }),
          )
          const at = async (seconds: number) => {
            video.currentTime = seconds
            await new Promise((resolve) =>
              video.addEventListener('seeked', resolve, { once: true }),
            )
            return grab(video, video.videoWidth, video.videoHeight)
          }
          const first = await at(0)
          const marked = await at(time)
          const image = new Image()
          image.src = poster
          await image.decode()
          const still = grab(image, image.naturalWidth, image.naturalHeight)
          return { first: meanDifference(still, first), marked: meanDifference(still, marked) }
        },
        { webm: variant.webm, poster: variant.poster, time: media[name].posterTime },
      )
      expect(differences.marked).toBeLessThan(2)
      expect(differences.first).toBeGreaterThan(differences.marked * 2 + 0.5)
    })
  }
}

for (const [width, smallest] of [
  [1440, 9],
  [390, 8],
] as const) {
  test(`shows the app's smallest text at ${smallest} px or more at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    for (const name of SLOTS.filter((slot) => slot !== 'hero')) {
      const slot = media[name]
      const cut = width < 640 && slot.phone ? slot.phone : slot
      const shown = await page.locator(`video[data-clip="${name}"]`).evaluate((video) => {
        return video.getBoundingClientRect().width
      })
      const perPoint = shown / cut.points
      expect(perPoint, `${name} pixels per point`).toBeGreaterThanOrEqual(0.75)
      expect(perPoint * cut.minText, `${name} smallest text in px`).toBeGreaterThanOrEqual(smallest)
    }
  })
}

/** The mean colour of a row of the page's pixels between two x positions, from a screenshot. */
async function rows(page: Page) {
  const { data, info } = await sharp(await page.screenshot())
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return (y: number, from: number, to: number) => {
    const sum = [0, 0, 0]
    let count = 0
    for (let x = Math.round(from); x < Math.min(Math.round(to), info.width); x += 2) {
      const at = (Math.round(y) * info.width + x) * 3
      sum.forEach((_, i) => (sum[i]! += data[at + i]!))
      count++
    }
    return sum.map((value) => value / count)
  }
}

const step = (a: number[], b: number[]) => Math.max(...a.map((value, i) => Math.abs(value - b[i]!)))

/** Waits until a clip's poster is fetched, decoded and painted. */
async function posterShown(page: Page, selector: string) {
  const video = page.locator(selector)
  await expect(video).toHaveAttribute('poster', /webp$/)
  await video.evaluate(async (element) => {
    const image = new Image()
    image.src = (element as HTMLVideoElement).poster
    await image.decode()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

// A clip of the wrong scheme shows as a grey band or a bright edge where it fades into the page.
// Near the end of each fade, a fortieth of its length before the page shows alone, the clip still
// counts for 2.5 %: a light window on a dark page shifts the colour there by about 5, a matching one
// by 1 or less.
for (const scheme of ['light', 'dark'] as const satisfies Scheme[]) {
  test(`dissolves the ${scheme} clips into the page with no band or bright edge`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'one engine is enough for the pixels')
    // Tall enough to show the hero's fade at rest, which motion sets; the clips hold their posters.
    await page.setViewportSize({ width: 1440, height: 1300 })
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' })
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.resolve()
    })
    await page.goto('/')
    await animationsDone(page, '#hero')
    await posterShown(page, 'video[data-clip="hero"]')
    const stage = page.locator('.hero-stage')
    const [start = 0, end = 0] = await stage.evaluate((element) =>
      [...getComputedStyle(element).maskImage.matchAll(/(-?[\d.]+)px/g)].map(([, px]) =>
        Number(px),
      ),
    )
    expect(end).toBeGreaterThan(start)
    const box = (await stage.boundingBox())!
    const frame = (await page.locator('.hero-frame').boundingBox())!
    let read = await rows(page)
    const [left, right] = [frame.x + frame.width * 0.1, frame.x + frame.width * 0.9]
    const fading = read(box.y + end - (end - start) / 40, left, right)
    expect(step(fading, read(box.y + end + 4, left, right)), 'hero').toBeLessThanOrEqual(3)

    // The cards at rest, with nothing revealing or rising.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    for (const card of await page.locator('#cards .card').all()) {
      const slot = await card.getAttribute('data-slot')
      // Centred, clear of the floating download bar at the foot of the window. Scrolled again until
      // it stays: the page's scroll effects restore the scroll once as they turn off.
      await expect
        .poll(() =>
          card.evaluate((element) => {
            element.scrollIntoView({ block: 'center' })
            return element.querySelector('video')?.getAttribute('poster') ?? ''
          }),
        )
        .toMatch(/webp$/)
      await posterShown(page, `video[data-clip="${slot}"]`)
      const crop = (await card.locator('.card-crop').boundingBox())!
      const area = (await card.locator('.card-media').boundingBox())!
      read = await rows(page)
      // The crop fades out over its lower 38 %; the card's border runs along its foot.
      const foot = area.y + area.height - 3
      const [from, to] = [area.x + area.width * 0.1, area.x + area.width * 0.8]
      const near = read(foot - (crop.height * 0.38) / 40, from, to)
      expect(step(near, read(foot, from, to)), `${slot}`).toBeLessThanOrEqual(3)
    }
  })
}
