/** The devot token the page background uses (src/styles/site-tokens.css). */
export const PAGE_SURFACE = 'color-surface-editor'

const HEX = /^#[0-9a-f]{6}$/i
const DARK_BLOCK = '@media (prefers-color-scheme: dark)'

/**
 * A token's light and dark values from devot's tokens.css, for `<meta name="theme-color">`, which
 * cannot read custom properties. Fails the build (E_THEME_COLOR) instead of guessing.
 */
export function themeColors(
  css: string,
  token: string = PAGE_SURFACE,
): { light: string; dark: string } {
  const darkStart = css.indexOf(DARK_BLOCK)
  const light = valueIn(block(css, css.indexOf(':root')), token)
  const dark = darkStart < 0 ? undefined : valueIn(block(css, darkStart), token)
  if (light === undefined || dark === undefined || !HEX.test(light) || !HEX.test(dark)) {
    throw new Error(`E_THEME_COLOR --${token} needs a #rrggbb value in :root and ${DARK_BLOCK}`)
  }
  return { light, dark }
}

function block(css: string, start: number): string {
  const open = css.indexOf('{', start)
  if (start < 0 || open < 0) return ''
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open, i)
  }
  return ''
}

function valueIn(css: string, token: string): string | undefined {
  return new RegExp(`--${token}:\\s*([^;]+);`).exec(css)?.[1]?.trim()
}
