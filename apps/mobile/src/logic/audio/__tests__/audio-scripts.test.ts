import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIO_PACKS, AUDIO_REF_PATTERN as SCHEMA_PATTERN, type Jamo } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll, jamoWordBuilder } from '../../../content/jamo';
import {
  AUDIO_REF_PATTERN,
  PRECACHED_AUDIO_PACKS,
  REF_RUNTIME_CACHE,
  SAY_RUNTIME_CACHE,
  audioPrecacheIgnores,
  clipPackMap,
  clipUnitOfSource,
  clipUnitsOf,
  isPrecachedAudio,
  packChunkMarker,
  packChunkModule,
  precachedClipBytes,
  precachedPackFiles,
  refOfBuiltClip,
  renderAudioModules,
  renderPackChunk,
  splitAssetMap,
  WORD_BUILDER_UNIT,
  JAMO_PACK_STAGE1,
  JAMO_PACK_WORD_BUILDER,
  RUNTIME_AUDIO_GROUPS,
  audioRuntimeCaching,
  buildAssetMap,
  clipSets,
  clipStatus,
  correctionGain,
  evaluateReport,
  evaluateSet,
  isInsideDir,
  isRuntimeAudio,
  jamoClipRefs,
  LIMITING_WARN_DB,
  MAX_TOP_UP_DB,
  MAX_TOP_UP_PASSES,
  mergeAssetMaps,
  nameRows,
  nextTopUp,
  parseEbur128,
  parseJamoSource,
  parseProbe,
  parseSilences,
  parseTakeFile,
  planRecording,
  precacheGaps,
  precacheLeaks,
  recordingRows,
  refFromFile,
  refsInRenderedMap,
  renderAssetMap,
  renderRecordingScript,
  takeSegments,
  topUpOutcome,
  vocabAudioRef,
  vocabClipRefs,
  vocabRecordingRows,
} from '../../../../scripts/audio/lib.mjs';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';

/** The pure cores of apps/mobile/scripts/audio (F-AUDIO-004 §3.10, §5 audio-scripts.test.ts). */

describe('scripts/audio/lib: the ref grammar', () => {
  it('is the same pattern as the content schema', () => {
    expect(AUDIO_REF_PATTERN.source).toBe(SCHEMA_PATTERN.source);
    expect(AUDIO_REF_PATTERN.flags).toBe(SCHEMA_PATTERN.flags);
  });

  it('accepts the text-keyed say group (AMENDMENTS-AUDIO-CLIPS AC-B4) and keeps .mp3', () => {
    expect(AUDIO_REF_PATTERN.test('audio/say/0123456789abcdef.mp3')).toBe(true);
    expect(AUDIO_REF_PATTERN.test('audio/say/0123456789abcdef.wav')).toBe(false);
  });

  it('a say file not named by a 16-hex key fails the map build loudly (it could never be found by text)', () => {
    for (const file of ['say/foo.mp3', 'say/0123456789ABCDEF.mp3', 'say/ab/0123456789abcdef.mp3']) {
      expect(() => buildAssetMap([file])).toThrow(/does not make a valid audioRef/);
    }
  });

  it('the two jamo pack ids are on the shared pack list', () => {
    expect(AUDIO_PACKS).toContain(JAMO_PACK_STAGE1);
    expect(AUDIO_PACKS).toContain(JAMO_PACK_WORD_BUILDER);
    expect([JAMO_PACK_STAGE1, JAMO_PACK_WORD_BUILDER]).toEqual(['jamo-s1', 'jamo-wb']);
  });

  it('refFromFile prefixes audio/ and normalises separators', () => {
    expect(refFromFile('jamo/giyeok.mp3')).toBe('audio/jamo/giyeok.mp3');
    expect(refFromFile('./jamo/giyeok-batchim.mp3')).toBe('audio/jamo/giyeok-batchim.mp3');
    expect(refFromFile('story\\heungbu\\line-1.mp3')).toBe('audio/story/heungbu/line-1.mp3');
  });
});

describe('scripts/audio/lib: buildAssetMap', () => {
  it('maps each mp3 to its ref and a literal require path, sorted by ref', () => {
    expect(buildAssetMap(['jamo/nieun.mp3', 'jamo/giyeok-batchim.mp3', 'jamo/giyeok.mp3'])).toEqual([
      { ref: 'audio/jamo/giyeok-batchim.mp3', require: '../../../assets/audio/jamo/giyeok-batchim.mp3' },
      { ref: 'audio/jamo/giyeok.mp3', require: '../../../assets/audio/jamo/giyeok.mp3' },
      { ref: 'audio/jamo/nieun.mp3', require: '../../../assets/audio/jamo/nieun.mp3' },
    ]);
  });

  it('is deterministic whatever order the files are listed in', () => {
    const files = ['vocab/ice-cream.mp3', 'jamo/a.mp3', 'story/heungbu/line-2.mp3', 'jamo/ya.mp3'];
    const once = buildAssetMap(files);
    expect(buildAssetMap([...files].reverse())).toEqual(once);
    expect(once.map((e) => e.ref)).toEqual([
      'audio/jamo/a.mp3',
      'audio/jamo/ya.mp3',
      'audio/story/heungbu/line-2.mp3',
      'audio/vocab/ice-cream.mp3',
    ]);
  });

  it('ignores files that are not mp3 (the processing inputs, notes, .DS_Store)', () => {
    expect(buildAssetMap(['jamo/giyeok.m4a', 'jamo/README.md', '.DS_Store', 'jamo/giyeok.wav'])).toEqual([]);
  });

  it('uses another require base when given (the e2e fixture folder)', () => {
    expect(buildAssetMap(['jamo/a.mp3'], '../fixtures')).toEqual([{ ref: 'audio/jamo/a.mp3', require: '../fixtures/jamo/a.mp3' }]);
  });

  it('an upper-case extension is an mp3 but not a valid ref', () => {
    expect(() => buildAssetMap(['jamo/a.MP3'])).toThrow(/valid audioRef/);
  });

  it('fails loudly on a file named by the letter, in upper case, or outside a known group', () => {
    expect(() => buildAssetMap(['jamo/ㄱ.mp3'])).toThrow(/valid audioRef/);
    expect(() => buildAssetMap(['jamo/Giyeok.mp3'])).toThrow(/valid audioRef/);
    expect(() => buildAssetMap(['sfx/ding.mp3'])).toThrow(/valid audioRef/);
    expect(() => buildAssetMap(['giyeok.mp3'])).toThrow(/valid audioRef/);
  });

  it('maps a say clip like any other group', () => {
    expect(buildAssetMap(['say/0123456789abcdef.mp3'])).toEqual([
      { ref: 'audio/say/0123456789abcdef.mp3', require: '../../../assets/audio/say/0123456789abcdef.mp3' },
    ]);
  });

  it('carries each clip\'s pack when a pack lookup is given; a clip with no pack has none', () => {
    const packOf = (ref: string) => (ref === 'audio/jamo/giyeok.mp3' ? 'jamo-s1' : ref === 'audio/jamo/ae.mp3' ? 'jamo-wb' : undefined);
    expect(buildAssetMap(['jamo/ae.mp3', 'jamo/giyeok.mp3', 'say/0123456789abcdef.mp3'], undefined, packOf)).toEqual([
      { ref: 'audio/jamo/ae.mp3', require: '../../../assets/audio/jamo/ae.mp3', pack: 'jamo-wb' },
      { ref: 'audio/jamo/giyeok.mp3', require: '../../../assets/audio/jamo/giyeok.mp3', pack: 'jamo-s1' },
      { ref: 'audio/say/0123456789abcdef.mp3', require: '../../../assets/audio/say/0123456789abcdef.mp3' },
    ]);
  });

  it('refuses two files for one ref', () => {
    expect(() => buildAssetMap(['jamo/a.mp3', './jamo/a.mp3'])).toThrow(/two audio files/);
  });

  it('mergeAssetMaps keeps one sorted list and refuses a ref given twice', () => {
    const shipped = buildAssetMap(['jamo/nieun.mp3']);
    const fixtures = buildAssetMap(['jamo/giyeok.mp3'], '../fx');
    expect(mergeAssetMaps(shipped, fixtures).map((e) => e.ref)).toEqual(['audio/jamo/giyeok.mp3', 'audio/jamo/nieun.mp3']);
    expect(() => mergeAssetMaps(shipped, buildAssetMap(['jamo/nieun.mp3'], '../fx'))).toThrow(/two audio files/);
  });
});

