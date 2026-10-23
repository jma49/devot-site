import { tags } from './html.ts'

/**
 * Ways a source file would put inline code in a page, which the CSP blocks: `style=` attributes,
 * inline event handlers, `is:inline` and `define:vars` in a template, and a script writing a
 * `style` attribute (the CSS object model, `element.style.setProperty`, is allowed).
 */
export function inlineCodeProblems(path: string, text: string): string[] {
  if (path.endsWith('.astro') || path.endsWith('.html')) {
    return tags(text).flatMap(({ name, attrs }) =>
      [...attrs.keys()]
        .filter(
          (attr) =>
            attr === 'style' ||
            /^on[a-z]+$/.test(attr) ||
            attr === 'is:inline' ||
            attr === 'define:vars',
        )
        .map((attr) => `<${name} ${attr}>`),
    )
  }
  return [
    ...(/setAttribute\(\s*['"`]style['"`]/.test(text) ? ['setAttribute("style")'] : []),
    ...(/\bstyle\s*=\s*\\?["']/.test(text) ? ['a style="" attribute in a string'] : []),
  ]
}
