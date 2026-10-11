import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_FORMATS,
  AssessmentOptionSchema,
  AssessmentQuestionSchema,
  AssessmentQuestionShape,
  AssessmentResponseSchema,
  OutcomeSchema,
} from '../assessment/question';
import { makeQuestion } from './helpers/assessment-fixtures';

describe('ASSESSMENT_FORMATS', () => {
  it('lists the seven formats of the shared engine', () => {
    expect([...ASSESSMENT_FORMATS]).toEqual([
      'shape-odd-one-out',
      'hear-pick-written',
      'see-pick-sound',
      'build-syllable',
      'hear-pick-picture',
      'read-pick-picture',
      'reply-pick',
    ]);
  });
});

describe('OutcomeSchema', () => {
  it('accepts correct, wrong and skipped, and nothing else (no timeout outcome)', () => {
    for (const o of ['correct', 'wrong', 'skipped']) expect(OutcomeSchema.safeParse(o).success).toBe(true);
    expect(OutcomeSchema.safeParse('timeout').success).toBe(false);
  });
});

describe('AssessmentOptionSchema', () => {
  it('accepts Korean, a picture or a sound chip as content', () => {
    expect(AssessmentOptionSchema.safeParse({ id: 'o-1', ko: '가', isCorrect: true }).success).toBe(true);
    expect(AssessmentOptionSchema.safeParse({ id: 'o-2', pictureRef: 'card:tiger', isCorrect: false }).success).toBe(true);
    expect(AssessmentOptionSchema.safeParse({ id: 'o-3', sound: 'ga', isCorrect: false }).success).toBe(true);
  });

  it('rejects an option with no content', () => {
    const r = AssessmentOptionSchema.safeParse({ id: 'o-1', en: 'only a gloss', isCorrect: true });
    expect(r.success).toBe(false);
  });

  it('keeps the optional romanization and gloss', () => {
    const o = AssessmentOptionSchema.parse({ id: 'o-1', ko: '가', romanization: 'ga', en: 'ga', isCorrect: false });
    expect(o.romanization).toBe('ga');
    expect(o.en).toBe('ga');
  });

  it('checks the id, picture ref and sound chip shapes', () => {
    expect(AssessmentOptionSchema.safeParse({ id: 'Bad Id', ko: '가', isCorrect: true }).success).toBe(false);
    expect(AssessmentOptionSchema.safeParse({ id: 'o', pictureRef: 'photo:x', isCorrect: true }).success).toBe(false);
    expect(AssessmentOptionSchema.safeParse({ id: 'o', sound: 'Ga', isCorrect: true }).success).toBe(false);
    expect(AssessmentOptionSchema.safeParse({ id: 'o', sound: 'abcdefghi', isCorrect: true }).success).toBe(false);
  });
});

