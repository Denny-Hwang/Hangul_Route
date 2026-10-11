import { describe, expect, it } from 'vitest';
import { sequenceRoundKey } from '../../round-keys';
import {
  HIGHLIGHT_SLOT_AFTER_WRONG,
  initSequenceState,
  reduceSequence,
  remainingCards,
  type SequenceAction,
  type SequenceEffect,
  type SequenceState,
} from '../sequence-player';
import { isSameOrder } from '../seeded-order';

const cards = (xs: readonly string[]): Array<{ id: string }> => xs.map((id) => ({ id }));
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `s${i + 1}`);

function run(
  start: SequenceState,
  actions: SequenceAction[],
): { state: SequenceState; effects: SequenceEffect[] } {
  let state = start;
  const effects: SequenceEffect[] = [];
  for (const a of actions) {
    const out = reduceSequence(state, a);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

const tap = (cardId: string): SequenceAction => ({ type: 'tap', cardId });

describe('initSequenceState', () => {
  it('shows the cards in a derangement: never sorted, no card in its own place', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      for (let seed = 0; seed < 100; seed += 1) {
        const solution = ids(n);
        const s = initSequenceState(cards(solution), seed);
        expect(isSameOrder(s.order, solution), `${n}/${seed}`).toBe(false);
        s.order.forEach((id, i) => expect(id).not.toBe(solution[i]));
        expect([...s.order].sort()).toEqual([...solution].sort());
      }
    }
  });

  it('starts ordering with nothing placed', () => {
    const s = initSequenceState(cards(ids(4)), 1);
    expect(s.phase).toBe('ordering');
    expect(s.placed).toEqual([]);
    expect(s.wrongBySlot).toEqual([0, 0, 0, 0]);
    expect(s.solution).toEqual(ids(4));
  });

  it('is deterministic per seed and does not mutate the input', () => {
    const solution = ids(5);
    const copy = [...solution];
    expect(initSequenceState(cards(solution), 9).order).toEqual(initSequenceState(cards(solution), 9).order);
    expect(solution).toEqual(copy);
  });

  it('is done at once for an empty list, and a single card is simply placed', () => {
    expect(initSequenceState(cards([]), 1).phase).toBe('done');
    const one = initSequenceState(cards(['s1']), 1);
    expect(one.order).toEqual(['s1']);
    expect(one.phase).toBe('ordering');
  });
});

describe('remainingCards', () => {
  it('lists the unplaced cards in display order', () => {
    const s = initSequenceState(cards(ids(4)), 3);
    const first = s.solution[0] as string;
    const { state } = run(s, [tap(first)]);
    expect(remainingCards(state)).toEqual(s.order.filter((id) => id !== first));
  });
});

