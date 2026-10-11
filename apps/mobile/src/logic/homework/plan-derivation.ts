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
} from '@hangul-route/content-schema';
import { canAssignQuest } from './gating';

/**
 * Plan → homework on the learner device — F-PLAN-001 §3.3, extended by
 * F-PLAN-002 section 3.6. Idempotent: assignment ids are `<sourceId>#<questId>`,
 * so re-applying the same inbox adds nothing. Locked or unknown items are
 * skipped silently and counted as not ready (F-HW-001 §3.4 ruling for class
 * plans). A curriculum derives one horizon of days at a time, and every pass
 * reconciles pending assignments with the current plan (new dates, removed or
 * locked items); finished assignments are never touched.
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
const ASSIGNED_BY: Record<SourceKind, HomeworkAssignment['assignedBy']> = {
  class: 'teacher',
  family: 'parent',
  school: 'parent',
  self: 'system',
};

/** The inbox plans plus the self-route as a synthetic source while it is active (not archived). */
export function sourcesOf(plans: readonly InboxPlan[], selfRoute: SelfRoute | null | undefined): DeriveSource[] {
  const sources: DeriveSource[] = plans.map((p) => ({ id: p.id, kind: p.spaceKind, assignedAt: p.publishedAt, items: p.items, meta: p.meta ?? null }));
  if (selfRoute && selfRoute.archivedAt === null) {
    sources.push({ id: selfRoute.id, kind: 'self', assignedAt: selfRoute.createdAt, items: selfRoute.items, meta: selfRoute.meta });
  }
  return sources;
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
  targetDate: string | undefined;
}

export function deriveAssignments(input: DeriveInput): DeriveResult {
  const { sources, snapshot, profileId, quests, episodes, unlockedStages, today, learnerName } = input;
  const questIds = new Set(quests.map((q) => q.id));
  const episodeById = new Map(episodes.map((e) => [e.id, e]));
  const episodeOfQuest = (questId: string): Episode | undefined => episodes.find((e) => e.questIds.includes(questId));
  const completedAtOf = (questId: string): string | undefined => snapshot.quests.find((q) => q.questId === questId && q.completedAt)?.completedAt;
  const activeSourceIds = new Set(sources.map((s) => s.id));
  const notReady: Record<string, number> = {};
  const bump = (sourceId: string): void => {
    notReady[sourceId] = (notReady[sourceId] ?? 0) + 1;
  };

  // What the sources ask for today: the first item naming a quest wins its date.
  const wanted = new Map<string, Wanted>();
  for (const source of sources) {
    // Rule 1: a curriculum stops at today + horizonDays; a classic plan has no horizon.
    const horizonEnd = source.meta ? addDays(today, source.meta.horizonDays ?? HORIZON_DAYS) : null;
    for (const item of source.items) {
      if (horizonEnd !== null && item.targetDate !== undefined && item.targetDate > horizonEnd) continue;
      const targets = item.kind === 'quest' ? [item.id] : (episodeById.get(item.id)?.questIds ?? []);
      if (targets.length === 0) {
        bump(source.id);
        continue;
      }
      for (const questId of targets) {
        if (!questIds.has(questId) || !canAssignQuest({ questId, episodes, unlockedStages, learnerName }).allowed) {
          bump(source.id);
          continue;
        }
        const id = planAssignmentId(source.id, questId);
        if (!wanted.has(id)) wanted.set(id, { source, questId, targetDate: item.targetDate });
      }
    }
  }

  let added = 0;
  let removed = 0;
  let redated = 0;
  let completedNow = 0;
  const next = new Map<string, HomeworkAssignment>();

  // Rule 2: reconcile what the device already holds. Finished and caregiver assignments stay as they are.
  for (const h of snapshot.homework) {
    const sourceId = sourceIdOf(h.id);
    if (sourceId === null || h.completedAt) {
      next.set(h.id, h);
      continue;
    }
    const want = activeSourceIds.has(sourceId) ? wanted.get(h.id) : undefined;
    if (!want) {
      // The source left the inbox, or its item left the plan, the horizon or the unlocked stages.
      removed += 1;
      continue;
    }
    if (want.targetDate !== undefined && want.targetDate !== h.targetDate) {
      next.set(h.id, { ...h, targetDate: want.targetDate });
      redated += 1;
      continue;
    }
    next.set(h.id, h);
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
      episodeId: episodeOfQuest(want.questId)?.id ?? '',
      assignedBy: ASSIGNED_BY[want.source.kind],
      assignedAt: want.source.assignedAt,
      targetDate: want.targetDate ?? today,
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
    changed: added + removed + redated + completedNow > 0,
  };
}
