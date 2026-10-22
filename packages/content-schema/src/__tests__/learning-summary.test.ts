import { describe, expect, it } from 'vitest';
import { LEARNING_SUMMARY_TOP_DUE_MAX, LearningSummaryResponseSchema, topDueOf } from '../schemas/learning-summary';

/** F-CURR-002 section 8, row CM-16: the teacher read route's body and its class aggregate. */
describe('topDueOf', () => {
  it('counts each learner once per item, the most first, then by id', () => {
    expect(topDueOf([['lex:sagwa', 'lex:bae~pear', 'lex:sagwa'], ['lex:bae~pear'], ['sym:bieup', 'lex:bae~pear', 'lex:sagwa']])).toEqual([
      { itemId: 'lex:bae~pear', learners: 3 },
      { itemId: 'lex:sagwa', learners: 2 },
      { itemId: 'sym:bieup', learners: 1 },
    ]);
  });

  it('keeps at most 8, and an empty class has none', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `lex:w${String(i).padStart(2, '0')}`);
    expect(topDueOf([ids, ids.slice(5)])).toHaveLength(LEARNING_SUMMARY_TOP_DUE_MAX);
    expect(topDueOf([ids, ids.slice(5)])[0]).toEqual({ itemId: 'lex:w05', learners: 2 });
    expect(topDueOf([])).toEqual([]);
  });

  it('does not depend on the order of the learners', () => {
    const lists = [['a:1', 'a:2'], ['a:2', 'a:3'], ['a:3']];
    expect(topDueOf([...lists].reverse())).toEqual(topDueOf(lists));
  });
});

describe('LearningSummaryResponseSchema', () => {
  const space = { id: 'space:c', kind: 'class', name: 'Sunflower', parentSpaceId: null, settings: { anonymizeRoster: false, consentMode: 'parent' }, archivedAt: null, createdAt: '2026-10-01T00:00:00.000Z' };
  const memory = { wordsKnown: 4, readyToRefresh: 2, cellBestCounts: [1, 0, 0], stageChecks: 0, weekPoints: 3, topDue: ['lex:sagwa'] };

  it('parses a body with a block, a learner without one and the aggregate', () => {
    const body = {
      space,
      learners: [
        { learnerId: 'profile:a', memory, classProgress: null },
        { learnerId: 'profile:b', memory: null, classProgress: null },
      ],
      class: { learners: 2, counted: 1, topDue: [{ itemId: 'lex:sagwa', learners: 1 }] },
      serverTime: '2026-10-22T00:00:00.000Z',
    };
    expect(LearningSummaryResponseSchema.parse(body)).toEqual(body);
  });

  it('strips any item state a writer left on a block (objects strip unknown keys)', () => {
    const parsed = LearningSummaryResponseSchema.parse({
      space,
      learners: [{ learnerId: 'profile:a', memory: { ...memory, states: { 'lex:sagwa': { b: 2 } } }, classProgress: null }],
      class: { learners: 1, counted: 1, topDue: [] },
      serverTime: 't',
    });
    expect(JSON.stringify(parsed)).not.toMatch(/states/);
  });
});
