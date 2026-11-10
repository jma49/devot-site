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
import { bringToFront, Input, windows } from '../device/device.ts'
import { withEntry } from '../device/film.ts'
import { inputHelper } from '../device/helper.ts'
import { firstFrameAt, writeLibrary } from '../device/record.ts'
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
//   sync <id> <take>      records both devices while one changes a note (see below)
// PHONE_SIMULATOR picks a simulator by UDID; MEDIA_SCREEN counts the screen the Mac's window is on; MEDIA_SCHEMES limits `shot` to some schemes;
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
function encode(input: string, out: string, fps: number) {
  for (const quality of [12, 14, 16]) {
    execFileSync(FFMPEG, [
      ...['-y', '-v', 'error', '-i', input, '-an', '-vf', `fps=${fps}`],
      ...['-c:v', 'libx264', '-preset', 'slow', '-crf', String(quality)],
      ...['-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
    ])
    if (statSync(out).size <= MAX_BYTES) return
  }
  throw new Error(`E_PHONE_TOO_BIG ${out}`)
}

/**
 * The stretch `cut` of a simulator recording, lossless at a constant frame rate, in `out`. The
 * recording holds a frame only when the screen changes, and its frames come far out of order
 * after a still stretch, so ffmpeg times some of them by decode order and a cut by time lands
 * seconds off. Each frame is placed here by its own presentation time instead, and held until
 * the next one.
 */
async function constantRate(
  input: string,
  out: string,
  fps: number,
  cut: { from: number; length: number },
) {
  const times = run(process.env['FFPROBE'] ?? 'ffprobe', [
    ...['-v', 'error', '-select_streams', 'v:0'],
    ...['-show_entries', 'frame=pts_time', '-of', 'csv=p=0', input],
  ])
    .split('\n')
    .map((line) => parseFloat(line))
  const [width, height] = probe(input).pixels
  const size = (width * height * 3) / 2
  const raw = ['-f', 'rawvideo', '-pix_fmt', 'yuv420p']
  const decoder = spawn(
    FFMPEG,
    ['-v', 'error', '-i', input, '-an', '-fps_mode', 'passthrough', ...raw, '-'],
    // It is stopped once the cut is full, and would say so at length.
    { stdio: ['ignore', 'pipe', 'ignore'] },
  )
  const encoder = spawn(
    FFMPEG,
    [
      ...['-y', '-v', 'error', ...raw, '-s', `${width}x${height}`, '-r', String(fps), '-i', '-'],
      ...['-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', out],
    ],
    { stdio: ['pipe', 'ignore', 'inherit'] },
  )
  const total = Math.round(cut.length * fps)
  let written = 0
  const hold = async (frame: Buffer, until: number) => {
    while (written < total && cut.from + written / fps < until) {
      if (!encoder.stdin!.write(frame)) {
        await new Promise((resolve) => encoder.stdin!.once('drain', resolve))
      }
      written++
    }
  }
  const frame = Buffer.alloc(size)
  let filled = 0
  let index = 0
  for await (const chunk of decoder.stdout! as AsyncIterable<Buffer>) {
    for (let at = 0; at < chunk.length;) {
      if (written >= total) break
      const taken = chunk.copy(frame, filled, at, at + size - filled)
      at += taken
      filled += taken
      if (filled < size) continue
      filled = 0
      await hold(frame, times[++index] ?? Infinity)
    }
    if (written >= total) break
  }
  decoder.kill()
  if (written === 0) throw new Error(`E_PHONE_SHORT_RECORDING ${input}`)
  await hold(frame, Infinity)
  encoder.stdin!.end()
  await new Promise((resolve) => encoder.once('exit', resolve))
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
    // HEVC: the simulator's H.264 puts frames far out of order after a still stretch, and ffmpeg
    // then times them by decode order, which moves the cut by seconds.
    const recorder = spawn(
      'xcrun',
      ['simctl', 'io', udid, 'recordVideo', '--codec', 'hevc', '--force', raw],
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
    const steady = join(work, `${name}.mkv`)
    await constantRate(raw, steady, 60, phoneCut(note, started))
    encode(steady, join(footage, file), 60)
    rmSync(steady, { force: true })
    const still = join(work, `${name}.png`)
    const kept = `iphone/stills/${name}.png`
    if (existsSync(still)) renameSync(still, join(footage, kept))
    const measured = probe(join(footage, file))
    record({
      ...phoneEntry(note, { file, ...measured, fps: 60, source: source(udid) }),
      ...(existsSync(join(footage, kept)) && { still: kept }),
    })
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

const pid = (pattern: string) => Number(run('sh', ['-c', `pgrep -f "${pattern}" | head -n 1`]) || 0)

// sync <id> <take>: one device changes a note and the other shows it. Xcode 27 has no Simulator
// app whose window could stand beside the Mac's, so a take is two recordings made at once and cut
// to the same stretch of the wall clock: `sync/<id>-take<n>-mac.mp4`, the demo build's main window
// as it stands on the screen, and `sync/<id>-take<n>-iphone.mp4`, the simulator's screen. Played
// from the same moment they show the same seconds. Both devices are paired through the relay and
// show the same note before either runs.
//   x1-mac-to-iphone  the Mac's Devot (frontmost, the caret in the note's body) gets a line typed
//                     at the end of the note (SYNC_LINE)
//   x2-iphone-to-mac  FilmShots' testX2TickATask ticks a task in the note open on the iPhone
// Both run on until SYNC_WAIT seconds (12) after the change.
async function sync(id: string, take: string) {
  if (!['x1-mac-to-iphone', 'x2-iphone-to-mac'].includes(id) || !/^\d+$/.test(take ?? '')) {
    fail('E_PHONE_ARGS sync <x1-mac-to-iphone|x2-iphone-to-mac> <take number>')
  }
  const binary = process.env['DEVOT_BINARY']
  const mac = binary ? pid(`${binary}$`) : 0
  if (!mac) fail('E_PHONE_SYNC the demo build (DEVOT_BINARY) must be running')
  const input = new Input(inputHelper(cache))
  const udid = simulator()
  const wait = Number(process.env['SYNC_WAIT'] ?? 12) * 1000
  const work = join(cache, 'phone-shots')
  mkdirSync(work, { recursive: true })
  mkdirSync(join(footage, 'sync'), { recursive: true })
  const name = `${id}-take${take}`
  const macRaw = join(work, `${name}-mac.mkv`)
  const phoneRaw = join(work, `${name}-iphone.mov`)
  for (const file of [macRaw, phoneRaw]) rmSync(file, { force: true })
  let screen: ChildProcess | undefined
  let phone: ChildProcess | undefined
  const stop = async (recorder: ChildProcess | undefined, quit: () => void) => {
    if (!recorder || recorder.exitCode !== null) return
    quit()
    await new Promise((resolve) => recorder.once('exit', resolve))
  }
  try {
    const [, , , scale, left, top] = (await input.send('screen')).split(' ').map(Number)
    await input.send('backdrop light')
    bringToFront(mac)
    await sleep(600)
    const window = windows(mac).find((w) => w.name === 'Devot')
    if (!window) fail('E_PHONE_SYNC the demo build shows no main window')
    const crop = [window.width, window.height, window.x - left!, window.y - top!]
      .map((n) => Math.round(n * scale!))
      .join(':')
    phone = spawn(
      'xcrun',
      ['simctl', 'io', udid, 'recordVideo', '--codec', 'hevc', '--force', phoneRaw],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    const phoneStarted = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`E_PHONE_RECORDING ${name}`)), 30_000)
      phone!.stderr!.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('Recording started')) {
          clearTimeout(timer)
          resolve(Date.now() / 1000)
        }
      })
    })
    screen = spawn(
      FFMPEG,
      [
        ...['-y', '-loglevel', 'error', '-f', 'avfoundation', '-capture_cursor', '1'],
        ...['-framerate', '30', '-use_wallclock_as_timestamps', '1'],
        ...['-i', `Capture screen ${process.env['MEDIA_SCREEN'] ?? 0}:none`],
        ...['-vf', `crop=${crop}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0'],
        ...['-copyts', macRaw],
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    )
    for (let i = 0; ; i++) {
      await sleep(250)
      try {
        if (Number.isFinite(firstFrameAt(macRaw))) break
      } catch {
        // No frame written yet.
      }
      if (i > 60) throw new Error(`E_MEDIA_RECORDING ${name}`)
    }
    await sleep(500)
    // Both cuts begin here, two still seconds before the change.
    let from = Date.now() / 1000
    const round = (n: number) => Math.round(n * 100) / 100
    const now = () => round(Date.now() / 1000 - from)
    const beats: { t: number; what: string }[] = []
    await sleep(2000)
    if (id === 'x1-mac-to-iphone') {
      const line = process.env['SYNC_LINE'] ?? 'Book the train to the coast'
      await input.send('layout')
      await sleep(500)
      // Command-Down puts the caret at the end of the note.
      await input.send('key 125 cmd')
      await sleep(400)
      beats.push({ t: now(), what: `type ${JSON.stringify(line)} on the Mac` })
      const text = `\n${line}`
      const times = typingTimes(text, 0, 12)
      const typing = Date.now()
      for (const [i, ch] of [...text].entries()) {
        await sleep(Math.max(0, times[i]! * 1000 - (Date.now() - typing)))
        await input.send(ch === '\n' ? 'key 36' : `text ${ch}`)
      }
      beats.push({ t: now(), what: 'typing ends; waiting for the iPhone' })
    } else {
      film(udid, 'testX2TickATask', 'light', work)
      const note = JSON.parse(readFileSync(join(work, `${id}-light.json`), 'utf8')) as ShotNote
      // The test runner takes its time to start: the cut begins a second before the test's shot.
      from = Math.max(from, note.start - 1)
      for (const beat of note.beats) {
        beats.push({ t: round(beat.t + note.start - from), what: `${beat.what} on the iPhone` })
      }
      beats.push({ t: now(), what: 'the test ends; waiting for the Mac' })
    }
    await sleep(wait)
    // A whole number of the Mac's frames, so both files are the same length to the frame.
    const frames = Math.round((Date.now() / 1000 - from) * 30)
    const length = frames / 30
    await stop(phone, () => phone!.kill('SIGINT'))
    await stop(screen, () => {
      screen!.stdin!.write('q')
      screen!.stdin!.end()
    })

    const macFile = `sync/${name}-mac.mp4`
    const phoneFile = `sync/${name}-iphone.mp4`
    execFileSync(FFMPEG, [
      ...['-y', '-v', 'error', '-ss', (from - firstFrameAt(macRaw)).toFixed(3), '-i', macRaw],
      ...['-t', (length + 1 / 30).toFixed(3), '-an', '-vf', 'fps=30'],
      ...['-frames:v', String(frames)],
      ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '12'],
      ...['-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(footage, macFile)],
    ])
    const steady = join(work, `${name}-iphone.mkv`)
    await constantRate(phoneRaw, steady, 60, { from: from - phoneStarted, length })
    encode(steady, join(footage, phoneFile), 60)
    rmSync(steady, { force: true })

    const sha = run('git', ['-C', devotDir!, 'rev-parse', '--short=7', 'HEAD'])
    const through = 'synced through a relay on this Mac'
    const macProbe = probe(join(footage, macFile))
    const phoneProbe = probe(join(footage, phoneFile))
    record({
      id,
      file: macFile,
      scheme: 'light',
      source: `demo build @ ${sha}, ${through}`,
      pixels: macProbe.pixels,
      points: [window.width, window.height],
      fps: 30,
      duration: round(macProbe.duration),
      cursor: true,
      beats,
      pair: phoneFile,
    } as { file: string })
    record({
      id,
      file: phoneFile,
      scheme: 'light',
      source: `${source(udid)}, ${through}`,
      pixels: phoneProbe.pixels,
      points: phoneProbe.pixels.map((n) => Math.round(n / 3)),
      fps: 60,
      duration: round(phoneProbe.duration),
      cursor: false,
      beats,
      pair: macFile,
    } as { file: string })
    console.log(
      `${macFile} ${macProbe.duration.toFixed(2)} s, ${phoneFile} ${phoneProbe.duration.toFixed(2)} s`,
    )
  } finally {
    phone?.kill('SIGINT')
    screen?.kill('SIGINT')
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
