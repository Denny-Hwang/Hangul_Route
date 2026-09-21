import type { Episode, HomeworkAssignment, InboxPlan, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { canAssignQuest } from './gating';

/**
 * Plan → homework on the learner device — F-PLAN-001 §3.3. Idempotent:
 * assignment ids are `<planId>#<questId>`, so re-applying the same inbox
 * adds nothing. Locked or unknown items are skipped silently and counted
 * as not ready (F-HW-001 §3.4 ruling for class plans).
 */
export const PLAN_ID_SEPARATOR = '#';

export function planAssignmentId(planId: string, questId: string): string {
  return `${planId}${PLAN_ID_SEPARATOR}${questId}`;
}

/** The plan an assignment came from, or null for caregiver / system assignments. */
export function planIdOf(assignmentId: string): string | null {
  if (!assignmentId.startsWith('plan:')) return null;
  const at = assignmentId.indexOf(PLAN_ID_SEPARATOR);
  return at > 0 ? assignmentId.slice(0, at) : null;
}

export interface DeriveInput {
  plans: readonly InboxPlan[];
  snapshot: ProgressSnapshot;
  profileId: string;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  unlockedStages: readonly string[];
  /** YYYY-MM-DD — the default target date. */
  today: string;
  learnerName: string;
}

export interface DeriveResult {
  homework: HomeworkAssignment[];
  added: number;
  removed: number;
  completedNow: number;
  /** Items skipped per plan because the learner cannot open them yet. */
  notReady: Record<string, number>;
  changed: boolean;
}

export function deriveAssignments(input: DeriveInput): DeriveResult {
  const { plans, snapshot, profileId, quests, episodes, unlockedStages, today, learnerName } = input;
  const questIds = new Set(quests.map((q) => q.id));
  const episodeById = new Map(episodes.map((e) => [e.id, e]));
  const episodeOfQuest = (questId: string): Episode | undefined => episodes.find((e) => e.questIds.includes(questId));
  const completedAtOf = (questId: string): string | undefined => snapshot.quests.find((q) => q.questId === questId && q.completedAt)?.completedAt;
  const activePlanIds = new Set(plans.map((p) => p.id));
  const notReady: Record<string, number> = {};
  const bump = (planId: string): void => {
    notReady[planId] = (notReady[planId] ?? 0) + 1;
  };

  let added = 0;
  let removed = 0;
  let completedNow = 0;
  const next = new Map<string, HomeworkAssignment>();
  for (const h of snapshot.homework) {
    const planId = planIdOf(h.id);
    if (planId && !activePlanIds.has(planId) && !h.completedAt) {
      removed += 1;
      continue;
    }
    next.set(h.id, h);
  }

  for (const plan of plans) {
    for (const item of plan.items) {
      const targets = item.kind === 'quest' ? [item.id] : (episodeById.get(item.id)?.questIds ?? []);
      if (targets.length === 0) {
        bump(plan.id);
        continue;
      }
      for (const questId of targets) {
        if (!questIds.has(questId) || !canAssignQuest({ questId, episodes, unlockedStages, learnerName }).allowed) {
          bump(plan.id);
          continue;
        }
        const id = planAssignmentId(plan.id, questId);
        const done = completedAtOf(questId);
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
          questId,
          episodeId: episodeOfQuest(questId)?.id ?? '',
          assignedBy: plan.spaceKind === 'class' ? 'teacher' : 'parent',
          assignedAt: plan.publishedAt,
          targetDate: item.targetDate ?? today,
          ...(done ? { completedAt: done } : {}),
        });
        added += 1;
      }
    }
  }

  return { homework: [...next.values()], added, removed, completedNow, notReady, changed: added + removed + completedNow > 0 };
}