describe('scripts/audio/lib: renderAssetMap', () => {
  it('renders an empty map with no require at all', () => {
    const src = renderAssetMap([]);
    expect(src).toContain('export const AUDIO_ASSETS: Readonly<Record<string, number | string>> = {};');
    expect(src).not.toContain('require(');
    expect(src.endsWith('\n')).toBe(true);
    expect(refsInRenderedMap(src)).toEqual([]);
    // Everything must work with an empty map: the pack map is empty too, typed by the shared pack list.
    expect(src).toContain("import type { AudioPack } from '@hangul-route/content-schema';");
    expect(src).toContain('export const AUDIO_ASSET_PACKS: Readonly<Record<string, AudioPack>> = {};');
  });

  it('renders the pack of each clip that has one (AMENDMENTS-AUDIO-CLIPS AC-B6)', () => {
    const packOf = (ref: string) => (ref.startsWith('audio/jamo/') ? 'jamo-s1' : undefined);
    const src = renderAssetMap(buildAssetMap(['jamo/giyeok.mp3', 'say/0123456789abcdef.mp3'], undefined, packOf));
    expect(src).toContain("export const AUDIO_ASSET_PACKS: Readonly<Record<string, AudioPack>> = {\n  'audio/jamo/giyeok.mp3': 'jamo-s1',\n};");
    expect(src).not.toContain("'audio/say/0123456789abcdef.mp3': '");
    expect(refsInRenderedMap(src)).toEqual(['audio/jamo/giyeok.mp3', 'audio/say/0123456789abcdef.mp3']);
  });

  it('renders one literal require per clip and reads the refs back', () => {
    const src = renderAssetMap(buildAssetMap(['jamo/giyeok.mp3', 'jamo/a.mp3']));
    expect(src).toContain("  'audio/jamo/a.mp3': require('../../../assets/audio/jamo/a.mp3'),");
    expect(src).toContain("  'audio/jamo/giyeok.mp3': require('../../../assets/audio/jamo/giyeok.mp3'),");
    expect(src).toMatch(/^\/\/ GENERATED/);
    expect(refsInRenderedMap(src)).toEqual(['audio/jamo/a.mp3', 'audio/jamo/giyeok.mp3']);
  });
});

/**
 * A small clip manifest in the shape of content/audio/tts-manifest.json (row AC-2): two Stage 1 letters (jamo-s1), a
 * Word Builder letter and its name (jamo-wb), a word of a Stage 1 quest and one of a Stage 2 cell (say), a vocabulary
 * record clip, a story sentence and a card word. The real manifest is pinned by the drift test; these rows pin the rules.
 */
const SAY_Q1 = 'audio/say/1098bbe54520ab2a.mp3';
const SAY_S2 = 'audio/say/6852b2954fc85566.mp3';
const SAY_STORY = 'audio/say/e139a8ff4b5e8c99.mp3';
const SAY_CARD = 'audio/say/3f663e28cb8bea91.mp3';
const FIXTURE_MANIFEST = {
  rows: [
    { ref: 'audio/jamo/giyeok.mp3', pack: 'jamo-s1', sources: ['jamo:giyeok#sound'] },
    { ref: 'audio/jamo/giyeok-name.mp3', pack: 'jamo-s1', sources: ['jamo:giyeok#letter'] },
    { ref: 'audio/jamo/ae.mp3', pack: 'jamo-wb', sources: ['jamo:ae#sound'] },
    { ref: 'audio/jamo/ssanggiyeok-name.mp3', pack: 'jamo-wb', sources: ['jamo:ssanggiyeok#letter'] },
    { ref: SAY_Q1, pack: 'stage1', sources: ['minigame:s1-letters-q1-check', 'quest:stage1-letters-q1', 'syl:na'] },
    { ref: SAY_S2, pack: 'stage2', sources: ['content/episodes/stage-2/life.json', 'content/vocab/school.json', 'vocab:gabang'] },
    { ref: 'audio/vocab/gangaji.mp3', pack: 'vocab', sources: ['content/vocab/animals.json'] },
    { ref: SAY_STORY, pack: 'stories', sources: ['content/stories/chuseok-ganggangsullae.json'] },
    { ref: SAY_CARD, pack: 'cards', sources: ['card:gamsa'] },
  ],
};
const JAMO_SOURCE = readFileSync(join(__dirname, '../../../content/jamo.ts'), 'utf8');
const PACKS = clipPackMap(FIXTURE_MANIFEST, JAMO_SOURCE);

describe('scripts/audio/lib: pack membership from the clip manifest (AMENDMENTS-AUDIO-CLIPS AC-B6, row AC-6)', () => {
  it('reads each clip\'s pack from the manifest, and a jamo clip the manifest does not list from jamo.ts', () => {
    expect(PACKS.get('audio/jamo/giyeok.mp3')).toBe('jamo-s1');
    expect(PACKS.get('audio/jamo/ae.mp3')).toBe('jamo-wb');
    expect(PACKS.get(SAY_Q1)).toBe('stage1');
    expect(PACKS.get('audio/vocab/gangaji.mp3')).toBe('vocab');
    // Not in the fixture manifest: jamo.ts still places every jamo clip (43 jamo-s1, 22 jamo-wb).
    expect(PACKS.get('audio/jamo/nieun.mp3')).toBe('jamo-s1');
    expect(PACKS.get('audio/jamo/yae.mp3')).toBe('jamo-wb');
    expect(clipPackMap(null, JAMO_SOURCE).get(SAY_Q1)).toBeUndefined();
  });

  it('the real manifest precaches exactly the 43 jamo-s1 clips, and every one is a jamo clip', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../../../../../content/audio/tts-manifest.json'), 'utf8')) as typeof FIXTURE_MANIFEST;
    const packs = clipPackMap(manifest, JAMO_SOURCE);
    const precached = [...packs].filter(([ref]) => isPrecachedAudio(`assets/assets/${ref.replace(/\.mp3$/, '.0123456789abcdef0123456789abcdef.mp3')}`, packs));
    expect(precached).toHaveLength(43);
    expect(precached.every(([ref, pack]) => ref.startsWith('audio/jamo/') && pack === 'jamo-s1')).toBe(true);
    expect([...packs.values()].filter((p) => p === 'jamo-wb')).toHaveLength(22);
  });

  it('only jamo-s1 is a precached pack (G5)', () => {
    expect([...PRECACHED_AUDIO_PACKS]).toEqual(['jamo-s1']);
  });
});

