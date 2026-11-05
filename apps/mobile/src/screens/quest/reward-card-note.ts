import { cardById, episodeById, questById } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard, localizeEpisode } from '../../logic/content-locale';
import { useProgressStore } from '../../store/progress-store';

/** Whether a profile's saved snapshot holds a card now (read at call time; no profile or snapshot holds none). */
export function holdsCard(profileId: string | null, cardId: string): boolean {
  return profileId !== null && (useProgressStore.getState().byProfile[profileId]?.cards.some((c) => c.cardId === cardId) ?? false);
}

/**
 * The title and line for a quest's card that this run left waiting (`waiting`: `cardWaits`), in the UI language, with
 * the episode that also gives the card named (F-STORY-006 §3.1). Null when nothing waits: the reward step then keeps
 * its authored lines and Results draws nothing.
 */
export function useQuestCardLines(questId: string, waiting: boolean): { title: string; line: string } | null {
  const m = useMessages().learner.quest.cardWaiting;
  const locale = useLocale();
  // A title chunk that arrives late fills its titles in place (F-CURR-002 §10).
  useLessonTitlesVersion();
  const cardId = questById(questId)?.rewardCardId;
  const source = cardId === undefined ? undefined : cardById(cardId);
  // A quest card is also an episode card of its own episode (F-STORY-006 §3.1): the card's rule is that episode's id.
  const episode = source && episodeById(source.unlockedBy);
  if (!waiting || !source || !episode) return null;
  const card = localizeCard(source, locale).titleEn;
  return { title: m.title(card), line: m.line(card, localizeEpisode(episode, locale).titleEn) };
}
