import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodeFor, episodesAll, gridEpisodes, isGridEpisode, shelfEpisodes } from '../episodes';
import { questsAll } from '../quests';

/**
 * F-STORY-004 §3.10: the grid/shelf split. A shelf episode (`placement: 'shelf'`)
 * lives outside the 7×5 grid; an episode without the field is a grid cell.
 */
const episode = (id: string, overrides: Partial<Episode> = {}): Episode => ({
  id,
  stage: 'stage1',
  theme: 'letters',
  order: 1,
  titleEn: id,
  hoyaIntroEn: 'Hi!',
  questIds: [`quest:${id.slice('episode:'.length)}`],
  rewardCardIds: [],
  estimatedMinutes: 10,
  status: 'shipped',
  ...overrides,
});

const cell = episode('episode:cell');
const explicitGrid = episode('episode:grid', { placement: 'grid', theme: 'life' });
const shelf = episode('episode:shelf-sun-and-moon', { placement: 'shelf', format: 'story', order: 101 });
const MIXED = [shelf, cell, explicitGrid];

describe('isGridEpisode', () => {
  it('is true for an episode without a placement (every hand-written episode)', () => {
    expect(isGridEpisode(cell)).toBe(true);
  });

  it('is true for placement "grid" and false for placement "shelf"', () => {
    expect(isGridEpisode(explicitGrid)).toBe(true);
    expect(isGridEpisode(shelf)).toBe(false);
  });
});

describe('gridEpisodes / shelfEpisodes', () => {
  it('split a list in two, keeping content order', () => {
    expect(gridEpisodes(MIXED).map((e) => e.id)).toEqual(['episode:cell', 'episode:grid']);
    expect(shelfEpisodes(MIXED).map((e) => e.id)).toEqual(['episode:shelf-sun-and-moon']);
  });

  it('return empty lists for an empty input', () => {
    expect(gridEpisodes([])).toEqual([]);
    expect(shelfEpisodes([])).toEqual([]);
  });

  it('leave today\'s bundle unchanged: every shipped episode is a grid episode', () => {
    expect(gridEpisodes(episodesAll)).toEqual(episodesAll);
    expect(shelfEpisodes(episodesAll)).toEqual([]);
  });

  it('keep Home\'s quest total (quests of grid episodes) equal to today\'s quest count', () => {
    const gridQuestIds = new Set(gridEpisodes(episodesAll).flatMap((e) => e.questIds));
    expect(questsAll.filter((q) => gridQuestIds.has(q.id))).toHaveLength(questsAll.length);
  });
});

describe('episodeFor', () => {
  it('ignores a shelf episode that shares the stage and theme of a cell', () => {
    expect(episodeFor('stage1', 'letters', MIXED)?.id).toBe('episode:cell');
  });

  it('is undefined when only a shelf episode sits at that stage and theme', () => {
    expect(episodeFor('stage1', 'letters', [shelf])).toBeUndefined();
  });

  it('reads the bundle by default', () => {
    expect(episodeFor('stage1', 'letters')?.id).toBe('episode:stage1-letters');
  });
});
