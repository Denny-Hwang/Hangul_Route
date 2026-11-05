import {
  addDays,
  HORIZON_DAYS,
  type CurriculumMeta,
  type Episode,
  type HomeworkAssignment,
  type InboxPlan,
  type PlanItem,
  type ProgressSnapshot,
  type Quest,
  type SelfRoute,
  requiredQuestIds,
} from '@hangul-route/content-schema';
import { curriculumInForce, isClassKind, layerOf } from '../route/layer';
import { canAssignQuest } from './gating';

/**
 * Plan → homework on the learner device — F-PLAN-001 §3.3, extended by
 * F-PLAN-002 section 3.6. Idempotent: assignment ids are `<sourceId>#<questId>`,
 * so re-applying the same inbox adds nothing. Locked, closed (F-ENT-003
 * section 3.6) or unknown items are skipped silently and counted as not ready
 * (F-HW-001 §3.4 ruling for class plans). A curriculum derives one horizon of
 * days at a time, and every pass reconciles pending assignments with the
 * current plan (new dates, removed, locked or closed items); finished
 * assignments are never touched.
 */
export const PLAN_ID_SEPARATOR = '#';

export function planAssignmentId(planId: string, questId: string): string {
  return `${planId}${PLAN_ID_SEPARATOR}${questId}`;
}

/** The plan an assignment came from, or null for caregiver / system / self-route assignments. */
export function planIdOf(assignmentId: string): string | null {
  if (!assignmentId.startsWith('plan:')) return null;
  const at = assignmentId.indexOf(PLAN_ID_SEPARATOR);
  return at > 0 ? assignmentId.slice(0, at) : null;
}

/** The source (`plan:…` or the self-route's `route:…`) an assignment came from, or null for caregiver ones. */
export function sourceIdOf(assignmentId: string): string | null {
  if (!assignmentId.startsWith('plan:') && !assignmentId.startsWith('route:')) return null;
  const at = assignmentId.indexOf(PLAN_ID_SEPARATOR);
  return at > 0 ? assignmentId.slice(0, at) : null;
}

/** Where a derivation source comes from: a space's inbox plan, or the learner's own weekly plan. */
export type SourceKind = InboxPlan['spaceKind'] | 'self';

/** One plan the device derives from (F-PLAN-002 section 3.6). */
export interface DeriveSource {
  /** `plan:…` for an inbox plan, `route:…` for the self-route. */
  id: string;
  kind: SourceKind;
  /** Copied onto every assignment it creates. */
  assignedAt: string;
  items: readonly PlanItem[];
  /** A curriculum's meta (horizon); null or absent for a classic plan. */
  meta?: CurriculumMeta | null;
}

/** Rule 4: class -> teacher, family -> parent, self -> system; a school space keeps `parent`. */
export const ASSIGNED_BY: Record<SourceKind, HomeworkAssignment['assignedBy']> = {
  class: 'teacher',
  family: 'parent',
  school: 'parent',
  self: 'system',
};

const sourceOfPlan = (p: InboxPlan): DeriveSource => ({ id: p.id, kind: p.spaceKind, assignedAt: p.publishedAt, items: p.items, meta: p.meta ?? null });

/** Own and family plans step aside for a class or school curriculum's quests (section 8). */
const yieldsToClass = (kind: SourceKind): boolean => kind === 'self' || kind === 'family';

/**
 * The learner's own weekly plan rests while a class plan with practice days is in force (AMENDMENTS-ROUTE-CLASS-BLEND
 * section 8, BL-OD-5): a pure check of the plans on `today`, never stored. False for an archived or missing plan.
 */
export function selfRouteResting(plans: readonly InboxPlan[], selfRoute: SelfRoute | null | undefined, today: string): boolean {
  if (!selfRoute || selfRoute.archivedAt !== null) return false;
  return layerOf(plans.map(sourceOfPlan), today) === 'class-with-practice';
}

