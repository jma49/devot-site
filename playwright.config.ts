import { defineConfig, devices } from '@playwright/test'

// Smoke tests against the built site (`pnpm build` first), served by `astro preview`.
// SITE_UI_PORT moves the server so checkouts can run side by side. A server already on the port fails
// the run, since it may be another checkout's; SITE_REUSE_SERVER=1 reuses it.
const port = Number(process.env['SITE_UI_PORT'] ?? 4322)
const ci = !!process.env['CI']

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // Two workers: the hosted runner has two cores, and a local run leaves the machine usable.
  workers: ci ? 2 : Number(process.env['SITE_UI_WORKERS'] ?? 2),
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Astro moves `preview` to the background when it detects an agent; --ignore-lock keeps it in
    // the foreground so Playwright owns the process and stops it.
    command: `pnpm exec astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !!process.env['SITE_REUSE_SERVER'],
  },
})
