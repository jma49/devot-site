// Theme files for the official theme plugins: every color token of Devot's own theme for the appearance,
// drawn again from a palette. Grays move along the palette's grays, with Devot's editor ground and ink landing
// on the palette's; colors take the palette hue nearest theirs at the lightness Devot gave them.
import type { Palette, ThemeFamily } from './palettes.ts'

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** The block of `src/theme/tokens.css` that holds Devot's own theme for each appearance. */
const BLOCKS = {
  light: ":root[data-appearance='light'], [data-appearance-preview='light'] {",
  dark: ":root[data-appearance='dark'], [data-appearance-preview='dark'] {",
} as const

/** Icons keep Devot's colors in every theme, as Devot itself does: a status or a settings pane reads the same in all. */
export const isIconColor = (token: string): boolean =>
  /^(?:icon-tile-|tag-icon-|phone-status-tile-)/.test(token) || /^status-[a-z]+-mark$/.test(token)

/** Tokens a theme leaves to Devot: a QR code stays dark on light to scan, and icons keep their colors. */
const isKept = (token: string): boolean =>
  token === 'qr-ground' || token === 'qr-module' || isIconColor(token)

/** Tokens that take the palette's accent whatever color Devot gives them. */
const ACCENTED = new Set([
  'editor-caret',
  'editor-completion-selected',
  'fill-row-selected-unemphasized',
])

/** Ink drawn on a fill: the palette's lightest or darkest gray, whichever reads better on that fill. */
const ON_FILL: Readonly<Record<string, string>> = {
  'accent-on-fill': 'accent-fill',
  'text-on-destructive': 'fill-destructive',
  'phone-on-action': 'phone-action-trash',
}

/** Under this spread of channels a color counts as gray. */
const GRAY_CHROMA = 0.15
/** Within this many L* of a palette hue a color takes the hue as it is. */
const SAME_LIGHTNESS = 30
/** WCAG AA for body text. */
const MIN_TEXT_CONTRAST = 4.5

export class ThemeTokensError extends Error {}

export function parseColor(value: string): Rgba {
  const fallback = /^var\(--[\w-]+,\s*(.+)\)$/.exec(value)
  if (fallback) return parseColor(fallback[1]!)
  const hexValue = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value)
  if (hexValue) {
    const n = Number.parseInt(hexValue[1]!, 16)
    const a = hexValue[2] === undefined ? 1 : Number.parseInt(hexValue[2], 16) / 255
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a }
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(value)
  if (rgb) {
    const [, r, g, b, a] = rgb
    return { r: Number(r), g: Number(g), b: Number(b), a: a === undefined ? 1 : Number(a) }
  }
  throw new ThemeTokensError(`E_THEME_TOKEN_FORMAT ${value}`)
}

/** Devot's color tokens for an appearance, by the name a theme file uses (after `--color-`). */
export function devotTokens(css: string, appearance: 'light' | 'dark'): Map<string, Rgba> {
  const start = css.indexOf(BLOCKS[appearance])
  if (start < 0) throw new ThemeTokensError(`E_THEME_TOKENS_BLOCK ${appearance}`)
  const block = css.slice(start, css.indexOf('\n}', start))
  const raw = new Map<string, string>()
  for (const [, name, value] of block.matchAll(/^\s*--color-([\w-]+):\s*(.+);$/gm))
    raw.set(name!, value!.trim())
  const resolve = (value: string, depth = 0): Rgba => {
    const ref = /^var\(--color-([\w-]+)\)$/.exec(value)
    if (!ref) return parseColor(value)
    const target = raw.get(ref[1]!)
    if (target === undefined || depth > 8) throw new ThemeTokensError(`E_THEME_TOKEN_REF ${value}`)
    return resolve(target, depth + 1)
  }
  return new Map([...raw].map(([name, value]) => [name, resolve(value)]))
}

const linear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export const luminance = ({ r, g, b }: Rgba) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

