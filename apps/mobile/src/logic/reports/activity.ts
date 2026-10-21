import {
  REPORT_COUNT_MAX,
  REPORT_DAYS_MAX,
  REPORT_DAY_LETTERS_MAX,
  REPORT_MILESTONES_MAX,
  REPORT_MONTHS_MAX,
  REPORT_QUEST_ID_MAX,
  ReportLetterSchema,
  ReportStageKeySchema,
  addDays,
  isDateKey,
  type ActivityDay,
  type ActivityMonth,
  type ActivityNext,
  type ActivitySummary,
  type ProgressSnapshot,
} from '@hangul-route/content-schema';
import { countedSeconds } from '../sessions/session-log';
import { RECOGNIZED_ACCURACY, letterSignalsOf } from '../sync/summarize';
import { codePoint, localDay as localDayOfDate, vocabOf } from '../vocab/progress';

/**
 * The report activity summary — F-REPORT-001 section 3.3.4 (RP-4). Pure: the
 * device's clock (`now`) and its calendar (`localDay`) come in, so a test can
 * stand anywhere on Earth. Every day key is the learner device's local day
 * (OD-12); the learner app's streak (`logic/streak.ts`) is not read here.
 *
 * Nothing here is per question: counts, day keys, stage keys, letter keys and
 * quest ids only (section 3.10). The result always parses with
 * `ActivitySummarySchema`, so the Worker never drops it.
 */

/**
 * What the report needs from F-ENT-003's `routeNext` (section 3.5): its
 * `RouteNext` is assignable to this. `source` is the plan source, `'cursor'`
 * for the default route.
 */
export type ActivityRouteNext = { kind: 'quest'; questId: string; source: string } | { kind: 'free-end' } | { kind: 'rest' };

export interface BuildActivityInput {
  snapshot: ProgressSnapshot;
  now: Date;
  /**
   * Letters each quest teaches, keyed in catalogue route order (the bundle's
   * quest order, `content/sync-context.ts`): step 9 reads the first match.
   */
  questJamo: Readonly<Record<string, readonly string[]>>;
  /** The device's calendar day (`YYYY-MM-DD`) of an ISO instant; anything else for an unreadable one. */
  localDay: (iso: string) => string;
  /** F-ENT-003 `routeNext` with the Home card's input; absent before E3-4 is on main, so `next` is absent. */
  routeNext?: () => ActivityRouteNext;
  /** F-ENT-003 `isQuestOpen` for this learner; absent means every quest is open. */
  isQuestOpen?: (questId: string) => boolean;
}

/** Clamped to the schema's bound on every count: a long-lived learner never makes the summary unparseable. */
const count = (n: number): number => Math.min(REPORT_COUNT_MAX, n);
/** Within the schema's bound on a quest id (`next.q`, `revisit`). */
const isQuestId = (id: string): boolean => id.length >= 1 && id.length <= REPORT_QUEST_ID_MAX;

/** The device's calendar day of an ISO instant, from the `Date` getters (OD-12). Not a day key when unreadable. */
export function deviceLocalDay(iso: string): string {
  return localDayOfDate(new Date(iso));
}

interface DayTally {
  seconds: number;
  q: number;
  c: number;
  w: number;
  j: Set<string>;
}

function nextOf(routeNext: BuildActivityInput['routeNext']): ActivityNext | undefined {
  const next = routeNext?.();
  if (next?.kind === 'free-end') return { end: true };
  if (next?.kind === 'quest' && isQuestId(next.questId)) return { q: next.questId, plan: next.source !== 'cursor' };
  // 'rest', an id the report would refuse, or no routeNext yet.
  return undefined;
}

function revisitOf(input: BuildActivityInput): string | undefined {
  const letter = letterSignalsOf(input.snapshot, input.questJamo).needsPractice[0];
  if (letter === undefined) return undefined;
  const open = input.isQuestOpen ?? (() => true);
  return Object.entries(input.questJamo).find(([questId, jamo]) => jamo.includes(letter) && isQuestId(questId) && open(questId))?.[0];
}

/**
 * The activity summary of one learner's snapshot, or undefined when the clock
 * cannot name a day (the summary then goes up without it, read as `legacy`).
 */
