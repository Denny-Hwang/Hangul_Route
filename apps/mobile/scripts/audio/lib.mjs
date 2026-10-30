// Pure cores of the audio scripts (F-AUDIO-004 §3.10). Dependency-free JS so the
// generator runs with plain `node`; unit-tested from
// src/logic/audio/__tests__/audio-scripts.test.ts through the sibling lib.d.mts.

/** Same grammar as `AUDIO_REF_PATTERN` in packages/content-schema (a parity test keeps them equal). */
export const AUDIO_REF_PATTERN = /^audio\/(?:(?:jamo|vocab|story|card|dialogue)\/[a-z0-9][a-z0-9/-]*|say\/[0-9a-f]{16})\.mp3$/;

/**
 * The two jamo clip packs (AMENDMENTS-AUDIO-CLIPS AC-B6): the Stage 1 symbols (`jamoAll`) and the Word Builder ones
 * (`jamoWordBuilder`). The pack list itself is `AUDIO_PACKS` in packages/content-schema; a test keeps these on it.
 */
export const JAMO_PACK_STAGE1 = 'jamo-s1';
export const JAMO_PACK_WORD_BUILDER = 'jamo-wb';

/** The record-clip groups that are never precached: served by the `hr-audio-v1` runtime rule instead (AD10). */
export const RUNTIME_AUDIO_GROUPS = ['vocab', 'story', 'card', 'dialogue'];

/** Where the generated map lives, and how it reaches the clip folder. */
export const ASSET_MAP_FILE = 'src/content/__generated__/audio-assets.ts';
export const AUDIO_DIR = 'assets/audio';
export const AUDIO_REQUIRE_BASE = '../../../assets/audio';

/** Test-build-only clips for the web e2e (never shipped: the generator adds them only when asked). */
export const E2E_FIXTURE_DIR = 'e2e/fixtures/audio';
export const E2E_FIXTURE_REQUIRE_BASE = '../../../e2e/fixtures/audio';

const toPosix = (p) => p.split('\\').join('/');

/** `jamo/giyeok.mp3` (relative to an audio folder) => `audio/jamo/giyeok.mp3`. */
export function refFromFile(file) {
  return `audio/${toPosix(file).replace(/^\.?\/+/, '')}`;
}

/**
 * The asset map entries for the `.mp3` files of one audio folder, sorted by ref
 * so the output never depends on the order the file system lists them. A file
 * whose name does not make a valid ref (a letter instead of an id, upper case,
 * a stray folder) fails loudly: it could never be played (audit AUD-08).
 * With `packOf`, each entry carries the pack its ref belongs to (AMENDMENTS-AUDIO-CLIPS
 * AC-B6); a ref with no pack carries none, and only the `audioClips` switch governs it.
 *
 * @param {readonly string[]} files paths relative to the audio folder
 * @param {string} [base] require prefix from the generated file to that folder
 * @param {(ref: string) => string | undefined} [packOf] the pack of a ref
 */
export function buildAssetMap(files, base = AUDIO_REQUIRE_BASE, packOf = () => undefined) {
  const seen = new Set();
  const entries = [];
  for (const raw of files) {
    const file = toPosix(raw).replace(/^\.?\/+/, '');
    if (!file.toLowerCase().endsWith('.mp3')) continue;
    const ref = refFromFile(file);
    if (!AUDIO_REF_PATTERN.test(ref)) {
      throw new Error(`audio file "${file}" does not make a valid audioRef (${ref}); name it by its id, e.g. jamo/giyeok.mp3`);
    }
    if (seen.has(ref)) throw new Error(`two audio files for ${ref}`);
    seen.add(ref);
    const pack = packOf(ref);
    entries.push(pack === undefined ? { ref, require: `${base}/${file}` } : { ref, require: `${base}/${file}`, pack });
  }
  return entries.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}

/** Merges entry lists (the shipped folder, then optional test fixtures); a ref may appear once. */
export function mergeAssetMaps(...lists) {
  const all = lists.flat();
  const refs = new Set();
  for (const e of all) {
    if (refs.has(e.ref)) throw new Error(`two audio files for ${e.ref}`);
    refs.add(e.ref);
  }
  return [...all].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}

/** A native registry id, or the URL string Metro's web asset transformer returns (expo-asset takes both). */
const MAP_TYPE = 'Readonly<Record<string, number | string>>';

const PACK_MAP_TYPE = 'Readonly<Record<string, AudioPack>>';

/** Where the per-pack map chunks live, relative to the generated map's folder (AC-B6). */
export const PACK_CHUNK_DIR = 'audio-packs';
/** The generated map's file name inside its folder (`ASSET_MAP_FILE`). */
export const ASSET_MAP_MODULE = 'audio-assets.ts';

/** The module of a pack's map chunk, relative to the generated map's folder; Metro names its web bundle after it. */
export const packChunkModule = (pack) => `${PACK_CHUNK_DIR}/audio-pack-${pack}.ts`;
/** The web bundle name of a pack's map chunk (`_expo/static/js/web/audio-pack-<pack>-<md5>.js`). */
export const packChunkName = (pack) => `audio-pack-${pack}`;
/** The marker a pack's chunk exports: the PWA build checks the start bundle never carries it. */
export const packChunkMarker = (pack) => `audio-pack:${pack}`;

/**
 * The start map and the per-pack map chunks (AMENDMENTS-AUDIO-CLIPS AC-B6, bundle size): the start bundle carries only
 * the precached pack's refs (`jamo-s1`) and the refs that have no pack (governed by `audioClips` alone); every other
 * pack's refs are a chunk of their own, sorted by pack id. Throws on a say clip with no pack (no manifest row).
 *
 * @param {readonly import('./lib.d.mts').AssetEntry[]} entries the merged asset map
 */
export function splitAssetMap(entries) {
  // A say clip always has a manifest row, so a pack: one with none (an orphan, or a file added before the manifest was
  // regenerated) would land in the start bundle silently, so the map generator stops on it instead.
  const orphans = entries.filter((e) => e.pack === undefined && e.ref.startsWith(`audio/${SAY_AUDIO_GROUP}/`)).map((e) => e.ref);
  if (orphans.length > 0) {
    throw new Error(
      `audio:map: ${orphans.length} say clip(s) have no row in ${TTS_MANIFEST_FILE}, so no pack (${orphans.slice(0, 5).join(', ')}): ` +
        'regenerate the manifest (pnpm audio:tts:manifest) or remove the file',
    );
  }
  const start = [];
  const byPack = new Map();
  for (const e of entries) {
    if (e.pack === undefined || PRECACHED_AUDIO_PACKS.includes(e.pack)) {
      start.push(e);
      continue;
    }
    if (!byPack.has(e.pack)) byPack.set(e.pack, []);
    byPack.get(e.pack).push(e);
  }
  const chunks = [...byPack.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([pack, list]) => ({ pack, entries: list }));
  return { start, chunks };
}

/** The Stage 2 cell that teaches the Word Builder symbols (F-CURR-001 §3.3): the `jamo-wb` clips warm with it (AC-B6). */
export const WORD_BUILDER_UNIT = 'episode:stage2-letters';

/**
 * The warm unit of a manifest source (AC-B6, warming): a Stage 1 quest or game (`quest:<id>`, `minigame:<ref>`), a
 * lesson cell (`content/episodes/stage-2/life.json` => `episode:stage2-life`, the id its quests are opened under), a
 * story (`content/stories/<slug>.json` => `story:<slug>`), the level check (`placement`), a vocabulary topic
 * (`content/vocab/<topic>.json` => `topic:<topic>`, the topic screen's), a card (`card:<id>`, its detail page's) and,
 * for a `jamo-wb` clip (`jamo:<id>#sound|letter`), the Word Builder cell (`WORD_BUILDER_UNIT`). Any other source (a
 * lexicon entry, a pattern, a vocabulary word, a Stage 1 jamo, which is precached) is not a unit a screen warms by:
 * null.
 *
 * @param {string} source a manifest row's source
 * @param {string} [pack] the row's pack
 */
