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
function load(folder: string, more: Record<string, unknown> = {}) {
  const handlers = { preview: new Map<string, Handler>(), importer: new Map<string, Handler>() }
  const handle = (kind: keyof typeof handlers) => (id: string, fn: Handler) =>
    handlers[kind].set(id, fn)
  const devot = {
    ...more,
    preview: { handle: handle('preview') },
    importer: { handle: handle('importer') },
  }
  const main = pluginPackages()
    .get(folder)!
    .find((f) => f.path === 'main.js')!.text
  runInNewContext(main, { devot, atob, TextDecoder })
  return handlers
}

describe('each official plugin', () => {
  const folders = readdirSync(PLUGINS)

  it.each(folders)('%s has a manifest Devot accepts and a listing that matches it', (folder) => {
    const manifest = JSON.parse(readFileSync(join(PLUGINS, folder, 'devot-plugin.json'), 'utf8'))
    expect(manifest.id).toMatch(ID)
    expect(manifest.id.startsWith('devot')).toBe(false)
    expect([1, 2]).toContain(manifest.apiVersion)
    // A plugin of API 2 names the first Devot that runs it.
    expect(manifest.apiVersion === 1 || /^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)).toBe(true)
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

  it.each(folders)(
    '%s is packed with its manifest at the archive root, without the README',
    (folder) => {
      const files = pluginPackages()
        .get(folder)!
        .map((f) => f.path)
      expect(files).toEqual(['devot-plugin.json', 'main.js'])
    },
  )
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

describe('Charts', () => {
  const render = load('charts').preview.get('chart') as (source: string) => string | null
  const image = (drawn: string) => {
    const found = /^!\[([^\]]*)\]\(data:image\/svg\+xml,([^)]+)\)/.exec(drawn)
    if (!found) throw new Error('expected an image')
    return { alt: found[1]!, svg: decodeURIComponent(found[2]!) }
  }

  it('draws a bar per row, scaled from zero, and reads the data out in its description', () => {
    const { alt, svg } = image(render('title: Rent & food\nRent, 1200\nFood, 400')!)
    expect(alt).toBe('Bar chart: Rent & food. Rent 1200; Food 400')
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('>Rent &amp; food</text>')
    expect(svg.match(/<rect class="s0"/g)).toHaveLength(2)
    expect(svg).toContain('>0</text>')
    expect(svg).toContain('>1500</text>')
    expect(svg).toContain('@media (prefers-color-scheme:dark)')
  })

  it('draws a line per series named by a header row, with a legend', () => {
    const { alt, svg } = image(render('type: line\nmonth, web, app\nJan, 120, 40\nFeb, 180, 65')!)
    expect(alt).toBe('Line chart. Jan web 120, app 40; Feb web 180, app 65')
    expect(svg.match(/<polyline/g)).toHaveLength(2)
    expect(svg).toContain('>web</text>')
    expect(svg).toContain('>app</text>')
  })

  it('keeps the image out of reach of Markdown and of the SVG it sits in', () => {
    const drawn = render('title: a (b) ]\n<x>, 1\n"q", -2')!
    expect(drawn.endsWith(')')).toBe(true)
    expect(drawn.slice(drawn.indexOf('](data:') + 2, -1)).not.toMatch(/[()\s]/)
    const { alt, svg } = image(drawn)
    expect(alt).not.toContain(']')
    expect(svg).toContain('&lt;x&gt;')
    expect(svg).not.toContain('<x>')
    expect(svg).toContain('>-2</text>')
  })

  it('keeps a block it cannot read as code, and draws at most 200 rows', () => {
    for (const source of ['', 'type: pie\na, 1', 'a, b\nc, d', 'a, 1\nb'])
      expect(render(source)).toBeNull()
    const rows = Array.from({ length: 203 }, (_, i) => `r${i}, ${i}`).join('\n')
    const drawn = render(rows)!
    expect(image(drawn).svg.match(/<rect class="s0"/g)).toHaveLength(200)
    expect(drawn.endsWith('\n\n3 more rows are not drawn.')).toBe(true)
  })
})

describe('BibTeX References', () => {
  const { preview, importer } = load('bibtex')
  const render = preview.get('bibtex') as (source: string) => string | null
  const convert = importer.get('bibtex') as (file: { name: string; text: string }) => {
    title: string
    markdown: string
  }
  const LIBRARY = `@string{ieee = "IEEE Software"}
@comment{ignored @article{nope, title = {No}} }
@article{knuth84,
  author = {Knuth, Donald E.},
  title = {Literate {P}rogramming},
  journal = {The Computer Journal},
  volume = 27, number = {2}, pages = {97--111},
  year = 1984, doi = {https://doi.org/10.1093/comjnl/27.2.97}
}
@book{goedel,
  author = "G{\\"o}del, Kurt and Escher, M. C. and Bach, J. S. and Hofstadter, Douglas",
  title = {G\\"odel, Escher, Bach},
  publisher = {Basic Books}, year = {1979}
}
@inproceedings{p, author = {A and B and C}, title = {Typed *Notes*}, booktitle = ieee # " Proc.", year = 2020}
@misc{broken, title = {never closed`

  it('formats each entry as a reference, in the order written', () => {
    expect(render(LIBRARY)).toBe(
      [
        '- Donald E. Knuth (1984). Literate Programming. *The Computer Journal*, 27(2), pp. 97–111. doi:10.1093/comjnl/27.2.97',
        '- Kurt Gödel et al. (1979). *Gödel, Escher, Bach*. Basic Books.',
        '- A, B, and C (2020). Typed \\*Notes\\*. *IEEE Software Proc.*.',
      ].join('\n'),
    )
  })

  it('imports a library as a note of references with the entries kept as written', () => {
    const note = convert({ name: 'thesis.bib', text: LIBRARY })
    expect(note.title).toBe('thesis')
    expect(note.markdown.startsWith('- Donald E. Knuth (1984).')).toBe(true)
    expect(note.markdown).toContain(`\n\n\`\`\`bibtex\n${LIBRARY}\n\`\`\`\n`)
  })

  it('keeps a block without entries as code, and a fence longer than any in the file', () => {
    expect(render('% nothing here')).toBeNull()
    const note = convert({ name: '.bib', text: '````' })
    expect(note).toEqual({ title: 'References', markdown: '`````bibtex\n````\n`````\n' })
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

describe('Note Query', () => {
  const DAY = Date.UTC(2026, 10, 16)
  const notes = [
    {
      id: 'a',
      title: 'Plan',
      notebook: 'w',
      createdAt: DAY,
      updatedAt: DAY + 3,
      tags: ['work'],
      status: 'active',
      pinned: true,
    },
    {
      id: 'b',
      title: 'Trip | Rome',
      notebook: null,
      createdAt: DAY - 86_400_000,
      updatedAt: DAY + 2,
      tags: ['travel'],
      status: 'none',
      pinned: false,
    },
    {
      id: 'c',
      title: 'Ship it',
      notebook: 'w',
      createdAt: DAY,
      updatedAt: DAY + 1,
      tags: ['work/launch'],
      status: 'completed',
      pinned: false,
    },
  ]
  const properties: Record<string, Record<string, unknown>> = {
    a: { due: '2026-12-01', priority: 2 },
    b: { due: '2026-11-20' },
    c: { priority: 1, owners: ['Ada', 'Lin'] },
  }
  const reads: string[] = []
  const { preview } = load('note-query', {
    notes: {
      list: async () => notes,
      get: async (id: string) => {
        reads.push(id)
        return { id, properties: properties[id] }
      },
    },
    notebooks: { list: async () => [{ id: 'w', name: 'Work', parent: null }] },
  })
  const run = preview.get('query') as (source: string) => Promise<string>

  it('lists the notes of a tag, its nested tags included, sorted, as links', async () => {
    reads.length = 0
    expect(await run('LIST FROM #work SORT title DESC')).toBe('- [[Ship it]]\n- [[Plan]]')
    expect(reads).toEqual([])
  })

  it('tables front matter and built-in fields, filtered and sorted', async () => {
    expect(
      await run(
        'TABLE status, due AS "Due date", owners\nWHERE priority >= 1 AND NOT pinned\nSORT priority',
      ),
    ).toBe(
      '| Note | status | Due date | owners |\n| --- | --- | --- | --- |\n| [[Ship it]] | completed |  | Ada, Lin |',
    )
    expect(
      await run('TABLE due FROM "work" WHERE due < 2026-12-01 OR status = "completed" SORT due'),
    ).toBe('| Note | due |\n| --- | --- |\n| [[Ship it]] |  |')
  })

  it('reads dates, tags and titles that would break a table', async () => {
    expect(await run('TABLE created, tags WHERE tags contains "travel"')).toBe(
      '| Note | created | tags |\n| --- | --- | --- |\n| [[Trip   Rome]] | 2026-11-15 | travel |',
    )
    expect(await run('LIST WHERE updated = 2026-11-16 LIMIT 1')).toBe('- [[Plan]]')
  })

  it('says when nothing matches or the query cannot be read', async () => {
    expect(await run('LIST WHERE status = "dropped"')).toBe('No notes match.')
    expect(await run('SHOW everything')).toBe('**Query:** a query starts with TABLE or LIST.')
    expect(await run('LIST LIMIT 0')).toBe('**Query:** LIMIT takes a whole number.')
    expect(preview.get('dataview')).toBe(run)
  })
})

describe('Graphviz', () => {
  const draw = load('graphviz').preview.get('dot') as (
    source: string,
    theme?: { colors: Record<string, string> },
  ) => Promise<string | null>
  const theme = { colors: { text: '#e0e0e0', edge: '#9a9a9a' } }

  it('is packed after the pinned Viz.js build', () => {
    const main = pluginPackages()
      .get('graphviz')!
      .find((f) => f.path === 'main.js')!.text
    expect(main.startsWith('/*!\nViz.js 3.31.0')).toBe(true)
    expect(main.endsWith(readFileSync(join(PLUGINS, 'graphviz', 'main.js'), 'utf8'))).toBe(true)
  })

  it('draws a graph in the theme’s colours, as SVG alone', async () => {
    const svg = (await draw('digraph { a -> b }', theme))!
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<title>a&#45;&gt;b</title>')
    expect(svg).toContain('fill="#e0e0e0"')
    expect(svg).toContain('stroke="#9a9a9a"')
  })

  it('shows what Graphviz could not read, and keeps an empty block as code', async () => {
    expect(await draw('digraph { a -> }', theme)).toMatch(/^<svg[^>]*>.*syntax error/s)
    expect(await draw('  \n', theme)).toBeNull()
  })
})
