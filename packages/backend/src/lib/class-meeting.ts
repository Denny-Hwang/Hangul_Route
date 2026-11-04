import { CurriculumMetaSchema, WEEKDAYS, addDays, weekdayOf, type CurriculumMeta, type Weekday } from '@hangul-route/content-schema';
import { practiceDaysFor } from '@hangul-route/content-schema/blend';
import type { Plan } from '@hangul-route/content-schema';

/**
 * How a child's class meets, for the family's child card (AMENDMENTS-ROUTE-CLASS-BLEND section 11 and BL-OD-6, row
 * BL-9): the class days, how many practice days a week, and the class's default practice weekdays (never a learner's
 * own, section 9.4). Read from the class's own plan with practice days (`meta.params.blend`), so the family sees what the
 * learner's device receives in its inbox and nothing more: no lesson, no date, no other learner.
 */
export interface ClassMeeting {
  classDays: Weekday[];
  perWeek: number;
  practiceDays: Weekday[];
}

/** Week order (Monday first), as every weekday list on the console reads. */
const inWeekOrder = (days: readonly Weekday[]): Weekday[] => {
  const monFirst = [...WEEKDAYS.slice(1), WEEKDAYS[0]] as Weekday[];
  return monFirst.filter((day) => days.includes(day));
};

/**
 * The last day of a blended route (section 6.3, as `blendSpanOf` on the device): the first class day on or after the
 * start date plus `weeks` whole cycles, or the end of the plan's last week when that is later.
 */
function routeEnd(meta: CurriculumMeta, classDays: readonly Weekday[]): string {
  let from = meta.params.startDate;
  for (let step = 0; step < 7 && !classDays.includes(weekdayOf(from)); step += 1) from = addDays(from, 1);
  const cyclesEnd = addDays(from, 7 * meta.params.weeks - 1);
  const last = meta.weeks[meta.weeks.length - 1];
  const weeksEnd = last === undefined ? null : addDays(last.startDate, 6);
  return weeksEnd !== null && weeksEnd > cyclesEnd ? weeksEnd : cyclesEnd;
}

/** Whether a stored meta carries blend params at all (`meta.params.blend`), read without the full schema. */
const hasBlendParams = (meta: unknown): boolean => {
  if (typeof meta !== 'object' || meta === null) return false;
  const params = (meta as { params?: unknown }).params;
  return typeof params === 'object' && params !== null && typeof (params as { blend?: unknown }).blend === 'object' && (params as { blend?: unknown }).blend !== null;
};

/**
 * The meeting of the newest published, live plan with practice days of `plans` (one class's plans) that reaches
 * `learnerId` (the inbox's targeting rule) and whose route has not ended on `today` (a UTC day key). Null when there is
 * none: the class line keeps its GX-4 words.
 */
export function classMeetingOf(plans: readonly Plan[], learnerId: string, today: string): ClassMeeting | null {
  let best: { publishedAt: string; meeting: ClassMeeting } | null = null;
  for (const plan of plans) {
    if (!plan.publishedAt || plan.archivedAt || (plan.targetLearnerIds !== null && !plan.targetLearnerIds.includes(learnerId))) continue;
    // Cheap checks before the parse: a family's background read runs this over every plan of every live class, and most
    // plans are classic, unblended or older than the best one found.
    if (!hasBlendParams(plan.meta) || (best !== null && best.publishedAt >= plan.publishedAt)) continue;
    const read = CurriculumMetaSchema.safeParse(plan.meta);
    if (!read.success) continue;
    const blend = read.data.params.blend;
    if (blend === undefined || blend.lecture.days.length === 0) continue;
    if (routeEnd(read.data, blend.lecture.days) < today) continue;
    const practice = blend.personal.days ?? practiceDaysFor(blend.lecture.days, blend.personal.perWeek);
    best = {
      publishedAt: plan.publishedAt,
      meeting: { classDays: inWeekOrder(blend.lecture.days), perWeek: blend.personal.perWeek, practiceDays: inWeekOrder(practice) },
    };
  }
  return best?.meeting ?? null;
}
