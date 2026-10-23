import sharp from 'sharp'
import { OG_IMAGE } from '../site.ts'
import { squareSvg } from './icons.ts'
import { themeColors } from './theme-color.ts'

export interface Color {
  hex: string
  alpha: number
}

export interface Backdrop {
  /** CSS gradient angle in degrees. */
  angle: number
  stops: (Color & { offset: number })[]
}

const HEX = /^#([0-9a-f]{6})$/i
const RGB = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/i

/** A colour from Devot's tokens as SVG wants it: six-digit hex and a separate opacity. */
export function cssColor(value: string): Color {
  const text = value.trim()
  const hex = HEX.exec(text)?.[1]
  if (hex) return { hex: `#${hex.toLowerCase()}`, alpha: 1 }
  const rgb = RGB.exec(text)
  if (!rgb) throw new Error(`E_OG_COLOR cannot read the colour ${text}`)
  const channels = rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0'))
  return { hex: `#${channels.join('')}`, alpha: rgb[4] === undefined ? 1 : Number(rgb[4]) }
}

function declaration(css: string, selector: string, property: string): string | undefined {
  const start = css.indexOf(selector)
  if (start < 0) return undefined
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return new RegExp(`${property}:\\s*([^;]+);`).exec(body)?.[1]?.trim()
}

/** A gradient theme's light backdrop, read from Devot's tokens. */
export function backdrop(css: string, theme: string): Backdrop {
  const value = declaration(
    css,
    `:root[data-theme='${theme}'][data-appearance='light']`,
    '--backdrop',
  )
  const gradient = value && /^linear-gradient\((\d+)deg,(.*)\)$/.exec(value)
  if (!gradient) throw new Error(`E_OG_BACKDROP no light --backdrop for the ${theme} theme`)
  const stops = [...(gradient[2] ?? '').matchAll(/(\S+\([^)]*\)|#\w+)\s+([\d.]+)%/g)].map(
    ([, color, offset]) => ({ offset: Number(offset) / 100, ...cssColor(color ?? '') }),
  )
  return { angle: Number(gradient[1]), stops }
}

function rootColor(css: string, token: string): Color {
  const value = declaration(css, ':root {', `--${token}`)
  if (!value) throw new Error(`E_OG_COLOR --${token} is not set in :root`)
  return cssColor(value)
}

/** The start and end of a CSS gradient line at `angle` across a width x height box. */
function gradientLine(angle: number, width: number, height: number) {
  const rad = (angle * Math.PI) / 180
  const [dx, dy] = [Math.sin(rad), -Math.cos(rad)]
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2
  const round = (n: number) => Math.round(n * 10) / 10
  return {
    x1: round(width / 2 - dx * half),
    y1: round(height / 2 - dy * half),
    x2: round(width / 2 + dx * half),
    y2: round(height / 2 + dy * half),
  }
}

const paint = (attribute: 'fill' | 'stop', { hex, alpha }: Color) =>
  attribute === 'fill'
    ? `fill="${hex}" fill-opacity="${alpha}"`
    : `stop-color="${hex}" stop-opacity="${alpha}"`

// The window as the hero shows it: 1024 points wide with 16-point corners, standing on the
// gradient and running off the bottom edge so the card reads as a view into the app.
const WINDOW = { width: 1000, top: 124, radius: 16 }
const MARK = { size: 64, top: 32 }

/**
 * The link-preview image: the app window from the hero poster on Devot's Tide gradient, with the
 * dove above it. Every colour comes from Devot's tokens.
 */
export async function ogImage({
  poster,
  dove,
  tokensCss,
}: {
  poster: Uint8Array
  dove: string
  tokensCss: string
}): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height } = OG_IMAGE
  const left = (width - WINDOW.width) / 2
  const shown = height - WINDOW.top
  const surface = cssColor(themeColors(tokensCss).light)
  const tide = backdrop(tokensCss, 'tide')
  const line = gradientLine(tide.angle, width, height)
  const hairline = rootColor(tokensCss, 'color-line-hairline')
  const shadows = [
    { color: rootColor(tokensCss, 'color-shadow-popover-key'), y: 2, blur: 4, spread: 0 },
    { color: rootColor(tokensCss, 'color-shadow-popover-ambient'), y: 24, blur: 48, spread: -16 },
    { color: rootColor(tokensCss, 'color-shadow-float-bar'), y: 56, blur: 110, spread: -36 },
  ]
  const windowRect = (inset: number, dy = 0) =>
    `x="${left + inset}" y="${WINDOW.top + inset + dy}" width="${WINDOW.width - 2 * inset}" height="${shown + WINDOW.radius * 2}" rx="${WINDOW.radius}"`

  const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="tide" gradientUnits="userSpaceOnUse" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}">
      ${tide.stops.map((stop) => `<stop offset="${stop.offset}" ${paint('stop', stop)}/>`).join('')}
    </linearGradient>
    ${shadows.map(({ blur }, i) => `<filter id="soft${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur / 2}"/></filter>`).join('')}
  </defs>
  <rect width="${width}" height="${height}" ${paint('fill', surface)}/>
  <rect width="${width}" height="${height}" fill="url(#tide)"/>
  ${shadows.map(({ color, y, spread }, i) => `<rect ${windowRect(-spread, y)} ${paint('fill', color)} filter="url(#soft${i})"/>`).join('')}
</svg>`

  const outline = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect ${windowRect(0.5)} fill="none" stroke="${hairline.hex}" stroke-opacity="${hairline.alpha}"/>
</svg>`
  const corners = `<svg xmlns="http://www.w3.org/2000/svg" width="${WINDOW.width}" height="${shown}">
  <rect width="${WINDOW.width}" height="${shown + WINDOW.radius * 2}" rx="${WINDOW.radius}"/>
</svg>`

  const app = await sharp(poster)
    .resize({ width: WINDOW.width })
    .extract({ left: 0, top: 0, width: WINDOW.width, height: shown })
    .composite([{ input: Buffer.from(corners), blend: 'dest-in' }])
    .png()
    .toBuffer()
  const mark = await sharp(Buffer.from(squareSvg(dove)))
    .resize(MARK.size, MARK.size, { fit: 'contain', background: 'transparent' })
    .png()
    .toBuffer()

  const png = await sharp(Buffer.from(scene))
    .composite([
      { input: app, left, top: WINDOW.top },
      { input: Buffer.from(outline), left: 0, top: 0 },
      { input: mark, left: (width - MARK.size) / 2, top: MARK.top },
    ])
    .flatten({ background: surface.hex })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return new Uint8Array(png)
}
