import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
/** `read`: every read throws; `readOnce`: the first (cached) read throws and the fresh retry works; `parse`: the bytes do not parse. */
const fail = { write: false, read: false, readOnce: false, parse: false };
const reads = { cached: 0, fresh: 0 };
let stall: Promise<void> | null = null;
const readExact = async (k: string): Promise<unknown> => {
  if (stall) await stall;
  if (fail.parse) throw new SyntaxError('Unexpected token');
  return mem.get(k) ?? null;
};
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonExact: vi.fn(async (k: string) => {
    reads.cached += 1;
    if (fail.read || fail.readOnce) throw new Error('storage cannot be read');
    return readExact(k);
  }),
  readJsonExactFresh: vi.fn(async (k: string) => {
    reads.fresh += 1;
    if (fail.read) throw new Error('storage cannot be read on a fresh connection');
    return readExact(k);
  }),
  keepRawCopy: vi.fn(async () => true),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    if (fail.write) throw new Error('storage is full');
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
  listKeys: vi.fn(async () => [...mem.keys()]),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));

import { keepRawCopy } from '../../platform/storage';
import { track } from '../../platform/telemetry';
import { savedHangulCheck, resumableHangulCheck } from '../../logic/reviews/saved-check';
import { buildHangulCheck } from '../../logic/stage1/hangul-check';
import { CHECK_RUN_KEY, clearSavedCheck, keepReviewRunSaved, readSavedCheck, saveCheck, settleSavedChecksForTests } from '../check-run-saved';
import { notifyProfileRemoved } from '../profile-removal';
import { useProfileStore } from '../profile-store';
import { useReviewRunStore } from '../review-run-store';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (tests 17 and 21): the check a learner stopped or an interruption cut
 * short is kept per learner on this device (`hr:check-run:<profileId>`), after every answer (OD-LR9 (b)), and forgotten
 * with the learner.
 */
const SEED = 11;
const check = buildHangulCheck({ seed: SEED });
const ids = check.items.map((i) => i.id);
const START = '2026-11-24T10:00:00.000Z';
const context = { seed: SEED, startedAt: START };
const stored = (id: string): unknown => mem.get(CHECK_RUN_KEY(id)) ?? null;
const stops: Array<() => void> = [];
const keep = (profileId: string): void => void stops.push(keepReviewRunSaved(profileId, context));

