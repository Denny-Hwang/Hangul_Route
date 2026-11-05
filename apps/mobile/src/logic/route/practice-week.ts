import { addDays, type InboxPlan, type PracticeWeekSummary, type ProgressSnapshot } from '@hangul-route/content-schema';
import { planIdOf } from '../homework/plan-derivation';
import { weekMondayOf } from '../goals/week';
import { blendInForce } from './layer';

/**
 * `summary.practiceWeek` (AMENDMENTS-ROUTE-CLASS-BLEND section 11, BL-OD-11, row BL-9). Pure.
 *
 * The days of this week (the ISO week on the learner's local days, Monday to Sunday, as the weekly dots read it) with a
 * finished practice item of a class plan with practice days, or a finished Refresh: a Daily Review or a Cell Check
 * finished on a day the plan lists a Refresh for. Class itself never counts (a class run is not in the snapshot). A
 * count only, never which days; written only while a class plan with practice days is in force on `planDay`, so a
 * learner without one sends no field and the family sees no line.
 */
export interface PracticeWeekInput {
  snapshot: Pick<ProgressSnapshot, 'homework' | 'reviews'>;
  /** The learner's inbox plans; undefined while this device does not know them (no field is guessed). */
  plans: readonly InboxPlan[] | undefined;
  /** The plan day (the UTC day of F-PLAN-002 section 3.6) that decides which plans are in force. */
  planDay: string;
  /** The learner's local day now. */
  today: string;
  /** An instant's local day on this device. */
  localDay: (iso: string) => string;
}

/** The Refresh kinds: a Refresh opens a Cell Check, else Daily Review (section 6.4). */
const REFRESH_REVIEW_KINDS: ReadonlySet<string> = new Set(['daily', 'cell-check']);

export function practiceWeekOf(input: PracticeWeekInput): PracticeWeekSummary | undefined {
  const { snapshot, plans, planDay, today, localDay } = input;
  if (plans === undefined) return undefined;
  const blended = plans.filter((p) => blendInForce({ kind: p.spaceKind, meta: p.meta ?? null }, planDay));
  if (blended.length === 0) return undefined;
  const monday = weekMondayOf(today);
  const sunday = addDays(monday, 6);
  const inWeek = (day: string): boolean => monday <= day && day <= today && day <= sunday;
  const days = new Set<string>();
  const planIds = new Set(blended.map((p) => p.id));
  for (const h of snapshot.homework) {
    if (!h.completedAt) continue;
    const planId = planIdOf(h.id);
    if (planId === null || !planIds.has(planId)) continue;
    const day = localDay(h.completedAt);
    if (inWeek(day)) days.add(day);
  }
  const refreshDays = new Set(blended.flatMap((p) => (p.meta?.refresh ?? []).map((entry) => entry.date)));
  for (const review of snapshot.reviews) {
    if (!REFRESH_REVIEW_KINDS.has(review.kind)) continue;
    const day = localDay(review.generatedAt);
    if (refreshDays.has(day) && inWeek(day)) days.add(day);
  }
  return { practicedDays: days.size };
}