describe('reduceSequence: tap', () => {
  it('places the right card and scores the slot as a first-try hit', () => {
    const s = initSequenceState(cards(ids(4)), 2);
    const { state, effects } = run(s, [tap('s1')]);
    expect(state.placed).toEqual(['s1']);
    expect(effects).toEqual([{ type: 'answer', roundKey: sequenceRoundKey(0), correct: true }]);
  });

  it('leaves state unchanged on a wrong card but scores the slot as a miss', () => {
    const s = initSequenceState(cards(ids(4)), 2);
    const { state, effects } = run(s, [tap('s3')]);
    expect(state.placed).toEqual([]);
    expect(state.order).toEqual(s.order);
    expect(state.wrongBySlot).toEqual([1, 0, 0, 0]);
    expect(effects).toEqual([{ type: 'answer', roundKey: sequenceRoundKey(0), correct: false }]);
  });

  it('highlights the right card after two wrong taps on a slot', () => {
    expect(HIGHLIGHT_SLOT_AFTER_WRONG).toBe(2);
    const s = initSequenceState(cards(ids(4)), 2);
    const { effects } = run(s, [tap('s3'), tap('s4')]);
    expect(effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'highlight', cardId: 's1' },
    ]);
    const third = run(s, [tap('s3'), tap('s4'), tap('s2')]);
    expect(third.effects.filter((e) => e.type === 'highlight')).toHaveLength(1);
  });

  it('counts wrong taps per slot', () => {
    const s = initSequenceState(cards(ids(4)), 2);
    const { state } = run(s, [tap('s2'), tap('s1'), tap('s3')]);
    expect(state.wrongBySlot).toEqual([1, 1, 0, 0]);
    expect(state.placed).toEqual(['s1']);
  });

  it('ignores a card that is already placed or unknown', () => {
    const s = initSequenceState(cards(ids(4)), 2);
    const placed = run(s, [tap('s1')]);
    expect(run(placed.state, [tap('s1')])).toEqual({ state: placed.state, effects: [] });
    expect(run(placed.state, [tap('nope')])).toEqual({ state: placed.state, effects: [] });
  });

  it('enters the replay when the last slot is placed', () => {
    const s = initSequenceState(cards(ids(4)), 2);
    const { state, effects } = run(s, ids(4).map(tap));
    expect(state.phase).toBe('replay');
    expect(state.placed).toEqual(ids(4));
    expect(state.replayIndex).toBe(0);
    expect(state.paused).toBe(false);
    expect(state.replayed).toBe(false);
    expect(effects.map((e) => e.type)).toEqual(['answer', 'answer', 'answer', 'answer']);
  });

  it('ignores taps outside the ordering phase', () => {
    const s = initSequenceState(cards(ids(3)), 2);
    const replay = run(s, ids(3).map(tap)).state;
    expect(run(replay, [tap('s1')])).toEqual({ state: replay, effects: [] });
  });

  it('plays a legacy 4-step scope the same way', () => {
    const legacy = ['a', 'b', 'c', 'd'];
    const { state } = run(initSequenceState(cards(legacy), 5), legacy.map(tap));
    expect(state.phase).toBe('replay');
  });
});

describe('reduceSequence: replay', () => {
  const replaying = (n = 3): SequenceState => run(initSequenceState(cards(ids(n)), 4), ids(n).map(tap)).state;

  it('steps forward and back, clamped to the cards', () => {
    let s = replaying(3);
    s = run(s, [{ type: 'replayBack' }]).state;
    expect(s.replayIndex).toBe(0);
    s = run(s, [{ type: 'replayNext' }]).state;
    expect(s.replayIndex).toBe(1);
    expect(s.replayed).toBe(false);
    s = run(s, [{ type: 'replayNext' }]).state;
    expect(s.replayIndex).toBe(2);
    expect(s.replayed).toBe(true);
    s = run(s, [{ type: 'replayNext' }]).state;
    expect(s.replayIndex).toBe(2);
    s = run(s, [{ type: 'replayBack' }]).state;
    expect(s.replayIndex).toBe(1);
    expect(s.replayed).toBe(true);
  });

  it('toggles pause', () => {
    const paused = run(replaying(), [{ type: 'togglePause' }]).state;
    expect(paused.paused).toBe(true);
    expect(run(paused, [{ type: 'togglePause' }]).state.paused).toBe(false);
  });

  it('records nothing during the replay', () => {
    const { effects } = run(replaying(), [
      { type: 'replayNext' },
      { type: 'replayBack' },
      { type: 'togglePause' },
    ]);
    expect(effects).toEqual([]);
  });

  it('skipReplay and finish both end the step with a finish effect', () => {
    for (const type of ['skipReplay', 'finish'] as const) {
      const out = run(replaying(), [{ type }]);
      expect(out.state.phase).toBe('done');
      expect(out.effects).toEqual([{ type: 'finish' }]);
    }
  });

  it('marks the replay as watched when it is a single card', () => {
    const s = run(initSequenceState(cards(['only']), 1), [tap('only')]).state;
    expect(s.phase).toBe('replay');
    expect(s.replayed).toBe(true);
  });

  it('ignores replay actions outside the replay phase', () => {
    const s = initSequenceState(cards(ids(4)), 1);
    for (const type of ['skipReplay', 'replayNext', 'replayBack', 'togglePause', 'finish'] as const) {
      expect(reduceSequence(s, { type })).toEqual({ state: s, effects: [] });
    }
  });

  it('does nothing once done', () => {
    const done = run(replaying(), [{ type: 'finish' }]).state;
    expect(reduceSequence(done, tap('s1'))).toEqual({ state: done, effects: [] });
    expect(reduceSequence(done, { type: 'finish' })).toEqual({ state: done, effects: [] });
  });
});
