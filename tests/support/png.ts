const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Width and height from a PNG's IHDR chunk; fails on anything that is not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const isPng = SIGNATURE.every((byte, i) => bytes[i] === byte)
  const ihdr = String.fromCharCode(...bytes.subarray(12, 16))
  if (!isPng || ihdr !== 'IHDR') throw new Error('E_PNG not a PNG with an IHDR chunk')
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
