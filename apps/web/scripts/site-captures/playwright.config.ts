import { defineConfig } from '@playwright/test';

/**
 * The console product captures only (AMENDMENTS-SITE-NEWUSER §3.13): `console.capture.ts` in this folder, over the
 * reports e2e export served the way the Worker serves it (`e2e/serve-out.mjs`). Run on demand by a person, never in
 * CI (see `scripts/site-captures.mjs`). Paths are relative to this file.
 */
const PORT = Number(process.env.PORT ?? 4192);

export default defineConfig({
  testDir: '.',
  testMatch: '*.capture.ts',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: `node ../../e2e/serve-out.mjs ${JSON.stringify(process.env.E2E_OUT ?? '../../out')}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