describe('scripts/audio/lib: the PWA precache rules (AD10, AC-B6)', () => {
  it('reads the ref of a built clip, its content hash and query dropped', () => {
    expect(refOfBuiltClip('assets/assets/audio/jamo/giyeok.0d663d9a0166e1ebe46c80873605ae07.mp3')).toBe('audio/jamo/giyeok.mp3');
    expect(refOfBuiltClip('/assets/e2e/fixtures/audio/jamo/a.24fd18fd6b26c4107536682485ab1e7e.mp3?__WB_REVISION__=1')).toBe('audio/jamo/a.mp3');
    expect(refOfBuiltClip('/assets/assets/audio/story/heungbu/line-1.abc.mp3')).toBe('audio/story/heungbu/line-1.mp3');
    expect(refOfBuiltClip('assets/assets/audio/say/1098bbe54520ab2a.ffff.mp3')).toBe(SAY_Q1);
    expect(refOfBuiltClip('assets/assets/audio/vocab/notes.txt')).toBeNull();
    expect(refOfBuiltClip('assets/myaudio/vocab/x.mp3')).toBeNull();
  });

  it('precaches the jamo-s1 clips only: jamo-wb, say, vocabulary, story, card and dialogue clips are runtime', () => {
    expect([...RUNTIME_AUDIO_GROUPS]).toEqual(['vocab', 'story', 'card', 'dialogue']);
    expect(isRuntimeAudio('assets/assets/audio/jamo/giyeok.abc.mp3', PACKS)).toBe(false);
    expect(isRuntimeAudio('assets/assets/audio/jamo/giyeok-name.abc.mp3', PACKS)).toBe(false);
    expect(isRuntimeAudio('assets/assets/audio/jamo/ae.abc.mp3', PACKS)).toBe(true);
    expect(isRuntimeAudio('assets/assets/audio/jamo/ssanggiyeok-name.abc.mp3', PACKS)).toBe(true);
    expect(isRuntimeAudio(`assets/assets/${SAY_Q1}`, PACKS)).toBe(true);
    expect(isRuntimeAudio('assets/assets/audio/vocab/ice-cream.abc.mp3', PACKS)).toBe(true);
    expect(isRuntimeAudio('/assets/assets/audio/story/heungbu/line-1.abc.mp3', PACKS)).toBe(true);
    expect(isRuntimeAudio('audio/card/hanbok.mp3', PACKS)).toBe(true);
    expect(isRuntimeAudio('assets/assets/audio/dialogue/hello.mp3', PACKS)).toBe(true);
    expect(isRuntimeAudio('assets/assets/audio/vocab/notes.txt', PACKS)).toBe(false);
    expect(isRuntimeAudio('assets/myaudio/vocab/x.mp3', PACKS)).toBe(false);
    // A jamo clip with no pack is never precached by accident: the build names it (precacheLeaks).
    expect(isRuntimeAudio('assets/assets/audio/jamo/not-a-letter.abc.mp3', PACKS)).toBe(true);
    // With no pack lookup at all, nothing is precached.
    expect(isRuntimeAudio('assets/assets/audio/jamo/giyeok.abc.mp3')).toBe(true);
  });

  it('the Workbox ignore globs name the record and say groups and every jamo clip outside jamo-s1', () => {
    const ignores = audioPrecacheIgnores(PACKS);
    expect(ignores[0]).toBe('**/audio/{vocab,story,card,dialogue,say}/**');
    expect(ignores).toContain('**/audio/jamo/ae.mp3');
    expect(ignores).toContain('**/audio/jamo/ae.*.mp3');
    expect(ignores).toContain('**/audio/jamo/ssanggiyeok-name.*.mp3');
    // 22 jamo-wb clips, two globs each, and never a jamo-s1 clip.
    expect(ignores).toHaveLength(1 + 2 * 22);
    expect(ignores.some((g) => g.includes('/giyeok.') || g.includes('/giyeok-name.'))).toBe(false);
  });

  it('the say clips get their own cache-first cache of 1,600, the record clips keep hr-audio-v1 and its 400', () => {
    const [say, refs] = audioRuntimeCaching();
    expect(SAY_RUNTIME_CACHE).toEqual({ cacheName: 'hr-audio-say-v1', maxEntries: 1600 });
    expect(REF_RUNTIME_CACHE).toEqual({ cacheName: 'hr-audio-v1', maxEntries: 400 });
    const audioOnly = { statuses: [200], headers: { 'content-type': 'audio/mpeg' } };
    expect(say?.handler).toBe('CacheFirst');
    expect(say?.options).toEqual({ cacheName: 'hr-audio-say-v1', expiration: { maxEntries: 1600 }, cacheableResponse: audioOnly });
    expect(refs?.handler).toBe('CacheFirst');
    expect(refs?.options).toEqual({ cacheName: 'hr-audio-v1', expiration: { maxEntries: 400 }, cacheableResponse: audioOnly });
    const host = 'https://app.hangulroute.com/assets/assets/audio';
    expect(say?.urlPattern.test(`${host}/say/1098bbe54520ab2a.0d663d9a0166e1ebe46c80873605ae07.mp3`)).toBe(true);
    expect(say?.urlPattern.test(`${host}/say/1098bbe54520ab2a.mp3`)).toBe(true);
    expect(say?.urlPattern.test(`${host}/vocab/ice-cream.1a2b.mp3`)).toBe(false);
    expect(say?.urlPattern.test(`${host}/say/1098bbe54520ab2a.png`)).toBe(false);
    expect(refs?.urlPattern.test(`${host}/vocab/ice-cream.1a2b.mp3`)).toBe(true);
    expect(refs?.urlPattern.test(`${host}/story/heungbu/line-1.mp3`)).toBe(true);
    // A jamo-wb clip is fetched at run time; a jamo-s1 clip never reaches this rule (the precache route answers first).
    expect(refs?.urlPattern.test(`${host}/jamo/ae.1a2b.mp3`)).toBe(true);
    expect(refs?.urlPattern.test(`${host}/say/1098bbe54520ab2a.mp3`)).toBe(false);
    expect(refs?.urlPattern.test(`${host}/vocab/ice-cream.png`)).toBe(false);
  });

  it('precacheGaps lists jamo-s1 clips missing from the manifest and nothing of the runtime packs', () => {
    const dist = [
      'assets/assets/audio/jamo/giyeok.aa.mp3',
      'assets/assets/audio/jamo/nieun.bb.mp3',
      'assets/__node_modules/.pnpm/x/audio/jamo/giyeok-name.cc.mp3',
      'assets/assets/audio/jamo/ae.ee.mp3',
      `assets/assets/${SAY_Q1.replace('.mp3', '.ff.mp3')}`,
      'assets/assets/audio/vocab/ice-cream.dd.mp3',
    ];
    const manifest = ['assets/assets/audio/jamo/giyeok.aa.mp3', '/assets/assets/audio/jamo/nieun.bb.mp3?__WB_REVISION__=1'];
    expect(precacheGaps(dist, manifest, PACKS)).toEqual(['assets/__node_modules/.pnpm/x/audio/jamo/giyeok-name.cc.mp3']);
    expect(precacheGaps([], manifest, PACKS)).toEqual([]);
  });

  it('precacheLeaks lists every clip outside jamo-s1 that reached the manifest, and precachedPackFiles a pack\'s files', () => {
    const manifest = [
      'index.html',
      'assets/assets/audio/vocab/a.mp3',
      'assets/assets/audio/jamo/giyeok.aa.mp3',
      'assets/assets/audio/jamo/ae.ee.mp3',
      `assets/assets/${SAY_S2}`,
    ];
    expect(precacheLeaks(manifest, PACKS)).toEqual(['assets/assets/audio/jamo/ae.ee.mp3', `assets/assets/${SAY_S2}`, 'assets/assets/audio/vocab/a.mp3']);
    expect(precachedPackFiles(manifest, PACKS, 'jamo-wb')).toEqual(['assets/assets/audio/jamo/ae.ee.mp3']);
    expect(precachedPackFiles(manifest, PACKS, 'jamo-s1')).toEqual(['assets/assets/audio/jamo/giyeok.aa.mp3']);
  });

  it('precachedClipBytes counts the precached jamo-s1 clips only (the G5 growth)', () => {
    const entries = [
      { url: 'index.html', size: 900 },
      { url: 'assets/assets/audio/jamo/giyeok.aa.mp3', size: 8000 },
      { url: 'assets/assets/audio/jamo/giyeok-name.bb.mp3', size: 9000 },
      { url: 'assets/assets/audio/jamo/ae.cc.mp3', size: 7000 },
    ];
    expect(precachedClipBytes(entries, PACKS)).toEqual({ count: 2, bytes: 17_000 });
    expect(precachedClipBytes([], PACKS)).toEqual({ count: 0, bytes: 0 });
  });
});

