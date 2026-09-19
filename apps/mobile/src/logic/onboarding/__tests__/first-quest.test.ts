import type { Episode, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { firstQuestFor } from '../first-quest';

const quest = (id: string): Quest => ({
  id,
  titleEn: id,
  estimatedMinutes: 5,
  steps: [
    { id: `${id}-1`, kind: 'intro', titleEn: 'a' },
    { id: `${id}-2`, kind: 'present', titleEn: 'b' },
    { id: `${id}-3`, kind: 'reward', titleEn: 'c' },
  ],
});
const episode = (id: string, order: number, status: Episode['status'], questIds: string[]): Episode => ({
  id,
  stage: 'stage1',
  theme: 'letters',
  order,
  titleEn: id,
  hoyaIntroEn: 'hi',
  questIds,
  rewardCardIds: ['card:a', 'card:b'],
  estimatedMinutes: 10,
  status,
});

describe('firstQuestFor', () => {
  it('picks the first quest of the lowest-ordered shipped episode', () => {
    const eps = [
      episode('episode:b', 2, 'shipped', ['quest:b1']),
      episode('episode:a', 1, 'shipped', ['quest:a1', 'quest:a2']),
    ];
    const target = firstQuestFor(eps, [quest('quest:a1'), quest('quest:b1')]);
    expect(target?.episode.id).toBe('episode:a');
    expect(target?.quest.id).toBe('quest:a1');
    expect(target?.questCount).toBe(2);
    expect(target?.cardCount).toBe(2);
  });
  it('skips preview episodes and episodes whose quest is missing', () => {
    const eps = [
      episode('episode:p', 0, 'preview', ['quest:p1']),
      episode('episode:m', 1, 'shipped', ['quest:missing']),
      episode('episode:ok', 2, 'shipped', ['quest:ok1']),
    ];
    expect(firstQuestFor(eps, [quest('quest:p1'), quest('quest:ok1')])?.quest.id).toBe('quest:ok1');
  });
  it('returns null with no shipped content', () => {
    expect(firstQuestFor([episode('episode:p', 0, 'preview', ['quest:p1'])], [quest('quest:p1')])).toBeNull();
  });
  it('resolves to Stage 1 letters on the real bundle', () => {
    const target = firstQuestFor(episodesAll, questsAll);
    expect(target?.episode.id).toBe('episode:stage1-letters');
    expect(target?.quest.id).toBe('quest:stage1-letters-q1');
  });
});
