import type { Episode, Quest } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodeOf, plainQuest, snapshotWith } from '../stage1/__tests__/fixtures';
import {
  buildsOnLine,
  prereqSheet,
  prereqSheetText,
  previousStage1Quest,
  softPrerequisite,
} from '../quest-flow/soft-prereq';

const QUESTS: Quest[] = ['a', 'b', 'c', 'd', 'x'].map((k) => plainQuest(`quest:${k}`));
const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:a', 'quest:b']),
  episodeOf('episode:two', ['quest:c'], { theme: 'life' }),
  episodeOf('episode:soon', ['quest:d'], { theme: 'rites', status: 'preview' }),
  episodeOf('episode:s2', ['quest:x'], { stage: 'stage2', theme: 'life' }),
];
const done = (...ids: string[]) =>
  snapshotWith(ids.map((id) => ({ questId: `quest:${id}`, episodeId: EPISODES.find((e) => e.questIds.includes(`quest:${id}`))!.id })));
const base = { quests: QUESTS, episodes: EPISODES };
const episodeMessages = getMessages('en').learner.episode;

describe('previousStage1Quest', () => {
  it('is the quest before it in Stage 1 order, across episodes', () => {
    expect(previousStage1Quest('quest:b', QUESTS, EPISODES)?.id).toBe('quest:a');
    expect(previousStage1Quest('quest:c', QUESTS, EPISODES)?.id).toBe('quest:b');
  });

  it('is undefined for the first quest, a preview quest and a quest outside Stage 1', () => {
    expect(previousStage1Quest('quest:a', QUESTS, EPISODES)).toBeUndefined();
    expect(previousStage1Quest('quest:d', QUESTS, EPISODES)).toBeUndefined();
    expect(previousStage1Quest('quest:x', QUESTS, EPISODES)).toBeUndefined();
    expect(previousStage1Quest('quest:nope', QUESTS, EPISODES)).toBeUndefined();
  });
});

describe('softPrerequisite', () => {
  it('names the previous quest when it is not complete', () => {
    expect(softPrerequisite({ ...base, snapshot: done(), questId: 'quest:b' })?.id).toBe('quest:a');
  });

  it('is undefined once the previous quest is complete, at any star count', () => {
    expect(softPrerequisite({ ...base, snapshot: done('a'), questId: 'quest:b' })).toBeUndefined();
    const zeroStars = snapshotWith([{ questId: 'quest:a', episodeId: 'episode:one', stars: 0 }]);
    expect(softPrerequisite({ ...base, snapshot: zeroStars, questId: 'quest:b' })).toBeUndefined();
  });

  it('treats a started-but-unfinished previous quest as not complete', () => {
    const snap = snapshotWith([], [{ questId: 'quest:a', episodeId: 'episode:one' }]);
    expect(softPrerequisite({ ...base, snapshot: snap, questId: 'quest:b' })?.id).toBe('quest:a');
  });

  it('is undefined for the first quest, and without a snapshot every earlier quest counts as not done', () => {
    expect(softPrerequisite({ ...base, snapshot: done(), questId: 'quest:a' })).toBeUndefined();
    expect(softPrerequisite({ ...base, snapshot: undefined, questId: 'quest:c' })?.id).toBe('quest:b');
  });
});

describe('buildsOnLine', () => {
  it('reads "Builds on: <title>"', () => {
    expect(buildsOnLine(QUESTS[0]!, episodeMessages)).toBe('Builds on: Title quest:a');
    expect(buildsOnLine(QUESTS[0]!, { ...episodeMessages, buildsOn: (t: string) => `Sigue: ${t}` })).toBe('Sigue: Title quest:a');
  });
});

describe('prereqSheet (once per quest per session)', () => {
  it('opens for an unmet prerequisite the first time', () => {
    const sheet = prereqSheet({ ...base, snapshot: done(), questId: 'quest:b', shownQuestIds: new Set() });
    expect(sheet).toEqual({
      previousQuestId: 'quest:a',
      previousEpisodeId: 'episode:one',
      previousTitleEn: 'Title quest:a',
    });
  });

  it('carries no prose: the words come from prereqSheetText and the message subtree', () => {
    const sheet = prereqSheet({ ...base, snapshot: done(), questId: 'quest:b', shownQuestIds: new Set() })!;
    expect(JSON.stringify(sheet)).not.toMatch(/Start there|Play anyway|uses letters/);
    expect(prereqSheetText(sheet, episodeMessages)).toEqual({
      message: 'This one uses letters from Title quest:a. Start there?',
      startThereLabel: 'Start there',
      playAnywayLabel: 'Play anyway',
    });
  });

  it('does not open again for a quest already asked about this session', () => {
    expect(prereqSheet({ ...base, snapshot: done(), questId: 'quest:b', shownQuestIds: new Set(['quest:b']) })).toBeUndefined();
  });

  it('asks again for a different quest', () => {
    const shown = new Set(['quest:b']);
    expect(prereqSheet({ ...base, snapshot: done(), questId: 'quest:c', shownQuestIds: shown })?.previousQuestId).toBe('quest:b');
  });

  it('does not open when the prerequisite is met', () => {
    expect(prereqSheet({ ...base, snapshot: done('a'), questId: 'quest:b', shownQuestIds: new Set() })).toBeUndefined();
  });
});