/**
 * The inbox plans plus the self-route as a synthetic source while it is active (not archived). With `today`, the
 * self-route is left out while it rests (`selfRouteResting`, section 8); every app caller passes the plan day.
 */
export function sourcesOf(plans: readonly InboxPlan[], selfRoute: SelfRoute | null | undefined, today?: string): DeriveSource[] {
  const sources: DeriveSource[] = plans.map(sourceOfPlan);
  if (selfRoute && selfRoute.archivedAt === null && !(today !== undefined && selfRouteResting(plans, selfRoute, today))) {
    sources.push({ id: selfRoute.id, kind: 'self', assignedAt: selfRoute.createdAt, items: selfRoute.items, meta: selfRoute.meta });
  }
  return sources;
}

/** The sources whose pending assignments rest on `today`: the own weekly plan's id while it rests, else none. */
export function restingSourceIds(plans: readonly InboxPlan[], selfRoute: SelfRoute | null | undefined, today: string): string[] {
  return selfRoute && selfRouteResting(plans, selfRoute, today) ? [selfRoute.id] : [];
}

/**
 * The pending items an own or a family plan holds for a quest an in-force class or school curriculum schedules
 * (section 8, dedupe in every layer): kept in the snapshot (never deleted, so a family plan's progress keeps its
 * total), left out of Home, Homework and `routeNext`, and back as soon as the class plan drops the quest.
 */
export interface YieldToClass {
  /** The own and family sources in force (`route:…`, `plan:…`). */
  sourceIds: ReadonlySet<string>;
  /** `classScheduledQuestIds`. */
  questIds: ReadonlySet<string>;
}

/** What Home, Homework and `routeNext` leave out today: a resting source's pending items and those yielding to class. */
export interface HiddenHomework {
  resting: readonly string[];
  yielding: YieldToClass;
}

/** `HiddenHomework` of the plans on `today` (section 8). */
export function hiddenHomeworkOf(plans: readonly InboxPlan[], selfRoute: SelfRoute | null | undefined, today: string, episodes: readonly Episode[]): HiddenHomework {
  const sources = sourcesOf(plans, selfRoute, today);
  const yielding = sources.filter((s) => yieldsToClass(s.kind));
  return {
    resting: restingSourceIds(plans, selfRoute, today),
    yielding: {
      sourceIds: new Set(yielding.map((s) => s.id)),
      questIds: yielding.length === 0 ? new Set<string>() : classScheduledQuestIds(sources, today, episodes),
    },
  };
}

/** True when nothing is hidden: callers keep the snapshot as it is. */
export const nothingHidden = (hidden: HiddenHomework): boolean => hidden.resting.length === 0 && hidden.yielding.questIds.size === 0;

/**
 * The homework Home and Homework show (section 8): a resting source's pending assignments, and an own or family
 * plan's pending assignments that yield to an in-force class curriculum, stay in the snapshot (none removed, none
 * marked late) and are left out here; finished ones and every other assignment show as before. A bare list names the
 * resting sources only.
 */
export function visibleHomework<H extends Pick<HomeworkAssignment, 'id' | 'completedAt' | 'questId'>>(homework: readonly H[], hidden: readonly string[] | HiddenHomework): H[] {
  const resting = Array.isArray(hidden) ? (hidden as readonly string[]) : (hidden as HiddenHomework).resting;
  const yielding = Array.isArray(hidden) ? null : (hidden as HiddenHomework).yielding;
  if (resting.length === 0 && (yielding === null || yielding.questIds.size === 0)) return [...homework];
  return homework.filter((h) => {
    if (h.completedAt) return true;
    const sourceId = sourceIdOf(h.id);
    if (sourceId === null) return true;
    if (resting.includes(sourceId)) return false;
    return yielding === null || !(yielding.sourceIds.has(sourceId) && yielding.questIds.has(h.questId));
  });
}

