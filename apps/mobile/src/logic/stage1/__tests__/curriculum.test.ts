import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import {
  STAGE1_QUESTS,
  questTeaches,
  stage1QuestsFrom,
  symbolsMetThrough,
  teachingQuestFor,
} from '../curriculum';
import { discoverQuest, episodeOf, plainQuest, wordItem } from './fixtures';

const q1 = discoverQuest('quest:one', ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
const q2 = discoverQuest('quest:two', ['jamo:o', 'jamo:nieun-batchim']);
const q3 = discoverQuest('quest:three', []); // word-only Discover: teaches nothing
const q4 = plainQuest('quest:four'); // no Discover step at all
const stage2Quest = discoverQuest('quest:s2', ['jamo:u']);
const previewQuest = discoverQuest('quest:preview', ['jamo:i']);
const QUESTS = [q1, q2, q3, q4, stage2Quest, previewQuest];
const EPISODES = [
  episodeOf('episode:one', ['quest:one', 'quest:two']),
  episodeOf('episode:two', ['quest:three', 'quest:four'], { theme: 'life', status: 'ready' }),
  episodeOf('episode:s2', ['quest:s2'], { stage: 'stage2' }),
  episodeOf('episode:preview', ['quest:preview'], { theme: 'rites', status: 'preview' }),
];

describe('stage1QuestsFrom', () => {
  it('keeps the playable stage1 grid quests in content order', () => {
    expect(stage1QuestsFrom(EPISODES, QUESTS).map((q) => q.id)).toEqual([
      'quest:one',
      'quest:two',
      'quest:three',
      'quest:four',
    ]);
  });

  it('follows the quest array order, not the episode listing order', () => {
    const reversed = [...EPISODES].reverse();
    expect(stage1QuestsFrom(reversed, QUESTS).map((q) => q.id)).toEqual([
      'quest:one',
      'quest:two',
      'quest:three',
      'quest:four',
    ]);
  });

  it('skips episode quest ids that have no quest', () => {
    const eps = [episodeOf('episode:x', ['quest:one', 'quest:ghost'])];
    expect(stage1QuestsFrom(eps, QUESTS).map((q) => q.id)).toEqual(['quest:one']);
  });
});

describe('STAGE1_QUESTS (shipped content)', () => {
  it('is exactly the stage1 quests of the shipped grid episodes', () => {
    const ids = new Set(
      episodesAll
        .filter((e) => e.stage === 'stage1' && (e.status === 'shipped' || e.status === 'ready'))
        .flatMap((e) => e.questIds),
    );
    expect(STAGE1_QUESTS.map((q) => q.id)).toEqual(questsAll.filter((q) => ids.has(q.id)).map((q) => q.id));
    expect(STAGE1_QUESTS.length).toBeGreaterThan(0);
  });
});

describe('questTeaches', () => {
  it('lists the jamo ids of the Discover jamo items in page order', () => {
    expect(questTeaches(q1)).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
    expect(questTeaches(q2)).toEqual(['jamo:o', 'jamo:nieun-batchim']);
  });

  it('ignores word items and quests without a Discover step', () => {
    expect(questTeaches(q3)).toEqual([]);
    expect(questTeaches(q4)).toEqual([]);
    const mixed = discoverQuest('quest:mixed', ['jamo:a']);
    mixed.steps[1]!.discover!.pages.push({ items: [wordItem()] });
    expect(questTeaches(mixed)).toEqual(['jamo:a']);
  });
});

describe('teachingQuestFor', () => {
  it('finds the one quest that teaches a symbol', () => {
    expect(teachingQuestFor('jamo:eo', STAGE1_QUESTS_FIXTURE)?.id).toBe('quest:one');
    expect(teachingQuestFor('jamo:nieun-batchim', STAGE1_QUESTS_FIXTURE)?.id).toBe('quest:two');
  });

  it('keeps the initial and the batchim of a consonant apart', () => {
    expect(teachingQuestFor('jamo:nieun', STAGE1_QUESTS_FIXTURE)?.id).toBe('quest:one');
  });

  it('is undefined for a symbol nobody teaches', () => {
    expect(teachingQuestFor('jamo:hieut', STAGE1_QUESTS_FIXTURE)).toBeUndefined();
  });

  it('reads the shipped Stage 1 list by default', () => {
    expect(teachingQuestFor('jamo:giyeok')?.id).toBe('quest:stage1-letters-q1'); // F-QUEST-002 Q-6a
    expect(teachingQuestFor('jamo:rieul')?.id).toBe('quest:stage1-letters-q3');
    expect(teachingQuestFor('jamo:hieut')?.id).toBe('quest:stage1-rites-q3'); // F-QUEST-002 Q-7b
    expect(teachingQuestFor('jamo:nieun-batchim')?.id).toBe('quest:stage1-rites-q1');
    expect(teachingQuestFor('jamo:mieum-batchim')?.id).toBe('quest:stage1-nature-q1'); // F-QUEST-002 Q-8
    expect(teachingQuestFor('jamo:bieup-batchim')?.id).toBe('quest:stage1-nature-q1');
  });
});

describe('symbolsMetThrough', () => {
  it('collects what the quest and every earlier quest teach, in teaching order', () => {
    expect(symbolsMetThrough('quest:one', STAGE1_QUESTS_FIXTURE)).toEqual([
      'jamo:a',
      'jamo:eo',
      'jamo:giyeok',
      'jamo:nieun',
    ]);
    expect(symbolsMetThrough('quest:three', STAGE1_QUESTS_FIXTURE)).toEqual([
      'jamo:a',
      'jamo:eo',
      'jamo:giyeok',
      'jamo:nieun',
      'jamo:o',
      'jamo:nieun-batchim',
    ]);
  });

  it('is empty for an unknown quest id', () => {
    expect(symbolsMetThrough('quest:ghost', STAGE1_QUESTS_FIXTURE)).toEqual([]);
  });

  it('reads the shipped Stage 1 list by default', () => {
    expect(symbolsMetThrough(STAGE1_QUESTS[0]!.id)).toEqual(['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
  });
});

const STAGE1_QUESTS_FIXTURE = stage1QuestsFrom(EPISODES, QUESTS);
