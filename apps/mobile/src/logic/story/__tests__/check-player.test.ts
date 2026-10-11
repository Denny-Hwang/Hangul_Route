import { describe, expect, it } from 'vitest';
import type { StoryCheck } from '@hangul-route/content-schema';
import { buildCheckView, type CheckView } from '../check-view';
import {
  HIGHLIGHT_AFTER_WRONG,
  initCheckState,
  reduceCheck,
  type CheckAction,
  type CheckEffect,
  type CheckPlayerView,
  type CheckState,
} from '../check-player';

const mkCheck = (id: string): StoryCheck => ({
  id,
  kind: 'detail',
  promptEn: `Question ${id}?`,
  options: [
    { id: 'a', en: 'A', isCorrect: false },
    { id: 'b', en: 'B', isCorrect: true },
    { id: 'c', en: 'C', isCorrect: false },
    { id: 'd', en: 'D', isCorrect: false },
  ],
  factIds: ['f1'],
});

const itemsOf = (n: number): CheckView[] =>
  Array.from({ length: n }, (_, i) => buildCheckView({ ...mkCheck(`c${i + 1}`), shuffle: false }, 'story:t'));

const viewOf = (n: number, hasRecap = true): CheckPlayerView => ({ items: itemsOf(n), hasRecap });

