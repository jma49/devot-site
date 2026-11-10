import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { Scheme } from '../../../src/media.ts'
import { bringToFront, Input, windows, type Rect } from '../device/device.ts'
import { withEntry } from '../device/film.ts'
import { inputHelper } from '../device/helper.ts'
import { writeLibrary } from '../device/record.ts'
import { FFMPEG } from '../encode.ts'
import { typingTimes } from '../timeline.ts'
import { phoneCut, phoneEntry, phoneSettings, phoneShotsToRecord, type ShotNote } from './shots.ts'

// pnpm media:phone <step>  records the film's iPhone shots from Devot's iPhone app in the iOS
// Simulator, and the shots of the Mac and the iPhone side by side. DEVOT_CHECKOUT names the Devot
// checkout. Steps:
//   build                 the simulator app and the UI test runner with FilmShots.swift in it
//   seed <light|dark> [empty]  a booted simulator with the app, the demo library (or, with
//                         `empty`, a new install's own notes) and a clean status bar
//   shot [id ...]         records shots of shots.ts into footage/iphone/, each with its still
//   relay                 runs Devot's relay on this Mac, for the two devices to sync through
//   sync <id> <take>      records the whole screen while one device changes a note (see below)
// PHONE_SIMULATOR picks a simulator by UDID; MEDIA_SCHEMES limits `shot` to some schemes;
// MEDIA_GRADIENT (0 to 100) sets the Gradient setting; FOOTAGE names another footage folder.

const root = join(import.meta.dirname, '../../..')
const cache = process.env['MEDIA_CACHE'] ?? join(root, '.cache', 'media')
const footage = process.env['FOOTAGE'] ?? join(root, 'footage')
const devotDir = process.env['DEVOT_CHECKOUT']
const BUNDLE = 'io.github.jma49.devot'
const [step, ...args] = process.argv.slice(2)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
if (!devotDir || !existsSync(join(devotDir, 'src-tauri'))) {
  fail('E_PHONE_ARGS set DEVOT_CHECKOUT to a Devot checkout')
}
const uiBuild = process.env['DEVOT_UI_BUILD'] ?? join(devotDir, 'test-results', 'iphone-ui-build')
const testsDir = join(devotDir, 'src-tauri', 'apple', 'DevotUITests', 'Tests')

const run = (command: string, list: string[], cwd?: string, env?: NodeJS.ProcessEnv) =>
  execFileSync(command, list, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim()
const simctl = (...list: string[]) => run('xcrun', ['simctl', ...list])
/** Stops the app; simctl fails when it was not running, which is as good. */
function terminate(udid: string) {
  try {
    execFileSync('xcrun', ['simctl', 'terminate', udid, BUNDLE], { stdio: 'ignore' })
  } catch {
    // Not running.
  }
}

function simulator(): string {
  if (process.env['PHONE_SIMULATOR']) return process.env['PHONE_SIMULATOR']
  const devices = run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])
  return execFileSync('node', [join(devotDir!, 'scripts', 'ci', 'iphone-simulator.ts')], {
    input: devices,
  })
    .toString()
    .trim()
}

/** "iOS Simulator (iPhone 17, iOS 26.2), debug build @ e2a39a3" */
function source(udid: string): string {
  const { devices } = JSON.parse(simctl('list', 'devices', '--json')) as {
    devices: Record<string, { name: string; udid: string }[]>
  }
  const [runtime, list] = Object.entries(devices).find(([, all]) =>
    all.some((d) => d.udid === udid),
  ) ?? ['', []]
  const name = list.find((d) => d.udid === udid)?.name ?? 'iPhone'
  const os = /iOS-(\d+)-(\d+)$/.exec(runtime)
  const sha = run('git', ['-C', devotDir!, 'rev-parse', '--short=7', 'HEAD'])
  return `iOS Simulator (${name}, iOS ${os ? `${os[1]}.${os[2]}` : '?'}), debug build @ ${sha}`
}

