import {
  addDays,
  HORIZON_DAYS,
  type DateKey,
  type Episode,
  type HomeworkAssignment,
  type InboxPlan,
  type ProgressSnapshot,
  type Quest,
  type StageKey,
} from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../platform/telemetry';
import { cursorContext, type CursorContext } from './cursor-context';
import type { Tier } from './entitlement';
import { assignmentsForToday, SOURCE_RANK } from './homework/assignment-merger';
import { ASSIGNED_BY, sourceIdOf, sourcesOf, type DeriveSource, type SourceKind } from './homework/plan-derivation';
import { nextQuestAfter, offerableQuests } from './next-quest';

/**
 * The one "next" of the app and the "In your plan" set (F-ENT-003 section
 * 3.5, PR E3-4). Every surface that names a next quest or marks plan items
 * calls this module: Home card (2), the Results teaser, the placement result,
 * and later the Journey, the episode page, the Library and the Learning Route
 * (LR-3b imports it; there is no `logic/my-route/next.ts`).
 *
 * The rule (a quest qualifies at every step only when it is known, playable,
 * open and not done, `justCompleted` counting as done):
 * 1. due now: the first qualifying item of `assignmentsForToday`, the same
 *    function Home card (2) uses;
 * 2. else the leading source: the plan sources ranked class, then family and
 *    school, then self (newest `assignedAt` first inside a rank); the first
 *    with a qualifying pending item leads, and its earliest item (by
 *    `targetDate`, then by the source's list order) is next. Dates never
 *    filter: nothing is early or late;
 * 3. else the default route: the one cursor (`nextQuestAfter`, F-ROUTE-001
 *    M4), with today's placed-out fallback, except that a free learner with
 *    the switch on goes to step 4 with `placedOut`;
 * 4. else `free-end` (switch on, free, a playable grid lesson is closed) or
 *    `rest`.
 *
 * Pure; reads no store and no clock.
 */

/** Where the next quest comes from; aligned with the Learning Route's `GoalFrom`. */
export type NextSource = 'class' | 'school' | 'family' | 'self' | 'cursor';

export type RouteNext =
  | {
      kind: 'quest';
      questId: string;
      episodeId: string;
      stage: StageKey;
      source: NextSource;
      /** The plan source (`plan:…` or `route:…`); null for the cursor and for an explicit assignment. */
      sourceId: string | null;
      /** Set when the quest comes from a homework assignment (steps 1 and 2). */
      assignmentId?: string;
    }
  /** The effective switch is on, the learner is free, nothing new is open and a closed lesson exists. */
  | { kind: 'free-end'; placedOut: boolean }
  /** Nothing open is left to do. */
  | { kind: 'rest' };

export interface RouteNextInput {
  snapshot: ProgressSnapshot;
  profileId: string;
  today: DateKey;
  /** `sourcesOf(plans, snapshot.selfRoute)`. */
  sources: readonly DeriveSource[];
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** From `cursorContext` (F-ROUTE-001 R-4a), with `isQuestOpen`. */
  cursor: CursorContext;
  /** `questOpenFor` / `useQuestAccess` (F-ENT-003 section 3.4). */
  isQuestOpen: (questId: string) => boolean;
  /** `gatingActive(flags, bundleOs())` and the access tier. */
  gating: { active: boolean; tier: Tier };
  /** A quest completed by the write being shown; counted as done before the snapshot has it. */
  justCompleted?: string;
}

export interface PlanView {
  leadingSourceId: string | null;
  /** Never `cursor`. */
  leadingKind: SourceKind | null;
  inPlanQuestIds: ReadonlySet<string>;
  inPlanEpisodeIds: ReadonlySet<string>;
}

/** An explicit assignment (no plan source) by who made it. */
const EXPLICIT_SOURCE: Record<HomeworkAssignment['assignedBy'], SourceKind> = { teacher: 'class', parent: 'family', system: 'self' };

