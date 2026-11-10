import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The input helper's binary (input.swift), built from its source the first time and again when
 * the source changes.
 */
export function inputHelper(cache: string): string {
  const helper = join(cache, 'bin', 'devot-input')
  const source = join(import.meta.dirname, 'input.swift')
  if (!existsSync(helper) || statSync(helper).mtimeMs < statSync(source).mtimeMs) {
    mkdirSync(join(cache, 'bin'), { recursive: true })
    execFileSync('swiftc', ['-O', source, '-o', helper], { stdio: ['ignore', 'ignore', 'inherit'] })
  }
  return helper
}
