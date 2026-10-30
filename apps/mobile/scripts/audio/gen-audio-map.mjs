// Writes src/content/__generated__/audio-assets.ts from assets/audio/**/*.mp3
// (F-AUDIO-004 §3.10). Metro needs literal require paths, so the clip map is
// generated, committed, and checked for drift by
// src/content/__tests__/audio-assets-drift.test.ts. Runs from `audio:map` and
// before every `build:web`.
//
//   node scripts/audio/gen-audio-map.mjs                       write the map
//   node scripts/audio/gen-audio-map.mjs --check               exit 1 if the committed map is stale
//   node scripts/audio/gen-audio-map.mjs --with-e2e-fixtures   also map e2e/fixtures/audio
//
// --with-e2e-fixtures is for the e2e-only fixture build (build:web:fixtures,
// which restores the plain map afterwards); a real recording wins over a
// fixture for the same ref. The drift test fails if that map is ever committed,
// and build:web always regenerates the plain map first.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSET_MAP_FILE,
  AUDIO_DIR,
  AUDIO_REQUIRE_BASE,
  E2E_FIXTURE_DIR,
  E2E_FIXTURE_REQUIRE_BASE,
  TTS_MANIFEST_FILE,
  buildAssetMap,
  clipPacksOf,
  jamoClipRefs,
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

const withFixtures = process.argv.includes('--with-e2e-fixtures');
// Each clip's pack (AMENDMENTS-AUDIO-CLIPS AC-B6): the clip manifest's (content/audio/tts-manifest.json, row AC-2),
// else the one jamo.ts declares for a jamo clip. A clip in neither (a story or card recording) carries none.
const jamoPacks = new Map(jamoClipRefs(readFileSync(join(appRoot, 'src/content/jamo.ts'), 'utf8')).map((r) => [r.ref, r.pack]));
const manifestPath = join(appRoot, '..', '..', TTS_MANIFEST_FILE);
const manifestPacks = clipPacksOf(existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null);
const packOf = (ref) => manifestPacks.get(ref) ?? jamoPacks.get(ref);
const shipped = buildAssetMap(listFiles(join(appRoot, AUDIO_DIR)), AUDIO_REQUIRE_BASE, packOf);
const shippedRefs = new Set(shipped.map((e) => e.ref));
// A real recording always wins over a fixture for the same ref.
const fixtures = withFixtures
  ? buildAssetMap(listFiles(join(appRoot, E2E_FIXTURE_DIR)), E2E_FIXTURE_REQUIRE_BASE, packOf).filter((e) => !shippedRefs.has(e.ref))
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
    process.stdout.write(`audio:map e2e fixture build: added ${fixtures.length} fixture clips (never commit this map).\n`);
  }
}
