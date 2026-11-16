// The official plugins' sources (`plugins/<folder>/`), read at build time, packed as the archives
// Devot's Settings > Plugins > Install from Archive takes.
import vizGlobal from '../../node_modules/@viz-js/viz/dist/viz-global.js?raw'
import { storedZip } from './zip.ts'

const sources = import.meta.glob<string>('../../plugins/*/*', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Libraries a plugin's main.js runs after, put before it in the package, by folder; pinned in package.json. */
const LIBRARIES: Readonly<Record<string, string>> = { graphviz: vizGlobal }

/** Files of each package by folder; the README stays on the site and out of the archive. */
export function pluginPackages(): Map<string, { path: string; text: string }[]> {
  const packages = new Map<string, { path: string; text: string }[]>()
  for (const [file, text] of Object.entries(sources)) {
    const [folder, path] = file.split('/').slice(-2) as [string, string]
    if (path === 'README.md') continue
    const library = path === 'main.js' ? LIBRARIES[folder] : undefined
    const packed = library === undefined ? text : `${library.trimEnd()}\n${text}`
    packages.set(folder, [...(packages.get(folder) ?? []), { path, text: packed }])
  }
  for (const files of packages.values()) files.sort((a, b) => (a.path < b.path ? -1 : 1))
  return packages
}

export function pluginArchive(folder: string): Uint8Array<ArrayBuffer> {
  const files = pluginPackages().get(folder)
  if (!files) throw new Error(`E_PLUGIN_PACKAGE_MISSING ${folder}`)
  const encoder = new TextEncoder()
  return storedZip(files.map(({ path, text }) => ({ path, bytes: encoder.encode(text) })))
}
