import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { iconPng, squareSvg } from '../../src/lib/icons.ts'
import { pngSize } from '../support/png.ts'

const svg = (attrs: string) =>
  `<!-- header -->\n<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>\n  <path d="M0 0h1v1z"/>\n</svg>\n`

describe('squareSvg', () => {
  it('pads the shorter side so the mark sits in the middle of a square', () => {
    expect(squareSvg(svg('viewBox="8 -4 92 86" width="920" height="860"'))).toBe(
      svg('viewBox="8 -7 92 92" width="920" height="920"'),
    )
    expect(squareSvg(svg('viewBox="0 0 100 50" width="100" height="50"'))).toBe(
      svg('viewBox="0 -25 100 100" width="100" height="100"'),
    )
  })

  it('leaves a square image as it is', () => {
    const square = svg('viewBox="0 0 10 10" width="10" height="10"')
    expect(squareSvg(square)).toBe(square)
  })

  it('refuses an image without a viewBox', () => {
    expect(() => squareSvg(svg('width="10" height="20"'))).toThrow(/^E_ICON_VIEWBOX/)
  })
})

describe('iconPng', () => {
  const mark = squareSvg(svg('viewBox="0 0 2 1" width="20" height="10"'))
  const corner = async (png: Uint8Array) => [
    ...(await sharp(png).ensureAlpha().raw().toBuffer()).subarray(0, 4),
  ]

  it('renders a square PNG of the requested size, transparent around the mark', async () => {
    const png = await iconPng(mark, { size: 48 })
    expect(pngSize(png)).toEqual({ width: 48, height: 48 })
    expect((await corner(png))[3]).toBe(0)
  })

  it('can inset the mark on a solid background', async () => {
    const png = await iconPng(mark, { size: 40, inset: 4, background: '#336699' })
    expect(pngSize(png)).toEqual({ width: 40, height: 40 })
    expect(await corner(png)).toEqual([0x33, 0x66, 0x99, 255])
  })
})
