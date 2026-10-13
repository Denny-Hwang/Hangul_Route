// E2E-only web build with the learner's weekly plan switched on (F-PLAN-002 P2-8).
//
// `flags.routeEnabled` is off in production, so the release build cannot play the weekly plan
// specs (route-proposal, route-plan, route). This script exports the release content (no story
// fixtures) with EXPO_PUBLIC_ROUTE_ENABLED=true and EXPO_PUBLIC_SHOW_ALL_LOCALES=1 (the QA flag that
// shows Spanish and Korean, for the 320 px pass of section 6) into its OWN directory
// (dist-e2e-route/, never dist/), then runs the PWA post-build.
//
// It exports on a Metro cache of its own (a fresh TMPDIR, removed after): babel-preset-expo inlines
// EXPO_PUBLIC_ values at transform time and Metro's transform cache key does not hold them, so with a
// shared cache a later release build could pick up a flag-on transform (or this build a flag-off one).
//
// Usage (from apps/mobile): pnpm build:web:route   then   E2E_ROUTE=1 pnpm test:e2e:web route
// (with E2E_ROUTE=1 the Playwright web server serves dist-e2e-route/).
// Never used by a deploy: Cloudflare builds run `build:web` from a clean checkout.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = 'dist-e2e-route';
const ownTmp = mkdtempSync(join(tmpdir(), 'hr-route-export-'));

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

const exportEnv = { ...process.env, TMPDIR: ownTmp, EXPO_PUBLIC_ROUTE_ENABLED: 'true', EXPO_PUBLIC_SHOW_ALL_LOCALES: '1' };
let status = 1;
try {
  status = run(process.execPath, [join(app, 'scripts', 'audio', 'gen-audio-map.mjs')]);
  if (status === 0 && interrupted === null) status = run('expo', ['export', '--platform', 'web', '--output-dir', out], exportEnv);
  if (status === 0 && interrupted === null) status = run(process.execPath, [join(app, 'scripts', 'pwa-postbuild.mjs'), out]);
} finally {
  rmSync(ownTmp, { recursive: true, force: true });
}
process.exitCode = interrupted !== null ? 130 : status;
