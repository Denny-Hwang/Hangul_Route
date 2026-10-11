import { PlacementResultSchema, questsPlacedOutAtLevel, type Episode, type Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { episodeOf, plainQuest } from '../../stage1/__tests__/fixtures';
import { appRouteCatalog, placedOutSkipSet } from '../route-skip';
import { placementResult } from './fixtures';

const QUESTS: Quest[] = ['a', 'b', 'c', 'd', 'shelf', 'loose'].map((k) => plainQuest(`quest:${k}`));
const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:a', 'quest:b']),
  episodeOf('episode:two', ['quest:c'], { theme: 'life', status: 'ready' }),
  episodeOf('episode:soon', ['quest:d'], { theme: 'rites', status: 'preview' }),
  episodeOf('episode:shelf', ['quest:shelf'], { placement: 'shelf', format: 'story' }),
];

describe('appRouteCatalog', () => {
  it('lists the app quests in the cursor order with grid and playable from their episode', () => {
    const catalog = appRouteCatalog(QUESTS, EPISODES);
    expect(catalog.quests.map((q) => [q.id, q.episodeId, q.order, q.grid, q.playable])).toEqual([
      ['quest:a', 'episode:one', 0, true, true],
      ['quest:b', 'episode:one', 1, true, true],
      ['quest:c', 'episode:two', 2, true, true],
      ['quest:d', 'episode:soon', 3, true, false],
      ['quest:shelf', 'episode:shelf', 4, false, false],
    ]);
    expect(catalog.quests[2]).toMatchObject({ stage: 'stage1', theme: 'life', teaches: [] });
  });

  it('a quest listed by two episodes belongs to the first', () => {
    const twice = [...EPISODES, episodeOf('episode:again', ['quest:a'], { theme: 'nature' })];
    expect(appRouteCatalog(QUESTS, twice).quests[0]?.episodeId).toBe('episode:one');
  });
});

describe('placedOutSkipSet (F-PLC-001 section 3.7, consumer 1)', () => {
  it('is undefined without a stored result, so the cursor is unchanged', () => {
    expect(placedOutSkipSet(undefined, QUESTS, EPISODES)).toBeUndefined();
    expect(placedOutSkipSet([], QUESTS, EPISODES)).toBeUndefined();
  });

  it('is the union of every result placed-out ids', () => {
    const first = placementResult({ id: 'placement:one', completedAt: '2026-10-01T00:00:00Z', placedOutQuestIds: ['quest:a'] });
    const second = placementResult({ id: 'placement:two', completedAt: '2026-10-02T00:00:00Z', placedOutQuestIds: ['quest:b'] });
    expect([...(placedOutSkipSet([second, first], QUESTS, EPISODES) ?? [])].sort()).toEqual(['quest:a', 'quest:b']);
  });

  it('a parent override puts back the chosen quest and everything after it, in the cursor order', () => {
    const overridden = placementResult({
      placedOutQuestIds: ['quest:a', 'quest:b', 'quest:c'],
      override: { by: 'parent', at: '2026-10-03T00:00:00Z', startQuestId: 'quest:b' },
    });
    expect([...(placedOutSkipSet([overridden], QUESTS, EPISODES) ?? [])]).toEqual(['quest:a']);
  });
});

describe('the shipped content fits a stored result', () => {
  it('the highest level any mode reaches places out no more quests than PlacementResultSchema keeps', () => {
    const max = PlacementResultSchema.shape.placedOutQuestIds._def.maxLength?.value ?? 0;
    const placedOut = questsPlacedOutAtLevel({ stage: 'stage3', band: 0 }, appRouteCatalog(questsAll, episodesAll));
    expect(max).toBe(40);
    expect(placedOut.length).toBeLessThanOrEqual(max);
  });
});
