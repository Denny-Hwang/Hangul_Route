// The clip manifest's rules (AMENDMENTS-AUDIO-CLIPS section 5, AC-B3, AC-B4, AC-B6; row AC-2): the 65 jamo rows,
// the AC-B3 normalization and its full-stop switch, overrides, the texts that are never generated, the first-pack
// rule, deduplication and a deterministic output. No network, no audio files.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDIO_PACKS, sayKey, sayRef } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll, jamoWordBuilder } from '../../src/content/jamo';
import { jamoVoice } from '../../src/logic/audio/jamo-voice';
import {
  cardOccurrencesOf,
  contentOccurrences,
  jamoClipVoicesOf,
  packOfContentFile,
  reviewOccurrencesOf,
  stage1OccurrencesOf,
} from '../audio/content-sources.mjs';
import { jamoClipRefs } from '../audio/lib.mjs';
import {
  CLIP_KINDS,
  KIND_RATES,
  NORMALIZATION,
  SKIP_REASONS,
  buildManifest,
  kindOfText,
  renderManifest,
  sayOf,
  skipReasonOf,
  summarizeManifest,
} from '../audio/tts/manifest-lib.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const jamoVoices = () => jamoClipVoicesOf(jamoAll, jamoWordBuilder, jamoVoice);
const occ = (ko, pack = 'stage2', extra = {}) => ({ pack, source: `content/episodes/${pack}/x.json`, ko, path: 'quests.0.steps.1', ...extra });
const build = (occurrences, opts = {}) => buildManifest({ jamo: [], occurrences, ...opts });
const rowOf = (rows, text) => rows.find((r) => r.text === text);

