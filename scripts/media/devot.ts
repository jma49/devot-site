import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export const DEVOT_GIT = 'https://github.com/jma49/devot.git'

const SHA = /^[0-9a-f]{40}$/

/** The devot commit in devot.pin.json: the captures show the app at the same commit as the tokens. */
export function pinnedCommit(root: string): string {
  let commit: unknown
  try {
    commit = (
      JSON.parse(readFileSync(join(root, 'devot.pin.json'), 'utf8')) as { commit?: unknown }
    ).commit
  } catch {
    commit = undefined
  }
  if (typeof commit !== 'string' || !SHA.test(commit)) {
    throw new Error('E_MEDIA_PIN devot.pin.json must hold {"commit": "<40-hex SHA>"}')
  }
  return commit
}

export const checkoutDir = (cache: string, commit: string) => join(cache, 'devot', commit)

export interface Step {
  command: string
  args: string[]
  cwd?: string
}

export function checkoutSteps({
  source,
  dir,
  commit,
}: {
  source: string
  dir: string
  commit: string
}): Step[] {
  return [
    { command: 'git', args: ['clone', '--filter=blob:none', '--no-checkout', source, dir] },
    { command: 'git', args: ['-C', dir, 'checkout', '--quiet', '--detach', commit] },
    { command: 'pnpm', args: ['install', '--frozen-lockfile'], cwd: dir },
  ]
}

function head(dir: string): string | null {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/** A devot checkout at `commit` with its dependencies installed; made once per commit. */
export function ensureDevot({
  cache,
  commit,
  source,
  log,
}: {
  cache: string
  commit: string
  source: string
  log: (line: string) => void
}): string {
  const dir = checkoutDir(cache, commit)
  if (head(dir) === commit && existsSync(join(dir, 'node_modules', '.modules.yaml'))) return dir
  rmSync(dir, { recursive: true, force: true })
  for (const step of checkoutSteps({ source, dir, commit })) {
    log(`${step.command} ${step.args.join(' ')}`)
    try {
      execFileSync(step.command, step.args, {
        cwd: step.cwd,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, CI: '1' },
      })
    } catch (error) {
      const stderr = String((error as { stderr?: unknown }).stderr ?? '').slice(-400)
      throw new Error(`E_MEDIA_CHECKOUT ${step.command} ${step.args[0]} failed: ${stderr}`, {
        cause: error,
      })
    }
  }
  return dir
}

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

/** Devot's UI-test build: its real renderer with notes kept in the page's storage and no Tauri. */
export async function startServer({
  dir,
  port,
  reuse,
}: {
  dir: string
  port: number
  reuse: boolean
}): Promise<{ url: string; stop: () => void }> {
  const url = `http://localhost:${port}`
  if (await answers(url)) {
    if (reuse) return { url, stop: () => {} }
    throw new Error(`E_MEDIA_PORT_BUSY ${port}: stop that server or set MEDIA_REUSE_SERVER=1`)
  }
  const server = spawn(
    'pnpm',
    ['exec', 'vite', '--config', 'vite.ui-test.config.ts', '--port', String(port), '--strictPort'],
    { cwd: dir, env: { ...process.env, DEVOT_SENTRY_DSN: '' }, stdio: 'ignore', detached: true },
  )
  const stop = () => {
    if (server.pid && server.exitCode === null) process.kill(-server.pid, 'SIGTERM')
  }
  const deadline = Date.now() + 90_000
  while (!(await answers(url))) {
    if (Date.now() > deadline || server.exitCode !== null) {
      stop()
      throw new Error(`E_MEDIA_SERVER ${url} did not answer`)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return { url, stop }
}
