// Writes src/content/__generated__/audio-assets.ts from assets/audio/**/*.mp3
// (F-AUDIO-004 §3.10). Metro needs literal require paths, so the clip map is
// generated, committed, and checked for drift by
// src/content/__tests__/audio-assets-drift.test.ts. Runs from `audio:map` and
// before every `build:web`.
// AMENDMENTS-AUDIO-CLIPS AC-B6 (row AC-6): the start map holds only the precached pack's clips (`jamo-s1`) and the ones
// with no pack; every other pack's clips are a map chunk of their own, `__generated__/audio-packs/audio-pack-<pack>.ts`,
// reached only through the start map's literal `import()`s (`loadAudioPackChunk`), with the warm units of the clip
// manifest's sources (lessons, quests, games, stories, the level check, vocabulary topics, cards, Word Builder) so a
// screen can warm the next lesson's clips. A chunk no longer built is removed. A say clip with no manifest row stops
// the run (`splitAssetMap`): it would land in the start bundle.
//
//   node scripts/audio/gen-audio-map.mjs                       write the map
//   node scripts/audio/gen-audio-map.mjs --check               exit 1 if the committed map is stale
//   node scripts/audio/gen-audio-map.mjs --with-e2e-fixtures   also map e2e/fixtures/audio
//
// --with-e2e-fixtures is for the e2e-only fixture build (build:web:fixtures,
// which restores the plain map afterwards); a real recording wins over a
// fixture for the same ref. The drift test fails if that map is ever committed,
// and build:web always regenerates the plain map first.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ASSET_MAP_FILE,
  AUDIO_DIR,
  AUDIO_REQUIRE_BASE,
  E2E_FIXTURE_DIR,
  E2E_FIXTURE_REQUIRE_BASE,
  PACK_CHUNK_DIR,
  TTS_MANIFEST_FILE,
  buildAssetMap,
  clipPackMap,
  clipUnitsOf,
  mergeAssetMaps,
  renderAudioModules,
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
const manifestPath = join(appRoot, '..', '..', TTS_MANIFEST_FILE);
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const packs = clipPackMap(manifest, readFileSync(join(appRoot, 'src/content/jamo.ts'), 'utf8'));
const packOf = (ref) => packs.get(ref);
const shipped = buildAssetMap(listFiles(join(appRoot, AUDIO_DIR)), AUDIO_REQUIRE_BASE, packOf);
const shippedRefs = new Set(shipped.map((e) => e.ref));
// A real recording always wins over a fixture for the same ref.
const fixtures = withFixtures
  ? buildAssetMap(listFiles(join(appRoot, E2E_FIXTURE_DIR)), E2E_FIXTURE_REQUIRE_BASE, packOf).filter((e) => !shippedRefs.has(e.ref))
  : [];
const modules = renderAudioModules(mergeAssetMaps(shipped, fixtures), clipUnitsOf(manifest));
const outDir = dirname(join(appRoot, ASSET_MAP_FILE));
const chunkDir = join(outDir, PACK_CHUNK_DIR);
/** Chunk modules on disk that this run does not write (a pack whose clips are gone). */
const stale = existsSync(chunkDir)
  ? readdirSync(chunkDir)
      .map((f) => `${PACK_CHUNK_DIR}/${f}`)
      .filter((f) => !(f in modules))
  : [];
const chunks = Object.keys(modules).length - 1;

if (process.argv.includes('--check')) {
  const drifted = Object.entries(modules).filter(([name, source]) => {
    const target = join(outDir, name);
    return (existsSync(target) ? readFileSync(target, 'utf8') : '') !== source;
  });
  if (drifted.length > 0 || stale.length > 0) {
    process.stderr.write(`${ASSET_MAP_FILE} (or a pack chunk) is stale: run pnpm --filter @hangul-route/mobile audio:map\n`);
    process.exit(1);
  }
  process.stdout.write(`audio:map up to date (${shipped.length} clips)\n`);
} else {
  for (const name of stale) rmSync(join(outDir, name));
  for (const [name, source] of Object.entries(modules)) {
    mkdirSync(dirname(join(outDir, name)), { recursive: true });
    writeFileSync(join(outDir, name), source);
  }
  if (existsSync(chunkDir) && readdirSync(chunkDir).length === 0) rmSync(chunkDir, { recursive: true });
  process.stdout.write(`audio:map wrote ${shipped.length} clips to ${ASSET_MAP_FILE} (${chunks} pack chunks)\n`);
  if (withFixtures) {
    process.stdout.write(`audio:map e2e fixture build: added ${fixtures.length} fixture clips (never commit this map).\n`);
  }
}
