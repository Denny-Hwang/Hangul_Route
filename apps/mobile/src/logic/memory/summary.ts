import { dayLogPoints, type MemorySummary, type ProgressSnapshot, type VocabItemState } from '@hangul-route/content-schema';
import { addDays, isDue } from '../vocab/srs';
import { vocabOf } from '../vocab/progress';
import type { MemoryRow } from './memory-file';
import { isItemDue } from './spacing';

/**
 * The `memory` block of the progress summary (F-CURR-002 sections 4.4 and 4.8, row CM-16), computed on the device
 * from the profile's memory store and its snapshot, and carried by the existing snapshot PUT. Pure; part of the memory
 * chunk. Grown-ups read it in reports, the console and (row CM-63) `class-review` (section 4.9); no learner screen
 * reads it in this row, and a learner never sees any of it as a percentage (section 3.4).
 *
 * - `wordsKnown`: `lex` items (lesson words) at best box 2 or higher with at least one real answer (`n` >= 1) of which
 *   at least one was right (`r` >= 1), plus topic words at best box 2 or higher with a recorded answer (`seen` >= 1).
 *   A seeded box alone never counts, nor a seeded box followed only by wrong answers (seeding writes `s` with `n` 0,
 *   and a wrong answer leaves `s` where it was). Only monotonic fields are read (`s`, `r`, `n`, `bestBox`, `seen`),
 *   retired items included, so the count never drops.
 * - `readyToRefresh`: the due pool today (memory items that are not retired and topic words), seeded items included,
 *   as the runtime's own `duePool`.
 * - `cellBestCounts`: episodes (cells and pack levels) at `cellBest` level 1, 2 and 3. Row CM-12 seeds level 1; row
 *   CM-20 latches the derived levels (`./mastery.ts`), so levels 2 and 3 show here as they are reached.
 * - `stageChecks`: Stage Checks passed (`stageCheckAt` keys).
 * - `weekPoints`: the points of this ISO week, Monday to today, from `dayLog` (row CM-17); 0 without it.
 * - `topDue`: up to 8 due item ids in selection order (section 4.3): the lowest box first, then the oldest due day,
 *   then a jitter seeded by the item id, so it is deterministic.
 * - `reviewOn`: present (true) only while the profile has the review surface (`dailyReview`, row CM-14), so a report
 *   shows `readyToRefresh` only when the learner can act on it, never during the `memoryRecord` shadow period.
 */

/** A word is known from this best box (section 4.4). */
export const WORDS_KNOWN_BOX = 2;
/** `MemorySummarySchema`'s bound on every count: a block always parses. */
export const MEMORY_SUMMARY_COUNT_MAX = 100_000;
const TOP_DUE_MAX = 8;
const LEX = 'lex:';

export interface MemorySummaryInput {
  rows: Readonly<Record<string, Pick<MemoryRow, 'st'>>>;
  retired: ReadonlySet<string>;
  snapshot: Pick<ProgressSnapshot, 'cellBest' | 'stageCheckAt' | 'dayLog' | 'vocab'>;
  /** The device's local day. */
  today: string;
  /** Whether the profile has the review surface (`currFlagOn('dailyReview')`). */
  reviewOn?: boolean;
}

const cap = (n: number): number => Math.min(n, MEMORY_SUMMARY_COUNT_MAX);

/** The Monday of the ISO week a local day is in (`YYYY-MM-DD`), Monday to Sunday in every locale. */
export function weekStartOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** A 32-bit FNV-1a hash of an id: the selection jitter, the same on every device. */
function jitterOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

interface Due {
  id: string;
  box: number;
  due: string;
}

/**
 * Words known (section 4.4, the rule above): the summary's count, and the counter on Home and the Learning Route
 * (row CM-20), so the two never disagree.
 */
export function wordsKnownOf(rows: MemorySummaryInput['rows'], snapshot: Pick<ProgressSnapshot, 'vocab'>): number {
  let n = 0;
  for (const [id, { st }] of Object.entries(rows)) if (id.startsWith(LEX) && st.s >= WORDS_KNOWN_BOX && st.n >= 1 && st.r >= 1) n += 1;
  for (const s of vocabOf(snapshot).items) if (s.bestBox >= WORDS_KNOWN_BOX && s.seen >= 1) n += 1;
  return n;
}

export function memorySummaryOf({ rows, retired, snapshot, today, reviewOn = false }: MemorySummaryInput): MemorySummary {
  const wordsKnown = wordsKnownOf(rows, snapshot);
  const due: Due[] = [];
  for (const [id, { st }] of Object.entries(rows)) {
    if (!retired.has(id) && isItemDue(st, today) && st.d !== null) due.push({ id, box: st.b, due: st.d });
  }
  const words: readonly VocabItemState[] = vocabOf(snapshot).items;
  for (const s of words) {
    if (isDue(s, today) && s.due !== null) due.push({ id: s.id, box: s.box, due: s.due });
  }
  due.sort((a, b) => a.box - b.box || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || jitterOf(a.id) - jitterOf(b.id) || (a.id < b.id ? -1 : 1));

  const levels: [number, number, number] = [0, 0, 0];
  for (const level of Object.values(snapshot.cellBest ?? {})) {
    if (level === 1) levels[0] += 1;
    else if (level === 2) levels[1] += 1;
    else if (level === 3) levels[2] += 1;
  }

  const monday = weekStartOf(today);
  let weekPoints = 0;
  for (let day = monday; day <= today; day = addDays(day, 1)) weekPoints += dayLogPoints(snapshot.dayLog, day);

  return {
    wordsKnown: cap(wordsKnown),
    readyToRefresh: cap(due.length),
    cellBestCounts: [cap(levels[0]), cap(levels[1]), cap(levels[2])],
    stageChecks: cap(Object.keys(snapshot.stageCheckAt ?? {}).length),
    weekPoints: cap(weekPoints),
    topDue: due.slice(0, TOP_DUE_MAX).map((row) => row.id),
    ...(reviewOn ? { reviewOn: true as const } : {}),
  };
}
