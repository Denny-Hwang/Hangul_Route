import { describe, expect, it } from 'vitest';
import { MAX_TYPED, PASS_PAUSE_MS, fieldView, startFlow, stepFlow, type TypeHangulEvent, type TypeHangulState } from '../flow';

const run = (state: TypeHangulState, events: TypeHangulEvent[]) => {
  let s = state;
  const effects: ReturnType<typeof stepFlow>['effects'][number][] = [];
  for (const e of events) {
    const r = stepFlow(s, e);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
};
const type = (text: string): TypeHangulEvent[] => [...text].map((c) => (c === ' ' ? { type: 'space' } : { type: 'key', jamo: c }));

describe('type-hangul flow: typing (nothing is scored while typing)', () => {
  it('starts on round 0, empty, typing', () => {
    const s = startFlow(['호야', '김밥']);
    expect(s).toMatchObject({ roundIdx: 0, keys: [], phase: 'typing', score: null, answered: false, done: false });
    expect(fieldView(s)).toEqual({ text: '', settled: '', open: null, live: '', empty: true });
  });

  it('keys compose blocks, the last block is open, and no effect runs', () => {
    const { state, effects } = run(startFlow(['호야']), type('ㅎㅗㅇ'));
    expect(effects).toEqual([]);
    expect(fieldView(state)).toEqual({ text: '홍', settled: '', open: '홍', live: '', empty: false });
    const next = run(state, type('ㅑ')).state;
    // The final hands over to the next block: 호 is finished, 야 is open.
    expect(fieldView(next)).toMatchObject({ text: '호야', settled: '호', open: '야', live: '호' });
  });

  it('Del removes one jamo and reads the whole text', () => {
    const typed = run(startFlow(['한']), type('ㅎㅏㄴ')).state;
    const once = run(typed, [{ type: 'delete' }]).state;
    expect(fieldView(once)).toMatchObject({ text: '하', live: '하' });
    const thrice = run(once, [{ type: 'delete' }, { type: 'delete' }]).state;
    expect(fieldView(thrice)).toMatchObject({ text: '', empty: true });
    expect(run(thrice, [{ type: 'delete' }]).state).toBe(thrice);
  });

  it('Space ends the block; never first, never twice', () => {
    const s0 = startFlow(['저는 호야']);
    expect(run(s0, [{ type: 'space' }]).state).toBe(s0);
    const s1 = run(s0, type('ㅈㅓ ')).state;
    expect(fieldView(s1)).toMatchObject({ text: '저 ', open: null, settled: '저 ' });
    expect(run(s1, [{ type: 'space' }]).state).toBe(s1);
  });

  it('stops at MAX_TYPED characters', () => {
    const many = Array.from({ length: MAX_TYPED + 5 }, () => ({ type: 'key', jamo: 'ㅏ' }) as TypeHangulEvent);
    expect(fieldView(run(startFlow(['아']), many).state).text).toHaveLength(MAX_TYPED);
  });

  it('Done on an empty field does nothing', () => {
    const s = startFlow(['호야']);
    expect(run(s, [{ type: 'done' }]).state).toBe(s);
  });
});

describe('type-hangul flow: Done, the first try and Fix it', () => {
  it('a first-try match scores right, cheers and schedules the advance', () => {
    const { state, effects } = run(startFlow(['호야', '김밥']), [...type('ㅎㅗㅇㅑ'), { type: 'done' }]);
    expect(state.phase).toBe('pass');
    expect(state.score?.verdict).toBe('match');
    expect(effects).toEqual([
      { type: 'answer', roundIdx: 0, correct: true },
      { type: 'haptic', kind: 'success' },
      { type: 'schedule-advance', ms: PASS_PAUSE_MS },
    ]);
  });

  it('keys are ignored while the result panel is up', () => {
    const passed = run(startFlow(['호야']), [...type('ㅎㅗㅇㅑ'), { type: 'done' }]).state;
    expect(run(passed, [{ type: 'key', jamo: 'ㄱ' }, { type: 'delete' }, { type: 'space' }, { type: 'done' }]).state).toBe(passed);
  });

  it('a miss scores the round missed once, nudges, and Fix it keeps the text', () => {
    const missed = run(startFlow(['호야']), [...type('ㅎㅗㅇㅕ'), { type: 'done' }]);
    expect(missed.state.phase).toBe('miss');
    expect(missed.state.score?.verdict).toBe('near');
    expect(missed.effects).toEqual([
      { type: 'answer', roundIdx: 0, correct: false },
      { type: 'haptic', kind: 'nudge' },
    ]);
    const fixed = run(missed.state, [{ type: 'fix' }]);
    expect(fixed.state.phase).toBe('typing');
    expect(fieldView(fixed.state).text).toBe('호여');
    // A retry never answers again: later Dones change nothing in the run.
    const retry = run(fixed.state, [{ type: 'delete' }, { type: 'key', jamo: 'ㅑ' }, { type: 'done' }]);
    expect(retry.state.phase).toBe('pass');
    expect(retry.state.retries).toBe(1);
    expect(retry.effects).toEqual([
      { type: 'haptic', kind: 'success' },
      { type: 'schedule-advance', ms: PASS_PAUSE_MS },
    ]);
  });

  it('a second miss stays a miss with no new answer', () => {
    const s = run(startFlow(['호야']), [...type('ㅎㅏ'), { type: 'done' }, { type: 'fix' }, { type: 'done' }]);
    expect(s.state.phase).toBe('miss');
    expect(s.effects.filter((e) => e.type === 'answer')).toHaveLength(1);
    expect(s.state.retries).toBe(1);
  });

  it('Fix it and advance do nothing in the wrong phase', () => {
    const s = startFlow(['호야']);
    expect(run(s, [{ type: 'fix' }, { type: 'advance' }]).state).toBe(s);
  });

  it('advance moves to a fresh round, and after the last one completes', () => {
    const first = run(startFlow(['호', '야']), [...type('ㅎㅗ'), { type: 'done' }, { type: 'advance' }]);
    expect(first.state).toMatchObject({ roundIdx: 1, keys: [], phase: 'typing', score: null, answered: false, retries: 0 });
    const last = run(first.state, [...type('ㅇㅑ'), { type: 'done' }, { type: 'advance' }]);
    expect(last.state.done).toBe(true);
    expect(last.effects.at(-1)).toEqual({ type: 'complete' });
    expect(run(last.state, [{ type: 'advance' }]).effects).toEqual([]);
  });

  it('Skip completes once: a second Skip and the pass pause advance after it complete nothing more', () => {
    const passed = run(startFlow(['호']), [...type('ㅎㅗ'), { type: 'done' }]);
    expect(passed.effects).toContainEqual({ type: 'schedule-advance', ms: PASS_PAUSE_MS });
    const skipped = run(passed.state, [{ type: 'skip' }, { type: 'skip' }, { type: 'advance' }]);
    expect(skipped.effects).toEqual([{ type: 'complete' }]);
    expect(skipped.state.done).toBe(true);
    // Mid-round, before any Done: Skip leaves without recording the round.
    const early = run(startFlow(['호야', '김밥']), [...type('ㅎ'), { type: 'skip' }]);
    expect(early.effects).toEqual([{ type: 'complete' }]);
  });

  it('a scope with no rounds is done from the start', () => {
    expect(startFlow([])).toMatchObject({ total: 0, done: true });
    const typed = run(startFlow([]), [...type('ㅎㅏ'), { type: 'done' }]);
    expect(typed.effects).toEqual([]);
    expect(typed.state.phase).toBe('typing');
  });
});
