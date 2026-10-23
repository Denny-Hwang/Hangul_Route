import type { ProgressSnapshot, ReviewEntry, StageKey } from '@hangul-route/content-schema';
import { mergeReview } from '../../sync/merge';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content';
import type { TelemetryEvent } from '../../../platform/telemetry';
import { emptyMemoryFile, type MemoryFile } from '../../memory/memory-file';
import type { MemoryAnswer } from '../../memory/memory-runtime';
import { INDEX } from '../../memory/__tests__/fixtures';
import { gridEpisodesOf } from '../../my-route/order';
import type { RoundAnswer } from '../daily-review';
import { createStageCheckApi, type StageCheckDeps, type StageCheckWorld } from '../stage-check-api';

/**
 * F-CURR-002 row CM-22: the Stage Check's reads and writes over injected stores. The gate (`stageChecks` with
 * `memoryRecord`), each first answer recorded as it comes (a stopped check keeps them and writes nothing else), the
 * `stage-certificate` entry, the `stageCheckAt` latch at 3 stars only, and `review.start` / `review.complete`.
 */

const NOW = new Date('2026-10-22T10:00:00.000Z');
const cellsOf = (stage: StageKey): string[] => gridEpisodesOf(episodesAll).filter((e) => e.stage === stage).map((e) => e.id);

interface Fake {
  deps: StageCheckDeps;
  file: MemoryFile;
  reviews: ReviewEntry[];
  recorded: MemoryAnswer[][];
  latches: Array<{ stage: StageKey; at: string }>;
  events: TelemetryEvent[];
}

function fake(over: Partial<StageCheckDeps> = {}): Fake {
  const out: Fake = { file: emptyMemoryFile(), reviews: [], recorded: [], latches: [], events: [], deps: {} as StageCheckDeps };
  out.deps = {
    file: async () => out.file,
    ensureSeeded: async () => undefined,
    items: async () => INDEX,
    on: () => true,
    cells: cellsOf,
    visibility: () => ({ volumes: true, topicPacks: true }),
    voice: () => true,
    hydrate: async () => undefined,
    snapshot: () => ({ vocab: undefined }) as unknown as ProgressSnapshot,
    // As the store: an entry with an id already held merges into it (`mergeReview`).
    recordReview: (_p, entry) => {
      const i = out.reviews.findIndex((r) => r.id === entry.id);
      if (i < 0) out.reviews.push(entry);
      else out.reviews[i] = mergeReview(out.reviews[i] as ReviewEntry, entry);
    },
    recordAnswers: async (_p, answers) => void out.recorded.push([...answers]),
    latch: (_p, stage, at) => void out.latches.push({ stage, at }),
    stageOpen: () => true,
    serverTime: () => null,
    track: (e) => void out.events.push(e),
    overlays: () => ({}),
    ensureCell: async () => undefined,
    ...over,
  };
  return out;
}

async function world(f: Fake): Promise<StageCheckWorld> {
  const read = await createStageCheckApi(f.deps).readWorld('p1', NOW);
  if (read.kind !== 'ready') throw new Error(read.kind);
  return read.world;
}

const all = (n: number, right: number): Map<number, RoundAnswer> => new Map(Array.from({ length: n }, (_, i) => [i, { correct: i < right }]));

describe('the gate and the reads', () => {
  it('off for a profile without stageChecks and memoryRecord, or no profile; unreadable when the store cannot be read', async () => {
    expect(await createStageCheckApi(fake({ on: () => false }).deps).readWorld('p1')).toEqual({ kind: 'off' });
    expect(await createStageCheckApi(fake().deps).readWorld(null)).toEqual({ kind: 'off' });
    expect(await createStageCheckApi(fake({ file: async () => null }).deps).readWorld('p1')).toEqual({ kind: 'unreadable' });
    expect(await createStageCheckApi(fake({ items: async () => Promise.reject(new Error('offline')) }).deps).readWorld('p1')).toEqual({ kind: 'unreadable' });
  });

  it('offerable: a stage with 10 or more playable rounds; never while off (memoryRecord turned off remotely too); Stage 5 never', async () => {
    const api = createStageCheckApi(fake().deps);
    expect(await api.offerable('p1', 'stage2')).toBe(true);
    expect(await api.offerable('p1', 'stage5')).toBe(false);
    expect(await createStageCheckApi(fake({ on: () => false }).deps).offerable('p1', 'stage2')).toBe(false);
    expect(await api.offerable(null, 'stage2')).toBe(false);
  });

  it('offerable reads the store once for every stage asked together, and once per stage and day after that', async () => {
    let reads = 0;
    const f = fake({ file: async () => ((reads += 1), emptyMemoryFile()) });
    const api = createStageCheckApi(f.deps);
    const stages: StageKey[] = ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'];
    expect(await Promise.all(stages.map((s) => api.offerable('p1', s)))).toEqual([true, true, true, true, true]);
    expect(await Promise.all(stages.map((s) => api.offerable('p1', s)))).toEqual([true, true, true, true, true]);
    expect(reads).toBe(1);
  });

  it('an unreadable store is not kept: the next ask reads it again', async () => {
    let readable = false;
    const f = fake({ file: async () => (readable ? emptyMemoryFile() : null) });
    const api = createStageCheckApi(f.deps);
    expect(await api.offerable('p1', 'stage2')).toBe(false);
    await Promise.resolve();
    readable = true;
    expect(await api.offerable('p1', 'stage2')).toBe(true);
  });
});

