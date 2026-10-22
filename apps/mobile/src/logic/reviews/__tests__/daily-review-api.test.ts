import type { MemoryItemState, ReviewEntry } from '@hangul-route/content-schema';
import type { ReviewFormat, ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../../platform/telemetry';
import { emptyMemoryFile, type MemoryFile } from '../../memory/memory-file';
import type { MemoryAnswer } from '../../memory/memory-runtime';
import { applyAnswer } from '../../memory/spacing';
import { createDailyReviewApi, type DailyReviewDeps, type ReviewWorld } from '../daily-review-api';
import type { RoundAnswer } from '../daily-review';
import type { ReviewItemIndex } from '../review-items-store';

/**
 * F-CURR-002 row CM-14: the Daily Review's reads and writes over injected stores. Off and unreadable reads, the
 * Home summary, the es and ko meanings from the lesson chunks (an item whose chunk cannot load is skipped), one
 * record per first answer with the credits, the stopped draw toward the day's 20, and the end: the daily entry,
 * review.complete, "N got stronger" from the states read again, and the offer that follows.
 */

const NOW = new Date(2026, 10, 10, 18, 0, 0);
const TODAY = '2026-11-10';
const KINDS: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = { sym: ['read-pick'], syl: ['read-pick'], lex: ['read-pick'], pat: ['read-pick'], exc: ['read-pick'], rea: ['read-pick'] };

function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  const kind = id.slice(0, 3) as ReviewItemKind;
  return { id, kind, ko: id.slice(4), romanization: id.slice(4), en: `${id.slice(4)}-en`, glossKey: `vocab:${id.slice(4)}#gloss`, home: 'life', stage: 2, volume: 1, cells: [`episode:stage2-${id.endsWith('x') ? 'nature' : 'life'}`], asked: [], formats: [...KINDS[kind]], soundChange: false, homophoneOf: [], ...over };
}
const st = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 1, d: TODAY, c: 1, r: 0, n: 1, f: '2026-11-01', s: 1, at: '2026-11-09T09:00:00.000Z', ...over });

const ITEMS = Array.from({ length: 14 }, (_, i) => mk(`lex:w${String(i).padStart(2, '0')}${i === 0 ? 'x' : ''}`));
const INDEX: ReviewItemIndex = { items: ITEMS, byId: new Map(ITEMS.map((i) => [i.id, i])), retired: new Set(), retiredById: new Map() };

interface Fake {
  deps: DailyReviewDeps;
  file: MemoryFile;
  reviews: ReviewEntry[];
  recorded: MemoryAnswer[][];
  events: TelemetryEvent[];
  cellsAsked: string[];
}

function fake(over: Partial<DailyReviewDeps> = {}, due = 12): Fake {
  const file = emptyMemoryFile();
  ITEMS.slice(0, due).forEach((it) => (file.rows[it.id] = { sh: 'stage2', st: st() }));
  const out: Fake = { file, reviews: [], recorded: [], events: [], cellsAsked: [], deps: {} as DailyReviewDeps };
  out.deps = {
    file: async () => out.file,
    ensureSeeded: async () => undefined,
    items: async () => INDEX,
    on: () => true,
    visibility: () => ({ volumes: true, topicPacks: true }),
    voice: () => false,
    hydrate: async () => undefined,
    reviews: () => out.reviews,
    vocab: () => ({}),
    recordReview: (_p, entry) => void out.reviews.push(entry),
    recordAnswers: async (_p, answers) => {
      out.recorded.push([...answers]);
      // As the memory store does: the spacing rule moves the box.
      for (const a of answers) {
        const row = out.file.rows[a.itemId];
        if (!row) continue;
        const next = applyAnswer(row.st, row, a, TODAY, NOW.toISOString());
        out.file.rows[a.itemId] = { ...row, st: next.state, ...next.facts };
      }
    },
    track: (e) => void out.events.push(e),
    overlays: () => Object.fromEntries(ITEMS.map((i) => [`vocab:${i.ko}`, { gloss: `${i.ko}-ko` }])),
    ensureCell: async (cell) => {
      out.cellsAsked.push(cell);
    },
    random: () => 0.5,
    ...over,
  };
  return out;
}

async function ready(f: Fake): Promise<{ api: ReturnType<typeof createDailyReviewApi>; world: ReviewWorld }> {
  const api = createDailyReviewApi(f.deps);
  const read = await api.readWorld('profile:a', NOW);
  if (read.kind !== 'ready') throw new Error(read.kind);
  return { api, world: read.world };
}

describe('readWorld and the Home summary', () => {
  it('off with the flags off or no profile; unreadable with no store or a failure; else the engine world on the local day', async () => {
    expect(await createDailyReviewApi(fake({ on: () => false }).deps).readWorld('profile:a')).toEqual({ kind: 'off' });
    expect(await createDailyReviewApi(fake().deps).readWorld(null)).toEqual({ kind: 'off' });
    expect(await createDailyReviewApi(fake({ file: async () => null }).deps).readWorld('profile:a')).toEqual({ kind: 'unreadable' });
    expect(await createDailyReviewApi(fake({ items: () => Promise.reject(new Error('offline')) }).deps).readWorld('profile:a')).toEqual({ kind: 'unreadable' });
    const { world } = await ready(fake());
    expect(world.ctx.today).toBe(TODAY);
    expect(world.ctx.voice).toBe(false);
    expect(world.ctx.seed).toBe(`profile:a|${TODAY}`);
    expect(Object.keys(world.ctx.states)).toHaveLength(12);
  });

  it('homeDailyReview: the counts, or null when off', async () => {
    // Read on the device's day now: the words are due since January.
    const f = fake();
    for (const row of Object.values(f.file.rows)) row.st = { ...row.st, d: '2026-01-05' };
    expect(await createDailyReviewApi(f.deps).homeDailyReview('profile:a')).toEqual({ due: 12, done: false, reviewFirst: false });
    expect(await createDailyReviewApi(fake({ on: () => false }).deps).homeDailyReview('profile:a')).toBeNull();
  });
});