describe('jamo rows (section 5): exactly 65, 43 in jamo-s1 and 22 in jamo-wb', () => {
  const { rows } = buildManifest({ jamo: jamoVoices(), occurrences: [] });
  const byRef = new Map(rows.map((r) => [r.ref, r]));

  it('lists the 65 jamo clips AC-1 declares, each in the pack jamo.ts gives it', () => {
    expect(rows).toHaveLength(65);
    expect(rows.filter((r) => r.pack === 'jamo-s1')).toHaveLength(43);
    expect(rows.filter((r) => r.pack === 'jamo-wb')).toHaveLength(22);
    const declared = jamoClipRefs(readFileSync(join(APP_ROOT, 'src/content/jamo.ts'), 'utf8'));
    expect(rows.map((r) => [r.ref, r.pack])).toEqual(declared.map((d) => [d.ref, d.pack]));
  });

  it('Stage 1: 30 sound clips and 13 name clips (no name clip for ㅇ or a vowel)', () => {
    const s1 = rows.filter((r) => r.pack === 'jamo-s1');
    expect(s1.filter((r) => r.kind === 'jamo-sound')).toHaveLength(30);
    expect(s1.filter((r) => r.kind === 'jamo-name').map((r) => r.text)).toEqual([
      '기역', '니은', '디귿', '리을', '미음', '비읍', '시옷', '지읒', '치읓', '키읔', '티읕', '피읖', '히읗',
    ]);
    expect(byRef.has('audio/jamo/ieung-name.mp3')).toBe(false);
    expect(byRef.get('audio/jamo/ieung.mp3')).toMatchObject({ kind: 'jamo-sound', text: '이응', say: '이응' });
    expect(byRef.get('audio/jamo/a.mp3')).toMatchObject({ kind: 'jamo-sound', text: '아', say: '아.' });
    expect(rows.some((r) => /^audio\/jamo\/(a|eo|o|u|eu|i|ya|yeo|yo|yu)-name\.mp3$/.test(r.ref))).toBe(false);
  });

  it('Word Builder: 11 compound vowels, 5 tense sounds, 5 tense names and one shared t-final', () => {
    const wb = rows.filter((r) => r.pack === 'jamo-wb');
    expect(wb.filter((r) => r.kind === 'jamo-name').map((r) => r.text)).toEqual(['쌍기역', '쌍디귿', '쌍비읍', '쌍시옷', '쌍지읒']);
    expect(wb.filter((r) => r.kind === 'jamo-sound').map((r) => r.text).sort()).toEqual(
      ['애', '에', '얘', '예', '와', '워', '위', '의', '외', '왜', '웨', '까', '따', '빠', '싸', '짜', '앋'].sort(),
    );
  });

  it('the six t-finals share one clip generated from 앋, and every one of them is listed as its source', () => {
    const t = byRef.get('audio/jamo/digeut-batchim.mp3');
    expect(t).toMatchObject({ pack: 'jamo-wb', kind: 'jamo-sound', text: '앋', say: '앋.' });
    expect(t.sources).toEqual(
      ['siot', 'jieut', 'chieut', 'tieut', 'digeut', 'ssangsiot'].map((id) => `jamo:${id}-batchim#sound`).sort(),
    );
  });

  it('ㅋ/ㄲ finals reuse the ㄱ final and ㅍ the ㅂ final, with no extra rows', () => {
    for (const id of ['kieuk-batchim', 'ssanggiyeok-batchim', 'pieup-batchim']) expect(byRef.has(`audio/jamo/${id}.mp3`)).toBe(false);
    expect(byRef.get('audio/jamo/giyeok-batchim.mp3')).toMatchObject({ pack: 'jamo-s1', text: '악', say: '악.' });
    expect(byRef.get('audio/jamo/giyeok-batchim.mp3').sources).toEqual([
      'jamo:giyeok-batchim#sound', 'jamo:kieuk-batchim#sound', 'jamo:ssanggiyeok-batchim#sound',
    ]);
    expect(byRef.get('audio/jamo/bieup-batchim.mp3').sources).toEqual(['jamo:bieup-batchim#sound', 'jamo:pieup-batchim#sound']);
  });

  it('a jamo row is keyed by its file id, sends the official name for a letter, and is never a lone jamo', () => {
    expect(byRef.get('audio/jamo/kieuk-name.mp3')).toMatchObject({ key: 'kieuk-name', say: '키읔', rate: KIND_RATES['jamo-name'] });
    for (const r of rows) expect(r.say).not.toMatch(/[ㄱ-ㆎᄀ-ᇿ]/u);
  });

  it('records that share a clip but say different texts stop the build', () => {
    const voices = [
      { ref: 'audio/jamo/digeut-batchim.mp3', kind: 'jamo-sound', text: '앋', pack: 'jamo-wb', source: 'jamo:digeut-batchim#sound' },
      { ref: 'audio/jamo/digeut-batchim.mp3', kind: 'jamo-sound', text: '앗', pack: 'jamo-wb', source: 'jamo:siot-batchim#sound' },
    ];
    expect(() => buildManifest({ jamo: voices, occurrences: [] })).toThrow(/must say the same/);
  });

  it('a jamo voice that is a lone jamo stops the build', () => {
    const voices = [{ ref: 'audio/jamo/giyeok.mp3', kind: 'jamo-sound', text: 'ㄱ', pack: 'jamo-s1', source: 'jamo:giyeok#sound' }];
    expect(() => buildManifest({ jamo: voices, occurrences: [] })).toThrow(/never generated \(lone-jamo\)/);
  });
});

describe('AC-B3 normalization: the full-stop switch', () => {
  it('is on by default: isolated syllables, vowels and finals are sent with a full stop', () => {
    expect(NORMALIZATION.syllableFullStop).toBe(true);
    const { rows } = build([occ('가'), occ('달'), occ('나무'), occ('같이 놀자!')]);
    expect(rowOf(rows, '가').say).toBe('가.');
    expect(rowOf(rows, '달').say).toBe('달.');
    expect(rowOf(rows, '나무').say).toBe('나무');
    expect(rowOf(rows, '같이 놀자!').say).toBe('같이 놀자!');
  });

  it('turned off, every text is sent as the app speaks it (the AC-5 pilot decides 아 or 아.)', () => {
    const off = { syllableFullStop: false };
    const { rows } = buildManifest({ jamo: jamoVoices(), occurrences: [occ('가')], normalization: off });
    expect(rowOf(rows, '가').say).toBe('가');
    expect(rows.find((r) => r.ref === 'audio/jamo/a.mp3').say).toBe('아');
    expect(rows.find((r) => r.ref === 'audio/jamo/giyeok-batchim.mp3').say).toBe('악');
    expect(renderManifest(rows, off)).toContain('"normalization": {"syllableFullStop":false}');
  });

  it('never adds a full stop to a name, a word or a sentence', () => {
    expect(sayOf('jamo-name', '니은', undefined)).toBe('니은');
    expect(sayOf('jamo-sound', '이응', undefined)).toBe('이응');
    expect(sayOf('word', '오천 원', undefined)).toBe('오천 원');
    expect(sayOf('sentence', '네.', undefined)).toBe('네.');
  });
});

