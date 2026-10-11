import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { stage1QuestsFrom } from '../stage1/curriculum';

/**
 * Soft prerequisite (F-QUEST-002 §3.5, decision D3): a gentle note and a
 * one-line offer, never a lock. Pure; the Episode page only renders it.
 */

/** The quest before `questId` in Stage 1 order, or `undefined` for the first quest or a non-Stage-1 quest. */
export function previousStage1Quest(
  questId: string,
  quests: readonly Quest[],
  episodes: readonly Episode[],
): Quest | undefined {
  const order = stage1QuestsFrom(episodes, quests);
  const at = order.findIndex((q) => q.id === questId);
  return at > 0 ? order[at - 1] : undefined;
}

export interface SoftPrereqInput {
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  questId: string;
}

/** The previous quest when the learner has not completed it (at any star count). */
export function softPrerequisite(input: SoftPrereqInput): Quest | undefined {
  const previous = previousStage1Quest(input.questId, input.quests, input.episodes);
  if (!previous) return undefined;
  const complete = input.snapshot?.quests.some((q) => q.questId === previous.id && q.completedAt);
  return complete ? undefined : previous;
}

/** "Builds on: <previous quest title>", shown under a quest whose predecessor is not complete. */
export function buildsOnLine(previous: Quest, m: Messages['learner']['episode']): string {
  return m.buildsOn(previous.titleEn);
}

export interface PrereqSheet {
  previousQuestId: string;
  previousEpisodeId: string;
  /** The previous quest's title (content); the sheet's own words come from `prereqSheetText`. */
  previousTitleEn: string;
}

/**
 * The sheet to open when Start is tapped, or `undefined` to start straight
 * away: the prerequisite is unmet and this quest has not asked yet this session.
 */
export function prereqSheet(input: SoftPrereqInput & { shownQuestIds: ReadonlySet<string> }): PrereqSheet | undefined {
  if (input.shownQuestIds.has(input.questId)) return undefined;
  const previous = softPrerequisite(input);
  if (!previous) return undefined;
  const episode = input.episodes.find((e) => e.questIds.includes(previous.id));
  if (!episode) return undefined;
  return {
    previousQuestId: previous.id,
    previousEpisodeId: episode.id,
    previousTitleEn: previous.titleEn,
  };
}

/** The sheet's words in the UI language: kept out of the model so a language change never leaves stale prose. */
export function prereqSheetText(
  sheet: PrereqSheet,
  m: Messages['learner']['episode'],
): { message: string; startThereLabel: string; playAnywayLabel: string } {
  return {
    message: m.prereq.message(sheet.previousTitleEn),
    startThereLabel: m.prereq.startThere.cta,
    playAnywayLabel: m.prereq.playAnyway.cta,
  };
}