describe('AssessmentQuestionSchema', () => {
  it('accepts a well-formed question', () => {
    expect(AssessmentQuestionSchema.safeParse(makeQuestion('q1')).success).toBe(true);
  });

  it('requires exactly one correct option', () => {
    const none = makeQuestion('q1');
    none.options = none.options.map((o) => ({ ...o, isCorrect: false }));
    expect(AssessmentQuestionSchema.safeParse(none).success).toBe(false);
    const two = makeQuestion('q1');
    two.options = two.options.map((o) => ({ ...o, isCorrect: true }));
    expect(AssessmentQuestionSchema.safeParse(two).success).toBe(false);
  });

  it('requires unique option ids', () => {
    const q = makeQuestion('q1');
    const [first, second, third] = q.options;
    q.options = [first!, { ...second!, id: first!.id }, third!];
    const r = AssessmentQuestionSchema.safeParse(q);
    expect(r.success).toBe(false);
  });

  it('rejects two options with the same Korean text', () => {
    const q = makeQuestion('q1');
    const [first, second, third] = q.options;
    q.options = [first!, { ...second!, ko: first!.ko }, third!];
    expect(AssessmentQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('lets the tiles of a shape-odd-one-out question repeat one letter (three show it, one differs)', () => {
    const tile = (id: string, ko: string, isCorrect: boolean) => ({ id, ko, isCorrect });
    const odd = {
      ...makeQuestion('q1'),
      format: 'shape-odd-one-out' as const,
      options: [tile('t1', 'ㅂ', false), tile('t2', 'ㅂ', false), tile('t3', 'ㅁ', true), tile('t4', 'ㅂ', false)],
    };
    expect(AssessmentQuestionSchema.safeParse(odd).success).toBe(true);
    // ids stay unique and exactly one tile is correct
    const sameId = { ...odd, options: odd.options.map((o) => ({ ...o, id: 't1' })) };
    expect(AssessmentQuestionSchema.safeParse(sameId).success).toBe(false);
    // every other format still rejects a repeated letter
    expect(AssessmentQuestionSchema.safeParse({ ...odd, format: 'hear-pick-written' }).success).toBe(false);
  });

  it('exposes the unrefined shape so a template can omit the id and re-apply the rules', () => {
    const { id: _id, ...rest } = makeQuestion('q1');
    expect(AssessmentQuestionShape.omit({ id: true }).safeParse(rest).success).toBe(true);
  });

  it('rejects two options with the same picture', () => {
    const q = makeQuestion('q1');
    q.options = [
      { id: 'a', pictureRef: 'card:tiger', isCorrect: true },
      { id: 'b', pictureRef: 'card:tiger', isCorrect: false },
    ];
    expect(AssessmentQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('allows options without Korean or pictures to differ by sound alone', () => {
    const q = makeQuestion('q1');
    q.options = [
      { id: 'a', sound: 'ga', isCorrect: true },
      { id: 'b', sound: 'na', isCorrect: false },
    ];
    expect(AssessmentQuestionSchema.safeParse(q).success).toBe(true);
  });

  it('needs two to four options', () => {
    const one = makeQuestion('q1');
    one.options = one.options.slice(0, 1);
    expect(AssessmentQuestionSchema.safeParse(one).success).toBe(false);
    const five = makeQuestion('q1');
    five.options = ['a', 'b', 'c', 'd', 'e'].map((k, i) => ({ id: k, ko: `가${i}`, isCorrect: i === 0 }));
    expect(AssessmentQuestionSchema.safeParse(five).success).toBe(false);
  });

  it('limits tags to eight and rejects an unknown format', () => {
    const tags = makeQuestion('q1');
    tags.tags = Array.from({ length: 9 }, (_, i) => `t${i}`);
    expect(AssessmentQuestionSchema.safeParse(tags).success).toBe(false);
    expect(AssessmentQuestionSchema.safeParse({ ...makeQuestion('q1'), format: 'essay' }).success).toBe(false);
  });

  it('keeps the optional prompt, voice and requires fields', () => {
    const q = AssessmentQuestionSchema.parse({
      ...makeQuestion('q1'),
      promptKo: '가',
      promptRomanization: 'ga',
      audioRef: 'audio/ga.mp3',
      requires: { audio: false, picture: 'card' },
      leaks: true,
    });
    expect(q.requires.picture).toBe('card');
    expect(q.leaks).toBe(true);
    expect(AssessmentQuestionSchema.safeParse({ ...makeQuestion('q1'), requires: { audio: true, picture: 'photo' } }).success).toBe(false);
  });
});

describe('AssessmentResponseSchema', () => {
  const base = { questionId: 'q1', outcome: 'correct', chosenOptionId: 'q1-a', ms: 1200 };

  it('defaults assisted to false', () => {
    expect(AssessmentResponseSchema.parse(base).assisted).toBe(false);
  });

  it('accepts a null chosen option (skipped)', () => {
    expect(AssessmentResponseSchema.safeParse({ ...base, outcome: 'skipped', chosenOptionId: null }).success).toBe(true);
  });

  it('bounds ms to a non-negative integer of at most 600000', () => {
    expect(AssessmentResponseSchema.safeParse({ ...base, ms: -1 }).success).toBe(false);
    expect(AssessmentResponseSchema.safeParse({ ...base, ms: 1.5 }).success).toBe(false);
    expect(AssessmentResponseSchema.safeParse({ ...base, ms: 600_000 }).success).toBe(true);
    expect(AssessmentResponseSchema.safeParse({ ...base, ms: 600_001 }).success).toBe(false);
  });

  it('rejects a timeout outcome', () => {
    expect(AssessmentResponseSchema.safeParse({ ...base, outcome: 'timeout' }).success).toBe(false);
  });
});
