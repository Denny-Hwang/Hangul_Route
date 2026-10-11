import { describe, expect, it } from 'vitest';
import {
  initReader,
  openEffects,
  reduceReader,
  type ReaderAction,
  type ReaderEffect,
  type ReaderState,
} from '../reader-state';

const NONE = [null, null, null, null, null];

function run(state: ReaderState, ...actions: ReaderAction[]): { state: ReaderState; effects: ReaderEffect[] } {
  let current = state;
  const effects: ReaderEffect[] = [];
  for (const action of actions) {
    const step = reduceReader(current, action);
    current = step.state;
    effects.push(...step.effects);
  }
  return { state: current, effects };
}

describe('initReader', () => {
  it('opens fresh on scene 0 in the scene phase with nothing open', () => {
    expect(initReader(5, 0, NONE)).toEqual({
      index: 0,
      furthest: 0,
      phase: 'scene',
      checkpointId: null,
      openTerm: null,
      revealed: [],
      sceneCount: 5,
      checkpoints: NONE,
      resolved: [],
    });
  });

  it('a resume landing starts on that scene with furthest equal to it', () => {
    const s = initReader(8, 3, [null, null, null, null, null, null, null, null]);
    expect(s.index).toBe(3);
    expect(s.furthest).toBe(3);
  });

  it('clamps the start index into [0, n-1] and survives junk', () => {
    expect(initReader(5, 99, NONE).index).toBe(4);
    expect(initReader(5, -4, NONE).index).toBe(0);
    expect(initReader(5, 2.9, NONE).index).toBe(2);
    expect(initReader(5, Number.NaN, NONE).index).toBe(0);
    expect(initReader(5, Number.POSITIVE_INFINITY, NONE).index).toBe(0);
  });

  it('never has fewer than one scene (the fallback screen guards real content)', () => {
    const s = initReader(0, 3, []);
    expect(s.sceneCount).toBe(1);
    expect(s.index).toBe(0);
    expect(initReader(Number.NaN, 0, []).sceneCount).toBe(1);
    expect(initReader(4.8, 0, []).sceneCount).toBe(4);
  });

  it('normalises checkpoint ids: undefined and short arrays mean "none"', () => {
    const s = initReader(3, 0, [undefined, 'cp1']);
    expect(s.checkpoints).toEqual([null, 'cp1', null]);
  });
});

describe('openEffects', () => {
  it('announces the opening scene (bookmark, autoplay and announcement run from it)', () => {
    expect(openEffects(initReader(5, 0, NONE))).toEqual([{ type: 'scene-changed', index: 0, via: 'open' }]);
    expect(openEffects(initReader(5, 3, NONE))).toEqual([{ type: 'scene-changed', index: 3, via: 'open' }]);
  });
});

describe('next / back', () => {
  it('next moves on one scene and raises furthest', () => {
    const { state, effects } = run(initReader(5, 0, NONE), { type: 'next' });
    expect(state).toMatchObject({ index: 1, furthest: 1, phase: 'scene' });
    expect(effects).toEqual([{ type: 'scene-changed', index: 1, via: 'next' }]);
  });

  it('back moves on one scene and furthest only grows', () => {
    const { state, effects } = run(initReader(5, 0, NONE), { type: 'next' }, { type: 'next' }, { type: 'back' });
    expect(state).toMatchObject({ index: 1, furthest: 2 });
    expect(effects.at(-1)).toEqual({ type: 'scene-changed', index: 1, via: 'back' });
  });

  it('going Back then Next again does not lower furthest', () => {
    const { state } = run(initReader(5, 0, NONE), { type: 'next' }, { type: 'next' }, { type: 'back' }, { type: 'next' });
    expect(state).toMatchObject({ index: 2, furthest: 2 });
  });

  it('back on scene 0 is a no-op without effects', () => {
    const start = initReader(5, 0, NONE);
    const step = reduceReader(start, { type: 'back' });
    expect(step.state).toBe(start);
    expect(step.effects).toEqual([]);
  });

  it('next on the last scene shows the end page and finishes reading', () => {
    const { state, effects } = run(initReader(3, 2, [null, null, null]), { type: 'next' });
    expect(state).toMatchObject({ index: 2, furthest: 2, phase: 'end', checkpointId: null });
    expect(effects).toEqual([{ type: 'finish-reading' }]);
  });

  it('back from the end page returns to the last scene', () => {
    const atEnd = run(initReader(3, 2, [null, null, null]), { type: 'next' }).state;
    const { state, effects } = run(atEnd, { type: 'back' });
    expect(state).toMatchObject({ index: 2, phase: 'scene' });
    expect(effects).toEqual([{ type: 'scene-changed', index: 2, via: 'back' }]);
  });

  it('next on the end page does nothing', () => {
    const atEnd = run(initReader(3, 2, [null, null, null]), { type: 'next' }).state;
    const step = reduceReader(atEnd, { type: 'next' });
    expect(step.state).toBe(atEnd);
    expect(step.effects).toEqual([]);
  });

  it('a full read-through with the dots only filling', () => {
    let s = initReader(4, 0, [null, null, null, null]);
    const fills: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      s = reduceReader(s, { type: i % 2 === 0 ? 'next' : 'back' }).state;
      fills.push(s.furthest + 1);
    }
    for (let i = 1; i < fills.length; i += 1) expect(fills[i]).toBeGreaterThanOrEqual(fills[i - 1] as number);
  });
});

