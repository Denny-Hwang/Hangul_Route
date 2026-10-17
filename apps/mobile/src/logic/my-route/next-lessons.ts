import type { Episode, StageKey } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { nextStartedEvent, type NextSource, type RouteNextQuestResult } from '../route-next';

/**
 * Where a lesson sits and the Route tab's next lessons (owner decision 2026-10-17: the Route tab shows where you
 * are now, the next three lessons and the goal; the seven stages stay in the Journey tab). Home's Next lesson hero
 * reads the same place, with its position in the episode (AMENDMENTS-DISPLAY-NAV section 9.1). Pure: the words come in from the dictionary, the
 * titles through the caller's localizers; nothing here reads a store, a clock or the window.
 */

/** A lesson's place: its stage number, its episode and its position among the episode's lessons. */
export interface LessonPlace {
  stage: number;
  episodeId: string;
  /** 1-based. */
  index: number;
  total: number;
}

/**
 * The lesson's place in its episode: `episodeId` when given (the episode `routeNext` named), else the first episode
 * that holds the quest. Null when that episode does not hold it or its stage is unknown.
 */
export function lessonPlace(
  questId: string,
  episodes: readonly Episode[],
  stageOrder: (stage: StageKey) => number | null,
  episodeId?: string,
): LessonPlace | null {
  const episode = episodes.find((e) => (episodeId === undefined || e.id === episodeId) && e.questIds.includes(questId));
  if (episode === undefined) return null;
  const stage = stageOrder(episode.stage);
  if (stage === null) return null;
  return { stage, episodeId: episode.id, index: episode.questIds.indexOf(questId) + 1, total: episode.questIds.length };
}

export interface NextLessonsCopy {
  /** `learner.myRoute.nextLessons.where`: the stage and the episode, never an "n of N" (F-ROUTE-001). */
  where: (stage: number, episode: string) => string;
  /** `learner.myRoute.nextLessons.row`: the row's accessible name. */
  row: (tag: string | null, title: string, where: string) => string;
  /** `learner.routeNext.tag.next`: the first row, the lesson the route card's button starts. */
  next: string;
  /** `learner.routeNext.tag.inPlan`: a later row the plan holds. */
  inPlan: string;
}

export interface NextLessonRowView {
  key: string;
  questId: string;
  episodeId: string;
  /** `routeNext`'s source for the first row (its `route.next_started`); the later rows send nothing. */
  source: NextSource;
  first: boolean;
  title: string;
  /** "Stage 1 · Meet the Letters". */
  where: string;
  /** "Next" on the first row, "In your plan" on a later row of the plan, else none. */
  tag: string | null;
  a11yLabel: string;
}

export interface NextLessonRowsInput {
  /** `upcomingLessons(input, 3)`. */
  lessons: readonly RouteNextQuestResult[];
  episodes: readonly Episode[];
  stageOrder: (stage: StageKey) => number | null;
  /** The quest's title in the UI language; null drops the row (a quest the bundle does not hold, or with no place). */
  questTitle: (questId: string) => string | null;
  /** The episode's title in the UI language. */
  episodeTitle: (episodeId: string) => string;
  /** `planView(input).inPlanQuestIds`. */
  inPlanQuestIds: ReadonlySet<string>;
  copy: NextLessonsCopy;
}

/** The rows the Route tab draws under the route card, in order; the first is the card's Continue (or Start). */
export function nextLessonRows(i: NextLessonRowsInput): NextLessonRowView[] {
  const rows: NextLessonRowView[] = [];
  i.lessons.forEach((lesson, index) => {
    const title = i.questTitle(lesson.questId);
    const place = lessonPlace(lesson.questId, i.episodes, i.stageOrder, lesson.episodeId);
    if (title === null || place === null) return;
    const where = i.copy.where(place.stage, i.episodeTitle(place.episodeId));
    const first = index === 0;
    const tag = first ? i.copy.next : i.inPlanQuestIds.has(lesson.questId) ? i.copy.inPlan : null;
    rows.push({
      key: lesson.questId,
      questId: lesson.questId,
      episodeId: lesson.episodeId,
      source: lesson.source,
      first,
      title,
      where,
      tag,
      a11yLabel: i.copy.row(tag, title, where),
    });
  });
  return rows;
}

/**
 * What a next-lesson row's tap counts (owner decision 2026-10-17, spec section 9.8 (a)): the first row is the route
 * card's one next, so it is `route.next_started { source, surface: 'route' }`; a later row, and any row on the
 * grown-up's read-only page, sends nothing.
 */
export function nextLessonTapEvent(row: Pick<NextLessonRowView, 'first' | 'source'>, profileId: string | undefined, readOnly: boolean): TelemetryEvent | null {
  if (!row.first || readOnly) return null;
  return nextStartedEvent(profileId, row.source, 'route');
}
