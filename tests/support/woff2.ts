import { brotliDecompressSync } from 'node:zlib'

/** The WOFF2 known-table list: a directory entry names its table by index into it. */
const KNOWN_TAGS =
  (
    'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp ' +
    'hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL ' +
    'SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx ' +
    'opbd prop trak Zapf Silf Glat Gloc Feat Sill'
  )
    .match(/.{5}/g)
    ?.map((entry) => entry.slice(0, 4)) ?? []

export interface Axis {
  tag: string
  min: number
  default: number
  max: number
}

export interface Webfont {
  tables: Map<string, Buffer>
  /** Code points the font maps to a glyph. */
  codePoints: Set<number>
  axes: Axis[]
}

function base128(data: Buffer, at: number): [number, number] {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = data.readUInt8(at + i)
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return [value, at + i + 1]
  }
  throw new Error('E_WOFF2_BASE128')
}

function tables(data: Buffer): Map<string, Buffer> {
  if (data.toString('latin1', 0, 4) !== 'wOF2') throw new Error('E_WOFF2_SIGNATURE')
  const count = data.readUInt16BE(12)
  const compressed = data.readUInt32BE(20)
  const entries: { tag: string; length: number }[] = []
  let at = 48
  for (let i = 0; i < count; i++) {
    const flags = data.readUInt8(at++)
    let tag = KNOWN_TAGS[flags & 0x3f] ?? ''
    if ((flags & 0x3f) === 0x3f) {
      tag = data.toString('latin1', at, at + 4)
      at += 4
    }
    const version = flags >> 6
    let length
    ;[length, at] = base128(data, at)
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    if (transformed) [length, at] = base128(data, at)
    entries.push({ tag, length })
  }
  const stream = brotliDecompressSync(data.subarray(at, at + compressed))
  const found = new Map<string, Buffer>()
  let offset = 0
  for (const { tag, length } of entries) {
    found.set(tag, stream.subarray(offset, offset + length))
    offset += length
  }
  return found
}

function format4(table: Buffer, at: number, into: Set<number>): void {
  const segments = table.readUInt16BE(at + 6) / 2
  const ends = at + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const ranges = deltas + segments * 2
  for (let s = 0; s < segments; s++) {
    const end = table.readUInt16BE(ends + s * 2)
    const start = table.readUInt16BE(starts + s * 2)
    const delta = table.readInt16BE(deltas + s * 2)
    const range = table.readUInt16BE(ranges + s * 2)
    for (let code = start; code <= end && code !== 0xffff; code++) {
      const glyph =
        range === 0
          ? (code + delta) & 0xffff
          : table.readUInt16BE(ranges + s * 2 + range + (code - start) * 2)
      if (glyph !== 0) into.add(code)
    }
  }
}

function format12(table: Buffer, at: number, into: Set<number>): void {
  const groups = table.readUInt32BE(at + 12)
  for (let g = 0; g < groups; g++) {
    const start = table.readUInt32BE(at + 16 + g * 12)
    const end = table.readUInt32BE(at + 20 + g * 12)
    for (let code = start; code <= end; code++) into.add(code)
  }
}

function codePoints(cmap: Buffer): Set<number> {
  const found = new Set<number>()
  const count = cmap.readUInt16BE(2)
  for (let i = 0; i < count; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8)
    const offset = cmap.readUInt32BE(8 + i * 8)
    if (platform !== 0 && platform !== 3) continue
    const format = cmap.readUInt16BE(offset)
    if (format === 4) format4(cmap, offset, found)
    if (format === 12) format12(cmap, offset, found)
  }
  return found
}

function axes(fvar: Buffer | undefined): Axis[] {
  if (!fvar) return []
  const first = fvar.readUInt16BE(4)
  const size = fvar.readUInt16BE(10)
  const fixed = (at: number) => fvar.readInt32BE(at) / 65536
  return Array.from({ length: fvar.readUInt16BE(8) }, (_, i) => {
    const at = first + i * size
    return {
      tag: fvar.toString('latin1', at, at + 4),
      min: fixed(at + 4),
      default: fixed(at + 8),
      max: fixed(at + 12),
    }
  })
}

/** Reads the tables, character map and variation axes of a WOFF2 file. */
export function readWebfont(data: Buffer): Webfont {
  const found = tables(data)
  const cmap = found.get('cmap')
  if (!cmap) throw new Error('E_WOFF2_NO_CMAP')
  return { tables: found, codePoints: codePoints(cmap), axes: axes(found.get('fvar')) }
}