describe('goTo', () => {
  it('jumps, clamps, grows furthest and announces the change', () => {
    const { state, effects } = run(initReader(6, 0, [null, null, null, null, null, null]), { type: 'goTo', index: 4 });
    expect(state).toMatchObject({ index: 4, furthest: 4, phase: 'scene' });
    expect(effects).toEqual([{ type: 'scene-changed', index: 4, via: 'goTo' }]);
    expect(run(state, { type: 'goTo', index: 99 }).state.index).toBe(5);
    expect(run(state, { type: 'goTo', index: -3 }).state.index).toBe(0);
    expect(run(state, { type: 'goTo', index: 1 }).state.furthest).toBe(4);
  });

  it('goTo the scene already shown is a no-op; non-numbers are ignored', () => {
    const start = initReader(6, 2, [null, null, null, null, null, null]);
    expect(reduceReader(start, { type: 'goTo', index: 2 })).toEqual({ state: start, effects: [] });
    expect(reduceReader(start, { type: 'goTo', index: Number.NaN })).toEqual({ state: start, effects: [] });
  });

  it('goTo the current scene from the end page or a checkpoint brings the scene back', () => {
    const atEnd = run(initReader(2, 1, [null, null]), { type: 'next' }).state;
    const back = reduceReader(atEnd, { type: 'goTo', index: 1 });
    expect(back.state.phase).toBe('scene');
    expect(back.effects).toEqual([{ type: 'scene-changed', index: 1, via: 'goTo' }]);
  });

  it('clears the open term and revealed romanization when the scene changes', () => {
    const base = run(initReader(6, 0, [null, null, null, null, null, null]), { type: 'tapTerm', id: 'a' }, { type: 'reveal', id: 'a' }).state;
    expect(base.openTerm).toBe('a');
    const moved = reduceReader(base, { type: 'goTo', index: 3 }).state;
    expect(moved.openTerm).toBeNull();
    expect(moved.revealed).toEqual([]);
  });
});

describe('terms and reveals', () => {
  const fresh = (): ReaderState => initReader(4, 0, [null, null, null, null]);

  it('tapTerm opens one gloss card; tapping the same chip again closes it; another chip swaps', () => {
    const a = reduceReader(fresh(), { type: 'tapTerm', id: 'sagwan' }).state;
    expect(a.openTerm).toBe('sagwan');
    expect(reduceReader(a, { type: 'tapTerm', id: 'sagwan' }).state.openTerm).toBeNull();
    expect(reduceReader(a, { type: 'tapTerm', id: 'wang' }).state.openTerm).toBe('wang');
  });

  it('closeTerm closes it and is harmless when nothing is open', () => {
    const open = reduceReader(fresh(), { type: 'tapTerm', id: 'a' }).state;
    expect(reduceReader(open, { type: 'closeTerm' }).state.openTerm).toBeNull();
    const closed = fresh();
    expect(reduceReader(closed, { type: 'closeTerm' }).state).toBe(closed);
  });

  it('reveal adds an id once and keeps earlier ones', () => {
    const s = run(fresh(), { type: 'reveal', id: 'a' }, { type: 'reveal', id: 'b' }, { type: 'reveal', id: 'a' }).state;
    expect(s.revealed).toEqual(['a', 'b']);
  });

  it('tapTerm and reveal do nothing on the end page', () => {
    const atEnd = run(initReader(1, 0, [null]), { type: 'next' }).state;
    expect(reduceReader(atEnd, { type: 'tapTerm', id: 'a' }).state).toBe(atEnd);
    expect(reduceReader(atEnd, { type: 'reveal', id: 'a' }).state).toBe(atEnd);
  });

  it('next and back clear the open term and the revealed list', () => {
    const open = run(fresh(), { type: 'tapTerm', id: 'a' }, { type: 'reveal', id: 'a' }).state;
    for (const type of ['next', 'back'] as const) {
      const from = type === 'back' ? run(open, { type: 'next' }, { type: 'tapTerm', id: 'b' }, { type: 'reveal', id: 'b' }).state : open;
      const after = reduceReader(from, { type }).state;
      expect(after.openTerm).toBeNull();
      expect(after.revealed).toEqual([]);
    }
  });

  it('a gloss card never survives into a checkpoint, but the scene reveals stay', () => {
    const s = initReader(3, 0, ['cp1', null, null]);
    const open = run(s, { type: 'tapTerm', id: 'a' }, { type: 'reveal', id: 'a' }, { type: 'next' }).state;
    expect(open.phase).toBe('checkpoint');
    expect(open.openTerm).toBeNull();
    expect(open.revealed).toEqual(['a']);
  });
});

