import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FFMPEG } from '../encode.ts'
import {
  cut,
  filmDir,
  footageEntry,
  masterFile,
  withEntry,
  type FootageEntry,
  type Master,
} from './film.ts'

// pnpm media:film:pack [id ...]  cuts each master in .cache/media/film/ to its script, encodes it
// as high-bitrate H.264 into footage/mac/ and records it in footage/manifest.json. Nothing is
// scaled, graded or dressed. FOOTAGE names another folder; FILM_SOURCE says what was recorded
// (by default the demo build at DEVOT_CHECKOUT's commit).

const root = join(import.meta.dirname, '../../..')
const cache = process.env['MEDIA_CACHE'] ?? join(root, '.cache', 'media')
const footage = process.env['FOOTAGE'] ?? join(root, 'footage')
const only = process.argv.slice(2)
const MAX_BYTES = 50 * 1024 * 1024
const QUALITIES = [12, 14, 16]

function source(): string {
  if (process.env['FILM_SOURCE']) return process.env['FILM_SOURCE']
  const checkout = process.env['DEVOT_CHECKOUT']
  if (!checkout) throw new Error('E_FILM_SOURCE set FILM_SOURCE or DEVOT_CHECKOUT')
  const sha = execFileSync('git', ['-C', checkout, 'rev-parse', '--short=7', 'HEAD'])
    .toString()
    .trim()
  return `demo build @ ${sha}`
}

function seconds(file: string): number {
  const out = execFileSync(
    process.env['FFPROBE'] ?? 'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  )
  return Number(out.toString().trim())
}

const dir = filmDir(cache)
const notes = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : []
const masters = notes
  .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Master)
  .filter((master) => only.length === 0 || only.includes(master.id))
if (masters.length === 0) {
  console.error(
    `E_FILM_NO_MASTERS none in ${dir}; record with MEDIA_FULL_WINDOW=1 pnpm media:device`,
  )
  process.exit(1)
}

const from = source()
const manifestFile = join(footage, 'manifest.json')
let entries: FootageEntry[] = existsSync(manifestFile)
  ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as FootageEntry[])
  : []
mkdirSync(join(footage, 'mac'), { recursive: true })
for (const master of masters) {
  const input = masterFile(cache, master.id, master.scheme)
  const file = `mac/${master.id}-${master.scheme}.mp4`
  const out = join(footage, file)
  const kept = cut(master)
  let quality = QUALITIES[0]!
  for (quality of QUALITIES) {
    execFileSync(FFMPEG, [
      ...['-y', '-v', 'error', '-ss', kept.from.toFixed(3), '-i', input],
      ...['-t', kept.length.toFixed(3), '-an', '-vf', `fps=${master.fps}`],
      ...['-c:v', 'libx264', '-preset', 'slow', '-crf', String(quality)],
      ...['-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    ])
    if (statSync(out).size <= MAX_BYTES) break
  }
  const bytes = statSync(out).size
  if (bytes > MAX_BYTES) {
    throw new Error(`E_FILM_TOO_BIG ${file} is ${bytes} bytes at crf ${quality}`)
  }
  entries = withEntry(entries, footageEntry(master, { file, duration: seconds(out), source: from }))
  console.log(`${file} ${(bytes / 1024 / 1024).toFixed(1)} MB at crf ${quality}`)
}
writeFileSync(manifestFile, `${JSON.stringify(entries, null, 2)}\n`)
