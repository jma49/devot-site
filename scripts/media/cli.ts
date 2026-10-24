import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMES, SLOTS, type Scheme, type SlotName } from '../../src/media.ts'
import { captureSlots, encodeSlot, type CaptureContext } from './capture.ts'
import { DEVOT_GIT, ensureDevot, pinnedCommit, startServer } from './devot.ts'
import { serializeManifest, withEntry, type Manifest } from './manifest.ts'

// pnpm media:capture [slot ...]  renders the clips' frames in both colour schemes, then encodes them
// pnpm media:encode [slot ...]   encodes again from the frames already rendered
// MEDIA_SCHEMES=dark limits a run to one scheme; MEDIA_SAMPLE=10 writes every tenth frame of a
// capture to a folder of its own and encodes nothing, to look at a scene while working on it.

const root = join(import.meta.dirname, '../..')
const [task, ...rest] = process.argv.slice(2)
const unknown = rest.filter((name) => !(SLOTS as readonly string[]).includes(name))
const schemes = (process.env['MEDIA_SCHEMES']?.split(',') ?? [...SCHEMES]) as Scheme[]
if (
  (task !== 'capture' && task !== 'encode') ||
  unknown.length > 0 ||
  schemes.some((scheme) => !SCHEMES.includes(scheme))
) {
  console.error(
    `E_MEDIA_ARGS expected capture or encode, slots from: ${SLOTS.join(' ')}, ` +
      `and MEDIA_SCHEMES from: ${SCHEMES.join(',')}`,
  )
  process.exit(1)
}
const slots = (rest.length > 0 ? rest : [...SLOTS]) as SlotName[]
const cache = process.env['MEDIA_CACHE'] ?? join(root, '.cache', 'media')
mkdirSync(join(cache, 'logs'), { recursive: true })
const logFile = join(cache, 'logs', 'media.log')
const log = (line: string) => {
  appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`)
  console.log(line)
}

let stop = () => {}
try {
  const devotDir = ensureDevot({
    cache,
    commit: pinnedCommit(root),
    source: process.env['DEVOT_GIT'] ?? DEVOT_GIT,
    log,
  })
  const ctx: CaptureContext = {
    root,
    cache,
    devotDir,
    baseURL: '',
    fps: Number(process.env['MEDIA_FPS'] ?? 30),
    schemes,
    sample: Number(process.env['MEDIA_SAMPLE'] ?? 1),
    log,
  }
  if (task === 'capture') {
    const server = await startServer({
      dir: devotDir,
      port: Number(process.env['MEDIA_PORT'] ?? 5391),
      reuse: process.env['MEDIA_REUSE_SERVER'] === '1',
    })
    stop = server.stop
    await captureSlots(slots, { ...ctx, baseURL: server.url })
  }
  const manifestFile = join(root, 'src', 'media.json')
  for (const slot of ctx.sample > 1 ? [] : slots) {
    const { measured, files } = await encodeSlot(slot, ctx)
    const list = files
      .map((file) => `${file.path} ${(file.bytes / 1024).toFixed(0)} KB (q ${file.quality})`)
      .join(', ')
    log(`${slot} ${measured.width}x${measured.height} ${measured.duration} s: ${list}`)
    const manifest = existsSync(manifestFile)
      ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as Manifest)
      : {}
    // A run of one scheme keeps the other scheme's files and their sizes.
    const bytes = { ...manifest[slot]?.bytes, ...measured.bytes }
    const next = withEntry(manifest, slot, { ...measured, bytes }, SLOTS)
    writeFileSync(manifestFile, serializeManifest(next))
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  log(`FAILED ${message.split('\n').slice(0, 6).join(' / ')}`)
  process.exitCode = 1
} finally {
  stop()
}
