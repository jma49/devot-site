import { describe, expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'
import {
  customProperties,
  GENERATED_TOKENS,
  hasColorLiteral,
  isColorChecked,
  SITE_TOKENS,
} from '../support/style-policy.ts'

// Colours come from devot's semantic tokens, or from site variables built on them in SITE_TOKENS.

describe('colours', () => {
  it('components and page styles use tokens, not colour literals', () => {
    const offenders = filesUnder('src')
      .filter(isColorChecked)
      .flatMap((file) =>
        readRepoFile(file)
          .split('\n')
          .flatMap((line, i) =>
            hasColorLiteral(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
          ),
      )
    expect(offenders).toEqual([])
  })

  it('every custom property read in src is defined somewhere', () => {
    const files = filesUnder('src').filter((file) => /\.(astro|css)$/.test(file))
    const defined = new Set(files.flatMap((file) => customProperties(readRepoFile(file)).defined))
    const undefinedUses = files.flatMap((file) =>
      customProperties(readRepoFile(file))
        .used.filter((name) => !defined.has(name) && !name.startsWith('--system-'))
        .map((name) => `${file}: ${name}`),
    )
    expect(defined.size).toBeGreaterThan(100)
    expect(undefinedUses).toEqual([])
  })

  it('the scan covers components, styles and scripts but not the token files', () => {
    const checked = [
      'src/pages/index.astro',
      'src/components/Header.astro',
      'src/styles/global.css',
      'src/lib/theme-color.ts',
    ]
    const skipped = [GENERATED_TOKENS, SITE_TOKENS, 'src/assets/dove.svg', 'src/i18n/en.json']
    expect(checked.filter((path) => !isColorChecked(path))).toEqual([])
    expect(skipped.filter(isColorChecked)).toEqual([])
  })

  it('the pattern catches literals and leaves tokens and labels alone', () => {
    const literals = [
      'color: #fff;',
      "const accent = '#3a7bd5'",
      'background: rgb(1 2 3);',
      'fill: hsl(10 20% 30%)',
      'color: oklch(70% 0.1 200);',
      'border-color: color(display-p3 1 0 0);',
      'color: black;',
      'color: White;',
      "{ color: 'red' }",
    ]
    const fine = [
      'color: var(--site-color-text);',
      'outline: var(--size-focus-ring) solid var(--color-focus-ring);',
      "const label = 'Pick red or blue'",
      "colorName: 'Red',",
      'color: currentColor;',
      '<a href="#main">',
    ]
    expect(literals.filter((line) => !hasColorLiteral(line))).toEqual([])
    expect(fine.filter(hasColorLiteral)).toEqual([])
  })

  it('custom property parsing finds definitions and uses', () => {
    expect(
      customProperties(':root { --a: 1px; --b-c: var(--a); }\n.x { gap: var( --d , 2px) }'),
    ).toEqual({ defined: ['--a', '--b-c'], used: ['--a', '--d'] })
  })
})
