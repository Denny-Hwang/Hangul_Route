import type { ReportSummary } from '../../../schemas/report-response';
import type { ClassReportLearner, ClassReportPlan } from '../../class-report';
import { GAP, LAST_SYNCED, LEGACY, STALE4, STEADY } from './activity-2026-10';

/**
 * FROZEN. A class of 20 learners built from the four learners of `activity-2026-10.ts` (F-REPORT-001 section 5), as
 * the Worker hands them to `classReport` on Thursday 15 October 2026 at 12:00 UTC (RP-5b): each summary is the class
 * projection (RP-W2 `activityOf`: no day, month or milestone from before the learner joined on 1 September, no
 * `since`, `next.plan` false, no `next.end`, no self-route, words zeroed) with this class's homework counts, and no
 * id or name anywhere. Never edit the counts to follow the code; add a new dated fixture instead.
 *
 * - 6 x Mina (steady week, tz -420): 3 practice days, 36 minutes, 2 new quests, 1 card, letters ㄱ ㄴ this week.
 * - 4 x Jun (a gap, tz +540, saved yesterday): no practice since September.
 * - 4 x Ari (an older app): no `activity`.
 * - 3 x Sora (saved 4 days ago, tz 0): 3 practice days, 30 minutes, 7 new quests, 4 cards, letters ㄷ ㄹ and Stage 1
 *   finished this week.
 * - 3 members whose devices never saved progress to the class (`summary: null`).
 */

const JOINED = '2026-09-01';

/** The class copy of a summary (RP-W2 `activityOf` for `kind: 'class'` and the roster's allow-list). */
function forClass(summary: ReportSummary, planProgress: NonNullable<ReportSummary['planProgress']>): ReportSummary {
  const { selfRoute: _selfRoute, activity, ...rest } = summary;
  if (!activity) return { ...rest, planProgress };
  const { next, ...kept } = activity;
  return {
    ...rest,
    planProgress,
    activity: {
      ...kept,
      days: activity.days.filter((row) => row.d >= JOINED).map((row) => ({ ...row, w: 0 })),
      months: activity.months.filter((row) => row.m > JOINED.slice(0, 7)).map((row) => ({ ...row, w: 0 })),
      milestones: activity.milestones.filter((row) => row.on >= JOINED),
      total: { ...activity.total, since: null, w: 0 },
      ...(next && 'q' in next ? { next: { q: next.q, plan: false } } : {}),
    },
  };
}

const times = <T>(n: number, make: () => T): T[] => Array.from({ length: n }, make);

/** The class's plans as `plansOf` returns them (oldest first): three published, one draft, one archived. */
export const CLASS_PLANS: readonly ClassReportPlan[] = [
  { id: 'plan:class-old', title: 'Vowels review', publishedAt: '2026-09-01T08:00:00.000Z', archivedAt: null, createdAt: '2026-09-01T08:00:00.000Z' },
  { id: 'plan:class-letters', title: 'First consonants', publishedAt: '2026-09-20T08:00:00.000Z', archivedAt: null, createdAt: '2026-09-20T08:00:00.000Z' },
  { id: 'plan:class-week', title: 'This week: letters and sounds', publishedAt: '2026-10-05T08:00:00.000Z', archivedAt: null, createdAt: '2026-10-05T08:00:00.000Z' },
  { id: 'plan:class-draft', title: 'Next week (draft)', publishedAt: null, archivedAt: null, createdAt: '2026-10-10T08:00:00.000Z' },
  { id: 'plan:class-archived', title: 'Old plan', publishedAt: '2026-10-12T08:00:00.000Z', archivedAt: '2026-10-13T08:00:00.000Z', createdAt: '2026-10-12T08:00:00.000Z' },
];

export const CLASS_20: readonly ClassReportLearner[] = [
  ...times(6, () => ({
    summary: forClass(STEADY, { 'plan:class-week': { done: 3, total: 5, notReady: 0 }, 'plan:class-letters': { done: 4, total: 4, notReady: 0 } }),
    lastSyncedAt: LAST_SYNCED.steady,
  })),
  ...times(4, () => ({ summary: forClass(GAP, { 'plan:class-week': { done: 5, total: 5, notReady: 0 } }), lastSyncedAt: LAST_SYNCED.gap })),
  ...times(4, () => ({ summary: forClass(LEGACY, { 'plan:class-week': { done: 1, total: 4, notReady: 2 } }), lastSyncedAt: LAST_SYNCED.legacy })),
  ...times(3, () => ({
    summary: forClass(STALE4, { 'plan:class-week': { done: 0, total: 5, notReady: 0 }, 'plan:class-old': { done: 2, total: 2, notReady: 0 } }),
    lastSyncedAt: LAST_SYNCED.stale4,
  })),
  ...times(3, () => ({ summary: null, lastSyncedAt: null })),
];
