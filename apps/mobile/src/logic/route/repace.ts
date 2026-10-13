import {
  CURRICULUM_MAX_ITEMS,
  PACES,
  addDays,
  regenerateFrom,
  sessionsPerWeekOf,
  toMeta,
  toPlanItems,
  type Catalog,
  type DateKey,
  type HomeworkAssignment,
  type PaceId,
  type PlanItem,
  type SelfRoute,
} from '@hangul-route/content-schema';
import { PACE_IDS } from './proposal-flow';

/**
 * Re-pacing the learner's own weekly plan (F-PLAN-002 section 3.7) and the Hoya check-in
 * (FP-B14, OD-13). Nothing is ever flagged as late: a re-pace moves unfinished items forward
 * quietly, and the check-in offers a lighter or a faster pace in positive words. Pure; the route
 * store passes the clock, the snapshot and the catalogue.
 */

/** Automatic re-pace: three or more pending past-dated plan items ... */
export const AUTO_REPACE_PENDING = 3;
/** ... or the oldest one at least this many days old. */
export const AUTO_REPACE_OLDEST_DAYS = 7;

/** Pending plan homework of this route dated before today. */
export function pendingPastOf(route: Pick<SelfRoute, 'id'>, homework: readonly HomeworkAssignment[], today: DateKey): HomeworkAssignment[] {
  return homework.filter((h) => !h.completedAt && h.id.startsWith(`${route.id}#`) && h.targetDate < today);
}

export interface AutoRepaceInput {
  route: SelfRoute | null;
  homework: readonly HomeworkAssignment[];
  today: DateKey;
  /** A quest (or any session) is open for this learner: never re-pace under them. */
  sessionOpen: boolean;
}

/**
 * At most once per UTC day (a re-pace of either kind today counts), never while a session is
 * open or after the plan's last week, and only when three or more past-dated items wait or the oldest is a week old.
 */
export function autoRepaceDue(i: AutoRepaceInput): boolean {
  const route = i.route;
  if (route === null || route.archivedAt !== null || i.sessionOpen) return false;
  if (route.meta.repacedAt !== null && route.meta.repacedAt.slice(0, 10) === i.today) return false;
  // Past the last week nothing is left to move along: a re-pace would change nothing but its marks.
  const last = route.meta.weeks[route.meta.weeks.length - 1];
  if (last === undefined || addDays(last.startDate, 7) <= i.today) return false;
  const pending = pendingPastOf(route, i.homework, i.today);
  if (pending.length >= AUTO_REPACE_PENDING) return true;
  const oldest = pending.reduce<string | null>((min, h) => (min === null || h.targetDate < min ? h.targetDate : min), null);
  return oldest !== null && oldest <= addDays(i.today, -AUTO_REPACE_OLDEST_DAYS);
}

function withDraft(route: SelfRoute, draft: ReturnType<typeof regenerateFrom>, nowIso: string): SelfRoute {
  const items: PlanItem[] = toPlanItems(draft);
  return { ...route, updatedAt: nowIso, meta: { ...toMeta(draft), repacedAt: nowIso }, items };
}

/**
 * "Move my plan along" and the automatic re-pace: `regenerateFrom(..., 'requeue')` with the
 * learner's completions, so unfinished past items return to the front and the rest is laid out
 * again from today; the plan keeps its id, start and end.
 */
export function repaceSelfRoute(route: SelfRoute, completedQuestIds: readonly string[], today: DateKey, catalog: Catalog, nowIso: string): SelfRoute {
  const draft = regenerateFrom(route, today, catalog, { mode: 'requeue', completedQuestIds: [...completedQuestIds] });
  return withDraft(route, draft, nowIso);
}

/** `route.repaced` (section 3.11): how it ran and how many past items were waiting; counts only. */
export function repacedEvent(
  profileId: string,
  mode: 'auto' | 'manual',
  pending: number,
): { name: 'route.repaced'; profileId: string; payload: { mode: 'auto' | 'manual'; pending: number } } {
  return { name: 'route.repaced', profileId, payload: { mode, pending } };
}

/** The Hoya check-in opens at the start of this week of an active plan (OD-13: after week 4). */
export const CHECK_IN_WEEK = 5;

export type CheckInOffer = { kind: 'lighter'; pace: PaceId } | { kind: 'faster'; pace: PaceId };

export interface CheckInInput {
  route: SelfRoute | null;
  completedQuestIds: readonly string[];
  today: DateKey;
  /** `route-ui:<profileId>.checkInFor`: the plan whose check-in was already answered. */
  answeredFor: string | undefined;
}

/**
 * Once, in week 5 of an active plan (FP-B14): from the sessions of weeks 1 to 4 that were
 * actually finished, fewer than half offers a lighter week (Gentle) and every one offers a bit
 * faster (one step up). Nothing in between, nothing past Brisk or below Gentle, and nothing for a
 * plan off the chips. A coming-soon placeholder is not a session anyone can finish, so it does
 * not count. A re-pace moves unfinished items out of the weeks before it, so such a week counts
 * at least its sessions a week when its (frozen) meta shows it held lessons. It never names a
 * session that was not done.
 */