describe('checkpoints', () => {
  const withCp = (): ReaderState => initReader(3, 0, ['cp1', null, 'cp2']);

  it('next on a scene with a checkpointId opens that checkpoint instead of moving on', () => {
    const { state, effects } = run(withCp(), { type: 'next' });
    expect(state).toMatchObject({ index: 0, phase: 'checkpoint', checkpointId: 'cp1' });
    expect(effects).toEqual([]);
  });

  it('next, Back and goTo do nothing further while a checkpoint is open except back to the scene', () => {
    const open = run(withCp(), { type: 'next' }).state;
    expect(reduceReader(open, { type: 'next' })).toEqual({ state: open, effects: [] });
    const back = reduceReader(open, { type: 'back' });
    expect(back.state).toMatchObject({ index: 0, phase: 'scene', checkpointId: null });
    expect(back.effects).toEqual([]);
  });

  it('a right answer reports the round, moves on, and lists scene-changed before answer', () => {
    const open = run(withCp(), { type: 'next' }).state;
    const { state, effects } = run(open, { type: 'resolveCheckpoint', correct: true });
    expect(state).toMatchObject({ index: 1, furthest: 1, phase: 'scene', checkpointId: null });
    expect(effects).toEqual([
      { type: 'scene-changed', index: 1, via: 'next' },
      { type: 'answer', roundKey: 'cp:cp1', correct: true },
    ]);
  });

  it('a wrong answer is reported (first answer counts) and the card stays open for another try', () => {
    const open = run(withCp(), { type: 'next' }).state;
    const { state, effects } = run(open, { type: 'resolveCheckpoint', correct: false });
    expect(state).toMatchObject({ index: 0, phase: 'checkpoint', checkpointId: 'cp1' });
    expect(effects).toEqual([{ type: 'answer', roundKey: 'cp:cp1', correct: false }]);
    const later = run(state, { type: 'resolveCheckpoint', correct: true });
    expect(later.state.index).toBe(1);
    expect(later.effects.map((e) => e.type)).toEqual(['scene-changed', 'answer']);
  });

  it('skip moves on and records nothing', () => {
    const open = run(withCp(), { type: 'next' }).state;
    const { state, effects } = run(open, { type: 'skipCheckpoint' });
    expect(state).toMatchObject({ index: 1, phase: 'scene' });
    expect(effects).toEqual([{ type: 'scene-changed', index: 1, via: 'next' }]);
  });

  it('a checkpoint on the last scene ends the story: answer, then finish-reading', () => {
    const open = run(initReader(2, 1, [null, 'cp9']), { type: 'next' }).state;
    expect(open.phase).toBe('checkpoint');
    const { state, effects } = run(open, { type: 'resolveCheckpoint', correct: true });
    expect(state).toMatchObject({ phase: 'end', index: 1 });
    expect(effects).toEqual([
      { type: 'answer', roundKey: 'cp:cp9', correct: true },
      { type: 'finish-reading' },
    ]);
    const skipped = run(open, { type: 'skipCheckpoint' });
    expect(skipped.state.phase).toBe('end');
    expect(skipped.effects).toEqual([{ type: 'finish-reading' }]);
  });

  it('an answered or skipped checkpoint is not asked again when the learner comes back through it', () => {
    const answered = run(withCp(), { type: 'next' }, { type: 'resolveCheckpoint', correct: true }, { type: 'back' }, { type: 'next' });
    expect(answered.state).toMatchObject({ index: 1, phase: 'scene' });
    const skipped = run(withCp(), { type: 'next' }, { type: 'skipCheckpoint' }, { type: 'back' }, { type: 'next' });
    expect(skipped.state).toMatchObject({ index: 1, phase: 'scene' });
  });

  it('resolve and skip outside a checkpoint do nothing', () => {
    const s = withCp();
    expect(reduceReader(s, { type: 'resolveCheckpoint', correct: true })).toEqual({ state: s, effects: [] });
    expect(reduceReader(s, { type: 'skipCheckpoint' })).toEqual({ state: s, effects: [] });
  });

  it('goTo leaves a checkpoint behind', () => {
    const open = run(withCp(), { type: 'next' }).state;
    const { state } = run(open, { type: 'goTo', index: 2 });
    expect(state).toMatchObject({ index: 2, phase: 'scene', checkpointId: null });
  });
});

describe('restart', () => {
  it('goes back to scene 0 with a clean slate but keeps the filled dots (a meter never drops)', () => {
    const atEnd = run(
      initReader(3, 0, ['cp1', null, null]),
      { type: 'next' },
      { type: 'skipCheckpoint' },
      { type: 'next' },
      { type: 'tapTerm', id: 'a' },
      { type: 'next' },
    ).state;
    expect(atEnd.phase).toBe('end');
    const { state, effects } = run(atEnd, { type: 'restart' });
    expect(state).toMatchObject({ index: 0, furthest: 2, phase: 'scene', checkpointId: null, openTerm: null, revealed: [], resolved: [] });
    expect(effects).toEqual([{ type: 'scene-changed', index: 0, via: 'restart' }]);
    // The checkpoint is part of a fresh read, so it asks again.
    expect(run(state, { type: 'next' }).state.phase).toBe('checkpoint');
  });
});
