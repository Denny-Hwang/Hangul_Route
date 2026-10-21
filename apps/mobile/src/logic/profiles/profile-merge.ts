/**
 * [OA] Several tabs share one profile list (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16; row OA-4a). Pure: the
 * profile store reads, merges and writes `hr:profiles` inside the `hr:profiles` Web Lock, or, where Web Locks are
 * missing, re-reads the stored list just before each change and merges it with its own the same way.
 *
 * - **By id.** The stored list is the truth for every id it holds (another tab wrote it last), in its order; an id
 *   only this tab holds and has never seen stored is kept after it (a learner just added here whose write has not
 *   landed). A stored id this tab has never seen is kept (a learner added in another tab survives a change here).
 * - **A removal wins.** An id in the tombstone set (`hr:profiles:tombstones`) is dropped from both sides, so a tab
 *   still holding a removed learner can never bring it back. Tombstones are pruned after `TOMBSTONE_KEEP_MS`.
 * - **This tab's removals.** An id this tab has seen and no longer holds was removed here: it is not taken back from
 *   the stored list either (the tombstone write may still be on its way).
 */

/** [OA] How long a removed id is remembered for the merge (30 days, section 13.1). */
export const TOMBSTONE_KEEP_MS = 30 * 24 * 60 * 60_000;

/**
 * [OA] `hr:profiles:tombstones`: the removed ids (`ids`, section 13.1) and when each was removed (`at`, epoch ms, for
 * the 30-day prune). Holds ids only, never a name.
 */
export interface ProfileTombstones {
  v: 1;
  ids: string[];
  at: Record<string, number>;
}

export const EMPTY_TOMBSTONES: ProfileTombstones = Object.freeze({ v: 1, ids: [], at: {} }) as ProfileTombstones;

const PROFILE_ID = /^profile:[a-z0-9-]+$/;

/** A stored tombstone record, leniently: anything that is not one reads as none; a malformed id is dropped. */
export function parseTombstones(raw: unknown): ProfileTombstones {
  if (typeof raw !== 'object' || raw === null) return EMPTY_TOMBSTONES;
  const record = raw as { v?: unknown; ids?: unknown; at?: unknown };
  if (record.v !== 1 || !Array.isArray(record.ids)) return EMPTY_TOMBSTONES;
  const times = typeof record.at === 'object' && record.at !== null ? (record.at as Record<string, unknown>) : {};
  const ids = [...new Set(record.ids.filter((id): id is string => typeof id === 'string' && PROFILE_ID.test(id)))];
  const at: Record<string, number> = {};
  for (const id of ids) {
    const t = times[id];
    at[id] = typeof t === 'number' && Number.isFinite(t) ? t : 0;
  }
  return { v: 1, ids, at };
}

/** The record with `id` removed at `now` (a second removal keeps the first time). */
export function addTombstone(record: ProfileTombstones, id: string, now: number): ProfileTombstones {
  if (record.ids.includes(id)) return record;
  return { v: 1, ids: [...record.ids, id], at: { ...record.at, [id]: now } };
}

/**
 * The record without `id`: a learner added here again under the same id (a restore from a file, a Rescue Code or a
 * cloud claim keep it, OA-D13) is no longer removed. Returns the same record when `id` is not in it.
 */
export function removeTombstone(record: ProfileTombstones, id: string): ProfileTombstones {
  if (!record.ids.includes(id)) return record;
  const at: Record<string, number> = { ...record.at };
  delete at[id];
  return { v: 1, ids: record.ids.filter((x) => x !== id), at };
}

/**
 * The stored `hr:profiles` value as a list to merge: anything that is not an array is none, and an item that is not
 * an object with a string id is left out (a damaged item never stops every later write). Never mutates its input.
 */
export function storedProfileItems<T extends { id: string }>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is T => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string' && (item as { id: string }).id !== '');
}

/**
 * The record without the ids removed `TOMBSTONE_KEEP_MS` or more ago. A time in the future (a clock that ran back)
 * is kept until the clock passes it. Returns the same record when nothing goes.
 */
export function pruneTombstones(record: ProfileTombstones, now: number): ProfileTombstones {
  const ids = record.ids.filter((id) => now - (record.at[id] ?? 0) < TOMBSTONE_KEEP_MS);
  if (ids.length === record.ids.length) return record;
  const at: Record<string, number> = {};
  for (const id of ids) at[id] = record.at[id] ?? 0;
  return { v: 1, ids, at };
}

/**
 * The merged list (see the module comment). `seen` is every id this tab has read or written; `removed` the tombstoned
 * ids. Never mutates its inputs.
 */
export function mergeProfileLists<T extends { id: string }>(input: {
  stored: readonly T[];
  local: readonly T[];
  seen: ReadonlySet<string>;
  removed: readonly string[];
}): T[] {
  const removed = new Set(input.removed);
  const localIds = new Set(input.local.map((p) => p.id));
  const out: T[] = [];
  const taken = new Set<string>();
  for (const p of input.stored) {
    if (removed.has(p.id) || taken.has(p.id)) continue;
    // Seen here before and gone from this tab: removed here, so the stored copy is not taken back.
    if (input.seen.has(p.id) && !localIds.has(p.id)) continue;
    out.push(p);
    taken.add(p.id);
  }
  for (const p of input.local) {
    if (removed.has(p.id) || taken.has(p.id)) continue;
    out.push(p);
    taken.add(p.id);
  }
  return out;
}

/** Whether two lists hold the same profiles in the same order (shallow: the same objects, or equal JSON). */
export function sameProfileList(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i] || JSON.stringify(x) === JSON.stringify(b[i]));
}