export function buildActivity(input: BuildActivityInput): ActivitySummary | undefined {
  const { snapshot, now, questJamo, localDay } = input;
  if (!Number.isFinite(now.getTime())) return undefined;
  const asOf = localDay(now.toISOString());
  if (!isDateKey(asOf)) return undefined;

  const tallies = new Map<string, DayTally>();
  /** The tally of an instant's local day, or undefined when the instant has none. */
  const tallyOn = (day: string): DayTally | undefined => {
    if (!isDateKey(day)) return undefined;
    let tally = tallies.get(day);
    if (tally === undefined) {
      tally = { seconds: 0, q: 0, c: 0, w: 0, j: new Set() };
      tallies.set(day, tally);
    }
    return tally;
  };

  // 1. Minutes and practice days: a session makes a practice day even with 0 counted seconds.
  let totalSeconds = 0;
  for (const s of snapshot.sessions) {
    const tally = tallyOn(localDay(s.startedAt));
    if (!tally) continue;
    const seconds = countedSeconds(s);
    tally.seconds += seconds;
    totalSeconds += seconds;
  }

  // 2. First finishes: a latch entry counts only while its quest is completed (a reset learner starts fresh).
  const completed = new Map(snapshot.quests.filter((q) => q.completedAt).map((q) => [q.questId, q]));
  const doneDay = new Map<string, string>();
  for (const [questId, at] of Object.entries(snapshot.questDoneAt ?? {})) {
    if (!completed.has(questId)) continue;
    const day = localDay(at);
    const tally = tallyOn(day);
    if (!tally) continue;
    tally.q += 1;
    doneDay.set(questId, day);
  }

  // 3. Cards collected.
  for (const card of snapshot.cards) {
    const tally = tallyOn(localDay(card.unlockedAt));
    if (tally) tally.c += 1;
  }

  // 4. Words met for the first time: `first` is already a local day key (F-VOC-005).
  for (const item of vocabOf(snapshot).items) {
    const tally = tallyOn(item.first);
    if (tally) tally.w += 1;
  }

  // 5. Letters that became strong: the earliest first finish of a quest that teaches the letter and in which it is
  // now strong. A letter lands on one day at most.
  const letterDay = new Map<string, string>();
  for (const [questId, jamo] of Object.entries(questJamo)) {
    const day = doneDay.get(questId);
    const quest = completed.get(questId);
    if (day === undefined || quest === undefined || quest.accuracy < RECOGNIZED_ACCURACY) continue;
    for (const letter of jamo) {
      if (!ReportLetterSchema.safeParse(letter).success) continue;
      const held = letterDay.get(letter);
      if (held === undefined || day < held) letterDay.set(letter, day);
    }
  }
  // Every day here came from `tallyOn` in step 2, so its tally exists.
  for (const [letter, day] of letterDay) (tallies.get(day) as DayTally).j.add(letter);

  // 6. Milestones: the stage latch, ascending by day (then stage key), the newest 16.
  const milestones = Object.entries(snapshot.stageDoneAt ?? {})
    .map(([stage, at]) => ({ stage, on: localDay(at) }))
    .filter((m) => ReportStageKeySchema.safeParse(m.stage).success && isDateKey(m.on))
    .sort((a, b) => codePoint(a.on, b.on) || codePoint(a.stage, b.stage))
    .slice(-REPORT_MILESTONES_MAX);

  // 7. Rows: every active day, ascending; the day rows are the ones among the 35 days ending at asOf, the month
  // rows the newest 24 months up to asOf's. Totals read every day, so they are exact and only grow.
  const all: ActivityDay[] = [...tallies.entries()]
    .sort(([a], [b]) => codePoint(a, b))
    .map(([d, t]) => ({
      d,
      min: count(Math.round(t.seconds / 60)),
      q: count(t.q),
      c: count(t.c),
      w: count(t.w),
      j: [...t.j].sort(codePoint).slice(0, REPORT_DAY_LETTERS_MAX),
    }));
  const rowsFrom = addDays(asOf, -(REPORT_DAYS_MAX - 1));
  const saved = all.filter((day) => day.d <= asOf);
  const days = saved.filter((day) => day.d >= rowsFrom);

  const byMonth = new Map<string, ActivityMonth>();
  for (const day of saved) {
    const m = day.d.slice(0, 7);
    const row = byMonth.get(m) ?? { m, min: 0, q: 0, c: 0, w: 0, days: 0 };
    byMonth.set(m, { m, min: count(row.min + day.min), q: count(row.q + day.q), c: count(row.c + day.c), w: count(row.w + day.w), days: row.days + 1 });
  }
  const months = [...byMonth.values()].slice(-REPORT_MONTHS_MAX);

  const sum = (key: 'q' | 'c' | 'w'): number => count(all.reduce((n, day) => n + day[key], 0));
  // `min` rounds once over every counted second, not per day, so regrouping the same sessions into other local days
  // (a second device in another zone, travel) never lowers it. `since` is the first day on or before asOf: a report
  // never reads "since" a day after its own today. `days` counts local days, so it follows the device's zone (OD-12).
  const total = {
    since: saved[0]?.d ?? null,
    min: count(Math.round(totalSeconds / 60)),
    q: sum('q'),
    c: sum('c'),
    w: sum('w'),
    days: count(all.length),
  };

  // 8 and 9. The app's own next and the quest the "letters to revisit" line offers.
  const next = nextOf(input.routeNext);
  const revisit = revisitOf(input);

  return {
    v: 1,
    tz: Math.max(-840, Math.min(840, -now.getTimezoneOffset())),
    asOf,
    days,
    months,
    total,
    milestones,
    ...(next ? { next } : {}),
    ...(revisit !== undefined ? { revisit } : {}),
  };
}
