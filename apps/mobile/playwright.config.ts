import { defineConfig, devices } from '@playwright/test';

/**
 * Web PWA end-to-end (nightly + on demand): builds are served from ./dist (the
 * story fixture build from ./dist-e2e when STORY_FIXTURES=1, the gating fixture
 * build from ./dist-e2e-gated when STORY_FIXTURES_GATED=1) by
 * scripts/serve-dist.mjs. The Chromium binary path is overridable because
 * CI images ship their own build (PW_CHROMIUM).
 *
 * Every spec runs as an en-US browser (F-I18N-001 §3.11), so the specs' English
 * `getByText` stays English whatever language the machine prefers; `locale.spec.ts`
 * covers the other languages with its own `test.use({ locale })`.
 */
/** The bundle the web server serves: the gating fixture build, the fixture build or the release build. */
function serveDir(): string {
  if (process.env.STORY_FIXTURES_GATED === '1') return 'dist-e2e-gated';
  return process.env.STORY_FIXTURES === '1' ? 'dist-e2e' : 'dist';
}

export default defineConfig({
  testDir: './e2e/web',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 5'],
    locale: 'en-US',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    // STORY_FIXTURES=1: the story reader e2e runs on the fixture build (build:web:fixtures writes dist-e2e/).
    // STORY_FIXTURES_GATED=1: the gating fixture build (build:web:fixtures:gated writes dist-e2e-gated/).
    command: `node scripts/serve-dist.mjs ${serveDir()}`,
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
