import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const REPO = join(import.meta.dirname, '../..')

/** Every file under a repo folder, as repo-relative paths with forward slashes. */
export function filesUnder(folder: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory()
        ? walk(path)
        : [relative(REPO, path).split('\\').join('/')]
    })
  return walk(join(REPO, folder))
}

export const readRepoFile = (path: string) => readFileSync(join(REPO, path), 'utf8')
