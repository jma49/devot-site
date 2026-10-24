import type { Messages } from '../../src/i18n/en.ts'
import { checkFacts, factsReading } from './check.ts'
import { RETRY, type DevotRead } from './source.ts'

export interface FactsReport {
  /** Mismatches and unreadable sources: each fails the run. */
  errors: string[]
  /** Checks skipped because their files could not be downloaded: these do not fail the run. */
  warnings: string[]
}

/**
 * Checks the files that arrived, so a mismatch in them still fails the run, and turns the files
 * that could not be downloaded into one warning naming the checks it skipped.
 */
export function factsReport(read: DevotRead, copy: Messages): FactsReport {
  const errors = checkFacts(read.files, copy, read.unreachable).map(({ message }) => message)
  if (read.unreachable.length === 0) return { errors, warnings: [] }
  const skipped = factsReading(read.unreachable)
  return {
    errors,
    warnings: [
      `W_FACT_UNREACHABLE GitHub did not serve ${read.unreachable.join(', ')} after ${RETRY.attempts} tries, ` +
        `so these checks did not run: ${skipped.join(', ')}. Run pnpm facts again once GitHub answers.`,
    ],
  }
}

/** A warning as GitHub Actions shows it on the run's summary, or as it is elsewhere. */
export function annotate(warning: string, env: Record<string, string | undefined>): string {
  return env['GITHUB_ACTIONS'] === 'true' ? `::warning title=pnpm facts::${warning}` : warning
}
