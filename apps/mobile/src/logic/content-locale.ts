import {
  localize,
  type Episode,
  type HeritageCard,
  type Jamo,
  type Overlays,
  type Quest,
  type StageDef,
  type Story,
  type ThemeDef,
  type UiLocale,
} from '@hangul-route/content-schema';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import type { MissionCard } from './homework/mission-builder';
import type { MinigameScope } from './minigame-config';
import { lessonContent } from '../content/lessons';
import { localePacks } from '../content/locale-packs';
import { mergeOverlaysInto } from './lessons/lesson-store';

/**
 * Content text in the UI language (F-I18N-001 §3.6). The screens pass `useLocale()`;
 * each helper binds one kind of shipped content to its overlay entity id and falls back
 * to the English source field by field. Taught Korean and its romanization never change.
 * `overlays` defaults to the generated `OVERLAYS` (tests pass their own).
 */

export const localizeCard = (card: HeritageCard, locale: UiLocale, overlays?: Overlays): HeritageCard =>
  localize(card, card.id, locale, overlays ?? OVERLAYS);

/**
 * The shipped overlays plus the glosses of the generated lesson cells (F-CURR-001 §3.10): each
 * lesson chunk's glosses join as it loads, the titles of the active locale's title chunk and the
 * steps and game glosses of each loaded cell (F-CURR-002 §10). One table, filled in place, so every
 * default below reads what is loaded at the time of the call. On the web the shipped overlays of a
 * locale join when its locale chunk arrives (`content/locale-packs.ts`; `OVERLAYS` is empty until then),
 * under any lesson gloss already in.
 */
const contentOverlays = { es: { ...OVERLAYS.es }, ko: { ...OVERLAYS.ko } };
lessonContent.onOverlays((extra) => mergeOverlaysInto(contentOverlays, extra));
localePacks.onContent((locale, table) => {
  const into = contentOverlays[locale];
  for (const [id, entry] of Object.entries(table)) into[id] = { ...entry, ...into[id] };
});
export const CONTENT_OVERLAYS: Overlays = contentOverlays;

export const localizeEpisode = (episode: Episode, locale: UiLocale, overlays: Overlays = CONTENT_OVERLAYS): Episode =>
  localize(episode, episode.id, locale, overlays);

export const localizeQuest = (quest: Quest, locale: UiLocale, overlays: Overlays = CONTENT_OVERLAYS): Quest =>
  localize(quest, quest.id, locale, overlays);

export const localizeStage = (stage: StageDef, locale: UiLocale, overlays?: Overlays): StageDef =>
  localize(stage, `stage:${stage.key}`, locale, overlays ?? OVERLAYS);

export const localizeTheme = (theme: ThemeDef, locale: UiLocale, overlays?: Overlays): ThemeDef =>
  localize(theme, `theme:${theme.key}`, locale, overlays ?? OVERLAYS);

export const localizeJamo = (jamo: Jamo, locale: UiLocale, overlays?: Overlays): Jamo =>
  localize(jamo, jamo.id, locale, overlays ?? OVERLAYS);

/** A story's title, narration, captions and checks by its `story:<slug>` id (the story-sequence cards read it). */
export const localizeStory = (story: Story, locale: UiLocale, overlays?: Overlays): Story =>
  localize(story, story.id, locale, overlays ?? OVERLAYS);

/** A minigame's pairs, step labels, dialogue lines and prompts, by its minigame ref (a lesson ref reads its loaded cell's glosses). */
export const localizeScope = (scope: MinigameScope, ref: string, locale: UiLocale, overlays?: Overlays): MinigameScope =>
  localize(scope, ref, locale, overlays ?? CONTENT_OVERLAYS);

/**
 * Something that carries the English title of a content entity as built (a mission card,
 * the Results "Next up" teaser) with the overlay title of that entity swapped in at
 * render time, so a value pinned earlier still follows a language change. The default
 * overlays include the lesson glosses (`CONTENT_OVERLAYS`), so a lesson quest or episode
 * title follows the language on the Home card and in notes too (F-CURR-001 §3.10).
 */
export function localizeTitle<T extends { titleEn: string }>(item: T, entityId: string, locale: UiLocale, overlays: Overlays = CONTENT_OVERLAYS): T {
  const { titleEn } = localize({ titleEn: item.titleEn }, entityId, locale, overlays);
  return titleEn === item.titleEn ? item : { ...item, titleEn };
}

/**
 * A mission card's title from its story (a story card, F-STORY-004 §3.7), else its quest
 * (replay, new, assigned), else its episode (explore); the daily test names itself.
 */
export function localizeMissionCard(card: MissionCard, locale: UiLocale, overlays: Overlays = CONTENT_OVERLAYS): MissionCard {
  // A practice card of a word topic is titled by its topic (`vocab-topic:<key>` overlay, F-ENT-003 E3-7).
  const entityId = card.storyId ?? card.questId ?? card.episodeId ?? (card.topicKey === undefined ? undefined : `vocab-topic:${card.topicKey}`);
  const { titleEn } = card;
  if (titleEn === null || entityId === undefined) return card;
  const localized = localizeTitle({ titleEn }, entityId, locale, overlays).titleEn;
  return localized === titleEn ? card : { ...card, titleEn: localized };
}
