import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SCHEMES, SLOTS, type Scheme, type SlotName } from '../../../src/media.ts'
import { FILM_SCENES, FILM_SHOTS } from '../film-scenes.ts'
import { SCENES } from '../scenes.ts'
import { Input } from './device.ts'
import { shotsToRecord } from './film.ts'
import { demoDataDir, recordScene, type DeviceContext } from './record.ts'

// pnpm media:device [slot ...]  records the clips from the real Devot app on this Mac, then run
// `pnpm media:encode` for the same slots. It takes over the screen, pointer and keyboard while it
// runs. DEVOT_CHECKOUT names a Devot checkout whose demo build exists: build it once with
// `pnpm tauri dev --config <demo config>` there (docs in README "Product media").
// DEVOT_BINARY names that build's binary; MEDIA_SCHEMES limits the run to one scheme.
// MEDIA_FULL_WINDOW=1 records the film's whole-window masters instead (film.ts): every shot of
// film-scenes.ts in its own schemes, or the ones named; pack them with `pnpm media:film:pack`.

const root = join(import.meta.dirname, '../../..')
const cache = process.env['MEDIA_CACHE'] ?? join(root, '.cache', 'media')
const devotDir = process.env['DEVOT_CHECKOUT']
const binary = process.env['DEVOT_BINARY']
const fullWindow = process.env['MEDIA_FULL_WINDOW'] === '1'
const asked = process.argv.slice(2)
const slots = (asked.length > 0 ? asked : [...SLOTS]) as SlotName[]
const named = process.env['MEDIA_SCHEMES']?.split(',') as Scheme[] | undefined
const schemes = named ?? [...SCHEMES]
if (!devotDir || !binary || !existsSync(binary)) {
  console.error('E_MEDIA_DEVICE_ARGS set DEVOT_CHECKOUT and DEVOT_BINARY to the demo build')
  process.exit(1)
}
if (!fullWindow && slots.some((s) => !SCENES[s])) {
  console.error(`E_MEDIA_ARGS slots from: ${SLOTS.join(' ')}`)
  process.exit(1)
}
let masters: { id: string; scheme: Scheme }[] = []
if (fullWindow) {
  try {
    masters = shotsToRecord(FILM_SHOTS, asked, named)
  } catch (error) {
    console.error(`${(error as Error).message}; shots: ${FILM_SHOTS.map((s) => s.id).join(' ')}`)
    process.exit(1)
  }
}
mkdirSync(join(cache, 'logs'), { recursive: true })
const log = (line: string) => {
  appendFileSync(join(cache, 'logs', 'device.log'), `${new Date().toISOString()} ${line}\n`)
  console.log(line)
}

// An app that is not bundled keeps its web storage in ~/Library/WebKit/<binary name>, shared with
// every other unbundled Devot build (`pnpm dev`): the run clears it for each clip, so it is kept
// aside first and put back after.
const webkit = join(homedir(), 'Library/WebKit/devot')
const webkitBackup = join(cache, 'webkit-backup', 'devot')
if (existsSync(webkit) && !existsSync(webkitBackup)) {
  execFileSync('rsync', ['-a', `${webkit}/`, `${webkitBackup}/`])
}

const server = spawn(
  'pnpm',
  [
    'exec',
    'vite',
    '--config',
    join(import.meta.dirname, 'devot', 'vite.config.ts'),
    '--strictPort',
  ],
  { cwd: devotDir, env: { ...process.env, DEVOT_DIR: devotDir }, stdio: 'ignore' },
)
// The input helper is built from its source the first time, and again when the source changes.
const helper = join(cache, 'bin', 'devot-input')
const helperSource = join(import.meta.dirname, 'input.swift')
if (!existsSync(helper) || statSync(helper).mtimeMs < statSync(helperSource).mtimeMs) {
  mkdirSync(join(cache, 'bin'), { recursive: true })
  execFileSync('swiftc', ['-O', helperSource, '-o', helper], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}
const input = new Input(helper)
try {
  await input.send('trusted')
  const [, width, height, scale] = (await input.send('screen')).split(' ').map(Number)
  for (let i = 0; i < 60; i++) {
    try {
      await fetch('http://localhost:5173/')
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  const ctx: DeviceContext = {
    cache,
    devotDir,
    binary,
    dataDir: demoDataDir(),
    devUrl: 'http://localhost:5173',
    fps: Number(process.env['MEDIA_FPS'] ?? 30),
    input,
    screen: { width: width!, height: height!, scale: scale! },
    fullWindow,
    log,
  }
  if (fullWindow) {
    for (const { id, scheme } of masters) await recordScene(ctx, FILM_SCENES[id]!, scheme)
  } else {
    for (const slot of slots) {
      for (const scheme of schemes) await recordScene(ctx, SCENES[slot]!, scheme)
    }
  }
} finally {
  await input.send('backdrop off').catch(() => {})
  input.stop()
  server.kill()
  if (existsSync(webkitBackup)) {
    execFileSync('rsync', ['-a', '--delete', `${webkitBackup}/`, `${webkit}/`])
    rmSync(webkitBackup, { recursive: true, force: true })
  }
}
