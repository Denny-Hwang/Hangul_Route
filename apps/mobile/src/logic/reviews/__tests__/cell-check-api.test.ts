import type { ProgressSnapshot, ReviewEntry } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../../platform/telemetry';
import { emptyMemoryFile, type MemoryFile } from '../../memory/memory-file';
import type { MemoryAnswer } from '../../memory/memory-runtime';
import { INDEX } from '../../memory/__tests__/fixtures';
import { createCellCheckApi, type CellCheckDeps, type CheckWorld } from '../cell-check-api';
import type { RoundAnswer } from '../daily-review';

/**
 * F-CURR-002 row CM-21: the Cell Check's reads and writes over injected stores. The gate (`cellCheck` with
 * `memoryRecord`), a Cell Check recording each first answer as it comes, a test-out holding them to the end (a stopped
 * one writes nothing), the entry, the latch by mode and result, the derivation pass after a passed test-out, and the
 * telemetry.
 */

const NOW = new Date('2026-10-22T10:00:00.000Z');
const CELL = 'episode:stage2-letters';
/** A test-out needs a cell whose topic words are few (`testOutFits`): Stage 3 Food. */
const OUT = 'episode:stage3-life';

interface Fake {
  deps: CellCheckDeps;
  file: MemoryFile;
  reviews: ReviewEntry[];
  recorded: MemoryAnswer[][];
  testOuts: Array<{ answers: readonly MemoryAnswer[]; passed: boolean }>;
  cell: { stage: string; open: boolean[]; started: boolean } | null;
  latches: Array<{ field: string; cellId: string; at: string }>;
  events: TelemetryEvent[];
  seeded: number;
}

function fake(over: Partial<CellCheckDeps> = {}): Fake {
  const out: Fake = { file: emptyMemoryFile(), reviews: [], recorded: [], testOuts: [], cell: { stage: 'stage3', open: [true, true, true], started: false }, latches: [], events: [], seeded: 0, deps: {} as CellCheckDeps };
  out.deps = {
    file: async () => out.file,
    ensureSeeded: async () => {
      out.seeded += 1;
    },
    items: async () => INDEX,
    on: () => true,
    visibility: () => ({ volumes: true, topicPacks: true }),
    voice: () => true,
    hydrate: async () => undefined,
    snapshot: () => ({ vocab: undefined }) as unknown as ProgressSnapshot,
    recordReview: (_p, entry) => void out.reviews.push(entry),
    recordAnswers: async (_p, answers) => void out.recorded.push([...answers]),
    recordTestOut: async (_p, answers, passed) => void out.testOuts.push({ answers, passed }),
    testOutCell: () => out.cell,
    serverTime: () => null,
    latch: (_p, field, cellId, at) => void out.latches.push({ field, cellId, at }),
    track: (e) => void out.events.push(e),
    overlays: () => ({}),
    ensureCell: async () => undefined,
    ...over,
  };
  return out;
}

async function world(f: Fake): Promise<CheckWorld> {
  const read = await createCellCheckApi(f.deps).readWorld('p1', NOW);
  if (read.kind !== 'ready') throw new Error(read.kind);
  return read.world;
}

const all = (n: number, right: number): Map<number, RoundAnswer> => new Map(Array.from({ length: n }, (_, i) => [i, { correct: i < right }]));

describe('the gate and the reads', () => {
  it('off for a profile without cellCheck and memoryRecord, or no profile; unreadable when the store cannot be read', async () => {
    expect(await createCellCheckApi(fake({ on: () => false }).deps).readWorld('p1')).toEqual({ kind: 'off' });
    expect(await createCellCheckApi(fake().deps).readWorld(null)).toEqual({ kind: 'off' });
    expect(await createCellCheckApi(fake({ file: async () => null }).deps).readWorld('p1')).toEqual({ kind: 'unreadable' });
    expect(await createCellCheckApi(fake({ items: async () => Promise.reject(new Error('offline')) }).deps).readWorld('p1')).toEqual({ kind: 'unreadable' });
  });

  it('offerable: a cell with 5 or more playable rounds; Test out only where topic words are few; never while off; a Stage 5 book never', async () => {
    const api = createCellCheckApi(fake().deps);
    // Stage 2 Letters: 46 of its 89 items are topic words, so a Check and no Test out.
    expect(await api.offerable('p1', CELL)).toEqual({ check: true, testOut: false });
    expect(await api.offerable('p1', OUT)).toEqual({ check: true, testOut: true });
    expect(await api.offerable('p1', 'episode:stage2-nature')).toEqual({ check: true, testOut: false });
    expect(await api.offerable('p1', 'episode:stage5-life')).toEqual({ check: false, testOut: false });
    expect(await createCellCheckApi(fake({ on: () => false }).deps).offerable('p1', CELL)).toEqual({ check: false, testOut: false });
  });
});

