import { effectiveRoute, type CatalogCell, type CatalogQuest, type MemoryItemState, type ProgressSnapshot } from '@hangul-route/content-schema';
import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { latchQuests } from '../quest-progress';
import { addDays } from '../vocab/srs';
import { MEMORY_MIN_BOX } from './spacing';
import { cellOfEpisode, shardOf } from './resolve';

/**
 * The one-time seeding of an existing learner's memory (F-CURR-002 section 4.8, steps 1-6, row
 * CM-12). Pure and deterministic: the same snapshot, items and `memSeededAt` give the same states on
 * every device in the same time zone, so the seeded states (`n` = 0) are never uploaded and each
 * device derives them again from `questDoneAt` and `memSeededAt`.
 *
 * 1. Every quest done in `questDoneAt` by `memSeededAt` seeds its cell's items (the items it teaches
 *    and those it asks again). Items carry their cells, not their quests, so the box takes the cautious
 *    reading of "box 2 when the quest scored 3 stars": box 2 only when every done quest of the cells
 *    that teach the item scored 3 stars, box 1 otherwise; a cell that only asks it again dates it but
 *    never raises its box. `n` stays 0, so a seeded item counts in no learner-facing number until it
 *    is answered. A snapshot from before `questDoneAt` is latched
 *    first (`latchQuests`, its one-time backfill from `completedAt`).
 * 2. The items are spread from the day after `memSeededAt`, at most 15 a day, so over
 *    `ceil(count / 15)` days: the most recent quest first (the freshest memories are checked while
 *    they can still be recovered), then the stage, then the id.
 * 4. Topic words (`vocab:` ids) are not copied: the engine reads them in the `vocab` slice.
 * 5. The placement's priority symbols come first, at box 1, due on day 1.
 * 6. `cellBest` starts at 1 for every grid cell whose quests are all done.
 * (Step 3, at most 20 due items a session, is the review engine's, row CM-13.)
 */

export const SEED_PER_DAY = 15;

export interface SeedInput {
  snapshot: ProgressSnapshot;
  /** The review items of this build (the lazy chunk), with the retired ids. */
  items: readonly ReviewItem[];
  retired: ReadonlySet<string>;
  /** The catalogue's quests and grid cells (`CATALOG`). */
  quests: readonly Pick<CatalogQuest, 'id' | 'episodeId'>[];
  cells: readonly Pick<CatalogCell, 'episodeId' | 'questIds'>[];
  /** `memSeededAt`: the instant the seeding ran first, on any device. */
  seededAt: string;
  /** The local day of an instant on this device (F-VOC-005 P5). */
  dayOf: (instant: Date) => string;
}

export interface SeededItem {
  shard: string;
  state: MemoryItemState;
}

export interface Seed {
  states: Map<string, SeededItem>;
  /** How many items were seeded. */
  count: number;
  /** Over how many days they fall due (`ceil(count / 15)`). */
  spreadDays: number;
  /** Grid cells whose quests are all done: level 1 (Done). */
  cellBest: Record<string, 1>;
}

const time = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NaN;
};