function build() {
  const built = run('sh', [
    '-c',
    `find "${devotDir}/src-tauri/gen/apple/build" "$HOME/Library/Developer/Xcode/DerivedData" -type d -name Devot.app -path '*sim*' -prune 2>/dev/null | head -n 1`,
  ])
  if (!built || process.env['PHONE_REBUILD'] === '1') {
    execFileSync('pnpm', ['tauri', 'ios', 'build', '--debug', '--target', 'aarch64-sim'], {
      cwd: devotDir,
      stdio: 'inherit',
    })
  }
  // The shots are a file of Devot's own UI tests only while the runner is built.
  const copy = join(testsDir, 'FilmShots.swift')
  copyFileSync(join(import.meta.dirname, 'FilmShots.swift'), copy)
  try {
    execFileSync('sh', ['scripts/ci/iphone-ui-tests.sh', 'build'], {
      cwd: devotDir,
      stdio: 'inherit',
    })
  } finally {
    rmSync(copy, { force: true })
  }
}

/** The folder the app keeps its database in, once it has started once. */
function dataDir(udid: string): string | undefined {
  const container = simctl('get_app_container', udid, BUNDLE, 'data')
  const db = run('sh', [
    '-c',
    `find "${container}/Library" -name devot.sqlite 2>/dev/null | head -n 1`,
  ])
  return db ? join(db, '..') : undefined
}

async function seed(scheme: Scheme, library = true): Promise<string> {
  const udid = simulator()
  run('sh', [join(devotDir!, 'scripts', 'ci', 'iphone-simulator-ready.sh'), udid])
  const app = join(uiBuild, 'Devot.app')
  if (!existsSync(app)) fail(`E_PHONE_NO_BUILD ${app} is missing; run pnpm media:phone build`)
  terminate(udid)
  // Without the library the app starts as a new install does, for a device that joins a vault.
  if (!library) {
    try {
      simctl('uninstall', udid, BUNDLE)
    } catch {
      // Not installed.
    }
  }
  simctl('install', udid, app)
  // The app makes its data folder on its first start; the library replaces what it made.
  let dir = dataDir(udid)
  if (!dir) {
    simctl('launch', udid, BUNDLE)
    for (let i = 0; i < 120 && !dir; i++) {
      await sleep(500)
      dir = dataDir(udid)
    }
    await sleep(2000)
    terminate(udid)
  }
  if (!dir) fail('E_PHONE_NO_DATA the app made no devot.sqlite in its container')
  if (library) {
    const fresh = join(cache, 'phone', 'devot.sqlite')
    rmSync(join(cache, 'phone'), { recursive: true, force: true })
    mkdirSync(join(cache, 'phone'), { recursive: true })
    writeLibrary(devotDir!, fresh, join(cache, 'phone', 'ids.json'))
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(join(dir, `devot.sqlite${suffix}`), { force: true })
    }
    copyFileSync(fresh, join(dir, 'devot.sqlite'))
  }
  const gradient = process.env['MEDIA_GRADIENT']
  writeFileSync(
    join(dir, 'editor-settings.json'),
    JSON.stringify(phoneSettings(scheme, gradient ? Number(gradient) : undefined), null, 2),
  )
  simctl('ui', udid, 'appearance', scheme)
  simctl(
    ...['status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi'],
    ...[
      '--wifiMode',
      'active',
      '--wifiBars',
      '3',
      '--cellularMode',
      'active',
      '--cellularBars',
      '4',
    ],
    ...['--batteryState', 'charged', '--batteryLevel', '100'],
  )
  return udid
}

interface Probe {
  duration: number
  pixels: [number, number]
}

function probe(file: string): Probe {
  const out = run(process.env['FFPROBE'] ?? 'ffprobe', [
    ...['-v', 'error', '-select_streams', 'v:0'],
    ...['-show_entries', 'stream=width,height:format=duration', '-of', 'json', file],
  ])
  const { streams, format } = JSON.parse(out) as {
    streams: { width: number; height: number }[]
    format: { duration: string }
  }
  return { duration: Number(format.duration), pixels: [streams[0]!.width, streams[0]!.height] }
}

const MAX_BYTES = 50 * 1024 * 1024

