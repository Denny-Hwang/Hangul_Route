import { CATALOG, MemoryItemStateSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween } from '../../vocab/srs';
import { cellOfEpisode } from '../resolve';
import { SEED_PER_DAY, deriveSeed, seedInputKey, seedSnapshot, type SeedInput } from '../seed';
import { ITEMS, LESSON_QUESTS, PLACEMENT, RETIRED, finished, historicalPoints, utcDay } from './fixtures';

/**
 * F-CURR-002 section 4.8, steps 1-6 (row CM-12): the one-time seeding, at the five historical
 * snapshot points and for a learner with every lesson quest done (107, and 108 with the Stage 1 addition of row CM-33).
 */

const SEEDED_AT = '2026-10-22T08:00:00.000Z';
const SEED_DAY = '2026-10-22';

const input = (snapshot: SeedInput['snapshot'], seededAt = SEEDED_AT): SeedInput => ({
  snapshot,
  items: ITEMS,
  retired: RETIRED,
  quests: CATALOG.quests,
  cells: CATALOG.cells,
  seededAt,
  dayOf: utcDay,
});

const perDay = (states: Iterable<{ state: { d: string | null } }>): Map<string, number> => {
  const out = new Map<string, number>();
  for (const { state } of states) out.set(state.d as string, (out.get(state.d as string) ?? 0) + 1);
  return out;
};

describe('seeding at the five historical snapshot points', () => {
  const points = historicalPoints(20);
  const seeds = Object.fromEntries(Object.entries(points).map(([name, snap]) => [name, deriveSeed(input(snap))])) as Record<keyof typeof points, ReturnType<typeof deriveSeed>>;

  it('every point with quests seeds the same items: vocab plays no part, a snapshot before questDoneAt is latched from completedAt', () => {
    const ids = (name: keyof typeof points) => [...seeds[name].states.keys()].sort();
    expect(seeds.current.count).toBeGreaterThan(30);
    expect(ids('beforeVocab')).toEqual(ids('current'));
    expect(ids('beforeQuestDoneAt')).toEqual(ids('current'));
    expect(seeds.beforeQuestDoneAt.states).toEqual(seeds.current.states);
  });

  it('before placements: no priority symbols, the quest items stay', () => {
    expect(seeds.current.states.has('sym:bieup')).toBe(true);
    expect(seeds.current.states.has('sym:nieun-batchim')).toBe(true);
    const first = [...seeds.current.states.entries()].slice(0, 2).map(([id]) => id);
    expect(first).toEqual(['sym:bieup', 'sym:nieun-batchim']);
    expect(seeds.beforePlacements.states.get('sym:bieup')?.state.d).not.toBeUndefined();
    expect(seeds.beforePlacements.count).toBe(seeds.current.count - [...seeds.current.states.keys()].filter((id) => !seeds.beforePlacements.states.has(id)).length);
  });

  it('an empty snapshot seeds nothing and spreads over no day', () => {
    expect(seeds.empty).toEqual({ states: new Map(), count: 0, spreadDays: 0, cellBest: {} });
  });

  it('every seeded state parses, is unanswered (n = 0) and carries the shard of its item', () => {
    for (const [id, { shard, state }] of seeds.current.states) {
      expect(MemoryItemStateSchema.safeParse(state).success, id).toBe(true);
      expect(state).toMatchObject({ n: 0, c: 0, r: 0, at: SEEDED_AT });
      expect(state.s).toBe(state.b);
      expect(shard).toMatch(/^stage[1-7]$/);
      expect(id.startsWith('vocab:'), 'topic words are not copied').toBe(false);
      expect(RETIRED.has(id)).toBe(false);
    }
  });

  it('box 2 when the item’s quests scored 3 stars, box 1 otherwise; priority symbols at box 1 due on day 1', () => {
    const allThree = finished(20);
    allThree.quests = allThree.quests.map((q) => ({ ...q, stars: 3 }));
    const boxes = new Set([...deriveSeed(input(allThree)).states.values()].map((s) => s.state.b));
    expect([...boxes].sort()).toEqual([1, 2]);
    expect(seeds.current.states.get('sym:bieup')?.state).toMatchObject({ b: 1, d: addDays(SEED_DAY, 1), f: SEED_DAY });
    // Without the 3-star quests every seeded item is box 1.
    const twoStars = finished(20);
    twoStars.quests = twoStars.quests.map((q) => ({ ...q, stars: 2 }));
    expect(new Set([...deriveSeed(input(twoStars)).states.values()].map((s) => s.state.b))).toEqual(new Set([1]));
  });

  it('a cell of mixed stars seeds box 1: box 2 only when every done quest of the cells that teach the item scored 3 stars', () => {
    const cell = LESSON_QUESTS[0]?.episodeId as string;
    const snap = finished(20);
    const doneCells = new Set(snap.quests.map((q) => cellOfEpisode(q.episodeId)));
    snap.quests = snap.quests.map((q) => ({ ...q, stars: q.episodeId === cell ? 3 : 2 }));
    expect(snap.quests.filter((q) => q.episodeId === cell).length).toBeGreaterThan(1);
    // The items only this cell teaches among the done ones (the priority symbols are box 1 anyway).
    const only = ITEMS.filter((i) => !i.id.startsWith('vocab:') && !RETIRED.has(i.id) && i.cells.includes(cell) && i.cells.every((c) => c === cell || !doneCells.has(c)) && !['sym:bieup', 'sym:nieun-batchim'].includes(i.id));
    expect(only.length).toBeGreaterThan(0);
    const three = deriveSeed(input(snap));
    for (const i of only) expect(three.states.get(i.id)?.state.b, i.id).toBe(2);
    const mixed = structuredClone(snap);
    const one = mixed.quests.find((q) => q.episodeId === cell);
    if (one) one.stars = 2;
    const out = deriveSeed(input(mixed));
    for (const i of only) expect(out.states.get(i.id)?.state.b, i.id).toBe(1);
  });

  it('a cell that only asks an item again dates it but never raises its box', () => {
    const item = ITEMS.find((i) => !i.id.startsWith('vocab:') && !RETIRED.has(i.id) && i.asked.some((c) => CATALOG.quests.some((q) => q.kind === 'lesson' && cellOfEpisode(q.episodeId) === c)));
    expect(item).toBeDefined();
    const askedCell = item?.asked.find((c) => CATALOG.quests.some((q) => q.kind === 'lesson' && cellOfEpisode(q.episodeId) === c)) as string;
    const s = finished(0);
    s.placements = [];
    const quests = CATALOG.quests.filter((q) => q.kind === 'lesson' && cellOfEpisode(q.episodeId) === askedCell);
    s.quests = quests.map((q) => ({ questId: q.id, episodeId: q.episodeId, startedAt: '2026-09-02T00:00:00.000Z', completedAt: '2026-09-02T00:00:00.000Z', stars: 3 as const, attempts: 1, accuracy: 1 }));
    s.questDoneAt = Object.fromEntries(quests.map((q) => [q.id, '2026-09-02T00:00:00.000Z']));
    expect(deriveSeed(input(s)).states.get(item?.id as string)?.state).toMatchObject({ b: 1, f: '2026-09-02' });
  });

  it('a quest finished after memSeededAt seeds nothing', () => {
    const snap = finished(3);
    expect(deriveSeed(input(snap, '2026-08-31T00:00:00.000Z')).count).toBe(2); // the two priority symbols only
  });

  it('cellBest starts at 1 for every cell whose quests are all done, and only those', () => {
    const doneCells = CATALOG.cells.filter((c) => c.questIds.length > 0 && c.questIds.every((id) => LESSON_QUESTS.slice(0, 20).some((q) => q.id === id)));
    expect(doneCells.length).toBeGreaterThan(0);
    expect(seeds.current.cellBest).toEqual(Object.fromEntries(doneCells.map((c) => [c.episodeId, 1])));
  });
});

