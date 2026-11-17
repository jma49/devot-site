import { expect, test, type Page } from '@playwright/test'
import { openPlugin, readArchive } from './plugin-frame.ts'

// The Excalidraw plugin's archive, as this site serves it, in a frame as Devot gives it: its editor and fonts load as
// modules and files beside its main script, which only works from answers Devot shares with the frame's opaque origin.

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
  archive = await readArchive(request, 'excalidraw')
})

const open = (page: Page) => openPlugin(page, 'online.devot.excalidraw', archive)

test('draws a scene as SVG, light and dark, and an empty block as an invitation to draw', async ({
  page,
}) => {
  const { frame, errors } = await open(page)
  const light = await frame.evaluate(
    (s) => host.call('preview', 'excalidraw', s, { appearance: 'light' }),
    SCENE,
  )
  expect(light).toMatch(/^<svg[^>]*viewBox/)
  expect(light).toContain('Hello')
  expect(light).not.toContain('invert(')
  const dark = await frame.evaluate(
    (s) => host.call('preview', 'excalidraw', s, { appearance: 'dark' }),
    SCENE,
  )
  expect(dark).toContain('invert(')
  const empty = await frame.evaluate(() =>
    host.call('preview', 'excalidraw', '', { appearance: 'light' }),
  )
  expect(empty).toContain('Edit')
  await expect(
    frame.evaluate(() => host.call('preview', 'excalidraw', '[1, 2]', { appearance: 'light' })),
  ).rejects.toThrow('E_EXCALIDRAW_SCENE')
  expect(errors).toEqual([])
})

test("names a system font of its kind after each text, since the page has none of Excalidraw's", async ({
  page,
}) => {
  const { frame, errors } = await open(page)
  const scene = JSON.parse(SCENE) as { elements: Record<string, unknown>[] }
  scene.elements[1]!['fontFamily'] = 5
  scene.elements.push({
    id: 'code',
    type: 'text',
    x: 40,
    y: 80,
    width: 80,
    height: 25,
    text: 'let a',
    originalText: 'let a',
    fontSize: 20,
    fontFamily: 8,
    seed: 3,
  })
  const svg = await frame.evaluate(
    (s) => host.call('preview', 'excalidraw', s, { appearance: 'light' }),
    JSON.stringify(scene),
  )
  const families = [...String(svg).matchAll(/font-family="([^"]*)"/g)].map((m) => m[1])
  expect(families).toHaveLength(2)
  expect(families[0]).toMatch(/^Excalifont,.*'Chalkboard SE'.*, cursive$/)
  expect(families[1]).toMatch(/^Comic Shanns,.*, monospace$/)
  expect(errors).toEqual([])
})

test('edits a scene in the panel and answers the edited scene on Done', async ({ page }) => {
  const { frame, errors } = await open(page)
  await frame.evaluate((s) => {
    void host.call('edit', 'excalidraw', s).then((edited) => (globalThis.edited = edited as string))
  }, SCENE)
  await expect(frame.locator('.excalidraw canvas').first()).toBeVisible()
  await expect.poll(() => frame.evaluate(() => panel.shown)).toBe(true)
  await frame.getByRole('button', { name: 'Done' }).click()
  const edited = await frame.waitForFunction(() => globalThis.edited).then((h) => h.jsonValue())
  const scene = JSON.parse(edited as string)
  expect(scene.type).toBe('excalidraw')
  expect(scene.elements.map((e: { id: string }) => e.id)).toEqual(['box', 'word'])
  expect(await frame.evaluate(() => panel.shown)).toBe(false)
  await expect(frame.locator('.excalidraw')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('leaves the block as it was on Cancel, or when the panel closes', async ({ page }) => {
  const { frame } = await open(page)
  await frame.evaluate((s) => {
    void host
      .call('edit', 'excalidraw', s)
      .then((edited) => (globalThis.cancelled = edited as string))
  }, SCENE)
  await frame.getByRole('button', { name: 'Cancel' }).click()
  expect(await frame.waitForFunction(() => globalThis.cancelled).then((h) => h.jsonValue())).toBe(
    SCENE,
  )
  await frame.evaluate((s) => {
    void host
      .call('edit', 'excalidraw', s)
      .then((edited) => (globalThis.afterClose = edited as string))
  }, SCENE)
  await expect(frame.locator('.excalidraw canvas').first()).toBeVisible()
  await frame.evaluate(() => host.close())
  expect(await frame.waitForFunction(() => globalThis.afterClose).then((h) => h.jsonValue())).toBe(
    SCENE,
  )
  await expect(frame.locator('.excalidraw')).toHaveCount(0)
})

declare global {
  var edited: string | undefined
  var cancelled: string | undefined
  var afterClose: string | undefined
}
