// Patterns behind tests/policy/colors.test.ts, kept here so tests can check them against samples.

/** Generated from devot, and the one site file that may name raw values. */
export const GENERATED_TOKENS = 'src/theme/tokens.css'
export const SITE_TOKENS = 'src/styles/site-tokens.css'

const CODE = /\.(astro|css|ts|tsx|js|mjs|jsx)$/

export function isColorChecked(path: string): boolean {
  return CODE.test(path) && path !== GENERATED_TOKENS && path !== SITE_TOKENS
}

const COLOR_FUNCTION_OR_HEX = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
const COLOR_WORDS =
  'white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|teal|navy|silver'
// Unquoted (CSS): any case counts.
const COLOR_NAME_BARE = new RegExp(`:\\s*(?:${COLOR_WORDS})\\b`, 'i')
// Quoted (TypeScript): lower case only; a capitalised string is a label.
const COLOR_NAME_QUOTED = new RegExp(`:\\s*['"](?:${COLOR_WORDS})\\b`)

/** Whether a line writes out a colour: hex, a colour function, or a named colour as a value. */
export function hasColorLiteral(line: string): boolean {
  return (
    COLOR_FUNCTION_OR_HEX.test(line) || COLOR_NAME_BARE.test(line) || COLOR_NAME_QUOTED.test(line)
  )
}

/** Custom properties a stylesheet defines (`--name:`) and reads (`var(--name`). */
export function customProperties(text: string): { defined: string[]; used: string[] } {
  const names = (pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1] as string)
  return {
    defined: names(/(--[\w-]+)\s*:/g),
    used: names(/var\(\s*(--[\w-]+)/g),
  }
}
