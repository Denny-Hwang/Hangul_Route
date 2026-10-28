// Local-only run config for row CM-3A S6 (unique port 4391); not committed.
import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:4391' },
  webServer: { command: 'PORT=4391 node scripts/serve-dist.mjs dist', url: 'http://localhost:4391', reuseExistingServer: false, timeout: 30_000 },
});