describe('the all-quests fixture (scenario S-c; 117 quests since rows CM-41 S7, CM-42 S7 and CM-43 S7 added the Stage 7 Nature, Play & Crafts and Food & Daily Life Volume 2)', () => {
  const snap = finished(117);
  const seed = deriveSeed(input(snap));

  it('holds every lesson quest of the catalogue', () => {
    expect(LESSON_QUESTS).toHaveLength(117);
    expect(Object.keys(snap.questDoneAt ?? {})).toHaveLength(117);
  });

  it('every seeded item has a due day, no day holds more than 15, and the spread is reported', () => {
    const days = perDay(seed.states.values());
    for (const { state } of seed.states.values()) expect(state.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Math.max(...days.values())).toBeLessThanOrEqual(SEED_PER_DAY);
    expect(seed.spreadDays).toBe(Math.ceil(seed.count / SEED_PER_DAY));
    expect(days.size).toBe(seed.spreadDays);
    const last = [...days.keys()].sort().at(-1) as string;
    expect(daysBetween(SEED_DAY, last)).toBe(seed.spreadDays);
    // Every taught lesson item that is not a topic word or retired is seeded.
    const expected = ITEMS.filter((i) => !i.id.startsWith('vocab:') && !RETIRED.has(i.id) && [...i.cells, ...i.asked].some((c) => c.startsWith('episode:')));
    expect(seed.count).toBe(expected.length);
    expect(seed.spreadDays).toBeLessThanOrEqual(62);
  });

  it('orders by the most recent quest first, then the stage: the last cell finished falls due first', () => {
    const lastQuest = LESSON_QUESTS[LESSON_QUESTS.length - 2];
    const firstDay = [...seed.states.entries()].filter(([, s]) => s.state.d === addDays(SEED_DAY, 1)).map(([id]) => id);
    const lastCellItems = ITEMS.filter((i) => [...i.cells, ...i.asked].includes(lastQuest?.episodeId ?? '')).map((i) => i.id);
    expect(firstDay.some((id) => lastCellItems.includes(id))).toBe(true);
  });

  it('every grid cell is Done', () => {
    expect(Object.keys(seed.cellBest).sort()).toEqual(CATALOG.cells.filter((c) => c.questIds.length > 0).map((c) => c.episodeId).sort());
  });

  it('two devices derive the same states from the same snapshot and memSeededAt', () => {
    const other = deriveSeed(input(structuredClone(snap)));
    expect([...other.states.entries()]).toEqual([...seed.states.entries()]);
    // The order of the quest latch on the other device does not matter.
    const reordered = { ...snap, questDoneAt: Object.fromEntries(Object.entries(snap.questDoneAt ?? {}).reverse()), quests: [...snap.quests].reverse() };
    expect([...deriveSeed(input(reordered)).states.entries()]).toEqual([...seed.states.entries()]);
  });

  it('a story finished seeds its taught words under the story cell', () => {
    const story = CATALOG.quests.find((q) => q.kind === 'story');
    const s = finished(0);
    s.placements = [];
    s.quests = [{ questId: story?.id as string, episodeId: story?.episodeId as string, startedAt: '2026-09-01T00:00:00.000Z', completedAt: '2026-09-01T00:00:00.000Z', stars: 3, attempts: 1, accuracy: 1 }];
    s.questDoneAt = { [story?.id as string]: '2026-09-01T00:00:00.000Z' };
    const out = deriveSeed(input(s));
    const slug = (story?.episodeId as string).slice('episode:shelf-'.length);
    const storyItems = ITEMS.filter((i) => [...i.cells, ...i.asked].includes(`story:${slug}`) && !i.id.startsWith('vocab:'));
    expect(out.count).toBe(storyItems.length);
  });

  it('a priority token naming no taught symbol, or a non-symbol token, seeds nothing extra', () => {
    const s = finished(0);
    s.placements = [{ ...PLACEMENT, priorityTokens: ['syl:ga', 'sym:ㆍ'] }];
    expect(deriveSeed(input(s)).count).toBe(0);
  });
});

