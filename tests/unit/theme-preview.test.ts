import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import {
  PREVIEW,
  previewPath,
  themeColors,
  themeFamilies,
  themePreviewSvg,
} from '../../src/lib/theme-preview.ts'

const ROOT = join(import.meta.dirname, '../..')
const { gallery } = en.themes

interface Manifest {
  contributes?: { themes?: { id: string; title: string; appearance: string }[] }
}

const shipped = readdirSync(join(ROOT, 'plugins')).flatMap((folder) => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'plugins', folder, 'devot-plugin.json'), 'utf8'),
  ) as Manifest
  return (manifest.contributes?.themes ?? []).map(({ id, title, appearance }) => ({
    folder,
    id,
    title,
    appearance,
  }))
})

describe('theme gallery', () => {
  it('lists every theme the official plugins ship, as their manifests name it', () => {
    const listed = gallery.map(({ folder, id, title, appearance }) => ({
      folder,
      id,
      title,
      appearance,
    }))
    expect(new Set(listed.map((theme) => JSON.stringify(theme)))).toEqual(
      new Set(shipped.map((theme) => JSON.stringify(theme))),
    )
    expect(listed).toHaveLength(shipped.length)
  })

  it('has a plugin listing to download for every family', () => {
    for (const { folder } of themeFamilies(gallery)) {
      expect(en.plugins.listings.find((listing) => listing.folder === folder)?.download).toBe(
        `/plugins/${folder}.zip`,
      )
    }
  })

  it('groups themes by plugin in catalog order', () => {
    const themes = [
      { folder: 'a', id: '1' },
      { folder: 'b', id: '1' },
      { folder: 'a', id: '2' },
    ]
    expect(themeFamilies(themes)).toEqual([
      { folder: 'a', themes: [themes[0], themes[2]] },
      { folder: 'b', themes: [themes[1]] },
    ])
  })

  it('names each preview by its plugin and theme', () => {
    expect(previewPath({ folder: 'tokyo-night', id: 'storm' })).toBe(
      '/themes/tokyo-night-storm.svg',
    )
  })
})

describe('theme preview', () => {
  it('draws every theme from its own colours, without words', () => {
    for (const theme of gallery) {
      const colors = themeColors(ROOT, theme)
      const svg = themePreviewSvg(colors)
      expect(svg).toContain(`viewBox="0 0 ${PREVIEW.width} ${PREVIEW.height}"`)
      expect(svg).toContain(`fill="${colors['surface-editor']!.slice(0, 7).toLowerCase()}"`)
      expect(svg).not.toMatch(/<text/)
    }
  })

  it('gives a translucent colour its alpha as an opacity', () => {
    const colors = { ...themeColors(ROOT, gallery[0]!), 'fill-row-selected': '#3366CC80' }
    expect(themePreviewSvg(colors)).toContain('fill="#3366cc" fill-opacity="0.502"')
  })

  it('refuses a theme that lacks a token it draws', () => {
    const { 'quote-bar': _, ...colors } = themeColors(ROOT, gallery[0]!)
    expect(() => themePreviewSvg(colors)).toThrow('E_THEME_PREVIEW_COLOR quote-bar')
  })

  it('refuses a theme its plugin does not ship', () => {
    expect(() => themeColors(ROOT, { folder: 'nord', id: 'missing' })).toThrow(
      'E_THEME_PREVIEW_MISSING nord-missing',
    )
  })
})
