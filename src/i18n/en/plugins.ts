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
  {
    id: 'online.devot.charts',
    name: 'Charts',
    author: 'Devot',
    summary:
      'Draws chart code blocks as bar or line charts in the preview, from rows of a label and numbers, in light and dark.',
    permissions: ['preview'],
    source: `${SITE_REPO_URL}/tree/main/plugins/charts`,
    download: '/plugins/charts.zip',
    folder: 'charts',
  },
  {
    id: 'online.devot.bibtex',
    name: 'BibTeX References',
    author: 'Devot',
    summary:
      'Imports .bib files as notes of formatted references, and shows bibtex code blocks as a reference list in the preview.',
    permissions: ['preview', 'import'],
    source: `${SITE_REPO_URL}/tree/main/plugins/bibtex`,
    download: '/plugins/bibtex.zip',
    folder: 'bibtex',
  },
  {
    id: 'online.devot.note-query',
    name: 'Note Query',
    author: 'Devot',
    summary:
      'Shows query code blocks as a live table or list of the notes that match, by tag, notebook, status, dates and front matter. Needs Devot 1.1.8.',
    permissions: ['preview', 'notes.read'],
    source: `${SITE_REPO_URL}/tree/main/plugins/note-query`,
    download: '/plugins/note-query.zip',
    folder: 'note-query',
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
  storage: 'keep its own data',
  'notes.read': 'read all notes',
  themes: 'add colour themes',
}

export const pluginsCopy = { plugins: { listings, permissionNames } }
