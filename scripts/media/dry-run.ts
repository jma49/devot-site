// pnpm media:dry [shot ...]  plays scenes against Devot's UI-test build without recording: each
// shot of film-scenes.ts (all by default) in real time, as the device run plays it, with a
// screenshot at its poster time and at its end in .cache/media/dry/. It shows in minutes, on any
// machine, whether a scene's selectors, steps and check still hold for the Devot checkout
// DEVOT_CHECKOUT names. The browser is WebKit on a Mac and Chromium elsewhere (MEDIA_DRY_BROWSER
// names one; MEDIA_DRY_EXECUTABLE a browser binary); MEDIA_SCHEMES picks light (the default) or dark.
// It says nothing of Glass, the real pointer or the media bridge's own locators.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import { startServer } from './devot.ts'
import { FILM_SCENES } from './film-scenes.ts'
import { pageActions } from './frames.ts'
import { seedLibrary, VIEW } from './seed.ts'

const root = join(import.meta.dirname, '../..')
const cache = process.env['MEDIA_CACHE'] ?? join(root, '.cache', 'media')
const devotDir = process.env['DEVOT_CHECKOUT']
if (!devotDir) {
  console.error('E_MEDIA_DRY_ARGS set DEVOT_CHECKOUT to a Devot checkout with its dependencies')
  process.exit(1)
}
const only = process.argv.slice(2)
const scheme = (process.env['MEDIA_SCHEMES'] ?? 'light') as 'light' | 'dark'
const out = join(cache, 'dry')
mkdirSync(out, { recursive: true })

const ids = only.length ? only : Object.keys(FILM_SCENES)
const unknown = ids.filter((id) => !FILM_SCENES[id])
if (unknown.length > 0) {
  console.error(
    `E_MEDIA_ARGS no shot ${unknown.join(' ')}; shots: ${Object.keys(FILM_SCENES).join(' ')}`,
  )
  process.exit(1)
}
const mac = process.platform === 'darwin'
const engine = (process.env['MEDIA_DRY_BROWSER'] ?? (mac ? 'webkit' : 'chromium')) as
  | 'webkit'
  | 'chromium'

const pw = (await import(
  pathToFileURL(join(devotDir, 'node_modules/@playwright/test/index.mjs')).href
)) as typeof import('@playwright/test')
const fixtures = (await import(join(devotDir, 'tests/ui/fixtures.ts'))) as {
  mockTauri: (page: Page) => Promise<void>
}
const server = await startServer({
  dir: devotDir,
  port: Number(process.env['MEDIA_PORT'] ?? 5391),
  reuse: process.env['MEDIA_REUSE_SERVER'] === '1',
})
const executablePath = process.env['MEDIA_DRY_EXECUTABLE']
const browser = await pw[engine].launch(executablePath ? { executablePath } : {})
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let failed = 0
try {
  for (const id of ids) {
    const scene = FILM_SCENES[id]!
    const context = await browser.newContext({
      viewport: scene.viewport,
      deviceScaleFactor: 1,
      colorScheme: scheme,
      reducedMotion: 'no-preference',
      baseURL: server.url,
      locale: 'en-US',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    })
    const page = await context.newPage()
    const problems: string[] = []
    page.on('pageerror', (e) => problems.push(`pageerror ${String(e).slice(0, 200)}`))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' })
    })
    await fixtures.mockTauri(page)
    await page.addInitScript(
      (initial) => {
        // As the capture does (browser.ts): the Settings window a scene shows in a frame borrows
        // the main frame's IPC.
        const w = globalThis as unknown as Record<string, unknown> & { top: unknown }
        w['devotEditorSettings'] = initial
        const key = '__TAURI_INTERNALS__'
        if (!w[key] && location.pathname === '/settings.html' && w.top !== w) {
          Object.defineProperty(w, key, { value: (w.top as Record<string, unknown>)[key] })
        }
      },
      { sidebarMaterial: true, theme: 'tide', animations: 'always', ...scene.settings },
    )
    const began0 = Date.now()
    try {
      await page.goto('/')
      await page.locator('.window[data-ready]').waitFor()
      await seedLibrary(page, devotDir, { ...VIEW, ...scene.view })
      await scene.prepare(page)
      // Select All is the browser's own editing command: Control off a Mac, Command on one.
      const actions = pageActions(page)
      const press = actions.press
      actions.press = (key) => press(!mac && key === 'Meta+KeyA' ? 'Control+KeyA' : key)
      const timeline = await scene.script(page, actions)
      const events = [...timeline.events].sort((a, b) => a.at - b.at)
      const began = Date.now()
      let next = 0
      let shot = false
      for (;;) {
        const t = (Date.now() - began) / 1000
        while (next < events.length && events[next]!.at <= t) await events[next++]!.run()
        if (t >= timeline.duration) break
        const c = timeline.cursor(t)
        await page.mouse.move(c.x, c.y)
        if (!shot && t >= timeline.posterTime && timeline.posterTime > 0) {
          shot = true
          await page.screenshot({ path: join(out, `${id}-${scheme}-poster.png`) })
        }
        await sleep(8)
      }
      while (next < events.length) await events[next++]!.run()
      await sleep(600)
      await page.screenshot({ path: join(out, `${id}-${scheme}-end.png`) })
      await scene.check?.(page)
      const alerts = await page.locator('[role="alert"]:visible, .toast:visible').count()
      console.log(
        `ok   ${id} ${scheme} ${timeline.duration.toFixed(1)} s` +
          (alerts ? ` (${alerts} alerts)` : '') +
          (problems.length ? ` problems: ${problems.join(' | ')}` : ''),
      )
    } catch (error) {
      failed++
      await page.screenshot({ path: join(out, `${id}-${scheme}-error.png`) }).catch(() => {})
      console.log(
        `FAIL ${id} ${scheme} after ${((Date.now() - began0) / 1000).toFixed(1)} s: ${String(error).split('\n').slice(0, 6).join(' ~ ')}; the screen: ${join(out, `${id}-${scheme}-error.png`)}` +
          (problems.length ? ` problems: ${problems.join(' | ')}` : ''),
      )
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  server.stop()
}
process.exit(failed ? 1 : 0)
