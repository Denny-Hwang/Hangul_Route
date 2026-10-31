import { describe, expect, it } from 'vitest';
import { WEEK_DROP_WEEKS } from '../../../content/__generated__/week-drops-index';
import { emptyMemoryFile, type MemoryFile } from '../../memory/memory-file';
import type { MemoryAnswer } from '../../memory/memory-runtime';
import { INDEX } from '../../memory/__tests__/fixtures';
import type { EngineContext } from '../engine';
import { glossFrom } from '../review-rounds';
import { WEEK_PRACTICE_MIN_ROUNDS, createWeekPracticeApi, planWeekPractice, weekItemIds, type WeekPracticeDeps } from '../week-practice';

/*
 * The practice of a "This week in Korea" drop (F-CURR-002 §5.7, row CM-48; design/wireframes/home/this-week-in-korea.md C):
 * about 5 quick rounds over the drop's own words, at the recognize or read rung, each first answer recorded only while
 * the profile records; es and ko meanings come from the week-drop chunk and the lesson chunks.
 */

const CELLS = WEEK_DROP_WEEKS.map((w) => `week:${w}`);
const ctxOf = (over: Partial<EngineContext> = {}): EngineContext => ({ index: INDEX, states: {}, today: '2026-10-30', voice: true, seed: 's', maxRung: 'read', ...over });

describe('planWeekPractice', () => {
  it('plays every drop of the first quarter as 5 quick rounds over its own 5 words, with and without a device voice', () => {
    for (const cell of CELLS) {
      const ids = weekItemIds(INDEX, cell);
      expect(ids, cell).toHaveLength(5);
      for (const voice of [true, false]) {
        const plan = planWeekPractice(ctxOf({ voice }), cell, glossFrom(undefined));
        expect(plan?.rounds.length, `${cell} voice ${voice}`).toBe(5);
        expect(new Set(plan?.rounds.map((r) => r.question.itemId))).toEqual(new Set(ids));
        for (const r of plan?.rounds ?? []) expect(['recognize', 'read'], cell).toContain(r.question.rung);
        expect(plan?.rounds.every((r) => r.type === 'pick'), cell).toBe(true);
      }
    }
  });

  it('is the same for the same seed, and null below 3 playable rounds', () => {
    const cell = CELLS[1] as string;
    expect(planWeekPractice(ctxOf(), cell, glossFrom(undefined))).toEqual(planWeekPractice(ctxOf(), cell, glossFrom(undefined)));
    const ids = weekItemIds(INDEX, cell);
    expect(planWeekPractice(ctxOf(), cell, glossFrom(undefined), new Set(ids.slice(0, 3)))).toBeNull();
    expect(planWeekPractice(ctxOf(), 'week:2020-01-06', glossFrom(undefined))).toBeNull();
    expect(WEEK_PRACTICE_MIN_ROUNDS).toBe(3);
  });

  it('plays the drop even when the rest of the visibility would hide its cell (its own surface is open)', async () => {
    const api = createWeekPracticeApi(deps({ visibility: () => ({ volumes: false, topicPacks: false, weeklyDrop: false }) }).deps);
    expect((await api.plan('p1', CELLS[0] as string, 'en', new Date('2026-10-30T10:00:00Z')))?.rounds).toHaveLength(5);
  });
});

function deps(over: Partial<WeekPracticeDeps> = {}, opts: { records?: boolean; file?: MemoryFile | null } = {}) {
  const recorded: MemoryAnswer[][] = [];
  const loaded: string[] = [];
  const calls: string[] = [];
  const d: WeekPracticeDeps = {
    items: async () => INDEX,
    records: () => opts.records ?? true,
    hydrate: async () => void calls.push('hydrate'),
    ensureSeeded: async () => void calls.push('seed'),
    file: async () => (opts.file === undefined ? emptyMemoryFile() : opts.file),
    vocab: () => undefined,
    voice: () => true,
    visibility: () => ({ volumes: true, topicPacks: true, weeklyDrop: true }),
    overlays: () => ({}),
    ensureCell: async (cell) => void loaded.push(cell),
    recordAnswers: async (_p, answers) => void recorded.push([...answers]),
    ...over,
  };
  return { deps: d, recorded, loaded, calls };
}

describe('createWeekPracticeApi', () => {
  it('records each first answer while the profile records, with the round rung; nothing while it does not', async () => {
    const on = deps();
    const api = createWeekPracticeApi(on.deps);
    const plan = await api.plan('p1', CELLS[0] as string, 'en');
    expect(on.calls).toEqual(['hydrate', 'seed']);
    await api.record('p1', plan!, 0, { correct: true });
    await api.record('p1', plan!, 99, { correct: true });
    expect(on.recorded).toEqual([[{ itemId: plan!.rounds[0]!.question.itemId, rung: plan!.rounds[0]!.question.rung, correct: true }]]);
    const off = deps({}, { records: false });
    const quiet = createWeekPracticeApi(off.deps);
    const plan2 = await quiet.plan('p1', CELLS[0] as string, 'en');
    expect(plan2?.rounds).toHaveLength(5);
    expect(off.calls).toEqual([]);
    await quiet.record('p1', plan2!, 0, { correct: false });
    expect(off.recorded).toEqual([]);
  });

  it('plans from the stored states (an unreadable store plays from none), and gives null when the items cannot load', async () => {
    expect((await createWeekPracticeApi(deps({}, { file: null }).deps).plan('p1', CELLS[0] as string, 'en'))?.rounds).toHaveLength(5);
    expect(await createWeekPracticeApi(deps({ items: () => Promise.reject(new Error('offline')) }).deps).plan('p1', CELLS[0] as string, 'en')).toBeNull();
  });

  it('in es and ko loads the week-drop chunk (and lesson chunks) before it builds, and leaves out a word whose chunk cannot load', async () => {
    const cell = CELLS[1] as string;
    const ok = deps();
    const plan = await createWeekPracticeApi(ok.deps).plan('p1', cell, 'ko');
    expect(ok.loaded).toContain(cell);
    expect(plan?.rounds.length).toBeGreaterThanOrEqual(3);
    // Offline before the precache: no chunk loads, so no word has a Korean meaning and none is offered in English.
    const offline = deps({ ensureCell: () => Promise.reject(new Error('offline')) });
    const none = await createWeekPracticeApi(offline.deps).plan('p1', cell, 'es');
    const weekOnly = weekItemIds(INDEX, cell).filter((id) => INDEX.byId.get(id)?.cells.every((c) => c.startsWith('week:')));
    for (const r of none?.rounds ?? []) expect(weekOnly).not.toContain(r.question.itemId);
  });
});
