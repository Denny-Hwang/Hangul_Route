import type { RouteCatalog, RouteQuest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { cellLook, placedOutEpisodeIds, startCell } from '../cell-look';

const q = (id: string, episodeId: string, order: number, over: Partial<RouteQuest> = {}): RouteQuest => ({
  id,
  episodeId,
  stage: 'stage1',
  theme: 'letters',
  order,
  teaches: [],
  playable: true,
  grid: true,
  ...over,
});
const CATALOG: RouteCatalog = {
  quests: [
    q('q1', 'ep:letters', 1),
    q('q2', 'ep:letters', 2),
    q('q3', 'ep:life', 3, { theme: 'life' }),
    q('q4', 'ep:life', 4, { theme: 'life' }),
    q('story', 'ep:shelf', 5, { grid: false }),
    q('s2', 'ep:s2', 6, { stage: 'stage2', theme: 'rites' }),
  ],
};

describe('placed-out cells (F-PLC-001 section 3.7, consumer 3)', () => {
  it('a cell whose quests are all placed out or done, and not all done, looks placed out', () => {
    expect(placedOutEpisodeIds(CATALOG, new Set(['q1', 'q2']), new Set())).toEqual(['ep:letters']);
    expect(placedOutEpisodeIds(CATALOG, new Set(['q1']), new Set(['q2']))).toEqual(['ep:letters']);
    expect(placedOutEpisodeIds(CATALOG, new Set(), new Set(['q1', 'q2']))).toEqual([]);
    expect(placedOutEpisodeIds(CATALOG, new Set(['q3']), new Set())).toEqual([]);
  });

  it('shelf content is never placed out', () => {
    expect(placedOutEpisodeIds(CATALOG, new Set(['story']), new Set())).toEqual([]);
  });

  it('cellLook: done keeps its own look, placed out is different, otherwise none', () => {
    expect(cellLook('ep:letters', CATALOG, new Set(), new Set(['q1', 'q2']))).toBe('done');
    expect(cellLook('ep:letters', CATALOG, new Set(['q1', 'q2']), new Set())).toBe('placed-out');
    expect(cellLook('ep:life', CATALOG, new Set(['q3']), new Set())).toBe('none');
    expect(cellLook('ep:unknown', CATALOG, new Set(), new Set())).toBe('none');
  });

  it('the start cell carries the pin', () => {
    expect(startCell(CATALOG, 'q3')).toEqual({ episodeId: 'ep:life', stage: 'stage1', theme: 'life' });
    expect(startCell(CATALOG, 's2')).toEqual({ episodeId: 'ep:s2', stage: 'stage2', theme: 'rites' });
    expect(startCell(CATALOG, null)).toBeNull();
    expect(startCell(CATALOG, 'story')).toBeNull();
    expect(startCell(CATALOG, 'gone')).toBeNull();
  });
});
