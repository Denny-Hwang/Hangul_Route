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
import { SAVED_RUN_MAX_AGE_MS } from '../../quest-flow/saved-run';
import type { SavedStageCheck } from '../saved-check';
import type { PlannedStageCheck } from '../stage-check';
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
    itemsHash: () => 'hash-1',
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
    // A retake is a new check: a new plan for each (a plan finishes once, section 3.5 of AMENDMENTS-QUEST-LEAVE-RESUME).
    const take = async () => (await api.startSession(w, 'stage3', 'en'))!;
    expect(await api.finishSession(w, await take(), all(20, 10), [], NOW)).toEqual({ stars: 2, passed: false, missed: true });
    expect(await api.finishSession(w, await take(), all(20, 20), [], new Date('2026-10-23T10:00:00.000Z'))).toEqual({ stars: 3, passed: true, missed: false });
    expect(await api.finishSession(w, await take(), all(20, 5), [], new Date('2026-10-24T10:00:00.000Z'))).toEqual({ stars: 1, passed: false, missed: true });
    // Many retakes: still one entry for the stage, with the best result.
    for (let i = 0; i < 30; i += 1) await api.finishSession(w, await take(), all(20, 12), [], NOW);
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]).toMatchObject({ id: 'stage-check:stage3', resultStars: 3, generatedAt: '2026-10-23T10:00:00.000Z' });
    expect(f.latches).toHaveLength(1);
  });

  // AMENDMENTS-QUEST-LEAVE-RESUME section 3.5 (row LR-4), test 27: a finish is once per plan.
  it('a second finish for the same plan answers the first one\'s result and writes no second entry, latch or event', async () => {
    const f = fake();
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    const first = await api.finishSession(w, plan, all(20, 20), [], NOW);
    const second = await api.finishSession(w, plan, all(20, 20), [], NOW);
    expect(second).toBe(first);
    expect(f.reviews).toHaveLength(1);
    expect(f.latches).toHaveLength(1);
    expect(f.events.filter((e) => e.name === 'review.complete')).toHaveLength(1);
  });

  it('a finish that rejected (a recording or the entry) wrote nothing, and the same plan finishes on the next call', async () => {
    const f = fake();
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    await expect(api.finishSession(w, plan, all(20, 20), [Promise.reject(new Error('store full'))], NOW)).rejects.toThrow('store full');
    const realRecord = f.deps.recordReview;
    f.deps.recordReview = () => {
      throw new Error('entry not written');
    };
    await expect(api.finishSession(w, plan, all(20, 20), [], NOW)).rejects.toThrow('entry not written');
    expect(f.latches).toEqual([]);
    f.deps.recordReview = realRecord;
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toEqual({ stars: 3, passed: true, missed: false });
    expect(f.reviews).toHaveLength(1);
    expect(f.latches).toHaveLength(1);
    expect(f.events.filter((e) => e.name === 'review.complete')).toHaveLength(1);
  });

  it('a step after the entry was written that throws leaves the entry written once: the next call writes no second one', async () => {
    let entries = 0;
    let latchFails = true;
    const f = fake({
      latch: () => {
        if (latchFails) {
          latchFails = false;
          throw new Error('latch not written');
        }
      },
    });
    const record = f.deps.recordReview;
    f.deps.recordReview = (p, entry) => {
      entries += 1;
      record(p, entry);
    };
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    await expect(api.finishSession(w, plan, all(20, 20), [], NOW)).rejects.toThrow('latch not written');
    expect(entries).toBe(1);
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toEqual({ stars: 3, passed: true, missed: false });
    expect(entries).toBe(1);
    expect(f.events.filter((e) => e.name === 'review.complete')).toHaveLength(1);
  });

  it('a finish that answered null (switched off, stage closed) is not kept: the same plan finishes once it can', async () => {
    let on = true;
    const f = fake({ on: () => on });
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage2', 'en'))!;
    on = false;
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toBeNull();
    on = true;
    expect(await api.finishSession(w, plan, all(20, 20), [], NOW)).toMatchObject({ stars: 3 });
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

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3b (test 22): `resumeSession` gives a stored Stage Check back as stored, and
 * nothing for a run that is not this stage, this language, this build's review items, within a day, or whose rounds do not
 * pass their shape check; a run whose result is already in the progress is `recorded`.
 */
describe('resumeSession and savedRun (LR-3b)', () => {
  const START = '2026-10-22T09:00:00.000Z';
  const LATER = new Date(Date.parse(START) + 60 * 60 * 1000);

  /** A plan with the round types the formats can make (the voice and the game switches on), and what is stored for it. */
  async function stored(over: Partial<StageCheckDeps> = {}, locale: 'en' | 'es' | 'ko' = 'en', answered = 8) {
    const f = fake({ games: () => new Set(['syllable-build', 'match-shape']), clozePick: () => true, dictation: () => true, ...over });
    const api = createStageCheckApi(f.deps);
    const w = await world(f);
    const plan = (await api.startSession(w, 'stage3', locale))!;
    const answers = new Map(Array.from({ length: answered }, (_, i): [number, RoundAnswer] => [i, i % 3 === 0 ? { correct: false } : { correct: true, ...(i % 4 === 0 ? { hinted: true } : {}) }]));
    const run = api.savedRun(plan, { locale, answers, hideRomanization: true, startedAt: START });
    // The stored value is JSON, as the storage keeps it.
    const saved = JSON.parse(JSON.stringify(run)) as SavedStageCheck;
    return { f, api, w, plan, answers, run, saved };
  }

  it('savedRun holds the stage, the language, the items hash, the plan rounds, the answers by index, the choice and the start time', async () => {
    const { plan, run, answers } = await stored();
    expect(run).toMatchObject({ v: 1, kind: 'stage', stage: 'stage3', locale: 'en', itemsHash: 'hash-1', hideRomanization: true, startedAt: START });
    expect(run.rounds).toEqual(plan.rounds);
    expect(run.answers.map(([i]) => i)).toEqual([...answers.keys()]);
    expect(Object.fromEntries(run.answers)).toEqual(Object.fromEntries(answers));
  });

  it('the stored rounds come back as stored, with the answers, the choice, the start time and the next round', async () => {
    const { api, w, plan, saved, answers } = await stored();
    const found = await api.resumeSession(w, saved, 'en', 'stage3', LATER);
    expect(found.kind).toBe('run');
    if (found.kind !== 'run') return;
    expect(found.run.plan).toEqual({ stage: 'stage3', rounds: plan.rounds, soundNotice: plan.soundNotice } satisfies PlannedStageCheck);
    expect(found.run.answers).toEqual(answers);
    expect(found.run).toMatchObject({ hideRomanization: true, startedAt: START, next: 8 });
  });

  it('the plans of every stage pass the shape check after JSON, and between them they hold several round types', async () => {
    const types = new Set<string>();
    for (const stage of ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'] as const) {
      const f = fake({ games: () => new Set(['syllable-build', 'match-shape']), clozePick: () => true, dictation: () => true });
      const api = createStageCheckApi(f.deps);
      const w = await world(f);
      const plan = (await api.startSession(w, stage, 'en'))!;
      plan.rounds.forEach((r) => types.add(r.type));
      const saved = JSON.parse(JSON.stringify(api.savedRun(plan, { locale: 'en', answers: new Map([[0, { correct: true }]]), hideRomanization: false, startedAt: START })));
      expect((await api.resumeSession(w, saved, 'en', stage, LATER)).kind, stage).toBe('run');
    }
    expect([...types]).toEqual(expect.arrayContaining(['pick', 'type', 'order']));
  });

  it('the next round is the first without an answer: a gap is asked again, every round answered is the end', async () => {
    const { api, w, saved } = await stored();
    const gap = { ...saved, answers: saved.answers.filter(([i]) => i !== 3) };
    const g = await api.resumeSession(w, gap, 'en', 'stage3', LATER);
    expect(g.kind === 'run' && g.run.next).toBe(3);
    const all20 = { ...saved, answers: saved.rounds.map((_, i): [number, RoundAnswer] => [i, { correct: true }]) };
    const done = await api.resumeSession(w, all20, 'en', 'stage3', LATER);
    expect(done.kind === 'run' && done.run.next).toBe(saved.rounds.length);
  });

  const kindOf = async (mutate: (saved: SavedStageCheck) => unknown, ask: { locale?: 'en' | 'es' | 'ko'; stage?: 'stage2' | 'stage3'; now?: Date; deps?: Partial<StageCheckDeps> } = {}) => {
    const { f, saved } = await stored();
    const api = createStageCheckApi({ ...f.deps, ...ask.deps });
    const w = await world(f);
    const value = mutate(JSON.parse(JSON.stringify(saved)) as SavedStageCheck);
    return (await api.resumeSession(w, value, ask.locale ?? 'en', ask.stage ?? 'stage3', ask.now ?? LATER)).kind;
  };

  it('nothing for another stage, another language, another review-item set', async () => {
    expect(await kindOf((s) => s, { stage: 'stage2' })).toBe('none');
    expect(await kindOf((s) => s, { locale: 'es' })).toBe('none');
    expect(await kindOf((s) => s, { deps: { itemsHash: () => 'hash-2' } })).toBe('none');
    expect(await kindOf((s) => s)).toBe('run');
  });

  it('nothing past 24 hours, whichever way on the clock; fresh at exactly 24 hours', async () => {
    const t = Date.parse(START);
    expect(await kindOf((s) => s, { now: new Date(t + SAVED_RUN_MAX_AGE_MS) })).toBe('run');
    expect(await kindOf((s) => s, { now: new Date(t + SAVED_RUN_MAX_AGE_MS + 1) })).toBe('none');
    expect(await kindOf((s) => s, { now: new Date(t - SAVED_RUN_MAX_AGE_MS - 1) })).toBe('none');
  });

  it('nothing when an item of a round is retired or gone from the index, or the index cannot be read', async () => {
    const { f, saved } = await stored();
    const first = saved.rounds[0]!.question.itemId;
    const w = await world(f);
    const retired = createStageCheckApi({ ...f.deps, items: async () => ({ ...INDEX, retired: new Set([first]) }) });
    expect((await retired.resumeSession(w, saved, 'en', 'stage3', LATER)).kind).toBe('none');
    const gone = createStageCheckApi({ ...f.deps, items: async () => ({ ...INDEX, byId: new Map([...INDEX.byId].filter(([id]) => id !== first)) }) });
    expect((await gone.resumeSession(w, saved, 'en', 'stage3', LATER)).kind).toBe('none');
    const offline = createStageCheckApi({ ...f.deps, items: async () => Promise.reject(new Error('offline')) });
    expect((await offline.resumeSession(w, saved, 'en', 'stage3', LATER)).kind).toBe('none');
  });

  it('nothing for a round that fails the shape check', async () => {
    const bad = (edit: (round: Record<string, unknown>) => void) =>
      kindOf((s) => {
        edit(s.rounds[2] as unknown as Record<string, unknown>);
        return s;
      });
    expect(await bad((r) => (r.type = 'puzzle'))).toBe('none');
    expect(await bad((r) => delete r.question)).toBe('none');
    expect(await bad((r) => ((r.question as Record<string, unknown>).itemId = 7))).toBe('none');
    expect(await bad((r) => ((r.question as Record<string, unknown>).rung = 'master'))).toBe('none');
    expect(await bad((r) => ((r.question as Record<string, unknown>).cue = 'sound'))).toBe('none');
    expect(await bad((r) => ((r.answer as Record<string, unknown>).ko = 'x'))).toBe('none');
    expect(await bad((r) => delete r.answer)).toBe('none');
  });

  it('nothing for a round of each type missing a field its view reads', async () => {
    const { saved } = await stored();
    const byType = new Map(saved.rounds.map((r, i) => [r.type, i] as const));
    const needs: Record<string, string[]> = {
      pick: ['heard', 'ask', 'prompt', 'options', 'answerId'],
      type: ['mode', 'target'],
      order: ['tiles', 'words'],
      cloze: ['gapped', 'meaning', 'tiles', 'answerId'],
      build: ['target'],
      shape: ['target', 'lookAlike'],
    };
    let checked = 0;
    for (const [type, fields] of Object.entries(needs)) {
      const at = byType.get(type as never);
      if (at === undefined) continue;
      for (const field of fields) {
        const out = await kindOf((s) => {
          delete (s.rounds[at] as unknown as Record<string, unknown>)[field];
          return s;
        });
        expect(out, `${type} without ${field}`).toBe('none');
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('nothing when the answers are bad: out of the plan, twice for one round, a bad shape, none at all', async () => {
    expect(await kindOf((s) => ({ ...s, answers: [...s.answers, [99, { correct: true }]] }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, answers: [...s.answers, [0, { correct: true }]] }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, answers: [[0, { correct: 'yes' }]] }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, answers: [[0.5, { correct: true }]] }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, answers: [[0]] }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, answers: [] }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, answers: 'x' }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, rounds: [] }))).toBe('none');
  });

  it('nothing for garbage or another kind of check run', async () => {
    for (const value of [null, undefined, 'x', 7, [], {}, { v: 2 }]) expect(await kindOf(() => value)).toBe('none');
    expect(await kindOf((s) => ({ ...s, kind: 'hangul' }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, v: 2 }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, hideRomanization: 'yes' }))).toBe('none');
    expect(await kindOf((s) => ({ ...s, startedAt: 'yesterday' }))).toBe('none');
  });

  it('a run whose result is already in the progress is recorded, not offered again; an older, other-stage or unlatched entry is not', async () => {
    const { f, saved } = await stored();
    const entry = (over: Partial<ReviewEntry>): ReviewEntry => ({ id: 'stage-check:stage3', kind: 'stage-certificate', generatedAt: '2026-10-22T09:30:00.000Z', scope: 'stage3', itemIds: [], resultStars: 2, ...over });
    const ask = async (snap: Partial<ProgressSnapshot> | undefined) =>
      (await createStageCheckApi({ ...f.deps, snapshot: () => snap as ProgressSnapshot | undefined }).resumeSession(await world(f), saved, 'en', 'stage3', LATER)).kind;
    expect(await ask({ reviews: [entry({})] })).toBe('recorded');
    expect(await ask({ reviews: [entry({ generatedAt: START })] })).toBe('recorded');
    expect(await ask({ reviews: [entry({ generatedAt: '2026-10-22T08:59:59.000Z' })] })).toBe('run');
    expect(await ask({ reviews: [entry({ id: 'stage-check:stage2', scope: 'stage2' })] })).toBe('run');
    expect(await ask({ reviews: [] })).toBe('run');
    expect(await ask(undefined)).toBe('run');
    // A 3-star entry whose latch was not written is not a finished check: the finish runs again (the latch is earliest-wins).
    expect(await ask({ reviews: [entry({ resultStars: 3 })] })).toBe('run');
    expect(await ask({ reviews: [entry({ resultStars: 3 })], stageCheckAt: { stage3: '2026-10-22T09:30:00.000Z' } })).toBe('recorded');
  });
});
