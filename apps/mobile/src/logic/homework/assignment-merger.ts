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
}

export interface MergeResult {
  plan: MissionPlan;
  /** Assignments that did not fit today, in queue order. */
  deferred: HomeworkAssignment[];
}

/**
 * Assignments for this learner targeting today that are still outstanding,
 * earliest `assignedAt` first (§3.4 tie-break).
 */
export function assignmentsForToday(
  assignments: readonly HomeworkAssignment[],
  profileId: string,
  today: string,
): HomeworkAssignment[] {
  return assignments
    .filter(
      (a) => a.profileId === profileId && a.targetDate === today && a.completedAt === undefined,
    )
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
}

export function mergeAssignments({
  plan,
  assignments,
  today,
  enabled,
  titleOf,
}: MergeInput): MergeResult {
  if (!enabled) {
    return { plan, deferred: [] };
  }
  const queue = assignmentsForToday(assignments, plan.profileId, today);
  if (queue.length === 0) {
    return { plan, deferred: [] };
  }

  const [winner, ...rest] = queue as [HomeworkAssignment, ...HomeworkAssignment[]];
  const title = titleOf(winner.questId);
  if (title === undefined) {
    // An assignment pointing at a quest this build does not know about is not
    // rendered — gating (§3.4) should have refused it at create time.
    return { plan, deferred: [...queue] };
  }

  return {
    plan: {
      ...plan,
      cards: plan.cards.map((card) =>
        card.slot === 2
          ? {
              ...card,
              kind: 'new' as const,
              titleEn: title,
              subtitleEn: 'Picked just for you',
              questId: winner.questId,
              episodeId: winner.episodeId,
            }
          : card,
      ),
    },
    deferred: rest,
  };
}
