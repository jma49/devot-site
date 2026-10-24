import { cpus } from 'node:os'
import { test as base, expect } from '@playwright/test'
import { siteCsp } from '../support/headers.ts'
import { readRepoFile } from '../support/source-files.ts'

// `astro preview` ignores _headers, so every page is served here with the policy Cloudflare will send.
const csp = siteCsp(readRepoFile('dist/_headers'))

// The CI runner is a virtual Mac with two quirks. It reports an AV1 decoder it does not have: WebKit
// picks the AV1 WebM, which never gets past its metadata, so refusing the WebM there makes WebKit fall
// back to the MP4, as on a Mac without AV1 hardware. And late in a long run its GPU can run out of host
// memory: WebKit logs the loss itself, and the page answers it by falling back to the CSS aurora.
const virtualMac = process.platform === 'darwin' && !!cpus()[0]?.model.includes('(Virtual)')
const gpuMemoryLoss = /^WebGL: (OUT_OF_MEMORY|context lost)/

/** Console errors, page errors and CSP violations; any left at the end fails the test. */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page, browserName }, use) => {
      const problems: string[] = []
      await page.route('**/*', async (route) => {
        const request = route.request()
        const webm = new URL(request.url()).pathname.endsWith('.webm')
        if (virtualMac && browserName === 'webkit' && webm) return route.abort()
        if (request.resourceType() !== 'document') return route.continue()
        const response = await route.fetch()
        await route.fulfill({
          response,
          headers: { ...response.headers(), 'content-security-policy': csp },
        })
      })
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.effectiveDirective} ${event.blockedURI}`)
        })
      })
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        if (virtualMac && browserName === 'webkit' && gpuMemoryLoss.test(message.text())) return
        problems.push(message.text())
      })
      page.on('pageerror', (error) => problems.push(error.message))
      await use(problems)
      expect(problems).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