describe('pronunciation overrides change what is sent, never the text, the key or the ref', () => {
  it('applies an override to say (and ipa) only', () => {
    const overrides = { 국물: { say: '궁물', ipa: 'kuŋmul', reason: 'nasal assimilation', engine: 'polly', voice: 'Seoyeon' } };
    const { rows } = build([occ('국물')], { overrides });
    expect(rows).toEqual([
      { ref: sayRef('국물'), key: sayKey('국물'), kind: 'word', text: '국물', say: '궁물', ipa: 'kuŋmul', rate: 0.9, pack: 'stage2', sources: ['content/episodes/stage2/x.json'] },
    ]);
  });

  it('wins over the full stop, and applies to a jamo row by its spoken text', () => {
    const overrides = {
      달: { say: '달', reason: 'pilot', engine: 'google', voice: 'ko-KR-Neural2-A' },
      키읔: { say: '키윽', reason: 'name misread', engine: 'polly', voice: 'Seoyeon' },
    };
    const { rows } = buildManifest({ jamo: jamoVoices(), occurrences: [occ('달')], overrides });
    expect(rowOf(rows, '달').say).toBe('달');
    expect(rows.find((r) => r.ref === 'audio/jamo/kieuk-name.mp3')).toMatchObject({ text: '키읔', say: '키윽', key: 'kieuk-name' });
  });

  it('an override no clip uses stops the build (its key is the spoken text)', () => {
    const overrides = { 신라: { say: '실라', reason: 'liquidization', engine: 'polly', voice: 'Seoyeon' } };
    expect(() => build([occ('국물')], { overrides })).toThrow(/no clip says "신라"/);
  });
});

describe('never generated (AC-B3): the builder skips them with a reason', () => {
  const cases = [
    ['a lone compatibility jamo', occ('ㄱ'), 'lone-jamo'],
    ['a lone conjoining jamo', occ('ᄀ'), 'lone-jamo'],
    ['a cloze template', occ('___ 하고 싶어요.'), 'cloze'],
    ['a two-slot cloze', occ('___에 ___을/를 먹었어요.'), 'cloze'],
    ['an alternation fragment', occ('이에요/예요'), 'fragment'],
    ['a leading-ellipsis fragment', occ('…이에요'), 'fragment'],
    ['a dangling hyphen', occ('하-'), 'fragment'],
    ['a particle choice', occ('을', 'stage3', { path: 'quests.0.scopes.1.rounds.2.particle.choices.0' }), 'fragment'],
    ['a ko-locale gloss', occ('호랑이', 'stage2', { source: 'content/i18n/ko/stage2.json' }), 'ko-gloss'],
    ['Latin letters', occ('K-pop 노래'), 'latin-or-digit'],
    ['digits', occ('10월 9일'), 'latin-or-digit'],
    ['digits in an authored spokenKo', occ('2,000원', 'stage6', { spokenKo: '2천 원' }), 'latin-or-digit'],
    ['an empty text', occ('   '), 'empty'],
  ];

  for (const [what, o, reason] of cases) {
    it(`${what}: ${reason}`, () => {
      expect(skipReasonOf(o)).toBe(reason);
      const { rows, skipped } = build([o]);
      expect(rows).toEqual([]);
      expect(skipped).toEqual([{ reason, text: o.spokenKo?.trim() || o.ko.trim(), source: o.source, pack: o.pack }]);
    });
  }

  it('every reason has a message for the summary', () => {
    for (const [, , reason] of cases) expect(SKIP_REASONS[reason]).toMatch(/\w/);
  });

  it('a lone jamo or digits with an authored spokenKo are generated from it', () => {
    const { rows, skipped } = build([occ('ㄱ', 'stories', { spokenKo: '기역' }), occ('2,000원', 'stage6', { spokenKo: '이천 원' })]);
    expect(skipped).toEqual([]);
    expect(rows.map((r) => [r.text, r.say])).toEqual([['이천 원', '이천 원'], ['기역', '기역']]);
  });

  it('a particle outside a choice list, a casual ~ and a trailing ellipsis are kept', () => {
    expect(skipReasonOf(occ('가'))).toBeNull();
    expect(skipReasonOf(occ('좋아~'))).toBeNull();
    expect(skipReasonOf(occ('그런데…'))).toBeNull();
  });
});

