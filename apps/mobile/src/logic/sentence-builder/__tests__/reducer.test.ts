import { describe, expect, it } from 'vitest';
import { buildRound, type SbRound } from '../progression';
import { TOUCH_WINDOW_MS, missHint, startFlow, stepFlow, type SbEffect, type SbEvent, type SbState } from '../reducer';
import { FRESH_SCORE, isRightTile, scoreComplete, scoreMiss } from '../scoring';
import { BOOK_PARTICLE, EAT_RICE, LIKE_TTEOKGUK } from './fixtures';

const eat = buildRound(EAT_RICE, 1)!;
const like = buildRound(LIKE_TTEOKGUK, 2)!;
const book = buildRound(BOOK_PARTICLE, 3)!;

const idOf = (round: SbRound, ko: string): string => round.tray.find((t) => t.ko === ko)!.id;

/** Runs events through the reducer; taps are spaced past the 50 ms window and every slide settles. */
function play(rounds: readonly SbRound[], taps: readonly string[], state: SbState = startFlow(rounds.length)) {
  const effects: SbEffect[] = [];
  let at = (state.lastTapAt ?? 0) + 1000;
  for (const ko of taps) {
    const round = rounds[state.roundIdx]!;
    const out = stepFlow(state, rounds, { type: 'tap', tileId: idOf(round, ko), at });
    effects.push(...out.effects);
    state = out.state;
    at += 500;
    if (state.returning !== null) state = stepFlow(state, rounds, { type: 'settle' }).state;
  }
  return { state, effects };
}

const answers = (effects: readonly SbEffect[]) => effects.filter((e) => e.type === 'answer');

describe('scoring', () => {
  it('records the first miss as the answer, and nothing after it', () => {
    const first = scoreMiss(FRESH_SCORE);
    expect(first.record).toBe(false);
    const second = scoreMiss(first.score);
    expect(second.record).toBeNull();
    expect(second.score.misses).toBe(2);
    expect(scoreComplete(second.score).record).toBeNull();
  });

  it('records a round built with no miss as right', () => {
    expect(scoreComplete(FRESH_SCORE)).toEqual({ score: { recorded: true, misses: 0 }, record: true });
  });

  it('knows the right tile for the next place, and that an extra tile is never right', () => {
    const rice = eat.tray.find((t) => t.ko === '밥을')!;
    expect(isRightTile(eat, 0, rice)).toBe(true);
    expect(isRightTile(eat, 1, rice)).toBe(false);
    expect(isRightTile(eat, 0, eat.tray.find((t) => t.id === 'd0')!)).toBe(false);
    expect(isRightTile(eat, 2, rice)).toBe(false);
    expect(isRightTile(book, 0, book.tray.find((t) => t.ko === '이')!)).toBe(true);
    expect(isRightTile(book, 0, book.tray.find((t) => t.ko === '가')!)).toBe(false);
  });
});

describe('startFlow', () => {
  it('starts building round 1, or empty with no round', () => {
    expect(startFlow(2)).toMatchObject({ status: 'building', roundIdx: 0, total: 2, placed: [], tried: [] });
    expect(startFlow(0).status).toBe('empty');
    expect(stepFlow(startFlow(0), [], { type: 'advance' }).state.status).toBe('empty');
  });
});

describe('a round built with no miss', () => {
  it('places each right tile, then records one right answer, plays the sentence and waits to advance', () => {
    const { state, effects } = play([eat], ['밥을', '먹어요']);
    expect(state.status).toBe('complete');
    expect(state.placed).toEqual([idOf(eat, '밥을'), idOf(eat, '먹어요')]);
    expect(answers(effects)).toEqual([{ type: 'answer', roundKey: 0, correct: true }]);
    expect(effects).toContainEqual({ type: 'haptic', kind: 'light' });
    expect(effects).toContainEqual({ type: 'haptic', kind: 'success' });
    expect(effects).toContainEqual({ type: 'play-sentence' });
  });

  it('advances to a fresh round, and the last advance completes the step', () => {
    let { state } = play([eat, like], ['밥을', '먹어요']);
    state = stepFlow(state, [eat, like], { type: 'advance' }).state;
    expect(state).toMatchObject({ status: 'building', roundIdx: 1, placed: [], tried: [], slotMisses: 0, hint: null, score: FRESH_SCORE });
    const done = play([eat, like], ['저는', '떡국을', '좋아해요'], state);
    expect(answers(done.effects)).toEqual([{ type: 'answer', roundKey: 1, correct: true }]);
    const last = stepFlow(done.state, [eat, like], { type: 'advance' });
    expect(last.state.status).toBe('done');
    expect(last.effects).toEqual([{ type: 'complete' }]);
    expect(stepFlow(last.state, [eat, like], { type: 'advance' }).effects).toEqual([]);
  });

  it('ignores advance while building', () => {
    const state = startFlow(1);
    expect(stepFlow(state, [eat], { type: 'advance' }).state).toBe(state);
  });
});

