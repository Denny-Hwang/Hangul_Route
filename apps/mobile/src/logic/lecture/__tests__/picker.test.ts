import { describe, expect, it } from 'vitest';
import { createPicker, reducePicker, type PickerEvent, type PickerState, type Rng } from '../picker';

/** A seeded LCG, so every shuffle in these tests replays. */
function seeded(seed = 7): Rng {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const NAMES = ['Mina', 'Jun', 'Ana', 'Léa', '하늘'];
const play = (state: PickerState, events: PickerEvent[], rng: Rng): PickerState =>
  events.reduce((s, e) => reducePicker(s, e, rng), state);

describe('createPicker (F-TCH-004 §3.5, TD5)', () => {
  it('uses the in-memory labels for names and initials', () => {
    const p = createPicker({ mode: 'names', count: 5, labels: NAMES }, seeded());
    expect(p.mode).toBe('names');
    expect([...p.bag].sort()).toEqual([...NAMES].sort());
    expect(p).toMatchObject({ current: null, phase: 'ready' });
    const i = createPicker({ mode: 'initials', count: 2, labels: ['M. K.', 'J.'] }, seeded());
    expect(i.mode).toBe('initials');
    expect([...i.bag].sort()).toEqual(['J.', 'M. K.']);
  });

  it('numbers mode draws 1..count', () => {
    const p = createPicker({ mode: 'numbers', count: 12 }, seeded());
    expect(p.mode).toBe('numbers');
    expect([...p.bag].map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('degrades to numbers when no labels arrived (a copied link, a resumed lesson, an empty list)', () => {
    for (const labels of [undefined, null, []]) {
      const p = createPicker({ mode: 'names', count: 3, labels }, seeded());
      expect(p.mode).toBe('numbers');
      expect([...p.bag].sort()).toEqual(['1', '2', '3']);
    }
  });

  it('numbers mode ignores labels even if some are passed', () => {
    expect([...createPicker({ mode: 'numbers', count: 2, labels: NAMES }, seeded()).bag].sort()).toEqual(['1', '2']);
  });

  it('a count outside 0..60 is clamped; zero gives an empty bag', () => {
    expect(createPicker({ mode: 'numbers', count: 500 }, seeded()).bag).toHaveLength(60);
    expect(createPicker({ mode: 'numbers', count: -3 }, seeded()).bag).toHaveLength(0);
    expect(createPicker({ mode: 'numbers', count: 2.9 }, seeded()).bag).toHaveLength(2);
  });

  it('the shuffle comes only from the injected rng (same rng, same order; different rng, different order)', () => {
    const a = createPicker({ mode: 'numbers', count: 20 }, seeded(1));
    const b = createPicker({ mode: 'numbers', count: 20 }, seeded(1));
    const c = createPicker({ mode: 'numbers', count: 20 }, seeded(2));
    expect(a.bag).toEqual(b.bag);
    expect(a.bag).not.toEqual(c.bag);
  });

  it('keeps nothing about a learner beyond the bag: no counts, no history, no scores', () => {
    const p = play(createPicker({ mode: 'names', count: 5, labels: NAMES }, seeded()), ['draw', 'draw', 'skip', 'undo'], seeded());
    expect(Object.keys(p).sort()).toEqual(['bag', 'current', 'mode', 'phase', 'pool']);
  });
});

describe('reducePicker', () => {
  it('draws without replacement: no label repeats until the bag is empty, then "everyone has had a turn"', () => {
    const rng = seeded(3);
    let p = createPicker({ mode: 'names', count: 5, labels: NAMES }, rng);
    const drawn: string[] = [];
    for (let i = 0; i < NAMES.length; i++) {
      p = reducePicker(p, 'draw', rng);
      expect(p.phase).toBe('drawn');
      drawn.push(p.current!);
    }
    expect([...drawn].sort()).toEqual([...NAMES].sort());
    p = reducePicker(p, 'draw', rng);
    expect(p).toMatchObject({ phase: 'empty', current: null, bag: [] });
    // Drawing again from an empty bag stays empty.
    expect(reducePicker(p, 'draw', rng)).toEqual(p);
  });

  it('undo returns the last label to the bag and clears the result', () => {
    const rng = seeded(4);
    const drawn = play(createPicker({ mode: 'numbers', count: 3 }, rng), ['draw'], rng);
    const label = drawn.current!;
    const undone = reducePicker(drawn, 'undo', rng);
    expect(undone).toMatchObject({ current: null, phase: 'ready' });
    expect(undone.bag).toContain(label);
    expect(undone.bag).toHaveLength(3);
  });

  it('undo with nothing drawn does nothing', () => {
    const rng = seeded();
    const p = createPicker({ mode: 'numbers', count: 3 }, rng);
    expect(reducePicker(p, 'undo', rng)).toEqual(p);
  });

  it('skip puts the label back and draws a different one, giving no reason', () => {
    const rng = seeded(5);
    const drawn = play(createPicker({ mode: 'names', count: 5, labels: NAMES }, rng), ['draw'], rng);
    const first = drawn.current!;
    const skipped = reducePicker(drawn, 'skip', rng);
    expect(skipped.phase).toBe('drawn');
    expect(skipped.current).not.toBe(first);
    expect(skipped.bag).toContain(first);
    expect(skipped.bag).toHaveLength(NAMES.length - 1);
  });

  it('skip with nobody else left keeps the result; skip with nothing drawn does nothing', () => {
    const rng = seeded(6);
    const last = play(createPicker({ mode: 'numbers', count: 1 }, rng), ['draw'], rng);
    expect(reducePicker(last, 'skip', rng)).toEqual(last);
    const fresh = createPicker({ mode: 'numbers', count: 3 }, rng);
    expect(reducePicker(fresh, 'skip', rng)).toEqual(fresh);
  });

  it('reset starts a new full bag', () => {
    const rng = seeded(8);
    const empty = play(createPicker({ mode: 'numbers', count: 2 }, rng), ['draw', 'draw', 'draw'], rng);
    expect(empty.phase).toBe('empty');
    const again = reducePicker(empty, 'reset', rng);
    expect(again).toMatchObject({ phase: 'ready', current: null, mode: 'numbers' });
    expect([...again.bag].sort()).toEqual(['1', '2']);
  });

  it('an empty pool goes straight to "everyone has had a turn"', () => {
    const rng = seeded();
    expect(reducePicker(createPicker({ mode: 'numbers', count: 0 }, rng), 'draw', rng).phase).toBe('empty');
  });

  it('copes with an rng that returns exactly 1 or a negative number', () => {
    const p = createPicker({ mode: 'numbers', count: 4 }, () => 1);
    expect([...p.bag].sort()).toEqual(['1', '2', '3', '4']);
    const drawn = reducePicker(p, 'draw', () => -0.5);
    expect(reducePicker(drawn, 'undo', () => 1).bag).toHaveLength(4);
  });

  it('never mutates the state it was given', () => {
    const rng = seeded(9);
    const p = createPicker({ mode: 'names', count: 5, labels: NAMES }, rng);
    const snapshot = JSON.stringify(p);
    play(p, ['draw', 'skip', 'undo', 'draw', 'reset'], rng);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});
