import sharp from 'sharp'

const SVG_TAG = /<svg\b[^>]*>/

/** The image with its viewBox padded to a square around the original, for icons that must be 1:1. */
export function squareSvg(svg: string): string {
  const tag = SVG_TAG.exec(svg)?.[0] ?? ''
  const box = /\bviewBox="([^"]+)"/
    .exec(tag)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (box?.length !== 4 || box.some((n) => !Number.isFinite(n)))
    throw new Error('E_ICON_VIEWBOX the <svg> needs a viewBox of four numbers')
  const [x, y, width, height] = box as [number, number, number, number]
  const side = Math.max(width, height)
  const square = [x - (side - width) / 2, y - (side - height) / 2, side, side].join(' ')
  const sizes = ['width', 'height'].map((name) =>
    Number(new RegExp(`(?<![\\w-])${name}="([^"]+)"`).exec(tag)?.[1]),
  )
  const pixels = Math.max(...sizes.filter(Number.isFinite))
  const squared = tag
    .replace(/\bviewBox="[^"]*"/, `viewBox="${square}"`)
    .replace(/(?<![\w-])width="[^"]*"/, `width="${pixels}"`)
    .replace(/(?<![\w-])height="[^"]*"/, `height="${pixels}"`)
  return svg.replace(tag, squared)
}

// Devot's app icons draw their tile on the macOS grid: 824 px, 100 px in from each edge of a
// 1024 px canvas. A browser tab has no room for that margin.
const CANVAS = '0 0 1024 1024'
const TILE = { at: 100, side: 824 }

/** One of Devot's app icons cropped to its tile. */
export function tileSvg(svg: string): string {
  const tag = SVG_TAG.exec(svg)?.[0] ?? ''
  if (!tag.includes(`viewBox="${CANVAS}"`))
    throw new Error(`E_ICON_VIEWBOX an app icon needs viewBox="${CANVAS}"`)
  const cropped = tag
    .replace(`viewBox="${CANVAS}"`, `viewBox="${TILE.at} ${TILE.at} ${TILE.side} ${TILE.side}"`)
    .replace(/(?<![\w-])width="[^"]*"/, `width="${TILE.side}"`)
    .replace(/(?<![\w-])height="[^"]*"/, `height="${TILE.side}"`)
  return svg.replace(tag, cropped)
}

/** A square PNG of an SVG, the mark `inset` pixels from each edge, over `background` if given. */
export async function iconPng(
  svg: string,
  {
    size,
    inset = 0,
    background = 'transparent',
  }: { size: number; inset?: number; background?: string },
): Promise<Uint8Array<ArrayBuffer>> {
  const side = size - 2 * inset
  const mark = await sharp(Buffer.from(svg))
    .resize(side, side, { fit: 'contain', background: 'transparent' })
    .png()
    .toBuffer()
  const png = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer()
  return new Uint8Array(png)
}
