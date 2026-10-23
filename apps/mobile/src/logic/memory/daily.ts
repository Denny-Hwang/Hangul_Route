import { CURR_TELEMETRY_PAYLOADS, LAG_BUCKETS, REVIEW_ITEM_KINDS, REVIEW_RUNGS, ROLLUP_ITEM_COUNT_EDGES, rollupBucketCode, type SessionLog } from '@hangul-route/content-schema';
import { addDays } from '../vocab/srs';
import type { DayCounts, MemoryFile } from './memory-file';
import { lagBucket, type Rung } from './spacing';

/**
 * `memory.daily` (F-CURR-002 sections 3.1, 3.2 and 11.3, TELEMETRY-NAMES-2 section R, row CM-12):
 * one event a profile-day, built on the device from that day's counts, so per-item answers never
 * leave it. Pure.
 *
 * - `hist`: spaced answers by item kind x rung x lag bucket (days since the item's previous spaced
 *   answer, or its first day), right and wrong, each cell once: G1 reads the 4-7 and 8-14 lags.
 * - `lapses`: spaced answers that were not right first time.
 * - `items`: distinct items answered; `newHeld`: items whose best box reached 3 that day (G3).
 * - `minutes`: the day's study minutes from the session log (sessions logged on that local day).
 * - `durableWeekBucket`: the north star, items with a durable answer (spaced, right, 7 or more days
 *   after the previous spaced answer) on that day or the 6 before, as a bucket.
 * - `dueVolumeBucket`: the due pool when the day's first answer came, as a bucket.
 * - No `calib` (row CM-72) and no `arms` (row CM-71) yet.
 */

export type MemoryDailyPayload = ReturnType<(typeof CURR_TELEMETRY_PAYLOADS)['memory.daily']['parse']>;

/** Today's counts, opened with the due pool at the first answer. */
export function openDay(day: string, due: number): DayCounts {
  return { day, hist: {}, lapses: 0, items: [], newHeld: 0, due };
}

export interface CountedAnswer {
  id: string;
  kind: string;
  rung: Rung;
  spaced: boolean;
  lagDays: number | null;
  right: boolean;
  lapse: boolean;
  newHeld: boolean;
}

/** Adds one recorded answer to the day's counts. */
export function countAnswer(day: DayCounts, a: CountedAnswer): void {
  if (!day.items.includes(a.id)) day.items.push(a.id);
  if (a.spaced && a.lagDays !== null) {
    const key = `${a.kind}|${a.rung}|${lagBucket(a.lagDays)}`;
    const cell = (day.hist[key] ??= [0, 0]);
    cell[a.right ? 0 : 1] += 1;
  }
  if (a.lapse) day.lapses += 1;
  if (a.newHeld) day.newHeld += 1;
}

/** Items with a durable answer in the 7 local days ending on `day` (memory store and topic words). */
export function durableWeek(file: Pick<MemoryFile, 'rows' | 'vf'>, day: string): number {
  const from = addDays(day, -6);
  let n = 0;
  for (const facts of [...Object.values(file.rows), ...Object.values(file.vf)]) if (facts.w !== undefined && facts.w >= from && facts.w <= day) n += 1;
  return n;
}

/** Whole study minutes on `day`, from the sessions logged on that local day (capped at a day). */
export function studyMinutes(sessions: readonly Pick<SessionLog, 'localDay' | 'durationSeconds'>[], day: string): number {
  const seconds = sessions.reduce((sum, s) => (s.localDay === day ? sum + (s.durationSeconds ?? 0) : sum), 0);
  return Math.min(1440, Math.floor(seconds / 60));
}

const MAX_COUNT = 100_000;
const cap = (n: number): number => Math.min(MAX_COUNT, Math.max(0, Math.floor(n)));

/** The `memory.daily` payload for a finished day, or undefined when it does not parse (it is then not sent). */
export function memoryDailyPayload(day: DayCounts, durable: number, minutes: number): MemoryDailyPayload | undefined {
  const hist: MemoryDailyPayload['hist'] = [];
  for (const kind of REVIEW_ITEM_KINDS) {
    for (const rung of REVIEW_RUNGS) {
      for (const lag of LAG_BUCKETS) {
        const cell = day.hist[`${kind}|${rung}|${lag}`];
        if (cell && cell[0] + cell[1] > 0) hist.push({ kind, rung, lag, right: cap(cell[0]), wrong: cap(cell[1]) });
      }
    }
  }
  const payload = {
    hist,
    lapses: cap(day.lapses),
    items: cap(day.items.length),
    newHeld: cap(day.newHeld),
    minutes: Math.min(1440, cap(minutes)),
    durableWeekBucket: rollupBucketCode(cap(durable), ROLLUP_ITEM_COUNT_EDGES),
    dueVolumeBucket: rollupBucketCode(cap(day.due), ROLLUP_ITEM_COUNT_EDGES),
  };
  const parsed = CURR_TELEMETRY_PAYLOADS['memory.daily'].safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}