/** High-bitrate H.264 at a constant frame rate, unscaled; a higher CRF only when over 50 MB. */
function encode(input: string, out: string, fps: number, cut?: { from: number; length: number }) {
  for (const quality of [12, 14, 16]) {
    execFileSync(FFMPEG, [
      ...['-y', '-v', 'error'],
      ...(cut ? ['-ss', cut.from.toFixed(3)] : []),
      ...['-i', input],
      ...(cut ? ['-t', cut.length.toFixed(3)] : []),
      ...[
        '-an',
        '-vf',
        `fps=${fps}`,
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        String(quality),
      ],
      ...['-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    ])
    if (statSync(out).size <= MAX_BYTES) return
  }
  throw new Error(`E_PHONE_TOO_BIG ${out}`)
}

function record(entry: { file: string }) {
  const manifest = join(footage, 'manifest.json')
  const entries = existsSync(manifest)
    ? (JSON.parse(readFileSync(manifest, 'utf8')) as { file: string }[])
    : []
  writeFileSync(manifest, `${JSON.stringify(withEntry(entries, entry), null, 2)}\n`)
}

/** Runs one test of FilmShots.swift on the simulator; its note and still land in `out`. */
function film(udid: string, test: string, scheme: Scheme, out: string) {
  const xctestrun = run('sh', [
    '-c',
    `find "${uiBuild}" -maxdepth 1 -name '*.xctestrun' | head -n 1`,
  ])
  if (!xctestrun)
    fail(`E_PHONE_NO_BUILD ${uiBuild} holds no test runner; run pnpm media:phone build`)
  run(
    'xcodebuild',
    [
      ...['test-without-building', '-xctestrun', xctestrun, '-destination', `id=${udid}`],
      `-only-testing:DevotUITests/FilmShots/${test}`,
    ],
    undefined,
    { TEST_RUNNER_FILM_OUT: out, TEST_RUNNER_FILM_SCHEME: scheme },
  )
}

async function shots(ids: string[]) {
  const named = process.env['MEDIA_SCHEMES']?.split(',') as Scheme[] | undefined
  const work = join(cache, 'phone-shots')
  mkdirSync(work, { recursive: true })
  mkdirSync(join(footage, 'iphone', 'stills'), { recursive: true })
  for (const { shot, scheme } of phoneShotsToRecord(ids, named)) {
    const udid = await seed(scheme)
    const name = `${shot.id}-${scheme}`
    const raw = join(work, `${name}.mov`)
    rmSync(raw, { force: true })
    const recorder = spawn(
      'xcrun',
      ['simctl', 'io', udid, 'recordVideo', '--codec', 'h264', '--force', raw],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    // simctl says "Recording started" once it has its first frame.
    const started = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`E_PHONE_RECORDING ${name}`)), 30_000)
      recorder.stderr!.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('Recording started')) {
          clearTimeout(timer)
          resolve(Date.now() / 1000)
        }
      })
    })
    try {
      film(udid, shot.test, scheme, work)
    } finally {
      recorder.kill('SIGINT')
      await new Promise((resolve) => recorder.once('exit', resolve))
    }
    const note = JSON.parse(readFileSync(join(work, `${name}.json`), 'utf8')) as ShotNote
    const file = `iphone/${name}.mp4`
    encode(raw, join(footage, file), 60, phoneCut(note, started))
    const still = join(work, `${name}.png`)
    if (existsSync(still)) renameSync(still, join(footage, 'iphone', 'stills', `${name}.png`))
    const measured = probe(join(footage, file))
    record(phoneEntry(note, { file, ...measured, fps: 60, source: source(udid) }))
    console.log(`${file} ${measured.duration.toFixed(2)} s, ${measured.pixels.join('x')}`)
  }
}

function relay() {
  const secret = process.env['RELAY_SECRET'] ?? 'devot-film-relay-secret-0123456789abcdef'
  const data = join(cache, 'relay')
  mkdirSync(data, { recursive: true })
  console.log(`relay: http://localhost:8787  secret: ${secret}  data: ${data}`)
  execFileSync('node', ['relay/src/node/main.ts'], {
    cwd: devotDir,
    env: { ...process.env, RELAY_SECRET: secret, RELAY_DATA: data, PORT: '8787' },
    stdio: 'inherit',
  })
}

const pid = (pattern: string, exact: boolean) =>
  Number(run('sh', ['-c', `pgrep ${exact ? '-x' : '-f'} "${pattern}" | head -n 1`]) || 0)

