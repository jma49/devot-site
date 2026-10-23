import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Capped so a local run leaves the machine usable; SITE_TEST_WORKERS raises it. CI keeps the default.
    ...(process.env['CI'] ? {} : { maxWorkers: Number(process.env['SITE_TEST_WORKERS'] ?? 3) }),
    silent: 'passed-only',
    setupFiles: ['tests/support/temp-dirs.setup.ts'],
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts', 'tests/policy/**/*.test.ts'] },
      },
      // Reads dist/, so it runs only after `pnpm build`.
      { extends: true, test: { name: 'dist', include: ['tests/built/**/*.test.ts'] } },
    ],
  },
})
