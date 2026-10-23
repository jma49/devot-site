import { expect, it } from 'vitest'
import { inlineCodeProblems } from '../support/inline-code-policy.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// public/_headers allows no inline script or style; tests/built checks the build for the same.

it('no template or script in src writes inline code', () => {
  const files = filesUnder('src').filter((file) => /\.(astro|ts|html)$/.test(file))
  const offenders = files.flatMap((file) =>
    inlineCodeProblems(file, readRepoFile(file)).map((problem) => `${file}: ${problem}`),
  )
  expect(files.length).toBeGreaterThan(0)
  expect(offenders).toEqual([])
})

it('finds style attributes, event handlers and Astro inlining in templates', () => {
  const found = (markup: string) => inlineCodeProblems('a.astro', markup)
  expect(found('<p style="color: var(--a)">x</p>')).toEqual(['<p style>'])
  expect(found('<p style={`--x: ${y}`}>x</p>')).toEqual(['<p style>'])
  expect(found('<button onclick="go()">x</button>')).toEqual(['<button onclick>'])
  expect(found('<script is:inline>run()</script>')).toEqual(['<script is:inline>'])
  expect(found('<style define:vars={{ a }}>.x{}</style>')).toEqual(['<style define:vars>'])
  expect(found('<p class="a" data-style="b">x</p><script>import "./x.ts"</script>')).toEqual([])
})

it('finds a script that writes a style attribute, and leaves the CSS object model alone', () => {
  const found = (code: string) => inlineCodeProblems('a.ts', code)
  expect(found("el.setAttribute('style', 'top: 0')")).toEqual(['setAttribute("style")'])
  expect(found('el.innerHTML = \'<p style="top: 0">x</p>\'')).toEqual([
    'a style="" attribute in a string',
  ])
  expect(found("el.style.setProperty('--x', '1px'); el.style.top = '0'")).toEqual([])
  expect(found("el.setAttribute('data-style', 'a')")).toEqual([])
})
