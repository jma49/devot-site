/** Permissions as a plugin's manifest asks for them (Devot's plugin API version 1). */
export const PLUGIN_PERMISSIONS = [
  'note.read',
  'note.edit',
  'commands',
  'menus',
  'keymaps',
  'preview',
  'import',
  'export',
] as const
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number]

export interface PluginListing {
  /** The manifest's `id`. */
  id: string
  name: string
  author: string
  summary: string
  /** Exactly what the manifest asks for. */
  permissions: PluginPermission[]
  /** Its public source, over https. */
  source: string
  /** The archive to install: a path on this site for an official plugin, else an https address. */
  download: string
  /** The folder under `plugins/` in this repository that holds an official plugin's source. */
  folder?: string
}
