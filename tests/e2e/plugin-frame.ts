import { expect, type APIRequestContext, type Frame, type Page } from '@playwright/test'
import { readStoredZip } from '../support/stored-zip.ts'

// A plugin's archive, as this site serves it, run as Devot runs it (src-tauri/src/plugins/serve.rs and
// src-tauri/plugin-frame/ in Devot): a container page whose one frame is sandboxed to scripts alone, so the plugin's
// page has an opaque origin and loads its own files cross-origin, under the frame's policy, from answers that carry
// `Access-Control-Allow-Origin: *`. A small stand-in takes the place of Devot's runtime.

const ORIGIN = 'https://plugin.devot.test/'

const frameCsp = (base: string) =>
  [
    "default-src 'none'",
    `script-src ${base} 'wasm-unsafe-eval'`,
    `style-src ${base}`,
    `img-src ${base} data: blob:`,
    `font-src ${base}`,
    `media-src ${base} data: blob:`,
    "connect-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')

const TYPES: Record<string, string> = {
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
}

/** Collects what the plugin hands Devot, by kind and ID, and lets a test call it. */
export const RUNTIME = `
const handlers = { preview: new Map(), edit: new Map(), importer: new Map() }
const hidden = []
globalThis.panel = { shown: false }
globalThis.devot = {
  preview: {
    handle: (id, fn) => handlers.preview.set(id, fn),
    edit: (id, fn) => handlers.edit.set(id, fn),
  },
  importer: { handle: (id, fn) => handlers.importer.set(id, fn) },
  notes: {
    list: async () => globalThis.notes ?? [],
    get: async (id) => ({ id, properties: {} }),
  },
  notebooks: { list: async () => [] },
  ui: {
    show: async () => { panel.shown = true },
    hide: async () => { panel.shown = false },
    onHidden: (fn) => hidden.push(fn),
  },
}
globalThis.host = {
  ids: (kind) => [...handlers[kind].keys()],
  call: (kind, id, ...args) => handlers[kind].get(id)(...args),
  close: () => { panel.shown = false; for (const fn of hidden) fn() },
}
`

export async function readArchive(
  request: APIRequestContext,
  folder: string,
): Promise<Map<string, Uint8Array>> {
  const response = await request.get(`/plugins/${folder}.zip`)
  expect(response.ok()).toBe(true)
  return readStoredZip(new Uint8Array(await response.body()))
}

export interface PluginFrame {
  frame: Frame
  errors: string[]
}

export async function openPlugin(
  page: Page,
  id: string,
  archive: Map<string, Uint8Array>,
): Promise<PluginFrame> {
  const base = `${ORIGIN}${id}/`
  const manifest = JSON.parse(new TextDecoder().decode(archive.get('devot-plugin.json')!)) as {
    main: string
  }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Excalidraw names its CDN after the plugin's own copy of each font, and React sets style attributes: the frame's
  // policy refuses both, as it should, and neither keeps a plugin from working.
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() !== 'error') return
    if (/^Loading the font 'https:\/\/esm\.sh\//.test(text)) return
    if (text.startsWith('Applying inline style violates')) return
    errors.push(text)
  })
  await page.route(`${base}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(new URL(base).pathname.length)
    if (path === '')
      return route.fulfill({
        body: `<!doctype html><html><head><meta charset="utf-8"></head><body><iframe style="position: fixed; inset: 0; width: 100%; height: 100%; border: 0" sandbox="allow-scripts" src="${base}__devot/frame.html"></iframe></body></html>`,
        headers: { 'content-type': 'text/html' },
      })
    if (path === '__devot/frame.html')
      return route.fulfill({
        body: `<!doctype html><html><head><meta charset="utf-8"><script src="${base}__devot/runtime.js"></script><script src="${base}${manifest.main}"></script></head><body></body></html>`,
        headers: { 'content-type': 'text/html', 'content-security-policy': frameCsp(base) },
      })
    if (path === '__devot/runtime.js')
      return route.fulfill({ body: RUNTIME, headers: { 'content-type': 'text/javascript' } })
    const file = archive.get(path)
    if (!file) return route.fulfill({ status: 404 })
    return route.fulfill({
      body: Buffer.from(file),
      headers: {
        'content-type': TYPES[path.split('.').pop()!] ?? 'application/octet-stream',
        'content-security-policy': "default-src 'none'",
        'x-content-type-options': 'nosniff',
        'access-control-allow-origin': '*',
      },
    })
  })
  await page.goto(base)
  let frame: Frame | undefined
  await expect
    .poll(async () => {
      frame = page.frames().find((f) => f.url().endsWith('/__devot/frame.html'))
      return frame ? frame.evaluate(() => typeof globalThis.host) : 'none'
    })
    .toBe('object')
  return { frame: frame!, errors }
}

declare global {
  var host: {
    ids: (kind: 'preview' | 'edit' | 'importer') => string[]
    call: (
      kind: 'preview' | 'edit' | 'importer',
      id: string,
      ...args: unknown[]
    ) => Promise<unknown>
    close: () => void
  }
  var panel: { shown: boolean }
  var notes: unknown[] | undefined
}
