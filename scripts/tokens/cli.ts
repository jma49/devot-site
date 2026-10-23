import { join } from 'node:path'
import { modeFromArgs, syncTokens, TokenSyncError } from './sync.ts'

async function fetchText(url: string): Promise<string> {
  const headers: Record<string, string> = { 'user-agent': 'devot-site-tokens' }
  // Only the GitHub API takes the token; unauthenticated calls are limited to 60 an hour.
  const token = process.env['GITHUB_TOKEN']
  if (token && url.startsWith('https://api.github.com/'))
    headers['authorization'] = `Bearer ${token}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

try {
  const mode = modeFromArgs(process.argv.slice(2))
  console.log(await syncTokens(mode, { root: join(import.meta.dirname, '../..'), fetchText }))
} catch (error) {
  if (!(error instanceof TokenSyncError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
