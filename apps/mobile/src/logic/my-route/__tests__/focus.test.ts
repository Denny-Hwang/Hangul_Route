import { describe, expect, it } from 'vitest';
import { focusEffects, seenForView, seenReadAfter, type FocusState } from '../focus';
import type { SeenRecord } from '../types';

/**
 * The Route tab's per-focus effects (AMENDMENTS-ROUTE-LEARNING-ROUTE sections
 * 5.1 and 8): `route_map.viewed` once per focus, the seen record read again on
 * every focus and written only after that focus's read, and nothing at all from
 * the read-only grown-up screen.
 */
const base: FocusState = { focusKey: 1, viewedFor: 0, seenFor: 0, seenWrittenFor: 0, readOnly: false, modelReady: true };

/** Plays the screen's effect: applies the decision to the refs the way MyRouteBody does. */
function run(state: FocusState): { state: FocusState; sent: number; written: number } {
  const fx = focusEffects(state);
  return {
    state: {
      ...state,
      viewedFor: fx.sendViewed ? state.focusKey : state.viewedFor,
      seenWrittenFor: fx.writeSeen ? state.focusKey : state.seenWrittenFor,
    },
    sent: fx.sendViewed ? 1 : 0,
    written: fx.writeSeen ? 1 : 0,
  };
}

describe('focusEffects: route_map.viewed once per focus', () => {
  it('two focuses send two events', () => {
    let sent = 0;
    let s = run(base);
    sent += s.sent;
    s = run({ ...s.state, focusKey: 2 });
    sent += s.sent;
    expect(sent).toBe(2);
  });

  it('a re-render or a model change within one focus sends nothing more', () => {
    const first = run(base);
    expect(first.sent).toBe(1);
    // The same focus again (a new model, a re-render): the effect runs again with the same focus key.
    expect(run(first.state).sent).toBe(0);
    expect(run(run(first.state).state).sent).toBe(0);
  });

  it('nothing before the first focus or before the model is built', () => {
    expect(focusEffects({ ...base, focusKey: 0 })).toEqual({ sendViewed: false, writeSeen: false });
    expect(focusEffects({ ...base, seenFor: 1, modelReady: false })).toEqual({ sendViewed: false, writeSeen: false });
  });
});

describe('focusEffects: the seen record', () => {
  it('is not written before this focus has read it', () => {
    expect(focusEffects({ ...base, seenFor: 0 }).writeSeen).toBe(false);
    // The read of the previous focus does not count for this one.
    expect(focusEffects({ ...base, focusKey: 2, viewedFor: 1, seenFor: 1, seenWrittenFor: 1 }).writeSeen).toBe(false);
  });

  it('is written once, after the read of this focus resolves', () => {
    const beforeRead = run(base);
    expect(beforeRead.written).toBe(0);
    const afterRead = run({ ...beforeRead.state, seenFor: 1 });
    expect(afterRead.written).toBe(1);
    expect(afterRead.sent).toBe(0);
    expect(run(afterRead.state).written).toBe(0);
  });

  it('is written again on the next focus, after that focus reads it', () => {
    const one = run({ ...base, seenFor: 1 });
    const two = run({ ...one.state, focusKey: 2 });
    expect(two.written).toBe(0);
    expect(run({ ...two.state, seenFor: 2 }).written).toBe(1);
  });
});

describe('focusEffects: the read-only grown-up screen', () => {
  it('sends no event and writes nothing, on any focus', () => {
    for (const focusKey of [1, 2, 3]) {
      expect(focusEffects({ ...base, readOnly: true, focusKey, seenFor: focusKey })).toEqual({ sendViewed: false, writeSeen: false });
    }
  });
});

/** A promise the test resolves or rejects by hand. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const record = (at: string): SeenRecord => ({ totals: {}, doneKeys: [], at });

describe('seenReadAfter: each focus reads the record only after the previous focus wrote it', () => {
  it('waits for the pending write before it reads, then returns the record', async () => {
    const write = deferred<unknown>();
    const reads: string[] = [];
    const read = async (): Promise<SeenRecord | undefined> => {
      reads.push('read');
      return record('written-by-focus-1');
    };
    const result = seenReadAfter(write.promise, read, () => true);
    await flush();
    expect(reads).toEqual([]);
    write.resolve(true);
    await expect(result).resolves.toEqual({ record: record('written-by-focus-1') });
    expect(reads).toEqual(['read']);
  });

  it('a read superseded by a newer focus resolves to null, so the screen ignores it', async () => {
    const write = deferred<unknown>();
    let live = true;
    const result = seenReadAfter(write.promise, async () => record('stale'), () => live);
    // Focus 2 starts before focus 1's write lands: focus 1's read is cancelled.
    live = false;
    write.resolve(true);
    await expect(result).resolves.toBeNull();
  });

  it('a superseded focus does not read at all', async () => {
    let reads = 0;
    const result = seenReadAfter(Promise.resolve(), async () => {
      reads += 1;
      return undefined;
    }, () => false);
    await expect(result).resolves.toBeNull();
    expect(reads).toBe(0);
  });

  it('a failed write still lets the next focus read', async () => {
    const write = deferred<unknown>();
    const result = seenReadAfter(write.promise, async () => record('kept'), () => true);
    write.reject(new Error('storage full'));
    await expect(result).resolves.toEqual({ record: record('kept') });
  });

  it('an empty record (first open on this device) is a result, not a cancel', async () => {
    await expect(seenReadAfter(Promise.resolve(), async () => undefined, () => true)).resolves.toEqual({ record: undefined });
  });
});

describe('seenForView: the view compares against this open only', () => {
  const seen = record('focus-1');

  it('uses the record once this focus has read it, while the tab is in front', () => {
    expect(seenForView({ focusKey: 2, seenFor: 2, focused: true, seen })).toBe(seen);
  });

  it('shows nothing new between a focus and its read (no stale "new" from the previous open)', () => {
    expect(seenForView({ focusKey: 2, seenFor: 1, focused: true, seen })).toBeUndefined();
  });

  it('shows nothing new while the tab is behind another screen, so the one-time fill never plays unseen', () => {
    expect(seenForView({ focusKey: 2, seenFor: 2, focused: false, seen })).toBeUndefined();
  });

  it('shows nothing before the first focus', () => {
    expect(seenForView({ focusKey: 0, seenFor: 0, focused: false, seen })).toBeUndefined();
  });
});
