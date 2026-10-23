import type { MemoryItemState, ProgressSnapshot } from '@hangul-route/content-schema';
import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { addDays } from '../vocab/srs';
import { shardOf } from './resolve';
import { SEED_PER_DAY, type SeededItem } from './seed';
import { LADDER_DONE, MEMORY_MIN_BOX, RUNG_INDEX, type Answer } from './spacing';

/**
 * The memory side of a test-out (F-CURR-002 section 4.5 "Test-out details", row CM-21). Pure; part of the memory
 * chunk.
 *
 * - **Asked items** (`testOutPlacement`): an item the learner had not met yet is placed by its result instead of the
 *   spacing rule's "met today, box 1": a first-try, unhinted right answer goes to box 2, due in 3 days; on a passed
 *   test-out a miss (or a hinted answer) goes to box 1, due tomorrow. On a test-out that did not pass, a missed item stays
 *   unmet: the cell stays unstarted and its first quest teaches it (design/wireframes/reviews/cell-check.md, States).
 *   An item already met (a seeded or answered state at box 1 or higher) follows the spacing rule like any answer, so a
 *   test-out never moves a held box up two steps nor down by more than the rule allows.
 * - **Unasked items** (`deriveTestedOut`): the hand-off of rows CM-11 and CM-12 (section 4.8) leaves the choice to this
 *   row; they are **derived**, never recorded. Every item the tested-out cell teaches gets a seeded-style state
 *   (`n` = 0: never uploaded, never counted in Words known or a level) at box 1, due over the 3 days after the
 *   test-out's local day, at most `SEED_PER_DAY` (15) seeded items due on one day with the quest seeding's load counted
 *   in, so the first reviews check them. The derivation reads only `testedOut`, the item index and the seeded states,
 *   so two devices of one learner derive the same states, as the quest seeding does; an asked item is answered
 *   (`n` >= 1), so `laySeed` keeps its own state over the derived one.
 */

/** Unasked items fall due over this many days after the test-out (section 4.5). */
export const TEST_OUT_SPREAD_DAYS = 3;
/** A right answer to an unmet item: box 2, due in 3 days (section 4.5). */
export const TEST_OUT_RIGHT_BOX = 2;

const VOCAB = 'vocab:';
const time = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

/** FNV-1a, 32 bits: the deterministic order of a cell's unasked items (the engine's jitter, kept here so the seeding needs no engine). */
function order(seed: string, id: string): number {
  let h = 0x811c9dc5;
  const text = `${seed}\u0000${id}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The items a cell teaches that the memory store schedules: its own `cells`, not retired, not a topic word (those live in the `vocab` slice). */
export function cellStoreItems(items: readonly Pick<ReviewItem, 'id' | 'cells'>[], retired: ReadonlySet<string>, cellId: string): string[] {
  return items.filter((i) => i.cells.includes(cellId) && !retired.has(i.id) && !i.id.startsWith(VOCAB)).map((i) => i.id);
}

/**
 * The state of an asked item the learner had not met (no state, or box 0), placed by its result; null when it stays
 * unmet (a miss on a test-out that did not pass). `prevS` keeps a best box that only grows.
 */
export function testOutPlacement(answer: Answer, passed: boolean, today: string, at: string, prev?: Pick<MemoryItemState, 's' | 'n' | 'r' | 'c'>): MemoryItemState | null {
  const right = answer.correct && answer.hinted !== true;
  const idx = RUNG_INDEX[answer.rung];
  const n = (prev?.n ?? 0) + 1;
  if (right) {
    const r = (prev?.r ?? 0) | ((1 << (idx + 1)) - 1);
    const c = Math.max(prev?.c ?? 0, Math.min(LADDER_DONE, idx + 1));
    return { b: TEST_OUT_RIGHT_BOX, d: addDays(today, 3), c, r, n, f: today, s: Math.max(prev?.s ?? 0, TEST_OUT_RIGHT_BOX), at };
  }
  if (!passed) return null;
  const c = !answer.correct && idx === RUNG_INDEX.produce ? RUNG_INDEX.read : (prev?.c ?? 0);
  return { b: MEMORY_MIN_BOX, d: addDays(today, 1), c, r: prev?.r ?? 0, n, f: today, s: Math.max(prev?.s ?? 0, MEMORY_MIN_BOX), at };
}

export interface TestedOutInput {
  testedOut: ProgressSnapshot['testedOut'];
  items: readonly Pick<ReviewItem, 'id' | 'cells' | 'home' | 'stage'>[];
  retired: ReadonlySet<string>;
  /** The quest seeding's states (section 4.8): they keep their place, and their due days count toward the day cap. */
  seeded: ReadonlyMap<string, SeededItem>;
  /** The local day of an instant on this device (F-VOC-005 P5). */
  dayOf: (instant: Date) => string;
}

/**
 * The unasked items of every tested-out cell, as seeded-style states (`n` = 0). The cells in the order they were
 * tested out (then by id), each cell's items in a seeded order; each item goes to the first of the 3 days after the
 * test-out (round robin from its place in the order) that holds fewer than 15 seeded items due, else the first later
 * day that does. An item the quest seeding holds, or an earlier tested-out cell placed, keeps that state.
 */
export function deriveTestedOut(input: TestedOutInput): Map<string, SeededItem> {
  const out = new Map<string, SeededItem>();
  const entries = Object.entries(input.testedOut ?? {}).sort(([a, at], [b, bt]) => time(at) - time(bt) || (a < b ? -1 : a > b ? 1 : 0));
  if (entries.length === 0) return out;
  const byId = new Map(input.items.map((i) => [i.id, i]));
  const load = new Map<string, number>();
  for (const { state } of input.seeded.values()) if (state.n === 0 && state.d !== null) load.set(state.d, (load.get(state.d) ?? 0) + 1);
  for (const [cellId, at] of entries) {
    if (!Number.isFinite(time(at))) continue;
    const day = input.dayOf(new Date(at));
    const ids = cellStoreItems(input.items, input.retired, cellId)
      .filter((id) => !input.seeded.has(id) && !out.has(id))
      .sort((a, b) => order(cellId, a) - order(cellId, b) || (a < b ? -1 : 1));
    ids.forEach((id, i) => {
      let due: string | undefined;
      for (let k = 0; k < TEST_OUT_SPREAD_DAYS && due === undefined; k += 1) {
        const d = addDays(day, 1 + ((i + k) % TEST_OUT_SPREAD_DAYS));
        if ((load.get(d) ?? 0) < SEED_PER_DAY) due = d;
      }
      for (let k = TEST_OUT_SPREAD_DAYS + 1; due === undefined; k += 1) {
        const d = addDays(day, k);
        if ((load.get(d) ?? 0) < SEED_PER_DAY) due = d;
      }
      load.set(due, (load.get(due) ?? 0) + 1);
      const item = byId.get(id) as Pick<ReviewItem, 'home' | 'stage'>;
      out.set(id, { shard: shardOf(item), state: { b: MEMORY_MIN_BOX, d: due, c: 0, r: 0, n: 0, f: day, s: MEMORY_MIN_BOX, at } });
    });
  }
  return out;
}
