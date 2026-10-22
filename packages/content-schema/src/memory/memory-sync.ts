import { z } from 'zod';
import { isDateKey } from '../curriculum/dates';
import { REVIEW_ITEM_ID_RE, ReviewItemIdSchema } from '../review-items/review-item';
import { IsoInstantSchema, lenientRecord } from '../schemas/progress';
import { MemoryItemStateSchema, type MemoryBackup, type MemoryItemState } from '../schemas/sync';

/**
 * The memory store's wire contract and merge (F-CURR-002 section 4.8, row CM-11). One definition
 * serves the Worker (`POST` / `GET /api/sync/learners/:id/memory`, the `memory_shards` table of
 * migration 0016) and the app's memory store (row CM-12), so both merge an item the same way.
 *
 * This module is reached through `@hangul-route/content-schema/memory`, never through the package
 * barrel: the barrel is in the app's start bundle, and only the lazily loaded memory store reads it.
 * The item state itself is `MemoryItemStateSchema` (`schemas/sync.ts`, row CM-3b), which the backup
 * file already reads.
 */

export { MemoryItemStateSchema, type MemoryItemState };

/** A shard: a stage (`stage1` .. `stage7`), a Topic Pack (`pack:<key>`) or `week` (This week in Korea). */
export const MEMORY_SHARD_RE = /^(?:stage[1-7]|pack:[a-z0-9]+(?:-[a-z0-9]+)*|week)$/;
export const MEMORY_SHARD_KEY_MAX = 64;
export const MemoryShardKeySchema = z.string().max(MEMORY_SHARD_KEY_MAX).regex(MEMORY_SHARD_RE);
export type MemoryShardKey = z.infer<typeof MemoryShardKeySchema>;

/**
 * The caps of one `POST .../memory` call: at most 500 changed item states, in a body of 64 KB or
 * less. Anything larger is answered 413 before it is merged. The CPU benchmark of row CM-11
 * (packages/backend/src/lib/__tests__/memory-shards-bench.test.ts) holds a 500-item merge inside
 * the Workers free-tier CPU budget; if it ever does not, this cap is lowered, never raised. With real
 * ids (up to `MEMORY_ITEM_ID_MAX`) a state is about 140 B of JSON, so the byte cap is the one a full
 * queue meets first (about 450 states): the app splits its queue by bytes as well as by count.
 */
export const MEMORY_PUSH_MAX_STATES = 500;
export const MEMORY_PUSH_MAX_BYTES = 64 * 1024;
/**
 * At most 24 shards in one call: the end state has 16 a learner (7 stages, 8 packs, `week`), so this
 * leaves room for new packs while a call can never write more rows than a real sync touches.
 */
export const MEMORY_PUSH_MAX_SHARDS = 24;

/**
 * The longest item id the memory store keeps, on every path: the push, the pull and the backup file's
 * `memory` key (`MemoryBackupSchema`, 64 since row CM-3b). One cap on all three, so an id the Worker
 * stores is never dropped on a pull or a restore. The longest frozen id today is 47 characters, and a
 * content test holds every frozen id and topic word id under this cap.
 */
export const MEMORY_ITEM_ID_MAX = 64;
const MemoryPushItemIdSchema = ReviewItemIdSchema.refine((id) => id.length <= MEMORY_ITEM_ID_MAX);

/**
 * How far ahead of the Worker's clock an item's `at` may be and still count as an answer given now (a
 * clock a little fast): the `goals.setAt` skew of section 13.
 */
export const MEMORY_CLOCK_SKEW_MS = 10 * 60_000;

/** One shard's item states: review item id -> state. */
export type MemoryShardStates = Record<string, MemoryItemState>;

/**
 * A seeded state (`n` = 0, section 4.8) is never uploaded or stored: every device re-derives it
 * from `questDoneAt` and `memSeededAt` by the same deterministic stagger. Only answered items sync.
 */
export const isSeededState = (state: Pick<MemoryItemState, 'n'>): boolean => state.n === 0;

