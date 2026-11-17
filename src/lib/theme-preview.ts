import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GalleryTheme } from '../i18n/en/themes.ts'
import { THEMES_PATH } from './links.ts'

export const PREVIEW = { width: 640, height: 400 } as const

/** A theme's colour tokens, by the name its file uses (after `--color-`). */
export type ThemeColors = Record<string, string>

/** The slug of a theme's preview image, `/themes/<slug>.svg`. */
export const previewSlug = (theme: Pick<GalleryTheme, 'folder' | 'id'>) =>
  `${theme.folder}-${theme.id}`

export const previewPath = (theme: Pick<GalleryTheme, 'folder' | 'id'>) =>
  `${THEMES_PATH}/${previewSlug(theme)}.svg`

/** The gallery's themes by plugin folder, in catalog order. */
export function themeFamilies<T extends Pick<GalleryTheme, 'folder'>>(gallery: readonly T[]) {
  const families = new Map<string, T[]>()
  for (const theme of gallery)
    families.set(theme.folder, [...(families.get(theme.folder) ?? []), theme])
  return [...families].map(([folder, themes]) => ({ folder, themes }))
}

/** The colours of a theme as its plugin ships them, read through its manifest. */
export function themeColors(root: string, theme: Pick<GalleryTheme, 'folder' | 'id'>): ThemeColors {
  const folder = join(root, 'plugins', theme.folder)
  const manifest = JSON.parse(readFileSync(join(folder, 'devot-plugin.json'), 'utf8')) as {
    contributes?: { themes?: { id: string; path: string }[] }
  }
  const entry = manifest.contributes?.themes?.find(({ id }) => id === theme.id)
  if (!entry) throw new Error(`E_THEME_PREVIEW_MISSING ${previewSlug(theme)}`)
  const file = JSON.parse(readFileSync(join(folder, entry.path), 'utf8')) as {
    colors: ThemeColors
  }
  return file.colors
}

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i

/** SVG paint attributes for a token: six-digit hex, with the alpha as an opacity of its own. */
function paint(colors: ThemeColors, token: string, property: 'fill' | 'stroke' = 'fill'): string {
  const value = colors[token]
  const match = value === undefined ? null : HEX.exec(value)
  if (!match) throw new Error(`E_THEME_PREVIEW_COLOR ${token}`)
  const alpha = match[2] === undefined ? 1 : Number.parseInt(match[2], 16) / 255
  const opacity = alpha < 1 ? ` ${property}-opacity="${Number(alpha.toFixed(3))}"` : ''
  return `${property}="#${match[1]!.toLowerCase()}"${opacity}`
}

/**
 * A wordless sketch of Devot in a theme: the sidebar, the note list and an open note with a
 * heading, a link, a highlight, a task, a code block, a tag and a quote, each in its token.
 */
export function themePreviewSvg(colors: ThemeColors): string {
  const rect = (x: number, y: number, w: number, h: number, token: string, r = 3) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${paint(colors, token)}/>`
  const sidebarRows = [44, 70, 96, 122].map((y, row) =>
    row === 1
      ? rect(10, y - 9, 130, 24, 'fill-row-selected', 7) + rect(22, y, 78, 7, 'text-primary')
      : rect(22, y, [64, 0, 88, 56][row]!, 7, 'text-secondary'),
  )
  const tags = (['tag-text-blue', 'tag-text-green', 'tag-text-orange'] as const).map(
    (token, row) =>
      `<circle cx="27" cy="${178 + row * 26}" r="5" ${paint(colors, token)}/>` +
      rect(40, 175 + row * 26, [54, 70, 46][row]!, 7, 'text-secondary'),
  )
  const cards = [16, 96, 176].map(
    (y, card) =>
      (card === 0 ? rect(158, y, 134, 70, 'fill-row-selected', 9) : '') +
      rect(170, y + 14, [92, 76, 100][card]!, 8, 'text-primary') +
      rect(170, y + 34, 108, 6, 'text-secondary') +
      rect(170, y + 48, [80, 96, 64][card]!, 6, 'text-secondary'),
  )
  const note = [
    rect(328, 40, 196, 16, 'syntax-heading'),
    rect(328, 76, 280, 7, 'text-editor'),
    rect(328, 92, 112, 7, 'text-editor'),
    rect(446, 92, 64, 7, 'accent-text'),
    `<rect x="446" y="${101}" width="64" height="1.5" ${paint(colors, 'accent-text')}/>`,
    rect(516, 92, 92, 7, 'text-editor'),
    rect(326, 105, 82, 11, 'editor-mark-fill', 2),
    rect(328, 107, 78, 7, 'text-editor'),
    rect(414, 107, 150, 7, 'text-editor'),
    rect(328, 134, 11, 11, 'status-done', 3),
    rect(348, 136, 140, 7, 'text-tertiary'),
    `<rect x="324" y="160" width="292" height="76" rx="8" ${paint(colors, 'code-block-bg')} ${paint(colors, 'code-block-border', 'stroke')}/>`,
    rect(340, 178, 34, 7, 'syntax-keyword'),
    rect(380, 178, 52, 7, 'syntax-function'),
    rect(438, 178, 86, 7, 'syntax-string'),
    rect(352, 196, 40, 7, 'syntax-keyword'),
    rect(398, 196, 104, 7, 'syntax-string'),
    rect(340, 214, 120, 7, 'syntax-comment'),
    rect(328, 256, 64, 20, 'tag-blue', 10),
    rect(340, 263, 40, 6, 'tag-text-blue'),
    rect(400, 256, 72, 20, 'tag-green', 10),
    rect(412, 263, 48, 6, 'tag-text-green'),
    rect(328, 296, 3, 34, 'quote-bar', 1.5),
    rect(342, 300, 220, 7, 'text-secondary'),
    rect(342, 316, 160, 7, 'text-secondary'),
  ]
  const { width, height } = PREVIEW
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" ${paint(colors, 'surface-window')}/>`,
    `<rect width="150" height="${height}" ${paint(colors, 'surface-sidebar-opaque')}/>`,
    `<rect x="150" width="150" height="${height}" ${paint(colors, 'surface-list')}/>`,
    `<rect x="300" width="340" height="${height}" ${paint(colors, 'surface-editor')}/>`,
    `<rect x="300" width="1" height="${height}" ${paint(colors, 'line-separator')}/>`,
    ...sidebarRows,
    ...tags,
    ...cards,
    ...note,
    '</svg>',
    '',
  ].join('\n')
}
