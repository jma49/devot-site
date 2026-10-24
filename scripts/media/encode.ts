import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import sharp from 'sharp'

export type Codec = 'h264' | 'av1' | 'vp9'

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

/** The frame outside `rect` painted one colour (hex, no #), so it costs the encoder nothing. */
export interface Fill {
  rect: PixelRect
  color: string
}

export interface ClipInput {
  /** Folder of numbered PNG frames (frameFile). */
  frames: string
  count: number
  fps: number
  /** Seconds at the end that cross-fade into the first frame; 0 when the clip ends where it starts. */
  fade: number
  width: number
  height: number
  /** The part of each frame the clip shows, in frame pixels; all of it when absent. */
  crop?: PixelRect
  fill?: Fill
}

export const frameFile = (dir: string, index: number) =>
  join(dir, `${String(index).padStart(5, '0')}.png`)

/** CRF each codec starts from; withinBudget raises it until the file fits. */
export const START_QUALITY: Record<Codec, number> = { h264: 27, av1: 46, vp9: 36 }

const CODEC_ARGS: Record<Codec, (quality: number, fps: number) => string[]> = {
  h264: (q) => [
    ...['-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', String(q)],
    ...['-profile:v', 'high', '-movflags', '+faststart'],
  ],
  av1: (q, fps) => [
    ...['-c:v', 'libsvtav1', '-preset', '4', '-crf', String(q), '-g', String(fps * 10)],
    ...['-svtav1-params', 'scm=1'],
  ],
  vp9: (q) => [
    ...['-c:v', 'libvpx-vp9', '-crf', String(q), '-b:v', '0'],
    ...['-deadline', 'good', '-cpu-used', '1', '-row-mt', '1'],
  ],
}

/** ffmpeg arguments that encode a clip's frames for one codec. */
export function videoArgs(clip: ClipInput, codec: Codec, quality: number, out: string): string[] {
  const { frames, count, fps, fade, width, height, crop, fill } = clip
  const input = ['-framerate', String(fps), '-i', join(frames, '%05d.png')]
  const cut = crop ? `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},` : ''
  const right = fill && fill.rect.x + fill.rect.width
  const below = fill && fill.rect.y + fill.rect.height
  const painted = fill
    ? `drawbox=x=${right}:y=0:w=iw-${right}:h=ih:color=0x${fill.color}:t=fill,` +
      `drawbox=x=0:y=${below}:w=iw:h=ih-${below}:color=0x${fill.color}:t=fill,`
    : ''
  // Screenshots are sRGB: convert with the BT.709 matrix and say so, or players shift the colours.
  const scale =
    `${cut}${painted}scale=${width}:${height}:flags=lanczos:out_color_matrix=bt709:out_range=tv,` +
    'setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p'
  const loop =
    fade > 0
      ? [
          ...['-loop', '1', '-framerate', String(fps), '-t', String(fade + 0.1)],
          ...['-i', frameFile(frames, 0)],
        ]
      : []
  const offset = (count / fps - fade).toFixed(3)
  const graph =
    fade > 0
      ? `[0:v]settb=AVTB,fps=${fps}[a];[1:v]settb=AVTB,fps=${fps}[b];` +
        `[a][b]xfade=transition=fade:duration=${fade}:offset=${offset},${scale}[v]`
      : `[0:v]${scale}[v]`
  const colour = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
  return [
    ...['-y', '-hide_banner', '-loglevel', 'error', ...input, ...loop],
    ...['-filter_complex', graph, '-map', '[v]', '-frames:v', String(count), '-an'],
    ...[...colour, '-color_range', 'tv', '-pix_fmt', 'yuv420p'],
    ...CODEC_ARGS[codec](quality, fps),
    out,
  ]
}

/** Tries `encode` from `start`, a step at a time, until the result is under `budget` bytes. */
export async function withinBudget(
  encode: (quality: number) => Promise<number>,
  { start, step, last, budget }: { start: number; step: number; last: number; budget: number },
): Promise<{ quality: number; bytes: number }> {
  let bytes = 0
  for (let quality = start; quality <= last; quality += step) {
    bytes = await encode(quality)
    if (bytes < budget) return { quality, bytes }
  }
  throw new Error(`E_MEDIA_BUDGET ${bytes} bytes at quality ${last}, budget ${budget}`)
}

/** The frame a poster is taken from: the one at `time`, or the last when the clip is shorter. */
export const posterFrame = ({ count, fps }: { count: number; fps: number }, time: number) =>
  Math.min(count - 1, Math.round(time * fps))

/** A frame cut and filled as `videoArgs` does it, so a poster matches its clip. */
export async function cutFrame(
  png: Buffer | string,
  { crop, fill }: { crop?: PixelRect; fill?: Fill },
): Promise<Buffer> {
  let image = sharp(png)
  if (crop) {
    image = image.extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
  }
  if (fill) {
    const { width = 0, height = 0 } = await sharp(png).metadata()
    const colour = `#${fill.color}`
    const right = fill.rect.x + fill.rect.width
    const below = fill.rect.y + fill.rect.height
    const block = (w: number, h: number) =>
      sharp({ create: { width: w, height: h, channels: 3, background: colour } })
        .png()
        .toBuffer()
    const blocks = []
    if (right < width)
      blocks.push({ input: await block(width - right, height), left: right, top: 0 })
    if (below < height)
      blocks.push({ input: await block(width, height - below), left: 0, top: below })
    image = image.composite(blocks)
  }
  return image.removeAlpha().png().toBuffer()
}

/** The frame as a WebP at the slot size, at the best quality under `maxBytes`. */
export async function fitPoster(
  png: Buffer | string,
  { width, height, maxBytes }: { width: number; height: number; maxBytes: number },
): Promise<{ data: Buffer; quality: number }> {
  const resized = await sharp(png)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer()
  let smallest = Infinity
  for (let quality = 86; quality >= 30; quality -= 4) {
    const data = await sharp(resized).webp({ quality, effort: 6, smartSubsample: true }).toBuffer()
    if (data.length < maxBytes) return { data, quality }
    smallest = Math.min(smallest, data.length)
  }
  throw new Error(`E_MEDIA_POSTER smallest ${smallest} bytes, budget ${maxBytes}`)
}

export const FFMPEG = process.env['FFMPEG'] ?? 'ffmpeg'

export function ffmpeg(args: string[]): void {
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] })
}
