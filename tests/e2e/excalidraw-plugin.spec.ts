import { expect, test, type Page } from '@playwright/test'
import { readStoredZip } from '../support/stored-zip.ts'

// The Excalidraw plugin's archive, as this site serves it, run in a page under the policy Devot gives a plugin's
// frame (src-tauri/plugin-frame/frame.csp in Devot), with a small stand-in for Devot's runtime.
const BASE = 'https://plugin.devot.test/online.devot.excalidraw/'
const FRAME_CSP = [
  "default-src 'none'",
  `script-src ${BASE} 'wasm-unsafe-eval'`,
  `style-src ${BASE}`,
  `img-src ${BASE} data: blob:`,
  `font-src ${BASE}`,
  `media-src ${BASE} data: blob:`,
  "connect-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

const RUNTIME = `
const renderers = new Map()
const editors = new Map()
const hidden = []
globalThis.panel = { shown: false }
globalThis.devot = {
  preview: { handle: (id, fn) => renderers.set(id, fn), edit: (id, fn) => editors.set(id, fn) },
  ui: {
    show: async () => { panel.shown = true },
    hide: async () => { panel.shown = false },
    onHidden: (fn) => hidden.push(fn),
  },
}
globalThis.host = {
  draw: (source, theme) => renderers.get('excalidraw')(source, theme),
  edit: (source) => editors.get('excalidraw')(source),
  close: () => { panel.shown = false; for (const fn of hidden) fn() },
}
`

const FRAME = `<!doctype html><html><head><meta charset="utf-8">
<script src="${BASE}__devot/runtime.js"></script><script src="${BASE}main.js"></script></head><body></body></html>`

const TYPES: Record<string, string> = {
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
}

const SCENE = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [
    { id: 'box', type: 'rectangle', x: 10, y: 10, width: 200, height: 100, seed: 1 },
    {
      id: 'word',
      type: 'text',
      x: 40,
      y: 45,
      width: 80,
      height: 25,
      text: 'Hello',
      originalText: 'Hello',
      fontSize: 20,
      seed: 2,
    },
  ],
})

let archive: Map<string, Uint8Array>

test.beforeAll(async ({ request }) => {
  const response = await request.get('/plugins/excalidraw.zip')
  expect(response.ok()).toBe(true)
  archive = readStoredZip(new Uint8Array(await response.body()))
})

async function openFrame(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(`${BASE}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(new URL(BASE).pathname.length)
    if (path === 'frame.html')
      return route.fulfill({
        body: FRAME,
        headers: { 'content-type': 'text/html', 'content-security-policy': FRAME_CSP },
      })
    if (path === '__devot/runtime.js')
      return route.fulfill({ body: RUNTIME, headers: { 'content-type': 'text/javascript' } })
    const file = archive.get(path)
    if (!file) return route.fulfill({ status: 404 })
    return route.fulfill({
      body: Buffer.from(file),
      headers: { 'content-type': TYPES[path.split('.').pop()!] ?? 'application/octet-stream' },
    })
  })
  await page.goto(`${BASE}frame.html`)
  return errors
}

test('draws a scene as SVG, light and dark, and an empty block as an invitation to draw', async ({
  page,
}) => {
  const errors = await openFrame(page)
  const light = await page.evaluate((s) => host.draw(s, { appearance: 'light' }), SCENE)
  expect(light).toMatch(/^<svg[^>]*viewBox/)
  expect(light).toContain('Hello')
  expect(light).not.toContain('invert(')
  const dark = await page.evaluate((s) => host.draw(s, { appearance: 'dark' }), SCENE)
  expect(dark).toContain('invert(')
  const empty = await page.evaluate(() => host.draw('', { appearance: 'light' }))
  expect(empty).toContain('Edit')
  await expect(page.evaluate(() => host.draw('[1, 2]', { appearance: 'light' }))).rejects.toThrow(
    'E_EXCALIDRAW_SCENE',
  )
  expect(errors).toEqual([])
})

test('edits a scene in the panel and answers the edited scene on Done', async ({ page }) => {
  const errors = await openFrame(page)
  await page.evaluate((s) => {
    void host.edit(s).then((edited) => (globalThis.edited = edited))
  }, SCENE)
  await expect(page.locator('.excalidraw canvas').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => panel.shown)).toBe(true)
  await page.getByRole('button', { name: 'Done' }).click()
  const edited = await page.waitForFunction(() => globalThis.edited).then((h) => h.jsonValue())
  const scene = JSON.parse(edited as string)
  expect(scene.type).toBe('excalidraw')
  expect(scene.elements.map((e: { id: string }) => e.id)).toEqual(['box', 'word'])
  expect(await page.evaluate(() => panel.shown)).toBe(false)
  await expect(page.locator('.excalidraw')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('leaves the block as it was on Cancel, or when the panel closes', async ({ page }) => {
  await openFrame(page)
  await page.evaluate((s) => {
    void host.edit(s).then((edited) => (globalThis.cancelled = edited))
  }, SCENE)
  await page.getByRole('button', { name: 'Cancel' }).click()
  expect(await page.waitForFunction(() => globalThis.cancelled).then((h) => h.jsonValue())).toBe(
    SCENE,
  )
  await page.evaluate((s) => {
    void host.edit(s).then((edited) => (globalThis.afterClose = edited))
  }, SCENE)
  await expect(page.locator('.excalidraw canvas').first()).toBeVisible()
  await page.evaluate(() => host.close())
  expect(await page.waitForFunction(() => globalThis.afterClose).then((h) => h.jsonValue())).toBe(
    SCENE,
  )
  await expect(page.locator('.excalidraw')).toHaveCount(0)
})

declare global {
  var host: {
    draw: (source: string, theme: { appearance: 'light' | 'dark' }) => Promise<string>
    edit: (source: string) => Promise<string>
    close: () => void
  }
  var panel: { shown: boolean }
  var edited: string | undefined
  var cancelled: string | undefined
  var afterClose: string | undefined
}
