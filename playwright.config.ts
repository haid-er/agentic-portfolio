import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Sandbox ships Chromium here; never run "playwright install" in CI/sandbox.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('/opt/pw-browsers')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers'
}

const PORT = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Next + Chromium on one box: more workers starve the page and make timings meaningless.
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  // Run against the production server: `npm run build` first.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
    // Admin e2e saves in disk mode (never commits): no GitHub token, a throwaway signing key.
    env: {
      ...(process.env as Record<string, string>),
      ADMIN_SECRET: process.env.ADMIN_SECRET || 'e2e-only-signing-key-not-for-production',
      GITHUB_TOKEN: '',
      GITHUB_REPO: '',
    },
  },
})