const order = (x: number | string, y: number | string): number => (x < y ? -1 : x > y ? 1 : 0);

/** An instant's time, with one that does not parse ordered first (the schema admits none). */
const instant = (at: string): number => {
  const t = Date.parse(at);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};

/**
 * The order of two schedules (`b`, `d`, `c` with their clock `at`): the later `at` wins; for the
 * same instant the higher box, then the later due day (no due day is the earliest), then the
 * higher rung, and last the `at` text in code-point order, so the order is total and the merge
 * never depends on which side it is handed first.
 */
export function compareSchedule(a: MemoryItemState, b: MemoryItemState): number {
  return order(instant(a.at), instant(b.at)) || order(a.b, b.b) || order(a.d ?? '', b.d ?? '') || order(a.c, b.c) || order(a.at, b.at);
}

/**
 * One item's merge (section 4.8): `b`, `d` and `c` take the winning schedule's values and its `at`
 * (last writer wins, with the tie-break above); `r` is the OR of the rungs ever passed; `n` and `s`
 * take the larger; `f` the earlier first day. Each field is a join on its own order, so the merge is
 * commutative, associative and idempotent: two devices that hold the same states hold the same
 * result, whatever order the states reached them in. A produce miss lowers `c` on one device and
 * keeps the produce bit in `r`, so an older state from another device cannot erase the pass.
 */
export function mergeMemoryItemState(a: MemoryItemState, b: MemoryItemState): MemoryItemState {
  const win = compareSchedule(a, b) >= 0 ? a : b;
  return {
    b: win.b,
    d: win.d,
    c: win.c,
    r: a.r | b.r,
    n: Math.max(a.n, b.n),
    f: a.f <= b.f ? a.f : b.f,
    s: Math.max(a.s, b.s),
    at: win.at,
  };
}

/**
 * Two copies of one shard: every item of either side, merged per item where both hold it. Keys come
 * out in code-point order, so equal content always serializes to the same text (the Worker skips a
 * write that changes nothing).
 */
export function mergeMemoryShard(a: Readonly<MemoryShardStates>, b: Readonly<MemoryShardStates>): MemoryShardStates {
  const out = new Map<string, MemoryItemState>();
  for (const side of [a, b]) {
    for (const id of Object.keys(side)) {
      const state = side[id] as MemoryItemState;
      const prev = out.get(id);
      out.set(id, prev === undefined ? state : mergeMemoryItemState(prev, state));
    }
  }
  const merged: MemoryShardStates = {};
  for (const id of [...out.keys()].sort(order)) merged[id] = out.get(id) as MemoryItemState;
  return merged;
}

/** Two whole memory stores (a backup file and the device's store, or pulled shards): shard by shard. */
export function mergeMemory(a: MemoryBackup | undefined, b: MemoryBackup | undefined): MemoryBackup | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const merged: MemoryBackup = {};
  for (const shard of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(order)) {
    merged[shard] = mergeMemoryShard(a[shard] ?? {}, b[shard] ?? {});
  }
  return merged;
}

/** Two states with the same eight fields: a merge that returns this changed nothing. */
export function sameMemoryItemState(a: MemoryItemState, b: MemoryItemState): boolean {
  return a.b === b.b && a.d === b.d && a.c === b.c && a.r === b.r && a.n === b.n && a.f === b.f && a.s === b.s && a.at === b.at;
}

/**
 * The Worker's clock guard on a pushed state, before it merges (section 13, "A wrong device clock wins
 * every merge"). `at` is the last-writer-wins clock, so an `at` from a device clock set ahead would win
 * `b`, `d` and `c` on the server and on every device that pulls, and freeze that item's schedule until
 * real time passes it:
 *
 * - an `at` later than `now` but within `MEMORY_CLOCK_SKEW_MS` is read as `now`;
 * - an `at` later than that keeps the stored schedule (`b`, `d`, `c` and its `at`) when the server holds
 *   the item, so a later real answer from another device still wins on every later sync, while the
 *   grow-only fields (`r`, `n`, `f`, `s`) still merge; with nothing stored it is read as `now`.
 *
 * Kept out of the merge itself, which stays pure and free of a clock. Returns the state itself when its
 * `at` is not ahead. Row CM-12 caps the `at` it writes at the last server time seen, so it stops.
 */
