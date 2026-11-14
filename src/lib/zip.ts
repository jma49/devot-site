// A stored (uncompressed) zip, so a plugin package can be built without a dependency. Every entry is
// dated 1980-01-01, the earliest date the format holds, so the same files always make the same bytes.

export interface ZipEntry {
  path: string
  bytes: Uint8Array
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const DOS_DATE = (0 << 9) | (1 << 5) | 1
const UTF8_NAMES = 1 << 11

export function storedZip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const { path, bytes } of entries) {
    if (!/^[A-Za-z0-9_-][A-Za-z0-9._/-]*$/.test(path) || path.includes('..')) {
      throw new Error(`E_ZIP_PATH_INVALID ${path}`)
    }
    const name = encoder.encode(path)
    const crc = crc32(bytes)
    const local = new Uint8Array(30 + name.length)
    const head = new DataView(local.buffer)
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true)
    head.setUint16(6, UTF8_NAMES, true)
    head.setUint16(12, DOS_DATE, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, bytes.length, true)
    head.setUint32(22, bytes.length, true)
    head.setUint16(26, name.length, true)
    local.set(name, 30)
    locals.push(local, bytes)

    const central = new Uint8Array(46 + name.length)
    const entry = new DataView(central.buffer)
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, UTF8_NAMES, true)
    entry.setUint16(14, DOS_DATE, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, bytes.length, true)
    entry.setUint32(24, bytes.length, true)
    entry.setUint16(28, name.length, true)
    entry.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length + bytes.length
  }
  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0)
  const end = new Uint8Array(22)
  const tail = new DataView(end.buffer)
  tail.setUint32(0, 0x06054b50, true)
  tail.setUint16(8, entries.length, true)
  tail.setUint16(10, entries.length, true)
  tail.setUint32(12, centralSize, true)
  tail.setUint32(16, offset, true)
  const parts = [...locals, ...centrals, end]
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
