import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { themeFiles } from './generate.ts'
import { THEME_FAMILIES } from './palettes.ts'

const root = join(import.meta.dirname, '../..')
const check = process.argv.includes('--check')
const files = themeFiles(readFileSync(join(root, 'src/theme/tokens.css'), 'utf8'), THEME_FAMILIES)
const read = (path: string) => {
  try {
    return readFileSync(join(root, path), 'utf8')
  } catch {
    return undefined
  }
}
const stale = [...files].filter(([path, text]) => read(path) !== text).map(([path]) => path)
if (check) {
  if (stale.length > 0) {
    console.error(`E_PLUGIN_THEMES_STALE ${stale.join(' ')} (run pnpm plugin-themes)`)
    process.exitCode = 1
  }
} else {
  for (const path of stale) writeFileSync(join(root, path), files.get(path)!)
  console.log(`${stale.length} of ${files.size} theme files written`)
}
