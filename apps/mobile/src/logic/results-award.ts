import type { TelemetryEvent } from '../platform/telemetry';
import { decideCardAward, type CardAward } from './reward';

/**
 * What the Results screen does once per visit, as a plain function so the
 * order and the guards can be unit-tested without rendering (audit UX-03):
 *
 * - every game skipped (total 0): no score written, a `skipped` completion event only
 * - otherwise: write the score, send `quest.complete`
 * - a card is earned at 2+ stars and only *announced* (unlock + telemetry +
 *   banner) when it was not already owned; replays and 0-1 star runs add nothing
 *
 * Returns the award the screen should show, or null.
 */
export interface QuestResultInput {
  profileId: string;
  questId: string;
  episodeId: string;
  rewardCardId: string | undefined;
  stars: 0 | 1 | 2 | 3;
  correct: number;
  total: number;
  retries: number;
}

export interface QuestResultDeps {
  /** Card ids already in this profile's Library, read at call time. */
  ownedCardIds: () => readonly string[];
  recordQuestComplete: (
    profileId: string,
    input: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; accuracy: number; attempts: number },
  ) => void;
  unlockCard: (profileId: string, cardId: string) => void;
  track: (event: TelemetryEvent) => unknown;
}

export function applyQuestResult(input: QuestResultInput, deps: QuestResultDeps): CardAward | null {
  const { profileId, questId, episodeId, stars, correct, total, retries } = input;
  if (total === 0) {
    // Every game skipped: nothing to score, nothing to complete — the quest
    // stays available on the episode page exactly as before.
    void deps.track({
      name: 'quest.complete',
      profileId,
      payload: { questId, episodeId, stars: 0, correct: 0, total: 0, skipped: true },
    });
    return null;
  }
  deps.recordQuestComplete(profileId, {
    questId,
    episodeId,
    stars,
    accuracy: correct / total,
    attempts: 1,
  });
  void deps.track({
    name: 'quest.complete',
    profileId,
    payload: { questId, episodeId, stars, correct, total, retries },
  });
  const award = decideCardAward({
    rewardCardId: input.rewardCardId,
    stars,
    ownedCardIds: deps.ownedCardIds(),
  });
  if (award?.isNew) {
    deps.unlockCard(profileId, award.cardId);
    void deps.track({
      name: 'card.unlocked',
      profileId,
      payload: { cardId: award.cardId, questId },
    });
    if (award.isFirstCard) {
      void deps.track({
        name: 'card.first_earned',
        profileId,
        payload: { cardId: award.cardId },
      });
    }
  }
  return award;
}
