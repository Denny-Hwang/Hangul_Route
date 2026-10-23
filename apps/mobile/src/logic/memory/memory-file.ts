import { MemoryItemStateSchema, type MemoryBackup, type MemoryItemState } from '@hangul-route/content-schema';
import { MEMORY_PUSH_MAX_BYTES, MEMORY_PUSH_MAX_SHARDS, MEMORY_PUSH_MAX_STATES, MEMORY_SHARD_RE, mergeMemoryItemState } from '@hangul-route/content-schema/memory';
import type { DayFacts } from './spacing';

/**
 * The memory store of one profile on this device (F-CURR-002 sections 4.8 and 4.9, row CM-12): one
 * stored value per profile (`memory:<profileId>`, IndexedDB on the web and the app's storage on
 * native, through `platform/storage`), so the store is partitioned by profile and the profile key
 * sweep removes it with the rest of a learner's keys. Pure helpers over the stored shape.
 *
 * - `rows`: one per lesson, story or pack item, with its shard, its shared state (the CM-11 wire
 *   shape) and the device-only facts of the spacing rule (`DayFacts`, never uploaded). Only answered
 *   rows (`n` >= 1) are stored (`storedFile`); the seeded rows are derived again in memory from the
 *   snapshot each time the store is read, so a learner's stored value stays small on native storage.
 * - `vf`: the device-only facts of topic words, whose state stays in the snapshot's `vocab` slice.
 * - `pending`: items answered here whose state has not reached the server yet (`n` >= 1 only: a
 *   seeded state is never uploaded).
 * - `cursor`: the server `seq` of the last pull.
 * - `seededFrom`: the `memSeededAt` the seeded states here were derived from.
 * - `day`: today's counts for `memory.daily`; `dailySent` the last local day sent.
 * - `wk`: the Words known count this device last read (row CM-20), so a Words known milestone is celebrated once, on
 *   the Results of the activity that crossed it; absent until the first read, which sets it without a celebration.
 */

export interface MemoryRow extends DayFacts {
  /** The shard (`stage1` .. `stage7`, `pack:<key>`, `week`). */
  sh: string;
  st: MemoryItemState;
}

export interface DayCounts {
  day: string;
  /** `kind|rung|lag` -> [right, wrong], spaced answers only. */
  hist: Record<string, [number, number]>;
  lapses: number;
  /** Distinct items answered that day. */
  items: string[];
  newHeld: number;
  /** The due pool when the day's first answer came. */
  due: number;
}

export interface MemoryFile {
  v: 1;
  rows: Record<string, MemoryRow>;
  vf: Record<string, DayFacts>;
  pending: string[];
  cursor: number;
  seededFrom: string | null;
  day: DayCounts | null;
  dailySent: string | null;
  wk?: number;
}

