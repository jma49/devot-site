// The pattern behind tests/policy/copy.test.ts, kept here so tests can check it against samples.

const LABEL_ATTRIBUTES =
  /\b(alt|title|aria-label|aria-description|placeholder)\s*=\s*(["'])(.*?)\2/g
const LETTER = /\p{L}/u

/** Text an .astro template writes out literally instead of taking from src/i18n. */
export function inlineCopy(astro: string): string[] {
  const markup = withoutExpressions(
    astro
      .replace(/^---\n[\s\S]*?\n---\n/, '')
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')
      .replace(/<!--[\s\S]*?-->/g, ''),
  )
  const labels = [...markup.matchAll(LABEL_ATTRIBUTES)]
    .filter((match) => LETTER.test(match[3] ?? ''))
    .map((match) => match[0])
  const text = markup
    .replace(/<[^>]*>/g, '\n')
    .replace(/&[a-z]+;|&#\w+;/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => LETTER.test(line))
  return [...labels, ...text]
}

function withoutExpressions(markup: string): string {
  let out = ''
  let depth = 0
  for (const char of markup) {
    if (char === '{') depth++
    else if (char === '}' && depth > 0) depth--
    else if (depth === 0) out += char
  }
  return out
}
