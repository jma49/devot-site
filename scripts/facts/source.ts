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

/** A download that failed; `transient` when trying again may help (a 408, 429 or 5xx). */
export class FetchFailure extends Error {
  readonly transient: boolean

  constructor(message: string, transient: boolean) {
    super(message)
    this.transient = transient
  }
}

/** How often and how patiently a failed download is tried again. */
export interface Retry {
  attempts: number
  /** The wait before the second try; each later wait doubles it. */
  firstDelayMs: number
  wait: (ms: number) => Promise<void>
}

export const RETRY: Retry = {
  attempts: 4,
  firstDelayMs: 1_000,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

export interface DevotRead {
  files: Map<string, string>
  /** Files whose download kept failing in a way that may pass, such as GitHub being down. */
  unreachable: string[]
}

// No connection and timeouts reach here as other errors; only an HTTP status can rule a retry out.
const transient = (error: unknown) => !(error instanceof FetchFailure) || error.transient

async function fetchWithRetry(fetchText: FetchText, url: string, retry: Retry): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchText(url)
    } catch (error) {
      if (attempt >= retry.attempts || !transient(error)) throw error
      await retry.wait(retry.firstDelayMs * 2 ** (attempt - 1))
    }
  }
}

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

/**
 * The files the check reads. A checkout may lack some. A download tries each file again on a
 * failure that may pass, and lists it as unreachable after the last try; any other failure, such
 * as a file the pinned commit lacks, is E_FACT_FETCH.
 */
export async function readDevotFiles(
  source: DevotSource,
  fetchText: FetchText,
  retry: Retry = RETRY,
): Promise<DevotRead> {
  if (source.kind === 'checkout') {
    const files = new Map(
      DEVOT_FILES.filter((path) => existsSync(join(source.dir, path))).map((path) => [
        path,
        readFileSync(join(source.dir, path), 'utf8'),
      ]),
    )
    return { files, unreachable: [] }
  }
  const results = await Promise.allSettled(
    DEVOT_FILES.map(async (path) => {
      const url = `https://raw.githubusercontent.com/${DEVOT_REPO}/${source.commit}/${path}`
      try {
        return [path, await fetchWithRetry(fetchText, url, retry)] as const
      } catch (error) {
        if (transient(error)) return path
        throw new FactSourceError(
          'E_FACT_FETCH',
          `${url}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }),
  )
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
  const settled = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  return {
    files: new Map(settled.filter((entry) => typeof entry !== 'string')),
    unreachable: settled.filter((entry) => typeof entry === 'string'),
  }
}
