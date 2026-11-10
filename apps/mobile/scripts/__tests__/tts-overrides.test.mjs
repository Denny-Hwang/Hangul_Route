// The schema of content/audio/pronunciation-overrides.json (AMENDMENTS-AUDIO-CLIPS AC-B3, section 9; row AC-2).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PronunciationOverrideSchema, PronunciationOverridesFileSchema, overrideForKind, parseOverrides } from '../audio/tts/overrides-schema.mjs';

const FILE = join(__dirname, '..', '..', '..', '..', 'content/audio/pronunciation-overrides.json');
const entry = { say: '궁물', reason: 'nasal assimilation (QA heard 국물 as 국-물)', engine: 'polly', voice: 'Seoyeon' };
const file = (overrides) => ({ schemaVersion: 1, overrides });

describe('content/audio/pronunciation-overrides.json', () => {
  it('the committed file is valid and holds only the second-take overrides of the real runs (Polly Seoyeon)', () => {
    const overrides = parseOverrides(JSON.parse(readFileSync(FILE, 'utf8')));
    // The 13 of the 2026-11-07 jamo runs, then the clips the owner heard as bad on 2026-11-10 (위 and ten say texts).
    const jamo = ['까', '디귿', '라', '리을', '바', '비읍', '악', '압', '어', '지읒', '짜', '키읔', '피읖'];
    const listen = ['위', '갑', '밥', '슨', '낮', '세 개에 천 원', '부', '책 여기 있어요.', '금줄', '샅바'];
    expect(Object.keys(overrides).sort()).toEqual([...jamo, ...listen].sort());
    for (const o of Object.values(overrides)) expect([o.engine, o.voice]).toEqual(['polly', 'Seoyeon']);
  });

  it('the rows the owner heard as good keep the exact say their clip was made from: Placement 라 (라!) and Stage 7 위 (위.)', () => {
    const overrides = parseOverrides(JSON.parse(readFileSync(FILE, 'utf8')));
    expect(overrideForKind(overrides['라'], 'syllable')).toEqual({ say: '라!' });
    expect(overrideForKind(overrides['위'], 'syllable')).toEqual({ say: '위.' });
    expect(overrideForKind(overrides['라'], 'jamo-sound').say).not.toBe('라!');
    expect(overrideForKind(overrides['위'], 'jamo-sound').say).not.toBe('위.');
  });

  it('the pairs that must sound different keep their own text and so their own clip: 악 / 압, 바 / 파 (and 가 / 카, 자 / 차)', () => {
    const overrides = parseOverrides(JSON.parse(readFileSync(FILE, 'utf8')));
    const say = (t) => overrides[t]?.say ?? `${t}.`;
    for (const [a, b] of [['악', '압'], ['바', '파'], ['가', '카'], ['자', '차'], ['까', '가'], ['짜', '자']]) expect(say(a)).not.toBe(say(b));
  });
});

describe('PronunciationOverridesFileSchema', () => {
  it('accepts a full entry: say, ipa, reason, engine, voice and accepted variants', () => {
    const full = { ...entry, ipa: 'kuŋmul', accept: ['궁물'] };
    expect(parseOverrides(file({ 국물: full }))).toEqual({ 국물: full });
    expect(parseOverrides(file({ 신라: { say: '실라', reason: 'liquidization', engine: 'google', voice: 'ko-KR-Neural2-C' } }))).toHaveProperty('신라');
  });

  it('kinds: per-kind say, ipa and accept; known kinds only, at least one, no other fields', () => {
    const scoped = { ...entry, kinds: { 'jamo-sound': { say: '궁.', ipa: 'kuŋ', accept: ['궁'] } } };
    expect(PronunciationOverrideSchema.safeParse(scoped).success).toBe(true);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, kinds: {} }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, kinds: { letter: { say: '궁.' } } }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, kinds: { word: { say: '궁2' } } }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, kinds: { word: { say: '궁', reason: 'x' } } }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, kinds: { word: {} } }).success).toBe(false);
  });

  it('overrideForKind: the kinds entry replaces say, ipa and accept for its kind; other kinds get the top level', () => {
    const o = { ...entry, ipa: 'kuŋmul', accept: ['궁물'], kinds: { syllable: { say: '궁.' } } };
    expect(overrideForKind(o, 'syllable')).toEqual({ say: '궁.' });
    expect(overrideForKind(o, 'word')).toEqual({ say: '궁물', ipa: 'kuŋmul', accept: ['궁물'] });
    expect(overrideForKind(undefined, 'word')).toBeUndefined();
  });

  it('requires say, reason, engine and voice', () => {
    for (const field of ['say', 'reason', 'engine', 'voice']) {
      const { [field]: _dropped, ...rest } = entry;
      expect(PronunciationOverrideSchema.safeParse(rest).success, field).toBe(false);
    }
  });

  it('refuses a say the engine cannot be sent: Latin letters, digits, a lone jamo, no Hangul, symbols', () => {
    for (const say of ['gungmul', '궁물2', 'ㄱ궁물', '...', '궁물 <break/>', ' 궁물']) {
      expect(PronunciationOverrideSchema.safeParse({ ...entry, say }).success, say).toBe(false);
    }
  });

  it('refuses unknown fields, an engine that is not an id, empty or repeated accepted variants', () => {
    expect(PronunciationOverrideSchema.safeParse({ ...entry, text: '궁물' }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, engine: 'Amazon Polly' }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, accept: [] }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, accept: ['궁물', '궁물'] }).success).toBe(false);
    expect(PronunciationOverrideSchema.safeParse({ ...entry, accept: ['gungmul'] }).success).toBe(false);
  });

  it('keys are the spoken text: trimmed NFC Hangul, never a lone jamo or Latin', () => {
    for (const key of [' 국물', '국물'.normalize('NFD'), 'ㄱ', 'gukmul', '']) {
      expect(PronunciationOverridesFileSchema.safeParse(file({ [key]: entry })).success, JSON.stringify(key)).toBe(false);
    }
  });

  it('refuses another schema version or extra top-level fields, and names the problem', () => {
    expect(() => parseOverrides({ schemaVersion: 2, overrides: {} })).toThrow(/pronunciation-overrides\.json: schemaVersion:/);
    expect(() => parseOverrides({ ...file({}), notes: 'x' })).toThrow(/\(root\): Unrecognized key/);
    expect(() => parseOverrides(file({ 국물: { ...entry, say: '궁물2' } }), 'x.json')).toThrow(/^x\.json: overrides\.국물\.say: say must not hold Latin letters or digits$/);
  });
});