describe('scripts/audio/lib: the per-pack map chunks (AC-B6, bundle size)', () => {
  const entries = buildAssetMap(
    ['jamo/giyeok.mp3', 'jamo/ae.mp3', SAY_Q1.slice('audio/'.length), SAY_S2.slice('audio/'.length), 'vocab/gangaji.mp3', SAY_STORY.slice('audio/'.length), 'story/heungbu/line-1.mp3'],
    undefined,
    (ref) => PACKS.get(ref),
  );

  it('the start map holds only jamo-s1 refs (and a ref with no pack); every other pack is a chunk of its own', () => {
    const { start, chunks } = splitAssetMap(entries);
    expect(start.map((e) => e.ref)).toEqual(['audio/jamo/giyeok.mp3', 'audio/story/heungbu/line-1.mp3']);
    expect(start.filter((e) => e.pack !== undefined).every((e) => e.pack === 'jamo-s1')).toBe(true);
    expect(chunks.map((c) => c.pack)).toEqual(['jamo-wb', 'stage1', 'stage2', 'stories', 'vocab']);
    expect(chunks.find((c) => c.pack === 'stage1')?.entries.map((e) => e.ref)).toEqual([SAY_Q1]);
  });

  it('a say clip with no pack (no manifest row) never lands in the start map: the map generator stops on it', () => {
    const orphan = buildAssetMap(['jamo/giyeok.mp3', 'say/00000000deadbeef.mp3'], undefined, (ref) => PACKS.get(ref));
    expect(() => splitAssetMap(orphan)).toThrow(/audio\/say\/00000000deadbeef\.mp3/);
    expect(() => renderAudioModules(orphan)).toThrow(/no row in content\/audio\/tts-manifest\.json/);
    // With its pack, the same clip is a chunk's.
    const packed = buildAssetMap(['say/00000000deadbeef.mp3'], undefined, () => 'stage3');
    expect(splitAssetMap(packed).start).toEqual([]);
  });

  it('the rendered start map carries no chunk ref; the loader module loads each chunk through one literal import()', () => {
    const modules = renderAudioModules(entries, clipUnitsOf(FIXTURE_MANIFEST));
    const start = modules['audio-assets.ts'] ?? '';
    expect(refsInRenderedMap(start)).toEqual(['audio/jamo/giyeok.mp3', 'audio/story/heungbu/line-1.mp3']);
    for (const ref of [SAY_Q1, SAY_S2, SAY_STORY, 'audio/jamo/ae.mp3', 'audio/vocab/gangaji.mp3']) expect(start).not.toContain(ref);
    expect(start).toContain('export const AUDIO_CLIP_COUNT = 7;');
    expect(start).toContain("export const AUDIO_CHUNK_PACKS: readonly AudioPack[] = ['jamo-wb', 'stage1', 'stage2', 'stories', 'vocab'];");
    // The start map's loader holds one literal import() per pack chunk (never a static import of one), so a chunk's
    // URL is in the start bundle and its clips are not.
    expect(start).toContain("    case 'stage1':\n      return import('./audio-packs/audio-pack-stage1');");
    expect(start.match(/return import\(/g)).toHaveLength(5);
    expect(start).not.toMatch(/^import .*audio-packs/m);
    expect(Object.keys(modules).sort()).toEqual(['audio-assets.ts', ...['jamo-wb', 'stage1', 'stage2', 'stories', 'vocab'].map(packChunkModule)].sort());
  });

  it('a chunk carries its marker, its clips one folder deeper and the warm units of their sources', () => {
    const units = clipUnitsOf(FIXTURE_MANIFEST);
    const stage1 = renderPackChunk('stage1', entries.filter((e) => e.pack === 'stage1'), units);
    expect(stage1).toContain(`export const AUDIO_PACK_CHUNK = '${packChunkMarker('stage1')}';`);
    expect(packChunkMarker('stage1')).toBe('audio-pack:stage1');
    expect(stage1).toContain(`    '${SAY_Q1}': require('../../../../assets/audio/say/1098bbe54520ab2a.mp3'),`);
    expect(stage1).toContain("    'minigame:s1-letters-q1-check': [0],");
    expect(stage1).toContain("    'quest:stage1-letters-q1': [0],");
    expect(stage1).not.toContain('syl:');
    const stage2 = renderPackChunk('stage2', entries.filter((e) => e.pack === 'stage2'), units);
    expect(stage2).toContain("    'episode:stage2-life': [0],");
    expect(stage2).not.toContain('vocab:');
  });

  it('a source is a warm unit when a screen opens by it: a Stage 1 quest or game, a lesson cell, a story, the level check', () => {
    expect(clipUnitOfSource('quest:stage1-letters-q1')).toBe('quest:stage1-letters-q1');
    expect(clipUnitOfSource('minigame:s1-letters-q1-check')).toBe('minigame:s1-letters-q1-check');
    expect(clipUnitOfSource('content/episodes/stage-7/crafts.json')).toBe('episode:stage7-crafts');
    expect(clipUnitOfSource('content/stories/hangeul-day.json')).toBe('story:hangeul-day');
    expect(clipUnitOfSource('content/placement/sentences.json')).toBe('placement');
    expect(clipUnitOfSource('content/vocab/family.json')).toBe('topic:family');
    expect(clipUnitOfSource('card:gamsa')).toBe('card:gamsa');
    // A Word Builder jamo warms with the Word Builder cell; a Stage 1 jamo is precached, so it has no unit.
    expect(clipUnitOfSource('jamo:ae#sound', JAMO_PACK_WORD_BUILDER)).toBe(WORD_BUILDER_UNIT);
    expect(clipUnitOfSource('jamo:ssanggiyeok#letter', JAMO_PACK_WORD_BUILDER)).toBe('episode:stage2-letters');
    expect(clipUnitOfSource('jamo:giyeok#sound', JAMO_PACK_STAGE1)).toBeNull();
    for (const other of ['lex:gansik', 'pat:gamsahamnida', 'exc:gachi-gayo', 'vocab:gajok', 'content/vocab/_senses.json', 'syl:ga', 'jamo:giyeok#sound']) {
      expect(clipUnitOfSource(other), other).toBeNull();
    }
  });

  it('every jamo-wb clip of the real manifest has the Word Builder unit; vocabulary and card clips have their screen\'s unit', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../../../../../content/audio/tts-manifest.json'), 'utf8')) as {
      rows: { ref: string; pack: string; sources: string[] }[];
    };
    const units = clipUnitsOf(manifest);
    const wb = manifest.rows.filter((r) => r.pack === JAMO_PACK_WORD_BUILDER);
    expect(wb).toHaveLength(22);
    for (const row of wb) expect(units.get(row.ref), row.ref).toContain(WORD_BUILDER_UNIT);
    for (const pack of ['vocab', 'cards']) {
      const rows = manifest.rows.filter((r) => r.pack === pack);
      expect(rows.length, pack).toBeGreaterThan(0);
      for (const row of rows) expect(units.get(row.ref)?.length ?? 0, row.ref).toBeGreaterThan(0);
    }
  });

  it('every real manifest unit a lesson opens by names an episode, quest, game or story that ships', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../../../../../content/audio/tts-manifest.json'), 'utf8')) as typeof FIXTURE_MANIFEST;
    const units = new Set([...clipUnitsOf(manifest).values()].flat());
    expect(units.size).toBeGreaterThan(30);
    for (const unit of units) expect(unit).toMatch(/^(?:episode:stage\d-[a-z0-9-]+|story:[a-z0-9-]+|quest:[a-z0-9-]+|minigame:[a-z0-9-]+|topic:[a-z0-9-]+|card:[a-z0-9-]+|placement)$/);
  });
});

