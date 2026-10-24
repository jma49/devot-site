import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  cutFrame,
  fitPoster,
  frameFile,
  posterFrame,
  videoArgs,
  withinBudget,
  type ClipInput,
} from '../../scripts/media/encode.ts'

const clip: ClipInput = {
  frames: '/work/card-1',
  count: 180,
  fps: 30,
  fade: 0.5,
  width: 1720,
  height: 1080,
}

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

describe('videoArgs', () => {
  it('reads the numbered frames at the clip rate and writes the output last', () => {
    const args = videoArgs(clip, 'h264', 23, '/out/card-1.mp4')
    expect(after(args, '-framerate')).toBe('30')
    expect(args).toContain('/work/card-1/%05d.png')
    expect(after(args, '-frames:v')).toBe('180')
    expect(args.at(-1)).toBe('/out/card-1.mp4')
    expect(args).toContain('-an')
  })

  it('cross-fades the last frames into the first, so the loop has no seam', () => {
    const graph = after(videoArgs(clip, 'av1', 38, 'x.webm'), '-filter_complex')!
    expect(graph).toContain('xfade=transition=fade:duration=0.5:offset=5.500')
    expect(videoArgs(clip, 'av1', 38, 'x.webm')).toContain('/work/card-1/00000.png')
  })

  it('leaves out the cross-fade when the clip ends where it starts', () => {
    const args = videoArgs({ ...clip, fade: 0 }, 'h264', 23, 'x.mp4')
    expect(after(args, '-filter_complex')).not.toContain('xfade')
    expect(args).not.toContain('/work/card-1/00000.png')
  })

  it('scales to the slot size and tags BT.709 so players keep the colours', () => {
    const args = videoArgs(clip, 'h264', 23, 'x.mp4')
    expect(after(args, '-filter_complex')).toContain('scale=1720:1080:flags=lanczos')
    expect(after(args, '-colorspace')).toBe('bt709')
    expect(after(args, '-pix_fmt')).toBe('yuv420p')
  })

  it('cuts a part of the frames before scaling, for the closer phone clip', () => {
    const graph = after(
      videoArgs({ ...clip, crop: { x: 0, y: 40, width: 800, height: 500 } }, 'av1', 40, 'x.webm'),
      '-filter_complex',
    )!
    expect(graph).toContain('crop=800:500:0:40,scale=1720:1080')
  })

  it('fills the frame outside a part with one colour, keeping its size', () => {
    const fill = { rect: { x: 0, y: 0, width: 1200, height: 900 }, color: '1a2b3c' }
    const graph = after(videoArgs({ ...clip, fill }, 'h264', 26, 'x.mp4'), '-filter_complex')!
    expect(graph).toContain(
      'drawbox=x=1200:y=0:w=iw-1200:h=ih:color=0x1a2b3c:t=fill,' +
        'drawbox=x=0:y=900:w=iw:h=ih-900:color=0x1a2b3c:t=fill,scale=1720:1080',
    )
  })

  it('uses H.264 with the index first for MP4, and AV1 or VP9 for WebM', () => {
    const mp4 = videoArgs(clip, 'h264', 24, 'x.mp4')
    expect(after(mp4, '-c:v')).toBe('libx264')
    expect(after(mp4, '-crf')).toBe('24')
    expect(after(mp4, '-movflags')).toBe('+faststart')
    expect(after(videoArgs(clip, 'av1', 40, 'x.webm'), '-c:v')).toBe('libsvtav1')
    const vp9 = videoArgs(clip, 'vp9', 36, 'x.webm')
    expect(after(vp9, '-c:v')).toBe('libvpx-vp9')
    expect(after(vp9, '-b:v')).toBe('0')
  })
})

describe('withinBudget', () => {
  it('keeps the first quality that fits', async () => {
    const tried: number[] = []
    const result = await withinBudget(
      async (q) => {
        tried.push(q)
        return 1000 - q * 10
      },
      { start: 23, step: 2, last: 33, budget: 760 },
    )
    expect(tried).toEqual([23, 25])
    expect(result).toEqual({ quality: 25, bytes: 750 })
  })

  it('fails with a code when even the last quality is over budget', async () => {
    await expect(
      withinBudget(async () => 900, { start: 23, step: 2, last: 27, budget: 800 }),
    ).rejects.toThrow(/^E_MEDIA_BUDGET/)
  })
})

describe('fitPoster', () => {
  it('writes a WebP at the slot size under the byte budget', async () => {
    const noise = Buffer.alloc(400 * 300 * 3)
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24
    const png = await sharp(noise, { raw: { width: 400, height: 300, channels: 3 } })
      .png()
      .toBuffer()
    const generous = await fitPoster(png, { width: 200, height: 150, maxBytes: 200_000 })
    const tight = await fitPoster(png, { width: 200, height: 150, maxBytes: 9_000 })
    const meta = await sharp(tight.data).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 200, 150])
    expect(tight.data.length).toBeLessThan(9_000)
    expect(tight.quality).toBeLessThan(generous.quality)
  })

  it('fails with a code when no quality fits', async () => {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 9, g: 99, b: 199 } },
    })
      .png()
      .toBuffer()
    await expect(fitPoster(png, { width: 64, height: 64, maxBytes: 10 })).rejects.toThrow(
      /^E_MEDIA_POSTER/,
    )
  })
})

describe('posterFrame', () => {
  it('takes the frame at the poster time, within the clip', () => {
    expect(posterFrame({ count: 240, fps: 30 }, 3.2)).toBe(96)
    expect(posterFrame({ count: 240, fps: 30 }, 0)).toBe(0)
    expect(posterFrame({ count: 240, fps: 30 }, 9)).toBe(239)
  })
})

describe('cutFrame', () => {
  const frame = () =>
    sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 10, b: 10 } } })
      .png()
      .toBuffer()

  it('cuts a part of a frame', async () => {
    const part = await cutFrame(await frame(), { crop: { x: 4, y: 2, width: 10, height: 8 } })
    const meta = await sharp(part).metadata()
    expect([meta.width, meta.height]).toEqual([10, 8])
  })

  it('fills the rest of a frame with the colour, as the video does', async () => {
    const filled = await cutFrame(await frame(), {
      fill: { rect: { x: 0, y: 0, width: 20, height: 10 }, color: '0a141e' },
    })
    const { data, info } = await sharp(filled).raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => [
      ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
    ]
    expect([info.width, info.height]).toEqual([40, 20])
    expect(at(5, 5)).toEqual([200, 10, 10])
    expect(at(30, 5)).toEqual([10, 20, 30])
    expect(at(5, 15)).toEqual([10, 20, 30])
  })
})

it('numbers frames with five digits', () => {
  expect(frameFile('/work/hero', 7)).toBe('/work/hero/00007.png')
})