describe('a session, start to end', () => {
  it('starts with review.start, records each first answer, and ends with the entry, review.complete and what got stronger', async () => {
    const f = fake();
    const { api, world } = await ready(f);
    expect(api.openingKind(world)).toBe('daily');
    const plan = await api.startSession(world, 'daily', 'en');
    expect(plan?.rounds).toHaveLength(10);
    expect(f.events).toEqual([{ name: 'review.start', profileId: 'profile:a', payload: { kind: 'daily' } }]);
    expect(f.cellsAsked).toEqual([]);
    const answers = new Map<number, RoundAnswer>();
    const recorded: Promise<void>[] = [];
    plan?.rounds.forEach((_r, i) => {
      const a = { correct: i !== 0 };
      answers.set(i, a);
      recorded.push(api.recordRound(world, plan, i, a));
    });
    expect(api.recordRound(world, plan as NonNullable<typeof plan>, 99, { correct: true })).toBeInstanceOf(Promise);
    expect(f.recorded).toHaveLength(10);
    const { finished, world: next } = await api.finishSession(world, plan as NonNullable<typeof plan>, answers, recorded, NOW);
    expect(finished).toEqual({ stars: 3, stronger: 9, after: 'offer' });
    expect(f.reviews).toHaveLength(1);
    expect(f.reviews[0]).toMatchObject({ kind: 'daily', scope: TODAY, resultStars: 3 });
    expect(f.reviews[0]?.id).toMatch(new RegExp(`^daily:${TODAY}:[0-9a-z]+$`));
    expect(f.events[1]).toEqual({ name: 'review.complete', profileId: 'profile:a', payload: { kind: 'daily', stars: 3 } });
    // Next is Keep going: the 2 left.
    expect(api.openingKind(next)).toBe('keep-going');
    expect(api.doneTodayOffer(next)).toBe('offer');
    expect((await api.startSession(next, 'keep-going', 'en'))?.rounds).toHaveLength(2);
  });

  it('the store unreadable at the end: the stars stand, no stronger line, nothing more offered', async () => {
    const f = fake();
    const { api, world } = await ready(f);
    const plan = await api.startSession(world, 'daily', 'en');
    f.deps.file = async () => null;
    const { finished } = await api.finishSession(world, plan as NonNullable<typeof plan>, new Map(), [], NOW);
    expect(finished).toEqual({ stars: 1, stronger: null, after: 'empty' });
  });

  it('nothing due: no session and no review.start', async () => {
    const f = fake({}, 0);
    const { api, world } = await ready(f);
    expect(await api.startSession(world, 'daily', 'en')).toBeNull();
    expect(f.events).toEqual([]);
  });
});

describe('the es and ko meanings come from the lesson chunks (offline: an item whose chunk cannot load is skipped)', () => {
  it('loads the cells of the session, then builds the rounds in the UI language', async () => {
    const f = fake();
    const { api, world } = await ready(f);
    const plan = await api.startSession(world, 'daily', 'ko');
    expect(f.cellsAsked.sort()).toEqual(expect.arrayContaining(['episode:stage2-life']));
    const labels = plan?.rounds.flatMap((r) => (r.type === 'pick' ? r.options.map((o) => o.label) : [])) ?? [];
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => typeof l === 'string' && l.endsWith('-ko'))).toBe(true);
  });

  it('skips the items whose only lesson chunk could not load, and fills their slots', async () => {
    const f = fake({ ensureCell: (cell) => (cell === 'episode:stage2-nature' ? Promise.reject(new Error('offline')) : Promise.resolve()) });
    const { api, world } = await ready(f);
    const plan = await api.startSession(world, 'daily', 'es');
    expect(plan?.rounds.map((r) => r.question.itemId)).not.toContain('lex:w00x');
    expect(plan?.rounds).toHaveLength(10);
  });
});

describe('a stopped Daily Review (section 4.8 step 3)', () => {
  it("its due items count toward the day's 20 for the next Daily Review of the day; a Keep going is not counted", async () => {
    const f = fake({}, 14);
    const { api, world } = await ready(f);
    const plan = await api.startSession(world, 'daily', 'en');
    if (plan === null) throw new Error('no plan');
    api.noteStopped(world, plan, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    api.noteStopped(world, plan, []);
    api.noteStopped(world, { ...plan, kind: 'keep-going' }, [0, 1]);
    // 10 drawn: the next Daily Review of the day may draw 10 more, never past 20.
    expect((await api.startSession(world, 'daily', 'en'))?.rounds).toHaveLength(10);
    api.noteStopped(world, plan, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(await api.startSession(world, 'daily', 'en')).toBeNull();
  });

  it('exposes the typing tolerance for the type rounds', async () => {
    const { api } = await ready(fake());
    expect(api.gradeTyped('사과', '사과')).toBe('right');
    expect(api.gradeTyped('사과', '사가')).toBe('hinted');
  });
});
