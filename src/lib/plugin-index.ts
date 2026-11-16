// The index Devot's Settings > Plugins reads to list official plugins and install or update them.
// A breaking change to its shape raises the schema; Devot ignores an index whose schema it does not know.
import { SITE_REPO_URL } from '../site.ts'
import { pluginArchive, pluginPackages } from './plugin-packages.ts'

export const PLUGIN_INDEX_SCHEMA = 1

export interface PluginIndexEntry {
  id: string
  name: string
  version: string
  apiVersion: number
  minAppVersion: string | null
  description: string
  author: string
  permissions: string[]
  /** A path on this site. */
  archive: string
  bytes: number
  sha256: string
  source: string
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function pluginIndex(): Promise<{
  schema: number
  plugins: PluginIndexEntry[]
}> {
  const plugins: PluginIndexEntry[] = []
  for (const [folder, files] of pluginPackages()) {
    const text = files.find((f) => f.path === 'devot-plugin.json')?.text
    if (!text) throw new Error(`E_PLUGIN_MANIFEST_MISSING ${folder}`)
    const manifest = JSON.parse(text)
    const archive = pluginArchive(folder)
    plugins.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      apiVersion: manifest.apiVersion,
      minAppVersion: manifest.minAppVersion ?? null,
      description: manifest.description,
      author: manifest.author,
      permissions: manifest.permissions,
      archive: `/plugins/${folder}.zip`,
      bytes: archive.byteLength,
      sha256: await sha256(archive),
      source: `${SITE_REPO_URL}/tree/main/plugins/${folder}`,
    })
  }
  plugins.sort((a, b) => (a.id < b.id ? -1 : 1))
  return { schema: PLUGIN_INDEX_SCHEMA, plugins }
}
