import { describe, expect, it } from 'vitest';
import { JamoSchema, QuestSchema, QuestStepSchema, StorySequenceRoundSchema, a11yRomanization } from '../index';

/**
 * F-CNT-002 PR 2a: the additive schema fields. Nothing here is required yet
 * (the `.refine` rules arrive with the data in PR 2b), so every shipped shape
 * must keep parsing.
 */
const jamo = {
  id: 'jamo:ieung',
  char: 'ㅇ',
  romanization: 'silent/ng',
  kind: 'consonant' as const,
  nameEn: 'ieung',
  order: 8,
};

describe('JamoSchema romanization fields (F-CNT-002 §3.5)', () => {
  it('accepts the 12-character sound value silent/ng and rejects 13', () => {
    expect(JamoSchema.safeParse(jamo).success).toBe(true);
    expect(JamoSchema.safeParse({ ...jamo, romanization: 'a'.repeat(12) }).success).toBe(true);
    expect(JamoSchema.safeParse({ ...jamo, romanization: 'a'.repeat(13) }).success).toBe(false);
  });

  it('accepts an optional exampleWordRomanization', () => {
    const withWord = { ...jamo, exampleWordKo: '아이', exampleWordEn: 'child', exampleWordRomanization: 'ai' };
    expect(JamoSchema.parse(withWord).exampleWordRomanization).toBe('ai');
  });

  it('still parses an example word with no romanization (required only from PR 2b)', () => {
    expect(JamoSchema.safeParse({ ...jamo, exampleWordKo: '아이', exampleWordEn: 'child' }).success).toBe(true);
  });

  it('rejects an empty exampleWordRomanization', () => {
    expect(JamoSchema.safeParse({ ...jamo, exampleWordKo: '아이', exampleWordRomanization: '' }).success).toBe(false);
  });

  it('reads silent/ng aloud as "silent or ng"', () => {
    expect(a11yRomanization(jamo.romanization)).toBe('silent or ng');
  });
});

describe('QuestStepSchema.hoyaLineKo (F-CNT-002 §3.5)', () => {
  const base = { id: 's1', kind: 'intro' as const, titleEn: 'Hello' };
  const line = { ko: '새해 복 많이 받으세요.', romanization: 'saehae bok mani badeuseyo', en: 'Happy New Year!' };

  it('is optional', () => {
    expect(QuestStepSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a Korean line with romanization and gloss', () => {
    expect(QuestStepSchema.parse({ ...base, hoyaLineKo: line }).hoyaLineKo).toEqual(line);
  });

  it.each(['ko', 'romanization', 'en'] as const)('requires %s when hoyaLineKo is present', (key) => {
    const { [key]: _omitted, ...rest } = line;
    expect(QuestStepSchema.safeParse({ ...base, hoyaLineKo: rest }).success).toBe(false);
  });

  it.each(['ko', 'romanization', 'en'] as const)('rejects an empty %s', (key) => {
    expect(QuestStepSchema.safeParse({ ...base, hoyaLineKo: { ...line, [key]: '' } }).success).toBe(false);
  });

  it('is accepted inside a whole quest', () => {
    const quest = {
      id: 'quest:seollal-greeting',
      titleEn: 'Seollal',
      estimatedMinutes: 5,
      steps: [
        { ...base, hoyaLineKo: line },
        { id: 's2', kind: 'practice' as const, titleEn: 'Play', minigameKind: 'story-sequence' as const, minigameRef: 'm:1' },
        { id: 's3', kind: 'reward' as const, titleEn: 'Done' },
      ],
    };
    expect(QuestSchema.safeParse(quest).success).toBe(true);
  });
});

describe('StorySequenceRoundSchema steps romanization (F-CNT-002 §3.5)', () => {
  it('accepts an optional romanization next to labelKo', () => {
    const round = StorySequenceRoundSchema.parse({
      steps: [
        { id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기', romanization: 'son ssitgi' },
        { id: 'b', labelEn: 'Set the table', labelKo: '상 차리기' },
      ],
    });
    expect(round.steps[0]?.romanization).toBe('son ssitgi');
    expect(round.steps[1]?.romanization).toBeUndefined();
  });

  it('rejects an empty romanization', () => {
    expect(
      StorySequenceRoundSchema.safeParse({ steps: [{ id: 'a', labelEn: 'x', labelKo: '손', romanization: '' }] }).success,
    ).toBe(false);
  });
});