/** The quests a plan item names: a quest, or the quests its episode needs (`requiredQuestIds`); none for an unknown episode. */
function questsOfItem(item: PlanItem, episodeById: ReadonlyMap<string, Episode>): readonly string[] {
  if (item.kind === 'quest') return [item.id];
  const episode = episodeById.get(item.id);
  return episode ? requiredQuestIds(episode) : [];
}

/**
 * Every quest a class or school curriculum in force on `today` schedules, at any date (section 8, BL-6): an own or a
 * family plan never repeats them while it is in force, and a new own plan leaves them out.
 */
export function classScheduledQuestIds(sources: readonly DeriveSource[], today: string, episodes: readonly Episode[]): Set<string> {
  const episodeById = new Map(episodes.map((e) => [e.id, e]));
  const ids = new Set<string>();
  for (const source of sources) {
    if (!isClassKind(source.kind) || !curriculumInForce(source.meta, today)) continue;
    for (const item of source.items) for (const id of questsOfItem(item, episodeById)) ids.add(id);
  }
  return ids;
}

export interface DeriveInput {
  sources: readonly DeriveSource[];
  snapshot: ProgressSnapshot;
  profileId: string;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  unlockedStages: readonly string[];
  /** YYYY-MM-DD — the default target date and the start of the horizon. */
  today: string;
  learnerName: string;
  /**
   * May the learner start this quest (`questOpenFor`, F-ENT-003 section 3.6)?
   * A closed item is treated exactly like a stage-locked one: not derived,
   * counted in `notReady`, and a pending assignment for it is removed. Omitted
   * means every quest is open.
   */
  isQuestOpen?: (questId: string) => boolean;
  /**
   * Sources resting today (`restingSourceIds`, AMENDMENTS-ROUTE-CLASS-BLEND section 8): their pending assignments are
   * kept exactly as they are (not removed, not re-dated) until the source derives again.
   */
  resting?: readonly string[];
}

export interface DeriveResult {
  homework: HomeworkAssignment[];
  added: number;
  removed: number;
  /** Pending assignments moved to their item's new date. */
  redated: number;
  completedNow: number;
  /** Items skipped per source because the learner cannot open them yet. */
  notReady: Record<string, number>;
  changed: boolean;
}

interface Wanted {
  source: DeriveSource;
  questId: string;
  episodeId: string;
  targetDate: string | undefined;
  /** The item has a `lectureDate`: class taught it first (section 9.4). */
  fromClass: boolean;
}

