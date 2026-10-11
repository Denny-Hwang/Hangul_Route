import type { ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { awardWorld } from '../content/award-world';
import type { TelemetryEvent } from '../platform/telemetry';
import { completedEpisodes, isStageComplete, missingAwards } from './awards/derive';
import { parseUnlockedBy } from './awards/rules';
import type { AwardSource, AwardWorld, DerivedAward } from './awards/types';
import { decideCardAward, type CardAward } from './reward';

/**
 * What the Results screen does once per visit, as a plain function so the
 * order and the guards can be unit-tested without rendering (audit UX-03,
 * F-STORY-006 §3.3 live path):
 *
 * - every game skipped (total 0): no score written, a `skipped` completion event only
 * - otherwise: write the score, send `quest.complete`
 * - the quest card is earned at 2+ stars and only *announced* when it was not
 *   already owned; replays add nothing
 * - the completion awards the run earned (episode, stage, set and, when it is
 *   missing, welcome cards) arrive with the quest card in one storage write and
 *   are returned as `extras`, with their telemetry
 */
export interface QuestResultInput {
  profileId: string;
  /** The profile's creation time: the welcome card's deterministic `unlockedAt`. */
  profileCreatedAt: string;
  questId: string;
  episodeId: string;
  rewardCardId: string | undefined;
  stars: 0 | 1 | 2 | 3;
  correct: number;
  total: number;
  retries: number;
}

/** A card to add; without `unlockedAt` it is unlocked now (the store's `CardUnlock`). */
export interface ResultCardUnlock {
  cardId: string;
  unlockedAt?: string;
}

export interface QuestResultDeps {
  /** The profile's snapshot, read at call time (before and after the score is written). */
  snapshot: (profileId: string) => ProgressSnapshot | undefined;
  recordQuestComplete: (
    profileId: string,
    input: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; accuracy: number; attempts: number },
  ) => void;
  /** Adds the cards with one storage write and returns the ids it added. */
  unlockCards: (profileId: string, cards: readonly ResultCardUnlock[]) => readonly string[];
  track: (event: TelemetryEvent) => unknown;
  /** The content the award rules read; the shipped bundle by default. */
  world?: AwardWorld;
}

/**
 * A card this run brought besides the quest card. Its source is a completion
 * rule (episode, stage, set) or the welcome card; `quest` appears only for
 * another quest's card that had not reached this snapshot yet.
 */
export interface ExtraAward {
  cardId: string;
  source: AwardSource;
}

export interface QuestResultOutcome {
  /** The quest card, as before. */
  award: CardAward | null;
  /** Never contains `award.cardId`. */
  extras: ExtraAward[];
  /** The episode this run completed, for the Results line. */
  episodeCompleted: string | null;
  /** The stage this run completed (F-QUEST-002 ceremony trigger). */
  stageCompleted: StageKey | null;
}

const NOTHING: QuestResultOutcome = { award: null, extras: [], episodeCompleted: null, stageCompleted: null };

const welcomeIdsOf = (world: AwardWorld): string[] => world.cards.filter((c) => parseUnlockedBy(c.unlockedBy).kind === 'welcome').map((c) => c.id);

const stagesOf = (world: AwardWorld): StageKey[] => [...new Set(world.episodes.map((e) => e.stage))];

