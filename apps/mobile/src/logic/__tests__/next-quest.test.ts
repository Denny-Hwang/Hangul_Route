import type { Episode, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { snapshotWith, plainQuest, episodeOf } from '../stage1/__tests__/fixtures';
import { nextQuestAfter, offerableQuests, playableEpisodes } from '../next-quest';

const QUESTS: Quest[] = ['a', 'b', 'c', 'd', 'e'].map((k) => plainQuest(`quest:${k}`));
const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:a', 'quest:b']),
  episodeOf('episode:two', ['quest:c'], { theme: 'life', status: 'ready' }),
  episodeOf('episode:soon', ['quest:d'], { theme: 'rites', status: 'preview' }),
  episodeOf('episode:s2', ['quest:e'], { stage: 'stage2', theme: 'life' }),
];
const done = (...keys: string[]) =>
  snapshotWith(
    keys.map((k) => ({
      questId: `quest:${k}`,
      episodeId: EPISODES.find((e) => e.questIds.includes(`quest:${k}`))!.id,
    })),
  );
const base = { quests: QUESTS, episodes: EPISODES };

describe('playableEpisodes', () => {
  it('keeps shipped and ready episodes, in content order', () => {
    expect(playableEpisodes(EPISODES).map((e) => e.id)).toEqual(['episode:one', 'episode:two', 'episode:s2']);
  });
});

describe('offerableQuests', () => {
  it('is the quests of playable episodes in quest order', () => {
    expect(offerableQuests(QUESTS, EPISODES).map((q) => q.id)).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:e']);
  });

  it('drops quests of stages the learner is not entitled to', () => {
    const free = (stage: string) => stage === 'stage1';
    expect(offerableQuests(QUESTS, EPISODES, free).map((q) => q.id)).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });
});

describe('nextQuestAfter (the Journey cursor)', () => {
  it('is the first quest for a fresh learner', () => {
    expect(nextQuestAfter({ ...base, snapshot: done() })?.id).toBe('quest:a');
  });

  it('is the first incomplete quest in content order', () => {
    expect(nextQuestAfter({ ...base, snapshot: done('a') })?.id).toBe('quest:b');
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b') })?.id).toBe('quest:c');
  });

  it('treats a quest that was started but not completed as incomplete', () => {
    const snap = snapshotWith([], [{ questId: 'quest:a', episodeId: 'episode:one' }]);
    expect(nextQuestAfter({ ...base, snapshot: snap })?.id).toBe('quest:a');
  });

  it('treats justCompleted as done even before the snapshot has it', () => {
    expect(nextQuestAfter({ ...base, snapshot: done(), justCompleted: 'quest:a' })?.id).toBe('quest:b');
    expect(nextQuestAfter({ ...base, snapshot: done('a'), justCompleted: 'quest:b' })?.id).toBe('quest:c');
  });

  it('still points at the real next step when an earlier quest is replayed', () => {
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b'), justCompleted: 'quest:a' })?.id).toBe('quest:c');
  });

  it('skips quests of preview episodes', () => {
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b', 'c') })?.id).toBe('quest:e');
  });

  it('is undefined when every offerable quest is done', () => {
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b', 'c', 'e') })).toBeUndefined();
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b', 'c'), justCompleted: 'quest:e' })).toBeUndefined();
  });

  it('is undefined when nothing is offerable', () => {
    expect(nextQuestAfter({ ...base, episodes: [], snapshot: done() })).toBeUndefined();
  });

  it('never teases a stage the learner is not entitled to', () => {
    const free = (stage: string) => stage === 'stage1';
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b', 'c'), isEntitled: free })).toBeUndefined();
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b'), isEntitled: free })?.id).toBe('quest:c');
  });
});

describe('shipped content', () => {
  it('starts at the first Stage 1 quest', () => {
    const snap = snapshotWith([]);
    expect(nextQuestAfter({ snapshot: snap, quests: questsAll, episodes: episodesAll })?.id).toBe(
      'quest:stage1-letters-q1',
    );
  });
});
