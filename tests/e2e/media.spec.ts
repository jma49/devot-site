import { media, SLOTS, slotPaths } from '../../src/media.ts'
import { expect, test } from './fixtures.ts'

// Every clip decodes and plays in the engine that will pick it: WebKit takes the H.264 MP4 and
// Playwright's Chromium, which has no H.264, the AV1 WebM. Loaded under the site's policy.

for (const name of SLOTS.filter((slot) => media[slot].clip)) {
  test(`${name} plays at its stated size and length`, async ({ page, browserName }) => {
    await page.goto('/')
    const src = browserName === 'chromium' ? slotPaths(name).webm : slotPaths(name).mp4
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
      await new Promise((resolve) => setTimeout(resolve, 600))
      const result = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        advanced: video.currentTime > start,
      }
      video.remove()
      return result
    }, src)
    expect([played.width, played.height]).toEqual([media[name].width, media[name].height])
    expect(Math.abs(played.duration - media[name].duration)).toBeLessThan(0.1)
    expect(played.advanced).toBe(true)
  })
}