describe('say rows: one per spoken text, in the first pack that uses it (AC-B4, AC-B6)', () => {
  it('a text in several packs belongs to the first in AUDIO_PACKS order', () => {
    const { rows } = build([occ('호랑이', 'cards'), occ('호랑이', 'stories'), occ('호랑이', 'placement'), occ('호랑이', 'stage2')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pack: 'placement', ref: sayRef('호랑이'), key: sayKey('호랑이') });
    expect(AUDIO_PACKS.slice(0, 4)).toEqual(['jamo-s1', 'jamo-wb', 'stage1', 'placement']);
  });

  it('dedupes by trimmed NFC text and merges the sources, sorted and once each', () => {
    const nfd = '나무'.normalize('NFD');
    const { rows } = build([occ(' 나무 ', 'stage2', { source: 'b.json' }), occ(nfd, 'stage2', { source: 'a.json' }), occ('나무', 'stage2', { source: 'a.json' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ text: '나무', key: sayKey('나무'), sources: ['a.json', 'b.json'] });
  });

  it('spokenKo is the text: two spellings that sound the same are one clip', () => {
    const { rows } = build([occ('같이', 'stage4', { spokenKo: '가치' }), occ('가치', 'stage6')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ text: '가치', pack: 'stage4' });
  });

  it('a vocabulary word owned by the vocab pack keeps its record clip path; one owned earlier uses the say clip', () => {
    const vocab = (ko, slug) => occ(ko, 'vocab', { source: 'content/vocab/animals.json', audioRef: `audio/vocab/${slug}.mp3` });
    const { rows } = build([vocab('고양이', 'goyangi'), vocab('호랑이', 'horangi'), occ('호랑이', 'stage1'), occ('고양이', 'stories')]);
    expect(rowOf(rows, '고양이')).toMatchObject({ ref: 'audio/vocab/goyangi.mp3', key: sayKey('고양이'), pack: 'vocab' });
    expect(rowOf(rows, '호랑이')).toMatchObject({ ref: sayRef('호랑이'), pack: 'stage1' });
  });

  it('two vocabulary records with one text and different clip paths stop the build', () => {
    const vocab = (slug) => occ('배', 'vocab', { source: 'content/vocab/food.json', audioRef: `audio/vocab/${slug}.mp3` });
    expect(() => build([vocab('bae-pear'), vocab('bae-boat')])).toThrow(/say the same text/);
  });

  it('an occurrence in an unknown pack stops the build', () => {
    expect(() => build([occ('나무', 'stage5')])).toThrow(/unknown clip pack "stage5"/);
  });
});

describe('kinds and rates (AC-B2)', () => {
  it('classifies by shape: one syllable, a sentence that ends in . ! ?, else a word or phrase', () => {
    expect(kindOfText('가')).toBe('syllable');
    expect(kindOfText('나무')).toBe('word');
    expect(kindOfText('오천 원')).toBe('word');
    expect(kindOfText('같이 놀자!')).toBe('sentence');
    expect(kindOfText('지금 몇 시예요?')).toBe('sentence');
    expect(kindOfText('네.')).toBe('sentence');
  });

  it('an unpunctuated story title or line of several words is a sentence for QA; a short phrase stays a word', () => {
    expect(kindOfText('판소리로 듣는 흥부와 놀부, 토끼와 자라')).toBe('sentence');
    expect(kindOfText('장영실과 스스로 울리는 물시계, 자격루')).toBe('sentence');
    expect(kindOfText('간을 육지에 두고 왔습니다')).toBe('sentence');
    expect(kindOfText('새 동아줄을 내려 주세요')).toBe('sentence');
    expect(kindOfText('흥부와 놀부')).toBe('word');
    expect(kindOfText('토끼의 간')).toBe('word');
    expect(kindOfText('안녕하세요')).toBe('word');
    expect(kindOfText('대한민국임시정부수립')).toBe('word');
  });

  it('rates: syllables and names 0.85, words and sentences 0.9, narration 1.0', () => {
    expect(KIND_RATES).toEqual({ 'jamo-sound': 0.85, 'jamo-name': 0.85, syllable: 0.85, word: 0.9, sentence: 0.9, narration: 1.0 });
    expect(Object.keys(KIND_RATES)).toEqual(CLIP_KINDS);
  });

  it('a narrator line is taught Korean: a sentence at 0.9, never narration', () => {
    const { rows } = build([occ('옛날 옛적에 호랑이가 살았어요.', 'stories', { kind: 'narration', speaker: 'narrator' })]);
    expect(rows[0]).toMatchObject({ kind: 'sentence', rate: 0.9 });
  });
});

describe('notices: clips the summary lists for a follow-up row', () => {
  it('a vocabulary clip that other packs speak too is listed with the say ref they look up (AC-6 maps it)', () => {
    const result = build([
      occ('그림자', 'vocab', { audioRef: 'audio/vocab/geurimja.mp3' }),
      occ('그림자', 'stories'),
      occ('그림자', 'review'),
      occ('나무', 'vocab', { audioRef: 'audio/vocab/namu.mp3' }),
    ]);
    expect(result.notices.vocabRefShared).toEqual([
      { text: '그림자', ref: 'audio/vocab/geurimja.mp3', sayRef: sayRef('그림자'), packs: ['review', 'stories'] },
    ]);
    const lines = summarizeManifest(result).join('\n');
    expect(lines).toContain('vocabulary clips also spoken outside vocab (AC-6 maps the say ref to the vocabulary file): 1');
    expect(lines).toContain(`"그림자" audio/vocab/geurimja.mp3 <- ${sayRef('그림자')} (review, stories)`);
  });

  it('a text that is both a jamo clip and a say clip is listed (generated twice on purpose)', () => {
    const result = buildManifest({ jamo: jamoVoices(), occurrences: [occ('가', 'stage1'), occ('나무', 'stage2')] });
    const giyeok = result.rows.find((r) => r.ref === 'audio/jamo/giyeok.mp3');
    expect(result.notices.jamoTextAlsoSay).toEqual([{ text: giyeok.text, jamoRef: giyeok.ref, ref: sayRef('가'), pack: 'stage1' }]);
    expect(summarizeManifest(result).join('\n')).toContain('texts that are both a jamo clip and a say clip (generated twice on purpose): 1: "가"');
  });
});

describe('deterministic output', () => {
  const sample = () => [
    occ('호랑이', 'stories'),
    occ('같이 놀자!', 'stage4'),
    occ('가', 'placement'),
    occ('나무', 'stage1'),
    occ('ㄴ', 'placement'),
    occ('나무', 'stage2'),
    occ('고양이', 'vocab', { audioRef: 'audio/vocab/goyangi.mp3' }),
  ];

  it('does not depend on the order the content is read in', () => {
    const a = buildManifest({ jamo: jamoVoices(), occurrences: sample() });
    const b = buildManifest({ jamo: jamoVoices(), occurrences: [...sample()].reverse() });
    expect(renderManifest(b.rows)).toBe(renderManifest(a.rows));
    expect(b.skipped).toEqual(a.skipped);
  });

  it('orders rows by pack, jamo in declaration order, then by text', () => {
    const { rows } = buildManifest({ jamo: jamoVoices(), occurrences: sample() });
    const packs = rows.map((r) => AUDIO_PACKS.indexOf(r.pack));
    expect([...packs].sort((x, y) => x - y)).toEqual(packs);
    expect(rows.slice(65).map((r) => r.text)).toEqual(['나무', '가', '같이 놀자!', '고양이', '호랑이']);
  });

  it('renders valid JSON, one row per line, with every field in a fixed order', () => {
    const { rows } = buildManifest({ jamo: jamoVoices(), occurrences: sample() });
    const text = renderManifest(rows);
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.rows).toEqual(rows);
    expect(Object.keys(parsed.rows[65])).toEqual(['ref', 'key', 'kind', 'text', 'say', 'rate', 'pack', 'sources']);
    expect(text.split('\n').filter((l) => l.startsWith('    {"ref":'))).toHaveLength(rows.length);
    expect(JSON.parse(renderManifest([])).rows).toEqual([]);
  });

  it('summarizes rows per kind and pack, characters sent and the skip list', () => {
    const lines = summarizeManifest(buildManifest({ jamo: jamoVoices(), occurrences: sample() }));
    expect(lines[0]).toMatch(/^tts manifest: 70 clips \(65 jamo, 5 text-keyed or vocabulary\), \d+ characters sent$/);
    expect(lines.join('\n')).toContain('jamo-s1 43, jamo-wb 22, stage1 1, placement 1');
    expect(lines.join('\n')).toMatch(/lone-jamo 1 \(1 texts\): "ㄴ"/);
  });
});

describe('content sources (content-sources.mjs)', () => {
  it('maps each shipped content file to its pack; Stage 1 files are read from TypeScript', () => {
    expect(packOfContentFile('content/episodes/stage-2/life.json')).toBe('stage2');
    expect(packOfContentFile('content/episodes/stage-7/rites.json')).toBe('stage7');
    expect(packOfContentFile('content/placement/sentences.json')).toBe('placement');
    expect(packOfContentFile('content/vocab/animals.json')).toBe('vocab');
    expect(packOfContentFile('content/stories/sun-and-moon.json')).toBe('stories');
    expect(packOfContentFile('content/episodes/stage-1/jamo.json')).toBeNull();
    expect(() => packOfContentFile('content/packs/x.json')).toThrow(/no clip pack/);
  });

  it('reads every KoText of a content file, with spokenKo, and gives a vocabulary word its clip path', () => {
    const files = [
      { file: 'content/vocab/animals.json', data: { topic: { titleKo: { ko: '동물', romanization: 'dongmul', en: 'Animals' } }, items: [{ id: 'vocab:goyangi', ko: '고양이', romanization: 'goyangi', en: 'cat' }] } },
      { file: 'content/stories/x.json', data: { keywords: [{ ko: 'ㄱ', spokenKo: '기역', romanization: 'g', en: 'g' }] } },
      { file: 'content/episodes/stage-1/jamo.json', data: [{ ko: 'ㄱ' }] },
    ];
    expect(contentOccurrences(files)).toEqual([
      { pack: 'vocab', source: 'content/vocab/animals.json', ko: '동물', path: 'topic.titleKo' },
      { pack: 'vocab', source: 'content/vocab/animals.json', ko: '고양이', path: 'items.0', audioRef: 'audio/vocab/goyangi.mp3' },
      { pack: 'stories', source: 'content/stories/x.json', ko: 'ㄱ', path: 'keywords.0', spokenKo: '기역' },
    ]);
  });

  it('reads the Stage 1 quests with the game scopes their steps name, and story-sequence labels', () => {
    const quests = [{ id: 'quest:q1', steps: [{ id: 's2', discover: { pages: [{ items: [{ example: { ko: '나', romanization: 'na', en: 'I' } }] }] } }, { id: 's3', minigameRef: 'minigame:a' }] }];
    const scopes = { 'minigame:a': { listenPick: { rounds: [{ prompt: { ko: '너' } }] }, storySteps: [{ labelKo: '한복 입기' }] }, 'minigame:unused': { cardPairs: [{ ko: '김밥' }] } };
    expect(stage1OccurrencesOf(quests, scopes).map((o) => [o.pack, o.source, o.ko])).toEqual([
      ['stage1', 'quest:q1', '나'],
      ['stage1', 'minigame:a', '너'],
      ['stage1', 'minigame:a', '한복 입기'],
    ]);
    expect(() => stage1OccurrencesOf([{ id: 'quest:q2', steps: [{ minigameRef: 'minigame:none' }] }], {})).toThrow(/no game scope/);
  });

  it('reads a heritage card by its Korean name, and a review item with its reply', () => {
    expect(cardOccurrencesOf([{ id: 'card:book', subtitleKo: '책' }, { id: 'card:x' }])).toEqual([{ pack: 'cards', source: 'card:book', ko: '책', path: 'subtitleKo' }]);
    expect(reviewOccurrencesOf([{ id: 'lex:a', ko: '안녕하세요', reply: { ko: '네, 안녕하세요.' } }]).map((o) => o.ko)).toEqual(['안녕하세요', '네, 안녕하세요.']);
  });
});