beforeEach(async () => {
  await settleSavedChecksForTests(true);
  mem.clear();
  fail.write = false;
  fail.read = false;
  fail.readOnce = false;
  fail.parse = false;
  reads.cached = 0;
  reads.fresh = 0;
  stall = null;
  vi.mocked(track).mockClear();
  vi.mocked(keepRawCopy).mockClear();
  useReviewRunStore.getState().reset();
  useProfileStore.setState({ profiles: [], activeId: null });
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe('the key', () => {
  it('is per profile, with the id at its end (the removal sweep finds it)', () => {
    expect(CHECK_RUN_KEY('profile:jun00001')).toBe('check-run:profile:jun00001');
  });
});

describe('keepReviewRunSaved (OD-LR9 (b): stored after every answer)', () => {
  it('stores nothing for a run that has no answer yet, and the run after each answer', async () => {
    const run = useReviewRunStore.getState();
    run.begin(ids);
    keep('p1');
    await settleSavedChecksForTests();
    expect(stored('p1')).toBeNull();

    run.answer(ids[0]!, true);
    await settleSavedChecksForTests();
    expect(stored('p1')).toEqual(savedHangulCheck({ ...context, hideRomanization: true, items: ids, answers: { [ids[0]!]: { first: true, retries: 0 } } }));
    // Every Check holds its romanization (DC-1a): the stored shape keeps the field as the constant true.
    expect(stored('p1')).toMatchObject({ hideRomanization: true });

    run.answer(ids[1]!, false);
    run.answer(ids[1]!, true);
    await settleSavedChecksForTests();
    expect(stored('p1')).toMatchObject({ kind: 'hangul', seed: SEED, startedAt: START, answers: { [ids[0]!]: { first: true, retries: 0 }, [ids[1]!]: { first: false, retries: 1 } } });
  });

  it('what is stored is what resumes: the item after the last one answered, with the same answers', async () => {
    const run = useReviewRunStore.getState();
    run.begin(ids);
    keep('p1');
    for (const id of ids.slice(0, 9)) run.answer(id, true);
    await settleSavedChecksForTests();
    const out = resumableHangulCheck(await readSavedCheck('p1'), Date.parse(START) + 1000, (seed) => buildHangulCheck({ seed }));
    expect(out).toMatchObject({ seed: SEED, at: { chunk: 1, from: 2 } });
    expect(Object.keys(out?.answers ?? {})).toEqual(ids.slice(0, 9));
  });

  it('a reset (leaving) stores nothing and keeps what was stored, so a Stop goes on later', async () => {
    const run = useReviewRunStore.getState();
    run.begin(ids);
    keep('p1');
    run.answer(ids[0]!, true);
    await settleSavedChecksForTests();
    run.reset();
    await settleSavedChecksForTests();
    expect(stored('p1')).toMatchObject({ answers: { [ids[0]!]: { first: true, retries: 0 } } });
  });

  it('a run restored under a keeper stores the same answers again, and its next answer adds to them', async () => {
    keep('p1');
    useReviewRunStore.getState().restore(ids, { [ids[0]!]: { first: false, retries: 0 } });
    await settleSavedChecksForTests();
    expect(Object.keys((stored('p1') as { answers: object }).answers)).toEqual([ids[0]]);
    useReviewRunStore.getState().answer(ids[1]!, true);
    await settleSavedChecksForTests();
    expect(Object.keys((stored('p1') as { answers: object }).answers)).toEqual([ids[0], ids[1]]);
    expect(stored('p1')).toMatchObject({ startedAt: START });
  });

  it('a stopped keeper stores nothing', async () => {
    useReviewRunStore.getState().begin(ids);
    keep('p1');
    for (const stop of stops.splice(0)) stop();
    useReviewRunStore.getState().answer(ids[0]!, true);
    await settleSavedChecksForTests();
    expect(stored('p1')).toBeNull();
  });

  it('a failed write never stops the check', async () => {
    fail.write = true;
    useReviewRunStore.getState().begin(ids);
    keep('p1');
    expect(() => useReviewRunStore.getState().answer(ids[0]!, true)).not.toThrow();
    await settleSavedChecksForTests();
    expect(useReviewRunStore.getState().answers[ids[0]!]).toEqual({ first: true, retries: 0 });
    expect(stored('p1')).toBeNull();
  });
});

describe('clearSavedCheck', () => {
  it('a clear asked for right after a save lands after it (the result is recorded on the last answer)', async () => {
    useReviewRunStore.getState().begin(ids);
    keep('p1');
    useReviewRunStore.getState().answer(ids[0]!, true);
    void clearSavedCheck('p1');
    await settleSavedChecksForTests();
    expect(stored('p1')).toBeNull();
  });

  it('clears that learner only', async () => {
    const run = savedHangulCheck({ ...context, hideRomanization: true, items: ids, answers: { [ids[0]!]: { first: true, retries: 0 } } });
    await saveCheck('p1', run);
    await saveCheck('p2', run);
    await clearSavedCheck('p1');
    expect(stored('p1')).toBeNull();
    expect(stored('p2')).not.toBeNull();
  });

  it('a read asked right after a clear waits for it and reads nothing (Let us go forgets the stored check)', async () => {
    mem.set(CHECK_RUN_KEY('p1'), { v: 1, kind: 'hangul' });
    void clearSavedCheck('p1');
    expect(await readSavedCheck('p1')).toBeNull();
  });
});

describe('readSavedCheck', () => {
  it('nothing stored reads as null; a stored check reads as it is', async () => {
    expect(await readSavedCheck('p1')).toBeNull();
    mem.set(CHECK_RUN_KEY('p1'), { v: 1, kind: 'hangul' });
    expect(await readSavedCheck('p1')).toEqual({ v: 1, kind: 'hangul' });
  });

  it('a read that throws twice (the cached read and the fresh retry) answers null, asked exactly twice', async () => {
    fail.read = true;
    expect(await readSavedCheck('p1')).toBeNull();
    expect(reads).toEqual({ cached: 1, fresh: 1 });
  });

  it('a read that throws once and works on the fresh connection answers the check', async () => {
    mem.set(CHECK_RUN_KEY('p1'), { v: 1, kind: 'hangul' });
    fail.readOnce = true;
    expect(await readSavedCheck('p1')).toEqual({ v: 1, kind: 'hangul' });
    expect(reads).toEqual({ cached: 1, fresh: 1 });
  });

  it('bytes that do not parse answer null, are not read again and are not kept aside', async () => {
    mem.set(CHECK_RUN_KEY('p1'), { v: 1 });
    fail.parse = true;
    expect(await readSavedCheck('p1')).toBeNull();
    expect(reads).toEqual({ cached: 1, fresh: 0 });
    expect(keepRawCopy).not.toHaveBeenCalled();
  });

  it('a failed read touches nothing else: no telemetry', async () => {
    fail.read = true;
    await readSavedCheck('p1');
    fail.read = false;
    fail.parse = true;
    await readSavedCheck('p1');
    expect(track).not.toHaveBeenCalled();
  });

  it('a read that stalls answers null after the limit, and a read that lands later is handed to onLate (only when it found something)', async () => {
    let release: () => void = () => undefined;
    stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    mem.set(CHECK_RUN_KEY('p1'), { v: 1, kind: 'hangul' });
    const late = vi.fn();
    expect(await readSavedCheck('p1', { limitMs: 10, onLate: late })).toBeNull();
    expect(late).not.toHaveBeenCalled();
    release();
    await vi.waitFor(() => expect(late).toHaveBeenCalledWith({ v: 1, kind: 'hangul' }));
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('a late read of nothing, and a read inside the limit, never call onLate', async () => {
    const late = vi.fn();
    expect(await readSavedCheck('p1', { limitMs: 1000, onLate: late })).toBeNull();
    mem.set(CHECK_RUN_KEY('p1'), { v: 1 });
    expect(await readSavedCheck('p1', { limitMs: 1000, onLate: late })).toEqual({ v: 1 });
    let release: () => void = () => undefined;
    stall = new Promise<void>((resolve) => {
      release = resolve;
    });
    mem.delete(CHECK_RUN_KEY('p1'));
    expect(await readSavedCheck('p1', { limitMs: 10, onLate: late })).toBeNull();
    release();
    await settleSavedChecksForTests();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(late).not.toHaveBeenCalled();
  });
});

describe('a learner removed from this device', () => {
  const jun = { id: 'profile:jun00001', displayName: 'Jun', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, role: 'learner' as const, createdAt: '2026-10-01T00:00:00.000Z' };

  it('loses the stored check, and a save still on its way never writes it back', async () => {
    useProfileStore.setState({ profiles: [jun], activeId: jun.id });
    useReviewRunStore.getState().begin(ids);
    keep(jun.id);
    useReviewRunStore.getState().answer(ids[0]!, true);
    await settleSavedChecksForTests();
    expect(stored(jun.id)).not.toBeNull();

    useProfileStore.setState({ profiles: [], activeId: null });
    notifyProfileRemoved(jun.id);
    // The check is still mounted for a moment: its next answer must not store it again.
    useReviewRunStore.getState().answer(ids[1]!, true);
    await settleSavedChecksForTests();
    expect(stored(jun.id)).toBeNull();
  });

  it('a learner restored under the same id is saved again', async () => {
    notifyProfileRemoved(jun.id);
    useProfileStore.setState({ profiles: [jun], activeId: jun.id });
    useReviewRunStore.getState().begin(ids);
    keep(jun.id);
    useReviewRunStore.getState().answer(ids[0]!, true);
    await settleSavedChecksForTests();
    expect(stored(jun.id)).toMatchObject({ kind: 'hangul' });
  });
});