/** CIE L*, 0 to 100. */
export function lightness(color: Rgba): number {
  const y = luminance(color)
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const chroma = ({ r, g, b }: Rgba) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255

function hue({ r, g, b }: Rgba): number {
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

const mix = (from: Rgba, to: Rgba, t: number): Rgba => ({
  r: from.r + (to.r - from.r) * t,
  g: from.g + (to.g - from.g) * t,
  b: from.b + (to.b - from.b) * t,
  a: from.a,
})

/** As the theme file will hold it, so a contrast checked here is the one drawn. */
const rounded = ({ r, g, b, a }: Rgba): Rgba => ({
  r: Math.round(r),
  g: Math.round(g),
  b: Math.round(b),
  a,
})

const withAlpha = (color: Rgba, a: number): Rgba => ({ ...color, a })

export function hex({ r, g, b, a }: Rgba): string {
  const byte = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}${a >= 1 ? '' : byte(a * 255)}`
}

/** The point of a piecewise-linear map through `points` (sorted by x) at `x`, flat beyond its ends. */
function along(points: readonly (readonly [number, number])[], x: number): number {
  const first = points[0]!
  const last = points.at(-1)!
  if (x <= first[0]) return first[1]
  if (x >= last[0]) return last[1]
  const i = points.findIndex(([px]) => px >= x)
  const [x0, y0] = points[i - 1]!
  const [x1, y1] = points[i]!
  return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

/** The palette's grays as one ramp by lightness. */
function ramp(palette: Palette) {
  const stops = palette.neutrals
    .map(parseColor)
    .map((color) => ({ color, l: lightness(color) }))
    .sort((a, b) => a.l - b.l)
  const at = (l: number): Rgba => {
    if (l <= stops[0]!.l) return stops[0]!.color
    const i = stops.findIndex((s) => s.l >= l)
    if (i < 0) return stops.at(-1)!.color
    const lo = stops[i - 1]!
    const hi = stops[i]!
    return mix(lo.color, hi.color, hi.l === lo.l ? 1 : (l - lo.l) / (hi.l - lo.l))
  }
  return { darkest: stops[0]!.color, lightest: stops.at(-1)!.color, at }
}

/** The color between `base` and `end` whose L* is `target`. */
function toLightness(base: Rgba, end: Rgba, target: number): Rgba {
  let [lo, hi] = [0, 1]
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2
    const l = lightness(mix(base, end, t))
    if (Math.abs(l - target) < 0.05) return mix(base, end, t)
    if (l > target === lightness(end) > lightness(base)) hi = t
    else lo = t
  }
  return mix(base, end, (lo + hi) / 2)
}

/** `color` moved toward `end` just far enough to read at `need`:1 against `against`. */
function untilContrast(color: Rgba, against: Rgba, need: number, end: Rgba): Rgba {
  if (contrast(rounded(color), against) >= need) return color
  let [lo, hi] = [0, 1]
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2
    if (contrast(rounded(mix(color, end, t)), against) >= need) hi = t
    else lo = t
  }
  return rounded(mix(color, end, hi))
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** The colors of a palette, by token, drawn from Devot's own theme for its appearance. */
export function themeColors(
  devot: ReadonlyMap<string, Rgba>,
  palette: Palette,
): Record<string, string> {
  const grays = ramp(palette)
  const anchor = (name: string) => {
    const color = devot.get(name)
    if (!color) throw new ThemeTokensError(`E_THEME_TOKEN_MISSING ${name}`)
    return lightness(color)
  }
  const devotGrays = [...devot.entries()]
    .filter(([name, c]) => !isKept(name) && c.a === 1 && chroma(c) < GRAY_CHROMA)
    .map(([, c]) => lightness(c))
  // Devot's editor ground and ink land on the palette's; its darkest and lightest grays on the ramp's ends.
  const anchors = [
    [anchor('surface-editor'), lightness(parseColor(palette.background))],
    [anchor('text-editor'), lightness(parseColor(palette.text))],
  ].sort((a, b) => a[0]! - b[0]!) as [number, number][]
  const [low, high] = [Math.min(...devotGrays), Math.max(...devotGrays)]
  const points: [number, number][] = [
    ...(low < anchors[0]![0] ? [[low, lightness(grays.darkest)] as [number, number]] : []),
    ...anchors,
    ...(high > anchors[1]![0] ? [[high, lightness(grays.lightest)] as [number, number]] : []),
  ]
  const hues = palette.hues.map(parseColor)
  const accent = parseColor(palette.accent)

  const draw = (name: string, color: Rgba): Rgba => {
    const accented = ACCENTED.has(name) || (name.startsWith('accent-') && !(name in ON_FILL))
    if (!accented && chroma(color) < GRAY_CHROMA) {
      return withAlpha(grays.at(along(points, lightness(color))), color.a)
    }
    const h = hue(color)
    const source = accented
      ? accent
      : hues.reduce((best, c) => (hueDistance(hue(c), h) < hueDistance(hue(best), h) ? c : best))
    if (color.a < 1) return withAlpha(source, color.a)
    const target = lightness(color)
    if (Math.abs(lightness(source) - target) <= SAME_LIGHTNESS) return source
    const end = target < lightness(source) ? grays.darkest : grays.lightest
    return toLightness(source, end, target)
  }

  const drawn = new Map<string, Rgba>()
  for (const [name, color] of devot) if (!isKept(name)) drawn.set(name, rounded(draw(name, color)))

  // An opaque color reads on the editor ground at least as well as Devot's does, up to 4.5:1.
  const ground = drawn.get('surface-editor')!
  const devotGround = devot.get('surface-editor')!
  const away = lightness(ground) > 50 ? grays.darkest : grays.lightest
  for (const [name, color] of drawn) {
    if (color.a < 1 || name in ON_FILL) continue
    const need = Math.min(contrast(devot.get(name)!, devotGround), MIN_TEXT_CONTRAST)
    drawn.set(name, untilContrast(color, ground, need, away))
  }

  // Ink on a fill takes the palette end that reads better, and the fill gives way until it reads at 4.5:1.
  for (const [ink, fill] of Object.entries(ON_FILL)) {
    const under = drawn.get(fill)
    if (!drawn.has(ink) || !under) continue
    const [light, dark] = [grays.lightest, grays.darkest]
    const chosen = contrast(light, under) >= contrast(dark, under) ? light : dark
    drawn.set(ink, chosen)
    drawn.set(
      fill,
      untilContrast(under, chosen, MIN_TEXT_CONTRAST, chosen === light ? dark : light),
    )
  }
  return Object.fromEntries(
    [...drawn].sort(([a], [b]) => (a < b ? -1 : 1)).map(([n, c]) => [n, hex(c)]),
  )
}

/** Every theme file of every family, by path under the repository root. */
export function themeFiles(css: string, families: readonly ThemeFamily[]): Map<string, string> {
  const devot = { light: devotTokens(css, 'light'), dark: devotTokens(css, 'dark') }
  const files = new Map<string, string>()
  for (const family of families)
    for (const palette of family.palettes) {
      const colors = themeColors(devot[palette.appearance], palette)
      files.set(
        `plugins/${family.folder}/${palette.id}.json`,
        `${JSON.stringify({ colors }, null, 2)}\n`,
      )
    }
  return files
}