describe('a Stage Check', () => {
  it('review.start when the learner starts; each first answer recorded as it comes; a 3-star finish writes the entry and latches stageCheckAt', async () => {
    const f = fake();
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    expect(plan.rounds).toHaveLength(20);
    expect(f.events).toEqual([]);
    api.begin(w, plan, false);
    expect(f.events).toEqual([{ name: 'review.start', profileId: 'p1', payload: { kind: 'stage-certificate', stageKey: 'stage2', hideRomanization: false } }]);
    const answers = all(20, 17);
    const recorded = [...answers].map(([i, a]) => api.recordRound(w, plan, i, a));
    expect(f.recorded).toHaveLength(20);
    const done = await api.finishSession(w, plan, answers, recorded, NOW);
    expect(done).toEqual({ stars: 3, passed: true, missed: true });
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]).toMatchObject({ kind: 'stage-certificate', scope: 'stage2', resultStars: 3, generatedAt: NOW.toISOString() });
    expect(f.reviews[0]?.id).not.toContain('p1');
    expect(f.latches).toEqual([{ stage: 'stage2', at: NOW.toISOString() }]);
    expect(f.events.at(-1)).toEqual({ name: 'review.complete', profileId: 'p1', payload: { kind: 'stage-certificate', stageKey: 'stage2', stars: 3 } });
  });

  it('under 3 stars: the entry and the stars, no latch; a retake merges into the same entry, keeping the best stars', async () => {
    const f = fake();
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage3', 'en'))!;
    expect(await api.finishSession(w, plan, all(20, 10), [], NOW)).toEqual({ stars: 2, passed: false, missed: true });
    expect(await api.finishSession(w, plan, all(20, 20), [], new Date('2026-10-23T10:00:00.000Z'))).toEqual({ stars: 3, passed: true, missed: false });
    expect(await api.finishSession(w, plan, all(20, 5), [], new Date('2026-10-24T10:00:00.000Z'))).toEqual({ stars: 1, passed: false, missed: true });
    // Many retakes: still one entry for the stage, with the best result.
    for (let i = 0; i < 30; i += 1) await api.finishSession(w, plan, all(20, 12), [], NOW);
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]).toMatchObject({ id: 'stage-check:stage3', resultStars: 3, generatedAt: '2026-10-23T10:00:00.000Z' });
    expect(f.latches).toHaveLength(1);
  });

  it('two devices converge on one entry: the best stars, then the earliest copy at equal stars, in either order', () => {
    const entry = (stars: 1 | 2 | 3, at: string): ReviewEntry => ({ id: 'stage-check:stage2', kind: 'stage-certificate', generatedAt: at, scope: 'stage2', itemIds: ['lex:a'], resultStars: stars, missedItemIds: [] });
    const a = entry(2, '2026-10-22T10:00:00.000Z');
    const b = entry(2, '2026-10-21T10:00:00.000Z');
    const c = entry(3, '2026-10-23T10:00:00.000Z');
    expect(mergeReview(a, b)).toBe(b);
    expect(mergeReview(b, a)).toBe(b);
    expect(mergeReview(a, c)).toBe(c);
    expect(mergeReview(c, a)).toBe(c);
    expect(mergeReview(mergeReview(a, b), c)).toEqual(mergeReview(a, mergeReview(b, c)));
  });

  it('switched off or the stage closed (F-ENT-003) while it played: nothing written, nothing sent, null', async () => {
    let on = true;
    let open = true;
    const f = fake({ on: () => on, stageOpen: () => open });
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    api.begin(w, plan, false);
    on = false;
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toBeNull();
    on = true;
    open = false;
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toBeNull();
    expect(f.reviews).toEqual([]);
    expect(f.latches).toEqual([]);
    expect(f.events.map((e) => e.name)).toEqual(['review.start']);
  });

  it('a device clock far ahead: the entry and the latch carry the guarded stamp, never the far time', async () => {
    const f = fake({ serverTime: () => '2026-10-22T09:00:00.000Z' });
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    const far = new Date('2027-06-01T00:00:00.000Z');
    await api.finishSession(w, plan, all(20, 20), [], far);
    const at = f.reviews[0]?.generatedAt as string;
    expect(Date.parse(at)).toBeLessThan(far.getTime());
    expect(Date.parse(at)).toBeGreaterThanOrEqual(Date.parse('2026-10-22T09:00:00.000Z'));
    expect(f.latches).toEqual([{ stage: 'stage2', at }]);
  });

  it('a stopped check keeps the answers given and writes no entry and no latch', async () => {
    const f = fake();
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage4', 'en'))!;
    await api.recordRound(w, plan, 0, { correct: true });
    await api.recordRound(w, plan, 1, { correct: false });
    expect(f.recorded).toHaveLength(2);
    expect(f.reviews).toEqual([]);
    expect(f.latches).toEqual([]);
  });
});

describe('in Spanish or Korean', () => {
  it('loads the lesson chunks first; an item none of whose chunks loads is skipped, never shown in English', async () => {
    const asked: string[] = [];
    const f = fake({ ensureCell: async (cell) => void asked.push(cell) });
    const api = createStageCheckApi(f.deps);
    await api.startSession(await world(f), 'stage2', 'es');
    for (const cell of cellsOf('stage2')) expect(asked).toContain(cell);
    const offline = fake({ ensureCell: async () => Promise.reject(new Error('offline')) });
    const plan = await createStageCheckApi(offline.deps).startSession(await world(offline), 'stage2', 'ko');
    for (const r of plan?.rounds ?? []) expect(r.question.itemId.startsWith('vocab:')).toBe(true);
  });
});
