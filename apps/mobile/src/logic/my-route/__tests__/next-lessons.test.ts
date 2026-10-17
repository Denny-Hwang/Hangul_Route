import type { Episode, StageKey } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { RouteNextQuestResult } from '../../route-next';
import { episodeOf } from '../../stage1/__tests__/fixtures';
import { lessonPlace, nextLessonRows, type NextLessonsCopy } from '../next-lessons';

const EPISODES: Episode[] = [
  episodeOf('episode:s1-letters', ['quest:q1', 'quest:q2', 'quest:q3']),
  episodeOf('episode:s1-life', ['quest:q4', 'quest:q5'], { theme: 'life' }),
  episodeOf('episode:s2-life', ['quest:q6'], { stage: 'stage2', theme: 'life' }),
  // A shelf copy of q1: a quest held by two episodes is placed in the one routeNext named.
  episodeOf('episode:shelf', ['quest:q9', 'quest:q1'], { theme: 'crafts' }),
];
const ORDER: Partial<Record<StageKey, number>> = { stage1: 1, stage2: 2 };
const stageOrder = (stage: StageKey): number | null => ORDER[stage] ?? null;
const TITLES: Record<string, string> = { 'quest:q1': 'Meet a, eo', 'quest:q2': 'Meet g, n', 'quest:q3': 'Meet d, r', 'quest:q4': 'Lunch box', 'quest:q6': 'Market day' };
const EPISODE_TITLES: Record<string, string> = { 'episode:s1-letters': 'Meet the Letters', 'episode:s1-life': 'Life', 'episode:s2-life': 'Words of Life' };

const lesson = (questId: string, episodeId: string, source: RouteNextQuestResult['source'] = 'cursor'): RouteNextQuestResult => ({
  kind: 'quest',
  questId,
  episodeId,
  stage: EPISODES.find((e) => e.id === episodeId)?.stage ?? 'stage1',
  source,
  sourceId: null,
});

function copyFor(locale: UiLocale): NextLessonsCopy {
  const m = getMessages(locale).learner;
  return { where: m.myRoute.nextLessons.where, row: m.myRoute.nextLessons.row, next: m.routeNext.tag.next, inPlan: m.routeNext.tag.inPlan };
}

const rows = (lessons: RouteNextQuestResult[], inPlan: string[] = [], locale: UiLocale = 'en') =>
  nextLessonRows({
    lessons,
    episodes: EPISODES,
    stageOrder,
    questTitle: (id) => TITLES[id] ?? null,
    episodeTitle: (id) => EPISODE_TITLES[id] ?? id,
    inPlanQuestIds: new Set(inPlan),
    copy: copyFor(locale),
  });

describe('lessonPlace', () => {
  it('is the stage number, the episode and the 1-based position among its lessons', () => {
    expect(lessonPlace('quest:q2', EPISODES, stageOrder)).toEqual({ stage: 1, episodeId: 'episode:s1-letters', index: 2, total: 3 });
    expect(lessonPlace('quest:q6', EPISODES, stageOrder)).toEqual({ stage: 2, episodeId: 'episode:s2-life', index: 1, total: 1 });
  });

  it('places a quest in the episode it was named with, else in the first episode that holds it', () => {
    expect(lessonPlace('quest:q1', EPISODES, stageOrder, 'episode:shelf')).toEqual({ stage: 1, episodeId: 'episode:shelf', index: 2, total: 2 });
    expect(lessonPlace('quest:q1', EPISODES, stageOrder)).toMatchObject({ episodeId: 'episode:s1-letters', index: 1 });
  });

  it('is null for a quest no episode holds, an episode that does not hold it, or an unknown stage', () => {
    expect(lessonPlace('quest:none', EPISODES, stageOrder)).toBeNull();
    expect(lessonPlace('quest:q4', EPISODES, stageOrder, 'episode:s1-letters')).toBeNull();
    expect(lessonPlace('quest:q6', EPISODES, () => null)).toBeNull();
  });
});

describe('nextLessonRows', () => {
  it('draws each lesson with its title and its stage and episode (never an n of N); the first is Next, a later plan item In your plan', () => {
    const view = rows([lesson('quest:q2', 'episode:s1-letters', 'class'), lesson('quest:q3', 'episode:s1-letters'), lesson('quest:q4', 'episode:s1-life')], ['quest:q2', 'quest:q4']);
    expect(view.map((r) => [r.title, r.where, r.tag, r.first])).toEqual([
      ['Meet g, n', 'Stage 1 · Meet the Letters', 'Next', true],
      ['Meet d, r', 'Stage 1 · Meet the Letters', null, false],
      ['Lunch box', 'Stage 1 · Life', 'In your plan', false],
    ]);
    expect(view[0]).toMatchObject({ key: 'quest:q2', questId: 'quest:q2', episodeId: 'episode:s1-letters', source: 'class' });
    expect(view.map((r) => r.a11yLabel)).toEqual([
      'Next: Meet g, n. Stage 1 · Meet the Letters',
      'Meet d, r. Stage 1 · Meet the Letters',
      'In your plan: Lunch box. Stage 1 · Life',
    ]);
  });

  it('drops a lesson with no title or no place, and keeps the first row the card’s lesson', () => {
    const view = rows([lesson('quest:missing', 'episode:s1-letters'), lesson('quest:q6', 'episode:s2-life'), lesson('quest:q4', 'episode:s1-letters')]);
    expect(view.map((r) => [r.questId, r.first, r.tag])).toEqual([['quest:q6', false, null]]);
  });

  it('is empty when there is no lesson (rest, free-end)', () => {
    expect(rows([])).toEqual([]);
  });

  it.each(['es', 'ko'] as const)('%s: the where line and the row name come from the dictionary', (locale) => {
    const [first] = rows([lesson('quest:q2', 'episode:s1-letters')], [], locale);
    const m = getMessages(locale).learner;
    expect(first?.where).toBe(m.myRoute.nextLessons.where(1, 'Meet the Letters'));
    expect(first?.tag).toBe(m.routeNext.tag.next);
    expect(first?.a11yLabel).toBe(m.myRoute.nextLessons.row(m.routeNext.tag.next, 'Meet g, n', m.myRoute.nextLessons.where(1, 'Meet the Letters')));
    expect(first?.where).not.toBe(getMessages('en').learner.myRoute.nextLessons.where(1, 'Meet the Letters'));
  });
});