describe('a Cell Check', () => {
  it('records each first answer as it comes; a 3-star finish writes the entry and latches cellCheckAt, with review.* events', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = await api.startSession(w, CELL, 'check', 'en');
    expect(plan?.rounds).toHaveLength(10);
    // review.start waits for Let's go: an intro left with Maybe later sends nothing.
    expect(f.events).toEqual([]);
    api.started(w);
    expect(f.events).toEqual([{ name: 'review.start', profileId: 'p1', payload: { kind: 'cell-check' } }]);
    const answers = all(10, 9);
    const recorded = [...answers].map(([i, a]) => api.recordRound(w, plan!, i, a));
    expect(f.recorded).toHaveLength(10);
    const done = await api.finishSession(w, plan!, answers, recorded, NOW);
    expect(done).toEqual({ stars: 3, passed: true });
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]).toMatchObject({ id: `cell-check:${CELL}`, kind: 'cell-check', scope: CELL, resultStars: 3, generatedAt: NOW.toISOString() });
    expect(f.reviews[0]?.id).not.toContain('p1');
    expect(f.latches).toEqual([{ field: 'cellCheckAt', cellId: CELL, at: NOW.toISOString() }]);
    expect(f.testOuts).toEqual([]);
    expect(f.events.at(-1)).toEqual({ name: 'review.complete', profileId: 'p1', payload: { kind: 'cell-check', stars: 3 } });
    expect(f.events.some((e) => e.name === 'testout.finished')).toBe(false);
  });

  it('under 3 stars: the entry, no latch', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, CELL, 'check', 'en'))!;
    expect(await api.finishSession(w, plan, all(10, 6), [], NOW)).toEqual({ stars: 2, passed: false });
    expect(f.reviews).toHaveLength(1);
    expect(f.latches).toEqual([]);
  });

  it('the switch turned off while it played (memoryRecord or cellCheck killed): nothing written, no event, null', async () => {
    let on = true;
    const f = fake({ on: () => on });
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, CELL, 'check', 'en'))!;
    on = false;
    expect(await api.finishSession(w, plan, all(10, 10), [], NOW)).toBeNull();
    expect(f.reviews).toEqual([]);
    expect(f.latches).toEqual([]);
    expect(f.events).toEqual([]);
  });

  it('a device clock far ahead: the entry and the latch carry the guarded stamp (CM-12 stampOf), never the raw clock', async () => {
    const f = fake({ serverTime: () => '2026-10-22T09:00:00.000Z' });
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, CELL, 'check', 'en'))!;
    const ahead = new Date('2027-03-01T10:00:00.000Z');
    await api.finishSession(w, plan, all(10, 10), [], ahead);
    // The server's time plus the one-day cap.
    expect(f.latches).toEqual([{ field: 'cellCheckAt', cellId: CELL, at: '2026-10-23T09:00:00.000Z' }]);
    expect(f.reviews[0]?.generatedAt).toBe('2026-10-23T09:00:00.000Z');
  });
});