/** The derivation rank of a source kind (F-PLAN-002 section 3.10): class, then family and school, then self. */
const rankOf = (kind: SourceKind): number => SOURCE_RANK[ASSIGNED_BY[kind]];

/** After every listed item. */
const UNLISTED = Number.MAX_SAFE_INTEGER;

interface Facts {
  done: ReadonlySet<string>;
  questIds: ReadonlySet<string>;
  episodeOf: ReadonlyMap<string, Episode>;
}

function factsOf(i: RouteNextInput): Facts {
  const done = new Set(i.snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
  if (i.justCompleted) done.add(i.justCompleted);
  const episodeOf = new Map<string, Episode>();
  for (const e of i.episodes) for (const id of e.questIds) if (!episodeOf.has(id)) episodeOf.set(id, e);
  return { done, questIds: new Set(i.quests.map((q) => q.id)), episodeOf };
}

/** The quest's episode when it qualifies (known, playable, open, not done), else null. */
function qualifying(i: RouteNextInput, f: Facts, questId: string): Episode | null {
  if (!f.questIds.has(questId) || f.done.has(questId) || !i.isQuestOpen(questId)) return null;
  const episode = f.episodeOf.get(questId);
  return episode && (episode.status === 'shipped' || episode.status === 'ready') ? episode : null;
}

interface Item {
  assignment: HomeworkAssignment;
  episode: Episode;
}

/** The position of each quest in a source's list; an episode item expands to its quests in order. */
function listOrder(source: DeriveSource, episodes: readonly Episode[]): Map<string, number> {
  const order = new Map<string, number>();
  for (const item of source.items) {
    const ids = item.kind === 'quest' ? [item.id] : (episodes.find((e) => e.id === item.id)?.questIds ?? []);
    for (const id of ids) if (!order.has(id)) order.set(id, order.size);
  }
  return order;
}

/** A source's pending qualifying items, earliest `targetDate` first, then in list order. */
function pendingOf(i: RouteNextInput, f: Facts, source: DeriveSource): Item[] {
  const order = listOrder(source, i.episodes);
  const items: Item[] = [];
  for (const assignment of i.snapshot.homework) {
    if (assignment.profileId !== i.profileId || assignment.completedAt || sourceIdOf(assignment.id) !== source.id) continue;
    const episode = qualifying(i, f, assignment.questId);
    if (episode) items.push({ assignment, episode });
  }
  const at = (item: Item): number => order.get(item.assignment.questId) ?? UNLISTED;
  return items.sort((a, b) => a.assignment.targetDate.localeCompare(b.assignment.targetDate) || at(a) - at(b));
}

/** The leading source and its ordered items, or null when no source has a qualifying item (step 2). */
function leadingOf(i: RouteNextInput, f: Facts): { source: DeriveSource; items: Item[] } | null {
  const ranked = [...i.sources].sort((a, b) => rankOf(a.kind) - rankOf(b.kind) || b.assignedAt.localeCompare(a.assignedAt));
  for (const source of ranked) {
    const items = pendingOf(i, f, source);
    if (items.length > 0) return { source, items };
  }
  return null;
}

function questNext(questId: string, episode: Episode, source: NextSource, sourceId: string | null, assignmentId?: string): RouteNext {
  return {
    kind: 'quest',
    questId,
    episodeId: episode.id,
    stage: episode.stage,
    source,
    sourceId,
    ...(assignmentId === undefined ? {} : { assignmentId }),
  };
}

/** Step 4: the end of the free lessons, or rest. */
function endOf(i: RouteNextInput, placedOut: boolean): RouteNext {
  const free = i.gating.active && i.gating.tier === 'free';
  if (free && offerableQuests(i.quests, i.episodes).some((q) => !i.isQuestOpen(q.id))) return { kind: 'free-end', placedOut };
  return { kind: 'rest' };
}

export function routeNext(i: RouteNextInput): RouteNext {
  const f = factsOf(i);

  // 1. Due now: Home card (2)'s own list.
  for (const assignment of assignmentsForToday(i.snapshot.homework, i.profileId, i.today)) {
    const episode = qualifying(i, f, assignment.questId);
    if (!episode) continue;
    const sourceId = sourceIdOf(assignment.id);
    const kind = i.sources.find((s) => s.id === sourceId)?.kind ?? EXPLICIT_SOURCE[assignment.assignedBy];
    return questNext(assignment.questId, episode, kind, sourceId, assignment.id);
  }

  // 2. The leading source's earliest item.
  const leading = leadingOf(i, f);
  const first = leading?.items[0];
  if (leading && first) return questNext(first.assignment.questId, first.episode, leading.source.kind, leading.source.id, first.assignment.id);

  // 3. The default route: the one cursor.
  const cursor = {
    snapshot: i.snapshot,
    quests: i.quests,
    episodes: i.episodes,
    isEntitled: i.cursor.isEntitled,
    isQuestOpen: i.isQuestOpen,
    ...(i.justCompleted === undefined ? {} : { justCompleted: i.justCompleted }),
  };
  const fresh = nextQuestAfter({ ...cursor, skipQuestIds: i.cursor.skipQuestIds });
  if (fresh) return questNext(fresh.id, f.episodeOf.get(fresh.id) as Episode, 'cursor', null);
  // Only placed-out quests are left (F-ROUTE-001 section 3.5 fallback).
  const fallback = i.cursor.skipQuestIds === undefined ? undefined : nextQuestAfter(cursor);
  if (fallback) {
    if (i.gating.active && i.gating.tier === 'free') return endOf(i, true);
    return questNext(fallback.id, f.episodeOf.get(fallback.id) as Episode, 'cursor', null);
  }

  // 4. Nothing new is open.
  return endOf(i, false);
}

/**
 * Step 1's qualification as a predicate: known, playable, open and not done.
 * Home passes it to `mergeAssignments`, so an assignment card (2) shows is
 * the one `routeNext` step 1 picks.
 */
export function qualifiesForNext(i: RouteNextInput): (questId: string) => boolean {
  const f = factsOf(i);
  return (questId) => qualifying(i, f, questId) !== null;
}

/** True while one of the input's plan sources still holds the quest (pending or done). */
export function inAPlan(i: RouteNextInput, questId: string): boolean {
  const ids = new Set(i.sources.map((s) => s.id));
  return i.snapshot.homework.some((h) => {
    if (h.profileId !== i.profileId || h.questId !== questId) return false;
    const sourceId = sourceIdOf(h.id);
    return sourceId !== null && ids.has(sourceId);
  });
}

const EMPTY_VIEW: PlanView = { leadingSourceId: null, leadingKind: null, inPlanQuestIds: new Set(), inPlanEpisodeIds: new Set() };

/**
 * "In your plan": the leading source's pending qualifying items dated inside
 * the derivation horizon (today plus `HORIZON_DAYS`), as quest ids and episode
 * ids. The leading source is step 2's, computed even when step 1 hit.
 */
export function planView(i: RouteNextInput): PlanView {
  const leading = leadingOf(i, factsOf(i));
  if (!leading) return EMPTY_VIEW;
  // The source's own derivation horizon (F-PLAN-002 section 3.6 rule 1): a curriculum's `horizonDays`; a classic plan the default.
  const end = addDays(i.today, leading.source.meta?.horizonDays ?? HORIZON_DAYS);
  const inside = leading.items.filter((item) => item.assignment.targetDate <= end);
  return {
    leadingSourceId: leading.source.id,
    leadingKind: leading.source.kind,
    inPlanQuestIds: new Set(inside.map((item) => item.assignment.questId)),
    inPlanEpisodeIds: new Set(inside.map((item) => item.episode.id)),
  };
}

export interface RouteNextContext {
  snapshot: ProgressSnapshot;
  profileId: string;
  today: DateKey;
  /** The cached inbox plans of this learner (`usePlanStore`); undefined when none arrived. */
  plans: readonly InboxPlan[] | undefined;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** The access tier (`accessTier` / `useAccessTier`). */
  tier: Tier;
  /** `gatingActive(flags, bundleOs())`. */
  gatingActive: boolean;
  isQuestOpen: (questId: string) => boolean;
  justCompleted?: string;
}

/** The input every screen builds the same way: plan sources with the self-route, and the shared cursor. */
export function routeNextInputOf(c: RouteNextContext): RouteNextInput {
  return {
    snapshot: c.snapshot,
    profileId: c.profileId,
    today: c.today,
    sources: sourcesOf(c.plans ?? [], c.snapshot.selfRoute),
    quests: c.quests,
    episodes: c.episodes,
    cursor: cursorContext({ tier: c.tier, placements: c.snapshot.placements, quests: c.quests, episodes: c.episodes, isQuestOpen: c.isQuestOpen }),
    isQuestOpen: c.isQuestOpen,
    gating: { active: c.gatingActive, tier: c.tier },
    ...(c.justCompleted === undefined ? {} : { justCompleted: c.justCompleted }),
  };
}

/**
 * What Results needs from before the write (its first render): the plan
 * view, the quest that was `routeNext`, the learner's pending assignments and
 * the quests already done.
 */
export interface PlanBefore {
  view: PlanView;
  /** The quest `routeNext` named before the play; null at `free-end` or `rest`. */
  nextQuestId: string | null;
  /** Quest ids of this learner's pending assignments (any plan source, or explicit), at any date. */
  pendingQuestIds: ReadonlySet<string>;
  /** Quests completed before the play. */
  doneQuestIds: ReadonlySet<string>;
}

/** Takes the `PlanBefore` of an input whose snapshot does not yet hold the play. */
export function planBeforeOf(i: RouteNextInput): PlanBefore {
  const next = routeNext(i);
  const pending = i.snapshot.homework.filter((h) => h.profileId === i.profileId && !h.completedAt).map((h) => h.questId);
  return {
    view: planView(i),
    nextQuestId: next.kind === 'quest' ? next.questId : null,
    pendingQuestIds: new Set(pending),
    doneQuestIds: new Set(i.snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId)),
  };
}

