import { defineConfig, devices } from '@playwright/test';

/**
 * Web PWA end-to-end (nightly + on demand): builds are served from ./dist (the
 * story fixture build from ./dist-e2e when STORY_FIXTURES=1, the gating fixture
 * build from ./dist-e2e-gated when STORY_FIXTURES_GATED=1, the weekly plan build from
 * ./dist-e2e-route when E2E_ROUTE=1, F-PLAN-002 P2-8) by
 * scripts/serve-dist.mjs. The Chromium binary path is overridable because
 * CI images ship their own build (PW_CHROMIUM).
 *
 * Every spec runs as an en-US browser (F-I18N-001 §3.11), so the specs' English
 * `getByText` stays English whatever language the machine prefers; `locale.spec.ts`
 * covers the other languages with its own `test.use({ locale })`.
 */
/** The bundle the web server serves: the gating fixture build, the weekly plan build, the fixture build or the release build. */
function serveDir(): string {
  if (process.env.STORY_FIXTURES_GATED === '1') return 'dist-e2e-gated';
  // E2E_ROUTE=1: the weekly plan specs run on build:web:route (flags.routeEnabled on, es and ko shown).
  if (process.env.E2E_ROUTE === '1') return 'dist-e2e-route';
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
  // E2E_WEBKIT=1: the same specs in WebKit on an iPhone (iOS Safari and the installed iOS app, where `beforeunload`
  // is not reliable; AMENDMENTS-DISPLAY-NAV section 7.2), run locally on demand. CI installs only Chromium.
  ...(process.env.E2E_WEBKIT === '1' ? { projects: [{ name: 'webkit-iphone', use: { ...devices['iPhone 13'], locale: 'en-US' } }] } : {}),
  webServer: {
    // STORY_FIXTURES=1: the story reader e2e runs on the fixture build (build:web:fixtures writes dist-e2e/).
    // STORY_FIXTURES_GATED=1: the gating fixture build (build:web:fixtures:gated writes dist-e2e-gated/).
    command: `node scripts/serve-dist.mjs ${serveDir()}`,
    url: 'http://localhost:4173',
    // Only the release bundle may reuse a server already listening: a run that names another bundle
    // (fixtures, gating, weekly plan) always serves that bundle, never a leftover release server.
    reuseExistingServer: serveDir() === 'dist',
    timeout: 30_000,
  },
});
