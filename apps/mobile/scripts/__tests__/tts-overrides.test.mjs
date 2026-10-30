// The schema of content/audio/pronunciation-overrides.json (AMENDMENTS-AUDIO-CLIPS AC-B3, section 9; row AC-2).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PronunciationOverrideSchema, PronunciationOverridesFileSchema, parseOverrides } from '../audio/tts/overrides-schema.mjs';

const FILE = join(__dirname, '..', '..', '..', '..', 'content/audio/pronunciation-overrides.json');
const entry = { say: '궁물', reason: 'nasal assimilation (QA heard 국물 as 국-물)', engine: 'polly', voice: 'Seoyeon' };
const file = (overrides) => ({ schemaVersion: 1, overrides });

describe('content/audio/pronunciation-overrides.json', () => {
  it('the committed file is valid and starts with no entries (none is applied by default)', () => {
    expect(parseOverrides(JSON.parse(readFileSync(FILE, 'utf8')))).toEqual({});
  });
});

describe('PronunciationOverridesFileSchema', () => {
  it('accepts a full entry: say, ipa, reason, engine, voice and accepted variants', () => {
    const full = { ...entry, ipa: 'kuŋmul', accept: ['궁물'] };
    expect(parseOverrides(file({ 국물: full }))).toEqual({ 국물: full });
    expect(parseOverrides(file({ 신라: { say: '실라', reason: 'liquidization', engine: 'google', voice: 'ko-KR-Neural2-C' } }))).toHaveProperty('신라');
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
