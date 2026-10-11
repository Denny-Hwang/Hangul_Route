// E2E-only web build with the story fixtures (F-STORY-002 §5, PR 2.6a).
//
// No learner can open the reader until F-STORY-004's shelf ships, and the
// reader e2e needs the `window.__hrStoryE2E` entry plus fixture-specific
// content (`story:hangul-day`), so it runs against a bundle that holds the
// test fixtures. This script:
//   1. regenerates apps/mobile/src/content/stories.generated.ts with
//      `build-stories.mjs --include-fixtures`,
//   2. exports the web app into its OWN directory (default dist-e2e/, never
//      dist/, which build:web, serve:web and wrangler use) and runs the PWA
//      post-build (the fixture ids in that bundle switch on the
//      `window.__hrStoryE2E` entry, navigation/story-e2e.tsx),
//   3. ALWAYS restores the real bundle (plain `build-stories.mjs`), even when
//      the export fails or the build is interrupted (Ctrl-C), so the fixture
//      bundle is never left for a commit.
// Nothing is keyed on an environment variable, so the Metro cache cannot
// carry the e2e entry into a later production build: the restored bundle has
// no fixture ids and the entry stays off.
//
// Usage (from apps/mobile): pnpm build:web:fixtures   then   STORY_FIXTURES=1 pnpm test:e2e:web story-reader
// (with STORY_FIXTURES=1 the Playwright web server serves dist-e2e/).
// Never used by a deploy: Cloudflare builds run `build:web` from a clean checkout.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const generator = join(app, '..', '..', 'scripts', 'build-stories.mjs');
const out = process.argv[2] ?? 'dist-e2e';
if (out === 'dist' || out === './dist') {
  console.error('build-web-fixtures: refusing to write the fixture build into dist/ (build:web, serve:web and wrangler use it).');
  process.exit(2);
}

// A Ctrl-C reaches the child too; spawnSync then returns and the handler only
// records it, so the restore below still runs before the process exits.
let interrupted = null;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = signal;
  });
}

function run(command, args) {
  const r = spawnSync(command, args, { cwd: app, stdio: 'inherit' });
  if (r.signal) interrupted = interrupted ?? r.signal;
  return r.status ?? 1;
}

let status = run(process.execPath, [generator, '--include-fixtures']);
try {
  if (status === 0 && interrupted === null) {
    status = run('expo', ['export', '--platform', 'web', '--output-dir', out]);
  }
  if (status === 0 && interrupted === null) status = run(process.execPath, [join(app, 'scripts', 'pwa-postbuild.mjs'), out]);
} finally {
  const restored = spawnSync(process.execPath, [generator], { cwd: app, stdio: 'inherit' }).status ?? 1;
  if (restored !== 0) status = restored;
}
process.exitCode = interrupted !== null ? 130 : status;
