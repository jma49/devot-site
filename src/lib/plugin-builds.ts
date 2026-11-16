// Official plugins whose package is built from a library: their files are made here at build time, beside the
// plugin's own files in `plugins/<folder>/`, from the versions pinned in package.json.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { buildSync } from 'esbuild'

export interface BuiltFile {
  path: string
  bytes: Uint8Array<ArrayBuffer>
}

// The repository root: the build and the tests run there, and a bundled module's own path says nothing of it.
const ROOT = process.cwd()
const EXCALIDRAW = join(ROOT, 'node_modules/@excalidraw/excalidraw/dist/prod')
/** Excalidraw's CJK handwriting face is 13 MB in 209 files, past what a plugin may hold; CJK text takes the system font. */
const LEFT_OUT_FONTS = new Set(['Xiaolai'])

const bytesOf = (data: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(data)

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

function excalidraw(): BuiltFile[] {
  const out = join(ROOT, 'plugins/excalidraw/excalidraw')
  const result = buildSync({
    entryPoints: [join(ROOT, 'plugins/excalidraw/source/editor.js')],
    bundle: true,
    format: 'esm',
    splitting: true,
    minify: true,
    write: false,
    outdir: out,
    entryNames: '[name]',
    chunkNames: '[name]-[hash]',
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env': '{"PROD":true,"DEV":false,"MODE":"production"}',
    },
    alias: {
      '@excalidraw/mermaid-to-excalidraw': join(ROOT, 'plugins/excalidraw/source/no-mermaid.js'),
    },
    logLevel: 'silent',
  })
  const scripts = result.outputFiles.map((f) => ({
    path: `excalidraw/${relative(out, f.path).replaceAll('\\', '/')}`,
    bytes: bytesOf(f.contents),
  }))
  const fonts = filesUnder(join(EXCALIDRAW, 'fonts'))
    .filter(
      (path) => !LEFT_OUT_FONTS.has(relative(join(EXCALIDRAW, 'fonts'), path).split(/[\\/]/)[0]!),
    )
    .map((path) => ({
      path: `excalidraw/${relative(EXCALIDRAW, path).replaceAll('\\', '/')}`,
      bytes: bytesOf(readFileSync(path)),
    }))
  const css = {
    path: 'excalidraw/index.css',
    bytes: bytesOf(readFileSync(join(EXCALIDRAW, 'index.css'))),
  }
  return [...scripts, css, ...fonts]
}

const BUILDS: Readonly<Record<string, () => BuiltFile[]>> = { excalidraw }
const built = new Map<string, BuiltFile[]>()

/** The files built for a plugin's package by folder, made once a process; none for a plugin without a build. */
export function builtFiles(folder: string): BuiltFile[] {
  const build = BUILDS[folder]
  if (!build) return []
  if (!built.has(folder)) built.set(folder, build())
  return built.get(folder)!
}
