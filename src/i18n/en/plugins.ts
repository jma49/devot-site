import type { PluginListing, PluginPermission } from '../../lib/plugins.ts'
import { SITE_REPO_URL } from '../../site.ts'

const listings: PluginListing[] = [
  {
    id: 'online.devot.csv-tables',
    name: 'CSV Tables',
    author: 'Devot',
    summary:
      'Imports CSV and TSV files as notes holding a Markdown table, and draws csv code blocks as tables in the preview.',
    permissions: ['preview', 'import'],
    source: `${SITE_REPO_URL}/tree/main/plugins/csv-tables`,
    download: '/plugins/csv-tables.zip',
    folder: 'csv-tables',
  },
]

const permissionNames: Record<PluginPermission, string> = {
  'note.read': 'read the open note',
  'note.edit': 'change the open note',
  commands: 'add commands',
  menus: 'add menu items',
  keymaps: 'add keyboard shortcuts',
  preview: 'draw code blocks in the preview',
  import: 'add an import format',
  export: 'add an export format',
}

export const pluginsCopy = { plugins: { listings, permissionNames } }