// sync x1-mac-to-iphone <take>: the Mac's Devot (the demo build, frontmost, the caret in the note's
// body) gets a line typed at the end of the note, and the recording runs on until SYNC_WAIT
// seconds (12) later. sync x2-iphone-to-mac <take>: FilmShots' testX2TickATask ticks a task in the
// note open on the iPhone. Both devices are paired through the relay and show the same note
// before either runs; the windows stay where they are, and their places go into the manifest.
async function sync(id: string, take: string) {
  if (!['x1-mac-to-iphone', 'x2-iphone-to-mac'].includes(id) || !/^\d+$/.test(take ?? '')) {
    fail('E_PHONE_ARGS sync <x1-mac-to-iphone|x2-iphone-to-mac> <take number>')
  }
  const binary = process.env['DEVOT_BINARY']
  const mac = binary ? pid(binary, false) : 0
  const phone = pid('Simulator', true)
  if (!mac || !phone)
    fail('E_PHONE_SYNC the demo build (DEVOT_BINARY) and the Simulator must be running')
  const input = new Input(inputHelper(cache))
  const udid = simulator()
  const wait = Number(process.env['SYNC_WAIT'] ?? 12) * 1000
  const work = join(cache, 'phone-shots')
  mkdirSync(work, { recursive: true })
  mkdirSync(join(footage, 'sync'), { recursive: true })
  const raw = join(work, `${id}-take${take}.mkv`)
  rmSync(raw, { force: true })
  let recorder: ChildProcess | undefined
  try {
    const [, width, height, scale] = (await input.send('screen')).split(' ').map(Number)
    await input.send('backdrop light')
    const pixels = (r: Rect) => [r.x, r.y, r.width, r.height].map((n) => Math.round(n * scale!))
    const rects = { mac: pixels(windows(mac)[0]!), iphone: pixels(windows(phone)[0]!) }
    recorder = spawn(
      FFMPEG,
      [
        ...['-y', '-loglevel', 'error', '-f', 'avfoundation', '-capture_cursor', '1'],
        ...['-framerate', '30', '-i', 'Capture screen 0:none'],
        ...['-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', raw],
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    )
    // A still moment before the change; beats count from about the recording's first frame.
    const lead = 2.5
    await sleep(lead * 1000)
    const began = Date.now()
    const beats: { t: number; what: string }[] = []
    const at = () => Math.round(((Date.now() - began) / 1000 + lead) * 100) / 100
    if (id === 'x1-mac-to-iphone') {
      const line = process.env['SYNC_LINE'] ?? 'Book the train to the coast'
      // Command-Down puts the caret at the end of the note.
      bringToFront(mac)
      await sleep(400)
      await input.send('key 125 cmd')
      await sleep(400)
      beats.push({ t: at(), what: `type ${JSON.stringify(line)} on the Mac` })
      const text = `\n${line}`
      const times = typingTimes(text, 0, 12)
      const typing = Date.now()
      for (const [i, ch] of [...text].entries()) {
        await sleep(Math.max(0, times[i]! * 1000 - (Date.now() - typing)))
        await input.send(ch === '\n' ? 'key 36' : `text ${ch}`)
      }
      beats.push({ t: at(), what: 'typing ends; waiting for the iPhone' })
    } else {
      beats.push({ t: at(), what: 'tick a task on the iPhone (the test attaches first)' })
      film(udid, 'testX2TickATask', 'light', work)
      beats.push({ t: at(), what: 'ticked; waiting for the Mac' })
    }
    await sleep(wait)
    recorder.stdin!.write('q')
    recorder.stdin!.end()
    await new Promise((resolve) => recorder!.once('exit', resolve))
    recorder = undefined
    const file = `sync/${id}-take${take}.mp4`
    encode(raw, join(footage, file), 30)
    const measured = probe(join(footage, file))
    const sha = run('git', ['-C', devotDir!, 'rev-parse', '--short=7', 'HEAD'])
    record({
      id,
      file,
      scheme: 'light',
      source: `demo build @ ${sha} and ${source(udid)}, synced through a relay on this Mac`,
      pixels: measured.pixels,
      points: [width, height],
      fps: 30,
      duration: Math.round(measured.duration * 100) / 100,
      cursor: true,
      beats,
      windows: rects,
    } as { file: string })
    console.log(`${file} ${measured.duration.toFixed(2)} s`)
  } finally {
    recorder?.kill('SIGINT')
    await input.send('backdrop off').catch(() => {})
    input.stop()
  }
}

switch (step) {
  case 'build':
    build()
    break
  case 'seed':
    if (args[0] !== 'light' && args[0] !== 'dark') fail('E_PHONE_ARGS seed <light|dark> [empty]')
    console.log(await seed(args[0], args[1] !== 'empty'))
    break
  case 'shot':
    await shots(args)
    break
  case 'relay':
    relay()
    break
  case 'sync':
    await sync(args[0] ?? '', args[1] ?? '')
    break
  default:
    fail(
      'E_PHONE_ARGS steps: build, seed <light|dark> [empty], shot [id ...], relay, sync <id> <take>',
    )
}