// --- Recording script (F-AUDIO-004 §3.11) -----------------------------------------

describe('scripts/audio/lib: the recording script rows', () => {
  const rows = recordingRows(jamoAll);

  it('has the 30 sound clips in the order of §3.2, numbered from 1', () => {
    expect(rows).toHaveLength(30);
    expect(rows.map((r) => r.n)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(rows.map((r) => r.fileId)).toEqual(
      [...jamoAll].sort((a, b) => a.order - b.order).map((j) => (j.audioRef ?? '').replace(/^audio\/jamo\//, '').replace(/\.mp3$/, '')),
    );
  });

  it('names every file by its id, unique, and never by the letter (AUD-08)', () => {
    const ids = rows.map((r) => r.fileId);
    expect(new Set(ids).size).toBe(30);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(ids).toContain('giyeok');
    expect(ids).toContain('giyeok-batchim');
  });

  it('a consonant says its ㅏ syllable, never its name or the ㅡ syllable', () => {
    expect(rows[0]).toEqual({
      n: 1,
      fileId: 'giyeok',
      say: '가',
      doNotSay: ['기역', '그'],
      romanization: 'ga',
      note: 'consonant sound = syllable with ㅏ',
    });
  });

  it('ㅇ says its name, never the ㅏ syllable that sounds like the vowel', () => {
    expect(rows[7]).toEqual({
      n: 8,
      fileId: 'ieung',
      say: '이응',
      doNotSay: ['아'],
      romanization: 'ieung',
      note: 'ㅇ is silent at the start; say its name',
    });
  });

  it('a vowel says itself with nothing to avoid', () => {
    expect(rows[14]).toEqual({ n: 15, fileId: 'a', say: '아', doNotSay: [], romanization: 'a', note: '' });
  });

  it('a final consonant says ㅇ + ㅏ + the final, never the doubled syllable or the name', () => {
    expect(rows[24]).toEqual({
      n: 25,
      fileId: 'giyeok-batchim',
      say: '악',
      doNotSay: ['각', '기역'],
      romanization: 'ak',
      note: 'end on the closed sound without letting it go; do not add a vowel after it',
    });
    expect(rows[26]).toMatchObject({ fileId: 'rieul-batchim', say: '알', doNotSay: ['랄', '리을'], note: 'end on the final sound; do not add a vowel after it' });
    expect(rows[28]).toMatchObject({ fileId: 'bieup-batchim', say: '압', doNotSay: ['밥', '비읍'] });
  });

  it('the final ㅇ never lists its own syllable as one to avoid', () => {
    expect(rows[29]).toMatchObject({ fileId: 'ieung-batchim', say: '앙', doNotSay: ['이응'], romanization: 'ang' });
    for (const r of rows) expect(r.doNotSay).not.toContain(r.say);
  });

  it('the romanization column is the spoken form\'s romanization', () => {
    for (const r of rows) {
      const j = jamoAll.find((x) => (x.audioRef ?? '').endsWith(`/${r.fileId}.mp3`));
      expect(r.romanization).toBe(j?.spokenRomanization);
      expect(r.say).toBe(j?.spokenKo);
    }
  });

  it('fails loudly on a record without a spoken form or an audioRef', () => {
    const [first] = jamoAll;
    expect(() => recordingRows([{ ...first!, spokenKo: undefined }])).toThrow(/spokenKo/);
    expect(() => recordingRows([{ ...first!, audioRef: undefined }])).toThrow(/audioRef/);
  });
});

describe('scripts/audio/lib: batch 2, the consonant names', () => {
  it('lists the 14 consonant names as <id>-name, in order', () => {
    const rows = nameRows(jamoAll);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual({ n: 1, fileId: 'giyeok-name', say: '기역', romanization: 'giyeok' });
    expect(rows[13]).toEqual({ n: 14, fileId: 'hieut-name', say: '히읗', romanization: 'hieut' });
    expect(new Set(rows.map((r) => r.fileId)).size).toBe(14);
  });
});

describe('scripts/audio/lib: vocabulary rows', () => {
  const topic = (key: string, items: object[]) => ({ schemaVersion: 1, topic: { key }, items });

  it('lists every word, its ref derived from the id when the file has none, ordered by topic then id', () => {
    const rows = vocabRecordingRows([
      topic('food', [
        { id: 'vocab:sagwa', ko: '사과', romanization: 'sagwa', en: 'apple', topics: ['food'], audioRef: 'audio/vocab/sagwa.mp3' },
        { id: 'vocab:bap', ko: '밥', romanization: 'bap', en: 'rice', topics: ['food'] },
      ]),
      topic('animals', [
        {
          id: 'vocab:horangi',
          ko: '호랑이',
          romanization: 'horangi',
          en: 'tiger',
          topics: ['animals'],
          audioRef: 'audio/vocab/horangi.mp3',
          senseNote: 'the animal',
        },
        { id: 'vocab:gae', ko: '개', romanization: 'gae', en: 'dog', topics: ['animals'], spokenKo: '개', audioRef: 'audio/vocab/gae.mp3' },
      ]),
    ]);
    expect(rows).toEqual([
      { fileId: 'gae', say: '개', spokenKo: '', romanization: 'gae', gloss: 'dog', topic: 'animals', note: '' },
      { fileId: 'horangi', say: '호랑이', spokenKo: '', romanization: 'horangi', gloss: 'tiger', topic: 'animals', note: 'the animal' },
      { fileId: 'bap', say: '밥', spokenKo: '', romanization: 'bap', gloss: 'rice', topic: 'food', note: '' },
      { fileId: 'sagwa', say: '사과', spokenKo: '', romanization: 'sagwa', gloss: 'apple', topic: 'food', note: '' },
    ]);
  });

  it('vocabClipRefs: every word of every topic file, the same refs the generated loader carries', () => {
    const files = [
      topic('food', [
        { id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', en: 'apple', topics: ['food'] },
        { id: 'vocab:bae-pear', ko: '배', romanization: 'bae', en: 'pear', topics: ['food'], audioRef: 'audio/vocab/bae-pear.mp3' },
      ]),
      topic('animals', [{ id: 'vocab:gom', ko: '곰', romanization: 'gom', en: 'bear', topics: ['animals'] }]),
    ];
    expect(vocabClipRefs(files)).toEqual(['audio/vocab/sagwa-apple.mp3', 'audio/vocab/bae-pear.mp3', 'audio/vocab/gom.mp3']);
    expect(vocabAudioRef('vocab:sagwa-apple')).toBe('audio/vocab/sagwa-apple.mp3');
  });

  it('the generated loader gives every word its own ref, the one the schema allows', () => {
    const refs = VOCAB_ITEMS.map((item) => item.audioRef);
    expect(refs).toEqual(VOCAB_ITEMS.map((item) => vocabAudioRef(item.id)));
    expect(new Set(refs).size).toBe(VOCAB_ITEMS.length);
    for (const ref of refs) expect(ref).toMatch(AUDIO_REF_PATTERN);
  });

  it('shows spokenKo only when it differs from the written word', () => {
    const [row] = vocabRecordingRows([
      topic('numbers', [
        { id: 'vocab:sip', ko: '십', romanization: 'sip', en: 'ten', topics: ['numbers'], spokenKo: '씹', audioRef: 'audio/vocab/sip.mp3' },
      ]),
    ]);
    expect(row?.spokenKo).toBe('씹');
  });

  it('orders two words of one topic by id, whatever the file order', () => {
    const rows = vocabRecordingRows([
      topic('food', [
        { id: 'vocab:sagwa', ko: '사과', romanization: 'sagwa', en: 'apple', topics: ['food'], audioRef: 'audio/vocab/sagwa.mp3' },
        { id: 'vocab:bap', ko: '밥', romanization: 'bap', en: 'rice', topics: ['food'], audioRef: 'audio/vocab/bap.mp3' },
      ]),
    ]);
    expect(rows.map((r) => r.fileId)).toEqual(['bap', 'sagwa']);
  });

  it('refuses a nested ref, which could never be a recording file name', () => {
    expect(() =>
      vocabRecordingRows([
        topic('food', [
          { id: 'vocab:sagwa', ko: '사과', romanization: 'sagwa', en: 'apple', topics: ['food'], audioRef: 'audio/vocab/food/sagwa.mp3' },
        ]),
      ]),
    ).toThrow(/flat/);
  });

  it('is empty only when there is no word, and skips a record with no vocab id', () => {
    expect(vocabRecordingRows([topic('food', [])])).toEqual([]);
    expect(vocabRecordingRows([topic('food', [{ ko: '밥', romanization: 'bap', en: 'rice', topics: ['food'] }])])).toEqual([]);
    expect(vocabClipRefs([topic('food', [{ id: 'bap', ko: '밥', romanization: 'bap', en: 'rice', topics: ['food'] }])])).toEqual([]);
  });
});

describe('scripts/audio/lib: renderRecordingScript', () => {
  const md = renderRecordingScript(recordingRows(jamoAll), nameRows(jamoAll), []);

  it('is marked generated and points at the runbook for the rules', () => {
    expect(md.startsWith('# Audio recording script')).toBe(true);
    expect(md).toContain('GENERATED by apps/mobile/scripts/audio/gen-recording-script.mjs');
    expect(md).toContain('owner-runbook.md');
  });

  it('has one table row per clip with the columns of §3.11', () => {
    expect(md).toContain('| # | file id | Say exactly | Do NOT say | Romanization | Note |');
    expect(md).toContain('| 1 | giyeok | 가 | 기역, 그 | ga | consonant sound = syllable with ㅏ |');
    expect(md).toContain('| 15 | a | 아 |  | a |  |');
    expect(md).toContain('| 1 | giyeok-name | 기역 | giyeok |');
  });

  it('says so when no vocabulary clip is planned, and lists them when one is', () => {
    expect(md).toContain('No vocabulary clips are planned yet.');
    const withVocab = renderRecordingScript([], [], [
      { fileId: 'sagwa', say: '사과', spokenKo: '', romanization: 'sagwa', gloss: 'apple', topic: 'food', note: '' },
    ]);
    expect(withVocab).toContain('| file id | Say (ko) | spokenKo if different | Romanization | Gloss | Topic | Note |');
    expect(withVocab).toContain('| sagwa | 사과 |  | sagwa | apple | food |  |');
  });

  it('is deterministic and ends with one newline', () => {
    expect(renderRecordingScript(recordingRows(jamoAll), nameRows(jamoAll), [])).toBe(md);
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});

describe('scripts/audio/lib: parseJamoSource (how the plain-node generator reads jamo.ts)', () => {
  it('reads exactly the records the app ships', () => {
    const source = readFileSync(join(__dirname, '../../../content/jamo.ts'), 'utf8');
    const pick = (j: Partial<Jamo>) => ({
      id: j.id,
      kind: j.kind,
      char: j.char,
      order: j.order,
      audioRef: j.audioRef,
      spokenKo: j.spokenKo,
      spokenRomanization: j.spokenRomanization,
      spokenKind: j.spokenKind,
      nameKo: j.nameKo,
    });
    expect(parseJamoSource(source).map(pick)).toEqual(jamoAll.map(pick));
  });

  it('fails loudly when the factories cannot be read', () => {
    expect(() => parseJamoSource('export const jamoAll = [];')).toThrow(/no jamo records/);
    expect(() => parseJamoSource("  c('giyeok', 'ㄱ'),\n")).toThrow(/giyeok/);
  });
});

// --- Clip acceptance (F-AUDIO-004 §3.11 table) -----------------------------------

describe('scripts/audio/lib: evaluateReport', () => {
  const good = { channels: 1, sampleRate: 44100, codec: 'mp3', durationS: 0.91, integratedLufs: -16.4, truePeakDb: -1.6, bytes: 7314 };

  it('passes a clip inside every limit', () => {
    expect(evaluateReport('jamo', good)).toEqual([]);
    expect(evaluateReport('word', { ...good, durationS: 3.2, bytes: 30_000 })).toEqual([]);
  });

  it.each([
    ['channels', { channels: 2 }, /mono/],
    ['sample rate', { sampleRate: 48000 }, /44100/],
    ['codec', { codec: 'aac' }, /mp3/],
    ['too short', { durationS: 0.5 }, /duration/],
    ['too long for a jamo', { durationS: 1.6 }, /duration/],
    ['too quiet', { integratedLufs: -17.6 }, /loudness/],
    ['too loud', { integratedLufs: -14.4 }, /loudness/],
    ['peak', { truePeakDb: -1.0 }, /true peak/],
    ['size', { bytes: 12_001 }, /size/],
  ])('fails a jamo clip on %s', (_name, patch, message) => {
    const failures = evaluateReport('jamo', { ...good, ...patch });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(message);
  });

  it('accepts the edges of each range', () => {
    expect(evaluateReport('jamo', { ...good, durationS: 0.6, integratedLufs: -17.5, truePeakDb: -1.5, bytes: 12_000 })).toEqual([]);
    expect(evaluateReport('jamo', { ...good, durationS: 1.5, integratedLufs: -14.5 })).toEqual([]);
    expect(evaluateReport('word', { ...good, durationS: 4.0, bytes: 40_000 })).toEqual([]);
  });

  it('uses the word limits for a word clip', () => {
    expect(evaluateReport('word', { ...good, durationS: 4.1 })[0]).toMatch(/duration/);
    expect(evaluateReport('word', { ...good, bytes: 40_001 })[0]).toMatch(/size/);
  });

  it('evaluateSet checks the total size of a set', () => {
    expect(evaluateSet('jamo', [400_000])).toEqual([]);
    expect(evaluateSet('jamo', [200_000, 200_001])[0]).toMatch(/400000/);
    expect(evaluateSet('word', [1_500_001])[0]).toMatch(/1500000/);
    expect(evaluateSet('word', [1_500_001], 'topic food')[0]).toMatch(/^topic food: /);
  });

  it('a silent-peak clip (-inf dBTP) passes the peak limit', () => {
    expect(evaluateReport('jamo', { ...good, truePeakDb: Number.NEGATIVE_INFINITY })).toEqual([]);
  });

  it.each([
    ['NaN', Number.NaN],
    ['-inf', Number.NEGATIVE_INFINITY],
  ])('fails a clip whose loudness is %s', (_name, integratedLufs) => {
    expect(evaluateReport('jamo', { ...good, integratedLufs })[0]).toMatch(/loudness/);
  });
});

describe('scripts/audio/lib: clipSets (what the set-total limit adds up)', () => {
  it('jamo: only the 30 script clips; Batch 2 names and stray files are not in the total', () => {
    const sets = clipSets('jamo', ['a', 'giyeok', 'giyeok-name', 'stray'], { jamoIds: ['a', 'giyeok', 'nieun'] });
    expect(sets).toEqual([{ label: 'the jamo clips of the recording script', fileIds: ['a', 'giyeok'] }]);
  });

  it('word: one set per vocabulary topic, sorted, with unknown files on their own', () => {
    const topicByFileId = new Map([
      ['sagwa', 'food'],
      ['bap', 'food'],
      ['gae', 'animals'],
    ]);
    expect(clipSets('word', ['sagwa', 'gae', 'bap', 'extra'], { topicByFileId })).toEqual([
      { label: 'topic (not in any topic)', fileIds: ['extra'] },
      { label: 'topic animals', fileIds: ['gae'] },
      { label: 'topic food', fileIds: ['bap', 'sagwa'] },
    ]);
  });
});

// --- Processing and checking helpers (process-recordings.mjs, check-audio.mjs) ---

describe('scripts/audio/lib: parseTakeFile', () => {
  it('reads the file id and the take (1 by default, or marked as <id>.<n>)', () => {
    expect(parseTakeFile('giyeok.m4a')).toEqual({ fileId: 'giyeok', take: 1 });
    expect(parseTakeFile('giyeok-batchim.wav')).toEqual({ fileId: 'giyeok-batchim', take: 1 });
    expect(parseTakeFile('giyeok.2.m4a')).toEqual({ fileId: 'giyeok', take: 2 });
    expect(parseTakeFile('GIYEOK.M4A')).toEqual({ fileId: 'giyeok', take: 1 });
  });

  it('ignores files that are not recordings', () => {
    expect(parseTakeFile('.DS_Store')).toBeNull();
    expect(parseTakeFile('release.pdf')).toBeNull();
    expect(parseTakeFile('notes.txt')).toBeNull();
  });

  it('refuses a file named by the letter or with spaces (AUD-08)', () => {
    expect(() => parseTakeFile('ㄱ.m4a')).toThrow(/file id/);
    expect(() => parseTakeFile('giyeok 2.m4a')).toThrow(/file id/);
    expect(() => parseTakeFile('giyeok.0.m4a')).toThrow(/take/);
  });
});

describe('scripts/audio/lib: takes from silencedetect', () => {
  const log = [
    '[Parsed_silencedetect_0 @ 0x1] silence_start: 0',
    '[Parsed_silencedetect_0 @ 0x1] silence_end: 0.41 | silence_duration: 0.41',
    '[Parsed_silencedetect_0 @ 0x1] silence_start: 1.02',
    '[Parsed_silencedetect_0 @ 0x1] silence_end: 3.1 | silence_duration: 2.08',
    '[Parsed_silencedetect_0 @ 0x1] silence_start: 3.75',
  ].join('\n');

  it('parseSilences reads the intervals, closing an open one at the end of the file', () => {
    expect(parseSilences(log, 4.2)).toEqual([
      { start: 0, end: 0.41 },
      { start: 1.02, end: 3.1 },
      { start: 3.75, end: 4.2 },
    ]);
    expect(parseSilences('', 1)).toEqual([]);
  });

  it('takeSegments returns the spoken parts between the silences', () => {
    expect(takeSegments(parseSilences(log, 4.2), 4.2)).toEqual([
      { start: 0.41, end: 1.02 },
      { start: 3.1, end: 3.75 },
    ]);
  });

  it('a file with no silence is one take', () => {
    expect(takeSegments([], 0.9)).toEqual([{ start: 0, end: 0.9 }]);
  });

  it('a short pause inside a word does not split it', () => {
    expect(takeSegments([{ start: 0.5, end: 0.7 }], 1.4)).toEqual([{ start: 0, end: 1.4 }]);
  });
});

describe('scripts/audio/lib: ffprobe and ebur128 reports', () => {
  it('parseProbe reads the stream and format', () => {
    const json = JSON.stringify({
      streams: [{ codec_name: 'mp3', channels: 1, sample_rate: '44100' }],
      format: { duration: '0.914286', size: '7314' },
    });
    expect(parseProbe(json)).toEqual({ codec: 'mp3', channels: 1, sampleRate: 44100, durationS: 0.914, bytes: 7314 });
  });

  it('parseProbe fails on a file with no audio stream', () => {
    expect(() => parseProbe(JSON.stringify({ streams: [], format: {} }))).toThrow(/no audio stream/);
  });

  it('parseEbur128 reads the summary block', () => {
    const summary = [
      '[Parsed_ebur128_0 @ 0x1] Summary:',
      '  Integrated loudness:',
      '    I:         -17.0 LUFS',
      '    Threshold: -27.1 LUFS',
      '  True peak:',
      '    Peak:       -1.5 dBFS',
    ].join('\n');
    expect(parseEbur128(summary)).toEqual({ integratedLufs: -17, truePeakDb: -1.5 });
    expect(() => parseEbur128('nothing')).toThrow(/loudness/);
  });

  it('parseEbur128 reads -inf (a silent clip) as negative infinity', () => {
    const silent = ['  Integrated loudness:', '    I:         -inf LUFS', '  True peak:', '    Peak:       -inf dBFS'].join('\n');
    expect(parseEbur128(silent)).toEqual({ integratedLufs: Number.NEGATIVE_INFINITY, truePeakDb: Number.NEGATIVE_INFINITY });
  });
});

describe('scripts/audio/lib: jamoClipRefs (every jamo clip the content declares, with its pack; AMENDMENTS-AUDIO-CLIPS section 5)', () => {
  const source = readFileSync(join(__dirname, '../../../content/jamo.ts'), 'utf8');
  const parsed = jamoClipRefs(source);

  it('agrees with the records the app ships: every audioRef and nameAudioRef, first pack wins', () => {
    const expected = new Map<string, string>();
    const add = (ref: string | undefined, pack: string) => {
      if (ref !== undefined && !expected.has(ref)) expected.set(ref, pack);
    };
    for (const j of jamoAll) {
      add(j.audioRef, 'jamo-s1');
      add(j.nameAudioRef, 'jamo-s1');
    }
    for (const j of jamoWordBuilder) {
      add(j.audioRef, 'jamo-wb');
      add(j.nameAudioRef, 'jamo-wb');
    }
    expect(parsed).toEqual([...expected].map(([ref, pack]) => ({ ref, pack })));
  });

  it('is 65 distinct files: jamo-s1 43 (30 sounds + 13 names), jamo-wb 22 (16 sounds + 1 shared t-final + 5 names)', () => {
    expect(parsed).toHaveLength(65);
    expect(new Set(parsed.map((r) => r.ref)).size).toBe(65);
    const s1 = parsed.filter((r) => r.pack === 'jamo-s1').map((r) => r.ref);
    const wb = parsed.filter((r) => r.pack === 'jamo-wb').map((r) => r.ref);
    expect(s1).toHaveLength(43);
    expect(s1.filter((r) => r.endsWith('-name.mp3'))).toHaveLength(13);
    expect(wb).toHaveLength(22);
    expect(wb.filter((r) => r.endsWith('-name.mp3'))).toHaveLength(5);
    expect(wb).toContain('audio/jamo/digeut-batchim.mp3');
    expect(s1).not.toContain('audio/jamo/ieung-name.mp3');
    for (const { ref } of parsed) expect(ref).toMatch(AUDIO_REF_PATTERN);
  });

  it('the shared finals reuse one clip: ㅋ ㄲ finals take the Stage 1 ㄱ final, ㅍ the ㅂ final', () => {
    expect(parsed.find((r) => r.ref === 'audio/jamo/giyeok-batchim.mp3')?.pack).toBe('jamo-s1');
    expect(parsed.find((r) => r.ref === 'audio/jamo/bieup-batchim.mp3')?.pack).toBe('jamo-s1');
    expect(parsed.some((r) => /(kieuk|ssanggiyeok|pieup|siot|jieut|chieut|tieut|ssangsiot)-batchim/.test(r.ref))).toBe(false);
  });

  it('fails loudly when a factory call cannot be read', () => {
    expect(() => jamoClipRefs('export const jamoAll = [];')).toThrow(/no jamo records/);
    expect(() => jamoClipRefs(`${source}\n  wbf('siot-batchim', 'ㅅ'),\n`)).toThrow(/clip of siot-batchim/);
    expect(() => jamoClipRefs(`${source}\n  wb('ae'),\n`)).toThrow(/spokenKo of ae/);
  });
});

describe('scripts/audio/lib: clipStatus (audio:status, the T-017 to-do list)', () => {
  it('lists the refs that have no file yet', () => {
    expect(clipStatus(['audio/jamo/a.mp3', 'audio/jamo/giyeok.mp3'], ['jamo/a.mp3'])).toEqual({
      total: 2,
      present: 1,
      missing: ['audio/jamo/giyeok.mp3'],
    });
  });

  it('counts each ref once', () => {
    expect(clipStatus(['audio/jamo/a.mp3', 'audio/jamo/a.mp3'], [])).toEqual({ total: 1, present: 0, missing: ['audio/jamo/a.mp3'] });
  });
});

describe('scripts/audio/lib: correctionGain (the loudness top-up after the single loudnorm pass)', () => {
  it('is 0 when the clip is already near the target', () => {
    expect(correctionGain(-16)).toBe(0);
    expect(correctionGain(-16.5)).toBe(0);
    expect(correctionGain(-15.5)).toBe(0);
  });

  it('is the distance to the target otherwise, rounded to 0.01 dB', () => {
    expect(correctionGain(-19.4)).toBe(3.4);
    expect(correctionGain(-14.2)).toBe(-1.8);
    expect(correctionGain(-20.333)).toBe(4.33);
  });

  it('never boosts silence', () => {
    expect(correctionGain(-70)).toBe(0);
    expect(correctionGain(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('scripts/audio/lib: the bounded top-up (nextTopUp, topUpOutcome)', () => {
  it('applies the correction while passes and the gain budget remain', () => {
    expect(nextTopUp(-19.4, { passes: 0, appliedDb: 0 })).toBe(3.4);
    expect(nextTopUp(-14.2, { passes: 1, appliedDb: 0 })).toBe(-1.8);
  });

  it('stops when settled, after the last pass, or at the total gain cap', () => {
    expect(nextTopUp(-16.2, { passes: 0, appliedDb: 0 })).toBe(0);
    expect(nextTopUp(-19.4, { passes: MAX_TOP_UP_PASSES, appliedDb: 0 })).toBe(0);
    expect(nextTopUp(-19.4, { passes: 1, appliedDb: MAX_TOP_UP_DB })).toBe(0);
    expect(nextTopUp(-19.4, { passes: 1, appliedDb: MAX_TOP_UP_DB - 1 })).toBe(1);
  });

  it('bounds the loop and the gain, and warns well before the budget is spent', () => {
    expect(MAX_TOP_UP_PASSES).toBeLessThanOrEqual(10);
    expect(MAX_TOP_UP_DB).toBeLessThanOrEqual(18);
    expect(LIMITING_WARN_DB).toBeLessThan(MAX_TOP_UP_DB);
    let state = { passes: 0, appliedDb: 0 };
    for (;;) {
      const gain = nextTopUp(-40, state);
      if (gain === 0) break;
      state = { passes: state.passes + 1, appliedDb: state.appliedDb + gain };
    }
    expect(state.appliedDb).toBe(MAX_TOP_UP_DB);
  });

  it('outcome: settled near the target, accepted inside the tolerance, rejected outside it', () => {
    expect(topUpOutcome(-16.3)).toBe('settled');
    expect(topUpOutcome(-17.2)).toBe('accepted');
    expect(topUpOutcome(-17.6)).toBe('rejected');
    expect(topUpOutcome(Number.NaN)).toBe('rejected');
  });
});

describe('scripts/audio/lib: planRecording (which delivered files become clips)', () => {
  const sets = { expected: new Set(['giyeok', 'a']), names: new Set(['giyeok-name']) };

  it('processes a file named in the script', () => {
    expect(planRecording('giyeok', sets, {})).toEqual({ action: 'process' });
  });

  it('holds back a Batch 2 name clip until --names (it needs nameAudioRef in jamo.ts first, A-10)', () => {
    expect(planRecording('giyeok-name', sets, {})).toMatchObject({ action: 'skip', reason: expect.stringMatching(/--names/) });
    expect(planRecording('giyeok-name', sets, { names: true })).toEqual({ action: 'process' });
  });

  it('skips a file the script does not name (a typo) unless --allow-extra', () => {
    expect(planRecording('giyok', sets, {})).toMatchObject({ action: 'skip', reason: expect.stringMatching(/not in the recording script/) });
    expect(planRecording('giyok', sets, { allowExtra: true })).toEqual({ action: 'process' });
  });
});

describe('scripts/audio/lib: isInsideDir (raw recordings never sit in the tracked tree)', () => {
  it('is true for the folder itself and anything below it', () => {
    expect(isInsideDir('/repo', '/repo')).toBe(true);
    expect(isInsideDir('/repo/apps/mobile/recordings', '/repo')).toBe(true);
  });

  it('is false outside it, including a sibling with the same prefix', () => {
    expect(isInsideDir('/Users/me/Recordings', '/repo')).toBe(false);
    expect(isInsideDir('/repo-other/x', '/repo')).toBe(false);
  });
});
