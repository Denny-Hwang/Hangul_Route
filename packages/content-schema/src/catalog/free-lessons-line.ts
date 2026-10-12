import type { StageKey } from '../schemas/heritage-card';
import type { PlanItem } from '../schemas/plan-item';
import type { SpaceKind } from '../schemas/space';
import { FREE_ROUTE_STAGES, freeRouteQuestIds, gridLessonIds } from './route-days';
import type { Catalog } from './schema';

/**
 * The grown-up free-lessons line (F-ENT-003 section 3.9.2, E3-12; wireframe
 * console/free-lessons-line). One calm line that tells the grown-up who owns a space why a
 * learner has nothing new to do, and which product opens more. Pure: it returns a code and its
 * params, never a string; each host words it (`console.access.*` on the console and the report,
 * `caregiver.access.*` on the device) and adds **Open billing** for the owner.
 *
 * - `free-end`: the learner finished everything open (device only: `routeNext` is `free-end`).
 * - `plan-waiting`: the learner did every item of a plan of this space that is open on the free
 *   plan, and the plan holds lessons that open with a paid plan (console: `planProgress[planId]`
 *   has `done === total > 0` and `notReady > 0`, and `planFreeFacts` finds closed lessons in the
 *   plan, no open item still ahead of the derivation horizon, and no more closed lessons inside
 *   the horizon than the device skipped: `notReady >= closedInHorizon`). `notReady` alone also counts
 *   items that are not released yet or unknown, and a curriculum derives only up to its horizon,
 *   so the plan's own items decide the count. The console never guesses beyond this.
 * - `free-plan`: the neutral line, only where the host asks for it (the F-REPORT-001 report's
 *   next-steps block) and only when nothing else fires.
 */
export type FreeLessonsProduct = 'family' | 'class';

export type FreeLessonsLine =
  | { code: 'free-end'; product: FreeLessonsProduct }
  | { code: 'plan-waiting'; product: FreeLessonsProduct; closed: number }
  | { code: 'free-plan'; product: FreeLessonsProduct }
  | null;

/** What a plan's own items say about the free plan (`planFreeFacts`). */
export interface PlanFreeFacts {
  /** The plan's distinct lessons that open with a paid plan: grid lessons past the free stages. A coming-soon or unknown item is not one. */
  closed: number;
  /**
   * The closed lessons the device derives: those of items not dated after the horizon. For a
   * free learner each one bumps `notReady` at least once, so `notReady >= closedInHorizon`; a
   * learner who has them open (premium through another space, or kept after finishing them)
   * reports fewer, and the line stays away.
   */
  closedInHorizon: number;
  /** An item that is open on the free plan is dated after the derivation horizon: the device has not derived it yet, so the learner has not done everything open. */
  openAhead: boolean;
}

/** One plan for one learner: `summary.planProgress[planId]` as the device reported it, and the plan's free facts. */
export interface FreeLessonsPlanCounts extends PlanFreeFacts {
  done: number;
  total: number;
  notReady: number;
}

export interface FreeLessonsLineInput {
  /** The effective free-plan switch: `gatingActive` on the device, `contentGatingEnabled()` on the console. */
  gating: boolean;
  /** The viewer owns the space: never a teacher who does not own it, never a co-caregiver without billing rights. */
  owner: boolean;
  /**
   * A Family Plan or a Group License covers the space (console: the account's own
   * `GET /api/entitlements`; device: the learner's access tier is premium). `null` = unknown,
   * for example a failed entitlements read: no line, never a claimed limit that cannot be confirmed.
   */
  covered: boolean | null;
  /** Names the product: a family space -> the Family Plan; a class or a school -> a Group License. */
  spaceKind: SpaceKind;
  /** Device only: `routeNext` for this learner is `free-end`. */
  freeEnd?: boolean;
  /** Console: this space's live plans that reach the learner, in the order the host prefers (the first that qualifies wins). */
  plans?: readonly FreeLessonsPlanCounts[];
  /** The host shows the neutral `free-plan` line when nothing else fires (the learner report). */
  neutral?: boolean;
}

/**
 * The learner did every open item of the plan the device derived, nothing open is still ahead,
 * closed lessons remain, and the device really skipped them (`notReady >= closedInHorizon`).
 */
const waiting = (plan: FreeLessonsPlanCounts): boolean =>
  plan.total > 0 && plan.done === plan.total && plan.notReady > 0 && plan.closed > 0 && !plan.openAhead && plan.notReady >= plan.closedInHorizon;

export function freeLessonsLine(input: FreeLessonsLineInput): FreeLessonsLine {
  if (!input.gating || !input.owner || input.covered !== false) return null;
  const product: FreeLessonsProduct = input.spaceKind === 'family' ? 'family' : 'class';
  if (input.freeEnd === true) return { code: 'free-end', product };
  const plan = (input.plans ?? []).find(waiting);
  if (plan) return { code: 'plan-waiting', product, closed: plan.closed };
  return input.neutral === true ? { code: 'free-plan', product } : null;
}

/**
 * What a plan's items say about the free plan (all of Stage 1, OD-1): how many distinct lessons
 * of the plan open with a paid plan, and whether an item that is open on the free plan is dated
 * after `horizonEnd` (a curriculum's today + `horizonDays`; null for a classic plan, which the
 * device derives whole). An episode item stands for its cell's quests; a coming-soon episode, a
 * story and an unknown id are never closed. A quest the learner finished before the switch
 * turned on stays open on the device (kept) but still counts here: the console has no quest ids.
 */
export function planFreeFacts(items: readonly PlanItem[], catalog: Catalog, horizonEnd: string | null, stages: readonly StageKey[] = FREE_ROUTE_STAGES): PlanFreeFacts {
  const free = freeRouteQuestIds(catalog, stages);
  const grid = gridLessonIds(catalog);
  const stories = new Set(catalog.quests.filter((quest) => quest.kind === 'story').map((quest) => quest.id));
  const questsOf = (item: PlanItem): readonly string[] => (item.kind === 'quest' ? [item.id] : (catalog.cells.find((cell) => cell.episodeId === item.id)?.questIds ?? []));
  const closed = new Set<string>();
  const closedInHorizon = new Set<string>();
  let openAhead = false;
  for (const item of items) {
    const ahead = horizonEnd !== null && item.targetDate !== undefined && item.targetDate > horizonEnd;
    for (const questId of questsOf(item)) {
      if (grid.has(questId) && !free.has(questId)) {
        closed.add(questId);
        if (!ahead) closedInHorizon.add(questId);
      } else if (ahead && (free.has(questId) || stories.has(questId))) openAhead = true;
    }
  }
  return { closed: closed.size, closedInHorizon: closedInHorizon.size, openAhead };
}