function run(
  view: CheckPlayerView,
  actions: CheckAction[],
  start: CheckState = initCheckState(view),
): { state: CheckState; effects: CheckEffect[] } {
  let state = start;
  const effects: CheckEffect[] = [];
  for (const a of actions) {
    const out = reduceCheck(state, a, view);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

const choose = (optionId: string): CheckAction => ({ type: 'choose', optionId });

describe('initCheckState', () => {
  it('starts answering the first item', () => {
    expect(initCheckState(viewOf(3))).toEqual({ index: 0, phase: 'answering', wrong: [], taps: 0 });
  });

  it('is done at once when there are no items', () => {
    expect(initCheckState(viewOf(0))).toEqual({ index: 0, phase: 'done', wrong: [], taps: 0 });
  });
});

describe('reduceCheck: a first-try correct answer', () => {
  it('scores once, resolves as first try and waits for Next (no auto-advance)', () => {
    const view = viewOf(3);
    const { state, effects } = run(view, [choose('b')]);
    expect(effects).toEqual([
      { type: 'answer', roundKey: 'check:c1', correct: true },
      { type: 'resolved', checkId: 'c1', firstTry: true, taps: 1 },
    ]);
    expect(state.phase).toBe('explained');
    expect(state.index).toBe(0);
  });

  it('moves to the next item only on next()', () => {
    const view = viewOf(3);
    const { state, effects } = run(view, [choose('b'), { type: 'next' }]);
    expect(state).toEqual({ index: 1, phase: 'answering', wrong: [], taps: 0 });
    expect(effects.filter((e) => e.type === 'finish')).toEqual([]);
  });
});

describe('reduceCheck: wrong taps', () => {
  it('scores the first wrong tap as a miss, locks that option and keeps the item open', () => {
    const view = viewOf(3);
    const { state, effects } = run(view, [choose('a')]);
    expect(effects).toEqual([{ type: 'answer', roundKey: 'check:c1', correct: false }]);
    expect(state).toEqual({ index: 0, phase: 'answering', wrong: ['a'], taps: 1 });
  });

  it('emits the highlight once HIGHLIGHT_AFTER_WRONG wrong taps happened', () => {
    expect(HIGHLIGHT_AFTER_WRONG).toBe(2);
    const view = viewOf(3);
    const first = run(view, [choose('a')]);
    expect(first.effects.some((e) => e.type === 'highlight')).toBe(false);
    const second = run(view, [choose('c')], first.state);
    expect(second.effects).toEqual([
      { type: 'answer', roundKey: 'check:c1', correct: false },
      { type: 'highlight', optionId: 'b' },
    ]);
    const third = run(view, [choose('d')], second.state);
    expect(third.effects).toEqual([{ type: 'answer', roundKey: 'check:c1', correct: false }]);
  });

  it('reports every tap to answerRound (the run store keeps only the first)', () => {
    const view = viewOf(3);
    const { effects } = run(view, [choose('a'), choose('c'), choose('b')]);
    expect(effects.filter((e) => e.type === 'answer')).toEqual([
      { type: 'answer', roundKey: 'check:c1', correct: false },
      { type: 'answer', roundKey: 'check:c1', correct: false },
      { type: 'answer', roundKey: 'check:c1', correct: true },
    ]);
  });

  it('resolves as not-first-try when the right option comes after a wrong one', () => {
    const view = viewOf(3);
    const { state, effects } = run(view, [choose('a'), choose('b')]);
    expect(effects.at(-1)).toEqual({ type: 'resolved', checkId: 'c1', firstTry: false, taps: 2 });
    expect(state.phase).toBe('explained');
  });

  it('ignores a tap on an option that is already locked as wrong', () => {
    const view = viewOf(3);
    const first = run(view, [choose('a')]);
    const again = run(view, [choose('a')], first.state);
    expect(again.effects).toEqual([]);
    expect(again.state).toEqual(first.state);
  });

  it('ignores an unknown option id', () => {
    const view = viewOf(3);
    const start = initCheckState(view);
    const out = reduceCheck(start, choose('zzz'), view);
    expect(out).toEqual({ state: start, effects: [] });
  });
});

describe('reduceCheck: phases', () => {
  it('ignores choose() once the item is explained', () => {
    const view = viewOf(3);
    const resolved = run(view, [choose('b')]);
    const out = reduceCheck(resolved.state, choose('a'), view);
    expect(out).toEqual({ state: resolved.state, effects: [] });
  });

  it('ignores next() while answering', () => {
    const view = viewOf(3);
    const start = initCheckState(view);
    expect(reduceCheck(start, { type: 'next' }, view)).toEqual({ state: start, effects: [] });
  });

  it('ignores finishRecap() outside the recap', () => {
    const view = viewOf(3);
    const start = initCheckState(view);
    expect(reduceCheck(start, { type: 'finishRecap' }, view)).toEqual({ state: start, effects: [] });
  });

  it('after the last item goes to the recap when there are words, then done on finishRecap', () => {
    const view = viewOf(2, true);
    const afterLast = run(view, [choose('b'), { type: 'next' }, choose('b'), { type: 'next' }]);
    expect(afterLast.state.phase).toBe('recap');
    expect(afterLast.effects.some((e) => e.type === 'finish')).toBe(false);
    const done = run(view, [{ type: 'finishRecap' }], afterLast.state);
    expect(done.state.phase).toBe('done');
    expect(done.effects).toEqual([{ type: 'finish' }]);
  });

  it('after the last item finishes at once when there is no recap', () => {
    const view = viewOf(2, false);
    const out = run(view, [choose('b'), { type: 'next' }, choose('b'), { type: 'next' }]);
    expect(out.state.phase).toBe('done');
    expect(out.effects.at(-1)).toEqual({ type: 'finish' });
  });

  it('does nothing once done', () => {
    const view = viewOf(0);
    const start = initCheckState(view);
    for (const a of [choose('b'), { type: 'next' } as const, { type: 'finishRecap' } as const]) {
      expect(reduceCheck(start, a, view)).toEqual({ state: start, effects: [] });
    }
  });

  it('keeps the effects of a whole run in order', () => {
    const view = viewOf(3, true);
    const { effects } = run(view, [
      choose('a'),
      choose('b'),
      { type: 'next' },
      choose('b'),
      { type: 'next' },
      choose('b'),
      { type: 'next' },
      { type: 'finishRecap' },
    ]);
    expect(effects.map((e) => e.type)).toEqual([
      'answer',
      'answer',
      'resolved',
      'answer',
      'resolved',
      'answer',
      'resolved',
      'finish',
    ]);
  });
});
