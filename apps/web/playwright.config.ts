import { defineConfig } from '@playwright/test';

/**
 * Landing layout e2e: the static export (./out, from `next build`) served by
 * e2e/serve-out.mjs the way the Cloudflare Worker serves it. Chromium only.
 *
 * `PORT` moves the server if the default is taken. A busy port fails loudly
 * (reuseExistingServer is off) instead of testing whatever else is listening.
 * The Chromium binary is overridable because some CI images ship their own
 * build (PW_CHROMIUM).
 */
const PORT = Number(process.env.PORT ?? 4191);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'node e2e/serve-out.mjs out',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
