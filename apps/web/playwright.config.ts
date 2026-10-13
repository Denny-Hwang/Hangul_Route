import { defineConfig } from '@playwright/test';

/**
 * Landing layout e2e: the static export (./out, from `next build`) served by
 * e2e/serve-out.mjs the way the Cloudflare Worker serves it. Chromium only.
 *
 * `PORT` moves the server if the default is taken. A busy port fails loudly
 * (reuseExistingServer is off) instead of testing whatever else is listening.
 * `E2E_OUT` serves another export dir instead of ./out, such as F-APP-001's merged app-host build
 * (`../mobile/dist`) for billing.spec.ts. The Chromium binary is overridable because some CI images ship their own
 * build (PW_CHROMIUM).
 *
 * Every spec runs as an en-US browser (F-I18N-001 §3.11), so a QA export never shows
 * the LocaleBanner on a machine that prefers es or ko and the layout does not depend
 * on the machine's language; `locale-banner.spec.ts` sets its own locale per test.
 */
const PORT = Number(process.env.PORT ?? 4191);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: `node e2e/serve-out.mjs ${process.env.E2E_OUT ?? 'out'}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
