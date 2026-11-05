import { sessionsPerWeekOf, type PracticeDaysEntry, type Weekday } from '@hangul-route/content-schema';
import { SOURCE_RANK } from '../homework/assignment-merger';
import { ASSIGNED_BY, type DeriveSource } from '../homework/plan-derivation';
import { curriculumInForce } from '../route/layer';

/**
 * The weekly days in force from a weekly plan (F-PLAN-002; design/wireframes/home/goal-ring-weekly-dots.md
 * "One weekly target: the F-PLAN-002 weekly plan comes first"). Pure.
 *
 * A plan is on when its horizon has a week holding `today` (a plan day, the UTC day of F-PLAN-002 section
 * 3.6), or, for a class plan with practice days, when its route does. The sources are taken in the derivation
 * rank (class, then family and school, then the learner's own; the newest first in a rank), so the plan that
 * comes first on a day sets the days. Null when no plan is on: `goals.weeklyDays` then applies.
 *
 * A class plan with practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 6.1, row BL-6) counts its distinct days
 * `D` (class days and practice days together: 4 for 1 class day and 3 practice days, 7 for 1 and 7), the learner's
 * own practice days when they moved them (`practiceDays`, BL-OD-7); when it leads, the days of every class plan
 * with practice days on that day count together, at most 7.
 */
export function planDaysInForce(sources: readonly DeriveSource[], today: string, practiceDays?: readonly PracticeDaysEntry[]): number | null {
  const rank = (s: DeriveSource): number => SOURCE_RANK[ASSIGNED_BY[s.kind]];
  // A class plan with practice days leads while it is in force (section 12.2), even before a newer class plan without.
  const blended = sources.filter((s) => blendedClass(s) && curriculumInForce(s.meta, today));
  if (blended.length > 0) return blendedDays(blended, practiceDays);
  const ranked = [...sources].sort((a, b) => rank(a) - rank(b) || b.assignedAt.localeCompare(a.assignedAt));
  for (const source of ranked) {
    const meta = source.meta;
    if (!curriculumInForce(meta, today) || meta === undefined || meta === null) continue;
    const days = sessionsPerWeekOf(meta.params);
    if (Number.isInteger(days) && days > 0) return Math.min(7, days);
  }
  return null;
}

const blendedClass = (s: DeriveSource): boolean => s.kind === 'class' && s.meta?.params.blend !== undefined;

/**
 * One blended plan's weekdays; when the plan names no practice weekdays (the generator always writes `sessionDays`, so
 * only a hand-made or damaged plan), its class days and its distinct-day count: its practice days then count as days
 * of their own (an estimate; resolving them with `practiceDaysFor` would pull the whole blend module into the start
 * bundle for that case).
 */
function weekdaysOf(source: DeriveSource, practiceDays: readonly PracticeDaysEntry[] | undefined): { days: Set<Weekday>; count?: number } {
  const params = (source.meta as NonNullable<DeriveSource['meta']>).params;
  const blend = params.blend as NonNullable<typeof params.blend>;
  const learner = practiceDays?.find((e) => e.planId === source.id)?.days;
  const practice = learner ?? blend.personal.days;
  if (practice !== undefined) return { days: new Set([...blend.lecture.days, ...practice]) };
  // The generator writes the union of class and practice days as `sessionDays` (section 9.1).
  if (params.sessionDays !== undefined && params.sessionDays.length > 0) return { days: new Set([...blend.lecture.days, ...params.sessionDays]) };
  // Default practice days fill the non-class days first, then class days (`practiceDaysFor`, BL-OD-19).
  return { days: new Set(blend.lecture.days), count: Math.min(7, blend.lecture.days.length + blend.personal.perWeek) };
}

function blendedDays(blended: readonly DeriveSource[], practiceDays: readonly PracticeDaysEntry[] | undefined): number {
  const union = new Set<Weekday>();
  let unknown = 0;
  for (const source of blended) {
    const of = weekdaysOf(source, practiceDays);
    for (const day of of.days) union.add(day);
    // A plan without named practice days adds its practice days beyond its class days.
    if (of.count !== undefined) unknown += of.count - of.days.size;
  }
  return Math.min(7, union.size + unknown);
}