/**
 * Off-plan (section 3.8): a leading source exists and the quest was none of
 * these before the play: in its "In your plan" set, the one next, or a
 * pending plan or assigned item. A learner who plays what the app named is
 * never off-plan.
 */
export function isOffPlan(before: PlanBefore, questId: string): boolean {
  return (
    before.view.leadingKind !== null &&
    !before.view.inPlanQuestIds.has(questId) &&
    before.nextQuestId !== questId &&
    !before.pendingQuestIds.has(questId)
  );
}

export type NextSurface = 'home' | 'results' | 'journey' | 'episode' | 'route' | 'placement';

/** `route.next_started { source, surface }`: a quest that was `routeNext` is started from that surface. */
export function nextStartedEvent(profileId: string | undefined, source: NextSource, surface: NextSurface): TelemetryEvent {
  return { name: 'route.next_started', ...(profileId === undefined ? {} : { profileId }), payload: { source, surface } };
}

/**
 * `route.offplan_finished { source, stage }` for a first completion of an
 * off-plan quest (`isOffPlan`, with `before` taken before the completion),
 * else null. A replay of a quest already done is review, not a detour, and
 * sends nothing (section 3.12). Codes and stage keys only.
 */
export function offplanFinishedEvent(
  profileId: string,
  before: PlanBefore,
  questId: string,
  episodes: readonly Episode[],
): TelemetryEvent | null {
  const source = before.view.leadingKind;
  if (source === null || !isOffPlan(before, questId) || before.doneQuestIds.has(questId)) return null;
  const episode = episodes.find((e) => e.questIds.includes(questId));
  if (!episode) return null;
  return { name: 'route.offplan_finished', profileId, payload: { source, stage: episode.stage } };
}
