import { CATALOG, routeCatalogOf, type Episode, type GoalSource, type ProgressSnapshot, type StageDef, type ThemeDef, type UiLocale } from '@hangul-route/content-schema';
import { episodesAll, heritageCardsAll, jamoAll, questsAll, stages, themes } from '../../content';
import { journeyContent } from '../../content/sync-context';
import { localizeEpisode, localizeStage, localizeTheme } from '../content-locale';
import { cursorContext } from '../cursor-context';
import type { Tier } from '../entitlement';
import { planView, routeNext, type RouteNextInput } from '../route-next';
import { STAGE1_QUESTS } from '../stage1/curriculum';
import { letterWallOf, type LetterTile } from './letter-wall';
import { planWeekOf } from './plan-week';
import { startRouteOf } from './start-marker';
import type { MyRouteInput, MyRouteModel, SeenRecord } from './types';

/**
 * The one `buildMyRoute` input for the Learning Route page (R-3) and the Home
 * strip (R-4b): the same catalog, quests, cards, cursor (`cursorContext`, R-4a)
 * and start route (R-7a), with the stage, theme and episode titles in the UI
 * locale. Both screens call it, so the strip and the page always name the same
 * stage and pips.
 *
 * With F-ENT-003's input (`routeNextInputOf`, the one Home and Results build)
 * the model also gets the goal sources, the plan day, the one next, the plan
 * view and quest access (Learning Route amendment section 4.4, LR-5a), so the
 * page, the Home strip and the parent dashboard row name one goal and Home,
 * Results and the page one next.
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
  /** F-ENT-003's `routeNextInputOf(...)` for this learner; absent: the catalogue cursor and the default goal. */
  next?: RouteNextInput;
}

/** The goal sources of F-ENT-003's input: `sourcesOf(plans, snapshot.selfRoute)`, a classic plan's meta as null. */
export const goalSourcesOf = (input: Pick<RouteNextInput, 'sources'>): GoalSource[] => input.sources.map((s) => ({ ...s, meta: s.meta ?? null }));

/**
 * The live weekly plan week (F-ROUTE-001 R-7b, section 3.9; amendment section 4.3): the
 * week of the goal's own plan that holds today, read from the same F-ENT-003 input the
 * model was built from. That input lists the class, school and family plans from the
 * inbox and the learner's own plan (`snapshot.selfRoute`, stored by F-PLAN-002's
 * route-store), so the Learning Route's plan line and the Home strip's week line
 * (`homeStripView({ week })`) always name one week. Null without the input, without a
 * dated plan, or outside the plan's weeks.
 */
export function routeWeekOf(model: Pick<MyRouteModel, 'goal'>, next: Pick<RouteNextInput, 'sources' | 'today'> | undefined): number | null {
  return next === undefined ? null : planWeekOf(model.goal, goalSourcesOf(next), next.today);
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
    ...(i.next === undefined
      ? {}
      : {
          sources: goalSourcesOf(i.next),
          today: i.next.today,
          routeNext: routeNext(i.next),
          planView: planView(i.next),
          isQuestOpen: i.next.isQuestOpen,
        }),
  };
}

/**
 * The shared route catalogue: its `teaches` spell the symbol keys of each lesson
 * (`catalog/data.ts`), where the app's own route catalogue leaves them empty.
 */
const SHARED_ROUTE = routeCatalogOf(CATALOG);

/**
 * The Stage 1 letter wall of a built page model (R-7c, section 3.11): lit from the
 * row's done pips, outlined from the catalogue `teaches` of its known (placed-out)
 * pips. Empty when the model has no Stage 1 row.
 */
export function routeLetterWall(model: Pick<MyRouteModel, 'stages'>): LetterTile[] {
  const row = model.stages.find((s) => s.stage === 'stage1');
  return row === undefined ? [] : letterWallOf({ row, quests: STAGE1_QUESTS, catalog: SHARED_ROUTE, jamo: jamoAll });
}
