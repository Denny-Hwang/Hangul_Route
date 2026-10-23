import { addDays, sessionsPerWeekOf } from '@hangul-route/content-schema';
import { SOURCE_RANK } from '../homework/assignment-merger';
import { ASSIGNED_BY, type DeriveSource } from '../homework/plan-derivation';

/**
 * The weekly days in force from a weekly plan (F-PLAN-002; design/wireframes/home/goal-ring-weekly-dots.md
 * "One weekly target: the F-PLAN-002 weekly plan comes first"). Pure.
 *
 * A plan is on when its horizon has a week holding `today` (a plan day, the UTC day of F-PLAN-002 section
 * 3.6). The sources are taken in the derivation rank (class, then family and school, then the learner's
 * own; the newest first in a rank), so the plan that comes first on a day sets the days. Null when no plan
 * is on: `goals.weeklyDays` then applies.
 */
export function planDaysInForce(sources: readonly DeriveSource[], today: string): number | null {
  const rank = (s: DeriveSource): number => SOURCE_RANK[ASSIGNED_BY[s.kind]];
  const ranked = [...sources].sort((a, b) => rank(a) - rank(b) || b.assignedAt.localeCompare(a.assignedAt));
  for (const source of ranked) {
    const meta = source.meta;
    if (meta === undefined || meta === null) continue;
    if (!meta.weeks.some((w) => w.startDate <= today && today <= addDays(w.startDate, 6))) continue;
    const days = sessionsPerWeekOf(meta.params);
    if (Number.isInteger(days) && days > 0) return Math.min(7, days);
  }
  return null;
}
