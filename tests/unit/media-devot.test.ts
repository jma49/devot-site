import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { checkoutDir, checkoutSteps, pinnedCommit } from '../../scripts/media/devot.ts'
import { tempDir } from '../support/temp-dirs.ts'

const SHA = '8923fee2085837645268187230010acc2cbe7d15'

it('reads the pinned devot commit', () => {
  const root = tempDir('media-pin-')
  writeFileSync(join(root, 'devot.pin.json'), JSON.stringify({ commit: SHA }))
  expect(pinnedCommit(root)).toBe(SHA)
})

it('refuses a pin that is not a full commit', () => {
  const root = tempDir('media-pin-')
  writeFileSync(join(root, 'devot.pin.json'), JSON.stringify({ commit: 'main' }))
  expect(() => pinnedCommit(root)).toThrow(/^E_MEDIA_PIN/)
  expect(() => pinnedCommit(tempDir('media-pin-'))).toThrow(/^E_MEDIA_PIN/)
})

it('keeps one checkout per commit in the cache', () => {
  expect(checkoutDir('/repo/.cache/media', SHA)).toBe(`/repo/.cache/media/devot/${SHA}`)
})

it('clones without checking out, detaches at the commit, then installs exactly the lockfile', () => {
  const dir = `/cache/devot/${SHA}`
  expect(checkoutSteps({ source: 'https://github.com/jma49/devot.git', dir, commit: SHA })).toEqual(
    [
      {
        command: 'git',
        args: [
          'clone',
          '--filter=blob:none',
          '--no-checkout',
          'https://github.com/jma49/devot.git',
          dir,
        ],
      },
      { command: 'git', args: ['-C', dir, 'checkout', '--quiet', '--detach', SHA] },
      { command: 'pnpm', args: ['install', '--frozen-lockfile'], cwd: dir },
    ],
  )
})
