import { defineConfig, devices } from '@playwright/test';

/**
 * Web PWA end-to-end (nightly + on demand): builds are served from ./dist by
 * scripts/serve-dist.mjs. The Chromium binary path is overridable because
 * CI images ship their own build (PW_CHROMIUM).
 */
export default defineConfig({
  testDir: './e2e/web',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 5'],
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs dist',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