export function clipUnitOfSource(source, pack) {
  const cell = /^content\/episodes\/stage-(\d+)\/([a-z0-9-]+)\.json$/.exec(source);
  if (cell !== null) return `episode:stage${cell[1]}-${cell[2]}`;
  const story = /^content\/stories\/([a-z0-9-]+)\.json$/.exec(source);
  if (story !== null) return `story:${story[1]}`;
  const topic = /^content\/vocab\/([a-z0-9][a-z0-9-]*)\.json$/.exec(source);
  if (topic !== null) return `topic:${topic[1]}`;
  if (source.startsWith('content/placement/')) return 'placement';
  if (/^(?:quest|minigame|card):[a-z0-9-]+$/.test(source)) return source;
  if (pack === JAMO_PACK_WORD_BUILDER && /^jamo:[a-z0-9-]+#(?:sound|letter)$/.test(source)) return WORD_BUILDER_UNIT;
  return null;
}

/**
 * The warm units of every clip the manifest lists (`clipUnitOfSource` of its sources), by ref, each list sorted.
 *
 * @param {{ rows?: readonly { ref: string, pack?: string, sources?: readonly string[] }[] } | null | undefined} manifest
 * @returns {Map<string, string[]>}
 */
export function clipUnitsOf(manifest) {
  const units = new Map();
  for (const row of manifest?.rows ?? []) {
    const own = new Set(units.get(row.ref) ?? []);
    for (const source of row.sources ?? []) {
      const unit = clipUnitOfSource(source, row.pack);
      if (unit !== null) own.add(unit);
    }
    if (own.size > 0) units.set(row.ref, [...own].sort());
  }
  return units;
}

const HEADER = [
  '// GENERATED by scripts/audio/gen-audio-map.mjs (pnpm --filter @hangul-route/mobile audio:map) — do not edit.',
  '// Source: assets/audio/**/*.mp3. A content audioRef with no file here plays through the device voice (AD4).',
];

/**
 * The source of `src/content/__generated__/audio-assets.ts` (the start map). Metro needs literal require paths. The
 * pack map (`AUDIO_ASSET_PACKS`) is typed by the shared pack list, so a pack id off that list fails the typecheck.
 * With `chunks` (from `splitAssetMap`), the map also names every clip the build holds (`AUDIO_CLIP_COUNT`), the
 * packs that are chunks of their own (`AUDIO_CHUNK_PACKS`) and their loader (`loadAudioPackChunk`): one literal
 * `import()` per pack map chunk (Metro resolves only literals). The loader lives here, in the start map, so a pack
 * chunk's URL is in the start bundle (one short case per pack, never its clips) and the lazy clip pack loader chunk,
 * which calls it, keeps a file name that is the md5 of its content.
 *
 * @param {readonly import('./lib.d.mts').AssetEntry[]} entries the start map's entries
 * @param {readonly { pack: string, entries: readonly import('./lib.d.mts').AssetEntry[] }[]} [chunks]
 */
export function renderAssetMap(entries, chunks = []) {
  const lines = [
    ...HEADER,
    "import type { AudioPack } from '@hangul-route/content-schema';",
    "import type { AudioPackChunk } from '../../logic/audio/clip-assets';",
    '',
  ];
  if (entries.length === 0) {
    lines.push(`export const AUDIO_ASSETS: ${MAP_TYPE} = {};`);
  } else {
    lines.push(`export const AUDIO_ASSETS: ${MAP_TYPE} = {`);
    for (const e of entries) lines.push(`  '${e.ref}': require('${e.require}'),`);
    lines.push('};');
  }
  const packed = entries.filter((e) => e.pack !== undefined);
  lines.push(
    '',
    '/** The pack of each clip (AMENDMENTS-AUDIO-CLIPS AC-B6, AC-B8); a clip with no pack is governed by `audioClips` alone. */',
  );
  if (packed.length === 0) {
    lines.push(`export const AUDIO_ASSET_PACKS: ${PACK_MAP_TYPE} = {};`);
  } else {
    lines.push(`export const AUDIO_ASSET_PACKS: ${PACK_MAP_TYPE} = {`);
    for (const e of packed) lines.push(`  '${e.ref}': '${e.pack}',`);
    lines.push('};');
  }
  const total = entries.length + chunks.reduce((sum, c) => sum + c.entries.length, 0);
  lines.push(
    '',
    '/** Every clip the build holds: the ones above and the ones of the pack map chunks (AC-B6). */',
    `export const AUDIO_CLIP_COUNT = ${total};`,
    '',
    '/** The packs whose clips are a map chunk of their own (`loadAudioPackChunk`), loaded with their lesson or story, never at start. */',
    `export const AUDIO_CHUNK_PACKS: readonly AudioPack[] = [${chunks.map((c) => `'${c.pack}'`).join(', ')}];`,
    '',
    '/** A pack\'s map chunk (AMENDMENTS-AUDIO-CLIPS AC-B6); undefined for a pack with none. */',
    'export function loadAudioPackChunk(pack: AudioPack): Promise<{ AUDIO_PACK: AudioPackChunk }> | undefined {',
    '  switch (pack) {',
  );
  for (const c of chunks) lines.push(`    case '${c.pack}':`, `      return import('./${packChunkModule(c.pack).replace(/\.ts$/, '')}');`);
  lines.push('    default:', '      return undefined;', '  }', '}');
  return `${lines.join('\n')}\n`;
}

/**
 * The source of one pack's map chunk (`audio-packs/audio-pack-<pack>.ts`): its clips (require paths one folder deeper
 * than the start map's) and, for each warm unit that uses them (`clipUnitsOf`), the indexes of those clips.
 *
 * @param {string} pack
 * @param {readonly import('./lib.d.mts').AssetEntry[]} entries the pack's entries
 * @param {Map<string, readonly string[]>} [units] the warm units of each ref
 */
export function renderPackChunk(pack, entries, units = new Map()) {
  const byUnit = new Map();
  entries.forEach((e, index) => {
    for (const unit of units.get(e.ref) ?? []) {
      if (!byUnit.has(unit)) byUnit.set(unit, []);
      byUnit.get(unit).push(index);
    }
  });
  const lines = [
    ...HEADER,
    `// The ${pack} pack's map chunk (AMENDMENTS-AUDIO-CLIPS AC-B6): reached only through loadAudioPackChunk in ../${ASSET_MAP_MODULE}.`,
    "import type { AudioPackChunk } from '../../../logic/audio/clip-assets';",
    '',
    '/** This chunk\'s marker: the PWA build checks the start bundle never carries it (scripts/pwa-postbuild.mjs). */',
    `export const AUDIO_PACK_CHUNK = '${packChunkMarker(pack)}';`,
    '',
    'export const AUDIO_PACK: AudioPackChunk = {',
    `  pack: '${pack}',`,
    '  clips: {',
    ...entries.map((e) => `    '${e.ref}': require('../${e.require}'),`),
    '  },',
    '  units: {',
    ...[...byUnit.keys()].sort().map((unit) => `    '${unit}': [${byUnit.get(unit).join(', ')}],`),
    '  },',
    '};',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Every generated audio module, by path relative to the generated map's folder: the start map (with the chunk loader)
 * and one chunk per pack outside the precache (AC-B6). What gen-audio-map.mjs writes and its drift test compares.
 *
 * @param {readonly import('./lib.d.mts').AssetEntry[]} entries the merged asset map
 * @param {Map<string, readonly string[]>} [units] the warm units of each ref (`clipUnitsOf`)
 * @returns {Record<string, string>}
 */
export function renderAudioModules(entries, units = new Map()) {
  const { start, chunks } = splitAssetMap(entries);
  const modules = { [ASSET_MAP_MODULE]: renderAssetMap(start, chunks) };
  for (const c of chunks) modules[packChunkModule(c.pack)] = renderPackChunk(c.pack, c.entries, units);
  return modules;
}

/** The refs a committed map declares (read as text: the map is never imported by tests). */
export function refsInRenderedMap(source) {
  return [...source.matchAll(/^\s*'(audio\/[^']+)':\s*require\(/gm)].map((m) => m[1]);
}

// --- PWA build (pwa-postbuild.mjs) ----------------------------------------------

/**
 * The packs the learner precache holds (AMENDMENTS-AUDIO-CLIPS AC-B6, G5): only the Stage 1 jamo pack (43 clips, about
 * 0.35 MB). Every other pack, `jamo-wb` included although its clips also live under `audio/jamo/`, is runtime-cached.
 */
export const PRECACHED_AUDIO_PACKS = [JAMO_PACK_STAGE1];

/** The text-keyed clip group (AC-B4): runtime-cached in a cache of its own (`SAY_RUNTIME_CACHE`). */
export const SAY_AUDIO_GROUP = 'say';

/** The record-clip runtime cache (§3.10): vocabulary, story, card and dialogue refs, and the jamo clips not precached. */
export const REF_RUNTIME_CACHE = Object.freeze({ cacheName: 'hr-audio-v1', maxEntries: 400 });
/** The say-clip runtime cache (AC-B6): about 1,213 text-keyed clips in all packs, so room for every one of them. */
export const SAY_RUNTIME_CACHE = Object.freeze({ cacheName: 'hr-audio-say-v1', maxEntries: 1_600 });

const CLIP_GROUPS = ['jamo', ...RUNTIME_AUDIO_GROUPS, SAY_AUDIO_GROUP];
// `audio/<group>/<id>[.<anything, such as Expo's content hash>].mp3[?query]`, anywhere in a dist path or a URL.
const BUILT_CLIP = new RegExp(`(?:^|/)audio/(${CLIP_GROUPS.join('|')})/([^.?#]+)(?:\\.[^/?#]*)?\\.mp3(?:[?#].*)?$`, 'i');

/**
 * The ref of a built clip (a dist path or a URL): `assets/assets/audio/jamo/giyeok.<md5>.mp3` => `audio/jamo/giyeok.mp3`
 * (Expo's content hash and a query string dropped); null for any other file.
 */
export function refOfBuiltClip(path) {
  const m = BUILT_CLIP.exec(toPosix(path));
  return m === null ? null : `audio/${m[1].toLowerCase()}/${m[2]}.mp3`;
}

/** Each clip's pack, as a lookup: a `Map` of ref => pack (`clipPackMap`), or a function. */
const lookupOf = (packs) => (typeof packs === 'function' ? packs : (ref) => packs?.get(ref));

/**
 * Every clip's pack (AC-B6), the one lookup the map generator and the PWA build share: the clip manifest's
 * (content/audio/tts-manifest.json, row AC-2), else the one jamo.ts declares for a jamo clip.
 *
 * @param {Parameters<typeof clipPacksOf>[0]} manifest the parsed manifest (null when there is none)
 * @param {string} jamoSource the text of apps/mobile/src/content/jamo.ts
 * @returns {Map<string, string>}
 */
export function clipPackMap(manifest, jamoSource) {
  const packs = new Map(jamoClipRefs(jamoSource).map((r) => [r.ref, r.pack]));
  for (const [ref, pack] of clipPacksOf(manifest)) packs.set(ref, pack);
  return packs;
}

/** Is this built file (a dist path or a URL) a clip of a precached pack? Only `jamo-s1` jamo clips are (G5). */
export function isPrecachedAudio(path, packs) {
  const ref = refOfBuiltClip(path);
  if (ref === null || !ref.startsWith('audio/jamo/')) return false;
  return PRECACHED_AUDIO_PACKS.includes(lookupOf(packs)(ref));
}

/**
 * Is this built file a clip the precache must not hold? Every clip outside a precached pack: the vocabulary, story,
 * card, dialogue and say groups, a `jamo-wb` jamo clip, and a jamo clip with no pack (it would be precached by
 * accident, so the build names it rather than guess).
 *
 * @param {string} path a dist path or a URL
 * @param {Map<string, string> | ((ref: string) => string | undefined)} [packs] each clip's pack (`clipPackMap`)
 */
export function isRuntimeAudio(path, packs) {
  return refOfBuiltClip(path) !== null && !isPrecachedAudio(path, packs);
}

/**
 * Workbox `globIgnores` for every clip outside the precached packs: the record and say groups by folder, and each
 * jamo clip of another pack by name (with and without Expo's content hash). A jamo clip with no pack is not listed:
 * `precacheLeaks` fails the build on it instead.
 *
 * @param {Map<string, string>} packs each clip's pack (`clipPackMap`)
 */
export function audioPrecacheIgnores(packs) {
  const ignores = [`**/audio/{${[...RUNTIME_AUDIO_GROUPS, SAY_AUDIO_GROUP].join(',')}}/**`];
  const runtimeJamo = [...(packs?.entries() ?? [])]
    .filter(([ref, pack]) => ref.startsWith('audio/jamo/') && !PRECACHED_AUDIO_PACKS.includes(pack))
    .map(([ref]) => ref.slice('audio/jamo/'.length, -'.mp3'.length))
    .sort();
  for (const id of runtimeJamo) ignores.push(`**/audio/jamo/${id}.mp3`, `**/audio/jamo/${id}.*.mp3`);
  return ignores;
}

const cacheable = { statuses: [200], headers: { 'content-type': 'audio/mpeg' } };

/**
 * Workbox `runtimeCaching` rules for the clips the precache does not hold: cache-first and bounded (§3.10, AC-B6).
 * - `hr-audio-say-v1` (the say group, maxEntries 1,600);
 * - `hr-audio-v1` (maxEntries 400) for vocabulary, story, card and dialogue refs, and the jamo clips outside the
 *   precached pack (`jamo-wb`). A precached `jamo-s1` clip never reaches it: the precache route is registered first.
 * Same-origin only (never opaque), and only a real clip: a single-page host answers a missing file with index.html
 * and status 200, which must never be cached as a clip.
 */
export function audioRuntimeCaching() {
  return [
    {
      urlPattern: /\/audio\/say\/[0-9a-f]{16}(?:\.[^/]*)?\.mp3$/i,
      handler: 'CacheFirst',
      options: { cacheName: SAY_RUNTIME_CACHE.cacheName, expiration: { maxEntries: SAY_RUNTIME_CACHE.maxEntries }, cacheableResponse: cacheable },
    },
    {
      urlPattern: new RegExp(`/audio/(?:jamo|${RUNTIME_AUDIO_GROUPS.join('|')})/.+\\.mp3$`, 'i'),
      handler: 'CacheFirst',
      options: { cacheName: REF_RUNTIME_CACHE.cacheName, expiration: { maxEntries: REF_RUNTIME_CACHE.maxEntries }, cacheableResponse: cacheable },
    },
  ];
}

const listedSet = (manifestUrls) => new Set(manifestUrls.map((u) => toPosix(u).replace(/^\/+/, '').split('?')[0]));

/**
 * Built `.mp3` files of a precached pack that are not in the manifest (Workbox's glob skips dot folders, found while
 * reading dist/). Runtime-cached clips are not expected there.
 *
 * @param {readonly string[]} distMp3s paths relative to dist
 * @param {readonly string[]} manifestUrls the precache manifest's urls
 * @param {Map<string, string> | ((ref: string) => string | undefined)} [packs] each clip's pack (`clipPackMap`)
 */
export function precacheGaps(distMp3s, manifestUrls, packs) {
  const listed = listedSet(manifestUrls);
  return distMp3s
    .map((p) => toPosix(p).replace(/^\/+/, ''))
    .filter((p) => isPrecachedAudio(p, packs) && !listed.has(p))
    .sort();
}

/** Clips outside the precached packs that ended up in the precache anyway (an ignore glob missed them). */
export function precacheLeaks(manifestUrls, packs) {
  return manifestUrls.filter((u) => isRuntimeAudio(u, packs)).sort();
}

/** The precached files of one pack (the build asserts there is no `jamo-wb` file among them, AC-B6). */
export function precachedPackFiles(manifestUrls, packs, pack) {
  const lookup = lookupOf(packs);
  return manifestUrls.filter((u) => {
    const ref = refOfBuiltClip(u);
    return ref !== null && lookup(ref) === pack;
  }).sort();
}

/**
 * The bytes the precached clips add to the learner precache (G5): the measured growth that must stay under the
 * `learnerPrecacheRaw` line (scripts/pwa/lesson-chunks.mjs), so CM-5B is never triggered by audio.
 *
 * @param {readonly { url: string, size: number }[]} manifestEntries Workbox's precache entries, with their sizes
 * @param {Map<string, string> | ((ref: string) => string | undefined)} packs each clip's pack
 * @returns {{ count: number, bytes: number }}
 */
export function precachedClipBytes(manifestEntries, packs) {
  const clips = manifestEntries.filter((e) => isPrecachedAudio(e.url, packs));
  return { count: clips.length, bytes: clips.reduce((sum, e) => sum + e.size, 0) };
}

// --- Recording script (gen-recording-script.mjs, F-AUDIO-004 §3.11) ------------

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWEL_A = 0; // ㅏ
const VOWEL_EU = 18; // ㅡ

/** One Hangul syllable from an initial consonant letter, a vowel index and an optional final letter. */
function syllable(initial, vowel, final = '') {
  const i = INITIALS.indexOf(initial);
  const f = FINALS.indexOf(final);
  if (i < 0 || f < 0) throw new Error(`cannot compose a syllable from ${initial} / ${final}`);
  return String.fromCharCode(0xac00 + (i * 21 + vowel) * 28 + f);
}

/** Final consonants that stop the air (unreleased); the rest are held. */
const STOP_FINALS = new Set(['ㄱ', 'ㄷ', 'ㅂ']);

const NOTES = {
  consonant: 'consonant sound = syllable with ㅏ',
  name: (char) => `${char} is silent at the start; say its name`,
  stop: 'end on the closed sound without letting it go; do not add a vowel after it',
  held: 'end on the final sound; do not add a vowel after it',
};

/** `audio/jamo/giyeok-batchim.mp3` => `giyeok-batchim`. A recorded clip is flat in its group folder (F-VOC-001: `audio/vocab/<slug>.mp3`). */
export function fileIdOf(audioRef) {
  const id = audioRef.replace(/^audio\/[a-z]+\//, '').replace(/\.mp3$/, '');
  if (id.includes('/')) throw new Error(`${audioRef}: a recorded clip must be flat in its group folder (audio/<group>/<id>.mp3)`);
  return id;
}

function byOrder(records) {
  return [...records].sort((a, b) => a.order - b.order);
}

/**
 * The 30 rows of the jamo recording script, in the order of §3.2. What to say
 * is the record's `spokenKo`; what not to say is derived from the letter, so a
 * speaker never records a name for a sound (or the ㅏ syllable for ㅇ, which
 * would sound like the vowel ㅏ).
 *
 * @param {readonly object[]} jamo the jamo records (apps/mobile/src/content/jamo.ts)
 */
export function recordingRows(jamo) {
  const consonantByChar = new Map(jamo.filter((j) => j.kind === 'consonant').map((j) => [j.char, j]));
  return byOrder(jamo).map((j, index) => {
    if (!j.audioRef) throw new Error(`${j.id} has no audioRef`);
    if (!j.spokenKo || !j.spokenRomanization) throw new Error(`${j.id} has no spokenKo / spokenRomanization`);
    let doNotSay = [];
    let note = '';
    if (j.kind === 'consonant' && j.spokenKind === 'name') {
      doNotSay = [syllable(j.char, VOWEL_A)];
      note = NOTES.name(j.char);
    } else if (j.kind === 'consonant') {
      doNotSay = [j.nameKo, syllable(j.char, VOWEL_EU)].filter(Boolean);
      note = NOTES.consonant;
    } else if (j.kind === 'batchim') {
      doNotSay = [syllable(j.char, VOWEL_A, j.char), consonantByChar.get(j.char)?.nameKo].filter(Boolean);
      note = STOP_FINALS.has(j.char) ? NOTES.stop : NOTES.held;
    }
    return {
      n: index + 1,
      fileId: fileIdOf(j.audioRef),
      say: j.spokenKo,
      doNotSay: doNotSay.filter((s) => s !== j.spokenKo),
      romanization: j.spokenRomanization,
      note,
    };
  });
}

/** Batch 2 (optional): the 14 consonant names as `<id>-name` (`giyeok-name` = 기역). */
export function nameRows(jamo) {
  return byOrder(jamo.filter((j) => j.kind === 'consonant' && j.nameKo && j.audioRef)).map((j, index) => ({
    n: index + 1,
    fileId: `${fileIdOf(j.audioRef)}-name`,
    say: j.nameKo,
    romanization: j.id.replace(/^jamo:/, ''),
  }));
}

/**
 * `vocab:sagwa-apple` => `audio/vocab/sagwa-apple.mp3`: the one clip path `VocabItemSchema`
 * allows for a word. scripts/build-vocab.mjs writes the same path into the generated loader
 * (its own `vocabAudioRef`; src/content/__tests__/audio-recording-script.test.ts keeps the two equal).
 */
export function vocabAudioRef(id) {
  return `audio/vocab/${id.slice('vocab:'.length)}.mp3`;
}

/** A word's clip path: its own `audioRef`, else the derived one. Every word has one, recorded or not. */
function vocabRefOf(item) {
  if (typeof item.audioRef === 'string' && item.audioRef !== '') return item.audioRef;
  return typeof item.id === 'string' && item.id.startsWith('vocab:') ? vocabAudioRef(item.id) : undefined;
}

/** Every word's clip path, in file order (what `audio:status` counts). */
export function vocabClipRefs(topicFiles) {
  return topicFiles.flatMap((file) => (file.items ?? []).map(vocabRefOf).filter((ref) => ref !== undefined));
}

/**
 * Every vocabulary word (each has a clip path, derived from its id when the file has
 * none), ordered by topic then id so a speaker records one topic per sitting.
 *
 * @param {readonly { items: readonly object[] }[]} topicFiles parsed content/vocab/*.json
 */
export function vocabRecordingRows(topicFiles) {
  const rows = [];
  for (const file of topicFiles) {
    for (const item of file.items ?? []) {
      const ref = vocabRefOf(item);
      if (ref === undefined) continue;
      rows.push({
        fileId: fileIdOf(ref),
        say: item.ko,
        spokenKo: item.spokenKo && item.spokenKo !== item.ko ? item.spokenKo : '',
        romanization: item.romanization,
        gloss: item.en,
        topic: item.topics?.[0] ?? '',
        note: item.senseNote ?? '',
      });
    }
  }
  return rows.sort((a, b) => (a.topic === b.topic ? (a.fileId < b.fileId ? -1 : 1) : a.topic < b.topic ? -1 : 1));
}

const cell = (s) => String(s).replace(/\|/g, '\\|');
const tableRow = (cells) => `| ${cells.map(cell).join(' | ')} |`;

/** The source of docs/launch/audio-recording-script.md. */
export function renderRecordingScript(rows, names, vocab) {
  const out = [
    '# Audio recording script',
    '',
    '<!-- GENERATED by apps/mobile/scripts/audio/gen-recording-script.mjs (pnpm --filter @hangul-route/mobile audio:script) from the content records. Do not edit by hand. -->',
    '',
    'What to say for each clip and what to name the file (F-AUDIO-004 §3.11, owner task T-017). How to record, the ear check and how to deliver: `docs/launch/owner-runbook.md` Step 12.',
    '',
    'Name each file by the **file id** column plus the recorder\'s extension (`giyeok.m4a`, `giyeok-batchim.m4a`), never by the letter. Record each item twice in a row with a 2 s pause.',
    '',
    `## Batch 1: the ${rows.length} letter sounds (needed)`,
    '',
    tableRow(['#', 'file id', 'Say exactly', 'Do NOT say', 'Romanization', 'Note']),
    '|---|---|---|---|---|---|',
    ...rows.map((r) => tableRow([r.n, r.fileId, r.say, r.doNotSay.join(', '), r.romanization, r.note])),
    '',
    `## Batch 2: the ${names.length} consonant names (optional, later)`,
    '',
    tableRow(['#', 'file id', 'Say exactly', 'Romanization']),
    '|---|---|---|---|',
    ...names.map((r) => tableRow([r.n, r.fileId, r.say, r.romanization])),
    '',
    '## Vocabulary words',
    '',
  ];
  if (vocab.length === 0) {
    out.push('No vocabulary clips are planned yet. A word gets a row here when its record in `content/vocab/` has an `audioRef`.');
  } else {
    out.push(
      'Say each word at natural speed, not syllable by syllable. Record one topic per sitting.',
      '',
      tableRow(['file id', 'Say (ko)', 'spokenKo if different', 'Romanization', 'Gloss', 'Topic', 'Note']),
      '|---|---|---|---|---|---|---|',
      ...vocab.map((r) => tableRow([r.fileId, r.say, r.spokenKo, r.romanization, r.gloss, r.topic, r.note])),
    );
  }
  return `${out.join('\n')}\n`;
}

const FACTORY_FIELDS = {
  c: ['id', 'char', 'romanization', 'nameEn', 'ipa', 'exampleWordKo', 'exampleWordRomanization', 'exampleWordEn', 'order', 'spokenKo', 'spokenRomanization', 'nameKo', 'spokenKind'],
  v: ['id', 'char', 'romanization', 'nameEn', 'ipa', 'exampleWordKo', 'exampleWordRomanization', 'exampleWordEn', 'order', 'spokenKo', 'spokenRomanization', 'nameKo', 'spokenKind'],
  b: ['id', 'char', 'romanization', 'nameEn', 'order', 'spokenKo', 'spokenRomanization'],
};
const KIND = { c: 'consonant', v: 'vowel', b: 'batchim' };
const REQUIRED = ['id', 'char', 'order', 'spokenKo', 'spokenRomanization'];

/**
 * Reads the jamo records from the source of apps/mobile/src/content/jamo.ts
 * (one `c(...)`, `v(...)` or `b(...)` call per line). Plain node cannot import
 * TypeScript (F-CNT-002 C1), so the generator reads the factory calls; a unit
 * test compares the result with the real `jamoAll`, so the two cannot drift.
 */
export function parseJamoSource(source) {
  const records = [];
  for (const line of source.split('\n')) {
    const m = /^\s*([cvb])\((.*)\),?\s*$/.exec(line);
    if (!m) continue;
    const args = [...m[2].matchAll(/'([^']*)'|(-?\d+(?:\.\d+)?)/g)].map((a) => (a[1] !== undefined ? a[1] : Number(a[2])));
    const fields = FACTORY_FIELDS[m[1]];
    const raw = Object.fromEntries(fields.map((f, i) => [f, args[i]]));
    const missing = REQUIRED.filter((f) => raw[f] === undefined);
    if (missing.length > 0) throw new Error(`jamo.ts: cannot read ${missing.join(', ')} of ${raw.id ?? line.trim()}`);
    const kind = KIND[m[1]];
    const base = kind === 'batchim' ? `${raw.id}-batchim` : raw.id;
    records.push({
      id: `jamo:${base}`,
      kind,
      char: raw.char,
      order: raw.order,
      audioRef: `audio/jamo/${base}.mp3`,
      spokenKo: raw.spokenKo,
      spokenRomanization: raw.spokenRomanization,
      spokenKind: raw.spokenKind ?? 'sound',
      nameKo: raw.nameKo,
    });
  }
  if (records.length === 0) throw new Error('jamo.ts: no jamo records found (expected c(...), v(...) and b(...) lines)');
  return records;
}

/** The Word Builder factories of jamo.ts: `wb(...)` (a vowel or a tense consonant) and `wbf(...)` (a final, with its clip id). */
const WB_FIELDS = {
  wb: ['id', 'char', 'kind', 'romanization', 'nameEn', 'order', 'spokenKo', 'spokenRomanization', 'nameKo'],
  wbf: ['id', 'char', 'romanization', 'nameEn', 'order', 'spokenKo', 'spokenRomanization', 'clip'],
};
const WB_REQUIRED = { wb: ['id', 'spokenKo'], wbf: ['id', 'spokenKo', 'clip'] };

/**
 * Every jamo clip ref the content declares, each once, with its pack (AMENDMENTS-AUDIO-CLIPS section 5, AC-B6), read
 * from the factory calls of apps/mobile/src/content/jamo.ts in plain node (a unit test compares the result with the
 * real `jamoAll` and `jamoWordBuilder`). A consonant has a name clip `<id>-name` when its name is not its sound
 * (every consonant but ㅇ); a Word Builder final names the clip it shares (`wbf`). A ref already declared by
 * `jamo-s1` stays there (a text used by two packs belongs to the first): 43 `jamo-s1` refs and 22 `jamo-wb` refs.
 *
 * @param {string} source the text of jamo.ts
 * @returns {{ ref: string, pack: string }[]} in declaration order
 */
export function jamoClipRefs(source) {
  const out = [];
  const seen = new Set();
  const add = (fileId, pack) => {
    const ref = `audio/jamo/${fileId}.mp3`;
    if (seen.has(ref)) return;
    seen.add(ref);
    out.push({ ref, pack });
  };
  for (const record of parseJamoSource(source)) {
    const fileId = fileIdOf(record.audioRef);
    add(fileId, JAMO_PACK_STAGE1);
    if (record.kind === 'consonant' && record.nameKo !== undefined && record.nameKo !== record.spokenKo) add(`${fileId}-name`, JAMO_PACK_STAGE1);
  }
  for (const line of source.split('\n')) {
    const m = /^\s*(wbf?)\((.*)\),?\s*$/.exec(line);
    if (!m) continue;
    const factory = m[1];
    const args = [...m[2].matchAll(/'([^']*)'|(-?\d+(?:\.\d+)?)/g)].map((a) => (a[1] !== undefined ? a[1] : Number(a[2])));
    const raw = Object.fromEntries(WB_FIELDS[factory].map((f, i) => [f, args[i]]));
    const missing = WB_REQUIRED[factory].filter((f) => raw[f] === undefined);
    if (missing.length > 0) throw new Error(`jamo.ts: cannot read ${missing.join(', ')} of ${raw.id ?? line.trim()}`);
    if (factory === 'wbf') {
      add(raw.clip, JAMO_PACK_WORD_BUILDER);
      continue;
    }
    add(raw.id, JAMO_PACK_WORD_BUILDER);
    if (raw.kind === 'consonant' && raw.nameKo !== undefined && raw.nameKo !== raw.spokenKo) add(`${raw.id}-name`, JAMO_PACK_WORD_BUILDER);
  }
  return out;
}

/** Where the clip manifest lives, relative to the repo root (AMENDMENTS-AUDIO-CLIPS AC-B5; tts/build-manifest.mjs writes it). */
export const TTS_MANIFEST_FILE = 'content/audio/tts-manifest.json';

/**
 * The pack of every clip the manifest lists (AC-B6), by ref: what the audio map generator writes into
 * `AUDIO_ASSET_PACKS` for a `say` clip (and, the same as jamo.ts declares, for a jamo clip).
 *
 * @param {{ rows?: readonly { ref: string, pack: string }[] } | null | undefined} manifest the parsed tts-manifest.json
 * @returns {Map<string, string>}
 */
export function clipPacksOf(manifest) {
  const packs = new Map();
  for (const row of manifest?.rows ?? []) {
    const seen = packs.get(row.ref);
    if (seen !== undefined && seen !== row.pack) throw new Error(`${TTS_MANIFEST_FILE}: ${row.ref} is in packs ${seen} and ${row.pack}`);
    packs.set(row.ref, row.pack);
  }
  return packs;
}

// --- Clip acceptance (check-audio.mjs, F-AUDIO-004 §3.11 table) ----------------

/**
 * The acceptance limits of §3.11, with the classes of AMENDMENTS-AUDIO-CLIPS AC-B6. Sizes are bytes (1 KB = 1000
 * bytes: 1.5 s at 64 kbps is 12,000).
 *
 * - `jamo` and `word` keep their fixed bounds. The five tense letter names (쌍기역 ...) take the word bound
 *   (`clipClassOf`).
 * - `sentence` and `narration` are bounded per spoken syllable: 0.15-0.45 s a syllable plus the 0.6 s of padding
 *   (0.3 s each side), with the byte cap that bound gives at the clip's bitrate (48 kbps by default; `clipLimitsOf`).
 * - The jamo set totals are per pack (`PACK_SET_LIMITS`); a vocabulary topic keeps its 1.5 MB.
 */
export const CLIP_PADDING_S = 0.6;
export const PER_SYLLABLE_S = Object.freeze({ min: 0.15, max: 0.45 });
export const SAY_KBPS = 48;
export const CLIP_LIMITS = {
  jamo: { minS: 0.6, maxS: 1.5, maxBytes: 12_000 },
  word: { minS: 0.6, maxS: 4.0, maxBytes: 40_000, setMaxBytes: 1_500_000 },
  sentence: { perSyllable: PER_SYLLABLE_S, paddingS: CLIP_PADDING_S, kbps: SAY_KBPS },
  narration: { perSyllable: PER_SYLLABLE_S, paddingS: CLIP_PADDING_S, kbps: SAY_KBPS },
};
/** The set totals of the two jamo packs (AC-B6): in place of the 400,000 B of "30 jamo clips". */
export const PACK_SET_LIMITS = Object.freeze({
  'jamo-s1': Object.freeze({ clips: 43, maxBytes: 520_000 }),
  'jamo-wb': Object.freeze({ clips: 22, maxBytes: 420_000 }),
});
export const TARGET_LUFS = -16;
export const LUFS_TOLERANCE = 1.5;
export const MAX_TRUE_PEAK_DB = -1.5;

const HANGUL_SYLLABLE = /[가-힣]/gu;
const round3 = (n) => Math.round(n * 1000) / 1000;

/** The spoken syllables of a text: its Hangul syllables (spaces, punctuation and anything else are not spoken syllables). */
export function spokenSyllableCount(text) {
  return (String(text).normalize('NFC').match(HANGUL_SYLLABLE) ?? []).length;
}

/**
 * The bounds of one clip of a class: `{ minS, maxS, maxBytes }`. A `sentence` or `narration` clip needs its spoken
 * syllable count (`spokenSyllableCount`); its byte cap is derived at `kbps` (default 48, the say group's first bitrate;
 * 64 when the pilot moved the say group to 64 kbps).
 *
 * @param {'jamo' | 'word' | 'sentence' | 'narration'} kind
 * @param {{ syllables?: number, kbps?: 64 | 48 }} [context]
 */
export function clipLimitsOf(kind, { syllables, kbps } = {}) {
  const lim = CLIP_LIMITS[kind];
  if (lim === undefined) throw new Error(`unknown clip class ${kind}`);
  if (lim.perSyllable === undefined) return { minS: lim.minS, maxS: lim.maxS, maxBytes: lim.maxBytes };
  if (!Number.isInteger(syllables) || syllables <= 0) throw new Error(`a ${kind} clip is bounded per spoken syllable: pass its syllable count`);
  const minS = round3(lim.perSyllable.min * syllables + lim.paddingS);
  const maxS = round3(lim.perSyllable.max * syllables + lim.paddingS);
  return { minS, maxS, maxBytes: Math.ceil(round3((maxS * (kbps ?? lim.kbps) * 1000) / 8)) };
}

/**
 * The limit class of a manifest row (AC-B6): a jamo sound, a two-syllable letter name and a one-syllable say clip
 * take the jamo bound; a letter name of three syllables (the five tense names, 쌍기역 ...) and a word take the word
 * bound; a sentence and narration are bounded per syllable.
 *
 * @param {{ kind: string, text: string }} row
 * @returns {'jamo' | 'word' | 'sentence' | 'narration'}
 */
export function clipClassOf(row) {
  switch (row.kind) {
    case 'jamo-sound':
    case 'syllable':
      return 'jamo';
    case 'jamo-name':
      return spokenSyllableCount(row.text) >= 3 ? 'word' : 'jamo';
    case 'word':
    case 'sentence':
    case 'narration':
      return row.kind;
    default:
      throw new Error(`unknown clip kind ${row.kind}`);
  }
}

/** The recording group of a clip ref: `audio/jamo/`, `audio/vocab/` or `audio/say/` (anything else: null). */
export function recordingGroupOf(ref) {
  const m = /^audio\/(jamo|vocab|say)\//.exec(String(ref));
  return m === null ? null : m[1];
}

/**
 * The MP3 bitrate a clip is checked at: one its recording group is encoded at (`GROUP_BITRATES`, AU-OD-7; AC-B5
 * step 3). jamo and vocab clips are 64 kbps. A say clip is 48 kbps, or 64 if the pilot listen of section 13 ruled 48
 * out: pass `kbps` when the run knows it (refused when the group does not allow it), or the clip's measured
 * `sampleRate`, which picks the allowed bitrate that encodes at that rate (48 kbps at 24 kHz, 64 kbps at 44.1 kHz).
 * With neither, the group's first bitrate. A clip outside the three groups is 64 kbps.
 *
 * @param {string} ref
 * @param {{ kbps?: 64 | 48, sampleRate?: number }} [context]
 * @returns {64 | 48}
 */
export function clipKbpsOf(ref, { kbps, sampleRate } = {}) {
  const group = recordingGroupOf(ref);
  const allowed = group === null ? [DEFAULT_MP3_BITRATE] : GROUP_BITRATES[group];
  if (kbps !== undefined) {
    if (!allowed.includes(kbps)) throw new Error(`${ref}: the ${group ?? 'other'} group is encoded at ${allowed.join(' or ')} kbps (AU-OD-7), not ${kbps}`);
    return kbps;
  }
  if (sampleRate !== undefined) {
    const match = allowed.find((k) => MP3_BITRATES[k] === sampleRate);
    if (match !== undefined) return match;
  }
  return allowed[0];
}

/**
 * The limits one processed clip misses (empty when it passes).
 *
 * @param {'jamo' | 'word' | 'sentence' | 'narration'} kind
 * @param {{ channels: number, sampleRate: number, codec: string, durationS: number, integratedLufs: number, truePeakDb: number, bytes: number }} r
 * @param {{ syllables?: number, kbps?: 64 | 48 }} [context] the spoken syllables (sentence, narration) and the bitrate
 *   the clip was processed at (default 64; 48 for a sentence or narration clip)
 */
export function evaluateReport(kind, r, { syllables, kbps } = {}) {
  const lim = clipLimitsOf(kind, { syllables, kbps });
  const rate = MP3_BITRATES[kbps ?? CLIP_LIMITS[kind].kbps ?? DEFAULT_MP3_BITRATE];
  const failures = [];
  if (r.channels !== 1) failures.push(`channels ${r.channels}: must be mono`);
  if (r.sampleRate !== rate) failures.push(`sample rate ${r.sampleRate}: must be ${rate} Hz`);
  if (r.codec !== 'mp3') failures.push(`codec ${r.codec}: must be mp3`);
  if (r.durationS < lim.minS || r.durationS > lim.maxS) failures.push(`duration ${r.durationS} s: must be ${lim.minS}-${lim.maxS} s`);
  if (!Number.isFinite(r.integratedLufs) || Math.abs(r.integratedLufs - TARGET_LUFS) > LUFS_TOLERANCE + 1e-9) {
    failures.push(`loudness ${r.integratedLufs} LUFS: must be ${TARGET_LUFS} +/- ${LUFS_TOLERANCE}`);
  }
  if (r.truePeakDb > MAX_TRUE_PEAK_DB) failures.push(`true peak ${r.truePeakDb} dBTP: must be <= ${MAX_TRUE_PEAK_DB}`);
  if (r.bytes > lim.maxBytes) failures.push(`size ${r.bytes} bytes: must be <= ${lim.maxBytes}`);
  return failures;
}

/**
 * The set-total limit: a jamo pack (`PACK_SET_LIMITS`: at most its clip count and its bytes) or one vocabulary topic
 * (`word`, 1.5 MB). `label` names the set in the message.
 *
 * @param {'word' | keyof typeof PACK_SET_LIMITS} set
 */
export function evaluateSet(set, sizes, label) {
  const prefix = label ? `${label}: ` : '';
  const pack = Object.prototype.hasOwnProperty.call(PACK_SET_LIMITS, set) ? PACK_SET_LIMITS[set] : undefined;
  const max = pack?.maxBytes ?? CLIP_LIMITS[set]?.setMaxBytes;
  if (max === undefined) throw new Error(`no set limit for ${set}: the jamo set totals are per pack (${Object.keys(PACK_SET_LIMITS).join(', ')})`);
  const failures = [];
  if (pack !== undefined && sizes.length > pack.clips) failures.push(`${prefix}${sizes.length} clips: the pack has ${pack.clips}`);
  const total = sizes.reduce((sum, b) => sum + b, 0);
  if (total > max) failures.push(`${prefix}set total ${total} bytes: must be <= ${max}`);
  return failures;
}

const NO_TOPIC = '(not in any topic)';

/**
 * The sets the set-total limit applies to. Jamo: one set per pack of `PACK_SET_LIMITS`, by the pack jamo.ts declares
 * for each clip (`jamoClipRefs`); a stray file is in no pack and no total. Words: one set per vocabulary topic.
 *
 * @param {'jamo' | 'word'} kind
 * @param {readonly string[]} fileIds the clips in the folder, as file ids
 * @param {{ packByFileId?: ReadonlyMap<string, string>, topicByFileId?: ReadonlyMap<string, string> }} context
 */
export function clipSets(kind, fileIds, { packByFileId = new Map(), topicByFileId = new Map() } = {}) {
  if (kind === 'jamo') {
    return Object.keys(PACK_SET_LIMITS).map((pack) => ({
      label: `pack ${pack}`,
      pack,
      fileIds: fileIds.filter((id) => packByFileId.get(id) === pack).sort(),
    }));
  }
  const byTopic = new Map();
  for (const id of fileIds) {
    const topic = topicByFileId.get(id) ?? NO_TOPIC;
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(id);
  }
  return [...byTopic.keys()].sort().map((topic) => ({ label: `topic ${topic}`, fileIds: byTopic.get(topic).sort() }));
}

// --- Processing helpers (process-recordings.mjs) ---------------------------------

/** Extensions a phone or recorder may deliver. */
export const RECORDING_EXTENSIONS = ['m4a', 'wav', 'mp3', 'aac', 'aiff', 'aif', 'caf', 'flac', 'ogg', 'webm'];

/** Two takes are separated by a pause of at least this long (the speaker leaves 2 s). */
export const TAKE_GAP_S = 1.0;

const FILE_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * `giyeok.m4a` => take 1 of `giyeok`; `giyeok.2.m4a` => take 2 (the owner's
 * mark for the better take). Not a recording => null. A name that is not a
 * file id (a letter, a space) is refused: it could never become a clip.
 */
export function parseTakeFile(name) {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = lower.slice(dot + 1);
  if (!RECORDING_EXTENSIONS.includes(ext)) return null;
  let stem = lower.slice(0, dot);
  let take = 1;
  const marked = /^(.*)\.(\d+)$/.exec(stem);
  if (marked) {
    stem = marked[1];
    take = Number(marked[2]);
    if (take < 1) throw new Error(`${name}: the take mark must be 1 or more (giyeok.2.m4a)`);
  }
  if (!FILE_ID.test(stem)) throw new Error(`${name}: name the file by its file id from the recording script (giyeok.m4a), not by the letter`);
  return { fileId: stem, take };
}

/** Silence intervals from an `ffmpeg -af silencedetect` log; an open one ends at `durationS`. */
export function parseSilences(log, durationS) {
  const out = [];
  let open = null;
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    const t = Math.max(0, Number(m[2]));
    if (m[1] === 'start') open = t;
    else if (open !== null) {
      out.push({ start: open, end: t });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: durationS });
  return out;
}

/** The spoken parts of a recording: what lies between silences of at least `minGapS`. */
export function takeSegments(silences, durationS, minGapS = TAKE_GAP_S) {
  const gaps = silences.filter((s) => s.end - s.start >= minGapS || s.start <= 0 || s.end >= durationS);
  const segments = [];
  let cursor = 0;
  for (const g of gaps) {
    if (g.start > cursor) segments.push({ start: cursor, end: g.start });
    cursor = Math.max(cursor, g.end);
  }
  if (cursor < durationS) segments.push({ start: cursor, end: durationS });
  return segments;
}

// --- Report parsing (check-audio.mjs) --------------------------------------------

/** `ffprobe -show_entries stream=codec_name,channels,sample_rate:format=duration,size -of json` => report fields. */
export function parseProbe(json) {
  const data = JSON.parse(json);
  const stream = (data.streams ?? [])[0];
  if (!stream) throw new Error('no audio stream');
  return {
    codec: stream.codec_name,
    channels: Number(stream.channels),
    sampleRate: Number(stream.sample_rate),
    durationS: Math.round(Number(data.format?.duration ?? 0) * 1000) / 1000,
    bytes: Number(data.format?.size ?? 0),
  };
}

/** The summary of `ffmpeg -af ebur128=peak=true` => integrated loudness and true peak. */
export function parseEbur128(log) {
  const i = [...log.matchAll(/^\s*I:\s*(-?[\d.]+|-inf) LUFS/gm)].pop();
  const p = [...log.matchAll(/^\s*Peak:\s*(-?[\d.]+|-inf) dBFS/gm)].pop();
  if (!i || !p) throw new Error('no loudness summary in the ffmpeg output');
  const num = (v) => (v === '-inf' ? Number.NEGATIVE_INFINITY : Number(v));
  return { integratedLufs: num(i[1]), truePeakDb: num(p[1]) };
}

/** Which content refs have a file (paths relative to assets/audio). */
export function clipStatus(refs, files) {
  const unique = [...new Set(refs)];
  const have = new Set(files.map((f) => refFromFile(f)));
  const missing = unique.filter((r) => !have.has(r));
  return { total: unique.length, present: unique.length - missing.length, missing };
}

/** How close to the target a clip must be before the top-up pass stops. */
export const LOUDNESS_SETTLE_DB = 0.5;
/** Below this the clip is silence (the ebur128 absolute gate); never boost it. */
const SILENCE_LUFS = -60;

/**
 * The gain the top-up pass applies. The §3.11 loudnorm pass needs about 3 s of
 * audio to reach its target, so a 0.3 s syllable usually lands 2-5 dB short;
 * process-recordings.mjs then applies this gain behind a peak limiter until the
 * clip settles within LOUDNESS_SETTLE_DB of the target.
 */
export function correctionGain(measuredLufs, target = TARGET_LUFS) {
  if (!Number.isFinite(measuredLufs) || measuredLufs < SILENCE_LUFS) return 0;
  const gain = target - measuredLufs;
  return Math.abs(gain) <= LOUDNESS_SETTLE_DB ? 0 : Math.round(gain * 100) / 100;
}

/** At most this many top-up passes ... */
export const MAX_TOP_UP_PASSES = 10;
/**
 * ... and at most this much gain into the limiter in all. Measured on
 * synthesized syllables: a short plosive final (악, 압) needs about 15 dB to
 * reach -16 LUFS under the -2 dBFS limit, an open syllable 2-9 dB. A take that
 * needs more than this budget is not written.
 */
export const MAX_TOP_UP_DB = 18;
/** Above this much top-up gain the clip is heavily limited: process-recordings asks for a listen before it is committed. */
export const LIMITING_WARN_DB = 8;

/**
 * The gain of the next top-up pass, or 0 to stop (settled, silent, out of
 * passes, or the gain budget spent). The budget keeps the limiter from
 * squashing a quiet take, which would smear the unreleased finals (악 / 압).
 *
 * @param {number} measuredLufs
 * @param {{ passes: number, appliedDb: number }} state passes done and positive gain added so far
 */
export function nextTopUp(measuredLufs, { passes, appliedDb }) {
  if (passes >= MAX_TOP_UP_PASSES) return 0;
  const gain = correctionGain(measuredLufs);
  if (gain <= 0) return gain;
  const room = MAX_TOP_UP_DB - appliedDb;
  return room <= 0 ? 0 : Math.round(Math.min(gain, room) * 100) / 100;
}

/** After the top-up: `settled` (within LOUDNESS_SETTLE_DB), `accepted` (within the acceptance tolerance), or `rejected` (not written). */
export function topUpOutcome(measuredLufs) {
  if (!Number.isFinite(measuredLufs)) return 'rejected';
  const off = Math.abs(measuredLufs - TARGET_LUFS);
  if (off <= LOUDNESS_SETTLE_DB) return 'settled';
  return off <= LUFS_TOLERANCE + 1e-9 ? 'accepted' : 'rejected';
}

/**
 * What process-recordings does with one delivered file. A file the script does
 * not name (a typo) never reaches assets/: it would become an AUDIO_ASSETS key
 * no content refers to. A Batch 2 name clip waits for `--names`, which is run
 * once jamo.ts carries `nameAudioRef` (F-AUDIO-004 A-10).
 *
 * @param {string} fileId
 * @param {{ expected: ReadonlySet<string>, names: ReadonlySet<string> }} sets
 * @param {{ names?: boolean, allowExtra?: boolean }} opts
 * @returns {{ action: 'process' } | { action: 'skip', reason: string }}
 */
export function planRecording(fileId, { expected, names }, opts) {
  if (expected.has(fileId)) return { action: 'process' };
  if (names.has(fileId)) {
    return opts.names
      ? { action: 'process' }
      : { action: 'skip', reason: `${fileId} is a Batch 2 name clip; pass --names once jamo.ts has its nameAudioRef (A-10)` };
  }
  return opts.allowExtra
    ? { action: 'process' }
    : { action: 'skip', reason: `${fileId} is not in the recording script (check the name, or pass --allow-extra)` };
}

/** Whether `dir` is `root` or below it (absolute, resolved paths; either separator). */
export function isInsideDir(dir, root) {
  const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const d = norm(dir);
  const r = norm(root);
  return d === r || d.startsWith(`${r}/`);
}

/**
 * The MP3 bitrates `process-recordings.mjs --bitrate` accepts (AMENDMENTS-AUDIO-CLIPS AC-B5 step 3, AU-OD-7):
 * 64 kbps at 44.1 kHz for jamo clips (F-AUDIO-004 §3.11, the default), 48 kbps for the text-keyed `say` group.
 * 48 implies 24 kHz: a 24 kHz master stays 24 kHz (MPEG-2 Layer III, which iOS 14 Safari and AVFoundation decode).
 */
export const MP3_BITRATES = Object.freeze({ 64: 44100, 48: 24000 });
export const DEFAULT_MP3_BITRATE = 64;

/** `--bitrate` as a number of kbps; throws on anything else. */
export function parseBitrate(value) {
  if (value === undefined) return DEFAULT_MP3_BITRATE;
  const kbps = /^\d+$/.test(String(value)) ? Number(value) : NaN;
  if (!Object.prototype.hasOwnProperty.call(MP3_BITRATES, kbps)) {
    throw new Error(`--bitrate must be ${Object.keys(MP3_BITRATES).sort((a, b) => b - a).join(' or ')} (kbps), not ${value}`);
  }
  return kbps;
}

/**
 * The bitrates each `process-recordings.mjs --group` accepts, its default first (AU-OD-7): jamo and vocab clips are
 * 64 kbps at 44.1 kHz only; the text-keyed `say` group is 48 kbps at 24 kHz, or 64 kbps if the pilot listen recorded
 * in AMENDMENTS-AUDIO-CLIPS section 13 finds 48 kbps not good enough (AC-B5 step 3).
 */
export const GROUP_BITRATES = Object.freeze({ jamo: [64], vocab: [64], say: [48, 64] });
export const RECORDING_GROUPS = Object.freeze(Object.keys(GROUP_BITRATES));

/** A group's MP3 bitrate from `--bitrate` (undefined: the group's default); throws on one the group does not take. */
export function groupBitrate(group, value) {
  const allowed = GROUP_BITRATES[group];
  if (allowed === undefined) throw new Error(`--group must be ${RECORDING_GROUPS.join(', ')}, not ${group}`);
  if (value === undefined) return allowed[0];
  const kbps = parseBitrate(value);
  if (!allowed.includes(kbps)) {
    throw new Error(`--group ${group} is encoded at ${allowed.join(' or ')} kbps (AU-OD-7), not ${kbps}`);
  }
  return kbps;
}

/** The file ids of the text-keyed `say` group: the keys of the clip manifest's `audio/say/` rows (AC-B4). */
export function sayRecordingIds(manifest) {
  return (manifest?.rows ?? []).filter((r) => String(r.ref).startsWith('audio/say/')).map((r) => r.key);
}

/** The ffmpeg output arguments of the final MP3 encode: mono CBR at the bitrate's sample rate, no metadata. */
export function mp3EncodeArgs(kbps = DEFAULT_MP3_BITRATE) {
  const sampleRate = MP3_BITRATES[kbps];
  if (sampleRate === undefined) throw new Error(`no sample rate for ${kbps} kbps`);
  return ['-ar', String(sampleRate), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', '-id3v2_version', '0'];
}
