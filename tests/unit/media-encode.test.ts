import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  fitPoster,
  frameFile,
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

it('numbers frames with five digits', () => {
  expect(frameFile('/work/hero', 7)).toBe('/work/hero/00007.png')
})
