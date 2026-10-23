import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE_URL } from '../../src/site.ts'
import { builtClips } from '../support/clip-policy.ts'
import { allows, directives, siteCsp } from '../support/headers.ts'
import { filesUnder, readRepoFile, REPO } from '../support/source-files.ts'

// Every clip a built page carries: its files exist and the policy lets the page load them.

const csp = directives(siteCsp(readRepoFile('dist/_headers')))
const pages = filesUnder('dist').filter((file) => file.endsWith('.html'))
const pageUrl = (page: string) =>
  new URL(page.replace(/^dist\//, '').replace(/index\.html$/, ''), SITE_URL).href
const inBuild = (url: string, page: string) =>
  existsSync(join(REPO, 'dist', decodeURIComponent(new URL(url, pageUrl(page)).pathname)))

describe.each(pages)('%s', (page) => {
  const html = readRepoFile(page)
  const clips = builtClips(html)

  it('has no autoplay attribute', () => {
    expect(html).not.toMatch(/\bautoplay\b/i)
  })

  it('carries clips that load late and start from a script', () => {
    expect(clips.flatMap(({ problems }) => problems)).toEqual([])
  })

  it('has every poster and source in the build, and the policy allows them', () => {
    const missing = clips.flatMap(({ poster, sources }) =>
      [poster ?? '', ...sources].filter((url) => !inBuild(url, page)),
    )
    const blocked = clips.flatMap(({ poster, sources }) => [
      ...(poster && !allows(csp.get('img-src') ?? [], poster, pageUrl(page)) ? [poster] : []),
      ...sources.filter((url) => !allows(csp.get('media-src') ?? [], url, pageUrl(page))),
    ])
    expect(missing).toEqual([])
    expect(blocked).toEqual([])
  })
})
