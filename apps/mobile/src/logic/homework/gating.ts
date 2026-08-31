import type { Episode } from '@hangul-route/content-schema';

/**
 * Stage gating for caregiver assignments — F-HW-001 §3.4.
 *
 * A caregiver must not be able to silently assign a Quest the learner cannot
 * reach yet; the create call fails fast so the caregiver sees why.
 */

export type GateRejection = 'unknown-quest' | 'episode-not-shipped' | 'stage-locked';

export interface GateResult {
  allowed: boolean;
  reason?: GateRejection;
  /** English caregiver-facing message (CLAUDE.md §8 — UI is English). */
  message?: string;
}

export interface GateInput {
  questId: string;
  /** Episodes the app knows about, used to locate the quest's stage. */
  episodes: readonly Episode[];
  /** Stage keys the learner has unlocked, e.g. ['stage1']. */
  unlockedStages: readonly string[];
  /** Learner's display name, for the caregiver message. */
  learnerName: string;
}

export function canAssignQuest({
  questId,
  episodes,
  unlockedStages,
  learnerName,
}: GateInput): GateResult {
  const episode = episodes.find((e) => e.questIds.includes(questId));
  if (!episode) {
    return {
      allowed: false,
      reason: 'unknown-quest',
      message: 'That quest is not available yet.',
    };
  }
  if (episode.status === 'preview' || episode.status === 'draft') {
    return {
      allowed: false,
      reason: 'episode-not-shipped',
      message: 'That episode is still being built.',
    };
  }
  if (!unlockedStages.includes(episode.stage)) {
    return {
      allowed: false,
      reason: 'stage-locked',
      message: `${learnerName} hasn't reached this quest yet.`,
    };
  }
  return { allowed: true };
}