describe('seedInputKey: when a device derives its seeded states again', () => {
  const key = (snap: SeedInput['snapshot'], seededAt = SEEDED_AT) => seedInputKey(input(snap, seededAt));

  it('is the same for the same inputs in any order, and changes with every input the derivation reads', () => {
    const snap = finished(20);
    const reordered = { ...snap, questDoneAt: Object.fromEntries(Object.entries(snap.questDoneAt ?? {}).reverse()), quests: [...snap.quests].reverse() };
    expect(key(reordered)).toBe(key(snap));
    expect(key(finished(21))).not.toBe(key(snap));
    const starred = structuredClone(snap);
    (starred.quests[0] as { stars: number }).stars = 3;
    expect(key(starred)).not.toBe(key(snap));
    expect(key({ ...snap, placements: [] })).not.toBe(key(snap));
    expect(key(snap, '2026-10-23T08:00:00.000Z')).not.toBe(key(snap));
    expect(seedInputKey({ ...input(snap), items: ITEMS.slice(1) })).not.toBe(key(snap));
  });

  it('a quest finished after memSeededAt changes nothing', () => {
    const snap = finished(20);
    const later = structuredClone(snap);
    const extra = LESSON_QUESTS[20];
    later.questDoneAt = { ...later.questDoneAt, [extra?.id as string]: '2026-10-25T00:00:00.000Z' };
    expect(key(later)).toBe(key(snap));
  });
});

describe('seedSnapshot: the latch in the snapshot', () => {
  it('sets memSeededAt once, keeps the earliest, and only raises cellBest', () => {
    const snap = finished(0);
    const seeded = seedSnapshot(snap, { memSeededAt: SEEDED_AT, cellBest: { 'episode:stage1-letters': 1 } });
    expect(seeded).toMatchObject({ memSeededAt: SEEDED_AT, cellBest: { 'episode:stage1-letters': 1 } });
    expect(seeded.updatedAt).toBe(snap.updatedAt);
    expect(seedSnapshot(seeded, { memSeededAt: SEEDED_AT, cellBest: { 'episode:stage1-letters': 1 } })).toBe(seeded);
    expect(seedSnapshot(seeded, { memSeededAt: '2026-10-30T00:00:00.000Z', cellBest: {} })).toBe(seeded);
    expect(seedSnapshot(seeded, { memSeededAt: '2026-10-01T00:00:00.000Z', cellBest: {} }).memSeededAt).toBe('2026-10-01T00:00:00.000Z');
    const higher = { ...seeded, cellBest: { 'episode:stage1-letters': 3 as const } };
    expect(seedSnapshot(higher, { memSeededAt: SEEDED_AT, cellBest: { 'episode:stage1-letters': 1 } })).toBe(higher);
  });
});
