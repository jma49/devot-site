import { join } from 'node:path'
import { en } from '../../src/i18n/en.ts'
import { checkFacts } from './check.ts'
import { describeSource, devotSource, FactSourceError, readDevotFiles } from './source.ts'

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'devot-site-facts' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

try {
  if (process.argv.length > 2)
    throw new FactSourceError('E_FACT_ARGS', 'takes no arguments; set DEVOT_CHECKOUT instead')
  const source = devotSource(process.env, join(import.meta.dirname, '../..'))
  const problems = checkFacts(await readDevotFiles(source, fetchText), en)
  for (const { message } of problems) console.error(message)
  if (problems.length > 0) process.exitCode = 1
  else console.log(`facts match ${describeSource(source)}`)
} catch (error) {
  if (!(error instanceof FactSourceError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
