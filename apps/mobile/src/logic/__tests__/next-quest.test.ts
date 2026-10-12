import type { Episode, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { snapshotWith, plainQuest, episodeOf } from '../stage1/__tests__/fixtures';
import { questOpenPredicate } from '../content-access';
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

const SHELF: Episode = episodeOf('episode:shelf-tale', ['quest:shelf'], { placement: 'shelf', format: 'story', order: 0 });
const WITH_SHELF: Episode[] = [SHELF, ...EPISODES];
const QUESTS_WITH_SHELF: Quest[] = [plainQuest('quest:shelf'), ...QUESTS];

describe('playableEpisodes', () => {
  it('keeps shipped and ready episodes, in content order', () => {
    expect(playableEpisodes(EPISODES).map((e) => e.id)).toEqual(['episode:one', 'episode:two', 'episode:s2']);
  });

  it('keeps grid episodes only: a shipped shelf episode is never playable on the grid (F-STORY-004 §3.10)', () => {
    expect(playableEpisodes(WITH_SHELF).map((e) => e.id)).toEqual(['episode:one', 'episode:two', 'episode:s2']);
  });
});

describe('offerableQuests', () => {
  it('is the quests of playable episodes in quest order', () => {
    expect(offerableQuests(QUESTS, EPISODES).map((q) => q.id)).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:e']);
  });

  it('leaves out the quest of a shelf episode', () => {
    expect(offerableQuests(QUESTS_WITH_SHELF, WITH_SHELF).map((q) => q.id)).toEqual(['quest:a', 'quest:b', 'quest:c', 'quest:e']);
  });

  it('drops quests of stages the learner is not entitled to', () => {
    const free = (stage: string) => stage === 'stage1';
    expect(offerableQuests(QUESTS, EPISODES, free).map((q) => q.id)).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });
});

describe('nextQuestAfter skipQuestIds (placed-out quests, F-PLC-001 section 3.7)', () => {
  it('skips placed-out quests without marking them done', () => {
    expect(nextQuestAfter({ ...base, snapshot: done(), skipQuestIds: new Set(['quest:a', 'quest:b']) })?.id).toBe('quest:c');
  });

  it('is undefined when every offerable quest is done or placed out', () => {
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b'), skipQuestIds: new Set(['quest:c', 'quest:e']) })).toBeUndefined();
  });

  it('ignores ids that are not offerable', () => {
    expect(nextQuestAfter({ ...base, snapshot: done(), skipQuestIds: new Set(['quest:zzz']) })?.id).toBe('quest:a');
  });
});

describe('nextQuestAfter (the Journey cursor)', () => {
  it('is the first quest for a fresh learner', () => {
    expect(nextQuestAfter({ ...base, snapshot: done() })?.id).toBe('quest:a');
  });

  it('never becomes a shelf quest, even one ordered before every cell', () => {
    expect(nextQuestAfter({ quests: QUESTS_WITH_SHELF, episodes: WITH_SHELF, snapshot: done() })?.id).toBe('quest:a');
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

describe('isQuestOpen (F-ENT-003 section 3.5: the cursor offers open quests only)', () => {
  const closed = (...keys: string[]) => {
    const ids = new Set(keys.map((k) => `quest:${k}`));
    return (questId: string): boolean => !ids.has(questId);
  };

  it('offerableQuests drops closed quests, after the stage predicate', () => {
    expect(offerableQuests(QUESTS, EPISODES, undefined, closed('b')).map((q) => q.id)).toEqual(['quest:a', 'quest:c', 'quest:e']);
    const free = (stage: string) => stage === 'stage1';
    expect(offerableQuests(QUESTS, EPISODES, free, closed('a')).map((q) => q.id)).toEqual(['quest:b', 'quest:c']);
  });

  it('omitted: every quest is open, as before', () => {
    expect(offerableQuests(QUESTS, EPISODES, undefined, undefined)).toEqual(offerableQuests(QUESTS, EPISODES));
    expect(nextQuestAfter({ ...base, snapshot: done('a'), isQuestOpen: undefined })?.id).toBe('quest:b');
  });

  it('the cursor skips a closed quest without marking it done', () => {
    expect(nextQuestAfter({ ...base, snapshot: done(), isQuestOpen: closed('a') })?.id).toBe('quest:b');
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b'), isQuestOpen: closed('c') })?.id).toBe('quest:e');
  });

  it('is undefined when every quest left is closed', () => {
    expect(nextQuestAfter({ ...base, snapshot: done('a', 'b', 'c'), isQuestOpen: closed('e') })).toBeUndefined();
  });

  it('applies with the stage predicate and the placed-out set together', () => {
    const free = (stage: string) => stage === 'stage1';
    expect(
      nextQuestAfter({ ...base, snapshot: done(), isEntitled: free, isQuestOpen: closed('b'), skipQuestIds: new Set(['quest:a']) })?.id,
    ).toBe('quest:c');
  });
});

describe('isQuestOpen on the shipped bundle (F-ENT-003 sections 3.3 and 3.5)', () => {
  const offerable = offerableQuests(questsAll, episodesAll).map((q) => q.id);
  const stage1 = offerable.filter((id) => episodesAll.some((e) => e.stage === 'stage1' && e.questIds.includes(id)));
  const doneIds = (ids: readonly string[]) =>
    snapshotWith(ids.map((questId) => ({ questId, episodeId: episodesAll.find((e) => e.questIds.includes(questId))?.id ?? '' })));
  const predicate = (tier: 'free' | 'premium', gatingEnabled: boolean, ids: readonly string[]) =>
    questOpenPredicate({ tier, gatingEnabled, completedQuestIds: new Set(ids) });

  it('golden, switch off: the cursor is unchanged for every prefix of the route, free and premium', () => {
    for (let n = 0; n <= offerable.length; n++) {
      const ids = offerable.slice(0, n);
      const snapshot = doneIds(ids);
      const today = nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll })?.id;
      for (const tier of ['free', 'premium'] as const) {
        const withSwitchOff = nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll, isQuestOpen: predicate(tier, false, ids) });
        expect(withSwitchOff?.id, `${tier}, ${n} done`).toBe(today);
      }
    }
  });

  it('switch on: a free learner who finished Stage 1 has no new quest; premium goes on into Stage 2', () => {
    expect(offerable.length).toBeGreaterThan(stage1.length);
    const snapshot = doneIds(stage1);
    expect(nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll, isQuestOpen: predicate('free', true, stage1) })).toBeUndefined();
    const premium = nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll, isQuestOpen: predicate('premium', true, stage1) });
    expect(premium?.id).toBe(offerable[stage1.length]);
  });

  it('switch on: a free learner still has every Stage 1 lesson on the cursor', () => {
    for (let n = 0; n < stage1.length; n++) {
      const ids = stage1.slice(0, n);
      const next = nextQuestAfter({ snapshot: doneIds(ids), quests: questsAll, episodes: episodesAll, isQuestOpen: predicate('free', true, ids) });
      expect(next?.id).toBe(stage1[n]);
    }
  });
});
