import { StageKeySchema, ThemeKeySchema, type StageKey, type ThemeKey } from '../schemas/heritage-card';
import { cellIsReady, type Catalog } from './schema';

/**
 * Route days (F-ENT-003 section 3.1). A route day is one playable cell of the
 * default route, in route order: stages 1 to 7, and inside a stage the canonical
 * theme order. It is a property of the content, the same for every learner, and
 * never shown: the word "day" is internal only. The free plan is named by stages,
 * not by a count of days.
 */
export interface RouteDay {
  /** 1-based; internal only, never rendered. */
  day: number;
  stage: StageKey;
  theme: ThemeKey;
  /** The catalogue's id, e.g. 'episode:stage1-letters'. */
  episodeId: string;
  /** The cell's lesson quests, in cell order. */
  questIds: readonly string[];
  /** Sum of the quests' catalogue minutes. */
  minutes: number;
}

/** The stages the free plan opens: all of Stage 1 (owner decision OD-1, 2026-10-11). */
export const FREE_ROUTE_STAGES: readonly StageKey[] = Object.freeze<StageKey[]>(['stage1']);

export interface FreeLessonsFacts {
  lessons: number;
  /** Distinct letters taught; a final form ('ㄴ/final') counts as its letter. */
  letters: number;
  /** The free days' minutes, rounded to the nearest 5. */
  minutes: number;
  /** The number of free route days (telemetry `freeDays`). */
  days: number;
  /** The free days' episodes in route order. */
  episodeIds: readonly string[];
}

const stageRank = (stage: StageKey): number => StageKeySchema.options.indexOf(stage);
const themeRank = (theme: ThemeKey): number => ThemeKeySchema.options.indexOf(theme);

/** The catalogue is immutable bundled data, so its route is built once per catalogue object. */
const routeCache = new WeakMap<Catalog, readonly RouteDay[]>();

/** Every route day of the catalogue: one per ready cell that holds at least one lesson quest. */
export function routeDaysOf(catalog: Catalog): RouteDay[] {
  let days = routeCache.get(catalog);
  if (days === undefined) {
    days = buildRouteDays(catalog);
    routeCache.set(catalog, days);
  }
  return [...days];
}

function buildRouteDays(catalog: Catalog): readonly RouteDay[] {
  const lessons = new Map(
    catalog.quests.filter((quest) => quest.kind === 'lesson').map((quest) => [quest.id, quest.minutes]),
  );
  const cells = catalog.cells
    .filter(cellIsReady)
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage) || themeRank(a.theme) - themeRank(b.theme));
  const days: RouteDay[] = [];
  for (const cell of cells) {
    const quests = cell.questIds.flatMap((id) => {
      const minutes = lessons.get(id);
      return minutes === undefined ? [] : [{ id, minutes }];
    });
    if (quests.length === 0) continue;
    days.push(
      Object.freeze({
        day: days.length + 1,
        stage: cell.stage,
        theme: cell.theme,
        episodeId: cell.episodeId,
        questIds: Object.freeze(quests.map((quest) => quest.id)),
        minutes: quests.reduce((sum, quest) => sum + quest.minutes, 0),
      }),
    );
  }
  return Object.freeze(days);
}

/** The route days of the given stages (default: the free plan, `FREE_ROUTE_STAGES`). */
export function freeRouteDays(catalog: Catalog, stages: readonly StageKey[] = FREE_ROUTE_STAGES): RouteDay[] {
  const open = new Set(stages);
  return routeDaysOf(catalog).filter((day) => open.has(day.stage));
}

/** Every quest of the free route days of the given stages. */
export function freeRouteQuestIds(catalog: Catalog, stages: readonly StageKey[] = FREE_ROUTE_STAGES): ReadonlySet<string> {
  return new Set(freeRouteDays(catalog, stages).flatMap((day) => day.questIds));
}

/** Every quest of every route day: the grid lessons. */
export function gridLessonIds(catalog: Catalog): ReadonlySet<string> {
  return new Set(routeDaysOf(catalog).flatMap((day) => day.questIds));
}

/** The route day that holds a quest; null when the quest is not a grid lesson. */
export function routeDayOfQuest(catalog: Catalog, questId: string): number | null {
  return routeDaysOf(catalog).find((day) => day.questIds.includes(questId))?.day ?? null;
}

/** What the free plan holds, for copy that is built from data, never typed. */
export function freeLessonsFacts(catalog: Catalog, stages: readonly StageKey[] = FREE_ROUTE_STAGES): FreeLessonsFacts {
  const days = freeRouteDays(catalog, stages);
  const questIds = new Set(days.flatMap((day) => day.questIds));
  const letters = new Set(
    catalog.quests
      .filter((quest) => questIds.has(quest.id))
      .flatMap((quest) => quest.teaches.map((key) => key.replace(/\/final$/, ''))),
  );
  const minutes = days.reduce((sum, day) => sum + day.minutes, 0);
  return {
    lessons: questIds.size,
    letters: letters.size,
    minutes: Math.round(minutes / 5) * 5,
    days: days.length,
    episodeIds: days.map((day) => day.episodeId),
  };
}
