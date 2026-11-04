import { CATALOG, StageKeySchema, ThemeKeySchema, routeDaysOf, type Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { LESSON_EPISODES } from '../__generated__/lessons-index';
import { episodesAll } from '../episodes';
import { questsAll } from '../quests';
import { storyQuests } from '../stories';

/**
 * Route-day pins derived from the manifest (F-CURR-002 §9.1, row CM-6). The route days used to be
 * pinned by hand per CATALOG_VERSION, so every content PR edited the same table. Now the expected
 * days come from what the bundle ships: one day per shipped grid episode with lesson quests, in
 * stage then theme order, its minutes the sum of its quests' minutes. The frozen version 32 route
 * keeps a snapshot in packages/content-schema (route-days.test.ts).
 */

const storyQuestIds = new Set(storyQuests.map((quest) => quest.id));
const lessonMinutes = new Map(questsAll.filter((quest) => !storyQuestIds.has(quest.id)).map((quest) => [quest.id, quest.estimatedMinutes]));
const rank = (episode: Episode): number =>
  StageKeySchema.options.indexOf(episode.stage) * 10 + ThemeKeySchema.options.indexOf(episode.theme);

/** The route days the bundle implies, as [episode id, minutes, quest ids]. */
const manifestDays = episodesAll
  .filter((episode) => episode.placement !== 'shelf' && episode.status === 'shipped')
  .sort((a, b) => rank(a) - rank(b))
  .map((episode) => {
    const quests = episode.questIds.filter((id) => lessonMinutes.has(id));
    return [episode.id, quests.reduce((sum, id) => sum + (lessonMinutes.get(id) ?? 0), 0), quests] as const;
  })
  .filter(([, , quests]) => quests.length > 0);

describe('route days from the manifest', () => {
  it('the catalogue route equals the days the shipped bundle implies, day by day', () => {
    expect(routeDaysOf(CATALOG).map((day) => [day.episodeId, day.minutes, [...day.questIds]])).toEqual(manifestDays.map(([id, minutes, quests]) => [id, minutes, [...quests]]));
  });

  it('every cell of the generated lesson manifest is a route day', () => {
    const days = new Set(routeDaysOf(CATALOG).map((day) => day.episodeId));
    for (const episode of LESSON_EPISODES) expect(days.has(episode.id), episode.id).toBe(true);
  });

  it('numbers the days from 1 with no gap', () => {
    const days = routeDaysOf(CATALOG);
    expect(days.map((day) => day.day)).toEqual(days.map((_, i) => i + 1));
    expect(days.length).toBe(manifestDays.length);
  });
});
