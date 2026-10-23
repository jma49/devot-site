import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_SURFACE, themeColors } from '../../src/lib/theme-color.ts'

const repo = join(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(join(repo, path), 'utf8')

const SAMPLE = `:root {
  color-scheme: light dark;
  --color-surface-editor: #ffffff;
  --color-accent-fill: var(--system-accent-fill-light, #3472d6);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-appearance='light']) {
    --color-surface-editor: #0a0a0a;
    --color-accent-fill: var(--system-accent-fill-dark, #4576b2);
  }
}

:root[data-theme='ivory'] {
  --color-surface-editor: #fbf8f1;
}
`

describe('themeColors', () => {
  it('reads the light value from :root and the dark one from the first dark block', () => {
    expect(themeColors(SAMPLE, 'color-surface-editor')).toEqual({
      light: '#ffffff',
      dark: '#0a0a0a',
    })
  })

  it('fails with a code when a value is missing or not a plain hex colour', () => {
    expect(() => themeColors(SAMPLE, 'color-surface-list')).toThrow(/^E_THEME_COLOR /)
    expect(() => themeColors(SAMPLE, 'color-accent-fill')).toThrow(/^E_THEME_COLOR /)
    expect(() =>
      themeColors(':root { --color-surface-editor: #fff; }', 'color-surface-editor'),
    ).toThrow(/^E_THEME_COLOR /)
  })

  it("matches the page background in devot's generated tokens, light and dark", () => {
    const { light, dark } = themeColors(read('src/theme/tokens.css'))
    expect(light).toMatch(/^#[0-9a-f]{6}$/)
    expect(dark).toMatch(/^#[0-9a-f]{6}$/)
    expect(light).not.toBe(dark)
    expect(read('src/styles/site-tokens.css')).toContain(
      `--site-color-page: var(--${PAGE_SURFACE});`,
    )
  })
})
