import {
  localize,
  type Episode,
  type HeritageCard,
  type Jamo,
  type Overlays,
  type Quest,
  type StageDef,
  type ThemeDef,
  type UiLocale,
} from '@hangul-route/content-schema';
import type { MissionCard } from './homework/mission-builder';
import type { MinigameScope } from './minigame-config';

/**
 * Content text in the UI language (F-I18N-001 §3.6). The screens pass `useLocale()`;
 * each helper binds one kind of shipped content to its overlay entity id and falls back
 * to the English source field by field. Taught Korean and its romanization never change.
 * `overlays` defaults to the generated `OVERLAYS` (tests pass their own).
 */

export const localizeCard = (card: HeritageCard, locale: UiLocale, overlays?: Overlays): HeritageCard =>
  localize(card, card.id, locale, overlays);

export const localizeEpisode = (episode: Episode, locale: UiLocale, overlays?: Overlays): Episode =>
  localize(episode, episode.id, locale, overlays);

export const localizeQuest = (quest: Quest, locale: UiLocale, overlays?: Overlays): Quest =>
  localize(quest, quest.id, locale, overlays);

export const localizeStage = (stage: StageDef, locale: UiLocale, overlays?: Overlays): StageDef =>
  localize(stage, `stage:${stage.key}`, locale, overlays);

export const localizeTheme = (theme: ThemeDef, locale: UiLocale, overlays?: Overlays): ThemeDef =>
  localize(theme, `theme:${theme.key}`, locale, overlays);

export const localizeJamo = (jamo: Jamo, locale: UiLocale, overlays?: Overlays): Jamo =>
  localize(jamo, jamo.id, locale, overlays);

/** A minigame's pairs, step labels, dialogue lines and prompts, by its minigame ref. */
export const localizeScope = (scope: MinigameScope, ref: string, locale: UiLocale, overlays?: Overlays): MinigameScope =>
  localize(scope, ref, locale, overlays);

/**
 * A mission card carries the title of its quest (replay, new, assigned) or episode
 * (story) as built; this swaps in the overlay title of that entity at render time, so a
 * plan pinned for the day still follows a language change.
 */
export function localizeMissionCard(card: MissionCard, locale: UiLocale, overlays?: Overlays): MissionCard {
  const entityId = card.questId ?? card.episodeId;
  if (card.titleEn === null || entityId === undefined) return card;
  const { titleEn } = localize({ titleEn: card.titleEn }, entityId, locale, overlays);
  return titleEn === card.titleEn ? card : { ...card, titleEn };
}
