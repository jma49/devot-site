import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SLOTS, media } from '../../src/media.ts'
import { generatePlaceholders, paletteFrom } from './generate.ts'

const root = join(import.meta.dirname, '../..')
const args = process.argv.slice(2)
const unknown = args.filter((arg) => arg !== '--force')
if (unknown.length > 0) {
  console.error(`E_PLACEHOLDERS_ARGS unknown argument: ${unknown.join(' ')}`)
  process.exit(1)
}

try {
  const written = await generatePlaceholders({
    publicDir: join(root, 'public'),
    palette: paletteFrom(readFileSync(join(root, 'src/theme/tokens.css'), 'utf8')),
    slots: SLOTS.map((name) => media[name]),
    force: args.includes('--force'),
    encode: (ffmpeg) => execFileSync('ffmpeg', ['-v', 'error', ...ffmpeg], { stdio: 'inherit' }),
  })
  console.log(written.length > 0 ? written.join('\n') : 'Nothing to generate.')
} catch (error) {
  console.error(`E_PLACEHOLDERS_FAILED ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
}
