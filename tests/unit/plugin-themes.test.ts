import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  contrast,
  devotTokens,
  hex,
  isIconColor,
  lightness,
  parseColor,
  themeColors,
  themeFiles,
  type Rgba,
} from '../../scripts/plugin-themes/generate.ts'
import { THEME_FAMILIES, type Palette } from '../../scripts/plugin-themes/palettes.ts'

const ROOT = join(import.meta.dirname, '../..')
const CSS = readFileSync(join(ROOT, 'src/theme/tokens.css'), 'utf8')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const color = (value: string) => parseColor(value)

const palette: Palette = {
  id: 'test',
  title: 'Test',
  appearance: 'dark',
  background: '#202020',
  text: '#d0d0d0',
  accent: '#5080ff',
  neutrals: ['#101010', '#202020', '#808080', '#d0d0d0', '#f0f0f0'],
  hues: ['#ff4040', '#40c040', '#5080ff'],
}

const devot = new Map<string, Rgba>(
  Object.entries({
    'surface-window': '#000000',
    'surface-editor': '#0a0a0a',
    'surface-editor-wash': 'rgb(10 10 10 / 0.6)',
    'text-editor': '#d1d5db',
    'ink-text': '#ffffff',
    'fill-hover': 'rgb(255 255 255 / 0.08)',
    'line-shadow': 'rgb(0 0 0 / 0.45)',
    'accent-fill': '#4576b2',
    'accent-on-fill': '#ffffff',
    'accent-selection': '#29233a',
    'status-done': '#10b77f',
    'fill-match': 'rgb(245 159 10 / 0.25)',
    'qr-module': '#1c1b19',
  }).map(([name, value]) => [name, color(value)]),
)

describe('reading colors', () => {
  it('reads hex, hex with alpha, rgb with alpha and a system color’s fallback', () => {
    expect(color('#3472d6')).toEqual({ r: 52, g: 114, b: 214, a: 1 })
    expect(color('#00000080').a).toBeCloseTo(0.5, 2)
    expect(color('rgb(235 232 226 / 0.08)')).toEqual({ r: 235, g: 232, b: 226, a: 0.08 })
    expect(color('var(--system-accent-fill-dark, #4576b2)')).toEqual(color('#4576b2'))
  })

  it('names a value it cannot read by code', () => {
    expect(() => color('color-mix(in srgb, red, blue)')).toThrow('E_THEME_TOKEN_FORMAT')
  })

  it('writes alpha only when a color has some', () => {
    expect(hex({ r: 1, g: 2, b: 3, a: 1 })).toBe('#010203')
    expect(hex({ r: 255, g: 255, b: 255, a: 0.5 })).toBe('#ffffff80')
  })

  it('reads every color token of Devot’s own theme for each appearance', () => {
    const light = devotTokens(CSS, 'light')
    const dark = devotTokens(CSS, 'dark')
    expect(light.size).toBeGreaterThan(200)
    expect([...dark.keys()].sort()).toEqual([...light.keys()].sort())
    expect(hex(light.get('surface-editor')!)).toBe('#ffffff')
    expect(hex(dark.get('surface-editor')!)).toBe('#0a0a0a')
  })
})

describe('a theme drawn from a palette', () => {
  const colors = themeColors(devot, palette)
  const at = (name: string) => color(colors[name]!)

  it('puts the editor’s ground and ink on the palette’s', () => {
    expect(colors['surface-editor']).toBe('#202020')
    expect(colors['text-editor']).toBe('#d0d0d0')
  })

  it('takes the ends of the palette’s grays for Devot’s darkest and lightest', () => {
    expect(colors['surface-window']).toBe('#101010')
    expect(colors['ink-text']).toBe('#f0f0f0')
  })

  it('keeps a translucent gray translucent, along the palette’s grays', () => {
    expect(colors['fill-hover']).toBe('#f0f0f014')
    expect(colors['line-shadow']).toBe('#10101073')
    expect(colors['surface-editor-wash']).toBe('#20202099')
  })

  it('gives accent tokens the palette’s accent, a selection at the depth Devot gives it', () => {
    expect(colors['accent-fill']).toBe('#5080ff')
    const selection = at('accent-selection')
    expect(lightness(selection)).toBeLessThan(lightness(at('accent-fill')))
    expect(selection.b).toBeGreaterThan(selection.r)
  })

  it('takes the palette hue nearest a color’s own', () => {
    expect(colors['status-done']).toBe('#40c040')
    expect(colors['fill-match']).toBe('#ff404040')
  })

  it('puts ink on a fill that reads at 4.5:1', () => {
    expect(contrast(at('accent-on-fill'), at('accent-fill'))).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves the QR code to Devot', () => {
    expect(colors).not.toHaveProperty('qr-module')
  })

  it("leaves every icon in Devot's colors: status marks, settings tiles, tag icons and phone status tiles", () => {
    const icons = [...devotTokens(CSS, 'dark').keys()].filter(isIconColor)
    expect(icons.length).toBe(35)
    for (const token of icons) expect(colors).not.toHaveProperty(token)
  })
})

describe('the official theme plugins', () => {
  const files = themeFiles(CSS, THEME_FAMILIES)

  it('hold the theme files the palettes make (pnpm plugin-themes writes them)', () => {
    for (const [path, text] of files)
      expect(existsSync(join(ROOT, path)) && read(path), path).toBe(text)
  })

  it('set no icon color in any of the eighteen themes', () => {
    const themes = [...files].filter(([path]) => path.endsWith('.json'))
    expect(themes).toHaveLength(18)
    for (const [path, text] of themes)
      expect(Object.keys(JSON.parse(text).colors).filter(isIconColor), path).toEqual([])
  })

  it.each(THEME_FAMILIES)(
    '$folder lists each of its themes, credits its source and asks only for themes',
    (family) => {
      const manifest = JSON.parse(read(`plugins/${family.folder}/devot-plugin.json`))
      expect(manifest.permissions).toEqual(['themes'])
      expect(manifest.apiVersion).toBe(2)
      expect(manifest.contributes.themes).toEqual(
        family.palettes.map((p) => ({
          id: p.id,
          title: p.title,
          appearance: p.appearance,
          path: `${p.id}.json`,
        })),
      )
      expect(read(`plugins/${family.folder}/LICENSE`)).toMatch(
        /^(The )?MIT License|Permission is hereby granted/m,
      )
    },
  )

  it.each(
    THEME_FAMILIES.flatMap((f) => f.palettes.map((p) => [`${f.folder}/${p.id}`, p] as const)),
  )('%s reads well and holds only colors Devot accepts', (path) => {
    const text = files.get(`plugins/${path}.json`)!
    expect(text.length).toBeLessThanOrEqual(64 * 1024)
    const { colors } = JSON.parse(text) as { colors: Record<string, string> }
    for (const [key, value] of Object.entries(colors)) {
      expect(key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(value).toMatch(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/)
    }
    const reads = (ink: string, ground: string) =>
      contrast(color(colors[ink]!), color(colors[ground]!))
    expect(reads('text-editor', 'surface-editor')).toBeGreaterThanOrEqual(4.5)
    expect(reads('text-primary', 'surface-list')).toBeGreaterThanOrEqual(4.5)
    expect(reads('accent-on-fill', 'accent-fill')).toBeGreaterThanOrEqual(4.5)
    expect(reads('text-on-destructive', 'fill-destructive')).toBeGreaterThanOrEqual(4.5)
    expect(reads('text-destructive', 'surface-editor')).toBeGreaterThanOrEqual(4.5)
  })
})
