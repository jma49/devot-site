import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEVOT_FILES } from './check.ts'

const DEVOT_REPO = 'jma49/devot'
const PIN_FILE = 'devot.pin.json'
const SHA = /^[0-9a-f]{40}$/

export type FactSourceCode = 'E_FACT_PIN' | 'E_FACT_FETCH' | 'E_FACT_ARGS'

export class FactSourceError extends Error {
  readonly code: FactSourceCode

  constructor(code: FactSourceCode, detail: string) {
    super(`${code} ${detail}`)
    this.code = code
  }
}

export type DevotSource =
  | { kind: 'checkout'; dir: string; commit?: string }
  | { kind: 'github'; commit: string }

export type FetchText = (url: string) => Promise<string>

/**
 * Where Devot's files come from: the checkout `DEVOT_CHECKOUT` names, else the pinned commit,
 * from the clone `pnpm media:capture` keeps under `MEDIA_CACHE` when there is one, else from GitHub.
 */
export function devotSource(env: Record<string, string | undefined>, root: string): DevotSource {
  const checkout = env['DEVOT_CHECKOUT']
  if (checkout) return { kind: 'checkout', dir: checkout }
  const commit = pinnedCommit(root)
  const cached = join(env['MEDIA_CACHE'] ?? join(root, '.cache/media'), 'devot', commit)
  return existsSync(cached) ? { kind: 'checkout', dir: cached, commit } : { kind: 'github', commit }
}

function pinnedCommit(root: string): string {
  let commit: unknown
  try {
    commit = (JSON.parse(readFileSync(join(root, PIN_FILE), 'utf8')) as { commit?: unknown }).commit
  } catch (error) {
    throw new FactSourceError('E_FACT_PIN', `${PIN_FILE} is unreadable: ${String(error)}`)
  }
  if (typeof commit !== 'string' || !SHA.test(commit))
    throw new FactSourceError('E_FACT_PIN', `${PIN_FILE} must hold {"commit": "<40-hex SHA>"}`)
  return commit
}

export function describeSource(source: DevotSource): string {
  if (source.kind === 'github') return `${DEVOT_REPO}@${source.commit} (GitHub)`
  return source.commit ? `${DEVOT_REPO}@${source.commit} (${source.dir})` : source.dir
}

/** The files the check reads; a checkout may lack some, a download must not. */
export async function readDevotFiles(
  source: DevotSource,
  fetchText: FetchText,
): Promise<Map<string, string>> {
  if (source.kind === 'checkout') {
    return new Map(
      DEVOT_FILES.filter((path) => existsSync(join(source.dir, path))).map((path) => [
        path,
        readFileSync(join(source.dir, path), 'utf8'),
      ]),
    )
  }
  const entries = await Promise.all(
    DEVOT_FILES.map(async (path) => {
      const url = `https://raw.githubusercontent.com/${DEVOT_REPO}/${source.commit}/${path}`
      try {
        return [path, await fetchText(url)] as const
      } catch (error) {
        throw new FactSourceError(
          'E_FACT_FETCH',
          `${url}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }),
  )
  return new Map(entries)
}
