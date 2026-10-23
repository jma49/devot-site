import { describe, expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'
import {
  colorLiterals,
  customProperties,
  GENERATED_TOKENS,
  isColorChecked,
  NAMED_COLORS,
  SITE_TOKENS,
} from '../support/style-policy.ts'

// Colours come from devot's semantic tokens, or from site variables built on them in SITE_TOKENS.

const caught = (file: string) => (sample: string) => colorLiterals(file, sample).length > 0

describe('colours', () => {
  it('components and page styles use tokens, not colour literals', () => {
    const offenders = filesUnder('src')
      .filter(isColorChecked)
      .flatMap((file) => colorLiterals(file, readRepoFile(file)).map((hit) => `${file}:${hit}`))
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

  it('the scan covers components, styles, scripts and pages but not the token files', () => {
    const checked = [
      'src/pages/index.astro',
      'src/components/Header.astro',
      'src/styles/global.css',
      'src/lib/theme-color.ts',
      'src/x.mts',
      'src/x.cjs',
      'src/x.html',
      'src/pages/a.md',
      'src/pages/a.mdx',
    ]
    const skipped = [GENERATED_TOKENS, SITE_TOKENS, 'src/assets/dove.svg', 'src/i18n/en.json']
    expect(checked.filter((path) => !isColorChecked(path))).toEqual([])
    expect(skipped.filter(isColorChecked)).toEqual([])
  })

  it('knows every CSS named colour', () => {
    expect(new Set(NAMED_COLORS).size).toBe(148)
    expect(NAMED_COLORS).toContain('rebeccapurple')
  })

  it('catches hex, colour functions and named colours anywhere in a CSS value', () => {
    const literals = [
      'color: #fff;',
      'background: rgb(1 2 3);',
      'fill: hsl(10 20% 30%)',
      'color: oklch(70% 0.1 200);',
      'border-color: color(display-p3 1 0 0);',
      'color: black;',
      'color: White;',
      'border: 1px solid red;',
      'outline: 2px solid black;',
      'box-shadow: 0 0 0 1px white;',
      'background: linear-gradient(white, black);',
      'text-decoration: underline red;',
      'color: tomato;',
      'color: crimson;',
      'background: gold;',
      'fill: aqua;',
      'color: rebeccapurple;',
      'color: Canvas;',
      'color: light-dark(white, black);',
      'background: color-mix(in srgb, var(--color-accent-fill), white 20%);',
      'background: var(--x, red);',
      '--accent: navy;',
    ]
    expect(literals.filter((sample) => !caught('a.css')(sample))).toEqual([])
  })

  it('leaves tokens, keywords, selectors and comments in CSS alone', () => {
    const fine = [
      'color: var(--site-color-text);',
      'outline: var(--size-focus-ring) solid var(--color-focus-ring);',
      'color: var(--color-tag-red);',
      'color: currentColor;',
      'background: transparent;',
      'white-space: nowrap;',
      'a:hover .red {',
      '.red, .white:focus-visible {',
      '@media (prefers-color-scheme: dark) {',
      '/* note: white text */',
      'background: url(/images/red.png);',
    ]
    expect(fine.filter(caught('a.css'))).toEqual([])
  })

  it('catches colours in scripts and markup, and leaves labels and keys alone', () => {
    const literals = {
      'a.ts': [
        "const accent = '#3a7bd5'",
        "{ color: 'red' }",
        "const accent = 'red'",
        'el.style.color = "blue"',
        "el.style.setProperty('background', 'tomato')",
      ],
      'a.astro': [
        '<path fill="red" />',
        '<rect stroke="black" />',
        '<stop stop-color="White" />',
        "<div style={{ color: 'White' }} />",
        '<p style="color: red">',
      ],
    }
    const fine = {
      'a.ts': [
        "const label = 'Pick red or blue'",
        "colorName: 'Red',",
        'mark: string',
        'highlight: true,',
        '// note: white text',
        "const scheme = 'light'",
      ],
      'a.astro': ['<a href="#main">', '<p class="red">', '<p>Pick red or white</p>'],
    }
    for (const [file, samples] of Object.entries(literals)) {
      expect(
        samples.filter((sample) => !caught(file)(sample)),
        file,
      ).toEqual([])
    }
    for (const [file, samples] of Object.entries(fine)) {
      expect(samples.filter(caught(file)), file).toEqual([])
    }
  })

  it('reads whole declarations and only the <style> blocks of a template as CSS', () => {
    const css =
      '.x {\n  background:\n    linear-gradient(\n      var(--a),\n      white\n    );\n}\n'
    expect(colorLiterals('a.css', css)).toEqual(['5: white'])

    const astro = [
      '---',
      '// note: white text',
      '---',
      '<p class="red">{t.pick}</p>',
      '<style>',
      '  /* note: white text */',
      '  .red {',
      '    border: 1px solid red;',
      '  }',
      '</style>',
    ].join('\n')
    expect(colorLiterals('a.astro', astro)).toEqual(['8: border: 1px solid red;'])
  })

  it('custom property parsing finds definitions and uses', () => {
    expect(
      customProperties(':root { --a: 1px; --b-c: var(--a); }\n.x { gap: var( --d , 2px) }'),
    ).toEqual({ defined: ['--a', '--b-c'], used: ['--a', '--d'] })
  })
})
