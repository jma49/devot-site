import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { REPO } from '../support/source-files.ts'
import { tempDir } from '../support/temp-dirs.ts'

// Drives the real lefthook.yml through `git push` into a bare remote. Only the guard runs: the other
// pre-push jobs need the whole checkout.

const BLOCKED = 'Pushing to main is blocked'

const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^(GIT_|LEFTHOOK)/.test(name)),
  ),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  LEFTHOOK_BIN: join(REPO, 'node_modules/.bin/lefthook'),
  LEFTHOOK_EXCLUDE: 'format,typecheck,unit-tests',
}

function run(cwd: string, command: string, args: string[], extra: Record<string, string> = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...env, ...extra }, encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

function git(cwd: string, ...args: string[]): string {
  const result = run(cwd, 'git', args, { LEFTHOOK: '0' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.output}`)
  return result.output.trim()
}

const push = (cwd: string, ...args: string[]) => run(cwd, 'git', ['push', ...args])

describe('the pre-push hook', () => {
  const root = tempDir('devot-site-push-')
  const remote = join(root, 'remote.git')
  const work = join(root, 'work')
  const remoteMain = () => git(remote, 'rev-parse', 'main')

  beforeAll(() => {
    git(root, 'init', '--quiet', '--bare', '--initial-branch=main', remote)
    mkdirSync(work)
    git(work, 'init', '--quiet', '--initial-branch=main')
    cpSync(join(REPO, 'lefthook.yml'), join(work, 'lefthook.yml'))
    cpSync(join(REPO, '.lefthook'), join(work, '.lefthook'), { recursive: true })
    writeFileSync(join(work, 'a.txt'), 'a\n')
    git(work, 'add', '.')
    git(work, 'commit', '--quiet', '-m', 'init')
    git(work, 'remote', 'add', 'origin', remote)
    git(work, 'push', '--quiet', '-u', 'origin', 'main')
    const install = run(work, env.LEFTHOOK_BIN, ['install'])
    if (install.status !== 0) throw new Error(`lefthook install: ${install.output}`)
  })

  it('lets a branch through', () => {
    git(work, 'switch', '--quiet', '-c', 'feat/x')
    writeFileSync(join(work, 'b.txt'), 'b\n')
    git(work, 'add', 'b.txt')
    git(work, 'commit', '--quiet', '-m', 'b')

    const result = push(work, '-u', 'origin', 'feat/x')

    expect(result.status, result.output).toBe(0)
    expect(git(remote, 'rev-parse', 'feat/x')).toBe(git(work, 'rev-parse', 'HEAD'))
  })

  it('blocks pushing a branch that is already on the remote to main', () => {
    const before = remoteMain()

    const result = push(work, 'origin', 'HEAD:main')

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(BLOCKED)
    expect(remoteMain()).toBe(before)
  })

  it('blocks a push from main of an empty commit or of only a deletion', () => {
    git(work, 'switch', '--quiet', 'main')
    const before = remoteMain()

    git(work, 'commit', '--quiet', '--allow-empty', '-m', 'empty')
    const empty = push(work, 'origin', 'main')
    expect(empty.status).not.toBe(0)
    expect(empty.output).toContain(BLOCKED)

    git(work, 'reset', '--quiet', '--hard', 'origin/main')
    rmSync(join(work, 'a.txt'))
    git(work, 'commit', '--quiet', '-am', 'delete')
    const deletion = push(work)
    expect(deletion.status).not.toBe(0)
    expect(deletion.output).toContain(BLOCKED)

    expect(remoteMain()).toBe(before)
  })
})
