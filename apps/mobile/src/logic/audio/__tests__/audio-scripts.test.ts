import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIO_REF_PATTERN as SCHEMA_PATTERN, type Jamo } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll } from '../../../content/jamo';
import {
  AUDIO_PRECACHE_IGNORES,
  AUDIO_REF_PATTERN,
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
  vocabRecordingRows,
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
    expect(src).toContain('export const AUDIO_ASSETS: Readonly<Record<string, number | string>> = {};');
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
      cacheableResponse: { statuses: [200], headers: { 'content-type': 'audio/mpeg' } },
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

  it('lists only words with an audioRef, ordered by topic then id', () => {
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
      { fileId: 'sagwa', say: '사과', spokenKo: '', romanization: 'sagwa', gloss: 'apple', topic: 'food', note: '' },
    ]);
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

  it('is empty when no word has a clip planned', () => {
    expect(vocabRecordingRows([topic('food', [{ id: 'vocab:bap', ko: '밥', romanization: 'bap', en: 'rice', topics: ['food'] }])])).toEqual([]);
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
