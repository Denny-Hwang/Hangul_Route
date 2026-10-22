import { describe, expect, it } from 'vitest';
import { episodeOf, plainQuest } from '../../stage1/__tests__/fixtures';
import { questsInCursorOrder } from '../lesson-lookup';

describe('questsInCursorOrder', () => {
  const q = (id: string) => plainQuest(`quest:${id}`);
  const episodes = [
    episodeOf('episode:stage1-letters', ['quest:s1']),
    episodeOf('episode:stage2-life', ['quest:s2-life'], { stage: 'stage2', theme: 'life' }),
    episodeOf('episode:stage4-rites', ['quest:s4-rites'], { stage: 'stage4', theme: 'rites' }),
    episodeOf('episode:stage2-letters', ['quest:s2-wb'], { stage: 'stage2' }),
    episodeOf('episode:stage3-letters', ['quest:s3-fs'], { stage: 'stage3' }),
    episodeOf('episode:stage6-letters', ['quest:s6-menu', 'quest:s6-b'], { stage: 'stage6' }),
    episodeOf('episode:stage7-life', ['quest:s7-day'], { stage: 'stage7', theme: 'life' }),
  ];

  it('puts lesson quests of Stages 2-4 by stage before the stories and books, and Stages 6-7 after them', () => {
    const ids = questsInCursorOrder({
      early: [q('s1'), q('s2-life'), q('s4-rites')],
      lessons: [q('s7-day'), q('s2-wb'), q('s6-menu'), q('s3-fs'), q('s6-b')],
      middle: [q('story'), q('book')],
      episodes,
    }).map((x) => x.id.slice('quest:'.length));
    expect(ids).toEqual(['s1', 's2-life', 's2-wb', 's3-fs', 's4-rites', 'story', 'book', 's6-menu', 's6-b', 's7-day']);
  });

  it('keeps today\'s order when no lesson ships', () => {
    const early = [q('s1'), q('s2-life'), q('s4-rites')];
    expect(questsInCursorOrder({ early, lessons: [], middle: [q('story')], episodes }).map((x) => x.id)).toEqual([
      'quest:s1',
      'quest:s2-life',
      'quest:s4-rites',
      'quest:story',
    ]);
  });

  it('a quest no episode lists goes after the stories and books', () => {
    expect(questsInCursorOrder({ early: [q('loose')], lessons: [], middle: [q('story')], episodes }).map((x) => x.id)).toEqual([
      'quest:story',
      'quest:loose',
    ]);
  });
});
