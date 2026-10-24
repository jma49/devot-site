import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { iconPng, squareSvg, tileSvg } from '../../src/lib/icons.ts'
import { GET as appleTouchIcon } from '../../src/pages/apple-touch-icon.png.ts'
import { GET as favicon192 } from '../../src/pages/favicon-192.png.ts'
import { GET as faviconSvg } from '../../src/pages/favicon.svg.ts'
import { pngSize } from '../support/png.ts'

const asset = (name: string) =>
  readFileSync(join(import.meta.dirname, '../../src/assets', name), 'utf8')

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

describe('tileSvg', () => {
  it('crops an app icon on the 1024 canvas to its tile', () => {
    expect(tileSvg(svg('viewBox="0 0 1024 1024" width="1024" height="1024"'))).toBe(
      svg('viewBox="100 100 824 824" width="824" height="824"'),
    )
  })

  it('refuses an image on another canvas', () => {
    expect(() => tileSvg(svg('viewBox="0 0 92 86" width="920" height="860"'))).toThrow(
      /^E_ICON_VIEWBOX/,
    )
  })

  it("matches Devot's app icons, whose tile still sits on that grid", () => {
    for (const name of ['app-icon.svg', 'app-icon-small.svg']) {
      const icon = asset(name)
      expect(icon, name).toContain('viewBox="0 0 1024 1024"')
      expect(icon, name).toContain('<rect x="100" y="100" width="824" height="824"')
    }
  })
})

describe('the icon routes', () => {
  const route = async (get: typeof faviconSvg) =>
    new Uint8Array(await (await get({} as never)).arrayBuffer())
  const pixels = async (png: Uint8Array) => {
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return (x: number, y: number) => [
      ...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4),
    ]
  }

  it('serves the small cut, cropped to its tile, as the SVG favicon', async () => {
    const response = await faviconSvg({} as never)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
    expect(await response.text()).toBe(tileSvg(asset('app-icon-small.svg')))
  })

  it('serves the full icon on its tile at 192 px, transparent outside the corners', async () => {
    const png = await route(favicon192)
    expect(pngSize(png)).toEqual({ width: 192, height: 192 })
    const at = await pixels(png)
    expect(at(0, 0)[3]).toBeLessThan(64)
    expect(at(96, 6)[3]).toBe(255)
  })

  it('serves the full-bleed icon, opaque to its corners, for home screens', async () => {
    const png = await route(appleTouchIcon)
    expect(pngSize(png)).toEqual({ width: 180, height: 180 })
    const at = await pixels(png)
    for (const [x, y] of [
      [0, 0],
      [179, 0],
      [0, 179],
      [179, 179],
    ] as const) {
      expect(at(x, y)[3], `${x},${y}`).toBe(255)
      expect(Math.min(...(at(x, y).slice(0, 3) as number[])), `${x},${y}`).toBeGreaterThan(200)
    }
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
