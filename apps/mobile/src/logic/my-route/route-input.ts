import type { Episode, ProgressSnapshot, StageDef, ThemeDef, UiLocale } from '@hangul-route/content-schema';
import { episodesAll, heritageCardsAll, questsAll, stages, themes } from '../../content';
import { journeyContent } from '../../content/sync-context';
import { localizeEpisode, localizeStage, localizeTheme } from '../content-locale';
import { cursorContext } from '../cursor-context';
import type { Tier } from '../entitlement';
import { startRouteOf } from './start-marker';
import type { MyRouteInput, SeenRecord } from './types';

/**
 * The one `buildMyRoute` input for the Learning Route page (R-3) and the Home
 * strip (R-4b): the same catalog, quests, cards, cursor (`cursorContext`, R-4a)
 * and start route (R-7a), with the stage, theme and episode titles in the UI
 * locale. Both screens call it, so the strip and the page always name the same
 * stage and pips.
 */

export interface LocalizedRouteContent {
  stages: StageDef[];
  themes: ThemeDef[];
  episodes: Episode[];
}

export function localizedRouteContent(locale: UiLocale): LocalizedRouteContent {
  return {
    stages: stages.map((s) => localizeStage(s, locale)),
    themes: themes.map((t) => localizeTheme(t, locale)),
    episodes: episodesAll.map((e) => localizeEpisode(e, locale)),
  };
}

export interface RouteModelInputArgs {
  snapshot: ProgressSnapshot;
  tier: Tier;
  localized: LocalizedRouteContent;
  /** The page's "new since you last looked" record (section 3.10); the strip passes none. */
  seen?: SeenRecord;
  now: Date;
}

export function routeModelInput(i: RouteModelInputArgs): MyRouteInput {
  const cursor = cursorContext({ tier: i.tier, placements: i.snapshot.placements, quests: questsAll, episodes: episodesAll });
  return {
    snapshot: i.snapshot,
    catalog: journeyContent.catalog,
    episodes: i.localized.episodes,
    quests: questsAll,
    cards: heritageCardsAll,
    stages: i.localized.stages,
    themes: i.localized.themes,
    isEntitled: cursor.isEntitled,
    skipQuestIds: cursor.skipQuestIds,
    route: startRouteOf(i.snapshot.placements, journeyContent.catalog, cursor.isEntitled),
    seen: i.seen,
    now: i.now,
  };
}
