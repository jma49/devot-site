// Reads an MP4's length and picture size from its boxes (ISO/IEC 14496-12): `mvhd` for the
// duration, the video track's `tkhd` for width and height (16.16 fixed point).

function boxes(
  data: Buffer,
  start: number,
  end: number,
): { type: string; at: number; end: number }[] {
  const found: { type: string; at: number; end: number }[] = []
  let at = start
  while (at + 8 <= end) {
    let size = data.readUInt32BE(at)
    const type = data.toString('latin1', at + 4, at + 8)
    let header = 8
    if (size === 1) {
      size = Number(data.readBigUInt64BE(at + 8))
      header = 16
    } else if (size === 0) {
      size = end - at
    }
    found.push({ type, at: at + header, end: at + size })
    at += size
  }
  return found
}

export function mp4Info(data: Buffer): { duration: number; width: number; height: number } {
  const moov = boxes(data, 0, data.length).find((box) => box.type === 'moov')
  if (!moov) throw new Error('E_MP4_NO_MOOV')
  const inside = boxes(data, moov.at, moov.end)
  const mvhd = inside.find((box) => box.type === 'mvhd')
  if (!mvhd) throw new Error('E_MP4_NO_MVHD')
  const version = data.readUInt8(mvhd.at)
  const timescale = data.readUInt32BE(mvhd.at + (version === 1 ? 20 : 12))
  const length =
    version === 1 ? Number(data.readBigUInt64BE(mvhd.at + 24)) : data.readUInt32BE(mvhd.at + 16)
  const sizes = inside
    .filter((box) => box.type === 'trak')
    .map((trak) => boxes(data, trak.at, trak.end).find((box) => box.type === 'tkhd'))
    .flatMap((tkhd) => {
      if (!tkhd) return []
      const end = tkhd.end
      return [
        { width: data.readUInt32BE(end - 8) / 65536, height: data.readUInt32BE(end - 4) / 65536 },
      ]
    })
    .filter(({ width, height }) => width > 0 && height > 0)
  const video = sizes[0]
  if (!video) throw new Error('E_MP4_NO_VIDEO')
  return { duration: length / timescale, ...video }
}