export function applyQuestResult(input: QuestResultInput, deps: QuestResultDeps): QuestResultOutcome {
  const { profileId, questId, episodeId, stars, correct, total, retries } = input;
  if (total === 0) {
    // Every game skipped: nothing to score, nothing to complete — the quest
    // stays available on the episode page exactly as before.
    void deps.track({
      name: 'quest.complete',
      profileId,
      payload: { questId, episodeId, stars: 0, correct: 0, total: 0, skipped: true },
    });
    return NOTHING;
  }
  const world = deps.world ?? awardWorld;
  const welcomeCardIds = welcomeIdsOf(world);
  const before = deps.snapshot(profileId);
  const ownedBefore = (before?.cards ?? []).map((c) => c.cardId);

  // The score and the cards it earned are written in the same synchronous
  // tick, so no reconcile (a hydrate or a sync) can turn this Results moment
  // into a silent catch-up.
  deps.recordQuestComplete(profileId, {
    questId,
    episodeId,
    stars,
    accuracy: correct / total,
    attempts: 1,
  });
  const award = decideCardAward({ rewardCardId: input.rewardCardId, stars, ownedCardIds: ownedBefore, welcomeCardIds });
  const after = deps.snapshot(profileId);
  const missing: DerivedAward[] = after ? missingAwards(world, after, { createdAt: input.profileCreatedAt }) : [];
  const unlocks: ResultCardUnlock[] = missing.map((a) => ({ cardId: a.cardId, unlockedAt: a.unlockedAt }));
  // A reward card the rules do not know is still the quest's card (unlocked now, as before).
  if (award?.isNew && !missing.some((a) => a.cardId === award.cardId)) unlocks.unshift({ cardId: award.cardId });
  const added = new Set(unlocks.length > 0 ? deps.unlockCards(profileId, unlocks) : []);

  void deps.track({
    name: 'quest.complete',
    profileId,
    payload: { questId, episodeId, stars, correct, total, retries },
  });

  if (award?.isNew) {
    void deps.track({ name: 'card.unlocked', profileId, payload: { cardId: award.cardId, questId, episodeId, source: 'quest' } });
    if (award.isFirstCard) void deps.track({ name: 'card.first_earned', profileId, payload: { cardId: award.cardId } });
  }

  const extraAwards = missing.filter((a) => a.cardId !== award?.cardId && added.has(a.cardId));
  for (const extra of extraAwards) {
    const episode = extra.source === 'episode' ? { episodeId: extra.via } : {};
    void deps.track({ name: 'card.unlocked', profileId, payload: { cardId: extra.cardId, questId, ...episode, source: extra.source } });
  }
  // The first card a learner earns can be a completion card (a 1-star finish of
  // an episode); the funnel counts it, never the welcome card (§3.4).
  const welcome = new Set(welcomeCardIds);
  const earnedBefore = ownedBefore.some((id) => !welcome.has(id));
  const firstExtra = extraAwards.find((a) => !welcome.has(a.cardId));
  if (!award?.isNew && !earnedBefore && firstExtra) {
    void deps.track({ name: 'card.first_earned', profileId, payload: { cardId: firstExtra.cardId } });
  }

  // What this write completed: compare the completions before it with after it.
  const cardsFor = (unlockedBy: string): number => world.cards.filter((c) => added.has(c.id) && c.unlockedBy === unlockedBy).length;
  const doneBefore = completedEpisodes(world, before ?? { quests: [] });
  const doneAfter = completedEpisodes(world, after ?? { quests: [] });
  const episodesJustCompleted = [...doneAfter.keys()].filter((id) => !doneBefore.has(id));
  for (const id of episodesJustCompleted) {
    void deps.track({ name: 'episode.complete', profileId, payload: { episodeId: id, cardsAwarded: cardsFor(id) } });
  }
  const stagesJustCompleted = stagesOf(world).filter(
    (stage) => !isStageComplete(stage, world, doneBefore).complete && isStageComplete(stage, world, doneAfter).complete,
  );
  for (const stage of stagesJustCompleted) {
    void deps.track({ name: 'stage.complete', profileId, payload: { stageKey: stage, cardsAwarded: cardsFor(`${stage}-complete`) } });
  }
  for (const extra of extraAwards) {
    if (extra.source === 'set') void deps.track({ name: 'card_set.complete', profileId, payload: { setId: extra.via, cardsAwarded: 1 } });
  }

  return {
    award,
    extras: extraAwards.map(({ cardId, source }) => ({ cardId, source })),
    episodeCompleted: episodesJustCompleted.includes(episodeId) ? episodeId : (episodesJustCompleted[0] ?? null),
    stageCompleted: stagesJustCompleted[0] ?? null,
  };
}
