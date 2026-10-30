import base from './playwright.config';

// Local only (not committed): the same suite on a port of its own, so parallel worktrees never share a server.
export default {
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:4396' },
  webServer: { ...base.webServer, command: `PORT=4396 node scripts/serve-dist.mjs ${process.env.PN4_DIST ?? 'dist'}`, url: 'http://localhost:4396', reuseExistingServer: false },
};
