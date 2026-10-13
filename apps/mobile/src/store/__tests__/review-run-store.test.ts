import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewHost, useReviewRunStore } from '../review-run-store';
import { useQuestRunStore } from '../quest-run-store';

/** F-QUEST-002 §3.9: the Hangul Check's run, ephemeral, first try per item. */
describe('review-run-store', () => {
  beforeEach(() => useReviewRunStore.getState().reset());

  it('begins with the item ids and no answers', () => {
    useReviewRunStore.getState().begin(['jamo:giyeok', 'word:bap']);
    expect(useReviewRunStore.getState()).toMatchObject({ itemIds: ['jamo:giyeok', 'word:bap'], answers: {} });
  });

  it('scores the first answer per item; later answers are retries and never change it', () => {
    const s = useReviewRunStore.getState();
    s.begin(['jamo:giyeok', 'word:bap']);
    s.answer('jamo:giyeok', false);
    s.answer('jamo:giyeok', true);
    s.answer('jamo:giyeok', true);
    s.answer('word:bap', true);
    expect(useReviewRunStore.getState().answers).toEqual({
      'jamo:giyeok': { first: false, retries: 2 },
      'word:bap': { first: true, retries: 0 },
    });
  });

  it('ignores an answer for an item that is not in the run', () => {
    const s = useReviewRunStore.getState();
    s.begin(['jamo:giyeok']);
    s.answer('jamo:nope', true);
    expect(useReviewRunStore.getState().answers).toEqual({});
  });

  it('reset forgets the run (leaving saves nothing)', () => {
    const s = useReviewRunStore.getState();
    s.begin(['jamo:giyeok']);
    s.answer('jamo:giyeok', true);
    s.reset();
    expect(useReviewRunStore.getState()).toMatchObject({ itemIds: [], answers: {} });
  });

  it('the review host credits the item by its id, never by the round index, and never touches a quest run', () => {
    const questRun = useQuestRunStore.getState();
    const before = JSON.stringify({ ...questRun });
    useReviewRunStore.getState().begin(['jamo:giyeok', 'jamo:nieun']);
    const done = vi.fn();
    const host = reviewHost(done);
    expect(host.mode).toBe('review');
    host.answer(0, true, { itemId: 'jamo:nieun' });
    host.answer(1, false);
    host.complete();
    expect(useReviewRunStore.getState().answers).toEqual({ 'jamo:nieun': { first: true, retries: 0 } });
    expect(done).toHaveBeenCalledTimes(1);
    expect(JSON.stringify({ ...useQuestRunStore.getState() })).toBe(before);
  });
});
