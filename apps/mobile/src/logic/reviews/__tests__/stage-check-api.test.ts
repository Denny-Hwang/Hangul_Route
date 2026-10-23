import type { ProgressSnapshot, ReviewEntry, StageKey } from '@hangul-route/content-schema';
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
    recordReview: (_p, entry) => void out.reviews.push(entry),
    recordAnswers: async (_p, answers) => void out.recorded.push([...answers]),
    latch: (_p, stage, at) => void out.latches.push({ stage, at }),
    track: (e) => void out.events.push(e),
    overlays: () => ({}),
    ensureCell: async () => undefined,
    random: () => 0.5,
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

  it('under 3 stars: the entry and the stars, no latch; taken again it writes another entry', async () => {
    const f = fake();
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage3', 'en'))!;
    expect(await api.finishSession(w, plan, all(20, 10), [], NOW)).toEqual({ stars: 2, passed: false, missed: true });
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toEqual({ stars: 3, passed: true, missed: false });
    expect(f.reviews.map((r) => r.resultStars)).toEqual([2, 3]);
    expect(f.latches).toHaveLength(1);
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