export function boundMemoryStateToNow(state: MemoryItemState, stored: MemoryItemState | undefined, now: Date): MemoryItemState {
  const t = Date.parse(state.at);
  const nowMs = now.getTime();
  if (!(t > nowMs)) return state;
  if (t <= nowMs + MEMORY_CLOCK_SKEW_MS || stored === undefined) return { ...state, at: now.toISOString() };
  return { ...state, b: stored.b, d: stored.d, c: stored.c, at: stored.at };
}

/** The item states of a call or a store, without the seeded ones (`n` = 0), shard by shard; a shard left empty drops. */
export function withoutSeeded(shards: Readonly<Record<string, Readonly<MemoryShardStates>>>): Record<string, MemoryShardStates> {
  const kept: Record<string, MemoryShardStates> = {};
  for (const [shard, states] of Object.entries(shards)) {
    const answered = Object.entries(states).filter(([, state]) => !isSeededState(state));
    if (answered.length > 0) kept[shard] = Object.fromEntries(answered);
  }
  return kept;
}

/**
 * `POST /api/sync/learners/:id/memory`: the changed item states, grouped by shard. Strict: a state
 * that does not parse is a 422, so a device learns of a bug instead of losing an answer silently.
 * Unknown fields of a state are dropped, so a newer build's extra field never fails an older Worker.
 */
export const MemoryPushSchema = z.object({
  shards: z.record(MemoryShardKeySchema, z.record(MemoryPushItemIdSchema, MemoryItemStateSchema)),
});
export type MemoryPush = z.infer<typeof MemoryPushSchema>;

export type MemoryPushParse = { success: true; data: MemoryPush } | { success: false; issues: Array<{ path: Array<string | number>; code: 'invalid' }> };

/** `VocabIdSchema`'s rule: a topic word keeps its id as a review item (section 4.2). */
const VOCAB_ID_RE = /^vocab:[a-z0-9]+(-[a-z0-9]+)*$/;
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIntIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * `MemoryPushSchema.safeParse`, by hand, for the Worker's hot path: the same rules and the same output
 * (each state rebuilt with only its eight fields), at a fraction of the CPU, because a 500-state call
 * must merge inside the free-tier CPU limit (section 19, assumption 8). Day and instant checks are
 * remembered within one call, since most states share a few days. A property test holds it equal to
 * the schema on valid and broken bodies alike. Fails on the first bad entry, with its path.
 */
export function parseMemoryPush(body: unknown): MemoryPushParse {
  const failAt = (...path: Array<string | number>): MemoryPushParse => ({ success: false, issues: [{ path, code: 'invalid' }] });
  if (!isPlainObject(body)) return failAt();
  const shards = body.shards;
  if (!isPlainObject(shards)) return failAt('shards');
  const days = new Map<string, boolean>();
  const instants = new Map<string, boolean>();
  const isDay = (v: unknown): v is string => {
    if (typeof v !== 'string') return false;
    let known = days.get(v);
    if (known === undefined) days.set(v, (known = isDateKey(v)));
    return known;
  };
  const isInstant = (v: unknown): v is string => {
    if (typeof v !== 'string') return false;
    let known = instants.get(v);
    if (known === undefined) instants.set(v, (known = IsoInstantSchema.safeParse(v).success));
    return known;
  };
  const out: MemoryPush['shards'] = {};
  for (const shard of Object.keys(shards)) {
    if (shard.length > MEMORY_SHARD_KEY_MAX || !MEMORY_SHARD_RE.test(shard)) return failAt('shards', shard);
    const states = shards[shard];
    if (!isPlainObject(states)) return failAt('shards', shard);
    const kept: MemoryShardStates = {};
    for (const id of Object.keys(states)) {
      if (id.length > MEMORY_ITEM_ID_MAX || (!REVIEW_ITEM_ID_RE.test(id) && !VOCAB_ID_RE.test(id))) return failAt('shards', shard, id);
      const v = states[id];
      if (!isPlainObject(v)) return failAt('shards', shard, id);
      const { b, d, c, r, n, f, s, at } = v;
      if (!isIntIn(b, 0, 7) || !(d === null || isDay(d)) || !isIntIn(c, 0, 3) || !isIntIn(r, 0, 7) || !isIntIn(n, 0, Number.POSITIVE_INFINITY) || !isDay(f) || !isIntIn(s, 0, 7) || !isInstant(at)) {
        return failAt('shards', shard, id);
      }
      kept[id] = { b, d, c, r, n, f, s, at };
    }
    out[shard] = kept;
  }
  return { success: true, data: { shards: out } };
}