describe('a test-out', () => {
  it('holds every answer until the end: a stopped test-out writes nothing', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, OUT, 'testout', 'en'))!;
    await api.recordRound(w, plan, 0, { correct: true });
    await api.recordRound(w, plan, 1, { correct: false });
    // The learner stops here: no finish.
    expect(f.recorded).toEqual([]);
    expect(f.testOuts).toEqual([]);
    expect(f.reviews).toEqual([]);
    expect(f.latches).toEqual([]);
  });

  it('a pass places the asked items, latches testedOut (never cellCheckAt), lays the unasked items and sends testout.finished', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const seededBefore = f.seeded;
    const plan = (await api.startSession(w, OUT, 'testout', 'en'))!;
    const done = await api.finishSession(w, plan, all(10, 8), [], NOW);
    expect(done).toEqual({ stars: 3, passed: true });
    expect(f.testOuts).toHaveLength(1);
    expect(f.testOuts[0]?.passed).toBe(true);
    expect(f.testOuts[0]?.answers).toHaveLength(10);
    expect(f.latches).toEqual([{ field: 'testedOut', cellId: OUT, at: NOW.toISOString() }]);
    expect(f.seeded).toBe(seededBefore + 1);
    expect(f.events).toContainEqual({ name: 'testout.finished', profileId: 'p1', payload: { cellId: OUT, passed: true, items: 10, firstTryCorrect: 8 } });
    expect(f.reviews[0]).toMatchObject({ kind: 'cell-check', scope: OUT });
  });

  it('not passed: the answers still go to the store (right ones to box 2 there), nothing latches', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, OUT, 'testout', 'en'))!;
    expect(await api.finishSession(w, plan, all(10, 5), [], NOW)).toEqual({ stars: 2, passed: false });
    expect(f.testOuts[0]?.passed).toBe(false);
    expect(f.latches).toEqual([]);
    expect(f.events).toContainEqual({ name: 'testout.finished', profileId: 'p1', payload: { cellId: OUT, passed: false, items: 10, firstTryCorrect: 5 } });
  });

  it('no plan for a cell that may not take a test-out now: locked, started, Stage 1, unknown, or mostly topic words', async () => {
    for (const cell of [
      { stage: 'stage3', open: [true, false, true], started: false },
      { stage: 'stage3', open: [true, true, true], started: true },
      { stage: 'stage1', open: [true, true, true], started: false },
      null,
    ]) {
      const f = fake();
      f.cell = cell;
      const api = createCellCheckApi(f.deps);
      expect(await api.startSession(await world(f), OUT, 'testout', 'en'), JSON.stringify(cell)).toBeNull();
    }
    const f = fake();
    const api = createCellCheckApi(f.deps);
    expect(await api.startSession(await world(f), 'episode:stage2-nature', 'testout', 'en')).toBeNull();
    // The Check of the same cell still plays.
    expect(await api.startSession(await world(f), 'episode:stage2-nature', 'check', 'en')).not.toBeNull();
  });

  it('a plan that lapsed while it played (the cell locked at the finish): nothing placed, nothing latched, null', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, OUT, 'testout', 'en'))!;
    f.cell = { stage: 'stage3', open: [false, false, false], started: false };
    expect(await api.finishSession(w, plan, all(10, 10), [], NOW)).toBeNull();
    expect(f.testOuts).toEqual([]);
    expect(f.latches).toEqual([]);
    expect(f.reviews).toEqual([]);
    expect(f.events.some((e) => e.name === 'testout.finished')).toBe(false);
  });
});

describe('in Spanish or Korean', () => {
  it('loads the lesson chunks first; an item none of whose chunks loads is skipped, never shown in English', async () => {
    const asked: string[] = [];
    const f = fake({ ensureCell: async (cell) => void asked.push(cell) });
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    await api.startSession(w, CELL, 'check', 'es');
    expect(asked).toContain(CELL);
    const offline = fake({ ensureCell: async () => Promise.reject(new Error('offline')) });
    const api2 = createCellCheckApi(offline.deps);
    const plan = await api2.startSession(await world(offline), CELL, 'check', 'ko');
    // Every lesson item of the cell is in the unloadable chunk: what is left are topic words, or no Check at all.
    for (const r of plan?.rounds ?? []) expect(r.question.itemId.startsWith('vocab:'), JSON.stringify(INDEX.byId.get(r.question.itemId)?.cells)).toBe(true);
  });
});
