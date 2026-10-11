// Writes src/content/__generated__/audio-assets.ts from assets/audio/**/*.mp3
// (F-AUDIO-004 §3.10). Metro needs literal require paths, so the clip map is
// generated, committed, and checked for drift by
// src/content/__tests__/audio-assets-drift.test.ts. Runs from `audio:map` and
// before every `build:web`.
//
//   node scripts/audio/gen-audio-map.mjs           write the map
//   node scripts/audio/gen-audio-map.mjs --check   exit 1 if the committed map is stale
//
// HR_E2E_AUDIO_FIXTURES=1 also maps the clips under e2e/fixtures/audio, for a
// local test build of the offline clip e2e only. Never set it for a deploy build,
// and never commit the map it writes (the drift test fails on it).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSET_MAP_FILE,
  AUDIO_DIR,
  AUDIO_REQUIRE_BASE,
  E2E_FIXTURE_DIR,
  E2E_FIXTURE_REQUIRE_BASE,
  buildAssetMap,
  mergeAssetMaps,
  renderAssetMap,
} from './lib.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every file under `dir`, as paths relative to it (dot folders included, so nothing hides). */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out;
}

const withFixtures = process.env.HR_E2E_AUDIO_FIXTURES === '1';
const shipped = buildAssetMap(listFiles(join(appRoot, AUDIO_DIR)), AUDIO_REQUIRE_BASE);
const shippedRefs = new Set(shipped.map((e) => e.ref));
// A real recording always wins over a fixture for the same ref.
const fixtures = withFixtures
  ? buildAssetMap(listFiles(join(appRoot, E2E_FIXTURE_DIR)), E2E_FIXTURE_REQUIRE_BASE).filter((e) => !shippedRefs.has(e.ref))
  : [];
const source = renderAssetMap(mergeAssetMaps(shipped, fixtures));
const target = join(appRoot, ASSET_MAP_FILE);

if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== source) {
    process.stderr.write(`${ASSET_MAP_FILE} is stale: run pnpm --filter @hangul-route/mobile audio:map\n`);
    process.exit(1);
  }
  process.stdout.write(`audio:map up to date (${shipped.length} clips)\n`);
} else {
  writeFileSync(target, source);
  process.stdout.write(`audio:map wrote ${shipped.length} clips to ${ASSET_MAP_FILE}\n`);
  if (withFixtures) {
    process.stdout.write(`audio:map TEST BUILD: added ${fixtures.length} e2e fixture clips. Do not deploy this build or commit the map.\n`);
  }
}
