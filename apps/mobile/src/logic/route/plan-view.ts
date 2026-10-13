import {
  addDays,
  placementStageNumber,
  toPlanItems,
  type CurriculumDraft,
  type CurriculumMeta,
  type DateKey,
  type PlanItem,
  type WeekExtra,
  type WeekKind,
} from '@hangul-route/content-schema';
import type { WeekRow } from './proposal-flow';

/**
 * What the learner's plan screens draw (F-PLAN-002 section 3.9; wireframe
 * console/curriculum-planner.md G2 preview and G3 overview): weeks with their kind, items and
 * optional extras, the stats line, and the notices in learner words. The Premium warning is
 * never a learner notice: locked and unreleased lessons read only "More lessons are coming."
 * Pure; words come from `learner.weeklyPlan` in the UI locale.
 */

export interface PlanWeek {
  index: number;
  startDate: DateKey;
  kind: WeekKind;
  /** The week's lead story (a culture week), for its label. */
  storyId: string | null;
  rows: WeekRow[];
  extras: WeekExtra[];
}

/** How many weeks the preview opens; later weeks sit behind one collapsed row (G2). */
export const PREVIEW_OPEN_WEEKS = 4;

function weeksOf(meta: Pick<CurriculumMeta, 'weeks'>, items: readonly PlanItem[]): PlanWeek[] {
  return meta.weeks.map((week) => {
    const end = addDays(week.startDate, 7);
    const rows = items
      .filter((item): item is PlanItem & { targetDate: string } => item.targetDate !== undefined && item.targetDate >= week.startDate && item.targetDate < end)
      .map((item) => ({ date: item.targetDate, kind: item.kind, id: item.id }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { index: week.index, startDate: week.startDate, kind: week.kind, storyId: week.focus.storyIds[0] ?? null, rows, extras: [...week.extras] };
  });
}

/** G2: the first four weeks open, and how many later weeks follow. */
export function previewWeeks(draft: CurriculumDraft): { open: PlanWeek[]; later: number } {
  const all = weeksOf(draft, toPlanItems(draft));
  return { open: all.slice(0, PREVIEW_OPEN_WEEKS), later: Math.max(0, all.length - PREVIEW_OPEN_WEEKS) };
}

/** The stats line: ready lessons and stories, their minutes, the stage the lessons reach. */
export function previewStats(draft: CurriculumDraft): { items: number; minutes: number; stage: number } {
  return { items: draft.stats.readyItems, minutes: draft.stats.minutesPlanned, stage: placementStageNumber(draft.stats.endsAtStage) };
}

export type LearnerNotice =
  | { code: 'content-runs-out'; week: number }
  | { code: 'more-coming' }
  | { code: 'did-not-fit'; count: number }
  | { code: 'too-short'; count: number }
  | { code: 'already-known'; count: number };

/**
 * The draft's warnings as learner notices, in the draft's order: `premium-needed` and
 * `coming-soon-included` become one "More lessons are coming."; nothing names a product or a price.
 */
export function learnerNotices(draft: Pick<CurriculumDraft, 'warnings'>): LearnerNotice[] {
  const out: LearnerNotice[] = [];
  for (const warning of draft.warnings) {
    switch (warning.code) {
      case 'content-runs-out':
        out.push({ code: 'content-runs-out', week: warning.week ?? 1 });
        break;
      case 'premium-needed':
      case 'coming-soon-included':
        if (!out.some((n) => n.code === 'more-coming')) out.push({ code: 'more-coming' });
        break;
      case 'fewer-sessions-than-units':
        out.push({ code: 'did-not-fit', count: warning.count ?? 1 });
        break;
      case 'session-too-short':
        out.push({ code: 'too-short', count: warning.count ?? 1 });
        break;
      case 'already-done-skipped':
        out.push({ code: 'already-known', count: warning.count ?? 1 });
        break;
    }
  }
  return out;
}

export interface PlanOverview {
  /** `upcoming` before the first day, `active` inside the plan, `finished` after its last day. */
  status: 'upcoming' | 'active' | 'finished';
  /** The first day of the plan. */
  startsOn: DateKey;
  /** The week that holds today (the first week while upcoming); null once finished. */
  current: PlanWeek | null;
  /** The weeks after it, collapsed on the screen. */
  later: PlanWeek[];
}

/** G3: the current week first, then the later weeks; past weeks are history (the Homework list keeps them). */
export function planOverview(route: { meta: Pick<CurriculumMeta, 'weeks'>; items: readonly PlanItem[] }, today: DateKey): PlanOverview {
  const weeks = weeksOf(route.meta, route.items);
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (first === undefined || last === undefined) return { status: 'finished', startsOn: today, current: null, later: [] };
  if (today < first.startDate) return { status: 'upcoming', startsOn: first.startDate, current: first, later: weeks.slice(1) };
  if (today >= addDays(last.startDate, 7)) return { status: 'finished', startsOn: first.startDate, current: null, later: [] };
  const at = weeks.findIndex((w) => today >= w.startDate && today < addDays(w.startDate, 7));
  return { status: 'active', startsOn: first.startDate, current: weeks[at] as PlanWeek, later: weeks.slice(at + 1) };
}
