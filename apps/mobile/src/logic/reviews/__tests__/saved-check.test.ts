import { describe, expect, it } from 'vitest';
import { SAVED_RUN_MAX_AGE_MS } from '../../quest-flow/saved-run';
import { buildHangulCheck } from '../../stage1/hangul-check';
import {
  answeredLike,
  isFreshCheckRun,
  isReviewAnswer,
  nextAfterLastAnswered,
  resumableHangulCheck,
  resumePointOf,
  savedHangulCheck,
  type SavedHangulCheck,
} from '../saved-check';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (test 17): what is stored after each first answer (OD-LR9 (b)), when a
 * stored value may be resumed, and where the check goes on.
 */
const build = (seed: number) => buildHangulCheck({ seed });
const SEED = 7;
const check = build(SEED);
const ids = check.items.map((i) => i.id);
const START = '2026-11-24T10:00:00.000Z';
const NOW = Date.parse(START) + 60 * 60 * 1000;

/** The first `count` items answered, the first right and the others alternately. */
const answered = (count: number): Record<string, { first: boolean; retries: number }> =>
  Object.fromEntries(ids.slice(0, count).map((id, i) => [id, { first: i % 2 === 0, retries: i % 2 === 0 ? 0 : 1 }]));

const stored = (overrides: Partial<SavedHangulCheck> = {}): SavedHangulCheck => ({
  ...savedHangulCheck({ seed: SEED, items: ids, answers: answered(9), hideRomanization: true, startedAt: START }),
  ...overrides,
});

describe('savedHangulCheck: the value stored after an answer', () => {
  it('holds the seed, the item ids, the answers given, the romanization choice and the start time', () => {
    expect(stored()).toEqual({ v: 1, kind: 'hangul', seed: SEED, items: ids, answers: answered(9), hideRomanization: true, startedAt: START });
  });

  it('grows with each first answer and keeps only items of the check, in a copy', () => {
    for (let n = 1; n <= ids.length; n += 1) {
      expect(Object.keys(savedHangulCheck({ seed: SEED, items: ids, answers: answered(n), hideRomanization: false, startedAt: START }).answers)).toEqual(ids.slice(0, n));
    }
    const given: Record<string, { first: boolean; retries: number }> = { ...answered(2), 'jamo:other': { first: true, retries: 0 } };
    const value = savedHangulCheck({ seed: SEED, items: ids, answers: given, hideRomanization: false, startedAt: START });
    expect(Object.keys(value.answers)).toEqual(ids.slice(0, 2));
    given[ids[0]!] = { first: false, retries: 9 };
    expect(value.answers[ids[0]!]).toEqual({ first: true, retries: 0 });
    expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  });
});

describe('the common rules (the Stage Check reuses them, row LR-3b)', () => {
  it('a check run is fresh within 24 hours either way, and not past it', () => {
    const t = Date.parse(START);
    expect(isFreshCheckRun(START, t)).toBe(true);
    expect(isFreshCheckRun(START, t + SAVED_RUN_MAX_AGE_MS)).toBe(true);
    expect(isFreshCheckRun(START, t + SAVED_RUN_MAX_AGE_MS + 1)).toBe(false);
    // A clock set back reads as a run from the future: within a day it is the same run.
    expect(isFreshCheckRun(START, t - SAVED_RUN_MAX_AGE_MS)).toBe(true);
    expect(isFreshCheckRun(START, t - SAVED_RUN_MAX_AGE_MS - 1)).toBe(false);
    expect(isFreshCheckRun('not a date', t)).toBe(false);
    expect(isFreshCheckRun(undefined, t)).toBe(false);
    expect(isFreshCheckRun(t, t)).toBe(false);
  });

  it('an answer is { first: boolean, retries: integer >= 0 }', () => {
    expect(isReviewAnswer({ first: true, retries: 0 })).toBe(true);
    expect(isReviewAnswer({ first: false, retries: 3 })).toBe(true);
    for (const bad of [null, undefined, 3, 'x', [], {}, { first: 1, retries: 0 }, { first: true }, { first: true, retries: -1 }, { first: true, retries: 1.5 }, { first: true, retries: '1' }]) {
      expect(isReviewAnswer(bad)).toBe(false);
    }
  });

  it('the resume point is the item after the last one answered; an item that could not play is passed over', () => {
    expect(nextAfterLastAnswered([])).toBe(0);
    expect(nextAfterLastAnswered([false, false])).toBe(0);
    expect(nextAfterLastAnswered([true, true, false, false])).toBe(2);
    expect(nextAfterLastAnswered([true, false, true, false])).toBe(3);
    expect(nextAfterLastAnswered([true, true])).toBe(2);
    expect(answeredLike(['a', 'b', 'toString'], { a: 1 })).toEqual([true, false, false]);
  });

  it('a resume point is a chunk and an offset in it; past the last item there is none', () => {
    const chunks = [[1, 2, 3], [4, 5], [6]];
    expect(resumePointOf(chunks, 0)).toEqual({ chunk: 0, from: 0 });
    expect(resumePointOf(chunks, 2)).toEqual({ chunk: 0, from: 2 });
    expect(resumePointOf(chunks, 3)).toEqual({ chunk: 1, from: 0 });
    expect(resumePointOf(chunks, 4)).toEqual({ chunk: 1, from: 1 });
    expect(resumePointOf(chunks, 5)).toEqual({ chunk: 2, from: 0 });
    expect(resumePointOf(chunks, 6)).toBeNull();
    expect(resumePointOf([], 0)).toBeNull();
  });
});

