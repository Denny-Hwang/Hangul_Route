import { describe, expect, it } from 'vitest';
import {
  CHECK_LIMITS,
  CheckKindSchema,
  CheckOptionSchema,
  HANGUL,
  StoryCheckSchema,
} from '../index';

const detail = {
  id: 'c1',
  kind: 'detail',
  promptEn: 'When is Seollal?',
  options: [
    { id: 'a', en: 'The first day of the first lunar month', isCorrect: true },
    { id: 'b', en: 'The fifth day of the fifth lunar month', isCorrect: false },
  ],
  factIds: ['f1'],
};

const issuePaths = (value: unknown): string[] => {
  const result = StoryCheckSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('HANGUL and CHECK_LIMITS', () => {
  it('matches Hangul syllables and compatibility jamo only', () => {
    expect(HANGUL.test('설날')).toBe(true);
    expect(HANGUL.test('ㄱ')).toBe(true);
    expect(HANGUL.test('Seollal')).toBe(false);
  });

  it('carries the agreed caps (option 80, F-STORY-001 review 2)', () => {
    expect(CHECK_LIMITS).toEqual({
      prompt: 90,
      option: 80,
      explain: 140,
      hint: 80,
      options: { min: 2, max: 4 },
    });
  });
});

describe('CheckKindSchema', () => {
  it('lists the seven kinds and not "order"', () => {
    expect(CheckKindSchema.options).toEqual([
      'detail',
      'who',
      'pick-meaning',
      'pick-picture',
      'true-false',
      'fill-word',
      'feeling',
    ]);
    expect(CheckKindSchema.safeParse('order').success).toBe(false);
  });
});

describe('CheckOptionSchema', () => {
  it('accepts an English, a Korean and a picture option', () => {
    expect(CheckOptionSchema.safeParse({ id: 'a', en: 'Rice cake soup', isCorrect: true }).success).toBe(true);
    expect(
      CheckOptionSchema.safeParse({ id: 'b', ko: '떡국', romanization: 'tteokguk', en: 'rice cake soup', isCorrect: false })
        .success,
    ).toBe(true);
    expect(
      CheckOptionSchema.safeParse({ id: 'c', art: 'card:tteokguk', en: 'A bowl of soup', isCorrect: false }).success,
    ).toBe(true);
  });

  it('rejects an option with no en, ko or art', () => {
    expect(CheckOptionSchema.safeParse({ id: 'a', isCorrect: true }).success).toBe(false);
  });

  it('rejects a Korean option without a romanization or a gloss', () => {
    expect(CheckOptionSchema.safeParse({ id: 'a', ko: '떡국', en: 'soup', isCorrect: true }).success).toBe(false);
    expect(
      CheckOptionSchema.safeParse({ id: 'a', ko: '떡국', romanization: 'tteokguk', isCorrect: true }).success,
    ).toBe(false);
  });

  it('rejects a picture option without a label', () => {
    expect(CheckOptionSchema.safeParse({ id: 'a', art: 'card:tteokguk', isCorrect: true }).success).toBe(false);
  });

  it('keeps Hangul out of the English label', () => {
    const bad = CheckOptionSchema.safeParse({ id: 'a', en: 'It is 설날', isCorrect: true });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.path).toEqual(['en']);
  });

  it('enforces id grammar, the 80 character cap and the art ref grammar', () => {
    expect(CheckOptionSchema.safeParse({ id: 'A', en: 'x', isCorrect: true }).success).toBe(false);
    expect(CheckOptionSchema.safeParse({ id: 'a'.repeat(17), en: 'x', isCorrect: true }).success).toBe(false);
    expect(CheckOptionSchema.safeParse({ id: 'a', en: 'x'.repeat(80), isCorrect: true }).success).toBe(true);
    expect(CheckOptionSchema.safeParse({ id: 'a', en: 'x'.repeat(81), isCorrect: true }).success).toBe(false);
    expect(CheckOptionSchema.safeParse({ id: 'a', en: 'x', art: 'scene:gate', isCorrect: true }).success).toBe(true);
    expect(CheckOptionSchema.safeParse({ id: 'a', en: 'x', art: 'word:gate', isCorrect: true }).success).toBe(false);
  });
});

