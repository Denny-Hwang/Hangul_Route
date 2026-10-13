import { StageKeySchema, type RouteGoal, type StageKey } from '@hangul-route/content-schema';
import type { MyRouteModel, SeenRecord } from './types';

/**
 * "New quests joined" and the one-time fill (F-ROUTE-001 section 3.10). The
 * per-device key `route-map-ui:<profileId>` is never synced. Storage goes
 * through the injected port (the screen passes `platform/storage`'s
 * `readJson` / `writeJson`); every read and write is wrapped, and a failure
 * shows nothing. `seen` is written only for the active profile, never in
 * read-only mode.
 */

export interface JsonStorage {
  readJson<T>(key: string): Promise<T | null>;
  writeJson<T>(key: string, value: T): Promise<void>;
}

export const seenKey = (profileId: string): string => `route-map-ui:${profileId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A well-formed record, or undefined. Unknown stage keys and bad totals are dropped. */
export function parseSeen(raw: unknown): SeenRecord | undefined {
  if (!isRecord(raw) || !isRecord(raw.totals) || typeof raw.at !== 'string') return undefined;
  const { doneKeys } = raw;
  if (!Array.isArray(doneKeys) || !doneKeys.every((k): k is string => typeof k === 'string')) return undefined;
  const totals: Partial<Record<StageKey, number>> = {};
  for (const stage of StageKeySchema.options) {
    const n = raw.totals[stage];
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) totals[stage] = n;
  }
  // A malformed `goalsReached` is dropped on its own: it never costs the rest of the record.
  const { goalsReached } = raw;
  const goals = Array.isArray(goalsReached) ? goalsReached.filter((k): k is string => typeof k === 'string') : undefined;
  return { totals, doneKeys: [...doneKeys], at: raw.at, ...(goals === undefined ? {} : { goalsReached: goals }) };
}

export async function readSeen(storage: JsonStorage, profileId: string): Promise<SeenRecord | undefined> {
  try {
    return parseSeen(await storage.readJson<unknown>(seenKey(profileId)));
  } catch {
    return undefined;
  }
}

/** Returns whether the record was written. Read-only mode never writes. */
export async function writeSeen(
  storage: JsonStorage,
  profileId: string,
  record: SeenRecord,
  opts: { readOnly: boolean },
): Promise<boolean> {
  if (opts.readOnly) return false;
  try {
    await storage.writeJson(seenKey(profileId), record);
    return true;
  } catch {
    return false;
  }
}

const donePipKeys = (model: MyRouteModel): string[] =>
  model.stages.flatMap((s) => [...s.pips, ...s.newPips]).filter((p) => p.state === 'done').map((p) => p.key);

/**
 * What the page saw on this open: the grid quest total per stage, the done
 * pips, the time. The goals already celebrated carry over from `previous`, so
 * a new open never shows a first reached moment twice.
 */
export function seenFrom(model: MyRouteModel, now: Date, previous?: SeenRecord): SeenRecord {
  const totals: Partial<Record<StageKey, number>> = {};
  for (const s of model.stages) totals[s.stage] = s.pips.filter((p) => p.kind === 'quest').length + s.newPips.length;
  const goals = previous?.goalsReached;
  return { totals, doneKeys: donePipKeys(model), at: now.toISOString(), ...(goals === undefined ? {} : { goalsReached: [...goals] }) };
}

/** The `goalsReached` key of a goal (Learning Route amendment section 4.5): `${from}:${sourceId ?? '-'}:${stage}`. */
export const goalReachedKey = (goal: Pick<RouteGoal, 'from' | 'sourceId' | 'stage'>): string => `${goal.from}:${goal.sourceId ?? '-'}:${goal.stage}`;

/** The goals this device already celebrated; a missing value reads as `[]`. */
export const goalsReachedOf = (seen: SeenRecord | undefined): string[] => [...(seen?.goalsReached ?? [])];

/** True the first time a reached goal shows on this device: reached, and its key not yet in `goalsReached`. */
export function isFirstGoalReached(goal: RouteGoal | null, seen: SeenRecord | undefined): boolean {
  return goal !== null && goal.reached && !goalsReachedOf(seen).includes(goalReachedKey(goal));
}

/** The record with the goal's key added once; the same record when the key is already there. */
export function withGoalReached(record: SeenRecord, goal: Pick<RouteGoal, 'from' | 'sourceId' | 'stage'>): SeenRecord {
  const key = goalReachedKey(goal);
  const goals = goalsReachedOf(record);
  return goals.includes(key) ? record : { ...record, goalsReached: [...goals, key] };
}

/** The one calm line under the hero: the first stage with new quests since the last open. */
export function newQuestsLine(model: MyRouteModel): { stage: StageKey; order: number; count: number } | null {
  const row = model.stages.find((s) => s.newSinceSeen > 0);
  return row ? { stage: row.stage, order: row.order, count: row.newSinceSeen } : null;
}

/** Pips done since the last open (the one-time fill). Nothing on the very first open. */
export function newlyDoneKeys(model: MyRouteModel, seen: SeenRecord | undefined): string[] {
  if (seen === undefined) return [];
  const had = new Set(seen.doneKeys);
  return donePipKeys(model).filter((key) => !had.has(key));
}

/** Hoya cheers on the first open after a newly completed episode; otherwise idles. */
export function hoyaPoseFor(model: MyRouteModel, seen: SeenRecord | undefined): 'idle' | 'cheering' {
  const fresh = new Set(newlyDoneKeys(model, seen));
  const justCompleted = model.stages
    .flatMap((s) => s.cells)
    .some((c) => c.state === 'complete' && c.pips.some((p) => fresh.has(p.key)));
  return justCompleted ? 'cheering' : 'idle';
}
