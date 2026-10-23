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

interface Fake {
  deps: CellCheckDeps;
  file: MemoryFile;
  reviews: ReviewEntry[];
  recorded: MemoryAnswer[][];
  testOuts: Array<{ answers: readonly MemoryAnswer[]; passed: boolean }>;
  latches: Array<{ field: string; cellId: string; at: string }>;
  events: TelemetryEvent[];
  seeded: number;
}

function fake(over: Partial<CellCheckDeps> = {}): Fake {
  const out: Fake = { file: emptyMemoryFile(), reviews: [], recorded: [], testOuts: [], latches: [], events: [], seeded: 0, deps: {} as CellCheckDeps };
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
    latch: (_p, field, cellId, at) => void out.latches.push({ field, cellId, at }),
    track: (e) => void out.events.push(e),
    overlays: () => ({}),
    ensureCell: async () => undefined,
    random: () => 0.5,
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

  it('offerable: a cell with 5 or more playable rounds; never while off; a Stage 5 book (no review items) never', async () => {
    const api = createCellCheckApi(fake().deps);
    expect(await api.offerable('p1', CELL)).toBe(true);
    expect(await api.offerable('p1', 'episode:stage5-life')).toBe(false);
    expect(await createCellCheckApi(fake({ on: () => false }).deps).offerable('p1', CELL)).toBe(false);
  });
});

describe('a Cell Check', () => {
  it('records each first answer as it comes; a 3-star finish writes the entry and latches cellCheckAt, with review.* events', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = await api.startSession(w, CELL, 'check', 'en');
    expect(plan?.rounds).toHaveLength(10);
    expect(f.events).toEqual([{ name: 'review.start', profileId: 'p1', payload: { kind: 'cell-check' } }]);
    const answers = all(10, 9);
    const recorded = [...answers].map(([i, a]) => api.recordRound(w, plan!, i, a));
    expect(f.recorded).toHaveLength(10);
    const done = await api.finishSession(w, plan!, answers, recorded, NOW);
    expect(done).toEqual({ stars: 3, passed: true });
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]).toMatchObject({ kind: 'cell-check', scope: CELL, resultStars: 3, generatedAt: NOW.toISOString() });
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
});

describe('a test-out', () => {
  it('holds every answer until the end: a stopped test-out writes nothing', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, CELL, 'testout', 'en'))!;
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
    const plan = (await api.startSession(w, CELL, 'testout', 'en'))!;
    const done = await api.finishSession(w, plan, all(10, 8), [], NOW);
    expect(done).toEqual({ stars: 3, passed: true });
    expect(f.testOuts).toHaveLength(1);
    expect(f.testOuts[0]?.passed).toBe(true);
    expect(f.testOuts[0]?.answers).toHaveLength(10);
    expect(f.latches).toEqual([{ field: 'testedOut', cellId: CELL, at: NOW.toISOString() }]);
    expect(f.seeded).toBe(seededBefore + 1);
    expect(f.events).toContainEqual({ name: 'testout.finished', profileId: 'p1', payload: { cellId: CELL, passed: true, items: 10, firstTryCorrect: 8 } });
    expect(f.reviews[0]).toMatchObject({ kind: 'cell-check', scope: CELL });
  });

  it('not passed: the answers still go to the store (right ones to box 2 there), nothing latches', async () => {
    const f = fake();
    const api = createCellCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, CELL, 'testout', 'en'))!;
    expect(await api.finishSession(w, plan, all(10, 5), [], NOW)).toEqual({ stars: 2, passed: false });
    expect(f.testOuts[0]?.passed).toBe(false);
    expect(f.latches).toEqual([]);
    expect(f.events).toContainEqual({ name: 'testout.finished', profileId: 'p1', payload: { cellId: CELL, passed: false, items: 10, firstTryCorrect: 5 } });
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