describe('resumableHangulCheck', () => {
  it('restores a stored check and goes on at the item after the last one answered (nine answered: part 2, two items in)', () => {
    const out = resumableHangulCheck(stored(), NOW, build);
    expect(out).not.toBeNull();
    expect(out).toMatchObject({ seed: SEED, hideRomanization: true, startedAt: START, answers: answered(9), at: { chunk: 1, from: 2 } });
    expect(out?.check.items.map((i) => i.id)).toEqual(ids);
  });

  it('every item of a part answered: the next part opens at its first item', () => {
    expect(resumableHangulCheck(stored({ answers: answered(7) }), NOW, build)?.at).toEqual({ chunk: 1, from: 0 });
    expect(resumableHangulCheck(stored({ answers: answered(1) }), NOW, build)?.at).toEqual({ chunk: 0, from: 1 });
  });

  it('every item answered: no resume point, straight to the finish', () => {
    expect(resumableHangulCheck(stored({ answers: answered(ids.length) }), NOW, build)?.at).toBeNull();
  });

  it('is null for a value that is not a stored Hangul Check', () => {
    for (const bad of [null, undefined, 'x', 7, [], {}, { ...stored(), v: 2 }, { ...stored(), kind: 'stage' }, { ...stored(), kind: undefined }]) {
      expect(resumableHangulCheck(bad, NOW, build)).toBeNull();
    }
  });

  it('is null at 24 hours and a millisecond, either way on the clock', () => {
    const t = Date.parse(START);
    expect(resumableHangulCheck(stored(), t + SAVED_RUN_MAX_AGE_MS, build)).not.toBeNull();
    expect(resumableHangulCheck(stored(), t + SAVED_RUN_MAX_AGE_MS + 1, build)).toBeNull();
    expect(resumableHangulCheck(stored(), t - SAVED_RUN_MAX_AGE_MS, build)).not.toBeNull();
    expect(resumableHangulCheck(stored(), t - SAVED_RUN_MAX_AGE_MS - 1, build)).toBeNull();
    expect(resumableHangulCheck(stored({ startedAt: 'yesterday' }), NOW, build)).toBeNull();
  });

  it('is null when the items of the check changed (a letter or word added, removed, moved, or another seed)', () => {
    expect(resumableHangulCheck(stored({ items: ids.slice(1) }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ items: [...ids, 'jamo:new'] }), NOW, build)).toBeNull();
    const swapped = [...ids];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    expect(resumableHangulCheck(stored({ items: swapped }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ seed: SEED + 1 }), NOW, build)).toBeNull();
    // A builder that throws (content that cannot build) is not a resume either.
    expect(
      resumableHangulCheck(stored(), NOW, () => {
        throw new Error('content');
      }),
    ).toBeNull();
  });

  it('is null for answers of items that are not in the check, a bad answer shape or no answer at all', () => {
    expect(resumableHangulCheck(stored({ answers: { ...answered(3), 'jamo:other': { first: true, retries: 0 } } }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ answers: { [ids[0]!]: { first: 'yes', retries: 0 } as never } }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ answers: { [ids[0]!]: { first: true, retries: -1 } } }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ answers: {} }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ answers: [] as never }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ answers: null as never }), NOW, build)).toBeNull();
  });

  it('is null for a seed or a choice that is not what it should be, and for items that are not a list of ids', () => {
    for (const seed of [-1, 1.5, '7', null, Number.NaN]) expect(resumableHangulCheck(stored({ seed: seed as never }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ hideRomanization: 'yes' as never }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ items: 'x' as never }), NOW, build)).toBeNull();
    expect(resumableHangulCheck(stored({ items: [1, 2] as never }), NOW, build)).toBeNull();
  });

  it('drops, never repairs: the restored answers are copies', () => {
    const value = stored();
    const out = resumableHangulCheck(JSON.parse(JSON.stringify(value)), NOW, build);
    expect(out?.answers).toEqual(value.answers);
    expect(out?.answers).not.toBe(value.answers);
  });
});
