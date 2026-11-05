import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const port = 4298;
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${port}` },
  webServer: { ...base.webServer!, command: `PORT=${port} node scripts/serve-dist.mjs dist`, url: `http://localhost:${port}`, reuseExistingServer: false },
});
