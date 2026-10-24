import { join } from 'node:path'
import { en } from '../../src/i18n/en.ts'
import { annotate, factsReport } from './report.ts'
import {
  describeSource,
  devotSource,
  FactSourceError,
  FetchFailure,
  readDevotFiles,
} from './source.ts'

const TIMEOUT_MS = 15_000

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': 'devot-site-facts' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    const status = response.status
    throw new FetchFailure(`HTTP ${status}`, status === 408 || status === 429 || status >= 500)
  }
  return response.text()
}

try {
  if (process.argv.length > 2)
    throw new FactSourceError('E_FACT_ARGS', 'takes no arguments; set DEVOT_CHECKOUT instead')
  const source = devotSource(process.env, join(import.meta.dirname, '../..'))
  const { errors, warnings } = factsReport(await readDevotFiles(source, fetchText), en)
  for (const error of errors) console.error(error)
  for (const warning of warnings) console.warn(annotate(warning, process.env))
  if (errors.length > 0) process.exitCode = 1
  else if (warnings.length === 0) console.log(`facts match ${describeSource(source)}`)
} catch (error) {
  if (!(error instanceof FactSourceError)) throw error
  console.error(error.message)
  process.exitCode = 1
}