export function checkInOffer(i: CheckInInput): CheckInOffer | null {
  const route = i.route;
  if (route === null || route.archivedAt !== null || i.answeredFor === route.id) return null;
  const week = route.meta.weeks.find((w) => w.index === CHECK_IN_WEEK);
  if (week === undefined || i.today < week.startDate || i.today >= addDays(week.startDate, 7)) return null;
  const perWeek = sessionsPerWeekOf(route.meta.params);
  const repacedOn = route.meta.repacedAt === null ? null : route.meta.repacedAt.slice(0, 10);
  const done = new Set(i.completedQuestIds);
  let planned = 0;
  let finished = 0;
  for (const w of route.meta.weeks) {
    if (w.index >= CHECK_IN_WEEK) continue;
    const end = addDays(w.startDate, 7);
    const items = route.items.filter((item) => item.kind === 'quest' && item.targetDate !== undefined && item.targetDate >= w.startDate && item.targetDate < end);
    finished += items.filter((item) => done.has(item.id)).length;
    // A re-pace moves unfinished items out of the weeks before it; their frozen week meta still says the week had lessons.
    const hadLessons = (w.kind === 'learn' || w.kind === 'culture') && (w.focus.episodeId !== null || w.focus.storyIds.length > 0);
    const movedOut = repacedOn !== null && w.startDate < repacedOn && hadLessons;
    planned += movedOut ? Math.max(items.length, perWeek) : items.length;
  }
  if (planned === 0) return null;
  const pace = PACE_IDS.find((id) => PACES[id] === perWeek);
  if (pace === undefined) return null;
  if (finished * 2 < planned) return pace === 'gentle' ? null : { kind: 'lighter', pace: 'gentle' };
  if (finished >= planned && pace !== 'brisk') return { kind: 'faster', pace: PACE_IDS[PACE_IDS.indexOf(pace) + 1] as PaceId };
  return null;
}

/**
 * What a screen keeps of the check-in it showed (`useShownOffer`): the offer stays after it is
 * answered (the card says what changed) until it is closed. It belongs to one learner's plan
 * (`key` = profile id and plan id): when the learner or the plan changes, the kept offer goes and
 * the new plan's own offer, or none, is taken as it is.
 */
export interface RetainedOffer {
  key: string;
  shown: CheckInOffer | null;
  closed: boolean;
}

/** The next kept state for the offer computed now; the same object when nothing changes. */
export function retainedOfferStep(prev: RetainedOffer, offer: CheckInOffer | null, key: string): RetainedOffer {
  if (prev.key !== key) return { key, shown: offer, closed: false };
  if (offer !== null && prev.shown === null && !prev.closed) return { ...prev, shown: offer };
  // Once the answer has landed the computed offer is null: a later plan's own check-in may show again.
  if (offer === null && prev.closed) return { ...prev, closed: false };
  return prev;
}

/** The longest plan the schema holds (`weeks` max 52). */
const MAX_WEEKS = 52;

/**
 * Yes on the check-in: the plan's own future items laid on the new pace's sessions from today
 * (`regenerateFrom(..., 'shift')`) on its spread days; the past stays. A lighter pace has fewer
 * sessions before the end date, so when items would fall off the tail (`fewer-sessions-than-units`)
 * the plan gets the weeks they need (section 3.7 "Add N weeks", `params.weeks + N`, the same call),
 * within what a plan can hold. Saying yes never quietly takes lessons out of the plan.
 */
export function applyCheckIn(route: SelfRoute, offer: CheckInOffer, completedQuestIds: readonly string[], today: DateKey, catalog: Catalog, nowIso: string): SelfRoute {
  const { sessionDays: _days, ...params } = route.meta.params;
  const perWeek = PACES[offer.pace];
  const maxWeeks = Math.min(MAX_WEEKS, Math.floor(CURRICULUM_MAX_ITEMS / perWeek));
  let weeks = params.weeks;
  let draft = regenerateFrom({ ...route, meta: { ...route.meta, params: { ...params, sessionsPerWeek: perWeek } } }, today, catalog, { mode: 'shift', completedQuestIds: [...completedQuestIds] });
  // A culture or review week can take a session, so the added weeks are checked again (a few rounds at most).
  for (let round = 0; round < 4; round += 1) {
    const left = draft.warnings.find((w) => w.code === 'fewer-sessions-than-units')?.count ?? 0;
    if (left === 0 || weeks >= maxWeeks) break;
    weeks = Math.min(maxWeeks, weeks + Math.ceil(left / perWeek));
    draft = regenerateFrom({ ...route, meta: { ...route.meta, params: { ...params, sessionsPerWeek: perWeek, weeks } } }, today, catalog, { mode: 'shift', completedQuestIds: [...completedQuestIds] });
  }
  return withDraft(route, draft, nowIso);
}
