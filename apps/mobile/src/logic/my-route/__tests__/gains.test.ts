import { describe, expect, it } from 'vitest';
import type { Episode } from '@hangul-route/content-schema';
import { gainsOf } from '../gains';
import { BUNDLE_8, episode, snapshotWith } from './fixtures/bundle-2026-10';

const shelf: Episode = { ...episode('stage1', 'letters', 'A tale', ['quest:story-a-listen']), id: 'episode:shelf-a', placement: 'shelf' };
const episodes = [...BUNDLE_8.episodes, shelf];

describe('gainsOf (F-ROUTE-001 section 3.8)', () => {
  it('is all zero for a new learner (the section is hidden)', () => {
    expect(gainsOf({ snapshot: snapshotWith([]), episodes })).toEqual({ stars: 0, cards: 0, storiesRead: 0 });
  });

  it('sums the best stars per quest, counts cards with no total and distinct finished shelf quests', () => {
    const snapshot = snapshotWith(
      ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:story-a-listen', 'quest:story-a-listen'],
      {
        cards: [
          { cardId: 'card:a', unlockedAt: 't', newSinceLastView: false },
          { cardId: 'card:b', unlockedAt: 't', newSinceLastView: true },
        ],
      },
      { 'quest:stage1-letters-q1': 3, 'quest:stage1-letters-q2': 2 },
    );
    snapshot.quests.push({ ...(snapshot.quests[0] as (typeof snapshot.quests)[number]), stars: 1 });
    snapshot.quests.push({ questId: 'quest:stage1-life-q1', episodeId: 'episode:stage1-life', startedAt: 't', stars: 0, attempts: 1, accuracy: 0 });
    expect(gainsOf({ snapshot, episodes })).toEqual({ stars: 6, cards: 2, storiesRead: 1 });
  });

  it('does not count an unfinished shelf quest', () => {
    const snapshot = snapshotWith([]);
    snapshot.quests.push({ questId: 'quest:story-a-listen', episodeId: 'episode:shelf-a', startedAt: 't', stars: 0, attempts: 1, accuracy: 0 });
    expect(gainsOf({ snapshot, episodes }).storiesRead).toBe(0);
  });
});
