import type { TelemetryEventName } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { defaultOpenMode, planOpenStory, type OpenStorySource } from '../open-story';
import type { StoryStatus } from '../story-status';
import { shelfIndex, story } from './shelf-fixture';

const [entry] = shelfIndex([story('sun-and-moon')]);
if (!entry) throw new Error('fixture');

const NEW: StoryStatus = { state: 'new', stars: 0 };
const BOOKMARK = { level: 'listen' as const, sceneIndex: 3, updatedAt: '2026-10-10T10:00:00.000Z' };
const IN_PROGRESS: StoryStatus = { state: 'in-progress', stars: 0, bookmark: BOOKMARK };
const FINISHED: StoryStatus = { state: 'finished', stars: 2 };

const QUEST_PARAMS = { questId: 'quest:story-sun-and-moon-listen', episodeId: 'episode:shelf-sun-and-moon' };

describe('defaultOpenMode', () => {
  it('maps the state to the one primary button: Start, Keep reading, Read it again', () => {
    expect(defaultOpenMode(NEW)).toBe('start');
    expect(defaultOpenMode(IN_PROGRESS)).toBe('continue');
    expect(defaultOpenMode(FINISHED)).toBe('read-again');
  });
});

describe('planOpenStory', () => {
  it('start opens QuestPlayer from step 0', () => {
    expect(planOpenStory({ entry, status: NEW, source: 'library', mode: 'start' })).toEqual({
      route: 'QuestPlayer',
      params: QUEST_PARAMS,
      clearBookmark: false,
      event: { name: 'story.opened', payload: { storyId: 'story:sun-and-moon', source: 'library', mode: 'start' } },
    });
  });

  it('continue resumes QuestPlayer when there is a bookmark', () => {
    const plan = planOpenStory({ entry, status: IN_PROGRESS, source: 'home', mode: 'continue' });
    expect(plan.route).toBe('QuestPlayer');
    expect(plan.params).toEqual({ ...QUEST_PARAMS, resume: true });
    expect(plan.event.payload.mode).toBe('continue');
  });

  it('continue without a bookmark falls back to start, and reports start', () => {
    const plan = planOpenStory({ entry, status: NEW, source: 'home', mode: 'continue' });
    expect(plan.params).toEqual(QUEST_PARAMS);
    expect(plan.event.payload.mode).toBe('start');
  });

  it('restart (Start over) clears the bookmark first and opens at step 0', () => {
    expect(planOpenStory({ entry, status: IN_PROGRESS, source: 'episode', mode: 'restart' })).toMatchObject({
      route: 'QuestPlayer',
      params: QUEST_PARAMS,
      clearBookmark: true,
      event: { payload: { mode: 'restart', source: 'episode' } },
    });
  });

  it('play-again opens a scored QuestPlayer run', () => {
    expect(planOpenStory({ entry, status: FINISHED, source: 'episode', mode: 'play-again' })).toMatchObject({
      route: 'QuestPlayer',
      params: QUEST_PARAMS,
      clearBookmark: false,
      event: { payload: { mode: 'play-again' } },
    });
  });

  it('read-again opens the unscored StoryReader replay', () => {
    expect(planOpenStory({ entry, status: FINISHED, source: 'results', mode: 'read-again' })).toEqual({
      route: 'StoryReader',
      params: { storyId: 'story:sun-and-moon', level: 'listen', mode: 'replay' },
      clearBookmark: false,
      event: { name: 'story.opened', payload: { storyId: 'story:sun-and-moon', source: 'results', mode: 'read-again' } },
    });
  });

  it('without a mode, follows the status', () => {
    expect(planOpenStory({ entry, status: NEW, source: 'library' }).event.payload.mode).toBe('start');
    expect(planOpenStory({ entry, status: IN_PROGRESS, source: 'library' }).params).toMatchObject({ resume: true });
    expect(planOpenStory({ entry, status: FINISHED, source: 'library' }).route).toBe('StoryReader');
  });

  it('reports every surface the same way, with a whitelisted event name', () => {
    for (const source of ['home', 'library', 'episode', 'results'] as const satisfies readonly OpenStorySource[]) {
      const name: TelemetryEventName = planOpenStory({ entry, status: NEW, source }).event.name;
      expect(name).toBe('story.opened');
      expect(planOpenStory({ entry, status: NEW, source }).event.payload.source).toBe(source);
    }
  });
});
