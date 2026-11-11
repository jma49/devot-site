import { describe, expect, it } from 'vitest'
import { APP_STORE_URL } from '../../src/site.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// A link to the App Store that leads nowhere is worse than none.

describe('the App Store link', () => {
  it('is an address in the App Store, or nothing', () => {
    const given = APP_STORE_URL === undefined ? [] : [new URL(APP_STORE_URL)]
    const elsewhere = given.filter(
      (url) => url.origin !== 'https://apps.apple.com' || !/\/id\d+$/.test(url.pathname),
    )
    expect(elsewhere).toEqual([])
  })

  it('shows only where the page has the address', () => {
    const users = filesUnder('src').filter(
      (file) => file.endsWith('.astro') && readRepoFile(file).includes('href={APP_STORE_URL}'),
    )
    expect(users.length).toBeGreaterThan(0)
    for (const file of users) {
      const template = readRepoFile(file)
      expect(template.match(/href=\{APP_STORE_URL\}/g), file).toHaveLength(
        template.match(/\{APP_STORE_URL && \(/g)?.length ?? 0,
      )
    }
  })
})