/** The priority symbols of the route in force (`sym:<jamo>` or `sym:<jamo>/final`) as review items. */
function prioritySymbols(snapshot: ProgressSnapshot, items: readonly ReviewItem[]): ReviewItem[] {
  const seed = effectiveRoute(snapshot.placements ?? [], { quests: [] }, { isEntitled: () => true, completedQuestIds: new Set() });
  if (seed === null) return [];
  const out: ReviewItem[] = [];
  for (const token of seed.priorityTokens) {
    if (!token.startsWith('sym:')) continue;
    const [char, position] = token.slice(4).split('/');
    const final = position === 'final';
    const item = items.find((i) => i.kind === 'sym' && i.ko === char && i.id.endsWith('-batchim') === final);
    if (item !== undefined && !out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * A fingerprint of everything `deriveSeed` reads (row CM-12): the local day of `memSeededAt`, the
 * quests done by it with their finish and whether they scored 3 stars, the route's priority tokens and
 * the item index of this build. A device derives its seeded states again whenever this changes (a sync
 * brought older quests or a placement, a quest's stars rose, a new build), so two devices of one
 * learner end with the same states whatever their snapshot held when each first seeded. Cheap: no
 * item is read.
 */
export function seedInputKey(input: Pick<SeedInput, 'snapshot' | 'items' | 'retired' | 'quests' | 'seededAt' | 'dayOf'>): string {
  const { snapshot, seededAt } = input;
  const cutoff = time(seededAt);
  const latched = latchQuests(snapshot).questDoneAt ?? {};
  const stars = new Map<string, number>(snapshot.quests.map((q) => [q.questId, q.stars]));
  const known = new Set<string>([...input.quests.map((q) => q.id), ...snapshot.quests.map((q) => q.questId)]);
  const done = Object.entries(latched)
    .filter(([questId, at]) => known.has(questId) && time(at) <= cutoff)
    .map(([questId, at]) => `${questId}@${time(at)}${stars.get(questId) === 3 ? '*' : ''}`)
    .sort();
  const route = effectiveRoute(snapshot.placements ?? [], { quests: [] }, { isEntitled: () => true, completedQuestIds: new Set() });
  // Row CM-21: the tested-out cells derive their unasked items the same way (`./test-out.ts`), so they are inputs too.
  const testedOut = Object.entries(snapshot.testedOut ?? {})
    .map(([cell, at]) => `t:${cell}@${time(at)}`)
    .sort();
  const text = [input.dayOf(new Date(seededAt)), `${input.items.length}/${input.retired.size}`, (route?.priorityTokens ?? []).join(','), ...done, ...testedOut].join('|');
  // FNV-1a, 32 bits: a short key held beside the store in memory.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}:${done.length}`;
}

export function deriveSeed(input: SeedInput): Seed {
  const { snapshot, items, retired, seededAt, dayOf } = input;
  const cutoff = time(seededAt);
  const seedDay = dayOf(new Date(seededAt));
  const latched = latchQuests(snapshot).questDoneAt ?? {};
  const episodeOf = new Map<string, string>(input.quests.map((q) => [q.id, q.episodeId]));
  for (const q of snapshot.quests) if (!episodeOf.has(q.questId)) episodeOf.set(q.questId, q.episodeId);
  const starsOf = new Map<string, number>(snapshot.quests.map((q) => [q.questId, q.stars]));

  // The quests done by `memSeededAt`, per teaching cell: the latest finish, the earliest, and whether every one scored 3 stars.
  const byCell = new Map<string, { latest: number; earliest: number; allThree: boolean }>();
  const done = new Set<string>();
  for (const [questId, at] of Object.entries(latched)) {
    const t = time(at);
    const episode = episodeOf.get(questId);
    if (!Number.isFinite(t) || t > cutoff || episode === undefined) continue;
    done.add(questId);
    const cell = cellOfEpisode(episode);
    const held = byCell.get(cell);
    const three = starsOf.get(questId) === 3;
    byCell.set(cell, held ? { latest: Math.max(held.latest, t), earliest: Math.min(held.earliest, t), allThree: held.allThree && three } : { latest: t, earliest: t, allThree: three });
  }

  const priority = prioritySymbols(snapshot, items).filter((i) => !retired.has(i.id));
  const priorityIds = new Set(priority.map((i) => i.id));
  const seeded: Array<{ item: ReviewItem; box: number; latest: number; first: string }> = [];
  for (const item of items) {
    if (item.id.startsWith('vocab:') || retired.has(item.id) || priorityIds.has(item.id)) continue;
    let latest = Number.NEGATIVE_INFINITY;
    let earliest = Number.POSITIVE_INFINITY;
    let teachingDone = 0;
    let allThree = true;
    // The cells that teach it and those that ask it again (a recycle): a done quest of either has shown it.
    for (const cell of [...item.cells, ...item.asked]) {
      const c = byCell.get(cell);
      if (!c) continue;
      latest = Math.max(latest, c.latest);
      earliest = Math.min(earliest, c.earliest);
      if (!item.cells.includes(cell)) continue;
      teachingDone += 1;
      allThree &&= c.allThree;
    }
    if (!Number.isFinite(latest)) continue;
    seeded.push({ item, box: teachingDone > 0 && allThree ? 2 : MEMORY_MIN_BOX, latest, first: dayOf(new Date(earliest)) });
  }
  // The most recent quest first, then the stage, then the id: a total order, so every device agrees.
  seeded.sort((a, b) => b.latest - a.latest || a.item.stage - b.item.stage || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));

  const ordered = [
    ...priority.map((item) => ({ item, box: MEMORY_MIN_BOX, first: seedDay })),
    ...seeded.map(({ item, box, first }) => ({ item, box, first: first < seedDay ? first : seedDay })),
  ];
  const states = new Map<string, SeededItem>();
  ordered.forEach(({ item, box, first }, i) => {
    const d = addDays(seedDay, Math.floor(i / SEED_PER_DAY) + 1);
    states.set(item.id, { shard: shardOf(item), state: { b: box, d, c: 0, r: 0, n: 0, f: first, s: box, at: seededAt } });
  });

  const cellBest: Record<string, 1> = {};
  for (const cell of input.cells) {
    if (cell.questIds.length > 0 && cell.questIds.every((id) => done.has(id))) cellBest[cell.episodeId] = 1;
  }
  return { states, count: ordered.length, spreadDays: Math.ceil(ordered.length / SEED_PER_DAY), cellBest };
}

/**
 * The snapshot with the seeding latched (section 4.8): `memSeededAt` the earliest of the held one and
 * this one (so a seeding is never run twice on a merged copy), and `cellBest` raised to at least the
 * seed's level per cell (max: a level never drops). The same snapshot object when nothing changes.
 */
export function seedSnapshot(snapshot: ProgressSnapshot, seed: { memSeededAt: string; cellBest: Readonly<Record<string, 1>> }): ProgressSnapshot {
  const held = snapshot.memSeededAt;
  const memSeededAt = held !== undefined && time(held) <= time(seed.memSeededAt) ? held : seed.memSeededAt;
  const cellBest = { ...(snapshot.cellBest ?? {}) };
  let raised = false;
  for (const [cell, level] of Object.entries(seed.cellBest)) {
    if ((cellBest[cell] ?? 0) >= level) continue;
    cellBest[cell] = level;
    raised = true;
  }
  if (memSeededAt === held && !raised) return snapshot;
  return { ...snapshot, memSeededAt, cellBest };
}
