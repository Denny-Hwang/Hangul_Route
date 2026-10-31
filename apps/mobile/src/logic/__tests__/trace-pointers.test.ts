import { spacing } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import {
  NO_TRACE_POINTERS,
  traceTouchesDown,
  traceTouchesEnd,
  traceTouchesMove,
  traceTouchesUp,
  type TracePointers,
  type TraceTouchEffect,
  type TraceTouchStep,
} from '../trace-pointers';

/**
 * AMENDMENTS-TOUCH 6.8 (KT-D9): one finger draws. The first pointer that travels `spacing.xs` owns the
 * stroke; still pointers (a resting palm) are ignored and cancel nothing; a touch that never moved leaves
 * no ink and re-arms the idle check.
 */

const MIN = spacing.xs;

/** Runs touch steps one after another and collects every effect. */
function run(steps: Array<(s: TracePointers) => TraceTouchStep>): { state: TracePointers; effects: TraceTouchEffect[] } {
  let state = NO_TRACE_POINTERS;
  const effects: TraceTouchEffect[] = [];
  for (const step of steps) {
    const out = step(state);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

const down = (id: number, x: number, y: number) => (s: TracePointers) => traceTouchesDown(s, [{ id, x, y }]);
const move = (id: number, x: number, y: number) => (s: TracePointers) => traceTouchesMove(s, [{ id, x, y }], MIN);
const up = (id: number, x = 0, y = 0) => (s: TracePointers) => traceTouchesUp(s, [{ id, x, y }]);

describe('trace pointers: one finger draws (AMENDMENTS-TOUCH 6.8)', () => {
  it('the activation distance is the spacing.xs token, 4 px', () => {
    expect(MIN).toBe(4);
  });

  it('a finger that travels spacing.xs owns the stroke from where it landed; its moves are the points', () => {
    const { effects, state } = run([down(0, 10, 10), move(0, 12, 10), move(0, 14, 10), move(0, 20, 12), up(0)]);
    expect(effects).toEqual([
      { kind: 'hold' },
      { kind: 'start', from: { x: 10, y: 10 }, to: { x: 14, y: 10 } },
      { kind: 'point', at: { x: 20, y: 12 } },
      { kind: 'end' },
    ]);
    expect(state).toEqual(NO_TRACE_POINTERS);
  });

  it('a dot or a 3 px graze leaves no stroke and releases the idle check', () => {
    expect(run([down(0, 10, 10), up(0)]).effects).toEqual([{ kind: 'hold' }, { kind: 'release' }]);
    expect(run([down(0, 10, 10), move(0, 13, 10), up(0)]).effects).toEqual([{ kind: 'hold' }, { kind: 'release' }]);
  });

  it('measures the travel on both axes together', () => {
    // 3 across and 3 down is 4.24 px of travel.
    const { effects } = run([down(0, 10, 10), move(0, 13, 13)]);
    expect(effects).toContainEqual({ kind: 'start', from: { x: 10, y: 10 }, to: { x: 13, y: 13 } });
  });

  it('a resting palm first, then a finger: the finger draws and the palm adds nothing', () => {
    const { effects } = run([
      down(9, 150, 150),
      move(9, 151, 151),
      down(0, 10, 10),
      move(0, 20, 10),
      move(9, 152, 150),
      move(0, 30, 10),
      up(0),
    ]);
    expect(effects).toEqual([
      { kind: 'hold' },
      { kind: 'start', from: { x: 10, y: 10 }, to: { x: 20, y: 10 } },
      { kind: 'point', at: { x: 30, y: 10 } },
      { kind: 'end' },
    ]);
  });

  it('a second touch mid-stroke neither cancels nor moves the stroke', () => {
    const { effects } = run([
      down(0, 10, 10),
      move(0, 20, 10),
      down(1, 150, 150),
      move(1, 140, 140),
      move(0, 30, 10),
      up(1),
      move(0, 40, 10),
      up(0),
    ]);
    expect(effects).toEqual([
      { kind: 'hold' },
      { kind: 'start', from: { x: 10, y: 10 }, to: { x: 20, y: 10 } },
      { kind: 'point', at: { x: 30, y: 10 } },
      { kind: 'point', at: { x: 40, y: 10 } },
      { kind: 'end' },
    ]);
  });

  it('a palm still down when the stroke ends rests until it lifts: it never draws and its lift is silent', () => {
    const { effects, state } = run([
      down(9, 150, 150),
      down(0, 10, 10),
      move(0, 20, 10),
      up(0),
      move(9, 120, 120),
      up(9),
    ]);
    expect(effects).toEqual([
      { kind: 'hold' },
      { kind: 'start', from: { x: 10, y: 10 }, to: { x: 20, y: 10 } },
      { kind: 'end' },
    ]);
    expect(state).toEqual(NO_TRACE_POINTERS);
  });

  it('a new finger while a palm rests holds the idle check again, and draws', () => {
    const { effects } = run([down(9, 150, 150), down(0, 10, 10), move(0, 20, 10), up(0), down(1, 50, 50), move(1, 50, 60), up(1)]);
    expect(effects).toEqual([
      { kind: 'hold' },
      { kind: 'start', from: { x: 10, y: 10 }, to: { x: 20, y: 10 } },
      { kind: 'end' },
      { kind: 'hold' },
      { kind: 'start', from: { x: 50, y: 50 }, to: { x: 50, y: 60 } },
      { kind: 'end' },
    ]);
  });

  it('a palm that lands and lifts without a stroke releases once, when the last fresh finger is up', () => {
    const { effects } = run([down(9, 150, 150), down(0, 10, 10), up(9), up(0)]);
    expect(effects).toEqual([{ kind: 'hold' }, { kind: 'release' }]);
  });

  it('two pointers in one event: the first in the list that travelled owns it', () => {
    const start = run([down(0, 10, 10), down(1, 100, 100)]).state;
    const step = traceTouchesMove(
      start,
      [
        { id: 1, x: 100, y: 110 },
        { id: 0, x: 10, y: 20 },
      ],
      MIN,
    );
    expect(step.effects).toEqual([{ kind: 'start', from: { x: 100, y: 100 }, to: { x: 100, y: 110 } }]);
    expect(step.state.owner).toBe(1);
  });

  it('ignores pointers it never saw go down, and a repeated down keeps the landing point', () => {
    expect(run([move(5, 50, 50), up(5)]).effects).toEqual([]);
    const { effects } = run([down(0, 10, 10), down(0, 30, 30), move(0, 20, 10)]);
    expect(effects).toEqual([{ kind: 'hold' }, { kind: 'start', from: { x: 10, y: 10 }, to: { x: 20, y: 10 } }]);
  });

  it('a move that changes nothing returns the same state', () => {
    const s = run([down(0, 10, 10)]).state;
    expect(traceTouchesMove(s, [{ id: 0, x: 11, y: 10 }], MIN).state).toBe(s);
  });

  describe('traceTouchesEnd: the gesture finished (cancelled, or the lifts never came)', () => {
    it('ends an owned stroke once; the others lift silently', () => {
      const s = run([down(9, 150, 150), down(0, 10, 10), move(0, 20, 10)]).state;
      const out = traceTouchesEnd(s);
      expect(out.effects).toEqual([{ kind: 'end' }]);
      expect(out.state).toEqual(NO_TRACE_POINTERS);
    });

    it('releases a touch that never drew', () => {
      const s = run([down(0, 10, 10), down(1, 30, 30)]).state;
      expect(traceTouchesEnd(s).effects).toEqual([{ kind: 'release' }]);
    });

    it('does nothing when every finger already lifted', () => {
      const out = traceTouchesEnd(NO_TRACE_POINTERS);
      expect(out.effects).toEqual([]);
      expect(out.state).toBe(NO_TRACE_POINTERS);
    });
  });
});
