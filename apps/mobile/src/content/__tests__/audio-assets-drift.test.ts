import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { AUDIO_REF_PATTERN } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  ASSET_MAP_FILE,
  ASSET_MAP_MODULE,
  AUDIO_DIR,
  PACK_CHUNK_DIR,
  TTS_MANIFEST_FILE,
  buildAssetMap,
  clipPacksOf,
  clipUnitsOf,
  jamoClipRefs,
  refsInRenderedMap,
  renderAudioModules,
} from '../../../scripts/audio/lib.mjs';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../__generated__/vocab';
import { episodesAll } from '../episodes';
import { heritageCardsAll } from '../heritage-cards';
import { jamoAll, jamoWordBuilder } from '../jamo';
import { questsAll } from '../quests';
import { storiesAll } from '../stories';

/**
 * The committed clip map and the clip folder agree (F-AUDIO-004 §3.10, §5).
 * The map is read as text: it is never imported by logic or tests.
 */

const APP_ROOT = join(__dirname, '../../..');

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out;
}

/** Every `audioRef` / `nameAudioRef` / `narrationAudioRef` value anywhere in shipped content. */
function contentAudioRefs(): Set<string> {
  const refs = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const v of value) visit(v);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value)) {
      if (/audioref$/i.test(key) && typeof v === 'string') refs.add(v);
      else visit(v);
    }
  };
  visit([jamoAll, jamoWordBuilder, heritageCardsAll, episodesAll, questsAll, storiesAll, VOCAB_TOPICS, VOCAB_ITEMS]);
  return refs;
}

const committed = readFileSync(join(APP_ROOT, ASSET_MAP_FILE), 'utf8');
const GENERATED_DIR = dirname(join(APP_ROOT, ASSET_MAP_FILE));
/** The committed per-pack map chunks (AMENDMENTS-AUDIO-CLIPS AC-B6, row AC-6), by path relative to the map's folder. */
const committedChunks = Object.fromEntries(
  listFiles(join(GENERATED_DIR, PACK_CHUNK_DIR)).map((f) => [`${PACK_CHUNK_DIR}/${f}`, readFileSync(join(GENERATED_DIR, PACK_CHUNK_DIR, f), 'utf8')]),
);
const files = listFiles(join(APP_ROOT, AUDIO_DIR));
const mapRefs = [committed, ...Object.values(committedChunks)].flatMap(refsInRenderedMap);
/** The pack of each jamo ref (AMENDMENTS-AUDIO-CLIPS AC-B6), as gen-audio-map.mjs reads it from jamo.ts. */
const jamoPacks = new Map(jamoClipRefs(readFileSync(join(APP_ROOT, 'src/content/jamo.ts'), 'utf8')).map((r) => [r.ref, r.pack]));
/** The pack of each clip the clip manifest lists (row AC-2), which gen-audio-map.mjs reads first. */
const manifest = JSON.parse(readFileSync(join(APP_ROOT, '../..', TTS_MANIFEST_FILE), 'utf8')) as { rows: { ref: string; pack: string; sources: string[] }[] };
const manifestPacks = clipPacksOf(manifest);
const packOf = (ref: string): string | undefined => manifestPacks.get(ref) ?? jamoPacks.get(ref);

describe('__generated__/audio-assets.ts', () => {
  it('is exactly what the generator writes for assets/audio, its pack chunks included (run `audio:map` after adding a clip)', () => {
    const expected = renderAudioModules(buildAssetMap(files, undefined, packOf), clipUnitsOf(manifest));
    expect(committed).toBe(expected[ASSET_MAP_MODULE]);
    const { [ASSET_MAP_MODULE]: _start, ...chunks } = expected;
    expect(committedChunks).toEqual(chunks);
  });

  it('holds no test fixture clips', () => {
    expect(committed).not.toContain('e2e/');
    for (const chunk of Object.values(committedChunks)) expect(chunk).not.toContain('e2e/');
  });

  it('the start map holds only jamo-s1 clips (and clips with no pack): every other pack is a chunk (AC-B6)', () => {
    for (const ref of refsInRenderedMap(committed)) {
      const pack = packOf(ref);
      expect(pack === undefined || pack === 'jamo-s1', `${ref} (${pack}) belongs in its pack's chunk`).toBe(true);
    }
  });

  it('every clip in the map is a valid ref that some content record points at', () => {
    const refs = contentAudioRefs();
    for (const ref of mapRefs) {
      expect(ref).toMatch(AUDIO_REF_PATTERN);
      // A text-keyed clip (AMENDMENTS-AUDIO-CLIPS AC-B4) is named by its text, not by a record; AC-2's manifest lists them.
      if (ref.startsWith('audio/say/')) continue;
      expect(refs.has(ref), `${ref} has a file but no content audioRef`).toBe(true);
    }
  });

  it('the clip manifest and jamo.ts give every jamo ref the same pack (AC-B6)', () => {
    for (const [ref, pack] of jamoPacks) expect(manifestPacks.get(ref), ref).toBe(pack);
  });

  it('every jamo ref carries its pack: jamoAll refs jamo-s1, the Word Builder ones jamo-wb (AC-B6)', () => {
    for (const j of jamoAll) {
      for (const ref of [j.audioRef, j.nameAudioRef]) if (ref !== undefined) expect(jamoPacks.get(ref), ref).toBe('jamo-s1');
    }
    for (const j of jamoWordBuilder) {
      for (const ref of [j.audioRef, j.nameAudioRef]) {
        if (ref === undefined) continue;
        const sharedWithStage1 = jamoAll.some((s1) => s1.audioRef === ref);
        expect(jamoPacks.get(ref), ref).toBe(sharedWithStage1 ? 'jamo-s1' : 'jamo-wb');
      }
    }
  });

  it('every content ref that has a file is in the map; refs without a file are listed, not failed', () => {
    const refs = [...contentAudioRefs()];
    const withFile = new Set(files.map((f) => `audio/${f}`));
    const inMap = new Set(mapRefs);
    for (const ref of refs.filter((r) => withFile.has(r))) expect(inMap.has(ref), `${ref} is missing from the map`).toBe(true);
    // The T-017 to-do list: a ref may exist before its recording does (AD4: no file means TTS).
    const missing = refs.filter((r) => !withFile.has(r));
    expect(missing.every((r) => !inMap.has(r))).toBe(true);
    // Listed, not failed (§5): a short summary here; A-8's `audio:status` prints the whole list.
    if (missing.length > 0) {
      const head = missing.slice(0, 10).join(', ');
      console.info(`audio: ${missing.length} content audioRefs have no clip yet (voice plays them): ${head}${missing.length > 10 ? ', ...' : ''}`);
    }
    // The 65 jamo refs (sounds and names, Stage 1 and Word Builder) are content refs whether or not their clip has arrived.
    for (const { ref } of jamoClipRefs(readFileSync(join(APP_ROOT, 'src/content/jamo.ts'), 'utf8'))) expect(refs).toContain(ref);
  });
});

describe('public/_headers', () => {
  it('serves recorded clips (hashed names under /assets/assets/audio/) as immutable for a year', () => {
    const headers = readFileSync(join(APP_ROOT, 'public/_headers'), 'utf8');
    expect(headers).toMatch(/^\/assets\/assets\/audio\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m);
  });
});
