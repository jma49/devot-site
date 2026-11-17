import { expect, test } from '@playwright/test'
import { openPlugin, readArchive } from './plugin-frame.ts'

// Every official plugin, from the archive this site serves, in a frame as Devot gives it: each one loads, offers what
// its manifest lists, and answers a block or a file the way Devot shows it.

interface Manifest {
  id: string
  contributes: {
    previewRenderers?: { id: string }[]
    importFormats?: { id: string }[]
    themes?: { id: string; appearance: string; path: string }[]
  }
}

const read = (archive: Map<string, Uint8Array>, path: string) =>
  new TextDecoder().decode(archive.get(path)!)

const LIGHT = {
  appearance: 'light',
  colors: { text: '#1d1d1f', edge: '#6e6e73', series1: '#0a84ff' },
}
const DARK = {
  appearance: 'dark',
  colors: { text: '#f5f5f7', edge: '#98989d', series1: '#64d2ff' },
}

const SAMPLES: Record<
  string,
  {
    preview: Record<string, [string, RegExp]>
    importer?: Record<string, [{ name: string; text: string }, RegExp]>
  }
> = {
  charts: {
    preview: {
      chart: [
        'title: Spend\nRent, 1200\nFood, 400',
        /^<svg [^>]*aria-label="Bar chart: Spend\. Rent 1200; Food 400"[\s\S]*<\/svg>$/,
      ],
    },
  },
  'csv-tables': {
    preview: {
      csv: ['Item,Cost\nRent,1200', /^\| Item \| Cost \|\n\| --- \| --- \|\n\| Rent \| 1200 \|/],
    },
    importer: {
      csv: [{ name: 'Budget.csv', text: 'Item,Cost\nRent,1200\n' }, /\| Rent \| 1200 \|/],
    },
  },
  bibtex: {
    preview: {
      bibtex: ['@book{k, author = {Knuth, Donald E.}, title = {The Art}, year = 1968}', /Knuth/],
    },
    importer: {
      bibtex: [
        {
          name: 'refs.bib',
          text: '@book{k, author = {Knuth, Donald E.}, title = {The Art}, year = 1968}',
        },
        /^```bibtex\n@book\{k,/,
      ],
    },
  },
  graphviz: { preview: { dot: ['digraph { a -> b }', /^<svg[\s\S]*<\/svg>\s*$/] } },
  'note-query': {
    preview: {
      query: ['LIST FROM #work', /^- \[Plan\]\(devot:\/\/note\/a\)$/],
      dataview: ['LIST FROM #work', /^- \[Plan\]\(devot:\/\/note\/a\)$/],
    },
  },
}

const THEMES = [
  'catppuccin',
  'dracula',
  'gruvbox',
  'nord',
  'one',
  'rose-pine',
  'solarized',
  'tokyo-night',
]

for (const [folder, sample] of Object.entries(SAMPLES)) {
  test(`${folder} loads in its frame and answers as Devot shows it`, async ({ page, request }) => {
    const archive = await readArchive(request, folder)
    const manifest = JSON.parse(read(archive, 'devot-plugin.json')) as Manifest
    const { frame, errors } = await openPlugin(page, manifest.id, archive)
    await frame.evaluate(() => {
      globalThis.notes = [
        {
          id: 'a',
          title: 'Plan',
          notebook: null,
          createdAt: 0,
          updatedAt: 0,
          tags: ['work'],
          status: 'none',
          pinned: false,
        },
      ]
    })
    expect((await frame.evaluate(() => host.ids('preview'))).sort()).toEqual(
      (manifest.contributes.previewRenderers ?? []).map((r) => r.id).sort(),
    )
    expect((await frame.evaluate(() => host.ids('importer'))).sort()).toEqual(
      (manifest.contributes.importFormats ?? []).map((f) => f.id).sort(),
    )
    for (const [id, [source, answer]] of Object.entries(sample.preview)) {
      for (const theme of [LIGHT, DARK]) {
        const drawn = await frame.evaluate(([i, s, t]) => host.call('preview', i, s, t), [
          id,
          source,
          theme,
        ] as const)
        expect(drawn, `${id} ${theme.appearance}`).toMatch(answer)
      }
    }
    for (const [id, [file, answer]] of Object.entries(sample.importer ?? {})) {
      const imported = (await frame.evaluate(([i, f]) => host.call('importer', i, f), [
        id,
        file,
      ] as const)) as {
        markdown: string
      }
      expect(imported.markdown, id).toMatch(answer)
    }
    expect(errors).toEqual([])
  })
}

for (const folder of THEMES) {
  test(`${folder} loads in its frame and its package holds every theme it lists`, async ({
    page,
    request,
  }) => {
    const archive = await readArchive(request, folder)
    const manifest = JSON.parse(read(archive, 'devot-plugin.json')) as Manifest
    const themes = manifest.contributes.themes ?? []
    expect(themes.length).toBeGreaterThan(0)
    for (const theme of themes) {
      const { colors } = JSON.parse(read(archive, theme.path)) as { colors: Record<string, string> }
      expect(colors['surface-editor'], theme.id).toMatch(/^#[0-9a-f]{6}/)
    }
    const { errors } = await openPlugin(page, manifest.id, archive)
    expect(errors).toEqual([])
  })
}

test('the official themes number eighteen, light and dark', async ({ request }) => {
  const all = await Promise.all(
    THEMES.map(async (folder) => {
      const archive = await readArchive(request, folder)
      return (JSON.parse(read(archive, 'devot-plugin.json')) as Manifest).contributes.themes ?? []
    }),
  )
  const themes = all.flat()
  expect(themes).toHaveLength(18)
  expect(new Set(themes.map((t) => t.appearance))).toEqual(new Set(['light', 'dark']))
})