export function deriveAssignments(input: DeriveInput): DeriveResult {
  const { sources, snapshot, profileId, quests, episodes, unlockedStages, today, learnerName, isQuestOpen } = input;
  const resting = new Set(input.resting ?? []);
  const questIds = new Set(quests.map((q) => q.id));
  const episodeById = new Map(episodes.map((e) => [e.id, e]));
  const episodeOfQuest = (questId: string): Episode | undefined => episodes.find((e) => e.questIds.includes(questId));
  const completedAtOf = (questId: string): string | undefined => snapshot.quests.find((q) => q.questId === questId && q.completedAt)?.completedAt;
  const activeSourceIds = new Set(sources.map((s) => s.id));
  const notReady: Record<string, number> = {};
  const bump = (sourceId: string): void => {
    notReady[sourceId] = (notReady[sourceId] ?? 0) + 1;
  };

  // Section 8 (every layer): an own or family plan's item whose quest an in-force class or school curriculum schedules
  // is skipped for that source; the plan keeps the item, so it derives again if the class plan drops the quest. A
  // pending assignment it already made stays as it is (hidden, never deleted: `visibleHomework`).
  const classQuests = sources.some((s) => yieldsToClass(s.kind)) ? classScheduledQuestIds(sources, today, episodes) : new Set<string>();

  // What the sources ask for today: the first item naming a quest wins its date.
  const wanted = new Map<string, Wanted>();
  const yielded = new Set<string>();
  for (const source of sources) {
    const yields = yieldsToClass(source.kind);
    // Rule 1: a curriculum stops at today + horizonDays; a classic plan has no horizon.
    const horizonEnd = source.meta ? addDays(today, source.meta.horizonDays ?? HORIZON_DAYS) : null;
    for (const item of source.items) {
      if (horizonEnd !== null && item.targetDate !== undefined && item.targetDate > horizonEnd) continue;
      // An episode item names the quests the episode needs (`requiredQuestIds`, F-CURR-002 section 4.2): an optional
      // addition that ships after the plan was saved never lands on it as a new (often overdue) assignment.
      const episode = item.kind === 'quest' ? undefined : episodeById.get(item.id);
      const targets = item.kind === 'quest' ? [item.id] : episode ? requiredQuestIds(episode) : [];
      if (targets.length === 0) {
        bump(source.id);
        continue;
      }
      for (const questId of targets) {
        if (yields && classQuests.has(questId)) {
          yielded.add(planAssignmentId(source.id, questId));
          continue;
        }
        const episode = episodeOfQuest(questId);
        if (!episode || !questIds.has(questId) || !canAssignQuest({ questId, episodes, unlockedStages, learnerName, isQuestOpen }).allowed) {
          bump(source.id);
          continue;
        }
        const id = planAssignmentId(source.id, questId);
        if (!wanted.has(id)) wanted.set(id, { source, questId, episodeId: episode.id, targetDate: item.targetDate, fromClass: item.lectureDate !== undefined });
      }
    }
  }

  let added = 0;
  let removed = 0;
  let redated = 0;
  let completedNow = 0;
  let relabelled = 0;
  const next = new Map<string, HomeworkAssignment>();

  // Rule 2: reconcile what the device already holds. Finished and caregiver assignments stay as they are.
  for (const h of snapshot.homework) {
    const sourceId = sourceIdOf(h.id);
    // A resting source's pending items wait as they are (section 8): hidden on Home and Homework, never late.
    if (sourceId === null || h.completedAt || (resting.has(sourceId) && !activeSourceIds.has(sourceId))) {
      next.set(h.id, h);
      continue;
    }
    const want = activeSourceIds.has(sourceId) ? wanted.get(h.id) : undefined;
    if (!want && yielded.has(h.id)) {
      // Yields to the class plan (section 8): kept as it is, hidden on Home and Homework.
      next.set(h.id, h);
      continue;
    }
    if (!want) {
      // The source left the inbox, or its item left the plan, the horizon, the unlocked stages or the open quests.
      removed += 1;
      continue;
    }
    const label = (h.fromClass === true) === want.fromClass ? h : withFromClass(h, want.fromClass);
    if (label !== h) relabelled += 1;
    if (want.targetDate !== undefined && want.targetDate !== h.targetDate) {
      next.set(h.id, { ...label, targetDate: want.targetDate });
      redated += 1;
      continue;
    }
    next.set(h.id, label);
  }

  for (const [id, want] of wanted) {
    const done = completedAtOf(want.questId);
    const current = next.get(id);
    if (current) {
      if (!current.completedAt && done) {
        next.set(id, { ...current, completedAt: done });
        completedNow += 1;
      }
      continue;
    }
    next.set(id, {
      id,
      profileId,
      questId: want.questId,
      episodeId: want.episodeId,
      assignedBy: ASSIGNED_BY[want.source.kind],
      assignedAt: want.source.assignedAt,
      targetDate: want.targetDate ?? today,
      ...(want.fromClass ? { fromClass: true } : {}),
      ...(done ? { completedAt: done } : {}),
    });
    added += 1;
  }

  return {
    homework: [...next.values()],
    added,
    removed,
    redated,
    completedNow,
    notReady,
    changed: added + removed + redated + completedNow + relabelled > 0,
  };
}

/** `fromClass` is written only when true (section 9.4); an item that lost its `lectureDate` drops the key. */
function withFromClass(h: HomeworkAssignment, fromClass: boolean): HomeworkAssignment {
  if (fromClass) return { ...h, fromClass: true };
  const { fromClass: _gone, ...rest } = h;
  return rest;
}
