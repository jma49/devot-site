import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { backdrop, cssColor, ogImage } from '../../src/lib/og-image.ts'
import { OG_IMAGE } from '../../src/site.ts'
import { pngSize } from '../support/png.ts'

const repo = join(import.meta.dirname, '../..')
const tokensCss = readFileSync(join(repo, 'src/theme/tokens.css'), 'utf8')

const SAMPLE = `:root {
  --color-surface-editor: #ffffff;
}
:root[data-theme='tide'][data-appearance='dark'] {
  --backdrop: linear-gradient(160deg, rgb(34 49 77 / 0.6) 0%, rgb(48 40 73 / 0.6) 100%);
}
:root[data-theme='tide'][data-appearance='light'], [data-theme-preview='tide'] {
  --backdrop: linear-gradient(160deg, rgb(205 223 249 / 0.7) 0%, rgb(230 233 248 / 0.7) 50%, rgb(224 214 245 / 0.7) 100%);
}
`

describe('cssColor', () => {
  it('reads hex and space-separated rgb() with or without alpha', () => {
    expect(cssColor('#13786d')).toEqual({ hex: '#13786d', alpha: 1 })
    expect(cssColor('rgb(0 0 0 / 0.12)')).toEqual({ hex: '#000000', alpha: 0.12 })
    expect(cssColor('rgb(205 223 249)')).toEqual({ hex: '#cddff9', alpha: 1 })
  })

  it('refuses what it cannot read instead of guessing', () => {
    expect(() => cssColor('var(--x)')).toThrow(/^E_OG_COLOR /)
  })
})

describe('backdrop', () => {
  it("reads a theme's light gradient: its angle and its stops", () => {
    expect(backdrop(SAMPLE, 'tide')).toEqual({
      angle: 160,
      stops: [
        { offset: 0, hex: '#cddff9', alpha: 0.7 },
        { offset: 0.5, hex: '#e6e9f8', alpha: 0.7 },
        { offset: 1, hex: '#e0d6f5', alpha: 0.7 },
      ],
    })
  })

  it("finds Tide in Devot's tokens", () => {
    expect(backdrop(tokensCss, 'tide').stops.length).toBeGreaterThanOrEqual(2)
  })

  it('fails the build with E_OG_BACKDROP for a theme the tokens lack', () => {
    expect(() => backdrop(SAMPLE, 'dusk')).toThrow(/^E_OG_BACKDROP /)
  })
})

describe('ogImage', () => {
  const poster = async () =>
    sharp({
      create: { width: 2048, height: 1280, channels: 3, background: { r: 40, g: 120, b: 200 } },
    })
      .webp()
      .toBuffer()
  const dove =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><path d="M0 0h10v10H0z" fill="currentColor"/></svg>'

  it('renders a PNG at the size the page announces', async () => {
    const png = await ogImage({ poster: await poster(), dove, tokensCss })
    expect(pngSize(png)).toEqual({ width: OG_IMAGE.width, height: OG_IMAGE.height })
  })

  it('shows the app window over the gradient, cut off at the bottom edge', async () => {
    const png = await ogImage({ poster: await poster(), dove, tokensCss })
    const { data, info } = await sharp(png)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const pixel = (x: number, y: number) => [
      ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
    ]
    const app = [40, 120, 200]
    const near = (rgb: number[]) => rgb.every((value, i) => Math.abs(value - (app[i] ?? 0)) <= 3)
    expect(near(pixel(600, OG_IMAGE.height - 1))).toBe(true)
    expect(near(pixel(4, 4))).toBe(false)
    expect(Math.min(...pixel(4, 4))).toBeGreaterThan(180)
  })
})
