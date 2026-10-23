/** Generated from devot, and the one site file that may name raw values. */
export const GENERATED_TOKENS = 'src/theme/tokens.css'
export const SITE_TOKENS = 'src/styles/site-tokens.css'

const CODE = /\.(astro|css|scss|ts|tsx|mts|cts|js|mjs|cjs|jsx|md|mdx|html)$/
const STYLESHEET = /\.s?css$/

export function isColorChecked(path: string): boolean {
  return CODE.test(path) && path !== GENERATED_TOKENS && path !== SITE_TOKENS
}

// CSS Color 4 named colours; transparent and currentColor are allowed.
const NAMED = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen
darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink
indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral
lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
whitesmoke yellow yellowgreen`.split(/\s+/)

const SYSTEM = `accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas
canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem
selecteditemtext visitedtext`.split(/\s+/)

export const NAMED_COLORS: readonly string[] = NAMED

const ANY_NAME = [...NAMED, ...SYSTEM].join('|')

const HEX_OR_FUNCTION = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
// A colour word anywhere in a declaration's value; the guards keep var(--color-tag-red), class
// names, paths and white-space out, and the lookahead skips selectors such as `a:hover .red {`.
const DECLARATION = new RegExp(
  `(?:^|[;{])\\s*[\\w-]+\\s*:(?![^;{}]*\\{)[^;{}]*?(?<![\\w$.#/-])(${ANY_NAME})(?![\\w.-])`,
  'dgim',
)
// A colour property or attribute set to a colour word, in CSS, a style object or markup.
const COLOR_PROPERTY = new RegExp(
  `(?<![\\w$-])(?:[\\w-]*colou?r|background|fill|stroke|border|outline)['"]?\\s*[:=]\\s*\\{?\\s*['"\`]?(?:${ANY_NAME})(?![\\w-])`,
  'i',
)
// A string that is exactly a colour name, unless it names a class or an id. Lower case only: a
// capitalised string is a label.
const QUOTED_NAME = new RegExp(
  `(?<!\\b(?:class|className|id)\\s*=\\s*)['"\`](?:${NAMED.join('|')})['"\`]`,
)

/** Lines of a file that write out a colour, as `<line>: <text>`. */
export function colorLiterals(path: string, text: string): string[] {
  const lines = text.split('\n')
  const hits = new Set<number>()
  lines.forEach((line, i) => {
    if (HEX_OR_FUNCTION.test(line) || COLOR_PROPERTY.test(line) || QUOTED_NAME.test(line))
      hits.add(i)
  })
  for (const match of stylesIn(path, text).matchAll(DECLARATION)) {
    const start = match.indices?.[1]?.[0] ?? 0
    hits.add(text.slice(0, start).split('\n').length - 1)
  }
  return [...hits].toSorted((a, b) => a - b).map((i) => `${i + 1}: ${(lines[i] ?? '').trim()}`)
}

/** The CSS in a file, at its original offsets, with everything else and comments blanked. */
function stylesIn(path: string, text: string): string {
  const keep = new Array<boolean>(text.length).fill(STYLESHEET.test(path))
  if (!STYLESHEET.test(path)) {
    for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/dg)) {
      const [start, end] = match.indices?.[1] ?? [0, 0]
      keep.fill(true, start, end)
    }
  }
  for (const match of text.matchAll(/\/\*[\s\S]*?\*\//g)) {
    keep.fill(false, match.index, match.index + match[0].length)
  }
  return text
    .split('')
    .map((unit, i) => (keep[i] || unit === '\n' ? unit : ' '))
    .join('')
}

/** Custom properties a stylesheet defines (`--name:`) and reads (`var(--name`). */
export function customProperties(text: string): { defined: string[]; used: string[] } {
  const names = (pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1] as string)
  return {
    defined: names(/(--[\w-]+)\s*:/g),
    used: names(/var\(\s*(--[\w-]+)/g),
  }
}
