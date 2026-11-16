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
  {
    id: 'online.devot.graphviz',
    name: 'Graphviz',
    author: 'Devot',
    summary:
      'Draws dot code blocks as Graphviz diagrams in the preview, in the colours of the theme on screen, without a network. Needs Devot 1.1.8.',
    permissions: ['preview'],
    source: `${SITE_REPO_URL}/tree/main/plugins/graphviz`,
    download: '/plugins/graphviz.zip',
    folder: 'graphviz',
  },
  {
    id: 'online.devot.excalidraw',
    name: 'Excalidraw',
    author: 'Devot',
    summary:
      'Draws excalidraw code blocks as hand-drawn sketches in the preview, and edits them in a whiteboard in the plugin panel. Needs Devot 1.1.8.',
    permissions: ['preview'],
    source: `${SITE_REPO_URL}/tree/main/plugins/excalidraw`,
    download: '/plugins/excalidraw.zip',
    folder: 'excalidraw',
  },
  {
    id: 'online.devot.theme-catppuccin',
    name: 'Catppuccin',
    author: 'Devot',
    summary:
      'The Catppuccin themes in soothing pastels: Latte for Light Mode; Frappé, Macchiato and Mocha for Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/catppuccin`,
    download: '/plugins/catppuccin.zip',
    folder: 'catppuccin',
  },
  {
    id: 'online.devot.theme-tokyo-night',
    name: 'Tokyo Night',
    author: 'Devot',
    summary:
      'The Tokyo Night themes in blues and violets: Tokyo Night Light for Light Mode; Tokyo Night and Storm for Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/tokyo-night`,
    download: '/plugins/tokyo-night.zip',
    folder: 'tokyo-night',
  },
  {
    id: 'online.devot.theme-dracula',
    name: 'Dracula',
    author: 'Devot',
    summary:
      'The Dracula theme, vivid purple, pink and green on deep gray, for Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/dracula`,
    download: '/plugins/dracula.zip',
    folder: 'dracula',
  },
  {
    id: 'online.devot.theme-nord',
    name: 'Nord',
    author: 'Devot',
    summary:
      'The Nord theme of calm arctic blues and frosted grays, for Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/nord`,
    download: '/plugins/nord.zip',
    folder: 'nord',
  },
  {
    id: 'online.devot.theme-gruvbox',
    name: 'Gruvbox',
    author: 'Devot',
    summary:
      'The Gruvbox themes in warm retro browns, yellows and greens, for Light Mode and Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/gruvbox`,
    download: '/plugins/gruvbox.zip',
    folder: 'gruvbox',
  },
  {
    id: 'online.devot.theme-solarized',
    name: 'Solarized',
    author: 'Devot',
    summary:
      'The Solarized themes of cream and deep teal, for Light Mode and Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/solarized`,
    download: '/plugins/solarized.zip',
    folder: 'solarized',
  },
  {
    id: 'online.devot.theme-rose-pine',
    name: 'Rosé Pine',
    author: 'Devot',
    summary:
      'The Rosé Pine themes in muted rose, pine and gold: Dawn for Light Mode; Rosé Pine and Moon for Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/rose-pine`,
    download: '/plugins/rose-pine.zip',
    folder: 'rose-pine',
  },
  {
    id: 'online.devot.theme-one',
    name: 'One Dark and Light',
    author: 'Devot',
    summary:
      'The One themes of cool grays and soft colors: One Light for Light Mode, One Dark for Dark Mode. Needs Devot 1.1.8.',
    permissions: ['themes'],
    source: `${SITE_REPO_URL}/tree/main/plugins/one`,
    download: '/plugins/one.zip',
    folder: 'one',
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
