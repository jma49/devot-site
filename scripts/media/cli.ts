import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SLOTS, type SlotName } from '../../src/media.ts'
import { captureSlots, encodeSlot, type CaptureContext } from './capture.ts'
import { DEVOT_GIT, ensureDevot, pinnedCommit, startServer } from './devot.ts'
import { serializeManifest, withEntry, type Manifest } from './manifest.ts'

// pnpm media:capture [slot ...]  renders the clips' frames, then encodes them
// pnpm media:encode [slot ...]   encodes again from the frames already rendered

const root = join(import.meta.dirname, '../..')
const [task, ...rest] = process.argv.slice(2)
const unknown = rest.filter((name) => !(SLOTS as readonly string[]).includes(name))
if ((task !== 'capture' && task !== 'encode') || unknown.length > 0) {
  console.error(`E_MEDIA_ARGS expected capture or encode and slots from: ${SLOTS.join(' ')}`)
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
  for (const slot of slots) {
    const encoded = await encodeSlot(slot, ctx)
    const files = encoded.files
      .map((file) => `${file.path} ${(file.bytes / 1024).toFixed(0)} KB (q ${file.quality})`)
      .join(', ')
    log(`${slot} ${encoded.width}x${encoded.height} ${encoded.duration} s: ${files}`)
    const manifestFile = join(root, 'src', 'media.json')
    const manifest = existsSync(manifestFile)
      ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as Manifest)
      : {}
    const { width, height, duration, edges } = encoded
    const next = withEntry(manifest, slot, { width, height, duration, edges }, SLOTS)
    writeFileSync(manifestFile, serializeManifest(next))
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  log(`FAILED ${message.split('\n').slice(0, 6).join(' / ')}`)
  process.exitCode = 1
} finally {
  stop()
}
