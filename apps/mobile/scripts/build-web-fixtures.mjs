// E2E-only web build with the story fixtures (F-STORY-002 §5, PR 2.6a).
//
// No learner can reach a story until F-STORY-004's shelf ships and no story
// is `ready` yet, so the reader's e2e needs a bundle that holds the test
// fixtures. This script:
//   1. regenerates apps/mobile/src/content/stories.generated.ts with
//      `build-stories.mjs --include-fixtures`,
//   2. exports the web app into dist/ and runs the PWA post-build (the
//      fixture ids in that bundle switch on the `window.__hrStoryE2E` entry,
//      navigation/story-e2e.tsx),
//   3. ALWAYS restores the real bundle (plain `build-stories.mjs`), even when
//      the export fails, so the fixture bundle is never left for a commit.
// Nothing is keyed on an environment variable, so the Metro cache cannot
// carry the e2e entry into a later production build: the restored bundle has
// no fixture ids and the entry stays off.
//
// Usage (from apps/mobile): pnpm build:web:fixtures   then   STORY_FIXTURES=1 pnpm test:e2e:web story-reader
// Never used by a deploy: Cloudflare builds run `build:web` from a clean checkout.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const generator = join(app, '..', '..', 'scripts', 'build-stories.mjs');
const dist = process.argv[2] ?? 'dist';

function run(command, args) {
  const r = spawnSync(command, args, { cwd: app, stdio: 'inherit' });
  return r.status ?? 1;
}

let status = run(process.execPath, [generator, '--include-fixtures']);
try {
  if (status === 0) {
    status = run('expo', ['export', '--platform', 'web', '--output-dir', dist]);
  }
  if (status === 0) status = run(process.execPath, [join(app, 'scripts', 'pwa-postbuild.mjs'), dist]);
} finally {
  const restored = run(process.execPath, [generator]);
  if (restored !== 0) status = restored;
}
process.exitCode = status;