describe('StoryCheckSchema (F-STORY-003 §3.1)', () => {
  it('parses a research-shaped detail check without explainEn (a draft)', () => {
    expect(StoryCheckSchema.parse(detail)).toEqual(detail);
  });

  it('accepts explainEn, hintEn, target and shuffle', () => {
    const full = {
      ...detail,
      kind: 'pick-meaning',
      promptEn: 'What does {target} mean?',
      target: { ko: '설날', romanization: 'seollal', en: 'Lunar New Year' },
      explainEn: 'Seollal is the Lunar New Year.',
      hintEn: 'Think of the first morning of the year.',
      shuffle: false,
    };
    expect(StoryCheckSchema.parse(full)).toEqual(full);
  });

  it('applies the KoText syllable rule to the target', () => {
    expect(
      issuePaths({
        ...detail,
        kind: 'pick-meaning',
        promptEn: 'What does {target} mean?',
        target: { ko: '설날', romanization: 'seollal', en: 'x', syllables: ['seol', 'nal'] },
      }),
    ).toContain('target.syllables');
  });

  it('requires factIds (D14), 1 to 3 of them', () => {
    expect(StoryCheckSchema.safeParse({ ...detail, factIds: [] }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, factIds: ['f1', 'f2', 'f3', 'f4'] }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, factIds: ['f1', 'f2', 'f3'] }).success).toBe(true);
    const { factIds: _omitted, ...rest } = detail;
    expect(StoryCheckSchema.safeParse(rest).success).toBe(false);
  });

  it('allows 2 to 4 options', () => {
    const opt = (id: string, isCorrect: boolean) => ({ id, en: `Option ${id}`, isCorrect });
    expect(StoryCheckSchema.safeParse({ ...detail, options: [opt('a', true)] }).success).toBe(false);
    expect(
      StoryCheckSchema.safeParse({ ...detail, options: [opt('a', true), opt('b', false), opt('c', false), opt('d', false)] })
        .success,
    ).toBe(true);
    expect(
      StoryCheckSchema.safeParse({
        ...detail,
        options: [opt('a', true), opt('b', false), opt('c', false), opt('d', false), opt('e', false)],
      }).success,
    ).toBe(false);
  });

  it('enforces the prompt, explain and hint caps and the id grammar', () => {
    expect(StoryCheckSchema.safeParse({ ...detail, promptEn: 'x'.repeat(90) }).success).toBe(true);
    expect(StoryCheckSchema.safeParse({ ...detail, promptEn: 'x'.repeat(91) }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, explainEn: 'x'.repeat(141) }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, hintEn: 'x'.repeat(81) }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, id: 'C1' }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, id: 'c'.repeat(33) }).success).toBe(false);
  });

  it('requires exactly one correct option', () => {
    const none = detail.options.map((o) => ({ ...o, isCorrect: false }));
    const two = detail.options.map((o) => ({ ...o, isCorrect: true }));
    expect(StoryCheckSchema.safeParse({ ...detail, options: none }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, options: two }).success).toBe(false);
  });

  it('requires unique option ids', () => {
    const dup = [
      { id: 'a', en: 'One', isCorrect: true },
      { id: 'a', en: 'Two', isCorrect: false },
    ];
    expect(issuePaths({ ...detail, options: dup })).toContain('options');
  });

  it('allows at most one {target} token, and only with a target', () => {
    const target = { ko: '설날', romanization: 'seollal', en: 'Lunar New Year' };
    expect(StoryCheckSchema.safeParse({ ...detail, promptEn: 'What is {target}?', target }).success).toBe(true);
    expect(issuePaths({ ...detail, promptEn: 'What is {target}?' })).toContain('target');
    expect(
      issuePaths({ ...detail, promptEn: '{target} or {target}?', target }),
    ).toContain('promptEn');
  });

  it('requires a target for pick-meaning', () => {
    expect(issuePaths({ ...detail, kind: 'pick-meaning' })).toContain('target');
  });

  it('requires art on every option of a pick-picture check', () => {
    const pics = [
      { id: 'a', en: 'Soup', art: 'card:tteokguk', isCorrect: true },
      { id: 'b', en: 'Plain', isCorrect: false },
    ];
    expect(issuePaths({ ...detail, kind: 'pick-picture', options: pics })).toContain('options');
    const ok = pics.map((o) => ({ ...o, art: 'card:tteokguk' }));
    expect(StoryCheckSchema.safeParse({ ...detail, kind: 'pick-picture', options: ok }).success).toBe(true);
  });

  it('requires exactly two options for true-false, and never shuffles them', () => {
    const three = [
      { id: 'a', en: 'True', isCorrect: true },
      { id: 'b', en: 'False', isCorrect: false },
      { id: 'c', en: 'Maybe', isCorrect: false },
    ];
    expect(issuePaths({ ...detail, kind: 'true-false', options: three })).toContain('options');
    expect(StoryCheckSchema.safeParse({ ...detail, kind: 'true-false' }).success).toBe(true);
    expect(StoryCheckSchema.safeParse({ ...detail, kind: 'true-false', shuffle: false }).success).toBe(true);
    expect(issuePaths({ ...detail, kind: 'true-false', shuffle: true })).toContain('shuffle');
  });

  it.each(['promptEn', 'explainEn', 'hintEn'] as const)('keeps Hangul out of %s', (field) => {
    expect(issuePaths({ ...detail, [field]: 'About 설날' })).toContain(field);
  });
});

describe('StoryCheckSchema edge cases (F-STORY-003 PR 3.1)', () => {
  it('accepts an option label at 79 and 80 characters and rejects 81', () => {
    const withLabel = (n: number) => ({
      ...detail,
      options: [{ id: 'a', en: 'x'.repeat(n), isCorrect: true }, detail.options[1]],
    });
    expect(StoryCheckSchema.safeParse(withLabel(79)).success).toBe(true);
    expect(StoryCheckSchema.safeParse(withLabel(80)).success).toBe(true);
    expect(StoryCheckSchema.safeParse(withLabel(81)).success).toBe(false);
  });

  it('rejects the order kind and any unknown kind (ordering is the sequence game)', () => {
    expect(StoryCheckSchema.safeParse({ ...detail, kind: 'order' }).success).toBe(false);
    expect(StoryCheckSchema.safeParse({ ...detail, kind: 'essay' }).success).toBe(false);
  });

  it('rejects Hangul in the prompt and in an English option label', () => {
    expect(issuePaths({ ...detail, promptEn: 'What is 설날?' })).toContain('promptEn');
    expect(
      issuePaths({ ...detail, options: [{ id: 'a', en: '설날', isCorrect: true }, detail.options[1]] }).length,
    ).toBeGreaterThan(0);
  });

  it('accepts a check with explainEn absent and one with the 140 character cap', () => {
    expect(StoryCheckSchema.safeParse(detail).success).toBe(true);
    expect(StoryCheckSchema.safeParse({ ...detail, explainEn: 'x'.repeat(140) }).success).toBe(true);
  });

  it('rejects a Korean option that has no romanization or gloss', () => {
    const korean = { id: 'a', ko: '떡국', isCorrect: true };
    expect(StoryCheckSchema.safeParse({ ...detail, options: [korean, detail.options[1]] }).success).toBe(false);
  });
});
