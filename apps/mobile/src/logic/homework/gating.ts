import type { Episode } from '@hangul-route/content-schema';

/**
 * Stage gating for caregiver assignments — F-HW-001 §3.4, with quest access
 * (F-ENT-003 section 3.6).
 *
 * A caregiver must not be able to silently assign a Quest the learner cannot
 * reach yet; the create call fails fast so the caregiver sees why.
 */

export type GateRejection = 'unknown-quest' | 'episode-not-shipped' | 'stage-locked' | 'quest-closed';

export interface GateResult {
  allowed: boolean;
  reason?: GateRejection;
  /**
   * Who the caregiver is blocked for, on a rejection. The screen words the reason in the
   * UI locale: `m.caregiver.gating[reason](learnerName)` (F-I18N-001 §3.4 rule 3).
   */
  learnerName?: string;
}

export interface GateInput {
  questId: string;
  /** Episodes the app knows about, used to locate the quest's stage. */
  episodes: readonly Episode[];
  /** Stage keys the learner has unlocked, e.g. ['stage1']. */
  unlockedStages: readonly string[];
  /** Learner's display name, returned with a rejection for the caregiver message. */
  learnerName: string;
  /**
   * May the learner start this quest (`questOpenFor`, F-ENT-003 section 3.6)?
   * Omitted means every quest is open. A closed quest is rejected as
   * `quest-closed` before the stage check, so with the switch on the caregiver
   * reads which plan opens it; with the switch off every quest is open and
   * the stage check answers as before.
   */
  isQuestOpen?: (questId: string) => boolean;
}

export function canAssignQuest({
  questId,
  episodes,
  unlockedStages,
  learnerName,
  isQuestOpen,
}: GateInput): GateResult {
  const episode = episodes.find((e) => e.questIds.includes(questId));
  if (!episode) {
    return { allowed: false, reason: 'unknown-quest', learnerName };
  }
  if (episode.status === 'preview' || episode.status === 'draft') {
    return { allowed: false, reason: 'episode-not-shipped', learnerName };
  }
  if (isQuestOpen && !isQuestOpen(questId)) {
    return { allowed: false, reason: 'quest-closed', learnerName };
  }
  if (!unlockedStages.includes(episode.stage)) {
    return { allowed: false, reason: 'stage-locked', learnerName };
  }
  return { allowed: true };
}
