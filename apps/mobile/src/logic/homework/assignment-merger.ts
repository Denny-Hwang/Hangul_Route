import type { HomeworkAssignment } from '@hangul-route/content-schema';
import type { MissionPlan } from './mission-builder';

/**
 * Explicit caregiver assignment merge — F-HW-001 §3.4 (Phase 2).
 *
 * An assignment replaces slot ② (New). Slots ① and ③ stay system-suggested,
 * and at most one explicit assignment lands per day so the 3-card budget
 * survives; the rest queue for later days.
 */

export const MAX_EXPLICIT_PER_DAY = 1;

export interface MergeInput {
  plan: MissionPlan;
  assignments: readonly HomeworkAssignment[];
  /** YYYY-MM-DD. */
  today: string;
  /** `homework.explicitAssignment` — false in MVP (§7). */
  enabled: boolean;
  /** Resolves a quest id to its learner-facing title. */
  titleOf: (questId: string) => string | undefined;
  /**
   * May the learner start this quest now (F-ENT-003 section 3.5)? Home
   * passes `qualifiesForNext` (known, playable, open, not done); an assignment
   * that fails is skipped like an unknown one, so card (2) names the same
   * quest as `routeNext` step 1. Omitted means every quest qualifies.
   */
  isQuestOpen?: (questId: string) => boolean;
}

export interface MergeResult {
  plan: MissionPlan;
  /** Assignments that did not fit today, in queue order. */
  deferred: HomeworkAssignment[];
}

/** Section 3.10 of F-PLAN-002: class (teacher) first, then family (parent), then the learner's own plan (system). */
export const SOURCE_RANK: Record<HomeworkAssignment['assignedBy'], number> = { teacher: 0, parent: 1, system: 2 };

/** The precedence order of outstanding assignments: source rank, then the earlier `targetDate`, then the earlier `assignedAt`. */
export function compareAssignments(a: HomeworkAssignment, b: HomeworkAssignment): number {
  return (
    SOURCE_RANK[a.assignedBy] - SOURCE_RANK[b.assignedBy] ||
    a.targetDate.localeCompare(b.targetDate) ||
    a.assignedAt.localeCompare(b.assignedAt)
  );
}

/**
 * Assignments for this learner due today or earlier that are still
 * outstanding (an unfinished item carries over and is never shown as late),
 * in precedence order (F-PLAN-002 sections 3.6 and 3.10).
 */
export function assignmentsForToday(
  assignments: readonly HomeworkAssignment[],
  profileId: string,
  today: string,
): HomeworkAssignment[] {
  return assignments
    .filter((a) => a.profileId === profileId && a.targetDate <= today && a.completedAt === undefined)
    .sort(compareAssignments);
}

export function mergeAssignments({
  plan,
  assignments,
  today,
  enabled,
  titleOf,
  isQuestOpen,
}: MergeInput): MergeResult {
  if (!enabled) {
    return { plan, deferred: [] };
  }
  const queue = assignmentsForToday(assignments, plan.profileId, today);
  if (queue.length === 0) {
    return { plan, deferred: [] };
  }

  // An assignment pointing at a quest this build does not know about is not
  // rendered — gating (§3.4) should have refused it at create time. It stays
  // queued, and the next known one takes the card, so a carried-over unknown
  // item never holds card ② for good.
  const pick = queue
    .map((assignment) => ({ assignment, title: !isQuestOpen || isQuestOpen(assignment.questId) ? titleOf(assignment.questId) : undefined }))
    .find((x): x is { assignment: HomeworkAssignment; title: string } => x.title !== undefined);
  if (pick === undefined) {
    return { plan, deferred: [...queue] };
  }
  const { assignment: winner, title } = pick;
  const rest = queue.filter((a) => a !== winner);

  return {
    plan: {
      ...plan,
      cards: plan.cards.map((card) =>
        card.slot === 2
          ? {
              ...card,
              kind: 'new' as const,
              titleEn: title,
              subtitle: 'assigned',
              questId: winner.questId,
              episodeId: winner.episodeId,
            }
          : card,
      ),
    },
    deferred: rest,
  };
}
