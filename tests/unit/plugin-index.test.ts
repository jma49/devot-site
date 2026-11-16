import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLUGIN_INDEX_SCHEMA, pluginIndex } from '../../src/lib/plugin-index.ts'
import { pluginArchive, pluginPackages } from '../../src/lib/plugin-packages.ts'
import { SITE_REPO_URL } from '../../src/site.ts'

const PLUGINS = join(import.meta.dirname, '../../plugins')

describe('the plugin index Devot reads to list and install official plugins', () => {
  it('lists every official plugin once, by ID', async () => {
    const index = await pluginIndex()
    expect(index.schema).toBe(PLUGIN_INDEX_SCHEMA)
    const ids = index.plugins.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([...ids].sort())
    expect(index.plugins).toHaveLength(pluginPackages().size)
  })

  it.each([...pluginPackages().keys()])('describes %s as its manifest does', async (folder) => {
    const manifest = JSON.parse(readFileSync(join(PLUGINS, folder, 'devot-plugin.json'), 'utf8'))
    const entry = (await pluginIndex()).plugins.find((p) => p.id === manifest.id)
    expect(entry).toEqual({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      apiVersion: manifest.apiVersion,
      minAppVersion: manifest.minAppVersion ?? null,
      description: manifest.description,
      author: manifest.author,
      permissions: manifest.permissions,
      archive: `/plugins/${folder}.zip`,
      bytes: pluginArchive(folder).byteLength,
      sha256: createHash('sha256').update(pluginArchive(folder)).digest('hex'),
      source: `${SITE_REPO_URL}/tree/main/plugins/${folder}`,
    })
  })
})