describe('a miss', () => {
  it('slides the tile back, marks it tried, nudges, and records the round once as missed', () => {
    const state = startFlow(1);
    const out = stepFlow(state, [eat], { type: 'tap', tileId: idOf(eat, '물을'), at: 1000 });
    expect(out.state).toMatchObject({ tried: ['d0'], slotMisses: 1, returning: 'd0', hint: 'miss' });
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'haptic', kind: 'nudge' },
      { type: 'schedule-settle' },
    ]);
  });

  it('waits for the tile to settle before taking another tap', () => {
    const missed = stepFlow(startFlow(1), [eat], { type: 'tap', tileId: 'd0', at: 1000 }).state;
    expect(stepFlow(missed, [eat], { type: 'tap', tileId: idOf(eat, '밥을'), at: 2000 }).state).toBe(missed);
    const settled = stepFlow(missed, [eat], { type: 'settle' }).state;
    expect(settled.returning).toBeNull();
    expect(stepFlow(settled, [eat], { type: 'settle' }).state).toBe(settled);
  });

  it('says the doing word comes last when the last word is tapped first', () => {
    const { state } = play([eat], ['먹어요']);
    expect(state.hint).toBe('lastWord');
  });

  it('rings the right tile after the second miss on one place, and clears the marks once it is filled', () => {
    const { state } = play([like], ['좋아해요', '떡국을']);
    expect(state).toMatchObject({ slotMisses: 2, hint: 'lookHere' });
    expect(state.tried).toHaveLength(2);
    const placed = play([like], ['저는'], state).state;
    expect(placed).toMatchObject({ tried: [], slotMisses: 0, hint: null, placed: [idOf(like, '저는')] });
  });

  it('keeps a tile tried once in the list once', () => {
    const { state } = play([like], ['좋아해요', '좋아해요']);
    expect(state.tried).toEqual([idOf(like, '좋아해요')]);
  });

  it('in the Check: miss, miss, ring, right records exactly one answer, false (G-1 test)', () => {
    const { effects, state } = play([like], ['떡국을', '좋아해요', '저는', '떡국을', '좋아해요']);
    expect(state.status).toBe('complete');
    expect(answers(effects)).toEqual([{ type: 'answer', roundKey: 0, correct: false }]);
  });

  it('a particle miss points at the ending', () => {
    const { state } = play([book], ['가']);
    expect(state.hint).toBe('particle');
    const done = play([book], ['이'], state);
    expect(done.state.status).toBe('complete');
    expect(answers(done.effects)).toEqual([]);
  });
});

describe('taps the flow drops', () => {
  it('drops a second touch inside 50 ms, a placed tile, an unknown tile and taps after the sentence is built', () => {
    const rice = idOf(eat, '밥을');
    const first = stepFlow(startFlow(1), [eat], { type: 'tap', tileId: rice, at: 1000 }).state;
    expect(stepFlow(first, [eat], { type: 'tap', tileId: idOf(eat, '먹어요'), at: 1000 + TOUCH_WINDOW_MS - 1 }).state).toBe(first);
    expect(stepFlow(first, [eat], { type: 'tap', tileId: rice, at: 3000 }).state).toBe(first);
    expect(stepFlow(first, [eat], { type: 'tap', tileId: 'nope', at: 3000 }).state).toBe(first);
    const built = play([eat], ['밥을', '먹어요']).state;
    expect(stepFlow(built, [eat], { type: 'tap', tileId: 'd0', at: 9000 }).state).toBe(built);
    const lost: SbEvent = { type: 'tap', tileId: rice, at: 1 };
    expect(stepFlow({ ...startFlow(1), roundIdx: 4 }, [eat], lost).effects).toEqual([]);
  });
});

describe('missHint', () => {
  it('names the last word only when the place is not the last one', () => {
    const verb = idOf(eat, '먹어요');
    expect(missHint(eat, 0, verb, 1)).toBe('lastWord');
    expect(missHint(eat, 1, 'd0', 1)).toBe('miss');
    expect(missHint(eat, 0, 'missing', 1)).toBe('miss');
    expect(missHint(eat, 0, verb, 2)).toBe('lookHere');
    expect(missHint(book, 0, 'c0', 1)).toBe('particle');
  });
});
