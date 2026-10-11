// E2E-only web build with the story fixtures (F-STORY-002 §5, PR 2.6a).
//
// No learner can reach a story until F-STORY-004's shelf ships and no story
// is `ready` yet, so the reader's e2e needs a bundle that holds the test
// fixtures. This script:
//   1. regenerates apps/mobile/src/content/stories.generated.ts with
//      `build-stories.mjs --include-fixtures`,
//   2. exports the web app with EXPO_PUBLIC_STORY_FIXTURES=1 (installs the
//      `window.__hrStoryE2E` entry, navigation/story-e2e.tsx) into dist/ and
//      runs the PWA post-build,
//   3. ALWAYS restores the real bundle (plain `build-stories.mjs`), even when
//      the export fails, so the fixture bundle is never left for a commit.
// The Metro cache is cleared on both sides of the fixture export so no
// transform carrying the flag survives into a later production build.
//
// Usage (from apps/mobile): pnpm build:web:fixtures   then   STORY_FIXTURES=1 pnpm test:e2e:web story-reader
// Never used by a deploy: Cloudflare builds run `build:web` from a clean checkout.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const generator = join(app, '..', '..', 'scripts', 'build-stories.mjs');
const dist = process.argv[2] ?? 'dist';

function run(command, args, env = {}) {
  const r = spawnSync(command, args, { cwd: app, stdio: 'inherit', env: { ...process.env, ...env } });
  return r.status ?? 1;
}

let status = run(process.execPath, [generator, '--include-fixtures']);
try {
  if (status === 0) {
    status = run('expo', ['export', '--platform', 'web', '--output-dir', dist, '--clear'], { EXPO_PUBLIC_STORY_FIXTURES: '1' });
  }
  if (status === 0) status = run(process.execPath, [join(app, 'scripts', 'pwa-postbuild.mjs'), dist]);
} finally {
  const restored = run(process.execPath, [generator]);
  if (restored !== 0) status = restored;
}
process.exitCode = status;
