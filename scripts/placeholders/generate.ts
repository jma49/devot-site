import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { themeColors } from '../../src/lib/theme-color.ts'
import { slotPaths, type MediaSlot } from '../../src/media.ts'

export interface Palette {
  backdrop: string
  window: string
  sidebar: string
  ink: string
}

/** Light-scheme values of Devot's own surface and text tokens. */
export function paletteFrom(tokensCss: string): Palette {
  const light = (token: string) => themeColors(tokensCss, token).light
  return {
    backdrop: light('color-surface-list'),
    window: light('color-surface-editor'),
    sidebar: light('color-surface-sidebar-opaque'),
    ink: light('color-text-tertiary'),
  }
}

/** A neutral window drawn from tokens: sidebar, list column and a few lines of text. */
export function posterSvg(width: number, height: number, palette: Palette): string {
  const unit = Math.min(width, height) / 100
  const x = width * 0.04
  const y = height * 0.07
  const w = width * 0.92
  const h = height * 1.2
  const sidebar = w * 0.24
  const list = w * 0.3
  const line = (index: number, length: number, offset: number) =>
    `<rect x="${x + sidebar + list + w * 0.05}" y="${y + height * offset + index * unit * 6}" width="${w * length}" height="${unit * 2}" rx="${unit}" fill="${palette.ink}" fill-opacity="0.22"/>`
  const rows = [0, 1, 2, 3, 4, 5].map(
    (index) =>
      `<rect x="${x + sidebar + w * 0.03}" y="${y + height * 0.14 + index * unit * 10}" width="${list - w * 0.06}" height="${unit * 7}" rx="${unit * 1.5}" fill="${palette.ink}" fill-opacity="${index === 1 ? 0.16 : 0.07}"/>`,
  )
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${palette.backdrop}"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${unit * 3}" fill="${palette.window}" stroke="${palette.ink}" stroke-opacity="0.25" stroke-width="${unit * 0.4}"/>`,
    `<path d="M${x} ${y + unit * 3}a${unit * 3} ${unit * 3} 0 0 1 ${unit * 3} -${unit * 3}h${sidebar - unit * 3}v${h}h-${sidebar}z" fill="${palette.sidebar}"/>`,
    ...rows,
    ...[0, 1, 2, 3, 4].map((index) =>
      line(index, index === 0 ? 0.3 : 0.38 - (index % 3) * 0.04, 0.16),
    ),
    '</svg>',
  ].join('')
}

export function renderPoster(slot: MediaSlot, palette: Palette): Promise<Buffer> {
  return sharp(Buffer.from(posterSvg(slot.width, slot.height, palette)))
    .webp({ quality: 60, effort: 6 })
    .toBuffer()
}

export type Format = 'mp4' | 'webm'

/** The ffmpeg arguments that loop a poster into a tiny clip of `slot.duration` seconds. */
export function ffmpegArgs(poster: string, out: string, slot: MediaSlot, format: Format): string[] {
  const input = ['-y', '-loop', '1', '-framerate', '10', '-i', poster, '-t', String(slot.duration)]
  const codec =
    format === 'mp4'
      ? ['-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'stillimage', '-crf', '36']
      : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '50', '-row-mt', '1']
  const container = format === 'mp4' ? ['-movflags', '+faststart'] : []
  return [...input, '-an', ...codec, '-pix_fmt', 'yuv420p', ...container, out]
}

export interface GenerateOptions {
  publicDir: string
  palette: Palette
  slots: MediaSlot[]
  /** Replace files that exist; by default real captures are left alone. */
  force?: boolean
  /** Runs ffmpeg with these arguments. */
  encode: (args: string[]) => void
}

/** Writes the missing poster and clips of every slot and returns the site paths it wrote. */
export async function generatePlaceholders(options: GenerateOptions): Promise<string[]> {
  const written: string[] = []
  const wanted = (file: string) => options.force || !existsSync(join(options.publicDir, file))
  for (const slot of options.slots) {
    const paths = slotPaths(slot.name)
    const target = (file: string) => join(options.publicDir, file)
    mkdirSync(dirname(target(paths.poster)), { recursive: true })
    if (wanted(paths.poster)) {
      writeFileSync(target(paths.poster), await renderPoster(slot, options.palette))
      written.push(paths.poster)
    }
    for (const format of ['mp4', 'webm'] as const) {
      if (!wanted(paths[format])) continue
      options.encode(ffmpegArgs(target(paths.poster), target(paths[format]), slot, format))
      written.push(paths[format])
    }
  }
  return written
}