/**
 * How many item states a push body names, read from the raw JSON before it is validated, so a
 * 501-state call is a 413 whatever its states hold. A body without a `shards` object counts 0
 * (it fails validation next).
 */
export function countPushedStates(body: unknown): number {
  if (typeof body !== 'object' || body === null) return 0;
  const shards = (body as { shards?: unknown }).shards;
  if (typeof shards !== 'object' || shards === null || Array.isArray(shards)) return 0;
  let count = 0;
  for (const states of Object.values(shards)) {
    if (typeof states === 'object' && states !== null && !Array.isArray(states)) count += Object.keys(states).length;
  }
  return count;
}

/** How many shards a push body names, read from the raw JSON like `countPushedStates`. */
export function countPushedShards(body: unknown): number {
  if (typeof body !== 'object' || body === null) return 0;
  const shards = (body as { shards?: unknown }).shards;
  return typeof shards === 'object' && shards !== null && !Array.isArray(shards) ? Object.keys(shards).length : 0;
}

/** The answer to a push: states stored, seeded states left out, and how many shard rows the call wrote. */
export const MemoryPushResultSchema = z.object({
  stored: z.number().int().nonnegative(),
  seeded: z.number().int().nonnegative(),
  written: z.number().int().nonnegative(),
});
export type MemoryPushResult = z.infer<typeof MemoryPushResultSchema>;

/** `GET .../memory?since=<seq>`: the cursor a device last read, 0 for everything. */
export const MemoryCursorSchema = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const MemoryItemKeySchema = z.string().min(1).max(MEMORY_ITEM_ID_MAX);

/**
 * One shard as the pull returns it: whole, with the server `seq` it was last written at. Read
 * leniently on the device: an item state that does not parse drops on its own.
 */
export const MemoryPulledShardSchema = z.object({
  shard: MemoryShardKeySchema,
  seq: z.number().int().positive(),
  states: lenientRecord(MemoryItemKeySchema, MemoryItemStateSchema, Number.MAX_SAFE_INTEGER).transform((states) => states ?? {}),
});
export type MemoryPulledShard = z.infer<typeof MemoryPulledShardSchema>;

/**
 * The pull: every shard written after the cursor, in `seq` order, and the new cursor (the highest
 * `seq` returned, or the sent cursor when nothing is newer). Paging uses the server's `seq`, never a
 * device's `at`, so a late offline upload with an old `at` still reaches every other device. A
 * shard that does not parse drops on its own; the cursor still moves past it.
 */
export const MemoryPullSchema = z.object({
  cursor: z.number().int().nonnegative(),
  shards: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row) => {
      const parsed = MemoryPulledShardSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});
export type MemoryPull = z.infer<typeof MemoryPullSchema>;

/** The pulled shards as one memory store (shard -> item id -> state), for a merge into the device's store. */
export function pulledMemory(pull: Pick<MemoryPull, 'shards'>): MemoryBackup {
  const store: MemoryBackup = {};
  for (const row of pull.shards) store[row.shard] = mergeMemoryShard(store[row.shard] ?? {}, row.states);
  return store;
}
