import { AUDIO_REF_PATTERN as SCHEMA_PATTERN } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_PRECACHE_IGNORES,
  AUDIO_REF_PATTERN,
  RUNTIME_AUDIO_GROUPS,
  audioRuntimeCaching,
  buildAssetMap,
  isRuntimeAudio,
  mergeAssetMaps,
  precacheGaps,
  precacheLeaks,
  refFromFile,
  refsInRenderedMap,
  renderAssetMap,
} from '../../../../scripts/audio/lib.mjs';

/** The pure cores of apps/mobile/scripts/audio (F-AUDIO-004 §3.10, §5 audio-scripts.test.ts). */

describe('scripts/audio/lib: the ref grammar', () => {
  it('is the same pattern as the content schema', () => {
    expect(AUDIO_REF_PATTERN.source).toBe(SCHEMA_PATTERN.source);
    expect(AUDIO_REF_PATTERN.flags).toBe(SCHEMA_PATTERN.flags);
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
    expect(src).toContain('export const AUDIO_ASSETS: Readonly<Record<string, number>> = {};');
    expect(src).not.toContain('require(');
    expect(src.endsWith('\n')).toBe(true);
    expect(refsInRenderedMap(src)).toEqual([]);
  });

  it('renders one literal require per clip and reads the refs back', () => {
    const src = renderAssetMap(buildAssetMap(['jamo/giyeok.mp3', 'jamo/a.mp3']));
    expect(src).toContain("  'audio/jamo/a.mp3': require('../../../assets/audio/jamo/a.mp3'),");
    expect(src).toContain("  'audio/jamo/giyeok.mp3': require('../../../assets/audio/jamo/giyeok.mp3'),");
    expect(src).toMatch(/^\/\/ GENERATED/);
    expect(refsInRenderedMap(src)).toEqual(['audio/jamo/a.mp3', 'audio/jamo/giyeok.mp3']);
  });
});

describe('scripts/audio/lib: the PWA precache rules (AD10)', () => {
  it('runtime groups are vocabulary, story, card and dialogue; jamo is precached', () => {
    expect([...RUNTIME_AUDIO_GROUPS]).toEqual(['vocab', 'story', 'card', 'dialogue']);
    expect(isRuntimeAudio('assets/assets/audio/vocab/ice-cream.abc.mp3')).toBe(true);
    expect(isRuntimeAudio('/assets/assets/audio/story/heungbu/line-1.abc.mp3')).toBe(true);
    expect(isRuntimeAudio('audio/card/hanbok.mp3')).toBe(true);
    expect(isRuntimeAudio('assets/assets/audio/dialogue/hello.mp3')).toBe(true);
    expect(isRuntimeAudio('assets/assets/audio/jamo/giyeok.abc.mp3')).toBe(false);
    expect(isRuntimeAudio('assets/assets/audio/vocab/notes.txt')).toBe(false);
    expect(isRuntimeAudio('assets/myaudio/vocab/x.mp3')).toBe(false);
  });

  it('the Workbox ignore glob names the same groups', () => {
    expect([...AUDIO_PRECACHE_IGNORES]).toEqual(['**/audio/{vocab,story,card,dialogue}/**']);
  });

  it('the runtime rule is cache-first, bounded, and matches only those groups', () => {
    const rule = audioRuntimeCaching();
    expect(rule.handler).toBe('CacheFirst');
    expect(rule.options).toEqual({
      cacheName: 'hr-audio-v1',
      expiration: { maxEntries: 400 },
      cacheableResponse: { statuses: [0, 200] },
    });
    expect(rule.urlPattern.test('https://app.hangulroute.com/assets/assets/audio/vocab/ice-cream.1a2b.mp3')).toBe(true);
    expect(rule.urlPattern.test('https://app.hangulroute.com/assets/assets/audio/story/heungbu/line-1.mp3')).toBe(true);
    expect(rule.urlPattern.test('https://app.hangulroute.com/assets/assets/audio/jamo/giyeok.1a2b.mp3')).toBe(false);
    expect(rule.urlPattern.test('https://app.hangulroute.com/assets/assets/audio/vocab/ice-cream.png')).toBe(false);
  });

  it('precacheGaps lists precache-group clips missing from the manifest, ignoring runtime groups', () => {
    const dist = [
      'assets/assets/audio/jamo/giyeok.aa.mp3',
      'assets/assets/audio/jamo/nieun.bb.mp3',
      'assets/__node_modules/.pnpm/x/audio/jamo/hidden.cc.mp3',
      'assets/assets/audio/vocab/ice-cream.dd.mp3',
    ];
    const manifest = ['assets/assets/audio/jamo/giyeok.aa.mp3', '/assets/assets/audio/jamo/nieun.bb.mp3?__WB_REVISION__=1'];
    expect(precacheGaps(dist, manifest)).toEqual(['assets/__node_modules/.pnpm/x/audio/jamo/hidden.cc.mp3']);
    expect(precacheGaps([], manifest)).toEqual([]);
  });

  it('precacheLeaks lists runtime-group clips that reached the manifest', () => {
    expect(precacheLeaks(['index.html', 'assets/assets/audio/vocab/a.mp3', 'assets/assets/audio/jamo/a.mp3'])).toEqual([
      'assets/assets/audio/vocab/a.mp3',
    ]);
  });
});
