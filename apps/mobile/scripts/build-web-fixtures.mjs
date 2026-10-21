// E2E-only web build with the story fixtures (F-STORY-002 §5, PR 2.6a).
//
// No learner can open the reader until F-STORY-004's shelf ships, and the
// reader e2e needs the `window.__hrStoryE2E` entry plus fixture-specific
// content (`story:hangul-day`), so it runs against a bundle that holds the
// test fixtures. This script:
//   0. writes every module generated from content/ (scripts/generate.mjs, F-CURR-002 CM-6), since
//      the export below tells metro.config.js not to (HANGUL_ROUTE_GENERATE=off,
//      fixture-build-options.mjs), so Metro keeps the fixture stories of step 1,
//   1. regenerates apps/mobile/src/content/stories.generated.ts with
//      `build-stories.mjs --include-fixtures`, and the clip map with the
//      fixture tones of e2e/fixtures/audio (`gen-audio-map.mjs
//      --with-e2e-fixtures`, F-AUDIO-004 A-6: the offline clip e2e),
//   2. exports the web app into its OWN directory (default dist-e2e/, never
//      dist/, which build:web, serve:web and wrangler use) and runs the PWA
//      post-build (the fixture ids in that bundle switch on the
//      `window.__hrStoryE2E` entry, navigation/story-e2e.tsx),
//   3. ALWAYS restores the real bundle (plain `build-stories.mjs`) and the
//      real clip map (plain `gen-audio-map.mjs`), even when
//      the export fails or the build is interrupted (Ctrl-C), so the fixture
//      bundle is never left for a commit.
// No bundled value is keyed on an environment variable, so the Metro cache cannot
// carry the e2e entry into a later production build: the restored bundle has
// no fixture ids and the entry stays off.
//
// Usage (from apps/mobile): pnpm build:web:fixtures   then   STORY_FIXTURES=1 pnpm test:e2e:web story-reader
// (with STORY_FIXTURES=1 the Playwright web server serves dist-e2e/).
// The gating fixture bundle (F-STORY-004 PR 4.8b): pnpm build:web:fixtures:gated (`dist-e2e-gated
// --content-gating`: the same bundle with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true, exported on a Metro
// cache of its own, see fixture-build-options.mjs), then
// STORY_FIXTURES_GATED=1 pnpm test:e2e:web story-shelf-gated.spec.
// Never used by a deploy: Cloudflare builds run `build:web` from a clean checkout.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportEnv, fixtureBuildOptions } from './fixture-build-options.mjs';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const generateAll = join(app, '..', '..', 'scripts', 'generate.mjs');
const generator = join(app, '..', '..', 'scripts', 'build-stories.mjs');
const audioMap = join(app, 'scripts', 'audio', 'gen-audio-map.mjs');
let options;
try {
  options = fixtureBuildOptions(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const { out } = options;
// The gating bundle's own TMPDIR, so its Metro cache never mixes with the other builds' (removed after).
const ownTmp = options.contentGating ? mkdtempSync(join(tmpdir(), 'hr-gated-export-')) : null;

// A Ctrl-C reaches the child too; spawnSync then returns and the handler only
// records it, so the restore below still runs before the process exits.
let interrupted = null;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = signal;
  });
}

function run(command, args, env = process.env) {
  const r = spawnSync(command, args, { cwd: app, stdio: 'inherit', env });
  if (r.signal) interrupted = interrupted ?? r.signal;
  return r.status ?? 1;
}

let status = run(process.execPath, [generateAll]);
if (status === 0 && interrupted === null) status = run(process.execPath, [generator, '--include-fixtures']);
try {
  if (status === 0 && interrupted === null) status = run(process.execPath, [audioMap, '--with-e2e-fixtures']);
  if (status === 0 && interrupted === null) {
    status = run('expo', ['export', '--platform', 'web', '--output-dir', out], exportEnv(process.env, options, ownTmp));
  }
  if (status === 0 && interrupted === null) status = run(process.execPath, [join(app, 'scripts', 'pwa-postbuild.mjs'), out]);
} finally {
  if (ownTmp !== null) rmSync(ownTmp, { recursive: true, force: true });
  const restored = spawnSync(process.execPath, [generator], { cwd: app, stdio: 'inherit' }).status ?? 1;
  if (restored !== 0) status = restored;
  const mapRestored = spawnSync(process.execPath, [audioMap], { cwd: app, stdio: 'inherit' }).status ?? 1;
  if (mapRestored !== 0) status = mapRestored;
}
process.exitCode = interrupted !== null ? 130 : status;
