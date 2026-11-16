// Reads a stored (uncompressed) zip, the kind `src/lib/zip.ts` writes, by its local file headers.
export function readStoredZip(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const files = new Map<string, Uint8Array>()
  let at = 0
  while (at + 30 <= zip.byteLength && view.getUint32(at, true) === 0x04034b50) {
    if (view.getUint16(at + 8, true) !== 0) throw new Error(`E_ZIP_COMPRESSED at ${at}`)
    const size = view.getUint32(at + 18, true)
    const nameLength = view.getUint16(at + 26, true)
    const extraLength = view.getUint16(at + 28, true)
    const start = at + 30 + nameLength + extraLength
    const name = new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nameLength))
    files.set(name, zip.subarray(start, start + size))
    at = start + size
  }
  return files
}