export function emptyMemoryFile(): MemoryFile {
  return { v: 1, rows: {}, vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null };
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOrUndefined = (v: unknown): string | undefined => (typeof v === 'string' && DAY.test(v) ? v : undefined);
const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

function factsOf(v: Rec): DayFacts {
  const facts: DayFacts = {};
  for (const k of ['l', 'fd', 'p', 'w'] as const) {
    const d = dayOrUndefined(v[k]);
    if (d !== undefined) facts[k] = d;
  }
  return facts;
}

function dayCountsOf(v: unknown): DayCounts | null {
  if (!isRec(v)) return null;
  const day = dayOrUndefined(v.day);
  if (day === undefined) return null;
  const hist: DayCounts['hist'] = {};
  if (isRec(v.hist)) {
    for (const [key, pair] of Object.entries(v.hist)) if (Array.isArray(pair) && pair.length === 2) hist[key] = [count(pair[0]), count(pair[1])];
  }
  const items = Array.isArray(v.items) ? v.items.filter((i): i is string => typeof i === 'string') : [];
  return { day, hist, lapses: count(v.lapses), items, newHeld: count(v.newHeld), due: count(v.due) };
}

/**
 * The stored value, read leniently: a row whose state does not parse drops on its own (as a shard
 * entry does on the wire), anything else unreadable reads as empty. Never throws.
 */
export function readMemoryFile(raw: unknown): MemoryFile {
  const file = emptyMemoryFile();
  if (!isRec(raw)) return file;
  if (isRec(raw.rows)) {
    for (const [id, row] of Object.entries(raw.rows)) {
      if (!isRec(row) || typeof row.sh !== 'string' || !MEMORY_SHARD_RE.test(row.sh)) continue;
      const st = MemoryItemStateSchema.safeParse(row.st);
      if (st.success) file.rows[id] = { sh: row.sh, st: st.data, ...factsOf(row) };
    }
  }
  if (isRec(raw.vf)) for (const [id, facts] of Object.entries(raw.vf)) if (isRec(facts)) file.vf[id] = factsOf(facts);
  if (Array.isArray(raw.pending)) file.pending = [...new Set(raw.pending.filter((id): id is string => typeof id === 'string' && id in file.rows))];
  file.cursor = count(raw.cursor);
  file.seededFrom = typeof raw.seededFrom === 'string' ? raw.seededFrom : null;
  file.day = dayCountsOf(raw.day);
  file.dailySent = dayOrUndefined(raw.dailySent) ?? null;
  if (typeof raw.wk === 'number' && Number.isInteger(raw.wk) && raw.wk >= 0) file.wk = raw.wk;
  return file;
}

/** The value to store: the file without its seeded rows (`n` = 0), which are derived again on the next read. */
export function storedFile(file: MemoryFile): MemoryFile {
  const rows: MemoryFile['rows'] = {};
  for (const [id, row] of Object.entries(file.rows)) if (row.st.n >= 1) rows[id] = row;
  return { ...file, rows };
}

/** Whether a stored value can be read as a store: missing, or an object. Anything else is damaged and is never written over. */
export const readableStore = (raw: unknown): boolean => raw === null || raw === undefined || isRec(raw);

/** Whether the store holds any state at all. */
export const holdsStates = (file: MemoryFile): boolean => Object.keys(file.rows).length > 0;

/** The answered states (`n` >= 1) by shard, for a backup file or a push; a seeded state never leaves the device. */
export function answeredByShard(file: MemoryFile, ids?: readonly string[]): MemoryBackup {
  const out: MemoryBackup = {};
  for (const id of ids ?? Object.keys(file.rows).sort()) {
    const row = file.rows[id];
    if (!row || row.st.n < 1) continue;
    (out[row.sh] ??= {})[id] = row.st;
  }
  return out;
}

/** One push call: its shards and the ids it carries. */
export interface PushBatch {
  shards: MemoryBackup;
  ids: string[];
}

/**
 * The pending answered states as push calls within the CM-11 caps: at most 500 states, 24 shards
 * and 64 KB of JSON a call (kept a little under, so the body never meets a 413).
 */
export function pushBatches(file: MemoryFile, maxStates = MEMORY_PUSH_MAX_STATES, maxBytes = MEMORY_PUSH_MAX_BYTES - 1024): PushBatch[] {
  const batches: PushBatch[] = [];
  let shards: MemoryBackup = {};
  let ids: string[] = [];
  let bytes = 16;
  const close = (): void => {
    if (ids.length > 0) batches.push({ shards, ids });
    shards = {};
    ids = [];
    bytes = 16;
  };
  for (const id of [...file.pending].sort()) {
    const row = file.rows[id];
    if (!row || row.st.n < 1) continue;
    const size = JSON.stringify(id).length + JSON.stringify(row.st).length + 2 + (shards[row.sh] ? 0 : row.sh.length + 6);
    const newShard = shards[row.sh] === undefined;
    if (ids.length >= maxStates || bytes + size > maxBytes || (newShard && Object.keys(shards).length >= MEMORY_PUSH_MAX_SHARDS)) close();
    (shards[row.sh] ??= {})[id] = row.st;
    ids.push(id);
    bytes += size;
  }
  close();
  return batches;
}

/** Equal states (the eight fields). */
export function sameState(a: MemoryItemState, b: MemoryItemState): boolean {
  return a.b === b.b && a.d === b.d && a.c === b.c && a.r === b.r && a.n === b.n && a.f === b.f && a.s === b.s && a.at === b.at;
}

/**
 * Folds states from elsewhere (a pull, a restored backup file) into the store with the shared merge
 * (`mergeMemoryItemState`), keeping this device's facts. An answered state replaces a seeded one
 * whole (the seeded one is only this device's derivation), so a device that seeded before or after
 * another device's first answer to the item ends with the same state. Returns the ids whose state changed. With
 * `markPending`, a changed answered state is queued for the server too (a restored file).
 */
export function foldStates(file: MemoryFile, shards: Readonly<Record<string, Readonly<Record<string, MemoryItemState>>>>, markPending = false): string[] {
  const changed: string[] = [];
  const pending = new Set(file.pending);
  for (const [shard, states] of Object.entries(shards)) {
    if (!MEMORY_SHARD_RE.test(shard)) continue;
    for (const [id, incoming] of Object.entries(states)) {
      const held = file.rows[id];
      // A seeded state here is a derivation, not an answer: an answered state from elsewhere replaces it, as `laySeed` keeps an answered one.
      const merged = held && (held.st.n >= 1 || incoming.n === 0) ? mergeMemoryItemState(held.st, incoming) : incoming;
      if (held && sameState(held.st, merged)) continue;
      file.rows[id] = { ...(held ?? {}), sh: held?.sh ?? shard, st: merged };
      changed.push(id);
      if (markPending && merged.n >= 1) pending.add(id);
    }
  }
  file.pending = [...pending];
  return changed;
}

/**
 * Lays derived seeded states (`n` = 0) over the store: an item with no state, or one that is still
 * seeded, takes the derivation; an answered item keeps its own. A seeded state the derivation no
 * longer names (the seeding moved to an earlier `memSeededAt`) is dropped. Returns how many changed.
 */
export function laySeed(file: MemoryFile, seeded: ReadonlyMap<string, { shard: string; state: MemoryItemState }>, seededFrom: string): number {
  let changed = 0;
  for (const [id, row] of Object.entries(file.rows)) {
    if (row.st.n === 0 && !seeded.has(id)) {
      delete file.rows[id];
      changed += 1;
    }
  }
  for (const [id, { shard, state }] of seeded) {
    const held = file.rows[id];
    if (held && held.st.n >= 1) continue;
    if (held && sameState(held.st, state)) continue;
    file.rows[id] = { ...(held ?? {}), sh: held?.sh ?? shard, st: state };
    changed += 1;
  }
  file.seededFrom = seededFrom;
  return changed;
}
