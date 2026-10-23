import { test as base, expect } from '@playwright/test'
import { siteCsp } from '../support/headers.ts'
import { readRepoFile } from '../support/source-files.ts'

// `astro preview` ignores _headers, so every page is served here with the policy Cloudflare will send.
const csp = siteCsp(readRepoFile('dist/_headers'))

/** Console errors, page errors and CSP violations; any left at the end fails the test. */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = []
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() !== 'document') return route.continue()
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
        if (message.type() === 'error') problems.push(message.text())
      })
      page.on('pageerror', (error) => problems.push(error.message))
      await use(problems)
      expect(problems).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
