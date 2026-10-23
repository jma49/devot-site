import { expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

const workflows = filesUnder('.github/workflows')

it('pins every action by full commit SHA with a version comment', () => {
  const uses = workflows.flatMap((file) =>
    readRepoFile(file)
      .split('\n')
      .filter((line) => /^\s*-?\s*uses:/.test(line))
      .map((line) => `${file}: ${line.trim()}`),
  )
  expect(uses.length).toBeGreaterThan(0)
  expect(uses.filter((line) => !/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d/.test(line))).toEqual([])
})

it('keeps the job names that branch protection requires', () => {
  const ci = readRepoFile('.github/workflows/ci.yml')
  expect(ci).toMatch(/^ {2}check:$/m)
  expect(ci).toMatch(/^ {2}e2e:$/m)
  expect(ci).toMatch(/^permissions:\n {2}contents: read$/m)
})
