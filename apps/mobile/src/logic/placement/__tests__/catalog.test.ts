import type { Episode, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { discoverQuest, episodeOf, plainQuest } from '../../stage1/__tests__/fixtures';
import { placementRouteCatalog, symbolKeyOf } from '../catalog';
import { appRouteCatalog } from '../route-skip';

describe('symbolKeyOf', () => {
  it('a consonant or vowel is its letter, a final carries /final', () => {
    expect(symbolKeyOf({ char: 'ㄱ', kind: 'consonant' })).toBe('ㄱ');
    expect(symbolKeyOf({ char: 'ㅏ', kind: 'vowel' })).toBe('ㅏ');
    expect(symbolKeyOf({ char: 'ㄴ', kind: 'batchim' })).toBe('ㄴ/final');
  });
});

describe('placementRouteCatalog (F-PLC-001 section 3.6)', () => {
  it('fills teaches with the symbol keys of each Discover step, dropping unknown ids', () => {
    const quests: Quest[] = [
      discoverQuest('quest:a', ['jamo:giyeok', 'jamo:a', 'jamo:nieun-batchim', 'jamo:unknown']),
      plainQuest('quest:b'),
    ];
    const episodes: Episode[] = [episodeOf('episode:one', ['quest:a', 'quest:b'])];
    const catalog = placementRouteCatalog(quests, episodes);
    expect(catalog.quests.map((q) => [q.id, q.teaches])).toEqual([
      ['quest:a', ['ㄱ', 'ㅏ', 'ㄴ/final']],
      ['quest:b', []],
    ]);
  });

  it('lists the same quests as the cursor catalogue for the shipped bundle', () => {
    const catalog = placementRouteCatalog(questsAll, episodesAll);
    expect(catalog.quests.map((q) => q.id)).toEqual(appRouteCatalog(questsAll, episodesAll).quests.map((q) => q.id));
  });

  it('gives the shipped life q1-q3 the symbols their Discover steps teach, so a stage1 level can place them out', () => {
    const teaches = new Map(placementRouteCatalog(questsAll, episodesAll).quests.map((q) => [q.id, q.teaches]));
    expect(teaches.get('quest:stage1-life-q1')).toEqual(['ㅈ', 'ㅊ']);
    expect(teaches.get('quest:stage1-life-q2')).toEqual(['ㅂ', 'ㅅ']);
    expect(teaches.get('quest:stage1-life-q3')).toEqual(['ㅋ', 'ㅌ']);
  });
});
