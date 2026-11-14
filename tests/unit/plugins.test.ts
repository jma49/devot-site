import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { PLUGIN_PERMISSIONS } from '../../src/lib/plugins.ts'
import { pluginArchive, pluginPackages } from '../../src/lib/plugin-packages.ts'
import { crc32, storedZip } from '../../src/lib/zip.ts'

const PLUGIN_LISTINGS = en.plugins.listings
const pluginsDoc = en.docs.pages.find((page) => page.slug === 'plugins')!
const PLUGINS = join(import.meta.dirname, '../../plugins')
const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

type Handler = (input: never) => unknown
function load(folder: string) {
  const handlers = { preview: new Map<string, Handler>(), importer: new Map<string, Handler>() }
  const handle = (kind: keyof typeof handlers) => (id: string, fn: Handler) =>
    handlers[kind].set(id, fn)
  const devot = { preview: { handle: handle('preview') }, importer: { handle: handle('importer') } }
  runInNewContext(readFileSync(join(PLUGINS, folder, 'main.js'), 'utf8'), { devot })
  return handlers
}

describe('each official plugin', () => {
  const folders = readdirSync(PLUGINS)

  it.each(folders)('%s has a manifest Devot accepts and a listing that matches it', (folder) => {
    const manifest = JSON.parse(readFileSync(join(PLUGINS, folder, 'devot-plugin.json'), 'utf8'))
    expect(manifest.id).toMatch(ID)
    expect(manifest.id.startsWith('devot')).toBe(false)
    expect(manifest.apiVersion).toBe(1)
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(readdirSync(join(PLUGINS, folder))).toContain(manifest.main)
    for (const p of manifest.permissions) expect(PLUGIN_PERMISSIONS).toContain(p)
    const listing = PLUGIN_LISTINGS.find((l) => l.folder === folder)
    expect(listing).toMatchObject({
      id: manifest.id,
      name: manifest.name,
      permissions: manifest.permissions,
      download: `/plugins/${folder}.zip`,
    })
    const handlers = load(folder)
    const registered = [
      ...[...handlers.preview.keys()].map((id) => `preview:${id}`),
      ...[...handlers.importer.keys()].map((id) => `import:${id}`),
    ].sort()
    const declared = [
      ...(manifest.contributes.previewRenderers ?? []).map(
        (r: { id: string }) => `preview:${r.id}`,
      ),
      ...(manifest.contributes.importFormats ?? []).map((r: { id: string }) => `import:${r.id}`),
    ].sort()
    expect(registered).toEqual(declared)
  })

  it('is packed with its manifest at the archive root, without the README', () => {
    const files = pluginPackages()
      .get('csv-tables')!
      .map((f) => f.path)
    expect(files).toEqual(['devot-plugin.json', 'main.js'])
  })
})

describe('the plugin index', () => {
  it('lists each plugin once, with public https source and a download', () => {
    const ids = PLUGIN_LISTINGS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const listing of PLUGIN_LISTINGS) {
      expect(listing.id).toMatch(ID)
      expect(new URL(listing.source).protocol).toBe('https:')
      expect(
        listing.download.startsWith('/plugins/') || listing.download.startsWith('https://'),
      ).toBe(true)
      expect(listing.permissions.length).toBeGreaterThan(0)
      expect(new Set(listing.permissions).size).toBe(listing.permissions.length)
      expect(listing.summary.length).toBeLessThanOrEqual(300)
    }
  })

  it('names each plugin’s download apart, so every link reads on its own', () => {
    const section = pluginsDoc.sections.find((s) => s.id === 'index')!
    const block = section.blocks.find((b) => b.kind === 'list')!
    const labels = block.kind === 'list' ? block.items.map((item) => item.at(-1)) : []
    expect(labels).toEqual(
      PLUGIN_LISTINGS.map((l) => ({ text: `Download ${l.name}`, href: l.download })),
    )
  })
})

describe('CSV Tables', () => {
  const { preview, importer } = load('csv-tables')
  const render = preview.get('csv') as (source: string) => string | null
  const convert = importer.get('csv') as (file: { name: string; text: string }) => {
    title: string
    markdown: string
  }

  it('imports a file as a table with its first row as the header', () => {
    expect(
      convert({ name: 'Budget 2026.csv', text: 'Item,Cost\r\nRent,1200\r\nFood,400\r\n' }),
    ).toEqual({
      title: 'Budget 2026',
      markdown: '| Item | Cost |\n| --- | --- |\n| Rent | 1200 |\n| Food | 400 |\n',
    })
  })

  it('reads quoted fields, doubled quotes, delimiters and line breaks inside quotes', () => {
    const text = '﻿name,note\n"Ada, L.","said ""hi""\nthen left"\n'
    expect(convert({ name: 'people.csv', text }).markdown).toBe(
      '| name | note |\n| --- | --- |\n| Ada, L. | said "hi" then left |\n',
    )
  })

  it('escapes what would end a cell or a table row, and pads short rows', () => {
    expect(render('a,b\nx|y\nback\\slash,2')).toBe(
      '| a | b |\n| --- | --- |\n| x\\|y |  |\n| back\\\\slash | 2 |',
    )
  })

  it('reads TSV by its extension and semicolon files by their header', () => {
    expect(convert({ name: 'scores.tsv', text: 'a,1\tb\n2\t3' }).markdown).toBe(
      '| a,1 | b |\n| --- | --- |\n| 2 | 3 |\n',
    )
    expect(render('price;qty\n1,50;3')).toBe('| price | qty |\n| --- | --- |\n| 1,50 | 3 |')
  })

  it('draws at most 500 rows in the preview and says how many it left out', () => {
    const source = ['n', ...Array.from({ length: 502 }, (_, i) => `${i}`)].join('\n')
    const drawn = render(source)!
    expect(drawn.split('\n').filter((line) => /^\| \d/.test(line)).length).toBe(500)
    expect(drawn.endsWith('\n\n2 more rows are not shown.')).toBe(true)
    expect(convert({ name: 'big.csv', text: source }).markdown.split('\n').length).toBe(505)
  })

  it('keeps an empty block as code and names an untitled file', () => {
    expect(render('\n  \n')).toBeNull()
    expect(convert({ name: '.csv', text: 'a' }).title).toBe('Table')
  })
})

describe('the stored zip', () => {
  it('checksums as zip does', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('lays out headers a reader can walk, the same bytes each build', () => {
    const zip = pluginArchive('csv-tables')
    expect(pluginArchive('csv-tables')).toEqual(zip)
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    const end = zip.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    const count = view.getUint16(end + 10, true)
    let at = view.getUint32(end + 16, true)
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      expect(view.getUint32(at, true)).toBe(0x02014b50)
      const length = view.getUint16(at + 28, true)
      const local = view.getUint32(at + 42, true)
      const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + length))
      expect(view.getUint32(local, true)).toBe(0x04034b50)
      const size = view.getUint32(local + 18, true)
      const data = zip.subarray(local + 30 + length, local + 30 + length + size)
      expect(crc32(data)).toBe(view.getUint32(at + 16, true))
      expect(new TextDecoder().decode(data)).toBe(
        readFileSync(join(PLUGINS, 'csv-tables', name), 'utf8'),
      )
      names.push(name)
      at += 46 + length
    }
    expect(names).toEqual(['devot-plugin.json', 'main.js'])
  })

  it('refuses a path that could leave the folder it is unpacked into', () => {
    for (const path of ['../x', '/x', 'a/../b', '.hidden']) {
      expect(() => storedZip([{ path, bytes: new Uint8Array() }])).toThrow(/E_ZIP_PATH_INVALID/)
    }
  })
})
